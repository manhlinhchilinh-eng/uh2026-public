import { describe, it, expect } from 'vitest';
import { computeStudentDaily, summarizeAttendance, describeDay, studentDailyId } from '../utils/studentDaily';

const abs = (studentId: string, type: 'P' | 'K' | 'Late', extra = {}) => ({ studentId, studentName: 'HS ' + studentId, type, ...extra });
const baseline = (absences: any[], earlyDepartures: any[] = []) => ({ reportedBy: 'gv', reportedAt: 1, absences, earlyDepartures });

describe('Bản tin chuyên cần từng HS', () => {
  it('tách theo HS: sáng/chiều, vắng theo tiết, về sớm; HS đi học đủ không có bản tin', () => {
    const r = computeStudentDaily(
      '6A1',
      '2026-10-12',
      {
        morningBaseline: baseline([abs('111111', 'P'), abs('222222', 'Late')]),
        afternoonBaseline: baseline([abs('111111', 'P')], [{ studentId: '333333', studentName: 'HS 3', departedAt: '15:00', reason: 'Sốt' }]),
      },
      [
        { periodIndex: 3, subject: 'Toán', absentStudents: [abs('444444', 'K', { reportedInTier: 'period' }), abs('111111', 'P', { reportedInTier: 'baseline' })] } as any,
      ],
      42
    );
    expect(Object.keys(r).sort()).toEqual(['111111', '222222', '333333', '444444']);
    expect(r['111111']).toMatchObject({ morning: 'P', afternoon: 'P', periodAbsences: [], classId: '6A1', date: '2026-10-12', updatedAt: 42 });
    expect(r['222222']).toMatchObject({ morning: 'Late', afternoon: null });
    expect(r['333333'].earlyDeparture).toEqual({ departedAt: '15:00', reason: 'Sốt' });
    expect(r['444444'].periodAbsences).toEqual([{ periodIndex: 3, type: 'K', subject: 'Toán' }]);
  });

  it('dùng preSessionAttendance khi chưa có morningBaseline (dữ liệu cũ)', () => {
    const r = computeStudentDaily('6A1', '2026-10-12', { preSessionAttendance: baseline([abs('111111', 'K')]) }, []);
    expect(r['111111'].morning).toBe('K');
  });

  it('tóm tắt và mô tả cho phụ huynh', () => {
    const days = Object.values(
      computeStudentDaily('6A1', '2026-10-12', { morningBaseline: baseline([abs('1', 'P')]), afternoonBaseline: baseline([abs('1', 'P')]) }, [])
    );
    expect(summarizeAttendance(days)).toEqual({ sessionsP: 2, sessionsK: 0, late: 0, early: 0 });
    expect(describeDay(days[0])).toBe('Cả ngày vắng có phép');
    const d2 = computeStudentDaily('6A1', '2026-10-13', { morningBaseline: baseline([abs('1', 'Late')], [{ studentId: '1', studentName: 'x', departedAt: '10:00', reason: '' }]) }, [])['1'];
    expect(describeDay(d2)).toBe('Sáng đi muộn • Về sớm lúc 10:00');
    expect(studentDailyId('111111', '2026-10-12')).toBe('111111_2026-10-12');
  });
});
