import { describe, it, expect } from 'vitest';
import { chunkIds, PERIOD_QUERY_CHUNK } from '../services/dashboardService';
import { FIRESTORE_GUARD_LIMITS } from '../utils/firestoreGuard';

const ids = (classes: number, days: number) =>
  Array.from({ length: classes }, (_, c) => Array.from({ length: days }, (_, d) => `C${c}_2026-11-${String(d + 1).padStart(2, '0')}`)).flat();

describe('Tải tiết toàn trường không vượt ngưỡng 40 truy vấn/phút (sự cố trang Xếp hạng 05/11)', () => {
  it('lô ≤ 30 mã sổ (giới hạn "in" của Firestore), bỏ trùng', () => {
    const c = chunkIds([...ids(26, 5), 'C0_2026-11-01']);
    expect(c.every((x) => x.length <= PERIOD_QUERY_CHUNK)).toBe(true);
    expect(c.flat()).toHaveLength(130);
  });

  it('1 tuần (26 lớp × 5 ngày) ≈ 5 truy vấn; 1 tháng (26 × 23) ≈ 20 — đều dưới ngưỡng', () => {
    const week = chunkIds(ids(26, 5)).length;
    const month = chunkIds(ids(26, 23)).length;
    expect(week).toBe(5);
    expect(month).toBe(20);
    expect(month).toBeLessThan(FIRESTORE_GUARD_LIMITS.MAX_QUERIES_PER_MINUTE_PER_TAG);
  });
});
