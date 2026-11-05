/**
 * Unit & Integration Tests: 100-Point Emulation Scoring Engine & Certification
 * Milestone 5: Official UMS Emulation Mathematics & Leaderboard Rankings
 * Path: src/test/emulation.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEmulationScore,
  evaluateGoodStudyWeek,
  determineAwardLevel,
  rankClassesForEmulation,
  getAwardLevelMeta,
} from '../utils/emulation';
import { WeeklySummary } from '../types/summary';

describe('Milestone 5: 100-Point Emulation Scoring Engine', () => {
  describe('1. calculateEmulationScore Mathematics', () => {
    it('1.1 Computes neutral baseline: 100.0 points when period average is 9.5 and zero infractions', () => {
      const res = calculateEmulationScore({
        periodAverage: 9.5,
        periodsTaught: 40,
        unexcusedK: 0,
        excusedP: 0,
        late: 0,
        negativeNotes: 0,
        positiveNotes: 0,
        unsignedCount: 0,
      });

      expect(res.baseScore).toBe(100.0);
      expect(res.academicDelta).toBe(0.0);
      expect(res.attendanceDeductions.total).toBe(0.0);
      expect(res.behaviorDelta.net).toBe(0.0);
      expect(res.unsignedPeriodDeductions).toBe(0.0);
      expect(res.totalScore).toBe(100.0);
      expect(res.awardLevel).toBe('xuat_sac');
      expect(res.isGoodStudyWeek).toBe(true);
    });

    it('1.2 Applies positive academic adjustment: (10.0 - 9.5) * 10 = +5.0 points', () => {
      const res = calculateEmulationScore({
        periodAverage: 10.0,
        periodsTaught: 40,
      });
      expect(res.academicDelta).toBe(5.0);
      expect(res.totalScore).toBe(105.0); // 100 + 5
    });

    it('1.3 Applies negative academic adjustments: 9.0 -> -5.0, 8.5 -> -10.0, 8.0 -> -15.0', () => {
      const res9 = calculateEmulationScore({ periodAverage: 9.0, periodsTaught: 40 });
      expect(res9.academicDelta).toBe(-5.0);
      expect(res9.totalScore).toBe(95.0);

      const res85 = calculateEmulationScore({ periodAverage: 8.5, periodsTaught: 40 });
      expect(res85.academicDelta).toBe(-10.0);
      expect(res85.totalScore).toBe(90.0);

      const res8 = calculateEmulationScore({ periodAverage: 8.0, periodsTaught: 40 });
      expect(res8.academicDelta).toBe(-15.0);
      expect(res8.totalScore).toBe(85.0);
    });

    it('1.4 Handles zero periods taught without applying premature negative academic penalties', () => {
      const res = calculateEmulationScore({
        periodAverage: 0,
        periodsTaught: 0,
      });
      expect(res.academicDelta).toBe(0.0);
      expect(res.totalScore).toBe(100.0);
      expect(res.isGoodStudyWeek).toBe(false); // No periods recorded
    });

    it('1.5 Computes attendance deductions: K * 2.0, P * 0.5, Late * 1.0', () => {
      const res = calculateEmulationScore({
        periodAverage: 9.5,
        periodsTaught: 40,
        unexcusedK: 2, // 2 * 2.0 = 4.0
        excusedP: 3, // 3 * 0.5 = 1.5
        late: 1, // 1 * 1.0 = 1.0
      });

      expect(res.attendanceDeductions.unexcusedK).toBe(2);
      expect(res.attendanceDeductions.kDeduction).toBe(4.0);
      expect(res.attendanceDeductions.excusedP).toBe(3);
      expect(res.attendanceDeductions.pDeduction).toBe(1.5);
      expect(res.attendanceDeductions.late).toBe(1);
      expect(res.attendanceDeductions.lateDeduction).toBe(1.0);
      expect(res.attendanceDeductions.total).toBe(6.5);
      expect(res.totalScore).toBe(93.5); // 100 - 6.5
    });

    it('1.6 Computes behavior notes deductions and bonuses', () => {
      // 3 standard negative (-3.0), 1 severe (-2.0), 4 positive (+2.0)
      const res = calculateEmulationScore({
        periodAverage: 9.5,
        periodsTaught: 40,
        negativeNotes: 3,
        severeNegativeNotes: 1,
        positiveNotes: 4,
      });

      expect(res.behaviorDelta.deduction).toBe(5.0); // 3*1 + 1*2
      expect(res.behaviorDelta.bonus).toBe(2.0); // 4 * 0.5
      expect(res.behaviorDelta.net).toBe(-3.0);
      expect(res.totalScore).toBe(97.0); // 100 - 5 + 2
    });

    it('1.7 Caps positive behavior bonus at +5.0 points ceiling', () => {
      const res = calculateEmulationScore({
        periodAverage: 9.5,
        periodsTaught: 40,
        positiveNotes: 20, // 20 * 0.5 = 10.0 -> capped at 5.0
      });

      expect(res.behaviorDelta.bonus).toBe(5.0);
      expect(res.totalScore).toBe(105.0); // 100 + 5.0
    });

    it('1.8 Deducts unsigned periods at 2.0 points per unsigned period', () => {
      const res = calculateEmulationScore({
        periodAverage: 9.5,
        periodsTaught: 40,
        unsignedCount: 3, // 3 * 2.0 = 6.0
      });

      expect(res.unsignedPeriodDeductions).toBe(6.0);
      expect(res.totalScore).toBe(94.0);
    });

    it('1.9 Clamps scores strictly within [0.0, 105.0] range', () => {
      // Massive infractions: 100 - 200 -> clamped to 0.0
      const resNegative = calculateEmulationScore({
        periodAverage: 5.0,
        periodsTaught: 40,
        unexcusedK: 50,
        unsignedCount: 20,
      });
      expect(resNegative.totalScore).toBe(0.0);

      // Flawless + max bonuses: 100 + 5 (academic) + 5 (bonus) = 110 -> clamped to 105.0
      const resSuper = calculateEmulationScore({
        periodAverage: 10.0,
        periodsTaught: 40,
        positiveNotes: 20,
      });
      expect(resSuper.totalScore).toBe(105.0);
    });
  });

  describe('2. "Tuần học tốt" Certification Predicate', () => {
    it('2.1 Passes when score >= 90.0, zero unexcused absences, min period score >= 8.0, and periods > 0', () => {
      const evalRes = evaluateGoodStudyWeek(94.5, 0, 8.5, 40);
      expect(evalRes.isGoodStudyWeek).toBe(true);
      expect(evalRes.failReasons).toHaveLength(0);
    });

    it('2.2 Disqualifies if there is even 1 unexcused absence (K) regardless of high score', () => {
      const evalRes = evaluateGoodStudyWeek(98.0, 1, 9.0, 40);
      expect(evalRes.isGoodStudyWeek).toBe(false);
      expect(evalRes.failReasons.some((r) => r.includes('vắng không phép'))).toBe(true);
    });

    it('2.3 Disqualifies if any single period score is below 8.0', () => {
      const evalRes = evaluateGoodStudyWeek(92.0, 0, 7.5, 40);
      expect(evalRes.isGoodStudyWeek).toBe(false);
      expect(evalRes.failReasons.some((r) => r.includes('dưới ngưỡng tối thiểu'))).toBe(true);
    });

    it('2.4 Disqualifies if overall score is below 90.0', () => {
      const evalRes = evaluateGoodStudyWeek(88.5, 0, 8.5, 40);
      expect(evalRes.isGoodStudyWeek).toBe(false);
      expect(evalRes.failReasons.some((r) => r.includes('chưa đạt mốc tối thiểu'))).toBe(true);
    });
  });

  describe('3. 5-Tier Emulation Classification', () => {
    it('3.1 Classifies into official 5 tiers', () => {
      expect(determineAwardLevel(98.0, true)).toBe('xuat_sac');
      expect(determineAwardLevel(95.0, true)).toBe('xuat_sac');
      expect(determineAwardLevel(92.0, true)).toBe('tuan_hoc_tot');
      expect(determineAwardLevel(85.0, false)).toBe('kha');
      expect(determineAwardLevel(75.0, false)).toBe('trung_binh');
      expect(determineAwardLevel(65.0, false)).toBe('can_co_gang');
    });

    it('3.2 Returns styling metadata for badges', () => {
      const meta = getAwardLevelMeta('xuat_sac');
      expect(meta.labelVi).toBe('Xuất sắc');
      expect(meta.labelEn).toBe('Excellent');
      expect(meta.colorName).toBe('emerald');
    });
  });

  describe('4. rankClassesForEmulation Sorting & Tie-Breaking Rules', () => {
    const makeSummary = (classId: string, totalAvg: number, unexcused = 0, late = 0, unsigned = 0): WeeklySummary => ({
      id: `${classId}_W5`,
      classId,
      academicYear: '2026-2027',
      weekNumber: 5,
      startDate: '2026-10-05',
      endDate: '2026-10-09',
      totalPeriodsExpected: 40,
      totalPeriodsTaught: 40,
      totalPeriodsSigned: 40 - unsigned,
      unsignedPeriods: Array.from({ length: unsigned }, (_, i) => ({
        date: '2026-10-05',
        periodIndex: i + 1,
        subject: 'Toán',
        teacherName: 'GV',
      })),
      attendanceStats: {
        totalExcused: 0,
        totalUnexcused: unexcused,
        totalLate: late,
        studentAbsenceSummary: {},
      },
      criteriaAverages: {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 0.5,
        totalAverage: totalAvg,
      },
      teacherRemarksSummary: [],
      updatedAt: Date.now(),
    });

    it('4.1 Sorts strictly by total score descending', () => {
      const c1 = makeSummary('6A1', 9.8); // 103.0
      const c2 = makeSummary('6A2', 9.5); // 100.0
      const c3 = makeSummary('6A3', 9.0); // 95.0

      const ranked = rankClassesForEmulation([c2, c1, c3]);
      expect(ranked[0].classId).toBe('6A1');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].classId).toBe('6A2');
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].classId).toBe('6A3');
      expect(ranked[2].rank).toBe(3);
    });

    it('4.2 Breaks tie by fewer conduct deductions when total scores are equal', () => {
      // Both achieve 95.0 total score:
      // cA: periodAverage 9.5 (100) - 2.5 (1 P=0.5, 2 Late=2.0 -> total 2.5) = 97.5? Let's calibrate:
      // cA: period 9.5 (delta 0), 1 K (2.0) + 1 Late (1.0) = 3.0 deduction -> score 97.0
      // cB: period 9.8 (delta +3.0), 3 K (6.0) = 6.0 deduction -> score 97.0
      const cA = makeSummary('7A1', 9.5, 1, 1, 0); // score 100 - 3.0 = 97.0, deductions = 3.0
      const cB = makeSummary('7A2', 9.8, 3, 0, 0); // score 100 + 3 - 6 = 97.0, deductions = 6.0

      const ranked = rankClassesForEmulation([cB, cA]);
      expect(ranked[0].totalScore).toBe(97.0);
      expect(ranked[1].totalScore).toBe(97.0);
      // cA has fewer conduct deductions (3.0 vs 6.0), so cA wins the tie
      expect(ranked[0].classId).toBe('7A1');
      expect(ranked[1].classId).toBe('7A2');
    });

    it('4.3 Breaks tie by higher academic average when deductions are also equal', () => {
      // Both score 100.0, both have 0 deductions:
      // cA: 9.501 -> delta 0.01 -> rounds to 0.0
      // cB: 9.500 -> delta 0.00
      // cA has higher academicDelta / totalAverage
      const cA = makeSummary('8A1', 9.5);
      cA.criteriaAverages.totalAverage = 9.55;
      const cB = makeSummary('8A2', 9.5);
      cB.criteriaAverages.totalAverage = 9.50;

      const ranked = rankClassesForEmulation([cB, cA]);
      expect(ranked[0].classId).toBe('8A1');
    });

    it('4.4 Breaks tie alphabetically by class name as ultimate graceful fallback', () => {
      const cB = makeSummary('9A2', 9.5);
      const cA = makeSummary('9A1', 9.5);

      const ranked = rankClassesForEmulation([cB, cA]);
      expect(ranked[0].classId).toBe('9A1');
      expect(ranked[1].classId).toBe('9A2');
    });

    it('4.5 Calculates grade-level rank accurately for mixed grades', () => {
      const c6_1 = makeSummary('6A1', 9.5);
      const c6_2 = makeSummary('6A2', 9.0);
      const c7_1 = makeSummary('7A1', 9.8);
      const c7_2 = makeSummary('7A2', 8.5);

      const ranked = rankClassesForEmulation([c6_2, c7_1, c6_1, c7_2]);
      // Overall order: 7A1 (103), 6A1 (100), 6A2 (95), 7A2 (90)
      expect(ranked.map((r) => r.classId)).toEqual(['7A1', '6A1', '6A2', '7A2']);

      const r7_1 = ranked.find((r) => r.classId === '7A1')!;
      const r6_1 = ranked.find((r) => r.classId === '6A1')!;
      const r6_2 = ranked.find((r) => r.classId === '6A2')!;
      const r7_2 = ranked.find((r) => r.classId === '7A2')!;

      expect(r7_1.gradeRank).toBe(1);
      expect(r6_1.gradeRank).toBe(1);
      expect(r6_2.gradeRank).toBe(2);
      expect(r7_2.gradeRank).toBe(2);
    });
  });
});
