/**
 * Giảm lượt đọc Firestore sau sự cố hết 50k lượt đọc/ngày (05/11/2026):
 * - syncStudentDaily chỉ query bản tin cũ 1 lần cho mỗi sổ ngày, chỉ ghi HS có thay đổi.
 * - Dashboard: lưu tiết → chỉ đọc lại đúng sổ ngày đó, không tải lại cả trường.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => {
  const batchOps: Array<{ op: 'set' | 'delete'; path: string }> = [];
  return {
    batchOps,
    commits: { n: 0 },
    guardedGetDocs: vi.fn(),
    guardedGetDoc: vi.fn(),
    computeStudentDaily: vi.fn(),
  };
});

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  collectionGroup: (_db: unknown, id: string) => ({ path: `**/${id}` }),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  query: (c: { path: string }, ...cons: unknown[]) => ({ path: c.path, cons }),
  where: (...a: unknown[]) => ({ where: a }),
  limit: (n: number) => ({ limit: n }),
  writeBatch: () => ({
    set: (ref: { path: string }) => fx.batchOps.push({ op: 'set', path: ref.path }),
    delete: (ref: { path: string }) => fx.batchOps.push({ op: 'delete', path: ref.path }),
    commit: async () => {
      fx.commits.n++;
    },
  }),
}));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../utils/firestoreGuard', () => ({
  guardedGetDocs: fx.guardedGetDocs,
  guardedGetDoc: fx.guardedGetDoc,
  recordFirestoreReads: vi.fn(),
}));
vi.mock('../utils/studentDaily', () => ({
  computeStudentDaily: fx.computeStudentDaily,
  studentDailyId: (mhs: string, date: string) => `${mhs}_${date}`,
}));
vi.mock('./mixedPeriodService', () => ({ fetchMixedRules: vi.fn() }));
vi.mock('../services/scheduleService', () => ({ fetchSchedulesStrict: vi.fn() }));
vi.mock('../services/mixedPeriodService', () => ({ fetchMixedRules: vi.fn() }));

import { syncStudentDaily, _resetStudentDailyCacheForTest } from '../services/studentDailyService';
import { fetchSharedSchoolRangeData, _resetDashboardCacheForTest } from '../services/dashboardService';

const snap = (docs: Array<{ id: string; data: Record<string, unknown> }>) => ({
  size: docs.length,
  empty: docs.length === 0,
  docs: docs.map((d) => ({ id: d.id, data: () => d.data, ref: { path: d.id } })),
});
const rec = (mhs: string, v: number) => ({ mhs, date: '2026-11-05', classId: '9A3', absent: v });

beforeEach(() => {
  fx.batchOps.length = 0;
  fx.commits.n = 0;
  fx.guardedGetDocs.mockReset();
  fx.guardedGetDoc.mockReset();
  fx.computeStudentDaily.mockReset();
  _resetStudentDailyCacheForTest();
  _resetDashboardCacheForTest();
});

describe('syncStudentDaily — không query lại cả lớp mỗi lần lưu tiết', () => {
  const lb = { classId: '9A3', date: '2026-11-05' };
  const periods: any[] = [];

  it('lần đầu query bản tin cũ; các lần sau dùng bộ nhớ, chỉ ghi HS thay đổi', async () => {
    fx.guardedGetDocs.mockResolvedValueOnce(snap([
      { id: 'A', data: rec('A', 0) },
      { id: 'B', data: rec('B', 1) },
    ]));
    fx.computeStudentDaily.mockReturnValueOnce({ A: rec('A', 1) });
    await syncStudentDaily('9A3_2026-11-05', lb, periods);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
    expect(fx.batchOps).toEqual([
      { op: 'delete', path: 'student_daily/B_2026-11-05' },
      { op: 'set', path: 'student_daily/A_2026-11-05' },
    ]);

    // Lần 2: không đổi gì → 0 lượt đọc, không ghi
    fx.batchOps.length = 0;
    fx.computeStudentDaily.mockReturnValueOnce({ A: rec('A', 1) });
    await syncStudentDaily('9A3_2026-11-05', lb, periods);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
    expect(fx.commits.n).toBe(1);

    // Lần 3: A đổi, thêm C, không còn ai bị xóa → vẫn 0 lượt đọc
    fx.computeStudentDaily.mockReturnValueOnce({ A: rec('A', 2), C: rec('C', 1) });
    await syncStudentDaily('9A3_2026-11-05', lb, periods);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
    expect(fx.batchOps).toEqual([
      { op: 'set', path: 'student_daily/A_2026-11-05' },
      { op: 'set', path: 'student_daily/C_2026-11-05' },
    ]);

    // Lần 4: C hết vắng → xóa C dựa trên bộ nhớ
    fx.batchOps.length = 0;
    fx.computeStudentDaily.mockReturnValueOnce({ A: rec('A', 2) });
    await syncStudentDaily('9A3_2026-11-05', lb, periods);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
    expect(fx.batchOps).toEqual([{ op: 'delete', path: 'student_daily/C_2026-11-05' }]);
  });

  it('fullCheck (BGH đồng bộ lại) luôn query đầy đủ', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap([]));
    fx.computeStudentDaily.mockReturnValue({});
    await syncStudentDaily('9A3_2026-11-05', lb, periods);
    await syncStudentDaily('9A3_2026-11-05', lb, periods, { fullCheck: true });
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(2);
    expect(fx.commits.n).toBe(0);
  });
});

describe('Dashboard — lưu tiết chỉ đọc lại sổ ngày vừa sửa', () => {
  it('không tải lại cả trường sau ums_logbook_update có dailyId', async () => {
    fx.guardedGetDocs.mockImplementation(async (tag: string) => {
      if (tag === 'classes:all') return snap([{ id: '9A3', data: {} }]);
      if (tag === 'daily_logbooks:range') {
        return snap([
          { id: '9A3_2026-11-05', data: { classId: '9A3', date: '2026-11-05', status: 'draft' } },
          { id: '9A1_2026-11-05', data: { classId: '9A1', date: '2026-11-05', status: 'draft' } },
        ]);
      }
      if (tag === 'behavior_notes:range') return snap([]);
      return snap([
        { id: '1', data: { periodIndex: 1, dailyId: '9A3_2026-11-05' } },
        { id: '1', data: { periodIndex: 1, dailyId: '9A1_2026-11-05' } },
      ]);
    });
    const first = await fetchSharedSchoolRangeData('2026-11-01', '2026-11-07');
    expect(first.logbooks).toHaveLength(2);
    // Tiết của cả 2 sổ: 1 truy vấn collectionGroup (lô ≤ 30 mã sổ), không còn 1 truy vấn/sổ
    expect(first.periodsByDaily['9A3_2026-11-05']).toHaveLength(1);
    expect(first.periodsByDaily['9A1_2026-11-05']).toHaveLength(1);
    const callsAfterFirst = fx.guardedGetDocs.mock.calls.length; // classes + range + notes + 1 periods (lô)
    expect(callsAfterFirst).toBe(4);

    window.dispatchEvent(new CustomEvent('ums_logbook_update', { detail: { dailyId: '9A3_2026-11-05' } }));
    fx.guardedGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ classId: '9A3', date: '2026-11-05', status: 'in_progress' }) });

    const second = await fetchSharedSchoolRangeData('2026-11-01', '2026-11-07');
    expect(fx.guardedGetDoc).toHaveBeenCalledTimes(1);
    const newCalls = fx.guardedGetDocs.mock.calls.slice(callsAfterFirst).map((c) => c[0]);
    expect(newCalls).toEqual(['daily_logbooks:range_patch_periods']);
    expect(second.logbooks.find((b) => b.id === '9A3_2026-11-05')?.status).toBe('in_progress');

    // Lần 3: không có gì mới → 0 lượt đọc
    await fetchSharedSchoolRangeData('2026-11-01', '2026-11-07');
    expect(fx.guardedGetDocs.mock.calls.length).toBe(callsAfterFirst + 1);
    expect(fx.guardedGetDoc).toHaveBeenCalledTimes(1);
  });
});
