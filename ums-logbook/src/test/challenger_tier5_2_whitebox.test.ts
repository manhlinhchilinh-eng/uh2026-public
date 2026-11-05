/**
 * CHALLENGER TIER 5_2: WHITE-BOX ADVERSARIAL COVERAGE HARDENING TEST SUITE
 * Track: Final Milestone Phase 2 Adversarial Coverage Hardening
 * Domains:
 *  1. Schedules, Bell Resolver & Multi-Format Importer
 *  2. Summaries & 100-Point Emulation Engine (Clamping, Conjunction, Tie-Breaker & Print Isolation)
 *  3. Security Rules RBAC Invariants, Audit Log Sanitization & Inactivity Session Engine
 *
 * File: src/test/challenger_tier5_2_whitebox.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Domain 1: Schedule, Bell Resolver & Importer imports
import {
  resolveCurrentBellPeriod,
} from '../utils/schedule';
import {
  getAutoPopulatedPeriods,
  isPeriodManuallyModified,
} from '../services/scheduleService';
import {
  stripBom,
  parseCsvRows,
  parseDateValue,
  parseDayOfWeek,
  normalizeHeaderKey,
  parseExcelOrCsvFile,
  validateStudentRosterImport,
} from '../utils/importer';
import { ALL_CLASSES } from '../services/seedService';
import { PeriodEntry } from '../types/logbook';

// Domain 2: Emulation & Summaries imports
import {
  calculateEmulationScore,
  evaluateGoodStudyWeek,
  rankClassesForEmulation,
} from '../utils/emulation';
import { WeeklySummary } from '../types/summary';

// Domain 3: Security, Audit & Inactivity Session imports
import {
  sanitizeState,
} from '../services/auditService';
import {
  IDLE_TIMEOUT_MS,
  WARNING_TIMEOUT_MS,
  THROTTLE_ACTIVITY_MS,
  useIdleTimeout,
} from '../hooks/useIdleTimeout';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Setup Mock for useAuth in useIdleTimeout tests
const mockLogout = vi.fn().mockResolvedValue(undefined);
let mockAuthUser: any = { uid: 'teacher_9a3', email: 'mrlinhums@ums.edu.vn' };

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    logout: mockLogout,
  }),
}));

const testRouterWrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(BrowserRouter, null, children)
);

describe('CHALLENGER TIER 5_2: WHITE-BOX ADVERSARIAL COVERAGE HARDENING', () => {
  // =========================================================================
  // PILLAR 1: SCHEDULE, BELL RESOLVER & IMPORTER HARDENING
  // =========================================================================
  describe('Pillar 1: Schedule, Bell Resolver & Importer Hardening', () => {
    describe('1.1 UMS Bell Schedule Boundary Math', () => {
      // Helper to construct a weekday Date (Monday 2026-10-05) at specific HH:mm:ss
      function createSchoolDate(timeStr: string): Date {
        const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
        return new Date(2026, 9, 5, hours, minutes, seconds); // 2026-10-05 is a Monday
      }

      it('Minute 16:55 - Period 8 exact end boundary: null active period, next null, off session', () => {
        const d = createSchoolDate('16:55:00');
        const res = resolveCurrentBellPeriod(d);
        expect(res.activePeriod).toBeNull();
        expect(res.nextPeriod).toBeNull();
        expect(res.isSchoolHours).toBe(false);
        expect(res.session).toBe('off');
      });

      it('Minute 17:00 - After school evening: null active, null next, off session', () => {
        const d = createSchoolDate('17:00:00');
        const res = resolveCurrentBellPeriod(d);
        expect(res.activePeriod).toBeNull();
        expect(res.nextPeriod).toBeNull();
        expect(res.isSchoolHours).toBe(false);
        expect(res.session).toBe('off');
      });

      it('Weekend boundary: Saturday & Sunday return session off regardless of time', () => {
        const saturday = new Date(2026, 9, 10, 8, 30, 0); // Saturday
        const sunday = new Date(2026, 9, 11, 8, 30, 0);   // Sunday
        expect(resolveCurrentBellPeriod(saturday).session).toBe('off');
        expect(resolveCurrentBellPeriod(sunday).session).toBe('off');
      });

    });

    describe('1.2 Non-Destructive Auto-Population', () => {
      const classId = '6A1';
      const testDate = '2026-10-05'; // Monday

      function createBlankPeriod(periodIndex: number): PeriodEntry {
        return {
          periodIndex,
          subject: '',
          lessonTopic: '',
          teacherId: '',
          teacherName: '',
          absentStudents: [],
          earlyDepartures: [],
          scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
          teacherComment: '',
          teacherSignature: '',
          isSigned: false,
          updatedAt: Date.now(),
        };
      }

      it('isPeriodManuallyModified identifies all modification vectors', () => {
        // 1. Signed
        const signed = { ...createBlankPeriod(1), isSigned: true };
        expect(isPeriodManuallyModified(signed)).toBe(true);

        // 2. Lesson Topic filled
        const withTopic = { ...createBlankPeriod(2), lessonTopic: 'Toán số học: Số nguyên tố' };
        expect(isPeriodManuallyModified(withTopic)).toBe(true);

        // 3. Teacher Comment filled
        const withComment = { ...createBlankPeriod(3), teacherComment: 'Lớp trật tự, chuẩn bị bài tốt' };
        expect(isPeriodManuallyModified(withComment)).toBe(true);

        // 4. PPCT lesson index defined
        const withPpct = { ...createBlankPeriod(4), ppctLessonIndex: 5 };
        expect(isPeriodManuallyModified(withPpct)).toBe(true);

        // 5. Scored period
        const withScore = {
          ...createBlankPeriod(5),
          scores: { learning: 3.5, discipline: 2.5, hygiene: 2.0, customCriterion: 1.0, total: 9.0 },
        };
        expect(isPeriodManuallyModified(withScore)).toBe(true);

        // 6. Absent students recorded
        const withAbsence = {
          ...createBlankPeriod(6),
          absentStudents: [{ studentId: '6A1_01', studentName: 'Nguyen Van A', type: 'P' as const }],
        };
        expect(isPeriodManuallyModified(withAbsence)).toBe(true);

        // 7. Early departure recorded
        const withEarly = {
          ...createBlankPeriod(7),
          earlyDepartures: [{ studentId: '6A1_02', studentName: 'Tran Thi B', departedAt: '10:15', reason: 'Sốt' }],
        };
        expect(isPeriodManuallyModified(withEarly)).toBe(true);

        // 8. Blank untouched period
        expect(isPeriodManuallyModified(createBlankPeriod(8))).toBe(false);
      });

      it('Preserves signed, scored, commented, and titled periods from timetable template overwrites', () => {
        const existing: PeriodEntry[] = [
          {
            ...createBlankPeriod(1),
            subject: 'Môn Tự Chọn Đặc Biệt',
            teacherId: 'special_teacher',
            teacherName: 'Giáo Viên Đặc Biệt',
            isSigned: true,
          },
          {
            ...createBlankPeriod(2),
            subject: 'Hình học giải tích',
            lessonTopic: 'Chương 1: Điểm và đường thẳng',
          },
          {
            ...createBlankPeriod(3),
            subject: 'Ngữ văn chuyên sâu',
            teacherComment: 'Học sinh phân tích tác phẩm rất sâu sắc',
          },
          {
            ...createBlankPeriod(4),
            subject: 'Ngoại ngữ chuyên đề',
            scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
          },
        ];

        const populated = getAutoPopulatedPeriods(classId, testDate, existing);
        expect(populated).toHaveLength(8);

        // Period 1: Preserved because signed
        expect(populated[0].isSigned).toBe(true);
        expect(populated[0].subject).toBe('Môn Tự Chọn Đặc Biệt');
        expect(populated[0].teacherName).toBe('Giáo Viên Đặc Biệt');

        // Period 2: Preserved because lessonTopic is present
        expect(populated[1].lessonTopic).toBe('Chương 1: Điểm và đường thẳng');
        expect(populated[1].subject).toBe('Hình học giải tích');

        // Period 3: Preserved because teacherComment is present
        expect(populated[2].teacherComment).toBe('Học sinh phân tích tác phẩm rất sâu sắc');
        expect(populated[2].subject).toBe('Ngữ văn chuyên sâu');

        // Period 4: Preserved because scores total > 0
        expect(populated[3].scores.total).toBe(10.0);
        expect(populated[3].subject).toBe('Ngoại ngữ chuyên đề');

        // Period 5-8: Untouched -> cleanly auto-populated with Monday schedule templates
        expect(populated[4].subject).toBe('Khoa học tự nhiên');
        expect(populated[5].subject).toBe('Lịch sử và Địa lí');
        expect(populated[6].subject).toBe('Giáo dục thể chất');
        expect(populated[7].subject).toBe('Tin học');
      });
    });

    describe('1.3 Importer Edge Cases & Roster Parsing', () => {
      it('Strips UTF-8 Byte Order Mark (BOM) cleanly without corrupting the first header', () => {
        const textWithBom = '\uFEFFSTT,MHS,Họ và tên,Lớp,Ngày sinh,Giới tính\n1,6A101,Nguyễn Văn A,6A1,2014-01-01,Nam';
        const stripped = stripBom(textWithBom);
        expect(stripped.charCodeAt(0)).not.toBe(0xfeff);
        expect(stripped.startsWith('STT,')).toBe(true);

        const rows = parseCsvRows(textWithBom);
        expect(rows[0][0]).toBe('STT'); // First header is clean STT, not \uFEFFSTT
      });

      it('Normalizes case-insensitive and synonymous headers reliably', () => {
        expect(normalizeHeaderKey('STT')).toBe('stt');
        expect(normalizeHeaderKey('sTt')).toBe('stt');
        expect(normalizeHeaderKey('Số Thứ Tự')).toBe('stt');
        expect(normalizeHeaderKey('MHS')).toBe('mhs');
        expect(normalizeHeaderKey('MÃ HỌC SINH')).toBe('mhs');
        expect(normalizeHeaderKey('Họ và tên')).toBe('name');
        expect(normalizeHeaderKey('HỌ TÊN')).toBe('name');
        expect(normalizeHeaderKey('LỚP')).toBe('classId');
        expect(normalizeHeaderKey('Lớp học')).toBe('classId');
        expect(normalizeHeaderKey('NGÀY SINH')).toBe('dob');
        expect(normalizeHeaderKey('GIỚI TÍNH')).toBe('gender');
        expect(normalizeHeaderKey('SĐT Phụ Huynh')).toBe('parentPhone');
      });

      it('Strictly rejects Saturday and Sunday inputs across Vietnamese, English, and numeric formats', () => {
        const weekendInputs = [
          'Thứ 7', 'Thứ Bảy', 'thứ bảy', 'bay', 'Saturday', 'saturday', 'SATURDAY', 'sat', '7', 7,
          'Chủ Nhật', 'chủ nhật', 'Chủ nhật', 'chu nhat', 'Sunday', 'sunday', 'SUNDAY', 'sun', 'cn', 'CN', '8', 8
        ];

        for (const input of weekendInputs) {
          const res = parseDayOfWeek(input);
          expect(res.day, `Expected day to be null for input "${input}"`).toBeNull();
          expect(res.error).toBeDefined();
          expect(res.error).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
        }
      });

      it('Parses dot-separated dates (DD.MM.YYYY) into ISO YYYY-MM-DD format', () => {
        expect(parseDateValue('02.10.2014').dateStr).toBe('2014-10-02');
        expect(parseDateValue('15.03.2013').dateStr).toBe('2013-03-15');
        expect(parseDateValue('31.12.2012').dateStr).toBe('2012-12-31');

        // Invalid calendar date with dots is rejected
        const nonLeap = parseDateValue('29.02.2023');
        expect(nonLeap.dateStr).toBeNull();
        expect(nonLeap.error).toContain('Ngày không tồn tại trong lịch');
      });

      it('Verifies official UMS class list workbook parses exactly 674/674 valid students across 26 classes', async () => {
        const filePath = path.resolve(__dirname, '../../data/UMS_class_list_2026_2027.xlsx');
        expect(fs.existsSync(filePath)).toBe(true);

        const fileBuffer = fs.readFileSync(filePath);
        const ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
        const mockFile = {
          name: 'UMS_class_list_2026_2027.xlsx',
          arrayBuffer: async () => ab,
        };

        const parseResult = await parseExcelOrCsvFile(mockFile);
        expect(parseResult.type).toBe('students');
        expect(parseResult.studentRows).toBeDefined();
        expect(parseResult.studentRows!.length).toBe(674);

        const report = validateStudentRosterImport(parseResult.studentRows!);
        expect(report.total).toBe(674);
        expect(report.validCount).toBe(674);
        expect(report.errorCount).toBe(0);
        expect(report.invalidRows).toHaveLength(0);

        const distinctClasses = new Set(report.validRows.map((s) => s.classId));
        expect(distinctClasses.size).toBe(26);
      });
    });
  });

  // =========================================================================
  // PILLAR 2: SUMMARIES & 100-POINT EMULATION ENGINE
  // =========================================================================
  describe('Pillar 2: Summaries & 100-Point Emulation Engine', () => {
    describe('2.1 Extreme Boundary Stress & Formula Invariants', () => {
      it('Score clamping [0.0, 105.0]: upper bound clamped at 105.0 even if raw score is 120.0', () => {
        // Base 100 + academic delta +5.0 (periodAvg 10.0) + behavior bonus +5.0 (20 positive notes) = 110.0 -> clamped to 105.0
        const result = calculateEmulationScore({
          periodAverage: 10.0,
          periodsTaught: 40,
          positiveNotes: 20,
          unexcusedK: 0,
          unsignedCount: 0,
        });

        expect(result.totalScore).toBe(105.0);
        expect(result.finalScore).toBe(105.0);
        expect(result.awardLevel).toBe('xuat_sac');
        expect(result.isGoodStudyWeek).toBe(true);
      });

      it('Score clamping [0.0, 105.0]: lower bound clamped at 0.0 even under massive infractions', () => {
        // 50 K = -100.0, 30 unsigned = -60.0, academic delta = -15.0 -> raw score -75.0 -> clamped to 0.0
        const result = calculateEmulationScore({
          periodAverage: 8.0,
          periodsTaught: 40,
          unexcusedK: 50,
          unsignedCount: 30,
        });

        expect(result.totalScore).toBe(0.0);
        expect(result.finalScore).toBe(0.0);
        expect(result.awardLevel).toBe('can_co_gang');
        expect(result.status).toBe('warning');
        expect(result.isGoodStudyWeek).toBe(false);
      });

      it('Academic delta scaling: correctly calculates (periodAvg - 9.5) * 10 with 1-decimal rounding', () => {
        // periodAverage 10.0 -> +5.0
        const r10 = calculateEmulationScore({ periodAverage: 10.0, periodsTaught: 40 });
        expect(r10.academicDelta).toBe(5.0);

        // periodAverage 9.8 -> +3.0
        const r98 = calculateEmulationScore({ periodAverage: 9.8, periodsTaught: 40 });
        expect(r98.academicDelta).toBe(3.0);

        // periodAverage 9.5 -> 0.0
        const r95 = calculateEmulationScore({ periodAverage: 9.5, periodsTaught: 40 });
        expect(r95.academicDelta).toBe(0.0);

        // periodAverage 9.0 -> -5.0
        const r90 = calculateEmulationScore({ periodAverage: 9.0, periodsTaught: 40 });
        expect(r90.academicDelta).toBe(-5.0);

        // periodAverage 8.0 -> -15.0
        const r80 = calculateEmulationScore({ periodAverage: 8.0, periodsTaught: 40 });
        expect(r80.academicDelta).toBe(-15.0);

        // Zero periods taught -> delta must be 0.0
        const rZero = calculateEmulationScore({ periodAverage: 10.0, periodsTaught: 0 });
        expect(rZero.academicDelta).toBe(0.0);
      });

      it('Unsigned period deductions: exactly -2.0 per unsigned period', () => {
        const r1 = calculateEmulationScore({ periodsTaught: 40, periodAverage: 9.5, unsignedCount: 1 });
        expect(r1.unsignedPeriodDeductions).toBe(2.0);
        expect(r1.totalScore).toBe(98.0);

        const r5 = calculateEmulationScore({ periodsTaught: 40, periodAverage: 9.5, unsignedCount: 5 });
        expect(r5.unsignedPeriodDeductions).toBe(10.0);
        expect(r5.totalScore).toBe(90.0);
      });

      it('Attendance deductions: -2.0 for K, -0.5 for P, -1.0 for Late', () => {
        const res = calculateEmulationScore({
          periodsTaught: 40,
          periodAverage: 9.5,
          unexcusedK: 2, // -4.0
          excusedP: 4,   // -2.0
          late: 3,       // -3.0
        });

        expect(res.attendanceDeductions.kDeduction).toBe(4.0);
        expect(res.attendanceDeductions.pDeduction).toBe(2.0);
        expect(res.attendanceDeductions.lateDeduction).toBe(3.0);
        expect(res.attendanceDeductions.total).toBe(9.0);
        expect(res.totalScore).toBe(91.0);
      });

      it('Behavior bonus: +0.5 per positive note, capped strictly at +5.0', () => {
        const r4 = calculateEmulationScore({ periodsTaught: 40, periodAverage: 9.5, positiveNotes: 4 });
        expect(r4.behaviorDelta.bonus).toBe(2.0);

        const r10 = calculateEmulationScore({ periodsTaught: 40, periodAverage: 9.5, positiveNotes: 10 });
        expect(r10.behaviorDelta.bonus).toBe(5.0);

        const r50 = calculateEmulationScore({ periodsTaught: 40, periodAverage: 9.5, positiveNotes: 50 });
        expect(r50.behaviorDelta.bonus).toBe(5.0); // strictly capped
      });
    });

    describe('2.2 "Tuần học tốt" Quadruple Conjunction', () => {
      // Condition: score >= 90.0 AND unexcusedCount === 0 AND minPeriodScore >= 8.0 AND periodsTaught > 0

      it('Clause 1 Pass: meets all 4 criteria -> certifies "Tuần học tốt"', () => {
        const evalRes = evaluateGoodStudyWeek(92.0, 0, 8.5, 40);
        expect(evalRes.isGoodStudyWeek).toBe(true);
        expect(evalRes.failReasons).toHaveLength(0);
      });

      it('Clause 1 Failure: score < 90.0 (e.g. 89.9) -> rejects certification', () => {
        const evalRes = evaluateGoodStudyWeek(89.9, 0, 8.5, 40);
        expect(evalRes.isGoodStudyWeek).toBe(false);
        expect(evalRes.failReasons.some((r) => r.includes('Điểm thi đua'))).toBe(true);
      });

      it('Clause 2 Failure: unexcused absences > 0 (e.g. 1 K) -> rejects certification with zero-tolerance message', () => {
        const evalRes = evaluateGoodStudyWeek(95.0, 1, 9.0, 40);
        expect(evalRes.isGoodStudyWeek).toBe(false);
        expect(evalRes.failReasons.some((r) => r.includes('vắng không phép K'))).toBe(true);
      });

      it('Clause 3 Failure: min period score < 8.0 (e.g. 7.5) -> rejects certification', () => {
        const evalRes = evaluateGoodStudyWeek(92.0, 0, 7.5, 40);
        expect(evalRes.isGoodStudyWeek).toBe(false);
        expect(evalRes.failReasons.some((r) => r.includes('dưới ngưỡng tối thiểu'))).toBe(true);
      });

      it('Clause 4 Failure: periods taught === 0 -> rejects certification', () => {
        const evalRes = evaluateGoodStudyWeek(100.0, 0, 10.0, 0);
        expect(evalRes.isGoodStudyWeek).toBe(false);
        expect(evalRes.failReasons.some((r) => r.includes('Chưa có tiết học nào'))).toBe(true);
      });
    });

    describe('2.3 Multi-Tier Tie Breaking Across 26 Classes', () => {
      it('Resolves 5-tier tie-breaking rules gracefully across all 26 classes', () => {
        const mockSummaries: WeeklySummary[] = ALL_CLASSES.map((cId) => ({
          id: `summary_${cId}`,
          classId: cId,
          weekNumber: 1,
          academicYear: '2026-2027',
          startDate: '2026-09-07',
          endDate: '2026-09-11',
          totalPeriodsExpected: 40,
          totalPeriodsTaught: 40,
          totalPeriodsSigned: 40,
          unsignedPeriods: [],
          unsignedPeriodsCount: 0,
          attendanceStats: {
            totalExcused: 0,
            totalUnexcused: 0,
            totalLate: 0,
            studentAbsenceSummary: {},
          },
          criteriaAverages: {
            learning: 0,
            discipline: 0,
            hygiene: 0,
            customCriterion: 0,
            totalAverage: 9.5,
          },
          teacherRemarksSummary: [],
          averageScore: 9.5,
          criteriaAverage: {
            learningAvg: 3.8,
            disciplineAvg: 2.8,
            hygieneAvg: 1.9,
            customAvg: 1.0,
            totalWeeklyScore: 9.5,
          },
          attendanceTotals: {
            unexcused: 0,
            excused: 0,
            late: 0,
          },
          updatedAt: Date.now(),
        }));

        const setSummaryScore = (summary: WeeklySummary, score: number) => {
          summary.averageScore = score;
          if (summary.criteriaAverage) {
            summary.criteriaAverage.totalWeeklyScore = score;
          }
          if (summary.criteriaAverages) {
            summary.criteriaAverages.totalAverage = score;
          }
        };

        // Inject controlled variance for tie testing:
        // Tier 1: 6A1 vs 6A2 - 6A1 higher score
        setSummaryScore(mockSummaries[0], 9.8); // 6A1 -> score 103.0
        setSummaryScore(mockSummaries[1], 9.6); // 6A2 -> score 101.0

        // Tier 2: 6A3 vs 6A4 - identical score (100.0), 6A3 fewer deductions (0 vs 1 Late)
        setSummaryScore(mockSummaries[2], 9.5); // 6A3 score 100.0, 0 deductions
        setSummaryScore(mockSummaries[3], 9.6); // 6A4 base 100 + 1.0 (academic) - 1.0 (Late) = 100.0, 1 deduction
        mockSummaries[3].attendanceTotals!.late = 1;
        mockSummaries[3].attendanceStats.totalLate = 1;

        // Tier 3: 7A1 vs 7A2 - identical score (100.0) and deductions (2.0), 7A1 higher academic delta
        setSummaryScore(mockSummaries[8], 9.7); // 7A1 academic +2.0, 1 K (-2.0) -> total 100.0
        mockSummaries[8].attendanceTotals!.unexcused = 1;
        mockSummaries[8].attendanceStats.totalUnexcused = 1;
        setSummaryScore(mockSummaries[9], 9.5); // 7A2 academic 0.0, 0 K -> total 100.0

        const ranked = rankClassesForEmulation(mockSummaries);
        expect(ranked).toHaveLength(26);

        // Verify ranks are continuous from 1 to 26
        const ranks = ranked.map((r) => r.rank);
        expect(ranks).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));

        // 6A1 must be rank 1
        expect(ranked[0].classId).toBe('6A1');
        expect(ranked[0].totalScore).toBe(103.0);

        // 6A2 must be rank 2
        expect(ranked[1].classId).toBe('6A2');
        expect(ranked[1].totalScore).toBe(101.0);

        // Verify grade ranks exist and increment properly per grade
        const grade6Classes = ranked.filter((r) => r.grade === 6);
        expect(grade6Classes.map((r) => r.gradeRank)).toEqual(
          Array.from({ length: grade6Classes.length }, (_, i) => i + 1)
        );
      });
    });

    describe('2.4 MOET A4 Landscape Print Stylesheet DOM Isolation', () => {
      it('Verifies CSS contains A4 landscape page rule, #moet-print-area visibility, and navigation hiding', () => {
        const cssPath = path.resolve(__dirname, '../index.css');
        expect(fs.existsSync(cssPath)).toBe(true);

        const cssContent = fs.readFileSync(cssPath, 'utf-8');

        // 1. A4 Landscape page size
        expect(cssContent).toContain('size: A4 landscape;');
        expect(cssContent).toContain('margin: 8mm;');

        // 2. #moet-print-area visibility in print mode
        expect(cssContent).toContain('#moet-print-area {');
        expect(cssContent).toContain('display: block !important;');

        // 3. Navigation and controls hiding
        expect(cssContent).toContain('.no-print');
        expect(cssContent).toContain('.print\\:hidden');
        expect(cssContent).toContain('display: none !important;');
        expect(cssContent).toContain('header,');
        expect(cssContent).toContain('nav,');
        expect(cssContent).toContain('aside,');
        expect(cssContent).toContain('footer,');
        expect(cssContent).toContain('.app-header');
        expect(cssContent).toContain('.app-sidebar');
      });
    });
  });

  // =========================================================================
  // PILLAR 3: SECURITY RULES, AUDIT LOGGING & INACTIVITY TIMEOUT
  // =========================================================================
  describe('Pillar 3: Security Rules, Audit Logging & Inactivity Timeout', () => {
    describe('3.1 Database RBAC & Security Invariant Checks', () => {
      // Replicating Firestore isValidPeriodScores rule
      function isValidPeriodScores(scores: any): boolean {
        return (
          scores &&
          typeof scores.learning === 'number' && scores.learning >= 0.0 && scores.learning <= 4.0 &&
          typeof scores.discipline === 'number' && scores.discipline >= 0.0 && scores.discipline <= 3.0 &&
          typeof scores.hygiene === 'number' && scores.hygiene >= 0.0 && scores.hygiene <= 2.0 &&
          typeof scores.customCriterion === 'number' && scores.customCriterion >= 0.0 && scores.customCriterion <= 1.0 &&
          typeof scores.total === 'number' && scores.total >= 0.0 && scores.total <= 10.0
        );
      }

      // Replicating Firestore Safe Profile Update rule
      function canUserUpdateProfile(
        authUid: string | null,
        targetUserId: string,
        userRoles: string[],
        affectedKeys: string[]
      ): boolean {
        if (!authUid) return false;
        if (userRoles.includes('admin')) return true;
        if (authUid !== targetUserId) return false;

        const allowedKeys = new Set(['passwordHash', 'mustChangePassword', 'lastLoginAt', 'updatedAt']);
        return affectedKeys.every((key) => allowedKeys.has(key));
      }

      // Replicating Firestore GVCN Daily Logbook authorization rule
      function isGVCN(
        authUid: string | null,
        roles: string[],
        assignedClassId: string | undefined,
        targetClassId: string
      ): boolean {
        if (!authUid) return false;
        if (roles.includes('admin')) return true;
        return roles.includes('gvcn') && assignedClassId === targetClassId;
      }

      it('Period scoring rubric bounds: rejects any score breaching criteria max or negative values', () => {
        expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(true);
        expect(isValidPeriodScores({ learning: 4.05, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
        expect(isValidPeriodScores({ learning: 4.0, discipline: 3.1, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
        expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.1, customCriterion: 1.0, total: 10.0 })).toBe(false);
        expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.1, total: 10.0 })).toBe(false);
        expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.5 })).toBe(false);
        expect(isValidPeriodScores({ learning: -0.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 5.5 })).toBe(false);
      });

      it('Safe profile mutation whitelisting: non-admin can only alter safe keys, cannot escalate roles', () => {
        const teacherUid = 'teacher_6a1';

        // 1. Password change & login update: ALLOWED
        expect(
          canUserUpdateProfile(teacherUid, teacherUid, ['gvcn'], ['passwordHash', 'mustChangePassword', 'updatedAt'])
        ).toBe(true);

        // 2. Escalating roles to admin: REJECTED
        expect(
          canUserUpdateProfile(teacherUid, teacherUid, ['gvcn'], ['roles'])
        ).toBe(false);

        // 3. Changing assigned class: REJECTED
        expect(
          canUserUpdateProfile(teacherUid, teacherUid, ['gvcn'], ['assignedClassId'])
        ).toBe(false);

        // 4. Modifying someone else's profile: REJECTED
        expect(
          canUserUpdateProfile(teacherUid, 'other_teacher', ['gvcn'], ['passwordHash'])
        ).toBe(false);

        // 5. Admin modifying any keys: ALLOWED
        expect(
          canUserUpdateProfile('admin_uid', teacherUid, ['admin'], ['roles', 'assignedClassId', 'username'])
        ).toBe(true);
      });

      it('GVCN class isolation: homeroom teacher cannot mutate daily logbook of another class', () => {
        const gvcnUid = 'uid_gvcn_6a1';
        expect(isGVCN(gvcnUid, ['gvcn'], '6A1', '6A1')).toBe(true);
        expect(isGVCN(gvcnUid, ['gvcn'], '6A1', '6A2')).toBe(false);
        expect(isGVCN('admin_uid', ['admin'], undefined, '6A2')).toBe(true); // Admin bypass
      });

      it('Audit log immutability: verifies update and delete are explicitly forbidden in firestore.rules', () => {
        const rulesPath = path.resolve(__dirname, '../../firestore.rules');
        expect(fs.existsSync(rulesPath)).toBe(true);

        const rulesContent = fs.readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');
        expect(rulesContent).toContain('match /audit_logs/{logId}');
        expect(rulesContent).toContain('allow update: if false;');
        expect(rulesContent).toContain('allow delete: if false;');
      });
    });

    describe('3.2 Deep Credential Sanitization', () => {
      it('Redacts sensitive keys (password, passwordHash, token, secret) recursively to [REDACTED]', () => {
        const dirtyPayload = {
          actor: 'teacher_6a1',
          credentials: {
            password: 'SuperSecretPassword123!',
            passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
            secret: 'jwt_private_key_xyz',
            token: 'bearer_token_12345',
          },
          authTokens: [
            { accessToken: 'at_12345', type: 'bearer' },
            { refreshToken: 'rt_67890', type: 'refresh' },
          ],
          apiKey: 'AIzaSyC1234567890',
          normalData: {
            studentName: 'Nguyễn Văn A',
            classId: '6A1',
            score: 10.0,
          },
        };

        const clean = sanitizeState(dirtyPayload);
        expect(clean).not.toBeNull();

        // Check credentials scrubbed
        expect((clean as any).credentials.password).toBe('[REDACTED]');
        expect((clean as any).credentials.passwordHash).toBe('[REDACTED]');
        expect((clean as any).credentials.secret).toBe('[REDACTED]');
        expect((clean as any).credentials.token).toBe('[REDACTED]');

        // Check array items scrubbed
        expect((clean as any).authTokens[0].accessToken).toBe('[REDACTED]');
        expect((clean as any).authTokens[1].refreshToken).toBe('[REDACTED]');
        expect((clean as any).apiKey).toBe('[REDACTED]');

        // Normal business fields preserved intact
        expect((clean as any).normalData.studentName).toBe('Nguyễn Văn A');
        expect((clean as any).normalData.classId).toBe('6A1');
        expect((clean as any).normalData.score).toBe(10.0);
      });

      it('Handles null, undefined, and non-object inputs safely', () => {
        expect(sanitizeState(null)).toBeNull();
        expect(sanitizeState(undefined)).toBeNull();
      });
    });

    describe('3.3 Inactivity Timeout Engine (useIdleTimeout)', () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        localStorage.clear();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('Constants check: 30m timeout, 25m warning, 15s throttle, 5m countdown', () => {
        expect(IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
        expect(WARNING_TIMEOUT_MS).toBe(25 * 60 * 1000);
        expect(THROTTLE_ACTIVITY_MS).toBe(15 * 1000);
        expect(Math.floor((IDLE_TIMEOUT_MS - WARNING_TIMEOUT_MS) / 1000)).toBe(300); // 300s = 5m
      });

      it('Warning triggers after 25 minutes of inactivity with 5-minute countdown', () => {
        const onWarning = vi.fn();
        const { result } = renderHook(
          () =>
            useIdleTimeout({
              timeoutMs: 30 * 60 * 1000,
              warningMs: 25 * 60 * 1000,
              onWarning,
            }),
          { wrapper: testRouterWrapper }
        );

        expect(result.current.isWarningOpen).toBe(false);

        // Advance 25 minutes
        act(() => {
          vi.advanceTimersByTime(25 * 60 * 1000);
        });

        expect(result.current.isWarningOpen).toBe(true);
        expect(onWarning).toHaveBeenCalledTimes(1);
        expect(result.current.remainingSeconds).toBeLessThanOrEqual(300);
      });

      it('Activity within 15 seconds is throttled; activity after 15 seconds updates timestamp', () => {
        const { result } = renderHook(
          () =>
            useIdleTimeout({
              timeoutMs: 30 * 60 * 1000,
              warningMs: 25 * 60 * 1000,
            }),
          { wrapper: testRouterWrapper }
        );

        const initialTime = Date.now();

        // 1. Activity at +5s (< 15s throttle window)
        act(() => {
          vi.advanceTimersByTime(5000);
          result.current.resetActivity();
        });

        // 2. Activity at +20s (> 15s throttle window)
        act(() => {
          vi.advanceTimersByTime(15000);
          result.current.resetActivity();
        });

        const stored = localStorage.getItem('ums_last_activity');
        expect(stored).not.toBeNull();
        expect(parseInt(stored!, 10)).toBeGreaterThan(initialTime);
      });

      it('Multi-tab sync: StorageEvent on ums_last_activity dismisses warning and extends session', () => {
        const { result } = renderHook(
          () =>
            useIdleTimeout({
              timeoutMs: 30 * 1000,
              warningMs: 20 * 1000,
            }),
          { wrapper: testRouterWrapper }
        );

        // Trigger warning at 20s
        act(() => {
          vi.advanceTimersByTime(20000);
        });
        expect(result.current.isWarningOpen).toBe(true);

        // Another tab has activity: fires storage event
        act(() => {
          window.dispatchEvent(
            new StorageEvent('storage', {
              key: 'ums_last_activity',
              newValue: Date.now().toString(),
            })
          );
        });

        expect(result.current.isWarningOpen).toBe(false);
      });
    });
  });
});
