import { describe, expect, it } from 'vitest';
import { NEW_CHECK_MS, mergeNewest, newestCreatedAt, pickUnseen, shouldCheckNew, titleWithCount } from '../utils/desktopNotify';

describe('desktopNotify — số chưa đọc trên tiêu đề', () => {
  it('thêm/thay/bỏ tiền tố số', () => {
    expect(titleWithCount('UMS+', 3)).toBe('(3) UMS+');
    expect(titleWithCount('(3) UMS+', 5)).toBe('(5) UMS+');
    expect(titleWithCount('(5) UMS+', 0)).toBe('UMS+');
    expect(titleWithCount('UMS+', 150)).toBe('(99+) UMS+');
    expect(titleWithCount('(99+) UMS+', 2)).toBe('(2) UMS+');
  });
});

describe('desktopNotify — tin mới', () => {
  const a = { id: 'a', createdAt: 100 };
  const b = { id: 'b', createdAt: 200 };
  const c = { id: 'c', createdAt: 300 };

  it('pickUnseen chỉ lấy tin chưa thấy', () => {
    expect(pickUnseen([a, b, c], new Set(['a', 'c']))).toEqual([b]);
  });

  it('newestCreatedAt = 0 khi rỗng', () => {
    expect(newestCreatedAt([])).toBe(0);
    expect(newestCreatedAt([a, c, b])).toBe(300);
  });

  it('mergeNewest không trùng, mới nhất trước', () => {
    expect(mergeNewest([b, a], [c, b]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('shouldCheckNew: tab ẩn chỉ kiểm tra khi đã bật, tối thiểu 15 phút/lần', () => {
    const now = 10 * NEW_CHECK_MS;
    expect(shouldCheckNew({ hidden: true, enabled: false, lastAt: null, now })).toBe(false);
    expect(shouldCheckNew({ hidden: true, enabled: true, lastAt: null, now })).toBe(true);
    expect(shouldCheckNew({ hidden: false, enabled: false, lastAt: now - NEW_CHECK_MS + 1, now })).toBe(false);
    expect(shouldCheckNew({ hidden: false, enabled: false, lastAt: now - NEW_CHECK_MS, now })).toBe(true);
    expect(shouldCheckNew({ hidden: true, enabled: true, lastAt: now - 60_000, now })).toBe(false);
  });
});
