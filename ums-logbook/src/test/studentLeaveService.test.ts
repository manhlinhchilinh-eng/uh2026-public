import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({
  guardedGetDocs: vi.fn(),
  guardedGetDoc: vi.fn(),
  tx: { get: vi.fn(), set: vi.fn(), update: vi.fn() },
  setDoc: vi.fn(async () => undefined),
  updateDoc: vi.fn(async () => undefined),
  roster: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  query: (c: { path: string }, ...cons: unknown[]) => ({ path: c.path, cons }),
  where: (...a: unknown[]) => ({ where: a }),
  orderBy: (...a: unknown[]) => ({ orderBy: a }),
  limit: (n: number) => ({ limit: n }),
  setDoc: fx.setDoc,
  updateDoc: fx.updateDoc,
  runTransaction: async (_db: unknown, fn: (t: unknown) => Promise<void>) => fn(fx.tx),
}));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../utils/firestoreGuard', () => ({ guardedGetDocs: fx.guardedGetDocs, guardedGetDoc: fx.guardedGetDoc }));
vi.mock('../services/rosterService', () => ({ fetchClassRosterStrict: fx.roster }));

import {
  submitLeave,
  decideLeave,
  listPendingForClass,
  listApprovedForDate as listApprovedForDateFn,
  clearLeaveCaches,
  _resetLeaveCacheForTest,
} from '../services/studentLeaveService';
import { leaveDay } from '../utils/studentLeave';
import type { StudentLeave } from '../utils/studentLeave';

const snap = (docs: Array<{ id: string; data: Record<string, unknown> }>) => ({
  size: docs.length,
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
});

const leave: StudentLeave = {
  id: 'p1_1_1', mhs: '111', studentName: 'An', classId: '6A1', parentUid: 'p1', parentName: 'PH',
  kind: 'day', dates: ['2026-11-06', '2026-11-07'], periods: [], meal: false, reason: 'sick', note: '',
  status: 'pending', day: 1, seq: 1, createdAt: 1,
};
const by = { uid: 'gv1', displayName: 'GV' };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  _resetLeaveCacheForTest();
  fx.roster.mockResolvedValue([{ mhs: '111', stt: 7, name: 'An' }]);
});

describe('submitLeave', () => {
  it('seq = số đơn hôm nay + 1, id đúng, không lưu field id', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap([{ id: 'a', data: {} }, { id: 'b', data: {} }]));
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = await submitLeave(
      { uid: 'p1', displayName: 'PH' },
      { mhs: '111', name: 'An', classId: '6A1' },
      { kind: 'day', dates: [iso], periods: [], meal: false, reason: 'sick', note: '' }
    );
    expect(r.seq).toBe(3);
    expect(r.id).toBe(`p1_${leaveDay(Date.now())}_3`);
    const [ref, data] = fx.setDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe(`student_leave/${r.id}`);
    expect(data).not.toHaveProperty('id');
    expect(data.status).toBe('pending');
  });

  it('đơn thứ 6 bị từ chối, không ghi', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap(Array.from({ length: 5 }, (_, i) => ({ id: String(i), data: {} }))));
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await expect(
      submitLeave({ uid: 'p1', displayName: 'PH' }, { mhs: '1', name: 'A', classId: '6A1' },
        { kind: 'day', dates: [iso], periods: [], meal: false, reason: 'other', note: '' })
    ).rejects.toThrow(/tối đa 5/);
    expect(fx.setDoc).not.toHaveBeenCalled();
  });
});

const txSnap = (exists: boolean, data: Record<string, unknown> = {}) => ({ exists: () => exists, data: () => data });
const txByPath = (m: Record<string, ReturnType<typeof txSnap>>) =>
  fx.tx.get.mockImplementation(async (r: { path: string }) => m[r.path] ?? txSnap(false));

