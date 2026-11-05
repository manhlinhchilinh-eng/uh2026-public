import { describe, it, expect } from 'vitest';
import {
  buildAudienceKeys,
  familyAudienceKeys,
  composePolicy,
  validateAnnouncement,
  sortForInbox,
  unreadUrgent,
  describeAudience,
  formatForZalo,
} from '../utils/announcements';
import type { Announcement } from '../types/announcement';

const mk = (id: string, level: Announcement['level'], createdAt: number): Announcement => ({
  id, level, createdAt, title: id, body: 'b', audience: { toStaff: true, toParents: false, toStudents: false, classId: null },
  audienceKeys: ['staff'], classId: null, forwardableToParents: false, authorId: 'u', authorName: 'BGH', authorRole: 'admin',
});

describe('Thông báo thông minh — logic', () => {
  it('audienceKeys theo đối tượng và phạm vi lớp', () => {
    expect(buildAudienceKeys({ toStaff: true, toParents: true, toStudents: false, classId: null })).toEqual(['staff', 'parent:all']);
    expect(buildAudienceKeys({ toStaff: false, toParents: true, toStudents: true, classId: '6A1' })).toEqual(['parent:6A1', 'student:6A1']);
    expect(buildAudienceKeys({ toStaff: false, toParents: false, toStudents: false, classId: null })).toEqual([]);
  });

  it('PH/HS nhận thông báo toàn trường + lớp mình', () => {
    expect(familyAudienceKeys('parent', '6A1')).toEqual(['parent:all', 'parent:6A1']);
    expect(familyAudienceKeys('student')).toEqual(['student:all']);
  });

  it('quyền soạn: BGH mọi đối tượng; GVCN chỉ lớp mình; GVBM/TPT/PH không soạn', () => {
    expect(composePolicy('admin')).toEqual({ canCompose: true, fixedClassId: null });
    expect(composePolicy('gvcn', '7A3')).toEqual({ canCompose: true, fixedClassId: '7A3' });
    expect(composePolicy('gvcn', null).canCompose).toBe(false);
    for (const r of ['gvbm', 'tpt', 'parent', 'student'] as const) expect(composePolicy(r).canCompose).toBe(false);
  });

  it('kiểm tra dữ liệu nhập', () => {
    const aud = { toStaff: true, toParents: false, toStudents: false, classId: null };
    expect(validateAnnouncement({ title: ' ', body: 'x', audience: aud })).toMatch(/tiêu đề/);
    expect(validateAnnouncement({ title: 'x', body: '', audience: aud })).toMatch(/nội dung/);
    expect(validateAnnouncement({ title: 'x', body: 'y', audience: { ...aud, toStaff: false } })).toMatch(/đối tượng/);
    expect(validateAnnouncement({ title: 'x'.repeat(151), body: 'y', audience: aud })).toMatch(/150/);
    expect(validateAnnouncement({ title: 'x', body: 'y', audience: aud })).toBeNull();
  });

  it('hộp thư: chưa đọc trước, khẩn trước, mới trước', () => {
    const items = [mk('a', 'normal', 5), mk('b', 'urgent', 1), mk('c', 'important', 9), mk('d', 'urgent', 3)];
    const order = sortForInbox(items, new Set(['d'])).map((x) => x.id);
    expect(order).toEqual(['b', 'c', 'a', 'd']);
    expect(unreadUrgent(items, new Set(['d'])).map((x) => x.id)).toEqual(['b']);
  });

  it('mô tả đối tượng nhận', () => {
    expect(describeAudience({ toStaff: false, toParents: true, toStudents: true, classId: '6A1' })).toBe('Phụ huynh, Học sinh • Lớp 6A1');
  });

  it('bản tin Zalo có mức khẩn, ngày, lớp, nội dung, người gửi', () => {
    const text = formatForZalo({ title: ' Họp PH ', body: 'Tối thứ 6.\n', level: 'urgent', authorName: 'Cô B', createdAt: new Date(2026, 9, 10).getTime(), classId: '6A1' });
    expect(text.split('\n')).toEqual(['🔴 [KHẨN CẤP] Họp PH', '📅 10/10/2026 • Lớp 6A1', '', 'Tối thứ 6.', '', '— Cô B, Trường THCS Ngoại ngữ (UMS)']);
  });
});
