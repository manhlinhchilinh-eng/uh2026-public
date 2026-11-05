/**
 * Unit & Integration Tests: Summary Service Layer & Aggregators
 * Milestone 5: 40-Period Weekly Aggregation, Monthly Rollups & Dual-Mode Persistence
 * Path: src/test/summaryService.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getWeekDatesForAcademicYear,
  generateWeeklySummaryId,
  generateMonthlySummaryId,
  calculateWeeklySummary,
  calculateMonthlySummary,
  saveWeeklySummary,
  getWeeklySummary,
  getAllClassSummariesForWeek,
  saveMonthlySummary,
  getMonthlySummary,
} from '../services/summaryService';
import { DailyLogbook, PeriodEntry } from '../types/logbook';

describe('Milestone 5: Summary Service & Aggregation Layer', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('1. Academic Calendar & Date Mathematics', () => {
    it('1.1 Week 1 begins on Monday, September 7, 2026', () => {
      const w1 = getWeekDatesForAcademicYear(1, '2026-2027');
      expect(w1.startDate).toBe('2026-09-07');
      expect(w1.endDate).toBe('2026-09-11');
      expect(w1.weekDates).toEqual([
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
        '2026-09-10',
        '2026-09-11',
      ]);
    });

    it('1.2 Week 5 precisely aligns with October 5 to October 9, 2026 (matching Tier 4 Scenario 5)', () => {
      const w5 = getWeekDatesForAcademicYear(5, '2026-2027');
      expect(w5.startDate).toBe('2026-10-05');
      expect(w5.endDate).toBe('2026-10-09');
      expect(w5.weekDates).toEqual([
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
      ]);
    });

    it('1.3 Canonical Document IDs follow standard naming conventions', () => {
      expect(generateWeeklySummaryId('9A3', 5)).toBe('9A3_W5');
      expect(generateMonthlySummaryId('9A3', 10, 2026)).toBe('9A3_M10_2026');
    });
  });

  describe('2. calculateWeeklySummary Aggregator', () => {
    const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];

    it('2.1 Aggregates 40 periods accurately with criteria averages and attendance', () => {
      const dailyLogbooks: DailyLogbook[] = dates.map((d) => ({
        id: `6A1_${d}`,
        classId: '6A1',
        date: d,
        weekNumber: 5,
        totalPeriods: 8,
        isCompleted: true,
        preSessionAttendance: {
          reportedBy: 'msphuonganhums',
          reportedAt: Date.now(),
          absences: [],
          earlyDepartures: [],
        },
        updatedAt: Date.now(),
      }));

      // Create 40 periods: average score 9.5 (4.0, 2.5, 2.0, 1.0)
      // 1 Late on Monday, 1 P on Tuesday
      const periods: PeriodEntry[] = [];
      dates.forEach((d) => {
        for (let p = 1; p <= 8; p++) {
          const abs = [];
          if (d === '2026-10-05' && p === 1) {
            abs.push({ studentId: '269048', studentName: 'Đinh Minh Tùng', type: 'Late' as const });
          } else if (d === '2026-10-06' && p === 1) {
            abs.push({ studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P' as const });
          }

          periods.push({
            id: String(p),
            dailyId: `6A1_${d}`,
            periodIndex: p,
            subject: `Môn ${p}`,
            lessonTopic: `Bài ${p}`,
            teacherId: 'teacher1',
            teacherName: 'Giáo viên 1',
            absentStudents: abs,
            scores: { learning: 4.0, discipline: 2.5, hygiene: 2.0, customCriterion: 1.0, total: 9.5 },
            teacherComment: 'Tốt',
            teacherSignature: 'GV 1',
            isSigned: true,
            updatedAt: Date.now(),
          });
        }
      });

      const summary = calculateWeeklySummary('6A1', 5, dailyLogbooks, periods);

      expect(summary.classId).toBe('6A1');
      expect(summary.weekNumber).toBe(5);
      expect(summary.totalPeriodsExpected).toBe(40);
      expect(summary.totalPeriodsTaught).toBe(40);
      expect(summary.totalPeriodsSigned).toBe(40);
      expect(summary.unsignedPeriods).toHaveLength(0);

      expect(summary.criteriaAverages.learning).toBe(4.0);
      expect(summary.criteriaAverages.discipline).toBe(2.5);
      expect(summary.criteriaAverages.hygiene).toBe(2.0);
      expect(summary.criteriaAverages.customCriterion).toBe(1.0);
      expect(summary.criteriaAverages.totalAverage).toBe(9.5);

      expect(summary.attendanceStats.totalLate).toBe(1);
      expect(summary.attendanceStats.totalExcused).toBe(1);
      expect(summary.attendanceStats.totalUnexcused).toBe(0);
      expect(summary.attendanceStats.studentAbsenceSummary['269398'].P).toBe(1);
      expect(summary.attendanceStats.studentAbsenceSummary['269048'].Late).toBe(1);

      // Emulation score: 100 + (9.5 - 9.5)*10 - 0 (K) - 0.5 (P) - 1.0 (Late) = 98.5
      expect(summary.emulationScore).toBe(98.5);
    });

    it('2.2 Audits and flags unsigned periods', () => {
      const dailyLogbooks: DailyLogbook[] = [
        {
          id: '6A1_2026-10-05',
          classId: '6A1',
          date: '2026-10-05',
          weekNumber: 5,
          totalPeriods: 8,
          isCompleted: false,
          preSessionAttendance: { reportedBy: '', reportedAt: 0, absences: [], earlyDepartures: [] },
          updatedAt: 0,
        },
      ];

      // 2 periods: Period 1 is signed, Period 2 is taught but NOT signed
      const periods: PeriodEntry[] = [
        {
          periodIndex: 1,
          dailyId: '6A1_2026-10-05',
          subject: 'Toán',
          lessonTopic: 'Hàm số',
          teacherId: 'teacher1',
          teacherName: 'Thầy A',
          absentStudents: [],
          scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
          teacherComment: 'Tốt',
          teacherSignature: 'Thầy A',
          isSigned: true,
          updatedAt: 0,
        },
        {
          periodIndex: 2,
          dailyId: '6A1_2026-10-05',
          subject: 'Văn',
          lessonTopic: 'Truyện Kiều',
          teacherId: 'teacher2',
          teacherName: 'Cô B',
          absentStudents: [],
          scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
          teacherComment: '',
          teacherSignature: '',
          isSigned: false,
          updatedAt: 0,
        },
      ];

      const summary = calculateWeeklySummary('6A1', 5, dailyLogbooks, periods);
      expect(summary.totalPeriodsTaught).toBe(2);
      expect(summary.totalPeriodsSigned).toBe(1);
      expect(summary.unsignedPeriods).toHaveLength(1);
      expect(summary.unsignedPeriods[0].periodIndex).toBe(2);
      expect(summary.unsignedPeriods[0].subject).toBe('Văn');
      expect(summary.unsignedPeriods[0].teacherName).toBe('Cô B');
    });
  });

  describe('3. calculateMonthlySummary Aggregator', () => {
    it('3.1 Aggregates 4 weekly summaries into a single MonthlySummary', () => {
      const w1 = calculateWeeklySummary('9A3', 1, [], []);
      w1.totalPeriodsTaught = 40;
      w1.totalPeriodsSigned = 40;
      w1.criteriaAverages = { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, totalAverage: 10 };
      w1.attendanceStats = { totalExcused: 1, totalUnexcused: 0, totalLate: 1, studentAbsenceSummary: {} };
      w1.emulationScore = 100;

      const w2 = calculateWeeklySummary('9A3', 2, [], []);
      w2.totalPeriodsTaught = 40;
      w2.totalPeriodsSigned = 40;
      w2.criteriaAverages = { learning: 3.5, discipline: 2.5, hygiene: 2, customCriterion: 1, totalAverage: 9 };
      w2.attendanceStats = { totalExcused: 2, totalUnexcused: 1, totalLate: 0, studentAbsenceSummary: {} };
      w2.emulationScore = 95;

      const monthly = calculateMonthlySummary('9A3', 9, 2026, [w1, w2]);
      expect(monthly.classId).toBe('9A3');
      expect(monthly.month).toBe(9);
      expect(monthly.year).toBe(2026);
      expect(monthly.weekNumbers).toEqual([1, 2]);
      expect(monthly.totalPeriodsTaught).toBe(80);
      expect(monthly.totalPeriodsSigned).toBe(80);
      expect(monthly.attendanceTotals.totalExcused).toBe(3);
      expect(monthly.attendanceTotals.totalUnexcused).toBe(1);
      expect(monthly.criteriaAverages.totalAverage).toBe(9.5);
      expect(monthly.emulationScoreAvg).toBe(97.5);
    });
  });

  describe('4. Dual-Mode Storage & Event Bus', () => {
    it('4.1 Saves and retrieves WeeklySummary from mock storage', async () => {
      const sample = calculateWeeklySummary('8A3', 5, [], []);
      sample.gvcnWeeklyNote = 'Lớp chăm chỉ';

      await saveWeeklySummary(sample);

      const retrieved = await getWeeklySummary('8A3', 5);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.classId).toBe('8A3');
      expect(retrieved?.gvcnWeeklyNote).toBe('Lớp chăm chỉ');
    });

    it('4.2 Dispatches CustomEvent ums_summary_update upon save', async () => {
      const listener = vi.fn();
      window.addEventListener('ums_summary_update', listener);

      const sample = calculateWeeklySummary('7A1', 5, [], []);
      await saveWeeklySummary(sample);

      expect(listener).toHaveBeenCalled();
      window.removeEventListener('ums_summary_update', listener);
    });

    it('4.3 getAllClassSummariesForWeek returns representations for all 26 classes', async () => {
      const summaries = await getAllClassSummariesForWeek(5);
      expect(summaries).toHaveLength(26);
      // Check that 6A1 to 9A6 are all present
      expect(summaries.some((s) => s.classId === '6A1')).toBe(true);
      expect(summaries.some((s) => s.classId === '9A6')).toBe(true);
    });

    it('4.4 Saves and retrieves MonthlySummary', async () => {
      const mSample = calculateMonthlySummary('6A1', 10, 2026, []);
      await saveMonthlySummary(mSample);

      const retrieved = await getMonthlySummary('6A1', 10, 2026);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.month).toBe(10);
    });
  });
});
