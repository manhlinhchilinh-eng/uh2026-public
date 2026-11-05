import { describe, expect, it } from 'vitest';
import {
  buildForwardNotice,
  canManageAdminDocs,
  countByCategory,
  filterAdminDocs,
  hasAdminDocAttachment,
  linkKind,
  safeDocUrl,
  sortAdminDocs,
  validateAdminDoc,
  type AdminDocInput,
} from '../utils/adminDocs';
import { uploadedFiles } from '../utils/officeNotices';
import { buildNavGroups } from '../utils/navGroups';

const ok: AdminDocInput = {
  title: 'Quy trình xin nghỉ phép',
  category: 'quy_trinh',
  url: 'https://drive.google.com/file/d/abc/view',
  description: '',
  docNumber: '',
  issuedDate: '',
  pinned: false,
};

describe('Hành chính – Văn bản: link an toàn', () => {
  it('chỉ nhận https', () => {
    expect(safeDocUrl(' https://drive.google.com/x ')).toBe('https://drive.google.com/x');
    expect(safeDocUrl('http://drive.google.com/x')).toBeNull();
    expect(safeDocUrl('javascript:alert(1)')).toBeNull();
    expect(safeDocUrl('data:text/html,hi')).toBeNull();
    expect(safeDocUrl('drive.google.com/x')).toBeNull();
    expect(safeDocUrl('https://localhost/x')).toBeNull();
    expect(safeDocUrl('')).toBeNull();
  });

  it('nhận diện loại link Google', () => {
    expect(linkKind('https://docs.google.com/document/d/1/edit')).toBe('docs');
    expect(linkKind('https://docs.google.com/spreadsheets/d/1')).toBe('sheets');
    expect(linkKind('https://docs.google.com/presentation/d/1')).toBe('slides');
    expect(linkKind('https://docs.google.com/forms/d/1')).toBe('forms');
    expect(linkKind('https://forms.gle/abc')).toBe('forms');
    expect(linkKind('https://drive.google.com/drive/folders/1')).toBe('drive');
    expect(linkKind('https://moet.gov.vn/van-ban')).toBe('web');
  });
});

