import { describe, it, expect } from 'vitest';
import { resolveRecipients, noticeStatus, formatRemaining, sortNotices, trackNotice, validateNotice, shouldRefreshNotices, OFFICE_NOTICE_LIMIT, groupMembers, validateGroup, upsertGroup, knownTags, NOTICE_GROUP_MAX, cleanAttachments, visibleAttachments, NOTICE_ATTACHMENT_MAX, type OfficeNotice, type NoticeGroup } from '../utils/officeNotices';

const dir = [
  { uid: 'a', displayName: 'Cô A', roles: ['gvcn', 'gvbm'] as const },
  { uid: 'b', displayName: 'Thầy B', roles: ['gvbm'] as const },
  { uid: 'c', displayName: 'Cô C', roles: ['tpt'] as const },
  { uid: 'd', displayName: 'Cô D', roles: ['admin'] as const },
  { uid: 'e', displayName: 'Chị E', roles: ['vanphong'] as const },
  { uid: 'f', displayName: 'Anh F', roles: ['giamthi'] as const },
].map((x) => ({ ...x, roles: [...x.roles] }));

const H = 3_600_000;
const D = 24 * H;
const base = (over: Partial<OfficeNotice> = {}): OfficeNotice => ({
  id: 'n', title: 't', body: 'b', tags: ['all'], recipientUids: ['a'], pinned: false, requiresDone: true,
  deadlineAt: null, remindBefore: [], authorId: 'd', authorName: 'BGH', createdAt: 0, updatedAt: 0, ...over,
});

describe('Thông báo Văn phòng — người nhận', () => {
  it('Toàn thể GV = mọi nhân sự trừ Văn phòng; nhãn theo vai trò; chọn đích danh', () => {
    expect(resolveRecipients(dir, ['all'])).toEqual(['a', 'b', 'c', 'd', 'f']);
    expect(resolveRecipients(dir, ['gvcn'])).toEqual(['a']);
    expect(resolveRecipients(dir, ['gvbm', 'bgh'])).toEqual(['a', 'b', 'd']);
    expect(resolveRecipients(dir, [], ['e', 'b'])).toEqual(['b', 'e']);
    expect(resolveRecipients(dir, ['giamthi'], ['f'])).toEqual(['f']);
  });
});

describe('Hạn chót & nhắc trước hạn', () => {
  const now = 1_000 * D;
  it('trạng thái: xong / quá hạn / sắp hạn (theo mốc nhắc) / còn mở', () => {
    const n = base({ deadlineAt: now + 2 * H, remindBefore: [24 * 60, 60] });
    expect(noticeStatus(n, undefined, now)).toBe('due_soon'); // trong 1 ngày trước hạn
    expect(noticeStatus(n, undefined, now - 2 * D)).toBe('open');
    expect(noticeStatus(n, undefined, now + 3 * H)).toBe('overdue');
    expect(noticeStatus(n, { uid: 'a', displayName: 'A', readAt: 1, doneAt: 2 }, now + 3 * H)).toBe('done');
    expect(noticeStatus(base({ requiresDone: false }), { uid: 'a', displayName: 'A', readAt: 1 }, now)).toBe('read');
  });

  it('hiển thị thời gian còn lại', () => {
    expect(formatRemaining(2 * D + 3 * H)).toBe('còn 2 ngày 3 giờ');
    expect(formatRemaining(45 * 60_000)).toBe('còn 45 phút');
    expect(formatRemaining(-D)).toBe('quá hạn 1 ngày');
    expect(formatRemaining(2 * H - 30_000)).toBe('còn 1 giờ 59 phút');
    expect(formatRemaining(20_000)).toBe('còn dưới 1 phút');
  });

  it('sắp xếp: ghim → quá hạn → sắp hạn → mới', () => {
    const list = [
      base({ id: 'old', createdAt: 1 }),
      base({ id: 'soon', deadlineAt: now + H, remindBefore: [120], createdAt: 2 }),
      base({ id: 'late', deadlineAt: now - H, createdAt: 3 }),
      base({ id: 'pin', pinned: true, createdAt: 0 }),
      base({ id: 'new', createdAt: 9 }),
    ];
    expect(sortNotices(list, new Map(), now).map((n) => n.id)).toEqual(['pin', 'late', 'soon', 'new', 'old']);
  });
});

