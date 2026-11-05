import { describe, it, expect } from 'vitest';
import {
  schoolDates, defaultMeal, validateLeaveInput, leaveAbsencesForPeriods, mergeLeaveAbsences,
  reconcileDaily, mealSummary, leaveDay, leaveId, leaveCoversPeriod, leaveAbsencesForSession,
  type StudentLeave, type ApprovedLeaveEntry,
} from '../utils/studentLeave';

const L = (o: Partial<StudentLeave>): StudentLeave => ({
  id: 'x', mhs: '1', studentName: 'A', classId: '6A1', parentUid: 'u', parentName: 'P', kind: 'day', dates: ['2026-11-10'],
  periods: [], meal: false, reason: 'sick', note: '', status: 'approved', day: 0, seq: 1, createdAt: 0, ...o,
});

describe('studentLeave', () => {
  it('id và ngày', () => {
    expect(leaveDay(86400000 * 3 + 5)).toBe(3);
    expect(leaveId('u1', 20000, 2)).toBe('u1_20000_2');
  });
  it('schoolDates bỏ CN, giữ T7', () => {
    expect(schoolDates('2026-11-07', 3)).toEqual(['2026-11-07', '2026-11-09', '2026-11-10']);
  });
  it('defaultMeal', () => {
    expect(defaultMeal('day')).toBe(false);
    expect(defaultMeal('periods')).toBe(true);
  });
  it('validateLeaveInput từ chối ngày sai định dạng', () => {
    const ok = { kind: 'day' as const, periods: [], note: '' };
    for (const bad of ['', 'NaN-NaN-NaN', '2026-13-40', '2026-02-30', '5/11/2026']) {
      expect(validateLeaveInput({ ...ok, dates: [bad] }, '2026-11-05')).toBe('Ngày nghỉ không hợp lệ.');
    }
  });
  it('validateLeaveInput', () => {
    const ok = { kind: 'day' as const, dates: ['2026-11-10'], periods: [], note: '' };
    expect(validateLeaveInput(ok, '2026-11-05')).toBeNull();
    expect(validateLeaveInput({ ...ok, dates: ['2026-11-04'] }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, dates: ['2026-11-20'] }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, kind: 'periods' }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, kind: 'periods', periods: [2] }, '2026-11-05')).toBeNull();
    expect(validateLeaveInput({ ...ok, kind: 'periods', periods: [2], dates: ['2026-11-10', '2026-11-11'] }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, kind: 'periods', periods: [0] }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, kind: 'periods', periods: [9] }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, kind: 'periods', periods: [1.5] }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, kind: 'periods', periods: [1, 8] }, '2026-11-05')).toBeNull();
    expect(validateLeaveInput({ ...ok, dates: schoolDates('2026-11-05', 6) }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, note: 'a'.repeat(301) }, '2026-11-05')).toBeTruthy();
    expect(validateLeaveInput({ ...ok, dates: [] }, '2026-11-05')).toBeTruthy();
  });
  it('leaveCoversPeriod: [] = cả ngày', () => {
    expect(leaveCoversPeriod({ mhs: '1', name: 'A', periods: [], meal: false }, 7)).toBe(true);
    expect(leaveCoversPeriod({ mhs: '1', name: 'A', periods: [2], meal: false }, 3)).toBe(false);
  });
  const map: Record<string, ApprovedLeaveEntry> = { x: { mhs: '1', name: 'A', periods: [2, 3], meal: true } };
  it('leaveAbsencesForPeriods', () => {
    expect(leaveAbsencesForPeriods(map, [1])).toEqual([]);
    expect(leaveAbsencesForPeriods(undefined, [1])).toEqual([]);
    const r = leaveAbsencesForPeriods(map, [3]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ studentId: '1', studentName: 'A', type: 'P', note: 'Đơn PH đã duyệt' });
  });
  it('mergeLeaveAbsences giữ bản ghi có sẵn', () => {
    const ex = [{ studentId: '1', studentName: 'A', type: 'K' as const }];
    const fromLeave = leaveAbsencesForPeriods(map, [3]);
    expect(mergeLeaveAbsences(ex, fromLeave)).toEqual(ex);
    expect(mergeLeaveAbsences([], fromLeave)).toHaveLength(1);
  });
  describe('reconcileDaily', () => {
    const pa = { '2': { at: 1, by: '', byName: '', subject: '', absentP: 0, absentK: 1, late: 0, early: 0, signed: true, absentees: [{ mhs: '1', name: 'A', type: 'K' }] } };
    it('cảnh báo khi vắng K không có baseline/đơn', () => {
      const w = reconcileDaily({ periodAttendance: pa } as any);
      expect(w).toEqual([{ mhs: '1', name: 'A', periods: [2], types: ['K'] }]);
    });
    it('không cảnh báo khi có đơn', () => {
      expect(reconcileDaily({ periodAttendance: pa, approvedLeaves: map } as any)).toEqual([]);
    });
    it('không cảnh báo khi có trong baseline', () => {
      const b = { absences: [{ studentId: '1', studentName: 'A', type: 'K' }], earlyDepartures: [] };
      expect(reconcileDaily({ periodAttendance: pa, morningBaseline: b } as any)).toEqual([]);
    });
    it('doc cũ không có absentees → bỏ qua', () => {
      const old = { '2': { ...pa['2'], absentees: undefined } };
      expect(reconcileDaily({ periodAttendance: old } as any)).toEqual([]);
    });
  });
  it('mealSummary', () => {
    const r = mealSummary([
      L({ id: 'a', classId: '6A1', studentName: 'A' }),
      L({ id: 'b', meal: true, classId: '6A1', studentName: 'B' }),
      L({ id: 'c', status: 'pending', classId: '6A2' }),
      L({ id: 'd', dates: ['2026-11-11'], classId: '6A2' }),
    ], '2026-11-10');
    expect(r).toEqual({ total: 1, byClass: [{ classId: '6A1', students: ['A'] }] });
  });

  it('đầu buổi: chỉ HS có đơn phủ CẢ buổi', () => {
    const map: Record<string, ApprovedLeaveEntry> = {
      a: { mhs: '1', name: 'A', periods: [], meal: false },
      b: { mhs: '2', name: 'B', periods: [1, 2, 3, 4], meal: true },
      c: { mhs: '3', name: 'C', periods: [2, 3], meal: true },
      d: { mhs: '4', name: 'D', periods: [5, 6, 7, 8], meal: true },
    };
    expect(leaveAbsencesForSession(map, 'morning').map((a) => a.studentId)).toEqual(['1', '2']);
    expect(leaveAbsencesForSession(map, 'afternoon').map((a) => a.studentId)).toEqual(['1', '4']);
    expect(leaveAbsencesForSession(undefined, 'morning')).toEqual([]);
    expect(leaveAbsencesForSession(map, 'morning')[0]).toMatchObject({ type: 'P', note: 'Đơn PH đã duyệt' });
  });
});

import { isUnreportedBaseline } from '../utils/studentLeave';
describe('isUnreportedBaseline', () => {
  it('thiếu baseline hoặc baseline trống (createEmptyBaseline, không reportedByName) = chưa báo; có reportedByName = đã báo', () => {
    expect(isUnreportedBaseline(undefined)).toBe(true);
    expect(isUnreportedBaseline(null)).toBe(true);
    expect(isUnreportedBaseline({ reportedBy: 'gv', reportedAt: Date.now(), absences: [] } as never)).toBe(true);
    expect(isUnreportedBaseline({ reportedByName: 'Cô A' })).toBe(false);
  });
});