describe('decideLeave', () => {
  it('duyệt: sổ có sẵn -> tx.update chỉ approvedLeaves.<id>+updatedAt; chưa có -> tx.set sổ rỗng + approvedLeaves; cuối cùng update đơn', async () => {
    txByPath({
      'student_leave/p1_1_1': txSnap(true, { status: 'pending' }),
      'daily_logbooks/6A1_2026-11-06': txSnap(true, { morningBaseline: {} }),
      'daily_logbooks/6A1_2026-11-07': txSnap(false),
    });
    await decideLeave(leave, true, by);
    const upd = fx.tx.update.mock.calls as unknown as Array<[{ path: string }, Record<string, unknown>]>;
    expect(upd[0][0].path).toBe('daily_logbooks/6A1_2026-11-06');
    expect(Object.keys(upd[0][1])).toEqual(['approvedLeaves.p1_1_1', 'updatedAt']);
    expect((upd[0][1]['approvedLeaves.p1_1_1'] as { stt: number }).stt).toBe(7);
    const sets = fx.tx.set.mock.calls as unknown as Array<[{ path: string }, Record<string, unknown>]>;
    expect(sets).toHaveLength(1);
    expect(sets[0][0].path).toBe('daily_logbooks/6A1_2026-11-07');
    expect(sets[0][1]).toHaveProperty('morningBaseline');
    expect(sets[0][1].approvedLeaves).toEqual({ p1_1_1: { mhs: '111', name: 'An', stt: 7, periods: [], meal: false } });
    expect(upd[1][0].path).toBe('student_leave/p1_1_1');
    expect(upd[1][1]).toMatchObject({ status: 'approved', decidedBy: 'gv1', decidedByName: 'GV' });
    expect(fx.setDoc).not.toHaveBeenCalled();
    expect(fx.updateDoc).not.toHaveBeenCalled();
  });

  it('đơn không còn pending (PH đã huỷ) -> throw, 0 ghi, gỡ khỏi cache', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap([{ id: leave.id, data: { ...leave, id: undefined } }]));
    await listPendingForClass('6A1');
    txByPath({ 'student_leave/p1_1_1': txSnap(true, { status: 'cancelled' }) });
    await expect(decideLeave(leave, true, by)).rejects.toThrow(/không còn/);
    expect(fx.tx.set).not.toHaveBeenCalled();
    expect(fx.tx.update).not.toHaveBeenCalled();
    expect(await listPendingForClass('6A1')).toEqual([]);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
  });

  it('HS không có trong roster hoặc roster null -> throw, không ghi gì', async () => {
    fx.roster.mockResolvedValueOnce([{ mhs: '999', stt: 1, name: 'X' }]);
    await expect(decideLeave(leave, true, by)).rejects.toThrow('Học sinh không thuộc lớp này');
    fx.roster.mockResolvedValueOnce(null);
    await expect(decideLeave(leave, true, by)).rejects.toThrow('Học sinh không thuộc lớp này');
    expect(fx.tx.get).not.toHaveBeenCalled();
    expect(fx.tx.update).not.toHaveBeenCalled();
    expect(fx.tx.set).not.toHaveBeenCalled();
  });

  it('duyệt: tên HS lấy từ danh sách lớp, không dùng tên PH tự nhập', async () => {
    fx.roster.mockResolvedValueOnce([{ mhs: '111', stt: 7, name: 'Nguyễn Văn An' }]);
    txByPath({ 'student_leave/p1_1_1': txSnap(true, { status: 'pending' }) });
    await decideLeave({ ...leave, studentName: 'Tên giả mạo', dates: ['2026-11-06'] }, true, by);
    const sets = fx.tx.set.mock.calls as unknown as Array<[{ path: string }, Record<string, unknown>]>;
    expect((sets[0][1].approvedLeaves as Record<string, { name: string }>).p1_1_1.name).toBe('Nguyễn Văn An');
  });

  it.each([
    ['0 ngày', { dates: [] as string[] }],
    ['6 ngày', { dates: ['2026-11-06', '2026-11-07', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'] }],
    ['ngày sai định dạng', { dates: ['2026-11-6'] }],
    ['ngày không có thật', { dates: ['2026-02-30'] }],
    ['đường dẫn lạ trong ngày', { dates: ['2026-11-06/../x'] }],
    ['tiết 0', { kind: 'periods' as const, dates: ['2026-11-06'], periods: [0] }],
    ['tiết 9', { kind: 'periods' as const, dates: ['2026-11-06'], periods: [9] }],
    ['tiết lẻ', { kind: 'periods' as const, dates: ['2026-11-06'], periods: [2.5] }],
  ])('duyệt đơn có %s -> throw, không đọc/ghi gì', async (_n, over) => {
    await expect(decideLeave({ ...leave, ...over } as StudentLeave, true, by)).rejects.toThrow(
      'Đơn có ngày/tiết không hợp lệ, không thể duyệt.'
    );
    expect(fx.roster).not.toHaveBeenCalled();
    expect(fx.tx.get).not.toHaveBeenCalled();
    expect(fx.tx.set).not.toHaveBeenCalled();
    expect(fx.tx.update).not.toHaveBeenCalled();
    expect(fx.updateDoc).not.toHaveBeenCalled();
  });

  it('từ chối: chỉ cập nhật đơn, không đụng sổ, không cần roster', async () => {
    await decideLeave(leave, false, by, 'Thiếu thông tin');
    expect(fx.roster).not.toHaveBeenCalled();
    expect(fx.tx.set).not.toHaveBeenCalled();
    expect(fx.updateDoc).toHaveBeenCalledTimes(1);
    expect((fx.updateDoc.mock.calls[0] as unknown[])[1]).toMatchObject({ status: 'rejected', rejectReason: 'Thiếu thông tin' });
  });
});

describe('listPendingForClass cache', () => {
  it('gọi 2 lần → 1 lần đọc; force đọc lại; decide chỉ bỏ 1 đơn khỏi cache', async () => {
    const other = { ...leave, id: 'p2_1_1' };
    fx.guardedGetDocs.mockResolvedValue(snap([
      { id: leave.id, data: { ...leave, id: undefined } },
      { id: other.id, data: { ...other, id: undefined } },
    ]));
    const a = await listPendingForClass('6A1');
    expect(a.map((l) => l.id)).toEqual(['p1_1_1', 'p2_1_1']);
    await listPendingForClass('6A1');
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);

    await decideLeave(leave, false, by, 'x');
    const after = await listPendingForClass('6A1');
    expect(after.map((l) => l.id)).toEqual(['p2_1_1']);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem('ums_leave_pending_6A1')!).data).toHaveLength(1);

    await listPendingForClass('6A1', true);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(2);
  });
});