describe('Theo dõi cho người gửi', () => {
  it('đếm đã đọc / đã thực hiện, liệt kê ai chưa', () => {
    const t = trackNotice(['a', 'b', 'c'], [{ uid: 'a', displayName: 'Cô A', readAt: 1, doneAt: 2 }, { uid: 'b', displayName: 'Thầy B', readAt: 1 }], dir);
    expect(t).toMatchObject({ total: 3, read: 2, done: 1, notRead: ['Cô C'], notDone: ['Cô C', 'Thầy B'] });
  });

  it('kiểm tra dữ liệu', () => {
    expect(validateNotice({ title: '', body: 'x', recipientUids: ['a'], deadlineAt: null }, 0)).toMatch(/tiêu đề/);
    expect(validateNotice({ title: 'x', body: 'x', recipientUids: [], deadlineAt: null }, 0)).toMatch(/người nhận/);
    expect(validateNotice({ title: 'x', body: 'x', recipientUids: ['a'], deadlineAt: 5 }, 10)).toMatch(/tương lai/);
    expect(validateNotice({ title: 'x', body: 'x', recipientUids: ['a'], deadlineAt: null }, 0)).toBeNull();
  });
});

describe('shouldRefreshNotices — chặn hỏi máy chủ khi tab ẩn / quá dày (bài học 12/10)', () => {
  const MIN = 15 * 60_000;
  it('tab ẩn → không bao giờ tải', () => {
    expect(shouldRefreshNotices({ hidden: true, lastAt: 0, now: 10 * MIN })).toBe(false);
  });
  it('chưa tải lần nào → tải', () => {
    expect(shouldRefreshNotices({ hidden: false, lastAt: null, now: 1 })).toBe(true);
  });
  it('dưới 15 phút → không tải; đủ 15 phút → tải', () => {
    expect(shouldRefreshNotices({ hidden: false, lastAt: 1000, now: 1000 + MIN - 1 })).toBe(false);
    expect(shouldRefreshNotices({ hidden: false, lastAt: 1000, now: 1000 + MIN })).toBe(true);
  });
  it('tab để quên cả ngày (luôn ẩn) → 0 lần tải sau lần đầu', () => {
    let last: number | null = 0;
    let loads = 0;
    for (let t = 60_000; t <= 24 * 60 * 60_000; t += 60_000) {
      if (shouldRefreshNotices({ hidden: true, lastAt: last, now: t })) { loads++; last = t; }
    }
    expect(loads).toBe(0);
  });
  it('tab mở liên tục cả ngày → tối đa 96 lần (15 phút/lần)', () => {
    let last: number | null = null;
    let loads = 0;
    for (let t = 0; t < 24 * 60 * 60_000; t += 60_000) {
      if (shouldRefreshNotices({ hidden: false, lastAt: last, now: t })) { loads++; last = t; }
    }
    expect(loads).toBe(96);
    expect(OFFICE_NOTICE_LIMIT).toBeLessThanOrEqual(50);
  });
});

