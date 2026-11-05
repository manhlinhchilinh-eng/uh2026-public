import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ logbookReads: vi.fn((): any[] => []), classReads: vi.fn(), docReads: vi.fn(), docPaths: [] as string[] }));
vi.mock('../services/logbookService', () => ({
  getMockDailyLogbooks: mocks.logbookReads,
  generateDailyId: (c: string, d: string) => `${c}_${d}`,
}));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  limit: () => ({}),
  query: () => ({}),
  where: () => ({}),
}));
vi.mock('../utils/firestoreGuard', () => ({
  guardedGetDocs: async () => {
    mocks.classReads();
    return { size: 2, docs: [{ id: '6A1', data: () => ({ studentCount: 26 }) }, { id: '6A2', data: () => ({}) }] };
  },
  guardedGetDoc: async (_tag: string, ref: { path: string }) => {
    mocks.docReads();
    mocks.docPaths.push(ref.path);
    return { exists: () => true, data: () => ({ morningBaseline: { absences: [] } }) };
  },
}));

import { ATTENDANCE_CACHE_MS, fetchClassAttendance, fetchSchoolAttendanceCached, resetSchoolAttendanceCache } from '../services/schoolAttendanceService';
import { getClassSize, getClassSizes, resetClassSizeCache } from '../services/classSizeCache';

beforeEach(() => {
  mocks.logbookReads.mockReset();
  mocks.logbookReads.mockImplementation(() => []);
  mocks.classReads.mockClear();
  mocks.docReads.mockClear();
  mocks.docPaths.length = 0;
  resetSchoolAttendanceCache();
  resetClassSizeCache();
});

describe('fetchSchoolAttendanceCached', () => {
  it('2 lần trong 5 phút → 1 lần đọc; force/hết hạn → đọc lại', async () => {
    const a = await fetchSchoolAttendanceCached('2026-11-05', { now: 1000 });
    await fetchSchoolAttendanceCached('2026-11-05', { now: 1000 + ATTENDANCE_CACHE_MS - 1 });
    expect(mocks.logbookReads).toHaveBeenCalledTimes(1);
    expect(a.loadedAt).toBe(1000);
    await fetchSchoolAttendanceCached('2026-11-05', { now: 2000, force: true });
    expect(mocks.logbookReads).toHaveBeenCalledTimes(2);
    await fetchSchoolAttendanceCached('2026-11-05', { now: 2000 + ATTENDANCE_CACHE_MS });
    expect(mocks.logbookReads).toHaveBeenCalledTimes(3);
  });
  it('ngày khác đọc riêng; gọi đồng thời dùng chung 1 lượt', async () => {
    await Promise.all([fetchSchoolAttendanceCached('2026-11-04'), fetchSchoolAttendanceCached('2026-11-04')]);
    expect(mocks.logbookReads).toHaveBeenCalledTimes(1);
    await fetchSchoolAttendanceCached('2026-11-03');
    expect(mocks.logbookReads).toHaveBeenCalledTimes(2);
  });
  it('lỗi không bị cache', async () => {
    mocks.logbookReads.mockImplementationOnce(() => { throw new Error('boom'); });
    await expect(fetchSchoolAttendanceCached('2026-11-05')).rejects.toThrow('boom');
    await expect(fetchSchoolAttendanceCached('2026-11-05')).resolves.toBeTruthy();
    expect(mocks.logbookReads).toHaveBeenCalledTimes(2);
  });
});

describe('fetchClassAttendance', () => {
  it('đọc 1 doc sổ ngày đúng id + 1 truy vấn HS; 2 lần trong 5 phút → không đọc thêm', async () => {
    const a = await fetchClassAttendance('6A1', '2026-11-05', { now: 1000 });
    expect(mocks.docPaths).toEqual(['daily_logbooks/6A1_2026-11-05']);
    expect(a.logbooks).toEqual([{ classId: '6A1', morningBaseline: { absences: [] } }]);
    expect(a.loadedAt).toBe(1000);
    await fetchClassAttendance('6A1', '2026-11-05', { now: 1000 + ATTENDANCE_CACHE_MS - 1 });
    expect(mocks.docReads).toHaveBeenCalledTimes(1);
    expect(mocks.classReads).toHaveBeenCalledTimes(1);
    expect(mocks.logbookReads).not.toHaveBeenCalled();
    await fetchClassAttendance('6A1', '2026-11-05', { now: 1000 + ATTENDANCE_CACHE_MS });
    expect(mocks.docReads).toHaveBeenCalledTimes(2);
  });
  it('lớp/ngày khác đọc riêng; gọi đồng thời dùng chung; không lẫn cache toàn trường', async () => {
    await Promise.all([fetchClassAttendance('6A1', '2026-11-04'), fetchClassAttendance('6A1', '2026-11-04')]);
    expect(mocks.docReads).toHaveBeenCalledTimes(1);
    await fetchClassAttendance('6A2', '2026-11-04');
    expect(mocks.docReads).toHaveBeenCalledTimes(2);
    await fetchSchoolAttendanceCached('2026-11-04');
    expect(mocks.logbookReads).toHaveBeenCalledTimes(1);
  });
});

describe('getClassSizes', () => {
  it('2 lần → 1 truy vấn; chỉ lấy lớp có studentCount', async () => {
    expect(await getClassSizes()).toEqual({ '6A1': 26 });
    await getClassSizes();
    expect(mocks.classReads).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('ums.classSizes.v1')).toBeTruthy();
  });
  it('getClassSize: chưa có bảng toàn trường → đọc đúng 1 doc, lần 2 không đọc', async () => {
    mocks.docReads.mockClear();
    mocks.docPaths.length = 0;
    expect(await getClassSize('6A1')).toBeNull(); // doc mock không có studentCount
    await getClassSize('6A1');
    expect(mocks.docPaths).toEqual(['classes/6A1']);
    expect(mocks.docReads).toHaveBeenCalledTimes(1);
    expect(mocks.classReads).not.toHaveBeenCalled();
  });
  it('getClassSize: đã có bảng toàn trường → không đọc thêm', async () => {
    await getClassSizes();
    mocks.docReads.mockClear();
    expect(await getClassSize('6A1')).toBe(26);
    expect(mocks.docReads).not.toHaveBeenCalled();
  });
});
