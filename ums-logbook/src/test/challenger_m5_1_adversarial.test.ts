/**
 * Empirical Adversarial Test Suite - Challenger M5_1
 * Milestone 5: 100-Point Emulation Scoring Formula, Clamping Bounds,
 * Strict "Tuần học tốt" Certification Predicate, and 26-Class Multi-Tier Tie-Breaking
 *
 * Path: src/test/challenger_m5_1_adversarial.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEmulationScore,
  evaluateGoodStudyWeek,
  determineAwardLevel,
  rankClassesForEmulation,
} from '../utils/emulation';
import { WeeklySummary } from '../types/summary';
import { BehaviorNote } from '../types/behavior';

describe('CHALLENGER M5_1: Adversarial Emulation Engine & Leaderboard Hardening', () => {
  // =========================================================================
  // SECTION 1: FORMULA & CLAMPING STRESS-TESTING
  // =========================================================================
  describe('Section 1: Formula & Clamping Stress-Testing', () => {
    it('1.1 Lower Clamp Bound: Massive infractions clamp strictly at exactly 0.0 (never negative, NaN, or -0)', () => {
      // Prompt specification: 50 unexcused absences K, 20 negative notes, 40 unsigned periods
      // Deductions: 50 * 2.0 (100.0) + 20 * 1.0 (20.0) + 40 * 2.0 (80.0) = 200.0 deduction
      // Raw: 100.0 - 200.0 = -100.0 -> must be strictly 0.0
      const result = calculateEmulationScore({
        periodAverage: 9.5,
        periodsTaught: 40,
        unexcusedK: 50,
        negativeNotes: 20,
        unsignedCount: 40,
      });

      expect(result.totalScore).toBe(0.0);
      expect(result.finalScore).toBe(0.0);
      expect(Object.is(result.totalScore, -0)).toBe(false);
      expect(result.totalScore).not.toBeLessThan(0);
      expect(Number.isNaN(result.totalScore)).toBe(false);
      expect(result.awardLevel).toBe('can_co_gang');
      expect(result.status).toBe('warning');
      expect(result.isGoodStudyWeek).toBe(false);
    });

    it('1.1b Lower Clamp Bound Extreme Stress: Astronomical penalties still yield strictly 0.0', () => {
      const extremeResult = calculateEmulationScore({
        periodAverage: 1.0, // (1.0 - 9.5)*10 = -85.0
        periodsTaught: 40,
        unexcusedK: 1000, // 2000.0
        excusedP: 500, // 250.0
        late: 500, // 500.0
        negativeNotes: 1000, // 1000.0
        severeNegativeNotes: 500, // 1000.0
        unsignedCount: 100, // 200.0
      });

      expect(extremeResult.totalScore).toBe(0.0);
      expect(extremeResult.totalScore).toBeGreaterThanOrEqual(0.0);
    });

    it('1.2 Upper Clamp Bound: Max academic delta (+5.0) and positive notes (+5.0 bonus) clamp strictly at 105.0', () => {
      // Prompt specification: 10.0 period average (+5.0 delta), 10 positive notes (+5.0 max bonus)
      // Raw: 100.0 + 5.0 + 5.0 = 110.0 -> must be strictly clamped at 105.0, never exceed 105.0
      const result = calculateEmulationScore({
        periodAverage: 10.0,
        periodsTaught: 40,
        positiveNotes: 10,
        unexcusedK: 0,
        excusedP: 0,
        late: 0,
        negativeNotes: 0,
        unsignedCount: 0,
      });

      expect(result.academicDelta).toBe(5.0);
      expect(result.behaviorDelta.bonus).toBe(5.0);
      expect(result.totalScore).toBe(105.0);
      expect(result.totalScore).not.toBeGreaterThan(105.0);
      expect(result.awardLevel).toBe('xuat_sac');
      expect(result.isGoodStudyWeek).toBe(true);
    });

    it('1.2b Upper Clamp Bound Overshoot: 100 positive notes (+50.0 uncapped) still clamp at exactly 105.0', () => {
      const overResult = calculateEmulationScore({
        periodAverage: 10.0,
        periodsTaught: 40,
        positiveNotes: 100, // Uncapped: 50.0 -> Capped at 5.0
      });

      expect(overResult.behaviorDelta.bonus).toBe(5.0);
      expect(overResult.totalScore).toBe(105.0);
      expect(overResult.totalScore).not.toBeGreaterThan(105.0);
    });

    it('1.3 Baseline Perfection: 40 periods taught with 9.5 average, 0 absences, 0 notes, 0 unsigned periods = exactly 100.0', () => {
      const result = calculateEmulationScore({
        periodAverage: 9.5,
        periodsTaught: 40,
        unexcusedK: 0,
        excusedP: 0,
        late: 0,
        negativeNotes: 0,
        severeNegativeNotes: 0,
        positiveNotes: 0,
        unsignedCount: 0,
      });

      expect(result.baseScore).toBe(100.0);
      expect(result.academicDelta).toBe(0.0);
      expect(result.attendanceDeductions.total).toBe(0.0);
      expect(result.behaviorDelta.deduction).toBe(0.0);
      expect(result.behaviorDelta.bonus).toBe(0.0);
      expect(result.unsignedPeriodDeductions).toBe(0.0);
      expect(result.totalScore).toBe(100.0);
      expect(result.awardLevel).toBe('xuat_sac');
      expect(result.isGoodStudyWeek).toBe(true);
    });

    it('1.4 Zero Periods Taught: Academic delta MUST be 0.0, preventing division-by-zero or NaN', () => {
      // When periodsTaught is 0, no classes have taken place. Academic delta must NOT be -95.0, but 0.0.
      const resultZeroTaught = calculateEmulationScore({
        periodAverage: 0,
        periodsTaught: 0,
        unexcusedK: 0,
        excusedP: 0,
        late: 0,
      });

      expect(resultZeroTaught.academicDelta).toBe(0.0);
      expect(Number.isNaN(resultZeroTaught.academicDelta)).toBe(false);
      expect(Number.isFinite(resultZeroTaught.academicDelta)).toBe(true);
      expect(resultZeroTaught.totalScore).toBe(100.0);
      // Zero periods taught must NOT qualify for Good Study Week
      expect(resultZeroTaught.isGoodStudyWeek).toBe(false);
      expect(
        resultZeroTaught.goodStudyWeekFailReasons.some((r) =>
          r.toLowerCase().includes('chưa có tiết học')
        )
      ).toBe(true);
    });

    it('1.4b Undefined/NaN periodAverage with 0 periods taught: Safely defaults to 0.0 delta', () => {
      const resultUndefined = calculateEmulationScore({
        periodAverage: undefined,
        periodsTaught: 0,
      });

      expect(resultUndefined.academicDelta).toBe(0.0);
      expect(resultUndefined.totalScore).toBe(100.0);
      expect(resultUndefined.isGoodStudyWeek).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: PENALTY & BONUS PRECISION
  // =========================================================================
  describe('Section 2: Penalty & Bonus Precision', () => {
    it('2.1 Attendance Penalties: K = -2.0, P = -0.5, Late = -1.0; 3K + 2P + 4Late = -11.0', () => {
      // 3K * 2.0 = 6.0
      // 2P * 0.5 = 1.0
      // 4Late * 1.0 = 4.0
      // Total attendance deduction = 11.0
      const result = calculateEmulationScore({
        periodAverage: 9.5,
        periodsTaught: 40,
        unexcusedK: 3,
        excusedP: 2,
        late: 4,
      });

      expect(result.attendanceDeductions.kDeduction).toBe(6.0);
      expect(result.attendanceDeductions.pDeduction).toBe(1.0);
      expect(result.attendanceDeductions.lateDeduction).toBe(4.0);
      expect(result.attendanceDeductions.total).toBe(11.0);
      expect(result.totalScore).toBe(89.0); // 100 - 11.0
    });

    it('2.1b Attendance Precision: Fractional deduction combinations avoid IEEE-754 precision drift', () => {
      // 1P = 0.5, 3P = 1.5, 5P = 2.5, 7P = 3.5
      const res1 = calculateEmulationScore({ excusedP: 1, periodsTaught: 40, periodAverage: 9.5 });
      expect(res1.attendanceDeductions.total).toBe(0.5);
      expect(res1.totalScore).toBe(99.5);

      const res3 = calculateEmulationScore({ excusedP: 3, periodsTaught: 40, periodAverage: 9.5 });
      expect(res3.attendanceDeductions.total).toBe(1.5);
      expect(res3.totalScore).toBe(98.5);

      const res7 = calculateEmulationScore({ excusedP: 7, periodsTaught: 40, periodAverage: 9.5 });
      expect(res7.attendanceDeductions.total).toBe(3.5);
      expect(res7.totalScore).toBe(96.5);
    });

    it('2.2 Behavior Notes: Positive note bonus capped at +5.0 even if 20 notes present (+10.0 uncapped)', () => {
      // 1 note: +0.5
      const res1 = calculateEmulationScore({ positiveNotes: 1, periodsTaught: 40, periodAverage: 9.5 });
      expect(res1.behaviorDelta.bonus).toBe(0.5);

      // 9 notes: +4.5
      const res9 = calculateEmulationScore({ positiveNotes: 9, periodsTaught: 40, periodAverage: 9.5 });
      expect(res9.behaviorDelta.bonus).toBe(4.5);

      // 10 notes: +5.0 (hits cap)
      const res10 = calculateEmulationScore({ positiveNotes: 10, periodsTaught: 40, periodAverage: 9.5 });
      expect(res10.behaviorDelta.bonus).toBe(5.0);

      // 20 notes: +5.0 (capped, does not exceed 5.0)
      const res20 = calculateEmulationScore({ positiveNotes: 20, periodsTaught: 40, periodAverage: 9.5 });
      expect(res20.behaviorDelta.bonus).toBe(5.0);

      // 50 notes: still strictly +5.0
      const res50 = calculateEmulationScore({ positiveNotes: 50, periodsTaught: 40, periodAverage: 9.5 });
      expect(res50.behaviorDelta.bonus).toBe(5.0);
    });

    it('2.2b Behavior Negative Notes: standard -1.0, severe -2.0 accurately compounded', () => {
      const res = calculateEmulationScore({
        negativeNotes: 4, // 4 * 1.0 = 4.0
        severeNegativeNotes: 3, // 3 * 2.0 = 6.0
        positiveNotes: 6, // 6 * 0.5 = 3.0
        periodAverage: 9.5,
        periodsTaught: 40,
      });

      expect(res.behaviorDelta.negativeCount).toBe(7);
      expect(res.behaviorDelta.deduction).toBe(10.0); // 4 + 6
      expect(res.behaviorDelta.bonus).toBe(3.0);
      expect(res.behaviorDelta.net).toBe(-7.0); // 3 - 10
      expect(res.totalScore).toBe(93.0); // 100 - 7
    });

    it('2.3 Unsigned Periods: -2.0 penalty per unsigned period', () => {
      const res1 = calculateEmulationScore({ unsignedCount: 1, periodsTaught: 40, periodAverage: 9.5 });
      expect(res1.unsignedPeriodDeductions).toBe(2.0);
      expect(res1.totalScore).toBe(98.0);

      const res5 = calculateEmulationScore({ unsignedCount: 5, periodsTaught: 40, periodAverage: 9.5 });
      expect(res5.unsignedPeriodDeductions).toBe(10.0);
      expect(res5.totalScore).toBe(90.0);

      const res40 = calculateEmulationScore({ unsignedCount: 40, periodsTaught: 40, periodAverage: 9.5 });
      expect(res40.unsignedPeriodDeductions).toBe(80.0);
      expect(res40.totalScore).toBe(20.0);
    });
  });

  // =========================================================================
  // SECTION 3: "TUẦN HỌC TỐT" STRICT PREDICATE (evaluateGoodStudyWeek)
  // =========================================================================
  describe('Section 3: "Tuần học tốt" Strict Predicate (evaluateGoodStudyWeek)', () => {
    it('3.1 Score 95.0, but K = 1 -> MUST be false (zero tolerance for unexcused absence)', () => {
      const evalRes = evaluateGoodStudyWeek(95.0, 1, 9.0, 40);
      expect(evalRes.isGoodStudyWeek).toBe(false);
      expect(evalRes.failReasons.length).toBeGreaterThanOrEqual(1);
      expect(
        evalRes.failReasons.some((r) => r.toLowerCase().includes('vắng không phép'))
      ).toBe(true);
    });

    it('3.2 Score 92.0, K = 0, but one period scored 7.9 -> MUST be false (minPeriodScore < 8.0)', () => {
      const evalRes = evaluateGoodStudyWeek(92.0, 0, 7.9, 40);
      expect(evalRes.isGoodStudyWeek).toBe(false);
      expect(evalRes.failReasons.length).toBeGreaterThanOrEqual(1);
      expect(
        evalRes.failReasons.some((r) => r.toLowerCase().includes('dưới ngưỡng tối thiểu'))
      ).toBe(true);
    });

    it('3.3 Score 89.9, K = 0, all periods 10.0 -> MUST be false (score below 90.0 benchmark)', () => {
      const evalRes = evaluateGoodStudyWeek(89.9, 0, 10.0, 40);
      expect(evalRes.isGoodStudyWeek).toBe(false);
      expect(evalRes.failReasons.length).toBeGreaterThanOrEqual(1);
      expect(
        evalRes.failReasons.some((r) => r.toLowerCase().includes('chưa đạt mốc tối thiểu'))
      ).toBe(true);
    });

    it('3.4 Score 100.0, but 0 periods taught -> MUST be false (no periods recorded)', () => {
      const evalRes = evaluateGoodStudyWeek(100.0, 0, 10.0, 0);
      expect(evalRes.isGoodStudyWeek).toBe(false);
      expect(evalRes.failReasons.length).toBeGreaterThanOrEqual(1);
      expect(
        evalRes.failReasons.some((r) => r.toLowerCase().includes('chưa có tiết học'))
      ).toBe(true);
    });

    it('3.5 Score 90.0, K = 0, min period score 8.0, 40 periods -> MUST be true (boundary exact hit)', () => {
      const evalRes = evaluateGoodStudyWeek(90.0, 0, 8.0, 40);
      expect(evalRes.isGoodStudyWeek).toBe(true);
      expect(evalRes.failReasons).toHaveLength(0);
    });

    it('3.6 Multiple concurrent disqualifiers: All fail reasons captured simultaneously', () => {
      // Score 85 (<90), K = 2 (>0), minPeriod = 7.5 (<8.0), periods = 40
      const evalRes = evaluateGoodStudyWeek(85.0, 2, 7.5, 40);
      expect(evalRes.isGoodStudyWeek).toBe(false);
      expect(evalRes.failReasons.length).toBe(3);
    });

    it('3.7 Award level determination conforms strictly to 5 tiers', () => {
      expect(determineAwardLevel(98.0, true)).toBe('xuat_sac');
      expect(determineAwardLevel(95.0, false)).toBe('xuat_sac');
      expect(determineAwardLevel(90.0, true)).toBe('tuan_hoc_tot');
      expect(determineAwardLevel(89.9, false)).toBe('kha');
      expect(determineAwardLevel(80.0, false)).toBe('kha');
      expect(determineAwardLevel(70.0, false)).toBe('trung_binh');
      expect(determineAwardLevel(69.9, false)).toBe('can_co_gang');
    });
  });

  // =========================================================================
  // SECTION 4: RANKING & MULTI-TIER TIE-BREAKING ACROSS 26 CLASSES
  // =========================================================================
  describe('Section 4: Ranking & Multi-Tier Tie-Breaking across 26 Classes', () => {
    // Helper to generate a WeeklySummary fixture
    const createClassSummary = (
      classId: string,
      periodAvg: number,
      taught = 40,
      unexcusedK = 0,
      excusedP = 0,
      late = 0,
      unsigned = 0
    ): WeeklySummary => ({
      id: `${classId}_W5`,
      classId,
      academicYear: '2026-2027',
      weekNumber: 5,
      startDate: '2026-10-05',
      endDate: '2026-10-09',
      totalPeriodsExpected: 40,
      totalPeriodsTaught: taught,
      totalPeriodsSigned: taught - unsigned,
      unsignedPeriods: Array.from({ length: unsigned }, (_, i) => ({
        date: '2026-10-05',
        periodIndex: i + 1,
        subject: 'Toán',
        teacherName: 'GVBM',
      })),
      attendanceStats: {
        totalExcused: excusedP,
        totalUnexcused: unexcusedK,
        totalLate: late,
        studentAbsenceSummary: {},
      },
      criteriaAverages: {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 0.5,
        totalAverage: periodAvg,
      },
      teacherRemarksSummary: [],
      updatedAt: Date.now(),
    });

    // Official 26 classes of UMS
    const ALL_26_CLASS_IDS = [
      '6A1', '6A2', '6A3', '6A4', '6A5', '6A6', '6A7', '6A8',
      '7A1', '7A2', '7A3', '7A4', '7A5', '7A6',
      '8A1', '8A2', '8A3', '8A4', '8A5', '8A6',
      '9A1', '9A2', '9A3', '9A4', '9A5', '9A6',
    ];

    it('4.1 Multi-Tier Tie-Breaking: Stress tests all 5 tiers deterministically', () => {
      // Pair 1 (Tier 2 test): 7A1 vs 7A2
      // 7A1: periodAvg 9.5 (delta 0), 1 K (2.0) + 1 Late (1.0) = 3.0 deduction -> score 97.0
      // 7A2: periodAvg 9.8 (delta +3.0), 3 K (6.0) = 6.0 deduction -> score 97.0
      // 7A1 has fewer deductions (3.0 vs 6.0) -> 7A1 must beat 7A2!
      const s7A1 = createClassSummary('7A1', 9.5, 40, 1, 0, 1, 0); // score 97.0, deductions = 3.0
      const s7A2 = createClassSummary('7A2', 9.8, 40, 3, 0, 0, 0); // score 97.0, deductions = 6.0

      // Pair 2 (Tier 3 test): 8A1 vs 8A2
      // 8A1: periodAvg 9.6 (delta +1.0) -> needs 0 bonus to score 101.0
      // 8A2: periodAvg 9.5 (delta 0.0) -> needs +1.0 bonus to score 101.0
      // Behavior notes: 8A2 gets 2 positive notes (+1.0 bonus). 8A1 gets 0 notes.
      const s8A1 = createClassSummary('8A1', 9.6, 40, 0, 0, 0, 0); // score 101.0, delta 1.0, bonus 0
      const s8A2 = createClassSummary('8A2', 9.5, 40, 0, 0, 0, 0); // score 101.0, delta 0.0, bonus 1.0
      const notes8A2: BehaviorNote[] = [
        {
          id: 'n1',
          studentId: 's1',
          studentName: 'SV 1',
          classId: '8A2',
          type: 'positive',
          category: 'Khen ngợi',
          content: 'Phát biểu tích cực',
          description: 'Phát biểu tích cực',
          date: '2026-10-05',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          authorId: 't1',
          authorName: 'GV',
          authorRole: 'gvbm',
          timestamp: Date.now(),
        },
        {
          id: 'n2',
          studentId: 's2',
          studentName: 'SV 2',
          classId: '8A2',
          type: 'positive',
          category: 'Khen ngợi',
          content: 'Bài tập xuất sắc',
          description: 'Bài tập xuất sắc',
          date: '2026-10-05',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          authorId: 't1',
          authorName: 'GV',
          authorRole: 'gvbm',
          timestamp: Date.now(),
        },
      ];

      // Pair 3 (Tier 4 test): 9A1 vs 9A2
      // 9A1: 0 unexcused K, 2 late (-2.0) -> total deduction 2.0
      // 9A2: 1 unexcused K (-2.0), 0 late -> total deduction 2.0
      // 9A1 has fewer unexcused absences (0 vs 1) -> 9A1 must beat 9A2!
      const s9A1 = createClassSummary('9A1', 9.5, 40, 0, 0, 2, 0); // score 98.0, 0 K
      const s9A2 = createClassSummary('9A2', 9.5, 40, 1, 0, 0, 0); // score 98.0, 1 K

      // Pair 4 (Tier 5 test): 6A1 vs 6A2
      // Both identical in every numeric dimension:
      // 6A1 vs 6A2: 6A1 comes first alphabetically
      const s6A2 = createClassSummary('6A2', 9.5, 40, 0, 0, 0, 0);
      const s6A1 = createClassSummary('6A1', 9.5, 40, 0, 0, 0, 0);

      // Evaluate subset of 8 classes
      const ranked = rankClassesForEmulation(
        [s7A2, s7A1, s8A2, s8A1, s9A2, s9A1, s6A2, s6A1],
        notes8A2
      );

      // Verify Tier 3 (8A1 beats 8A2: both 101.0, but 8A1 has higher academic delta 1.0 vs 0.0)
      const r8A1 = ranked.find((r) => r.classId === '8A1')!;
      const r8A2 = ranked.find((r) => r.classId === '8A2')!;
      expect(r8A1.totalScore).toBe(101.0);
      expect(r8A2.totalScore).toBe(101.0);
      expect(r8A1.rank).toBeLessThan(r8A2.rank);

      // Verify Tier 5 (6A1 beats 6A2 alphabetically: both 100.0, identical metrics)
      const r6A1 = ranked.find((r) => r.classId === '6A1')!;
      const r6A2 = ranked.find((r) => r.classId === '6A2')!;
      expect(r6A1.totalScore).toBe(100.0);
      expect(r6A2.totalScore).toBe(100.0);
      expect(r6A1.rank).toBeLessThan(r6A2.rank);

      // Verify Tier 4 (9A1 beats 9A2: both 98.0, same deductions, but 9A1 has 0 K vs 9A2 has 1 K)
      const r9A1 = ranked.find((r) => r.classId === '9A1')!;
      const r9A2 = ranked.find((r) => r.classId === '9A2')!;
      expect(r9A1.totalScore).toBe(98.0);
      expect(r9A2.totalScore).toBe(98.0);
      expect(r9A1.rank).toBeLessThan(r9A2.rank);

      // Verify Tier 2 (7A1 beats 7A2: both 97.0, but 7A1 has fewer deductions 3.0 vs 6.0)
      const r7A1 = ranked.find((r) => r.classId === '7A1')!;
      const r7A2 = ranked.find((r) => r.classId === '7A2')!;
      expect(r7A1.totalScore).toBe(97.0);
      expect(r7A2.totalScore).toBe(97.0);
      expect(r7A1.rank).toBeLessThan(r7A2.rank);
    });

    it('4.2 26-Class Full Cohort: Ranks all 26 classes from rank 1 to 26 without collision or missing indices', () => {
      // Construct 26 classes with distinct and overlapping scores
      const summaries: WeeklySummary[] = ALL_26_CLASS_IDS.map((cId, idx) => {
        // Period averages between 9.0 and 9.9
        const avg = 9.0 + (idx % 10) * 0.1;
        const unexcused = idx % 3 === 0 ? 1 : 0;
        const late = idx % 2;
        const unsigned = idx % 5 === 0 ? 1 : 0;
        return createClassSummary(cId, avg, 40, unexcused, 0, late, unsigned);
      });

      const ranked = rankClassesForEmulation(summaries);

      // Invariants for 26 classes:
      expect(ranked).toHaveLength(26);

      // Overall ranks 1..26 unique and monotonic
      const ranks = ranked.map((r) => r.rank);
      expect(ranks).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));

      // Each class present exactly once
      const foundIds = new Set(ranked.map((r) => r.classId));
      expect(foundIds.size).toBe(26);
      ALL_26_CLASS_IDS.forEach((id) => expect(foundIds.has(id)).toBe(true));

      // Score descending invariant
      for (let i = 0; i < ranked.length - 1; i++) {
        expect(ranked[i].totalScore).toBeGreaterThanOrEqual(ranked[i + 1].totalScore);
      }

      // Grade ranks correctly partitioned
      const gradeCounts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
      ranked.forEach((r) => {
        gradeCounts[r.grade]++;
        expect(r.gradeRank).toBe(gradeCounts[r.grade]);
      });
      expect(gradeCounts[6]).toBe(8);
      expect(gradeCounts[7]).toBe(6);
      expect(gradeCounts[8]).toBe(6);
      expect(gradeCounts[9]).toBe(6);
    });

    it('4.3 Olympic Podium: Ranks 1, 2, 3 assigned gold, silver, bronze standings correctly', () => {
      // Construct clear podium top 3
      // Rank 1 (Gold): 9A3 - 105.0 đ
      // Rank 2 (Silver): 8A3 - 103.0 đ
      // Rank 3 (Bronze): 7A3 - 101.0 đ
      // Others: <= 100.0 đ
      const summaries: WeeklySummary[] = ALL_26_CLASS_IDS.map((cId) => {
        if (cId === '9A3') return createClassSummary(cId, 10.0, 40, 0, 0, 0, 0); // 105.0
        if (cId === '8A3') return createClassSummary(cId, 9.8, 40, 0, 0, 0, 0); // 103.0
        if (cId === '7A3') return createClassSummary(cId, 9.6, 40, 0, 0, 0, 0); // 101.0
        return createClassSummary(cId, 9.5, 40, 1, 0, 0, 0); // 98.0
      });

      const ranked = rankClassesForEmulation(summaries);

      // Gold #1
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].classId).toBe('9A3');
      expect(ranked[0].totalScore).toBe(105.0);

      // Silver #2
      expect(ranked[1].rank).toBe(2);
      expect(ranked[1].classId).toBe('8A3');
      expect(ranked[1].totalScore).toBe(103.0);

      // Bronze #3
      expect(ranked[2].rank).toBe(3);
      expect(ranked[2].classId).toBe('7A3');
      expect(ranked[2].totalScore).toBe(101.0);

      // Podium slice invariant
      const podium = ranked.slice(0, 3);
      expect(podium.map((p) => p.classId)).toEqual(['9A3', '8A3', '7A3']);
    });
  });

  // =========================================================================
  // SECTION 5: PROPERTY-BASED FUZZING & INVARIANT HARNESS
  // =========================================================================
  describe('Section 5: Property-Based Invariant Fuzzing', () => {
    it('5.1 Fuzzes 1,000 randomized calculation runs: Clamping [0, 105] and finite number guarantees hold 100%', () => {
      // Deterministic PRNG
      let seed = 123456789;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let i = 0; i < 1000; i++) {
        const periodAvg = rnd() * 12; // 0 to 12
        const periodsTaught = Math.floor(rnd() * 45); // 0 to 44
        const unexcusedK = Math.floor(rnd() * 25);
        const excusedP = Math.floor(rnd() * 25);
        const late = Math.floor(rnd() * 25);
        const negativeNotes = Math.floor(rnd() * 20);
        const severeNegativeNotes = Math.floor(rnd() * 10);
        const positiveNotes = Math.floor(rnd() * 30);
        const unsignedCount = Math.floor(rnd() * 15);

        const res = calculateEmulationScore({
          periodAverage: periodAvg,
          periodsTaught,
          unexcusedK,
          excusedP,
          late,
          negativeNotes,
          severeNegativeNotes,
          positiveNotes,
          unsignedCount,
        });

        // INVARIANT 1: Total score must ALWAYS be within [0.0, 105.0]
        expect(res.totalScore).toBeGreaterThanOrEqual(0.0);
        expect(res.totalScore).toBeLessThanOrEqual(105.0);

        // INVARIANT 2: No NaN or Infinity
        expect(Number.isFinite(res.totalScore)).toBe(true);

        // INVARIANT 3: At most 1 decimal place
        const rounded = Math.round(res.totalScore * 10) / 10;
        expect(res.totalScore).toBe(rounded);

        // INVARIANT 4: Positive bonus never exceeds 5.0
        expect(res.behaviorDelta.bonus).toBeLessThanOrEqual(5.0);
        expect(res.behaviorDelta.bonus).toBeGreaterThanOrEqual(0.0);

        // INVARIANT 5: Zero periods taught cannot have isGoodStudyWeek === true
        if (periodsTaught <= 0) {
          expect(res.isGoodStudyWeek).toBe(false);
        }

        // INVARIANT 6: Any unexcused absence K > 0 cannot have isGoodStudyWeek === true
        if (unexcusedK > 0) {
          expect(res.isGoodStudyWeek).toBe(false);
        }

        // INVARIANT 7: Total score < 90.0 cannot have isGoodStudyWeek === true
        if (res.totalScore < 90.0) {
          expect(res.isGoodStudyWeek).toBe(false);
        }
      }
    });
  });
});
