import { describe, it, expect } from 'vitest';
import { adminDocMeta, isLongDescription, isRecentDoc, sortAdminDocsBy } from '../utils/adminDocs';

const doc = (title: string, over: Record<string, unknown> = {}) => ({ title, pinned: false, updatedAt: 1, issuedDate: '', ...over }) as any;

describe('Trang Hành chính – Văn bản (giao diện mới)', () => {
  it('nhãn "Mới" trong 7 ngày', () => {
    const now = new Date(2026, 10, 5).getTime();
    expect(isRecentDoc(now - 2 * 86_400_000, now)).toBe(true);
    expect(isRecentDoc(now - 8 * 86_400_000, now)).toBe(false);
    expect(isRecentDoc(0, now)).toBe(false);
  });

  it('sắp xếp: mới nhất (ghim đầu), ngày ban hành, tên A→Z', () => {
    const list = [doc('Bảng', { updatedAt: 3 }), doc('Ánh', { updatedAt: 1, pinned: true, issuedDate: '2026-09-05' }), doc('Cờ', { updatedAt: 2, issuedDate: '2026-10-23' })];
    expect(sortAdminDocsBy(list, 'newest').map((d) => d.title)).toEqual(['Ánh', 'Bảng', 'Cờ']);
    expect(sortAdminDocsBy(list, 'issued').map((d) => d.title)).toEqual(['Cờ', 'Ánh', 'Bảng']);
    expect(sortAdminDocsBy(list, 'title').map((d) => d.title)).toEqual(['Ánh', 'Bảng', 'Cờ']);
  });

  it('meta gọn: số hiệu · ngày, bỏ phần trống', () => {
    expect(adminDocMeta({ docNumber: '6011/SGD ĐT-GDTrh', issuedDate: '2026-10-23' })).toEqual(['Số 6011/SGD ĐT-GDTrh', '23/10/2026']);
    expect(adminDocMeta({ docNumber: ' ', issuedDate: '' })).toEqual([]);
  });

  it('mô tả dài (nhiều ký tự hoặc nhiều dòng) → cần "Xem chi tiết"', () => {
    expect(isLongDescription('ngắn')).toBe(false);
    expect(isLongDescription('a\nb\nc')).toBe(true);
    expect(isLongDescription('x'.repeat(200))).toBe(true);
  });
});