describe('Hành chính – Văn bản: kiểm tra, lọc, sắp xếp', () => {
  it('validateAdminDoc cho phép để trống link (nhắc nhở riêng), nhưng chặn link sai định dạng', () => {
    expect(validateAdminDoc(ok)).toBeNull();
    expect(validateAdminDoc({ ...ok, url: '' })).toBeNull();
    expect(validateAdminDoc({ ...ok, url: '   ' })).toBeNull();
    expect(validateAdminDoc({ ...ok, title: '  ' })).toMatch(/tên tài liệu/);
    expect(validateAdminDoc({ ...ok, url: 'http://x.com' })).toMatch(/https/);
    expect(validateAdminDoc({ ...ok, category: 'khac' as never })).toMatch(/loại/);
    expect(validateAdminDoc({ ...ok, issuedDate: '27/10/2026' })).toMatch(/Ngày/);
    expect(validateAdminDoc({ ...ok, issuedDate: '2026-10-27' })).toBeNull();
  });

  it('hasAdminDocAttachment phát hiện đã có link hoặc tệp tải lên hay chưa', () => {
    expect(hasAdminDocAttachment({ url: '', attachments: [] }, 0)).toBe(false);
    expect(hasAdminDocAttachment({ url: 'https://drive.google.com/x', attachments: [] }, 0)).toBe(true);
    expect(hasAdminDocAttachment({ url: '', attachments: [{ name: 'a.pdf', fileId: 'f1', size: 10 }] }, 0)).toBe(true);
    expect(hasAdminDocAttachment({ url: '', attachments: [] }, 1)).toBe(true);
  });

  const list = [
    { id: '1', category: 'van_ban' as const, title: 'Quyết định thành lập tổ', docNumber: '125/QĐ', description: '', pinned: false, updatedAt: 3 },
    { id: '2', category: 'bieu_mau' as const, title: 'Mẫu đơn xin nghỉ', docNumber: '', description: 'Điền và nộp Văn phòng', pinned: true, updatedAt: 1 },
    { id: '3', category: 'quy_trinh' as const, title: 'Quy trình đổi tiết', docNumber: '', description: '', pinned: false, updatedAt: 5 },
  ];

  it('lọc theo loại + tìm không dấu (tên, số hiệu, mô tả)', () => {
    expect(filterAdminDocs(list, 'all', 'xin nghi').map((d) => d.id)).toEqual(['2']);
    expect(filterAdminDocs(list, 'all', '125').map((d) => d.id)).toEqual(['1']);
    expect(filterAdminDocs(list, 'all', 'van phong').map((d) => d.id)).toEqual(['2']);
    expect(filterAdminDocs(list, 'quy_trinh', '').map((d) => d.id)).toEqual(['3']);
  });

  it('ghim trước, rồi mới cập nhật trước', () => {
    expect(sortAdminDocs(list).map((d) => d.id)).toEqual(['2', '3', '1']);
  });

  it('đếm theo loại', () => {
    expect(countByCategory(list)).toEqual({ van_ban: 1, huong_dan: 0, quy_trinh: 1, bieu_mau: 1 });
  });

  it('chỉ BGH và Văn phòng quản lý', () => {
    expect(canManageAdminDocs('admin')).toBe(true);
    expect(canManageAdminDocs('vanphong')).toBe(true);
    expect(canManageAdminDocs('gvcn')).toBe(false);
    expect(canManageAdminDocs('parent')).toBe(false);
  });

  it('menu: nhân sự + Văn phòng thấy mục Hành chính, PH/HS không', () => {
    const has = (role: Parameters<typeof buildNavGroups>[0]['role']) =>
      buildNavGroups({ role }).some((g) => g.items.some((i) => i.path === '/hanh-chinh'));
    expect(has('vanphong')).toBe(true);
    expect(has('gvbm')).toBe(true);
    expect(has('admin')).toBe(true);
    expect(has('parent')).toBe(false);
    expect(has('student')).toBe(false);
  });
});

describe('buildForwardNotice — chuyển tiếp văn bản thành thông báo', () => {
  const base = { title: 'Quyết định 125', category: 'van_ban' as const, url: '', description: 'Tóm tắt.', docNumber: '125/QĐ', issuedDate: '2026-11-05' };
  it('tiêu đề, tóm tắt, số hiệu, ngày; tệp trỏ srcDocId, link Drive thành đính kèm link', () => {
    const r = buildForwardNotice({ ...base, url: 'https://drive.google.com/file/d/1' }, 'D1', [
      { name: 'qd.pdf', fileId: 'F1', size: 10, type: 'application/pdf' },
    ]);
    expect(r.title).toBe('Quyết định 125');
    expect(r.body).toContain('Số 125/QĐ');
    expect(r.body).toContain('05/11/2026');
    expect(r.body).toContain('Tóm tắt.');
    expect(r.body).toContain('Hành chính – Văn bản');
    expect(r.attachments).toEqual([
      { name: 'Văn bản: Quyết định 125', url: 'https://drive.google.com/file/d/1' },
      { name: 'qd.pdf', fileId: 'F1', size: 10, type: 'application/pdf', srcDocId: 'D1' },
    ]);
  });
  it('cắt tiêu đề ≤ 150, nội dung ≤ 5000; bỏ link không https', () => {
    const r = buildForwardNotice({ ...base, title: 'x'.repeat(200), description: 'y'.repeat(9000), url: 'http://a' }, 'D1');
    expect(r.title.length).toBe(150);
    expect(r.body.length).toBeLessThanOrEqual(5000);
    expect(r.attachments).toEqual([]);
  });
  it('uploadedFiles giữ srcDocId hợp lệ, bỏ srcDocId lạ', () => {
    expect(uploadedFiles([{ name: 'a', fileId: 'F1', srcDocId: 'D1' }])[0].srcDocId).toBe('D1');
    expect(uploadedFiles([{ name: 'a', fileId: 'F1', srcDocId: '../x' }])[0].srcDocId).toBeUndefined();
  });
});
