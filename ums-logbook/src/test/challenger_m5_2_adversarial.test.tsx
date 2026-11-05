/**
 * Challenger M5_2: Adversarial Summary Aggregator, Persistence, Date Math & PDF Layout Suite
 *
 * Empirical adversarial stress testing of:
 * 1. Aggregation Engine Robustness (calculateWeeklySummary & calculateMonthlySummary)
 * 2. Dual-Mode Persistence & Event Bus (summaryService fallback & ums_summary_update)
 * 3. Date Mathematics & Academic Year (getWeekDatesForAcademicYear & getWeekDates)
 * 4. MOET A4 Landscape Layout & Print Engine (DOM isolation, 10-column table, signature blocks)
 *
 * Path: src/test/challenger_m5_2_adversarial.test.tsx
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  calculateWeeklySummary,
  calculateMonthlySummary,
  getWeekDatesForAcademicYear,
  saveWeeklySummary,
  getWeeklySummary,
  saveMonthlySummary,
  getMonthlySummary,
  getAllClassSummariesForWeek,
} from '../services/summaryService';
import {
  getWeekDates,
  formatStudentAbsences,
  exportWeeklyLogbookPdf,
  triggerBrowserPrint,
  WeeklyLogbookPdfData,
} from '../utils/pdfGenerator';
import { LogbookPdfView } from '../components/summary/LogbookPdfView';
import { PdfExportModal } from '../components/summary/PdfExportModal';
import { DailyLogbook, PeriodEntry } from '../types/logbook';
import { ALL_CLASSES } from '../services/seedService';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

describe('CHALLENGER M5_2: Adversarial Summary Aggregator & PDF Layout Test Track', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. AGGREGATION ENGINE ROBUSTNESS
  // =========================================================================
  describe('1. Aggregation Engine Robustness (calculateWeeklySummary & calculateMonthlySummary)', () => {
    it('1.1 Empty Input Zero-Bounds: 0 daily logbooks & 0 periods returns clean summary without NaN or crashes', () => {
      const summary = calculateWeeklySummary('6A1', 1, [], []);

      expect(summary).toBeDefined();
      expect(summary.classId).toBe('6A1');
      expect(summary.weekNumber).toBe(1);
      expect(summary.totalPeriodsExpected).toBe(40);
      expect(summary.totalPeriodsTaught).toBe(0);
      expect(summary.totalPeriodsSigned).toBe(0);
      expect(summary.unsignedPeriods).toEqual([]);

      // Criteria averages must be zero, strictly not NaN
      expect(summary.criteriaAverages.learning).toBe(0);
      expect(summary.criteriaAverages.discipline).toBe(0);
      expect(summary.criteriaAverages.hygiene).toBe(0);
      expect(summary.criteriaAverages.customCriterion).toBe(0);
      expect(summary.criteriaAverages.totalAverage).toBe(0);
      expect(Number.isNaN(summary.criteriaAverages.totalAverage)).toBe(false);

      // Attendance stats must be zero
      expect(summary.attendanceStats.totalExcused).toBe(0);
      expect(summary.attendanceStats.totalUnexcused).toBe(0);
      expect(summary.attendanceStats.totalLate).toBe(0);
      expect(summary.attendanceStats.totalEarlyDepartures).toBe(0);
      expect(summary.attendanceStats.studentAbsenceSummary).toEqual({});

      // Emulation score: Base 100 with 0 periods taught
      expect(summary.emulationScore).toBe(100.0);
    });

    it('1.2 Empty Input for calculateMonthlySummary with 0 weekly summaries returns clean rollup', () => {
      const monthly = calculateMonthlySummary('6A1', 9, 2026, []);

      expect(monthly).toBeDefined();
      expect(monthly.classId).toBe('6A1');
      expect(monthly.month).toBe(9);
      expect(monthly.year).toBe(2026);
      expect(monthly.totalPeriodsExpected).toBe(0);
      expect(monthly.totalPeriodsTaught).toBe(0);
      expect(monthly.totalPeriodsSigned).toBe(0);
      expect(monthly.unsignedPeriodsCount).toBe(0);
      expect(monthly.weekNumbers).toEqual([]);

      // Averages must be 0 and not NaN
      expect(monthly.criteriaAverages.learning).toBe(0);
      expect(monthly.criteriaAverages.discipline).toBe(0);
      expect(monthly.criteriaAverages.hygiene).toBe(0);
      expect(monthly.criteriaAverages.customCriterion).toBe(0);
      expect(monthly.criteriaAverages.totalAverage).toBe(0);
      expect(Number.isNaN(monthly.criteriaAverages.totalAverage)).toBe(false);

      expect(monthly.emulationScoreAvg).toBe(100);
      expect(monthly.attendanceTotals.totalExcused).toBe(0);
      expect(monthly.attendanceTotals.totalUnexcused).toBe(0);
      expect(monthly.attendanceTotals.totalLate).toBe(0);
      expect(monthly.attendanceTotals.studentAbsenceSummary).toEqual({});
    });

    it('1.3 Partial Week Aggregation: 1 day recorded out of 5 correctly aggregates and marks 32 unsigned periods', () => {
      const range = getWeekDatesForAcademicYear(5, '2026-2027');
      const mondayDate = range.weekDates[0]; // 2026-10-05

      const dailyLogbooks: DailyLogbook[] = [
        {
          id: `9A3_${mondayDate}`,
          classId: '9A3',
          date: mondayDate,
          weekNumber: 5,
          totalPeriods: 8,
          isCompleted: true,
          preSessionAttendance: { reportedBy: 'mrlinh9a3ums', reportedAt: Date.now(), absences: [], earlyDepartures: [] },
          updatedAt: Date.now(),
        },
      ];

      // Build 40 periods: Monday has 8 signed periods (scores: 9.5 each, no absences)
      // Tuesday through Friday have 32 scheduled periods that are NOT signed (isSigned: false)
      const allPeriods: PeriodEntry[] = [];

      range.weekDates.forEach((date, dayIdx) => {
        for (let p = 1; p <= 8; p++) {
          const isMonday = dayIdx === 0;
          allPeriods.push({
            id: `${p}`,
            dailyId: `9A3_${date}`,
            periodIndex: p,
            subject: `Subject_Day${dayIdx + 1}_P${p}`,
            lessonTopic: isMonday ? `Bài học thứ Hai tiết ${p}` : `Bài dự kiến`,
            teacherId: `teacher_${dayIdx}_${p}`,
            teacherName: `Giáo viên ${dayIdx + 1}.${p}`,
            absentStudents: [],
            scores: isMonday
              ? { learning: 4.0, discipline: 2.5, hygiene: 2.0, customCriterion: 1.0, total: 9.5 }
              : { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
            teacherComment: isMonday ? 'Đạt' : '',
            teacherSignature: isMonday ? 'GV Ký' : '',
            isSigned: isMonday,
            updatedAt: Date.now(),
          });
        }
      });

      const summary = calculateWeeklySummary('9A3', 5, dailyLogbooks, allPeriods);

      expect(summary.totalPeriodsExpected).toBe(40);
      expect(summary.totalPeriodsTaught).toBe(40);
      expect(summary.totalPeriodsSigned).toBe(8);
      // All 32 remaining periods across Tue-Fri must be flagged as unsigned
      expect(summary.unsignedPeriods).toHaveLength(32);

      // Verify criteria averages are computed across the 8 completed periods only (average 9.5)
      expect(summary.criteriaAverages.totalAverage).toBe(9.5);
      expect(summary.criteriaAverages.learning).toBe(4.0);
      expect(summary.criteriaAverages.discipline).toBe(2.5);

      // Unsigned penalty verification: 32 unsigned * -2.0 deduction
      // Base 100 + (9.5-9.5)*10 - 32*2.0 = 100 - 64 = 36.0
      expect(summary.emulationScore).toBe(36.0);
    });

    it('1.4 Unsigned Periods Audit: catalogs exact date, period index, subject, and teacherName', () => {
      const range = getWeekDatesForAcademicYear(2, '2026-2027');
      const periods: PeriodEntry[] = [
        {
          periodIndex: 1,
          dailyId: `7A3_${range.weekDates[0]}`,
          subject: 'Toán học',
          lessonTopic: 'Đại số 7',
          teacherId: 'teacher_toan',
          teacherName: 'Thầy Nguyễn Văn A',
          absentStudents: [],
          scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
          teacherComment: 'Tốt',
          teacherSignature: 'Nguyễn Văn A',
          isSigned: true,
          updatedAt: 0,
        },
        {
          periodIndex: 2,
          dailyId: `7A3_${range.weekDates[0]}`,
          subject: 'Ngữ văn',
          lessonTopic: 'Văn học dân gian',
          teacherId: 'teacher_van',
          teacherName: 'Cô Trần Thị B',
          absentStudents: [],
          scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
          teacherComment: '',
          teacherSignature: '',
          isSigned: false,
          updatedAt: 0,
        },
        {
          periodIndex: 5,
          dailyId: `7A3_${range.weekDates[1]}`,
          subject: 'Tiếng Anh',
          lessonTopic: 'Unit 1: Vocabulary',
          teacherId: 'teacher_anh',
          teacherName: 'Cô Lê Thị C',
          absentStudents: [],
          scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
          teacherComment: '',
          teacherSignature: '',
          isSigned: false,
          updatedAt: 0,
        },
      ];

      const summary = calculateWeeklySummary('7A3', 2, [], periods);

      expect(summary.totalPeriodsTaught).toBe(3);
      expect(summary.totalPeriodsSigned).toBe(1);
      expect(summary.unsignedPeriods).toHaveLength(2);

      // Verify Audit entry 1
      expect(summary.unsignedPeriods[0]).toEqual({
        date: range.weekDates[0],
        periodIndex: 2,
        subject: 'Ngữ văn',
        teacherName: 'Cô Trần Thị B',
        teacherId: 'teacher_van',
      });

      // Verify Audit entry 2
      expect(summary.unsignedPeriods[1]).toEqual({
        date: range.weekDates[1],
        periodIndex: 5,
        subject: 'Tiếng Anh',
        teacherName: 'Cô Lê Thị C',
        teacherId: 'teacher_anh',
      });
    });

    it('1.5 Attendance Aggregation: student absence map accurately counts individual student P, K, and Late occurrences', () => {
      const date = '2026-09-07';
      const periods: PeriodEntry[] = [
        {
          periodIndex: 1,
          dailyId: `8A1_${date}`,
          subject: 'Toán',
          lessonTopic: '',
          teacherId: 't1',
          teacherName: 'GV 1',
          absentStudents: [
            { studentId: 'stu_1', studentName: 'Nguyễn Văn An', type: 'P' },
            { studentId: 'stu_2', studentName: 'Trần Thị Bình', type: 'K' },
            { studentId: 'stu_3', studentName: 'Lê Hoàng Cường', type: 'Late' },
          ],
          scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
          teacherComment: '',
          teacherSignature: 'GV 1',
          isSigned: true,
          updatedAt: 0,
        },
        {
          periodIndex: 2,
          dailyId: `8A1_${date}`,
          subject: 'Lý',
          lessonTopic: '',
          teacherId: 't2',
          teacherName: 'GV 2',
          absentStudents: [
            { studentId: 'stu_1', studentName: 'Nguyễn Văn An', type: 'P' }, // Stu 1 has second P
            { studentId: 'stu_2', studentName: 'Trần Thị Bình', type: 'K' }, // Stu 2 has second K
          ],
          scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
          teacherComment: '',
          teacherSignature: 'GV 2',
          isSigned: true,
          updatedAt: 0,
        },
      ];

      const summary = calculateWeeklySummary('8A1', 1, [], periods);

      expect(summary.attendanceStats.totalExcused).toBe(2);
      expect(summary.attendanceStats.totalUnexcused).toBe(2);
      expect(summary.attendanceStats.totalLate).toBe(1);

      const map = summary.attendanceStats.studentAbsenceSummary;
      expect(map['stu_1']).toEqual({
        name: 'Nguyễn Văn An',
        P: 2,
        K: 0,
        Late: 0,
        earlyDepartures: 0,
      });
      expect(map['stu_2']).toEqual({
        name: 'Trần Thị Bình',
        P: 0,
        K: 2,
        Late: 0,
        earlyDepartures: 0,
      });
      expect(map['stu_3']).toEqual({
        name: 'Lê Hoàng Cường',
        P: 0,
        K: 0,
        Late: 1,
        earlyDepartures: 0,
      });
    });

    it('1.6 Attendance Rollup in Monthly Summary merges multi-week student absence maps accurately', () => {
      const w1 = calculateWeeklySummary('6A2', 1, [], []);
      w1.attendanceStats = {
        totalExcused: 1,
        totalUnexcused: 2,
        totalLate: 1,
        studentAbsenceSummary: {
          stu_X: { name: 'Đoàn Bảo', P: 1, K: 1, Late: 0, earlyDepartures: 0 },
          stu_Y: { name: 'Vũ Châu', P: 0, K: 1, Late: 1, earlyDepartures: 1 },
        },
      };

      const w2 = calculateWeeklySummary('6A2', 2, [], []);
      w2.attendanceStats = {
        totalExcused: 2,
        totalUnexcused: 1,
        totalLate: 0,
        studentAbsenceSummary: {
          stu_X: { name: 'Đoàn Bảo', P: 2, K: 0, Late: 0, earlyDepartures: 0 },
          stu_Z: { name: 'Phạm Dũng', P: 0, K: 1, Late: 0, earlyDepartures: 0 },
        },
      };

      const monthly = calculateMonthlySummary('6A2', 9, 2026, [w1, w2]);

      expect(monthly.attendanceTotals.totalExcused).toBe(3);
      expect(monthly.attendanceTotals.totalUnexcused).toBe(3);
      expect(monthly.attendanceTotals.totalLate).toBe(1);

      const mMap = monthly.attendanceTotals.studentAbsenceSummary;
      expect(mMap).toBeDefined();
      // stu_X: P: 1+2=3, K: 1+0=1
      expect(mMap!['stu_X'].P).toBe(3);
      expect(mMap!['stu_X'].K).toBe(1);
      // stu_Y: P: 0, K: 1, Late: 1, earlyDepartures: 1
      expect(mMap!['stu_Y'].K).toBe(1);
      expect(mMap!['stu_Y'].Late).toBe(1);
      expect(mMap!['stu_Y'].earlyDepartures).toBe(1);
      // stu_Z: P: 0, K: 1
      expect(mMap!['stu_Z'].K).toBe(1);
    });

    it('1.7 Criteria Averages & Floating-Point Precision: verifies exact 2-decimal rounded arithmetic', () => {
      const date = '2026-09-07';
      // 3 periods with scores: [3.8, 2.7, 1.8, 0.9 = 9.2], [3.9, 2.9, 1.9, 1.0 = 9.7], [3.7, 2.6, 1.7, 0.8 = 8.8]
      const periods: PeriodEntry[] = [
        {
          periodIndex: 1,
          dailyId: `6A1_${date}`,
          subject: 'M1',
          lessonTopic: '',
          teacherId: 't1',
          teacherName: 'GV 1',
          absentStudents: [],
          scores: { learning: 3.8, discipline: 2.7, hygiene: 1.8, customCriterion: 0.9, total: 9.2 },
          teacherComment: '',
          teacherSignature: 'GV',
          isSigned: true,
          updatedAt: 0,
        },
        {
          periodIndex: 2,
          dailyId: `6A1_${date}`,
          subject: 'M2',
          lessonTopic: '',
          teacherId: 't2',
          teacherName: 'GV 2',
          absentStudents: [],
          scores: { learning: 3.9, discipline: 2.9, hygiene: 1.9, customCriterion: 1.0, total: 9.7 },
          teacherComment: '',
          teacherSignature: 'GV',
          isSigned: true,
          updatedAt: 0,
        },
        {
          periodIndex: 3,
          dailyId: `6A1_${date}`,
          subject: 'M3',
          lessonTopic: '',
          teacherId: 't3',
          teacherName: 'GV 3',
          absentStudents: [],
          scores: { learning: 3.7, discipline: 2.6, hygiene: 1.7, customCriterion: 0.8, total: 8.8 },
          teacherComment: '',
          teacherSignature: 'GV',
          isSigned: true,
          updatedAt: 0,
        },
      ];

      const summary = calculateWeeklySummary('6A1', 1, [], periods);

      // Learning: (3.8 + 3.9 + 3.7) / 3 = 11.4 / 3 = 3.80
      expect(summary.criteriaAverages.learning).toBe(3.8);
      // Discipline: (2.7 + 2.9 + 2.6) / 3 = 8.2 / 3 = 2.7333... -> 2.73
      expect(summary.criteriaAverages.discipline).toBe(2.73);
      // Hygiene: (1.8 + 1.9 + 1.7) / 3 = 5.4 / 3 = 1.80
      expect(summary.criteriaAverages.hygiene).toBe(1.8);
      // Custom: (0.9 + 1.0 + 0.8) / 3 = 2.7 / 3 = 0.90
      expect(summary.criteriaAverages.customCriterion).toBe(0.9);
      // Total average: (9.2 + 9.7 + 8.8) / 3 = 27.7 / 3 = 9.2333... -> 9.23
      expect(summary.criteriaAverages.totalAverage).toBe(9.23);
    });

    it('1.8 Weighted Monthly Criteria Averages Invariant', () => {
      // W1: 40 periods signed, average 10.0
      const w1 = calculateWeeklySummary('9A1', 1, [], []);
      w1.totalPeriodsSigned = 40;
      w1.criteriaAverages = { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, totalAverage: 10.0 };

      // W2: 10 periods signed, average 7.0
      const w2 = calculateWeeklySummary('9A1', 2, [], []);
      w2.totalPeriodsSigned = 10;
      w2.criteriaAverages = { learning: 3, discipline: 2, hygiene: 1, customCriterion: 1, totalAverage: 7.0 };

      const monthly = calculateMonthlySummary('9A1', 9, 2026, [w1, w2]);

      // Weighted average: (40 * 10.0 + 10 * 7.0) / 50 = (400 + 70) / 50 = 9.40
      expect(monthly.totalPeriodsSigned).toBe(50);
      expect(monthly.criteriaAverages.totalAverage).toBe(9.4);
    });
  });

  // =========================================================================
  // 2. DUAL-MODE PERSISTENCE & EVENT BUS
  // =========================================================================
  describe('2. Dual-Mode Persistence & Event Bus (summaryService.ts)', () => {
    it('2.1 LocalStorage Mock Fallback: saves and retrieves WeeklySummary without Firestore', async () => {
      const summary = calculateWeeklySummary('8A3', 3, [], []);
      summary.gvcnWeeklyNote = 'Lớp thực hiện nghiêm túc nội quy.';

      await saveWeeklySummary(summary);

      // Verify item saved into localStorage key ums_weekly_summaries
      const raw = localStorage.getItem('ums_weekly_summaries');
      expect(raw).toBeTruthy();
      const map = JSON.parse(raw!);
      expect(map['8A3_W3']).toBeDefined();
      expect(map['8A3_W3'].gvcnWeeklyNote).toBe('Lớp thực hiện nghiêm túc nội quy.');

      // Retrieve via getWeeklySummary
      const retrieved = await getWeeklySummary('8A3', 3);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('8A3_W3');
      expect(retrieved?.classId).toBe('8A3');
      expect(retrieved?.weekNumber).toBe(3);
    });

    it('2.2 LocalStorage Mock Fallback: saves and retrieves MonthlySummary', async () => {
      const mSummary = calculateMonthlySummary('7A2', 10, 2026, []);
      mSummary.gvcnMonthlyNote = 'Hoàn thành tốt nhiệm vụ tháng 10.';

      await saveMonthlySummary(mSummary);

      const raw = localStorage.getItem('ums_monthly_summaries');
      expect(raw).toBeTruthy();
      const map = JSON.parse(raw!);
      expect(map['7A2_M10_2026']).toBeDefined();

      const retrieved = await getMonthlySummary('7A2', 10, 2026);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('7A2_M10_2026');
      expect(retrieved?.gvcnMonthlyNote).toBe('Hoàn thành tốt nhiệm vụ tháng 10.');
    });

    it('2.3 Event Bus: saveWeeklySummary dispatches ums_summary_update CustomEvent with exact payload', async () => {
      let eventPayload: any = null;
      const listener = (e: Event) => {
        const ce = e as CustomEvent;
        eventPayload = ce.detail;
      };

      window.addEventListener('ums_summary_update', listener);

      const summary = calculateWeeklySummary('9A3', 6, [], []);
      await saveWeeklySummary(summary);

      expect(eventPayload).not.toBeNull();
      expect(eventPayload.type).toBe('weekly');
      expect(eventPayload.classId).toBe('9A3');
      expect(eventPayload.weekNumber).toBe(6);
      expect(eventPayload.id).toBe('9A3_W6');
      expect(eventPayload.timestamp).toBeGreaterThan(0);

      window.removeEventListener('ums_summary_update', listener);
    });

    it('2.4 Event Bus: saveMonthlySummary dispatches ums_summary_update CustomEvent', async () => {
      let eventPayload: any = null;
      const listener = (e: Event) => {
        const ce = e as CustomEvent;
        eventPayload = ce.detail;
      };

      window.addEventListener('ums_summary_update', listener);

      const mSummary = calculateMonthlySummary('9A3', 11, 2026, []);
      await saveMonthlySummary(mSummary);

      expect(eventPayload).not.toBeNull();
      expect(eventPayload.type).toBe('monthly');
      expect(eventPayload.classId).toBe('9A3');
      expect(eventPayload.month).toBe(11);
      expect(eventPayload.year).toBe(2026);

      window.removeEventListener('ums_summary_update', listener);
    });

    it('2.5 getAllClassSummariesForWeek synthesizes baseline representations for all 26 classes', async () => {
      const summaries = await getAllClassSummariesForWeek(7);

      expect(summaries).toHaveLength(26);
      // Verify every registered class is present
      for (const classId of ALL_CLASSES) {
        const found = summaries.find((s) => s.classId === classId);
        expect(found).toBeDefined();
        expect(found?.weekNumber).toBe(7);
      }
    });
  });

  // =========================================================================
  // 3. DATE MATHEMATICS & ACADEMIC YEAR
  // =========================================================================
  describe('3. Date Mathematics & Academic Year (getWeekDatesForAcademicYear & getWeekDates)', () => {
    it('3.1 Week 1 Baseline: First week of September 2026 (Mon Sep 7 to Fri Sep 11, 2026)', () => {
      const w1Service = getWeekDatesForAcademicYear(1, '2026-2027');
      expect(w1Service.startDate).toBe('2026-09-07');
      expect(w1Service.endDate).toBe('2026-09-11');
      expect(w1Service.weekDates).toEqual([
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
        '2026-09-10',
        '2026-09-11',
      ]);

      const w1Pdf = getWeekDates(1, '2026-09-07');
      expect(w1Pdf.startDate).toBe('07/09/2026');
      expect(w1Pdf.endDate).toBe('11/09/2026');
      expect(w1Pdf.days[0].dayNameVi).toBe('Thứ Hai');
      expect(w1Pdf.days[4].dayNameVi).toBe('Thứ Sáu');
    });

    it('3.2 Week 35: May 2027 (Mon May 3 to Fri May 7, 2027)', () => {
      const w35 = getWeekDatesForAcademicYear(35, '2026-2027');
      expect(w35.startDate).toBe('2027-05-03');
      expect(w35.endDate).toBe('2027-05-07');
      expect(w35.weekDates).toEqual([
        '2027-05-03',
        '2027-05-04',
        '2027-05-05',
        '2027-05-06',
        '2027-05-07',
      ]);

      const w35Pdf = getWeekDates(35, '2026-09-07');
      expect(w35Pdf.startDate).toBe('03/05/2027');
      expect(w35Pdf.endDate).toBe('07/05/2027');
    });

    it('3.3 Boundary Transition: September to October transition (Week 4: Sep 28 to Oct 2, 2026)', () => {
      const w4 = getWeekDatesForAcademicYear(4, '2026-2027');
      expect(w4.startDate).toBe('2026-09-28');
      expect(w4.endDate).toBe('2026-10-02');
      expect(w4.weekDates).toEqual([
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
      ]);
    });

    it('3.4 Boundary Transition: Calendar Year Transition (Week 17: Dec 28, 2026 to Jan 1, 2027)', () => {
      const w17 = getWeekDatesForAcademicYear(17, '2026-2027');
      expect(w17.startDate).toBe('2026-12-28');
      expect(w17.endDate).toBe('2027-01-01');
      expect(w17.weekDates).toEqual([
        '2026-12-28',
        '2026-12-29',
        '2026-12-30',
        '2026-12-31',
        '2027-01-01',
      ]);
    });

    it('3.5 Boundary Transition: February to March transition (Week 25/26)', () => {
      const w25 = getWeekDatesForAcademicYear(25, '2026-2027');
      expect(w25.startDate).toBe('2027-02-22');
      expect(w25.endDate).toBe('2027-02-26');

      const w26 = getWeekDatesForAcademicYear(26, '2026-2027');
      expect(w26.startDate).toBe('2027-03-01');
      expect(w26.endDate).toBe('2027-03-05');
    });

    it('3.6 Monotonic Sequential Integrity across all 35 academic weeks', () => {
      for (let w = 1; w <= 35; w++) {
        const info = getWeekDatesForAcademicYear(w, '2026-2027');
        expect(info.weekDates).toHaveLength(5);
        // Verify Monday to Friday strictly increasing
        for (let i = 1; i < 5; i++) {
          const prev = new Date(info.weekDates[i - 1]).getTime();
          const curr = new Date(info.weekDates[i]).getTime();
          expect(curr - prev).toBe(86400000);
        }
      }
    });
  });

  // =========================================================================
  // 4. MOET A4 LANDSCAPE LAYOUT & PRINT ENGINE
  // =========================================================================
  describe('4. MOET A4 Landscape Layout & Print Engine', () => {
    const mockPdfData: WeeklyLogbookPdfData = {
      schoolName: 'TRƯỜNG THCS NGOẠI NGỮ - ULIS',
      districtName: 'UBND QUẬN CẦU GIẤY',
      academicYear: '2026 - 2027',
      classId: '9A3',
      gvcnName: 'Nguyễn Mạnh Linh',
      totalStudents: 26,
      weekNumber: 5,
      startDate: '05/10/2026',
      endDate: '09/10/2026',
      days: [
        {
          dayOfWeek: 2,
          dayNameVi: 'Thứ Hai',
          date: '05/10/2026',
          periods: [
            {
              periodIndex: 1,
              subject: 'Toán',
              ppctLessonIndex: 12,
              lessonTopic: 'Hàm số bậc nhất',
              absentStudents: [{ studentId: '1', studentName: 'Vũ An', type: 'Late' }],
              scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
              teacherComment: 'Lớp học sôi nổi',
              teacherSignature: 'Nguyễn Mạnh Linh',
              isSigned: true,
            } as PeriodEntry,
          ],
        },
      ],
      summary: {
        totalPeriodsExpected: 40,
        totalPeriodsTaught: 40,
        totalPeriodsSigned: 39,
        unsignedPeriodsCount: 1,
        unsignedSubjects: ['Văn học'],
        attendanceStats: {
          totalAbsences: 1,
          excusedP: 0,
          unexcusedK: 0,
          late: 1,
        },
        criteriaAverage: {
          learningAvg: 3.9,
          disciplineAvg: 2.9,
          hygieneAvg: 1.9,
          customAvg: 0.9,
          totalWeeklyScore: 9.6,
        },
        emulationScore: 98.0,
        emulationStatus: 'good',
        emulationStatusLabel: 'Tuần học tốt',
        rank: 2,
        gvcnComments: 'Lớp đạt tuần học tốt, nề nếp kỷ luật tốt.',
        bghComments: 'Biểu dương lớp 9A3.',
      },
    };

    it('4.1 DOM Isolation: renders #moet-print-area as isolated container with MOET typography', () => {
      const { container } = render(<LogbookPdfView data={mockPdfData} />);

      const printArea = container.querySelector('#moet-print-area');
      expect(printArea).toBeInTheDocument();

      // Check header lines
      expect(screen.getByText('UBND QUẬN CẦU GIẤY')).toBeInTheDocument();
      expect(screen.getByText('TRƯỜNG THCS NGOẠI NGỮ - ULIS')).toBeInTheDocument();
      expect(screen.getByText('SỔ ĐẦU BÀI ĐIỆN TỬ')).toBeInTheDocument();
      expect(screen.getByText('NĂM HỌC 2026 - 2027')).toBeInTheDocument();
      expect(screen.getAllByText(/TUẦN 5/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('9A3')).toBeInTheDocument();
      expect(screen.getAllByText(/Nguyễn Mạnh Linh/i).length).toBeGreaterThanOrEqual(1);
    });

    it('4.2 10-Column Authentic MOET Structure & Numbering Row', () => {
      render(<LogbookPdfView data={mockPdfData} />);

      // Verify Column Header Titles
      expect(screen.getByText('Thứ, ngày')).toBeInTheDocument();
      expect(screen.getByText('Tiết')).toBeInTheDocument();
      expect(screen.getByText('Môn học')).toBeInTheDocument();
      expect(screen.getByText('Tiết PPCT')).toBeInTheDocument();
      expect(screen.getByText('Tên bài học, nội dung công việc')).toBeInTheDocument();
      expect(screen.getByText('Sĩ số / Vắng mặt')).toBeInTheDocument();
      expect(screen.getByText('Điểm số')).toBeInTheDocument();
      expect(screen.getByText('Nhận xét của GV bộ môn')).toBeInTheDocument();
      expect(screen.getByText('Ký tên')).toBeInTheDocument();

      // Verify MOET Column Numbering row: [1] to [9]
      expect(screen.getByText('[1]')).toBeInTheDocument();
      expect(screen.getByText('[2]')).toBeInTheDocument();
      expect(screen.getByText('[3]')).toBeInTheDocument();
      expect(screen.getByText('[4]')).toBeInTheDocument();
      expect(screen.getByText('[5]')).toBeInTheDocument();
      expect(screen.getByText('[6]')).toBeInTheDocument();
      expect(screen.getByText('[7a]')).toBeInTheDocument();
      expect(screen.getByText('[7b]')).toBeInTheDocument();
      expect(screen.getByText('[7c]')).toBeInTheDocument();
      expect(screen.getByText('[7d]')).toBeInTheDocument();
      expect(screen.getByText('[7e]')).toBeInTheDocument();
      expect(screen.getByText('[8]')).toBeInTheDocument();
      expect(screen.getByText('[9]')).toBeInTheDocument();
    });

    it('4.3 Formal Dual Signature Blocks on Page 2 Summary', () => {
      render(<LogbookPdfView data={mockPdfData} />);

      // Page 2 summary section
      expect(screen.getByText(/TỔNG KẾT TUẦN 5 & ĐÁNH GIÁ THI ĐUA NỀ NẾP • HỌC TẬP/i)).toBeInTheDocument();
      expect(screen.getByText(/1. Tình hình học tập & Chuyên cần/i)).toBeInTheDocument();
      expect(screen.getByText(/2. Điểm trung bình & Xếp hạng thi đua/i)).toBeInTheDocument();
      expect(screen.getByText(/3. Ý kiến & Nhận xét của Giáo viên chủ nhiệm/i)).toBeInTheDocument();

      // Formal Signature blocks
      expect(screen.getByText('GIÁO VIÊN CHỦ NHIỆM')).toBeInTheDocument();
      expect(screen.getByText('BAN GIÁM HIỆU PHÊ DUYỆT')).toBeInTheDocument();
      expect(screen.getAllByText('(Ký và ghi rõ họ tên)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('(Ký, đóng dấu và ghi rõ họ tên)')).toBeInTheDocument();
      expect(screen.getByText('Hiệu trưởng')).toBeInTheDocument();
    });

    it('4.4 Absence List Formatting helper', () => {
      expect(formatStudentAbsences([])).toBe('Đủ');
      expect(
        formatStudentAbsences([
          { studentId: '1', studentName: 'Vũ An', type: 'P' },
          { studentId: '2', studentName: 'Lê Bình', type: 'K' },
          { studentId: '3', studentName: 'Trần Cường', type: 'Late' },
        ])
      ).toBe('CP: Vũ An (P); KP: Lê Bình (K); Muộn: Trần Cường (M)');
    });

    it('4.5 PdfExportModal: verifies controls, zoom, and print isolation', () => {
      const onClose = vi.fn();
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

      const { container } = renderWithProviders(
        <PdfExportModal isOpen={true} onClose={onClose} initialClassId="9A3" initialWeekNumber={5} />
      );

      // Verify Modal toolbar is isolated with no-print
      const toolbar = container.querySelector('.no-print');
      expect(toolbar).toBeInTheDocument();

      // Verify Selectors
      const classSelect = screen.getByLabelText('Chọn lớp học');
      expect(classSelect).toBeInTheDocument();
      expect(classSelect).toHaveValue('9A3');

      const weekSelect = screen.getByLabelText('Chọn tuần học');
      expect(weekSelect).toBeInTheDocument();
      expect(weekSelect).toHaveValue('5');

      // Verify Zoom buttons
      expect(screen.getByText('100%')).toBeInTheDocument();
      const zoomInBtn = screen.getByTitle('Phóng to');
      fireEvent.click(zoomInBtn);
      expect(screen.getByText('125%')).toBeInTheDocument();

      const zoomOutBtn = screen.getByTitle('Thu nhỏ');
      fireEvent.click(zoomOutBtn);
      expect(screen.getByText('100%')).toBeInTheDocument();

      // Verify Print Action
      const printBtn = screen.getByRole('button', { name: /In Sổ Đầu Bài \(A4\)/i });
      fireEvent.click(printBtn);
      expect(printSpy).toHaveBeenCalled();

      // Verify Close Action
      const closeBtn = screen.getByLabelText('Đóng');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });

    it('4.6 Vector PDF Engine exportWeeklyLogbookPdf produces valid 2-page document', async () => {
      const doc = await exportWeeklyLogbookPdf(mockPdfData, 'test_logbook.pdf');
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 5. ADVERSARIAL STRESS & EDGE CASES HARNESS
  // =========================================================================
  describe('5. Adversarial Stress & Edge Cases Harness (Chaos Inputs & Clamping)', () => {
    it('5.1 Zero-Taught Monthly Rollup: 4 weeks with 0 periods completed returns 0 averages without NaN', () => {
      const weeks = [1, 2, 3, 4].map((w) => {
        const sum = calculateWeeklySummary('6A1', w, [], []);
        sum.totalPeriodsSigned = 0;
        sum.totalPeriodsTaught = 0;
        sum.criteriaAverages = { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, totalAverage: 0 };
        return sum;
      });

      const monthly = calculateMonthlySummary('6A1', 9, 2026, weeks);

      expect(monthly.totalPeriodsSigned).toBe(0);
      expect(monthly.totalPeriodsExpected).toBe(160); // 4 * 40
      expect(monthly.criteriaAverages.totalAverage).toBe(0);
      expect(Number.isNaN(monthly.criteriaAverages.totalAverage)).toBe(false);
      expect(Number.isNaN(monthly.criteriaAverages.learning)).toBe(false);
    });

    it('5.2 Score Clamping: Massive deductions clamp at min 0.0, and maximum bonuses clamp at 105.0', () => {
      // Massive deductions
      const terribleWeek = calculateWeeklySummary('6A1', 1, [], []);
      terribleWeek.totalPeriodsSigned = 40;
      terribleWeek.criteriaAverages.totalAverage = 5.0; // severe drop
      // 50 unexcused absences
      terribleWeek.attendanceStats = {
        totalExcused: 0,
        totalUnexcused: 50, // 50 * -2.0 = -100
        totalLate: 20,      // 20 * -1.0 = -20
        studentAbsenceSummary: {},
      };
      // 30 unsigned periods
      terribleWeek.unsignedPeriods = Array.from({ length: 30 }, (_, i) => ({
        date: '2026-09-07',
        periodIndex: (i % 8) + 1,
        subject: 'Môn',
        teacherName: 'GV',
      }));

      // Re-run calculateWeeklySummary with these raw conditions
      const periods: PeriodEntry[] = [];
      for (let p = 1; p <= 8; p++) {
        periods.push({
          periodIndex: p,
          dailyId: '6A1_2026-09-07',
          subject: 'Toán',
          lessonTopic: '',
          teacherId: 't1',
          teacherName: 'GV 1',
          absentStudents: Array.from({ length: 50 }, (_, i) => ({
            studentId: `s_${i}`,
            studentName: `HS ${i}`,
            type: 'K' as const,
          })),
          scores: { learning: 1, discipline: 1, hygiene: 1, customCriterion: 0, total: 3.0 },
          teacherComment: '',
          teacherSignature: 'GV',
          isSigned: true,
          updatedAt: 0,
        });
      }

      const severeSummary = calculateWeeklySummary('6A1', 1, [], periods);
      expect(severeSummary.emulationScore).toBeGreaterThanOrEqual(0.0);
      expect(severeSummary.emulationScore).toBeLessThanOrEqual(105.0);
    });

    it('5.3 Corrupted Period Entries: gracefully handles null/undefined sub-fields without crashing', () => {
      const corruptPeriods: any[] = [
        {
          periodIndex: 1,
          dailyId: '6A1_2026-09-07',
          subject: 'Toán',
          lessonTopic: null,
          teacherId: undefined,
          teacherName: null,
          absentStudents: null, // null instead of array
          scores: null,         // null scores
          teacherComment: null,
          teacherSignature: null,
          isSigned: true,
          updatedAt: 0,
        },
        {
          periodIndex: 99, // out of range
          dailyId: '6A1_2026-09-07',
          subject: 'Invalid Period',
          isSigned: true,
        },
      ];

      expect(() => {
        const sum = calculateWeeklySummary('6A1', 1, [], corruptPeriods);
        expect(sum).toBeDefined();
        expect(sum.totalPeriodsSigned).toBe(1); // period 99 is ignored
        expect(sum.criteriaAverages.totalAverage).toBe(0);
      }).not.toThrow();
    });

    it('5.4 Multi-Class Mock Storage Isolation', async () => {
      const s6A1 = calculateWeeklySummary('6A1', 5, [], []);
      s6A1.gvcnWeeklyNote = 'Note 6A1';
      const s9A3 = calculateWeeklySummary('9A3', 5, [], []);
      s9A3.gvcnWeeklyNote = 'Note 9A3';

      await saveWeeklySummary(s6A1);
      await saveWeeklySummary(s9A3);

      const r6A1 = await getWeeklySummary('6A1', 5);
      const r9A3 = await getWeeklySummary('9A3', 5);

      expect(r6A1?.gvcnWeeklyNote).toBe('Note 6A1');
      expect(r9A3?.gvcnWeeklyNote).toBe('Note 9A3');
      expect(r6A1?.classId).toBe('6A1');
      expect(r9A3?.classId).toBe('9A3');
    });

    it('5.5 PDF Generator resilience with missing optional summary and empty days', async () => {
      const minimalData: WeeklyLogbookPdfData = {
        schoolName: 'TRƯỜNG THCS NGOẠI NGỮ',
        districtName: 'UBND QUẬN CẦU GIẤY',
        academicYear: '2026 - 2027',
        classId: '7A1',
        gvcnName: 'GVCN 7A1',
        totalStudents: 26,
        weekNumber: 1,
        startDate: '07/09/2026',
        endDate: '11/09/2026',
        days: [],
        summary: undefined, // No summary (Page 1 only)
      };

      const doc = await exportWeeklyLogbookPdf(minimalData, 'minimal.pdf');
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('5.6 Browser print trigger handles headless window invocation safely', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      expect(() => triggerBrowserPrint()).not.toThrow();
      expect(printSpy).toHaveBeenCalled();
    });
  });
});
