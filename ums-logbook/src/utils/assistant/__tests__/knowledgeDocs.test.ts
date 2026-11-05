import { describe, it, expect } from 'vitest';
import { toKnowledgeDocs } from '../knowledgeDocs';
import type { AdminDoc } from '../../adminDocs';
import type { OfficeNotice } from '../../officeNotices';
import type { Announcement } from '../../../types/announcement';

const adminDoc = (o: Partial<AdminDoc> = {}): AdminDoc => ({
  id: 'd1', title: 'Kế hoạch Got Talent', category: 'khac' as AdminDoc['category'], url: 'https://example.com/a',
  description: 'Nội dung kế hoạch', docNumber: '12/KH-THCSNN', issuedDate: '2026-10-20', pinned: false,
  authorId: 'u', authorName: 'A', createdAt: 1000, updatedAt: 2000, ...o,
});
const notice = (o: Partial<OfficeNotice> = {}): OfficeNotice => ({
  id: 'n1', title: 'Họp tổ', body: 'Họp lúc 15h', tags: [], recipientUids: [], pinned: false, requiresDone: false,
  deadlineAt: null, remindBefore: [], authorId: 'u', authorName: 'A', createdAt: 5000, updatedAt: 6000, ...o,
} as OfficeNotice);
const ann = (o: Partial<Announcement> = {}): Announcement => ({
  id: 'a1', title: 'Nghỉ lễ', body: 'Nghỉ 2/9', level: 'normal',
  audience: { toStaff: false, toParents: true, toStudents: false, classId: null }, audienceKeys: [], classId: null,
  forwardableToParents: false, authorId: 'u', authorName: 'A', authorRole: 'bgh', createdAt: 3000, ...o,
});

describe('toKnowledgeDocs', () => {
  it('chuẩn hóa admin doc', () => {
    const [d] = toKnowledgeDocs({ adminDocs: [adminDoc()] });
    expect(d).toMatchObject({
      source: 'admin_doc', text: 'Nội dung kế hoạch', docNumber: '12/KH-THCSNN',
      link: { path: '/hanh-chinh?open=d1', url: 'https://example.com/a' },
    });
    expect(d.date).toBe(Date.parse('2026-10-20'));
  });

  it('admin doc không ngày → dùng updatedAt, không url → bỏ link.url', () => {
    const [d] = toKnowledgeDocs({ adminDocs: [adminDoc({ issuedDate: '', url: '' })] });
    expect(d.date).toBe(2000);
    expect(d.link.url).toBeUndefined();
  });

  it('chuẩn hóa office notice', () => {
    const [d] = toKnowledgeDocs({ officeNotices: [notice()] });
    expect(d).toMatchObject({ source: 'office_notice', text: 'Họp lúc 15h', link: { path: '/announcements?open=n1' } });
  });

  it('loại announcement schedule_change', () => {
    const r = toKnowledgeDocs({ announcements: [ann(), ann({ id: 'a2', kind: 'schedule_change' })] });
    expect(r.map((x) => x.id)).toEqual(['a1']);
    expect(r[0].source).toBe('announcement');
  });

  it('office notice chuyển tiếp admin doc → chỉ còn bản admin_doc', () => {
    const fwd = notice({ attachments: [{ name: 'f', srcDocId: 'd1' }] });
    const r = toKnowledgeDocs({ adminDocs: [adminDoc()], officeNotices: [fwd, notice({ id: 'n2' })] });
    expect(r).toHaveLength(2);
    expect(r.find((x) => x.id === 'n1')).toBeUndefined();
    expect(r.filter((x) => x.source === 'admin_doc')).toHaveLength(1);
  });

  it('không có adminDocs (PH) → chỉ announcements', () => {
    const r = toKnowledgeDocs({ announcements: [ann()] });
    expect(r.map((x) => x.source)).toEqual(['announcement']);
  });

  it('sắp theo date giảm dần', () => {
    const r = toKnowledgeDocs({ announcements: [ann({ id: 'old', createdAt: 1 }), ann({ id: 'new', createdAt: 9 })] });
    expect(r.map((x) => x.id)).toEqual(['new', 'old']);
  });
});
