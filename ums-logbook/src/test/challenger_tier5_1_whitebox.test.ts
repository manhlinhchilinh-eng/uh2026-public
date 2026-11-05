/**
 * CHALLENGER TIER 5_1 WHITE-BOX ADVERSARIAL TEST SUITE
 * Milestone: Final Milestone Phase 2 Adversarial Coverage Hardening
 * File: src/test/challenger_tier5_1_whitebox.test.ts
 *
 * Empirical verification of:
 * 1. Subcollection & State Concurrency (parallel period writes, status transitions, localStorage dual-persistence)
 * 2. 4-Criteria Rubric Mathematics (step 0.5, float precision, boundary values, dynamic 4th criterion)
 * 3. Two-Tier Attendance & Early Warning Engine (matrix edge cases, 2 vs 3 thresholds, P & Late immunity, deduplication)
 * 4. Author Attribution & Role Perspectives (TPT/GVCN/GVBM/Admin role badges, dual-role context switching, non-forgeability, timestamps)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePeriodScore,
  getOrCreateDailyLogbook,
  getPeriodEntries,
  savePeriodEntry,
  updateAttendanceBaseline,
  calculateDailyScoreSummary,
  getMockDailyLogbooks,
  getMockPeriodEntries,
  MOCK_DAILY_LOGBOOKS_KEY,
} from '../services/logbookService';
import {
  calculatePeriodTotal,
  getPeriodRating,
  validateScores,
  DEFAULT_SCORING_CONFIG,
  ScoringConfig,
} from '../utils/scoring';
import {
  evaluateEarlyWarnings,
  parseDateString,
} from '../utils/earlyWarning';
import {
  createBehaviorNote,
} from '../services/behaviorService';
import {
  DailyAttendanceBaseline,
} from '../types/logbook';
import { UserProfile } from '../types/auth';
import { StudentDoc, BehaviorNote } from '../types';
import { AbsenceEvent } from '../types/earlyWarning';

describe('CHALLENGER TIER 5_1: White-Box Adversarial Stress Suite', () => {
  const CLASS_ID = '9A3';
  const DATE_STR = '2026-10-15';
  const DAILY_ID = `${CLASS_ID}_${DATE_STR}`;

  beforeEach(() => {
    localStorage.clear();
  });

  // =========================================================================
  // SECTION 1: Subcollection & State Concurrency
  // =========================================================================
  describe('1. Subcollection & State Concurrency', () => {
    it('1.1 simulates rapid asynchronous parallel updates across periods 1 to 8 without cross-period contamination', async () => {
      await getOrCreateDailyLogbook(CLASS_ID, DATE_STR, 'mrlinhums');

      const periodConfigs = [
        { period: 1, subject: 'Toán học', teacher: 'Nguyễn Mạnh Linh', id: 'mrlinhums', learning: 4.0, disc: 3.0, hyg: 2.0, cust: 1.0 },
        { period: 2, subject: 'Ngữ văn', teacher: 'Nguyễn Phương Minh Hạnh', id: 'msthanhhuyenums', learning: 3.5, disc: 2.5, hyg: 2.0, cust: 0.5 },
        { period: 3, subject: 'Tiếng Anh', teacher: 'Đinh Trung Vy', id: 'mrdatums', learning: 3.0, disc: 3.0, hyg: 1.5, cust: 1.0 },
        { period: 4, subject: 'Vật lý', teacher: 'Phạm Hải Yến', id: 'msthaoums', learning: 4.0, disc: 2.5, hyg: 2.0, cust: 0.5 },
        { period: 5, subject: 'Hóa học', teacher: 'Lâm Phương Quân', id: 'mrhuyums', learning: 3.5, disc: 3.0, hyg: 2.0, cust: 1.0 },
        { period: 6, subject: 'Lịch sử', teacher: 'Dương Trung Hoài Châm', id: 'mshuonglyums', learning: 3.0, disc: 2.0, hyg: 2.0, cust: 0.5 },
        { period: 7, subject: 'Địa lý', teacher: 'Bùi Bảo Cường', id: 'mshueums', learning: 4.0, disc: 3.0, hyg: 1.5, cust: 0.5 },
        { period: 8, subject: 'Thể dục', teacher: 'Bùi Hoài Khánh Châm', id: 'msgiangums', learning: 3.5, disc: 3.0, hyg: 2.0, cust: 0.5 },
      ];

      // Execute all 8 period updates concurrently
      const promises = periodConfigs.map((cfg) =>
        savePeriodEntry(
          DAILY_ID,
          cfg.period,
          {
            subject: cfg.subject,
            lessonTopic: `Bài học tiết ${cfg.period}`,
            teacherId: cfg.id,
            teacherName: cfg.teacher,
            scores: {
              learning: cfg.learning,
              discipline: cfg.disc,
              hygiene: cfg.hyg,
              customCriterion: cfg.cust,
              total: cfg.learning + cfg.disc + cfg.hyg + cfg.cust,
            },
            teacherComment: `Nhận xét tiết ${cfg.period}`,
            teacherSignature: cfg.teacher,
          },
          true
        )
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(8);

      // Verify each stored period has exact non-contaminated data
      const storedEntries = await getPeriodEntries(DAILY_ID);
      expect(storedEntries).toHaveLength(8);

      for (const cfg of periodConfigs) {
        const entry = storedEntries.find((e) => e.periodIndex === cfg.period);
        expect(entry).toBeDefined();
        expect(entry!.subject).toBe(cfg.subject);
        expect(entry!.teacherName).toBe(cfg.teacher);
        expect(entry!.teacherId).toBe(cfg.id);
        expect(entry!.lessonTopic).toBe(`Bài học tiết ${cfg.period}`);
        expect(entry!.scores.learning).toBe(cfg.learning);
        expect(entry!.scores.discipline).toBe(cfg.disc);
        expect(entry!.scores.hygiene).toBe(cfg.hyg);
        expect(entry!.scores.customCriterion).toBe(cfg.cust);
        expect(entry!.isSigned).toBe(true);
      }
    });

    it('1.2 handles rapid succession writes to the same period cleanly with last-write-wins and no JSON corruption', async () => {
      await getOrCreateDailyLogbook(CLASS_ID, DATE_STR, 'mrlinhums');

      // Update period 3 three times in rapid succession
      await savePeriodEntry(DAILY_ID, 3, {
        subject: 'Toán ban đầu',
        lessonTopic: 'Chủ đề 1',
        scores: { learning: 2.0, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5, total: 5.5 },
      });

      await savePeriodEntry(DAILY_ID, 3, {
        subject: 'Toán cập nhật',
        lessonTopic: 'Chủ đề 2',
        scores: { learning: 3.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 9.5 },
      });

      const finalEntry = await savePeriodEntry(
        DAILY_ID,
        3,
        {
          subject: 'Toán chính thức',
          lessonTopic: 'Hệ phương trình',
          teacherName: 'Thầy Linh',
          scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
        },
        true
      );

      expect(finalEntry.subject).toBe('Toán chính thức');
      expect(finalEntry.lessonTopic).toBe('Hệ phương trình');
      expect(finalEntry.scores.total).toBe(10.0);
      expect(finalEntry.isSigned).toBe(true);

      const entries = await getPeriodEntries(DAILY_ID);
      const p3 = entries.find((e) => e.periodIndex === 3);
      expect(p3?.subject).toBe('Toán chính thức');
      expect(p3?.scores.total).toBe(10.0);
    });

    it('1.3 transitions daily logbook status to completed and isCompleted=true when all 8 periods are signed', async () => {
      await getOrCreateDailyLogbook(CLASS_ID, DATE_STR, 'mrlinhums');

      // Sign periods 1 to 7
      for (let p = 1; p <= 7; p++) {
        await savePeriodEntry(
          DAILY_ID,
          p,
          {
            subject: `Môn ${p}`,
            scores: { learning: 3.0, discipline: 2.0, hygiene: 1.5, customCriterion: 0.5, total: 7.0 },
          },
          true
        );
      }

      let books = getMockDailyLogbooks();
      let currentBook = books.find((b) => b.id === DAILY_ID);
      expect(currentBook?.isCompleted).toBe(false);
      expect(currentBook?.status).toBe('in_progress');

      // Sign 8th period
      await savePeriodEntry(
        DAILY_ID,
        8,
        {
          subject: 'Môn 8',
          scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
        },
        true
      );

      books = getMockDailyLogbooks();
      currentBook = books.find((b) => b.id === DAILY_ID);
      expect(currentBook?.isCompleted).toBe(true);
      expect(currentBook?.status).toBe('completed');
    });

    it('1.4 survives a 40-operation rapid mutation storm across arbitrary periods without index desynchronization', async () => {
      await getOrCreateDailyLogbook(CLASS_ID, DATE_STR, 'mrlinhums');

      const operations = Array.from({ length: 40 }, (_, idx) => {
        const periodIndex = (idx % 8) + 1;
        return savePeriodEntry(DAILY_ID, periodIndex, {
          subject: `Môn ${periodIndex} (rev ${idx})`,
          lessonTopic: `Bài số ${idx}`,
          scores: { learning: 3.0, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5, total: 6.5 },
        });
      });

      await Promise.all(operations);

      const entries = await getPeriodEntries(DAILY_ID);
      expect(entries).toHaveLength(8);
      // All 8 period indices must be strictly 1 through 8 in order
      for (let i = 1; i <= 8; i++) {
        expect(entries[i - 1].periodIndex).toBe(i);
      }
    });

    it('1.5 dual-persistence fallback: updates morning and afternoon baselines independently without wiping data', async () => {
      await getOrCreateDailyLogbook(CLASS_ID, DATE_STR, 'mrlinhums');

      const morningBaseline: DailyAttendanceBaseline = {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        session: 'morning',
        absences: [
          { studentId: '233001', studentName: 'Hoàng Nhật Minh', type: 'P', note: 'Khám bệnh' },
          { studentId: '233002', studentName: 'Phạm Thu Kiên', type: 'K', note: 'Không phép' },
        ],
        earlyDepartures: [],
      };

      await updateAttendanceBaseline(DAILY_ID, 'morning', morningBaseline);

      let book = await getOrCreateDailyLogbook(CLASS_ID, DATE_STR);
      expect(book.morningBaseline?.absences).toHaveLength(2);
      expect(book.preSessionAttendance?.absences).toHaveLength(2);

      const afternoonBaseline: DailyAttendanceBaseline = {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        session: 'afternoon',
        absences: [
          { studentId: '233003', studentName: 'Trần Bảo Ngọc', type: 'Late', note: 'Muộn 15p' },
        ],
        earlyDepartures: [
          { studentId: '233004', studentName: 'Lê Duy Anh', departedAt: '15:30', reason: 'Về sớm chăm bà' },
        ],
      };

      await updateAttendanceBaseline(DAILY_ID, 'afternoon', afternoonBaseline);

      book = await getOrCreateDailyLogbook(CLASS_ID, DATE_STR);
      // Morning baseline must remain intact
      expect(book.morningBaseline?.absences).toHaveLength(2);
      expect(book.morningBaseline?.absences[0].studentName).toBe('Hoàng Nhật Minh');
      // Afternoon baseline must now be populated
      expect(book.afternoonBaseline?.absences).toHaveLength(1);
      expect(book.afternoonBaseline?.earlyDepartures).toHaveLength(1);
    });

    it('1.6 auto-creates parent DailyLogbook document when updateAttendanceBaseline is called for an uninitialized date', async () => {
      const freshDailyId = '7A1_2026-11-20';
      const baseline: DailyAttendanceBaseline = {
        reportedBy: 'msthaoums',
        reportedAt: Date.now(),
        session: 'morning',
        absences: [{ studentId: '259970', studentName: 'Nguyễn An', type: 'P' }],
        earlyDepartures: [],
      };

      await updateAttendanceBaseline(freshDailyId, 'morning', baseline);

      const books = getMockDailyLogbooks();
      const createdBook = books.find((b) => b.id === freshDailyId);
      expect(createdBook).toBeDefined();
      expect(createdBook?.classId).toBe('7A1');
      expect(createdBook?.morningBaseline?.absences).toHaveLength(1);
    });

    it('1.7 slot padding: getPeriodEntries returns 8 period entries with defaults for unsaved slots', async () => {
      const uninitializedId = '8A2_2026-12-01';
      const entries = await getPeriodEntries(uninitializedId);

      expect(entries).toHaveLength(8);
      entries.forEach((e, idx) => {
        expect(e.periodIndex).toBe(idx + 1);
        expect(e.dailyId).toBe(uninitializedId);
        expect(e.isSigned).toBe(false);
        expect(e.scores.total).toBe(0);
        expect(e.subject).toBe('');
      });
    });

    it('1.8 dual-persistence resilience: handles corrupted JSON in localStorage gracefully without throwing uncaught error', () => {
      localStorage.setItem(MOCK_DAILY_LOGBOOKS_KEY, '{invalid_json}');
      const books = getMockDailyLogbooks();
      expect(books).toEqual([]);

      localStorage.setItem(`ums_period_entries_${DAILY_ID}`, '{"malformed');
      const periods = getMockPeriodEntries(DAILY_ID);
      expect(periods).toEqual([]);
    });
  });

  // =========================================================================
  // SECTION 2: 4-Criteria Rubric Mathematics
  // =========================================================================
  describe('2. 4-Criteria Rubric Mathematics', () => {
    it('2.1 validates step 0.5 increments across all criteria without error', () => {
      const steps = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
      for (const step of steps) {
        if (step <= 4.0) {
          const res = validateScores({
            learning: step,
            discipline: 0.0,
            hygiene: 0.0,
            customCriterion: 0.0,
          });
          expect(res.learning).toBe(step);
        }
        if (step <= 3.0) {
          const res = validateScores({
            learning: 0.0,
            discipline: step,
            hygiene: 0.0,
            customCriterion: 0.0,
          });
          expect(res.discipline).toBe(step);
        }
        if (step <= 2.0) {
          const res = validateScores({
            learning: 0.0,
            discipline: 0.0,
            hygiene: step,
            customCriterion: 0.0,
          });
          expect(res.hygiene).toBe(step);
        }
        if (step <= 1.0) {
          const res = validateScores({
            learning: 0.0,
            discipline: 0.0,
            hygiene: 0.0,
            customCriterion: step,
          });
          expect(res.customCriterion).toBe(step);
        }
      }
    });

    it('2.2 resolves binary floating-point rounding traps accurately to 2 decimal places', () => {
      // 0.1 + 0.2 in JS gives 0.30000000000000004
      expect(0.1 + 0.2).not.toBe(0.3);
      expect(calculatePeriodTotal(0.1, 0.2, 0.0, 0.0)).toBe(0.3);

      // 1.4 + 2.8 + 1.9 + 0.9 = 7.0
      expect(calculatePeriodTotal(1.4, 2.8, 1.9, 0.9)).toBe(7.0);

      // Precision test in validatePeriodScore
      const res = validatePeriodScore({
        learning: 3.7,
        discipline: 2.9,
        hygiene: 1.8,
        customCriterion: 0.9,
      });
      expect(res.isValid).toBe(true);
      expect(res.total).toBe(9.3);
    });

    it('2.3 evaluates boundary minimum (0.0) and maximum (10.0) with correct rating tiers', () => {
      // Minimum
      const minRes = validateScores({ learning: 0, discipline: 0, hygiene: 0, customCriterion: 0 });
      expect(minRes.total).toBe(0.0);
      expect(getPeriodRating(minRes.total).level).toBe('YEU');

      // Maximum
      const maxRes = validateScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0 });
      expect(maxRes.total).toBe(10.0);
      expect(getPeriodRating(maxRes.total).level).toBe('TOT');
    });

    it('2.4 validates exact MOET period rating classification thresholds', () => {
      // >= 8.5 -> TOT
      expect(getPeriodRating(10.0).level).toBe('TOT');
      expect(getPeriodRating(8.5).level).toBe('TOT');

      // 6.5 to < 8.5 -> KHA
      expect(getPeriodRating(8.49).level).toBe('KHA');
      expect(getPeriodRating(6.5).level).toBe('KHA');

      // 5.0 to < 6.5 -> TRUNG_BINH
      expect(getPeriodRating(6.49).level).toBe('TRUNG_BINH');
      expect(getPeriodRating(5.0).level).toBe('TRUNG_BINH');

      // < 5.0 -> YEU
      expect(getPeriodRating(4.99).level).toBe('YEU');
      expect(getPeriodRating(0.0).level).toBe('YEU');
    });

    it('2.5 rejects negative inputs and clamps normalized scores safely', () => {
      expect(() =>
        validateScores({ learning: -0.5, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5 })
      ).toThrowError(/SCORE_NEGATIVE_VALUE/);

      const res = validatePeriodScore({
        learning: -1.0,
        discipline: -0.001,
        hygiene: 2.0,
        customCriterion: 0.5,
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.learning).toBeDefined();
      expect(res.errors.discipline).toBeDefined();
      expect(res.normalizedScores.learning).toBe(0);
      expect(res.normalizedScores.discipline).toBe(0);
    });

    it('2.6 rejects non-numeric or NaN scores', () => {
      expect(() =>
        validateScores({ learning: NaN, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5 })
      ).toThrowError(/SCORE_NON_NUMERIC/);

      expect(() =>
        validateScores({ learning: '4.0' as any, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5 })
      ).toThrowError(/SCORE_NON_NUMERIC/);
    });

    it('2.7 rejects out-of-bounds combinations: individual ceiling exceed and total ceiling exceed', () => {
      // Individual exceed
      expect(() =>
        validateScores({ learning: 4.1, discipline: 3.0, hygiene: 2.0, customCriterion: 0.9 })
      ).toThrowError(/SCORE_EXCEEDS_MAX/);

      expect(() =>
        validateScores({ learning: 4.0, discipline: 3.5, hygiene: 2.0, customCriterion: 0.5 })
      ).toThrowError(/SCORE_EXCEEDS_MAX/);

      // Total exceed when customMax is configured higher
      const expandedConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        customMax: 2.0,
      };
      expect(() =>
        validateScores(
          { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.5 },
          expandedConfig
        )
      ).toThrowError(/SCORE_TOTAL_EXCEEDS_10/);
    });

    it('2.8 handles dynamic 4th criterion: zero customMax, expanded customMax, and omitted field fallback', () => {
      // Disabled 4th criterion (customMax = 0)
      const disabledConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        customMax: 0.0,
      };
      const validZero = validateScores(
        { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 0.0 },
        disabledConfig
      );
      expect(validZero.customCriterion).toBe(0.0);
      expect(validZero.total).toBe(9.0);

      expect(() =>
        validateScores(
          { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 0.5 },
          disabledConfig
        )
      ).toThrowError(/SCORE_EXCEEDS_MAX/);

      // Omitted custom criterion in validatePeriodScore defaults to 0
      const partialRes = validatePeriodScore({
        learning: 3.5,
        discipline: 2.5,
        hygiene: 1.5,
      });
      expect(partialRes.isValid).toBe(true);
      expect(partialRes.normalizedScores.customCriterion).toBe(0);
      expect(partialRes.total).toBe(7.5);
    });

    it('2.9 randomized stress test: 50 valid step-0.5 combinations consistently produce accurate totals <= 10.0', () => {
      for (let i = 0; i < 50; i++) {
        // Generate random 0.5-step numbers within bounds
        const l = Math.floor(Math.random() * 9) * 0.5; // 0..4.0
        const d = Math.floor(Math.random() * 7) * 0.5; // 0..3.0
        const h = Math.floor(Math.random() * 5) * 0.5; // 0..2.0
        const c = Math.floor(Math.random() * 3) * 0.5; // 0..1.0

        const calculated = calculatePeriodTotal(l, d, h, c);
        const expected = Math.round((l + d + h + c) * 100) / 100;
        expect(calculated).toBe(expected);

        if (calculated <= 10.0) {
          const res = validateScores({ learning: l, discipline: d, hygiene: h, customCriterion: c });
          expect(res.total).toBe(calculated);
        } else {
          expect(() =>
            validateScores({ learning: l, discipline: d, hygiene: h, customCriterion: c })
          ).toThrowError(/SCORE_TOTAL_EXCEEDS_10/);
        }
      }
    });
  });

  // =========================================================================
  // SECTION 3: Two-Tier Attendance & Early Warning Engine
  // =========================================================================
  describe('3. Two-Tier Attendance & Early Warning Engine', () => {
    const studentRoster: StudentDoc[] = [
      { id: 'student_9a3_01', mhs: '233001', stt: 1, name: 'Nguyễn Văn A', classId: '9A3', grade: 9, dob: '2012-01-01', gender: 'Nam', status: 'active', createdAt: Date.now() },
      { id: 'student_9a3_02', mhs: '233002', stt: 2, name: 'Trần Thị B', classId: '9A3', grade: 9, dob: '2012-02-02', gender: 'Nữ', status: 'active', createdAt: Date.now() },
      { id: 'student_9a3_03', mhs: '233003', stt: 3, name: 'Lê Văn C', classId: '9A3', grade: 9, dob: '2012-03-03', gender: 'Nam', status: 'active', createdAt: Date.now() },
    ];

    it('3.1 matrix edge case: student absent in morning baseline but marked present in period 1 retains distinct record tiers', async () => {
      await getOrCreateDailyLogbook(CLASS_ID, DATE_STR, 'mrlinhums');

      // GVCN reports student A absent (K) in morning baseline
      await updateAttendanceBaseline(DAILY_ID, 'morning', {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        session: 'morning',
        absences: [{ studentId: '233001', studentName: 'Nguyễn Văn A', type: 'K' }],
        earlyDepartures: [],
      });

      // Period 1 subject teacher notes no absent students (student A showed up)
      await savePeriodEntry(DAILY_ID, 1, {
        subject: 'Toán học',
        absentStudents: [], // Present in period 1
        scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
      });

      const book = await getOrCreateDailyLogbook(CLASS_ID, DATE_STR);
      const periods = await getPeriodEntries(DAILY_ID);

      // Baseline maintains morning absence
      expect(book.morningBaseline?.absences).toHaveLength(1);
      expect(book.morningBaseline?.absences[0].studentId).toBe('233001');

      // Period 1 maintains period attendance (empty absent list)
      expect(periods[0].absentStudents).toHaveLength(0);

      const summary = calculateDailyScoreSummary(book, periods);
      expect(summary.unexcusedCountK).toBe(1);
    });

    it('3.2 matrix edge case: student marked Late in baseline and leaves early at 15:30 calculates distinct counts', async () => {
      await getOrCreateDailyLogbook(CLASS_ID, DATE_STR, 'mrlinhums');

      await updateAttendanceBaseline(DAILY_ID, 'morning', {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        session: 'morning',
        absences: [{ studentId: '233002', studentName: 'Trần Thị B', type: 'Late', note: 'Đến muộn 07:45' }],
        earlyDepartures: [],
      });

      await updateAttendanceBaseline(DAILY_ID, 'afternoon', {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        session: 'afternoon',
        absences: [],
        earlyDepartures: [{ studentId: '233002', studentName: 'Trần Thị B', departedAt: '15:30', reason: 'Sốt cao' }],
      });

      const book = await getOrCreateDailyLogbook(CLASS_ID, DATE_STR);
      const periods = await getPeriodEntries(DAILY_ID);
      const summary = calculateDailyScoreSummary(book, periods);

      expect(summary.lateCount).toBe(1);
      expect(summary.earlyDepartureCount).toBe(1);
      expect(summary.unexcusedCountK).toBe(0);
      expect(summary.excusedCountP).toBe(0);
      expect(summary.totalAbsenceCount).toBe(0); // Only P + K count as full absences
    });

    it('3.3 verifies exact unexcused absence alert threshold: 2 K (no alert) vs 3 K (alert triggered)', () => {
      const refDate = '2026-10-10';

      // Case A: Exactly 2 unexcused absences
      const twoAbsences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: '233001', studentName: 'Nguyễn Văn A', classId: '9A3', type: 'K' },
        { date: '2026-10-06', studentId: '233001', studentName: 'Nguyễn Văn A', classId: '9A3', type: 'K' },
      ];
      const alertsA = evaluateEarlyWarnings(studentRoster, twoAbsences, [], { referenceDate: refDate });
      expect(alertsA.filter((a) => a.studentId === 'student_9a3_01')).toHaveLength(0);

      // Case B: Exactly 3 unexcused absences
      const threeAbsences: AbsenceEvent[] = [
        ...twoAbsences,
        { date: '2026-10-07', studentId: '233001', studentName: 'Nguyễn Văn A', classId: '9A3', type: 'K' },
      ];
      const alertsB = evaluateEarlyWarnings(studentRoster, threeAbsences, [], { referenceDate: refDate });
      const studentAlert = alertsB.find((a) => a.studentId === 'student_9a3_01');
      expect(studentAlert).toBeDefined();
      expect(studentAlert?.level).toBe('warning');
      expect(studentAlert?.reasons[0].type).toBe('unexcused_absences');
      expect(studentAlert?.reasons[0].count).toBe(3);
    });

    it('3.4 verifies exact negative behavior notes alert threshold: 2 notes (no alert) vs 3 notes (alert triggered)', () => {
      const refDate = '2026-10-10';

      const makeNote = (id: string, date: string): BehaviorNote => ({
        id,
        studentId: 'student_9a3_02',
        studentName: 'Trần Thị B',
        classId: '9A3',
        type: 'negative',
        category: 'Kỷ luật',
        content: 'Nói chuyện trong giờ',
        description: 'Nói chuyện trong giờ',
        authorId: 'mrlinhums',
        authorName: 'Thầy Linh',
        authorRole: 'gvbm',
        date,
        createdAt: parseDateString(date).getTime(),
        updatedAt: parseDateString(date).getTime(),
        timestamp: parseDateString(date).getTime(),
      });

      // Exactly 2 negative notes
      const twoNotes = [
        makeNote('note_1', '2026-10-05'),
        makeNote('note_2', '2026-10-06'),
      ];
      const alertsA = evaluateEarlyWarnings(studentRoster, [], twoNotes, { referenceDate: refDate });
      expect(alertsA.filter((a) => a.studentId === 'student_9a3_02')).toHaveLength(0);

      // Exactly 3 negative notes
      const threeNotes = [
        ...twoNotes,
        makeNote('note_3', '2026-10-07'),
      ];
      const alertsB = evaluateEarlyWarnings(studentRoster, [], threeNotes, { referenceDate: refDate });
      const alert = alertsB.find((a) => a.studentId === 'student_9a3_02');
      expect(alert).toBeDefined();
      expect(alert?.level).toBe('warning');
      expect(alert?.reasons[0].type).toBe('negative_notes');
      expect(alert?.reasons[0].count).toBe(3);
    });

    it('3.5 triggers critical compound alert when both 3 K absences and 3 negative notes are met', () => {
      const refDate = '2026-10-10';
      const threeAbsences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: '233003', studentName: 'Lê Văn C', classId: '9A3', type: 'K' },
        { date: '2026-10-06', studentId: '233003', studentName: 'Lê Văn C', classId: '9A3', type: 'K' },
        { date: '2026-10-07', studentId: '233003', studentName: 'Lê Văn C', classId: '9A3', type: 'K' },
      ];
      const threeNotes: BehaviorNote[] = [1, 2, 3].map((i) => ({
        id: `note_comp_${i}`,
        studentId: 'student_9a3_03',
        studentName: 'Lê Văn C',
        classId: '9A3',
        type: 'negative',
        category: 'Vi phạm',
        content: `Vi phạm ${i}`,
        description: `Vi phạm ${i}`,
        authorId: 'mrlinhums',
        authorName: 'Thầy Linh',
        authorRole: 'gvbm',
        date: `2026-10-0${4 + i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        timestamp: Date.now(),
      }));

      const alerts = evaluateEarlyWarnings(studentRoster, threeAbsences, threeNotes, { referenceDate: refDate });
      const alert = alerts.find((a) => a.studentId === 'student_9a3_03');
      expect(alert).toBeDefined();
      expect(alert?.level).toBe('critical');
      expect(alert?.reasons).toHaveLength(2);
    });

    it('3.6 proves strict false-positive immunity: P (excused) and Late absences NEVER trigger unexcused alert', () => {
      const refDate = '2026-10-10';

      const immuneAbsences: AbsenceEvent[] = [
        // 5 excused absences
        { date: '2026-10-04', studentId: '233001', classId: '9A3', type: 'P' },
        { date: '2026-10-05', studentId: '233001', classId: '9A3', type: 'P' },
        { date: '2026-10-06', studentId: '233001', classId: '9A3', type: 'P' },
        { date: '2026-10-07', studentId: '233001', classId: '9A3', type: 'P' },
        { date: '2026-10-08', studentId: '233001', classId: '9A3', type: 'P' },
        // 5 late records
        { date: '2026-10-04', studentId: '233001', classId: '9A3', type: 'Late' },
        { date: '2026-10-05', studentId: '233001', classId: '9A3', type: 'Late' },
        { date: '2026-10-06', studentId: '233001', classId: '9A3', type: 'Late' },
        { date: '2026-10-07', studentId: '233001', classId: '9A3', type: 'Late' },
        { date: '2026-10-08', studentId: '233001', classId: '9A3', type: 'Late' },
        // Exactly 2 unexcused absences
        { date: '2026-10-09', studentId: '233001', classId: '9A3', type: 'K' },
        { date: '2026-10-10', studentId: '233001', classId: '9A3', type: 'K' },
      ];

      const alerts = evaluateEarlyWarnings(studentRoster, immuneAbsences, [], { referenceDate: refDate });
      // Despite 12 total attendance incidents, K is only 2 -> NO ALERT
      expect(alerts).toHaveLength(0);
    });

    it('3.7 proves strict positive behavior note immunity: positive notes NEVER trigger disciplinary alert', () => {
      const refDate = '2026-10-10';

      const notes: BehaviorNote[] = [
        // 10 positive praise notes
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `pos_${i}`,
          studentId: 'student_9a3_01',
          studentName: 'Nguyễn Văn A',
          classId: '9A3',
          type: 'positive' as const,
          category: 'Khen ngợi',
          content: 'Học tập xuất sắc',
          description: 'Học tập xuất sắc',
          authorId: 'mrlinhums',
          authorName: 'Thầy Linh',
          authorRole: 'gvbm' as const,
          date: '2026-10-06',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        })),
        // Exactly 2 negative notes
        {
          id: 'neg_1',
          studentId: 'student_9a3_01',
          studentName: 'Nguyễn Văn A',
          classId: '9A3',
          type: 'negative' as const,
          category: 'Nhắc nhở',
          content: 'Quên vở',
          description: 'Quên vở',
          authorId: 'mrlinhums',
          authorName: 'Thầy Linh',
          authorRole: 'gvbm' as const,
          date: '2026-10-07',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'neg_2',
          studentId: 'student_9a3_01',
          studentName: 'Nguyễn Văn A',
          classId: '9A3',
          type: 'negative' as const,
          category: 'Nhắc nhở',
          content: 'Quên sách',
          description: 'Quên sách',
          authorId: 'mrlinhums',
          authorName: 'Thầy Linh',
          authorRole: 'gvbm' as const,
          date: '2026-10-08',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
      ];

      const alerts = evaluateEarlyWarnings(studentRoster, [], notes, { referenceDate: refDate });
      expect(alerts).toHaveLength(0);
    });

    it('3.8 excludes out-of-window violations: day 8 prior to reference date is strictly excluded', () => {
      const refDate = '2026-10-10'; // Window: [2026-10-04 .. 2026-10-10] (7 days)

      const absencesWithStaleEvent: AbsenceEvent[] = [
        { date: '2026-10-03', studentId: '233001', classId: '9A3', type: 'K' }, // Day 8 (out of window)
        { date: '2026-10-04', studentId: '233001', classId: '9A3', type: 'K' }, // Day 7 (in window)
        { date: '2026-10-05', studentId: '233001', classId: '9A3', type: 'K' }, // Day 6 (in window)
      ];

      const alerts = evaluateEarlyWarnings(studentRoster, absencesWithStaleEvent, [], { referenceDate: refDate });
      // Only 2 are within the 7-day window -> NO alert
      expect(alerts).toHaveLength(0);
    });

    it('3.9 verifies deduplicateAbsencesPerDay option: multiple period absences on same day count as 1 day when flag is on', () => {
      const refDate = '2026-10-10';
      // Student 1 has 3 K absences on the same date (periods 1, 2, 3)
      const sameDayAbsences: AbsenceEvent[] = [
        { date: '2026-10-08', periodIndex: 1, studentId: '233001', classId: '9A3', type: 'K' },
        { date: '2026-10-08', periodIndex: 2, studentId: '233001', classId: '9A3', type: 'K' },
        { date: '2026-10-08', periodIndex: 3, studentId: '233001', classId: '9A3', type: 'K' },
      ];

      // With deduplication ON: counts as 1 distinct day -> NO ALERT (1 < 3)
      const alertsDedup = evaluateEarlyWarnings(studentRoster, sameDayAbsences, [], {
        referenceDate: refDate,
        deduplicateAbsencesPerDay: true,
      });
      expect(alertsDedup).toHaveLength(0);

      // With deduplication OFF (default): counts as 3 events -> ALERT TRIGGERED
      const alertsNoDedup = evaluateEarlyWarnings(studentRoster, sameDayAbsences, [], {
        referenceDate: refDate,
        deduplicateAbsencesPerDay: false,
      });
      expect(alertsNoDedup).toHaveLength(1);
    });

    it('3.10 reconciles morning P and afternoon K absences across baselines in daily summary', async () => {
      await getOrCreateDailyLogbook(CLASS_ID, DATE_STR, 'mrlinhums');

      await updateAttendanceBaseline(DAILY_ID, 'morning', {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        session: 'morning',
        absences: [{ studentId: '233001', studentName: 'Nguyễn Văn A', type: 'P', note: 'Phép sáng' }],
        earlyDepartures: [],
      });

      await updateAttendanceBaseline(DAILY_ID, 'afternoon', {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        session: 'afternoon',
        absences: [{ studentId: '233002', studentName: 'Trần Thị B', type: 'K', note: 'Trốn chiều' }],
        earlyDepartures: [],
      });

      const book = await getOrCreateDailyLogbook(CLASS_ID, DATE_STR);
      const periods = await getPeriodEntries(DAILY_ID);
      const summary = calculateDailyScoreSummary(book, periods);

      expect(summary.excusedCountP).toBe(1);
      expect(summary.unexcusedCountK).toBe(1);
      expect(summary.totalAbsenceCount).toBe(2);
    });
  });

  // =========================================================================
  // SECTION 4: Author Attribution & Role Perspectives
  // =========================================================================
  describe('4. Author Attribution & Role Perspectives', () => {
    const tptUser: UserProfile = {
      uid: 'u_tpt',
      username: 'mrhoanglongums',
      email: 'mrhoanglongums@ums.edu.vn',
      displayName: 'Nguyễn Hoàng Long',
      roles: ['tpt'],
      mustChangePassword: false,
      createdAt: Date.now(),
    };

    const gvcnUser: UserProfile = {
      uid: 'u_gvcn_9a3',
      username: 'mrlinhums',
      email: 'mrlinhums@ums.edu.vn',
      displayName: 'Nguyễn Mạnh Linh',
      roles: ['gvcn'],
      assignedClassId: '9A3',
      mustChangePassword: false,
      createdAt: Date.now(),
    };

    const gvbmUser: UserProfile = {
      uid: 'u_gvbm_math',
      username: 'mrdatums',
      email: 'mrdatums@ums.edu.vn',
      displayName: 'Đinh Trung Vy',
      roles: ['gvbm'],
      mustChangePassword: false,
      createdAt: Date.now(),
    };

    const adminUser: UserProfile = {
      uid: 'u_admin',
      username: 'mshuyentrangums',
      email: 'mshuyentrangums@ums.edu.vn',
      displayName: 'Huyền Trang',
      roles: ['admin'],
      mustChangePassword: false,
      createdAt: Date.now(),
    };

    // Dual-role user: GVCN of 9A3, also acts as GVBM in other classes
    const dualRoleTeacher: UserProfile = {
      uid: 'u_dual',
      username: 'mrlinh_dual',
      email: 'mrlinh_dual@ums.edu.vn',
      displayName: 'Nguyễn Mạnh Linh (Dual)',
      roles: ['gvcn', 'gvbm'],
      assignedClassId: '9A3',
      mustChangePassword: false,
      createdAt: Date.now(),
    };

    it('4.1 derives authentic TPT authorRole and preserves full attribution across classes', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269029',
          studentName: 'Bùi Gia An',
          classId: '6A1', // TPT creates note for 6A1 (campus-wide)
          type: 'negative',
          category: 'Kỷ luật chung',
          content: 'Không sơ vin khi vào trường',
        },
        tptUser
      );

      expect(note.authorRole).toBe('tpt');
      expect(note.authorId).toBe('u_tpt');
      expect(note.authorName).toBe('Nguyễn Hoàng Long');
      expect(note.classId).toBe('6A1');
      expect(note.type).toBe('negative');
      expect(note.timestamp).toBeGreaterThan(0);
    });

    it('4.2 derives authentic GVCN authorRole for their assigned class', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '233001',
          studentName: 'Nguyễn Văn A',
          classId: '9A3',
          type: 'positive',
          category: 'Khen ngợi',
          content: 'Tích cực tham gia xây dựng bài',
        },
        gvcnUser
      );

      expect(note.authorRole).toBe('gvcn');
      expect(note.authorId).toBe('u_gvcn_9a3');
      expect(note.authorName).toBe('Nguyễn Mạnh Linh');
      expect(note.type).toBe('positive');
      expect(note.category).toBe('Khen ngợi');
    });

    it('4.3 derives authentic GVBM authorRole for subject teacher', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '233001',
          studentName: 'Nguyễn Văn A',
          classId: '9A3',
          periodIndex: 3,
          subject: 'Toán học',
          type: 'negative',
          category: 'Ý thức học tập',
          content: 'Không làm bài tập về nhà',
        },
        gvbmUser
      );

      expect(note.authorRole).toBe('gvbm');
      expect(note.periodIndex).toBe(3);
      expect(note.subject).toBe('Toán học');
    });

    it('4.4 derives authentic Admin authorRole', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '233001',
          studentName: 'Nguyễn Văn A',
          classId: '9A3',
          type: 'positive',
          category: 'Gương sáng',
          content: 'Nhặt được của rơi trả người đánh mất',
        },
        adminUser
      );

      expect(note.authorRole).toBe('admin');
      expect(note.authorName).toBe('Huyền Trang');
    });

    it('4.5 non-forgeability: derives role strictly from authorUser profile even if DTO attempts forgery', async () => {
      const maliciousDto: any = {
        studentId: '233001',
        classId: '9A3',
        type: 'positive',
        content: 'Nỗ lực học tập',
        authorRole: 'admin', // Attacker claims to be admin
      };

      const note = await createBehaviorNote(maliciousDto, gvbmUser);
      // System overrides forged role with authentic role
      expect(note.authorRole).toBe('gvbm');
      expect(note.authorRole).not.toBe('admin');
    });

    it('4.6 enforces mandatory password change gate before allowing note creation', async () => {
      const unverifiedUser: UserProfile = {
        ...gvcnUser,
        mustChangePassword: true, // Default password not yet changed
      };

      await expect(
        createBehaviorNote(
          {
            studentId: '233001',
            classId: '9A3',
            type: 'positive',
            content: 'Nỗ lực học tập',
          },
          unverifiedUser
        )
      ).rejects.toThrowError(/AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED/);
    });

    it('4.7 rejects empty or whitespace-only descriptions and invalid note types', async () => {
      await expect(
        createBehaviorNote(
          {
            studentId: '233001',
            classId: '9A3',
            type: 'positive',
            content: '   ',
          },
          gvcnUser
        )
      ).rejects.toThrowError(/NOTE_EMPTY_DESCRIPTION/);

      await expect(
        createBehaviorNote(
          {
            studentId: '233001',
            classId: '9A3',
            type: 'invalid_type' as any,
            content: 'Học sinh tốt',
          },
          gvcnUser
        )
      ).rejects.toThrowError(/NOTE_INVALID_TYPE/);
    });

    it('4.8 verifies timestamp integrity: createdAt, updatedAt, and timestamp are positive epoch milliseconds', async () => {
      const beforeTime = Date.now();
      const note = await createBehaviorNote(
        {
          studentId: '233001',
          classId: '9A3',
          type: 'positive',
          content: 'Phát biểu tốt',
        },
        gvcnUser
      );
      const afterTime = Date.now();

      expect(note.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(note.createdAt).toBeLessThanOrEqual(afterTime);
      expect(note.timestamp).toBe(note.createdAt);
      expect(note.updatedAt).toBe(note.createdAt);
    });

    it('4.9 dynamic dual-role context switching: assigns gvcn role in assigned class and gvbm in another class', async () => {
      // In assigned class 9A3
      const noteInAssigned = await createBehaviorNote(
        {
          studentId: '233001',
          classId: '9A3',
          type: 'positive',
          content: 'Hoàn thành bài tập tốt',
        },
        dualRoleTeacher
      );
      expect(noteInAssigned.authorRole).toBe('gvcn');

      // In another class 6A1 where teacher acts as GVBM
      const noteInOther = await createBehaviorNote(
        {
          studentId: '269029',
          classId: '6A1',
          type: 'negative',
          content: 'Nói chuyện trong tiết Toán',
        },
        dualRoleTeacher
      );
      expect(noteInOther.authorRole).toBe('gvbm');
    });
  });
});
