import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkFirestoreGuard,
  recordFirestoreReads,
  getFirestoreGuardStats,
  resetFirestoreGuardStats,
  FIRESTORE_GUARD_LIMITS,
} from '../utils/firestoreGuard';

describe('Cầu chì bảo vệ chi phí Firestore (firestoreGuard)', () => {
  beforeEach(() => {
    resetFirestoreGuardStats();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('1. Cho phép truy vấn bình thường và ghi nhận thống kê theo tag', () => {
    expect(checkFirestoreGuard('office_notices:mine')).toBe(true);
    recordFirestoreReads('office_notices:mine', 5);

    const stats = getFirestoreGuardStats();
    expect(stats.totalQueries).toBe(1);
    expect(stats.totalDocsRead).toBe(5);
    expect(stats.tripped).toBe(false);
    expect(stats.byTag['office_notices:mine'].queries).toBe(1);
    expect(stats.byTag['office_notices:mine'].docsRead).toBe(5);
  });

  it('2. Chặn truy vấn nền khi tab đang ẩn (document.hidden = true) với blockWhenHidden', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });

    expect(checkFirestoreGuard('office_notices:mine', { blockWhenHidden: true })).toBe(false);
    const stats = getFirestoreGuardStats();
    expect(stats.blockedCalls).toBe(1);
    expect(stats.tripped).toBe(false); // Chặn êm khi ẩn tab, không ngắt toàn cục
  });

  it('3. Tự ngắt cầu chì và hiện cảnh báo khi vượt ngưỡng truy vấn/phút trên 1 tag', () => {
    const max = FIRESTORE_GUARD_LIMITS.MAX_QUERIES_PER_MINUTE_PER_TAG;
    for (let i = 0; i < max; i++) {
      expect(checkFirestoreGuard('loop_bug_tag')).toBe(true);
    }
    // Lần thứ max + 1 trong cùng 1 phút phải ngắt cầu chì
    expect(checkFirestoreGuard('loop_bug_tag')).toBe(false);

    const stats = getFirestoreGuardStats();
    expect(stats.tripped).toBe(true);
    expect(stats.tripReason).toContain('loop_bug_tag');
    expect(document.getElementById('ums-firestore-guard-banner')).not.toBeNull();
  });

  it('4. Tự ngắt cầu chì khi tổng số document đọc trong 15 phút vượt trần an toàn', () => {
    recordFirestoreReads('heavy_scan', FIRESTORE_GUARD_LIMITS.MAX_DOC_READS_PER_15_MIN + 1);
    const stats = getFirestoreGuardStats();
    expect(stats.tripped).toBe(true);
    expect(checkFirestoreGuard('any_other_tag')).toBe(false);
  });
});

import { GUARD_BANNER_TEXT } from '../utils/firestoreGuard';
describe('Thông báo tạm dừng tải dữ liệu dễ hiểu (góp ý 05/11)', () => {
  it('không có từ "cầu chì" hay tên truy vấn kỹ thuật', () => {
    expect(GUARD_BANNER_TEXT).not.toMatch(/cầu chì|daily_logbooks|Firebase|:/i);
    expect(GUARD_BANNER_TEXT).toMatch(/tải lại trang/);
    expect(GUARD_BANNER_TEXT).toMatch(/Trợ lý UMS\+/);
  });
});
