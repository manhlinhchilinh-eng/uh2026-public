import { describe, it, expect } from 'vitest';
import { computeDashboard, dashboardCsv, gradeOf, pct, quickRanges, type DashboardInput } from '../utils/dashboard';

const abs = (studentId: string, type: 'P' | 'K' | 'Late') => ({ studentId, studentName: studentId, type });
const period = (periodIndex: number, total: number, isSigned = true) =>
  ({ periodIndex, isSigned, scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total } }) as any;

const base = (): DashboardInput => ({
  start: '2026-10-12', // T2
  end: '2026-10-16', // T6 → 5 ngày học
  holidays: [],
  classIds: ['6A1', '6A2', '9A3'],
  logbooks: [],
  periodsByDaily: {},
  notes: [],
});

describe('Dashboard BGH — tổng hợp', () => {
  it('không có dữ liệu: số 0, tỉ lệ 0%, điểm TB null — không bịa', () => {
    const s = computeDashboard(base());
    expect(s.schoolDays).toBe(5);
    expect(s.totals).toMatchObject({ expectedPeriods: 120, signedPeriods: 0, signedRate: 0, avgScore: null, absP: 0 });
    expect(s.byClass).toHaveLength(3);
  });

  it('tiết đã ký, điểm TB có trọng số, theo khối', () => {
    const inp = base();
    inp.logbooks = [
      { id: '6A1_2026-10-12', classId: '6A1', date: '2026-10-12' } as any,
      { id: '9A3_2026-10-13', classId: '9A3', date: '2026-10-13' } as any,
      { id: '9A3_2026-10-20', classId: '9A3', date: '2026-10-20' } as any, // ngoài khoảng
    ];
    inp.periodsByDaily = {
      '6A1_2026-10-12': [period(1, 9), period(2, 7), period(3, 0, false)],
      '9A3_2026-10-13': [period(1, 10)],
      '9A3_2026-10-20': [period(1, 1)],
    };
    const s = computeDashboard(inp);
    const c6 = s.byClass.find((c) => c.classId === '6A1')!;
    expect(c6).toMatchObject({ signedPeriods: 2, avgScore: 8, expectedPeriods: 40 });
    expect(c6.signedRate).toBeCloseTo(0.05);
    expect(s.totals.signedPeriods).toBe(3);
    expect(s.totals.avgScore).toBe(8.7); // (9+7+10)/3
    expect(s.byGrade.find((g) => g.grade === 6)).toMatchObject({ expectedPeriods: 80, signedPeriods: 2 });
  });

  it('chuyên cần theo ngày: HS vắng cả sáng lẫn chiều chỉ tính 1 lần', () => {
    const inp = base();
    inp.logbooks = [
      {
        id: '6A1_2026-10-12', classId: '6A1', date: '2026-10-12',
        morningBaseline: { absences: [abs('a', 'P'), abs('b', 'K'), abs('c', 'Late')] },
        afternoonBaseline: { absences: [abs('a', 'P'), abs('d', 'K')] },
      } as any,
      { id: '6A1_2026-10-13', classId: '6A1', date: '2026-10-13', preSessionAttendance: { absences: [abs('a', 'P')] } } as any,
    ];
    const c = computeDashboard(inp).byClass.find((x) => x.classId === '6A1')!;
    expect(c).toMatchObject({ absP: 2, absK: 2, late: 1 });
  });

  it('nề nếp: đếm khen/nhắc nhở trong khoảng', () => {
    const inp = base();
    inp.notes = [
      { classId: '6A2', type: 'positive', date: '2026-10-12' },
      { classId: '6A2', type: 'negative', date: '2026-10-16' },
      { classId: '6A2', type: 'negative', date: '2026-10-19' },
    ];
    expect(computeDashboard(inp).byClass.find((c) => c.classId === '6A2')).toMatchObject({ positive: 1, negative: 1 });
  });

  it('tiện ích: khối, phần trăm, khoảng nhanh, CSV', () => {
    expect(gradeOf('9A3')).toBe(9);
    expect(pct(null)).toBe('—');
    expect(pct(0.0456)).toBe('4.6%');
    expect(quickRanges('2026-10-14')).toEqual({ week: { start: '2026-10-12', end: '2026-10-14' }, month: { start: '2026-10-01', end: '2026-10-14' } });
    expect(quickRanges('2026-10-18').week.start).toBe('2026-10-12'); // Chủ nhật
    const csv = dashboardCsv(computeDashboard(base()), '2026-10-12', '2026-10-16');
    expect(csv.startsWith('﻿"Từ ngày"')).toBe(true);
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(4);
  });
});
