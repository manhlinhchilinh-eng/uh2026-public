import { describe, expect, it } from 'vitest';
import { leaveStats, weekSchoolDates } from '../utils/leaveStats';
import type { StudentLeave } from '../utils/studentLeave';

const mk = (o: Partial<StudentLeave> & { id: string }): StudentLeave => ({
  mhs: o.id, studentName: o.id, classId: '6A1', parentUid: 'p', parentName: 'PH', kind: 'day', dates: ['2026-11-05'],
  periods: [], meal: true, reason: 'sick', note: '', status: 'approved', day: 1, seq: 1, createdAt: 1, ...o,
});

describe('weekSchoolDates', () => {
  it('thứ Năm 05/11/2026 → T2 02/11 .. T7 07/11', () => {
    expect(weekSchoolDates('2026-11-05')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  });
  it('Chủ nhật → tuần vừa qua; thứ Hai → chính tuần đó', () => {
    expect(weekSchoolDates('2026-11-08')[0]).toBe('2026-11-02');
    expect(weekSchoolDates('2026-11-02')[0]).toBe('2026-11-02');
  });
});

describe('leaveStats', () => {
  const day = ['2026-11-05'];
  it('tổng, khối, lớp; chỉ đơn approved trong kỳ; sắp lớp tự nhiên', () => {
    const r = leaveStats([
      mk({ id: 'a', classId: '9A10' }),
      mk({ id: 'b', classId: '9A2', kind: 'periods', periods: [2, 1], meal: true }),
      mk({ id: 'c', classId: '6A1', meal: false }),
      mk({ id: 'd', classId: '6A1', status: 'pending' }),
      mk({ id: 'e', classId: '7A1', dates: ['2026-11-09'] }),
    ], day);
    expect(r.total).toBe(3);
    expect(r.byGrade).toEqual([{ grade: 6, count: 1 }, { grade: 7, count: 0 }, { grade: 8, count: 0 }, { grade: 9, count: 2 }]);
    expect(r.byClass.map((c) => c.classId)).toEqual(['6A1', '9A2', '9A10']);
    expect(r.byClass[0]).toMatchObject({ fullDay: 1, periods: 0, noMeal: 1 });
    expect(r.byClass[1]).toMatchObject({ fullDay: 0, periods: 1, noMeal: 0 });
    expect(r.byClass[1].students[0].detail).toBe('05/11: tiết 1,2');
  });
  it('HS nghỉ nhiều ngày trong tuần = 1 HS, chi tiết liệt kê ngày', () => {
    const wk = weekSchoolDates('2026-11-05');
    const r = leaveStats([
      mk({ id: 'x', mhs: 'm1', studentName: 'An', dates: ['2026-11-03', '2026-11-04', '2026-11-05'], meal: false }),
      mk({ id: 'y', mhs: 'm1', studentName: 'An', kind: 'periods', periods: [3], dates: ['2026-11-06'] }),
    ], wk);
    expect(r.total).toBe(1);
    expect(r.byClass[0]).toMatchObject({ fullDay: 1, periods: 0, noMeal: 1 });
    expect(r.byClass[0].students[0].detail).toBe('03/11, 04/11, 05/11: cả ngày; 06/11: tiết 3');
  });
  it('rỗng', () => {
    expect(leaveStats([], day)).toEqual({ total: 0, byGrade: [6, 7, 8, 9].map((grade) => ({ grade, count: 0 })), byClass: [] });
  });
});