describe('listPendingForClass thứ tự', () => {
  it('sắp theo createdAt tăng dần (đơn cũ nhất trước), cả bản cache', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap([
      { id: 'c', data: { ...leave, id: undefined, createdAt: 30 } },
      { id: 'a', data: { ...leave, id: undefined, createdAt: 10 } },
      { id: 'b', data: { ...leave, id: undefined, createdAt: 20 } },
    ]));
    expect((await listPendingForClass('6A1')).map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(JSON.parse(sessionStorage.getItem('ums_leave_pending_6A1')!).data.map((l: StudentLeave) => l.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('clearLeaveCaches (đăng xuất)', () => {
  it('xoá cache bộ nhớ + mọi key sessionStorage ums_leave_*, giữ key khác', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap([{ id: leave.id, data: { ...leave, id: undefined } }]));
    await listPendingForClass('6A1');
    await listApprovedForDateFn('2026-11-06');
    sessionStorage.setItem('other_key', '1');
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(2);
    clearLeaveCaches();
    expect(sessionStorage.getItem('ums_leave_pending_6A1')).toBeNull();
    expect(sessionStorage.getItem('ums_leave_approved_2026-11-06')).toBeNull();
    expect(sessionStorage.getItem('other_key')).toBe('1');
    await listPendingForClass('6A1');
    await listApprovedForDateFn('2026-11-06');
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(4);
  });
});

import { listApprovedForDate } from '../services/studentLeaveService';
describe('listApprovedForDate cache', () => {
  it('2 lần cùng ngày = 1 lần đọc; ngày khác đọc lại', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap([{ id: 'x', data: { ...leave, status: 'approved', id: undefined } }]));
    const a = await listApprovedForDate('2026-11-06');
    const b = await listApprovedForDate('2026-11-06');
    expect(b).toEqual(a);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
    await listApprovedForDate('2026-11-07');
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(2);
  });
});

import { listApprovedForDates, listApprovedForClassWeek } from '../services/studentLeaveService';
describe('listApprovedForDates / listApprovedForClassWeek', () => {
  it('6 ngày = 6 lượt đọc, gọi lại = 0 (cache); khử trùng theo id', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap([{ id: 'x', data: { ...leave, status: 'approved', id: undefined } }]));
    const d = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    const a = await listApprovedForDates(d);
    expect(a).toHaveLength(1);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(6);
    await listApprovedForDates(d);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(6);
  });
  it('lớp: 2 lần gọi = 1 lượt đọc, lọc theo tuần hiện tại', async () => {
    fx.guardedGetDocs.mockResolvedValue(snap([
      { id: 'in', data: { ...leave, status: 'approved', dates: ['2026-11-05'], id: undefined } },
      { id: 'out', data: { ...leave, status: 'approved', dates: ['2026-10-01'], id: undefined } },
    ]));
    const a = await listApprovedForClassWeek('6A1', false, '2026-11-05');
    const b = await listApprovedForClassWeek('6A1', false, '2026-11-05');
    expect(a.map((l) => l.id)).toEqual(['in']);
    expect(b).toEqual(a);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
    const q = fx.guardedGetDocs.mock.calls[0][1] as { cons: Array<{ orderBy?: unknown[]; limit?: number }> };
    expect(q.cons.some((c) => c.orderBy && c.orderBy[0] === 'createdAt' && c.orderBy[1] === 'desc')).toBe(true);
    expect(q.cons.some((c) => c.limit === 50)).toBe(true);
  });
  it('duyệt thêm đơn vào cache lớp (không đọc lại); từ chối thì không', async () => {
    const week = '2026-11-05';
    fx.guardedGetDocs.mockResolvedValue(snap([]));
    await listApprovedForClassWeek('6A1', false, week);
    fx.roster.mockResolvedValue([{ mhs: '111', stt: 7, name: 'An' }]);
    fx.tx.get.mockResolvedValue({ exists: () => true, data: () => ({ status: 'pending' }) });
    await decideLeave({ ...leave, dates: [week] }, false, by, 'x');
    expect(await listApprovedForClassWeek('6A1', false, week)).toHaveLength(0);
    await decideLeave({ ...leave, dates: [week] }, true, by);
    const after = await listApprovedForClassWeek('6A1', false, week);
    expect(after.map((l) => l.id)).toEqual([leave.id]);
    expect(JSON.parse(sessionStorage.getItem('ums_leave_cls_6A1') as string).data).toHaveLength(1);
    expect(fx.guardedGetDocs).toHaveBeenCalledTimes(1);
  });
});
