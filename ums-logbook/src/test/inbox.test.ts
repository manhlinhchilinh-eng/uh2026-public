import { describe, it, expect } from 'vitest';
import { buildInbox, filterInbox, composeTargets, type InboxItem } from '../utils/inbox';
import type { Announcement } from '../types/announcement';
import type { NoticeAck, OfficeNotice } from '../utils/officeNotices';

const NOW = new Date(2026, 9, 23, 10, 0).getTime();
const H = 3600_000;

const ann = (id: string, over: Partial<Announcement> = {}): Announcement => ({
  id, title: `TB ${id}`, body: 'x', level: 'normal',
  audience: { toStaff: true, toParents: false, toStudents: false, classId: null }, audienceKeys: ['staff'], classId: null,
  forwardableToParents: false, authorId: 'a', authorName: 'BGH', authorRole: 'admin', createdAt: NOW - 5 * H, ...over,
});
const off = (id: string, over: Partial<OfficeNotice> = {}): OfficeNotice => ({
  id, title: `VP ${id}`, body: 'x', tags: ['all'], recipientUids: ['me'], pinned: false, requiresDone: false,
  deadlineAt: null, remindBefore: [], authorId: 'vp', authorName: 'Văn phòng', createdAt: NOW - 5 * H, updatedAt: NOW - 5 * H, ...over,
});
const ids = (xs: InboxItem[]) => xs.map((x) => x.id);

describe('buildInbox — 1 hộp thư cho 2 nguồn', () => {
  it('gộp thông báo + tin Văn phòng, giữ loại nguồn', () => {
    const out = buildInbox([ann('a1')], new Set(), [off('o1')], new Map(), NOW);
    expect(out.map((x) => x.kind).sort()).toEqual(['announcement', 'office']);
  });

  it('thứ tự: quá hạn → khẩn chưa đọc / sắp hạn → ghim → chưa đọc → còn lại; cùng nhóm thì mới hơn trước', () => {
    const acks = new Map<string, NoticeAck>([['o-read', { uid: 'me', displayName: 'Tôi', readAt: NOW - H }]]);
    const out = buildInbox(
      [ann('a-urgent', { level: 'urgent' }), ann('a-old-read', { createdAt: NOW - 50 * H }), ann('a-new-unread', { createdAt: NOW - H })],
      new Set(['a-old-read']),
      [
        off('o-overdue', { requiresDone: true, deadlineAt: NOW - H }),
        off('o-soon', { requiresDone: true, deadlineAt: NOW + H, remindBefore: [120] }),
        off('o-pinned', { pinned: true, createdAt: NOW - 40 * H }),
        off('o-read', { createdAt: NOW - 2 * H }),
      ],
      acks,
      NOW
    );
    expect(ids(out)).toEqual(['o-overdue', 'a-urgent', 'o-soon', 'o-pinned', 'a-new-unread', 'o-read', 'a-old-read']);
  });

  it('cờ dùng cho hiển thị: unread / needsAction / urgent', () => {
    const out = buildInbox([ann('a1', { level: 'urgent' })], new Set(), [off('o1', { requiresDone: true })], new Map(), NOW);
    const a = out.find((x) => x.id === 'a1')!;
    const o = out.find((x) => x.id === 'o1')!;
    expect([a.unread, a.urgent, a.needsAction]).toEqual([true, true, false]);
    expect([o.unread, o.needsAction]).toEqual([true, true]);
  });
});

describe('filterInbox', () => {
  const items = buildInbox(
    [ann('a1', { level: 'urgent', title: 'Họp hội đồng' }), ann('a2', { title: 'Lịch thi' })],
    new Set(['a2']),
    [off('o1', { requiresDone: true, title: 'Nộp kế hoạch' }), off('o2', { title: 'Tin thường' })],
    new Map([['o2', { uid: 'me', displayName: 'Tôi', readAt: NOW }]]),
    NOW
  );
  it('Chưa đọc / Cần làm / Khẩn', () => {
    expect(ids(filterInbox(items, 'unread', '')).sort()).toEqual(['a1', 'o1']);
    expect(ids(filterInbox(items, 'action', ''))).toEqual(['o1']);
    expect(ids(filterInbox(items, 'urgent', ''))).toEqual(['a1']);
    expect(filterInbox(items, 'all', '')).toHaveLength(4);
  });
  it('tìm không dấu theo tiêu đề', () => {
    expect(ids(filterInbox(items, 'all', 'ke hoach'))).toEqual(['o1']);
  });
});

describe('composeTargets — ai soạn gì', () => {
  it('BGH: nhân sự + PH/HS toàn trường', () => {
    expect(composeTargets('admin', null)).toEqual({ staff: true, families: true, fixedClassId: null });
  });
  it('Văn phòng: chỉ nhân sự', () => {
    expect(composeTargets('vanphong', null)).toEqual({ staff: true, families: false, fixedClassId: null });
  });
  it('GVCN: chỉ PH/HS lớp mình', () => {
    expect(composeTargets('gvcn', '6A1')).toEqual({ staff: false, families: true, fixedClassId: '6A1' });
  });
  it('GVBM / PH / HS: không soạn', () => {
    for (const r of ['gvbm', 'parent', 'student', 'tpt'] as const) {
      expect(composeTargets(r, null)).toEqual({ staff: false, families: false, fixedClassId: null });
    }
  });
});