describe('Người nhận theo khối GVCN và nhóm lưu sẵn', () => {
  const dir2 = [
    { uid: 'h6', displayName: 'GVCN 6A1', roles: ['gvcn', 'gvbm'], assignedClassId: '6A1' },
    { uid: 'h6b', displayName: 'GVCN 6A2', roles: ['gvcn'], assignedClassId: '6A2' },
    { uid: 'h9', displayName: 'GVCN 9A1', roles: ['gvcn'], assignedClassId: '9A1' },
    { uid: 'bm', displayName: 'GVBM', roles: ['gvbm'], assignedClassId: '7A1' },
    { uid: 'x', displayName: 'Thiếu lớp', roles: ['gvcn'] },
  ] as Array<{ uid: string; displayName: string; roles: Array<'gvcn' | 'gvbm'>; assignedClassId?: string }>;

  it('GVCN khối 6 chỉ gồm GVCN có lớp chủ nhiệm khối 6', () => {
    expect(resolveRecipients(dir2, [], [], ['6'])).toEqual(['h6', 'h6b']);
    expect(resolveRecipients(dir2, [], [], ['6', '9'])).toEqual(['h6', 'h6b', 'h9']);
    // GVBM có assignedClassId nhưng không phải GVCN → không nhận
    expect(resolveRecipients(dir2, [], [], ['7'])).toEqual([]);
  });

  const groups: NoticeGroup[] = [
    { id: 'g1', name: 'Tổ Tiếng Anh', uids: ['bm', 'h6', 'gone'], updatedAt: 1, updatedBy: 'vp' },
    { id: 'g2', name: 'Ban nề nếp', uids: ['h9'], updatedAt: 1, updatedBy: 'vp' },
  ];

  it('groupMembers gộp nhóm đã chọn, bỏ người không còn trong danh bạ', () => {
    expect(groupMembers(groups, ['g1'], dir2)).toEqual(['bm', 'h6']);
    expect(groupMembers(groups, ['g1', 'g2'])).toEqual(['bm', 'gone', 'h6', 'h9']);
    expect(groupMembers(groups, [], dir2)).toEqual([]);
  });

  it('nhóm + khối + đích danh không trùng', () => {
    expect(resolveRecipients(dir2, [], ['h9', ...groupMembers(groups, ['g1'], dir2)], ['6'])).toEqual(['bm', 'h6', 'h6b', 'h9']);
  });

  it('validateGroup: tên, thành viên, trùng tên, giới hạn', () => {
    expect(validateGroup({ id: 'n', name: ' ', uids: ['a'] }, groups)).toMatch(/tên nhóm/);
    expect(validateGroup({ id: 'n', name: 'Tổ Toán', uids: [] }, groups)).toMatch(/thành viên/);
    expect(validateGroup({ id: 'n', name: 'tổ tiếng anh ', uids: ['a'] }, groups)).toMatch(/trùng tên/);
    expect(validateGroup({ id: 'g1', name: 'Tổ Tiếng Anh', uids: ['a'] }, groups)).toBeNull();
    const many = Array.from({ length: NOTICE_GROUP_MAX }, (_, i) => ({ ...groups[0], id: `m${i}`, name: `N${i}` }));
    expect(validateGroup({ id: 'new', name: 'Mới', uids: ['a'] }, many)).toMatch(/Tối đa/);
  });

  it('upsertGroup thay nhóm cùng id, bỏ trùng thành viên, sắp theo tên', () => {
    const next = upsertGroup(groups, { id: 'g2', name: ' An toàn ', uids: ['b', 'a', 'b'], updatedAt: 2, updatedBy: 'vp' });
    expect(next.map((g) => g.name)).toEqual(['An toàn', 'Tổ Tiếng Anh']);
    expect(next[0].uids).toEqual(['a', 'b']);
  });

  it('knownTags bỏ nhãn lạ (dữ liệu từ bản khác) để không lỗi hiển thị', () => {
    expect(knownTags(['all', 'gvcn6', 'bgh'])).toEqual(['all', 'bgh']);
    expect(knownTags(undefined)).toEqual([]);
  });
});

describe('Tệp đính kèm (link Google Drive)', () => {
  it('bỏ dòng trống, đặt tên mặc định theo loại link', () => {
    const r = cleanAttachments([
      { name: '', url: '' },
      { name: '  Kế hoạch tuần 10 ', url: ' https://docs.google.com/document/d/1/edit ' },
      { name: '', url: 'https://drive.google.com/file/d/2/view' },
      { name: '', url: 'https://docs.google.com/spreadsheets/d/3' },
    ]);
    expect(r.error).toBeNull();
    expect(r.attachments).toEqual([
      { name: 'Kế hoạch tuần 10', url: 'https://docs.google.com/document/d/1/edit' },
      { name: 'Google Drive', url: 'https://drive.google.com/file/d/2/view' },
      { name: 'Google Sheets', url: 'https://docs.google.com/spreadsheets/d/3' },
    ]);
  });

  it('chặn link không phải https và quá số tệp', () => {
    expect(cleanAttachments([{ name: 'x', url: 'javascript:alert(1)' }]).error).toMatch(/https/);
    expect(cleanAttachments([{ name: 'x', url: 'http://drive.google.com/x' }]).error).toMatch(/https/);
    const many = Array.from({ length: NOTICE_ATTACHMENT_MAX + 1 }, (_, i) => ({ name: `f${i}`, url: 'https://drive.google.com/x' }));
    expect(cleanAttachments(many).error).toMatch(/Tối đa/);
  });

  it('visibleAttachments bỏ link lạ/không an toàn trong dữ liệu', () => {
    expect(
      visibleAttachments([
        { name: 'ok', url: 'https://drive.google.com/x' },
        { name: 'xấu', url: 'javascript:alert(1)' },
        { name: 'thiếu', url: undefined as unknown as string },
      ])
    ).toEqual([{ name: 'ok', url: 'https://drive.google.com/x' }]);
    expect(visibleAttachments(undefined)).toEqual([]);
  });
});
