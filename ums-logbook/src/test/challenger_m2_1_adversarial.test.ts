/**
 * Challenger M2_1 Adversarial Test Suite
 * Mission: Empirically stress-test the 4-criteria scoring engine, boundaries, decimal rounding, and period validation.
 * File: src/test/challenger_m2_1_adversarial.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePeriodTotal,
  getPeriodRating,
  validateScores,
  DEFAULT_SCORING_CONFIG,
  ScoringConfig,
} from '../utils/scoring';
import { validatePeriodEntry, assertValidPeriodEntry } from '../utils/validators';

describe('CHALLENGER M2_1: Adversarial Scoring Engine & Validation Boundary Suite', () => {
  // =========================================================================
  // MISSION 1: Boundary testing at exact max, just above max, negatives, and non-numeric
  // =========================================================================
  describe('Mission 1: Criteria Boundary Testing & Error Rejections', () => {
    it('M1.1: Accepts criteria at exact maximum values (4.0, 3.0, 2.0, 1.0 -> total 10.0)', () => {
      const res = validateScores({
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
      });

      expect(res.learning).toBe(4.0);
      expect(res.discipline).toBe(3.0);
      expect(res.hygiene).toBe(2.0);
      expect(res.customCriterion).toBe(1.0);
      expect(res.total).toBe(10.0);

      const rating = getPeriodRating(res.total);
      expect(rating.level).toBe('TOT');
      expect(rating.labelVi).toBe('Tốt');
      expect(rating.labelEn).toBe('Good');
    });

    it('M1.2: Rejects learning just above max (4.0001, 4.01, 4.1) with SCORE_EXCEEDS_MAX', () => {
      const boundaryValues = [4.0001, 4.01, 4.1, 4.5, 5.0, 10.0, 999.0, Number.MAX_SAFE_INTEGER];
      for (const val of boundaryValues) {
        expect(() =>
          validateScores({
            learning: val,
            discipline: 0.0,
            hygiene: 0.0,
            customCriterion: 0.0,
          })
        ).toThrowError(/SCORE_EXCEEDS_MAX/);
      }
    });

    it('M1.3: Rejects discipline just above max (3.0001, 3.01, 3.1) with SCORE_EXCEEDS_MAX', () => {
      const boundaryValues = [3.0001, 3.01, 3.1, 3.5, 4.0, 10.0, 999.0];
      for (const val of boundaryValues) {
        expect(() =>
          validateScores({
            learning: 0.0,
            discipline: val,
            hygiene: 0.0,
            customCriterion: 0.0,
          })
        ).toThrowError(/SCORE_EXCEEDS_MAX/);
      }
    });

    it('M1.4: Rejects hygiene just above max (2.0001, 2.01, 2.1) with SCORE_EXCEEDS_MAX', () => {
      const boundaryValues = [2.0001, 2.01, 2.1, 2.5, 3.0, 10.0, 999.0];
      for (const val of boundaryValues) {
        expect(() =>
          validateScores({
            learning: 0.0,
            discipline: 0.0,
            hygiene: val,
            customCriterion: 0.0,
          })
        ).toThrowError(/SCORE_EXCEEDS_MAX/);
      }
    });

    it('M1.5: Rejects custom criterion just above max (1.0001, 1.01, 1.1) with SCORE_EXCEEDS_MAX', () => {
      const boundaryValues = [1.0001, 1.01, 1.1, 1.5, 2.0, 10.0];
      for (const val of boundaryValues) {
        expect(() =>
          validateScores({
            learning: 0.0,
            discipline: 0.0,
            hygiene: 0.0,
            customCriterion: val,
          })
        ).toThrowError(/SCORE_EXCEEDS_MAX/);
      }
    });

    it('M1.6: Rejects negative values across all 4 criteria with SCORE_NEGATIVE_VALUE', () => {
      const negativeTestValues = [-0.0001, -0.01, -0.1, -0.5, -1.0, -100.0, -Infinity];

      for (const neg of negativeTestValues) {
        // Learning negative
        expect(() =>
          validateScores({ learning: neg, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5 })
        ).toThrowError(/SCORE_NEGATIVE_VALUE/);

        // Discipline negative
        expect(() =>
          validateScores({ learning: 2.0, discipline: neg, hygiene: 1.0, customCriterion: 0.5 })
        ).toThrowError(/SCORE_NEGATIVE_VALUE/);

        // Hygiene negative
        expect(() =>
          validateScores({ learning: 2.0, discipline: 2.0, hygiene: neg, customCriterion: 0.5 })
        ).toThrowError(/SCORE_NEGATIVE_VALUE/);

        // Custom negative
        expect(() =>
          validateScores({ learning: 2.0, discipline: 2.0, hygiene: 1.0, customCriterion: neg })
        ).toThrowError(/SCORE_NEGATIVE_VALUE/);
      }
    });

    it('M1.7: Rejects malformed scores object with SCORE_INVALID_INPUT', () => {
      const invalidInputs = [
        null,
        undefined,
        'invalid_string',
        12345,
        true,
        false,
        () => {},
        Symbol('score'),
      ];

      for (const input of invalidInputs) {
        expect(() => validateScores(input as any)).toThrowError(/SCORE_INVALID_INPUT/);
      }
    });

    it('M1.8: Rejects non-numeric, NaN, null, undefined, strings inside criteria with SCORE_NON_NUMERIC', () => {
      const nonNumerics = [
        NaN,
        null,
        undefined,
        '4.0',
        '0',
        '-1',
        'abc',
        {},
        [],
        true,
        false,
        [1.0],
      ];

      for (const badVal of nonNumerics) {
        expect(() =>
          validateScores({ learning: badVal, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5 })
        ).toThrowError(/SCORE_NON_NUMERIC/);

        expect(() =>
          validateScores({ learning: 2.0, discipline: badVal, hygiene: 1.0, customCriterion: 0.5 })
        ).toThrowError(/SCORE_NON_NUMERIC/);

        expect(() =>
          validateScores({ learning: 2.0, discipline: 2.0, hygiene: badVal, customCriterion: 0.5 })
        ).toThrowError(/SCORE_NON_NUMERIC/);

        expect(() =>
          validateScores({ learning: 2.0, discipline: 2.0, hygiene: 1.0, customCriterion: badVal })
        ).toThrowError(/SCORE_NON_NUMERIC/);
      }
    });

    it('M1.9: Rejects incomplete scores object where one criterion is omitted (undefined)', () => {
      expect(() =>
        validateScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0 } as any)
      ).toThrowError(/SCORE_NON_NUMERIC/);

      expect(() =>
        validateScores({ discipline: 3.0, hygiene: 2.0, customCriterion: 1.0 } as any)
      ).toThrowError(/SCORE_NON_NUMERIC/);
    });
  });

  // =========================================================================
  // MISSION 2: Global sum limit (Sum <= 10.0)
  // =========================================================================
  describe('Mission 2: Global Sum Ceiling Enforcement (Total <= 10.0)', () => {
    it('M2.1: Rejects sum > 10.0 when customMax is raised to 2.0 (e.g. 4.0 + 3.0 + 2.0 + 1.5 = 10.5)', () => {
      const configWithHigherCustom: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        customMax: 2.0,
      };

      expect(() =>
        validateScores(
          { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.5 },
          configWithHigherCustom
        )
      ).toThrowError(/SCORE_TOTAL_EXCEEDS_10/);
    });

    it('M2.2: Rejects total sum just above 10.0 (10.01) with SCORE_TOTAL_EXCEEDS_10', () => {
      const config: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        customMax: 2.0,
      };

      // 4.0 + 3.0 + 2.0 + 1.01 = 10.01
      expect(() =>
        validateScores(
          { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.01 },
          config
        )
      ).toThrowError(/SCORE_TOTAL_EXCEEDS_10/);
    });

    it('M2.3: Rejects extreme sum when customMax is set to 5.0 (4.0 + 3.0 + 2.0 + 5.0 = 14.0)', () => {
      const config5: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        customMax: 5.0,
      };

      expect(() =>
        validateScores(
          { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 5.0 },
          config5
        )
      ).toThrowError(/SCORE_TOTAL_EXCEEDS_10/);
    });

    it('M2.4: Accepts score totaling exactly 10.0 when criteria are distributed validly', () => {
      const validDistributions = [
        { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0 },
        { learning: 3.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.5 }, // customMax = 2.0
        { learning: 2.5, discipline: 2.5, hygiene: 2.0, customCriterion: 3.0 }, // customMax = 3.0
        { learning: 1.0, discipline: 2.0, hygiene: 2.0, customCriterion: 5.0 }, // customMax = 5.0
      ];

      for (const dist of validDistributions) {
        const conf: ScoringConfig = {
          ...DEFAULT_SCORING_CONFIG,
          customMax: dist.customCriterion,
        };
        const res = validateScores(dist, conf);
        expect(res.total).toBe(10.0);
      }
    });
  });

  // =========================================================================
  // MISSION 3: Precision & IEEE 754 Floating Point Safeguards
  // =========================================================================
  describe('Mission 3: IEEE 754 Floating Point Arithmetic & Zero Drift Guarantee', () => {
    it('M3.1: Accurately calculates 0.1 + 0.2 + 0.0 + 0.0 without 0.30000000000000004 drift', () => {
      const rawJs = 0.1 + 0.2 + 0.0 + 0.0;
      expect(rawJs).not.toBe(0.3); // Raw JS produces 0.30000000000000004!

      const safeTotal = calculatePeriodTotal(0.1, 0.2, 0.0, 0.0);
      expect(safeTotal).toBe(0.3);
    });

    it('M3.2: Accurately calculates 0.7 + 0.1 + 0.1 + 0.1 without 0.9999999999999999 drift', () => {
      const rawJs = 0.7 + 0.1 + 0.1 + 0.1;
      expect(rawJs).not.toBe(1.0); // Standard JS fails this! (0.9999999999999999)

      const safeTotal = calculatePeriodTotal(0.7, 0.1, 0.1, 0.1);
      expect(safeTotal).toBe(1.0);
    });

    it('M3.3: Accurately calculates 3.5 + 2.5 + 1.5 + 0.5 = 8.0', () => {
      const safeTotal = calculatePeriodTotal(3.5, 2.5, 1.5, 0.5);
      expect(safeTotal).toBe(8.0);
    });

    it('M3.4: Accurately calculates 1.1 + 2.2 + 1.1 + 0.6 = 5.0 (1.1 + 2.2 is 3.3000000000000003 in JS)', () => {
      const safeTotal = calculatePeriodTotal(1.1, 2.2, 1.1, 0.6);
      expect(safeTotal).toBe(5.0);
    });

    it('M3.5: Accurately calculates 3.99 + 2.99 + 1.99 + 0.99 = 9.96', () => {
      const safeTotal = calculatePeriodTotal(3.99, 2.99, 1.99, 0.99);
      expect(safeTotal).toBe(9.96);
    });

    it('M3.6: Exhaustive stress generator: 500 combinations of random 2-decimal floats have zero drift', () => {
      for (let i = 0; i < 500; i++) {
        // Generate valid criteria within [0, max] with 2 decimal precision
        const l = Math.round((Math.random() * 4.0) * 100) / 100;
        const d = Math.round((Math.random() * 3.0) * 100) / 100;
        const h = Math.round((Math.random() * 2.0) * 100) / 100;
        const c = Math.round((Math.random() * 1.0) * 100) / 100;

        const total = calculatePeriodTotal(l, d, h, c);
        const expected = Number((Math.round((l + d + h + c) * 100) / 100).toFixed(2));

        expect(total).toBe(expected);
        // Verify string representation has at most 2 decimal places
        const decimals = (total.toString().split('.')[1] || '').length;
        expect(decimals).toBeLessThanOrEqual(2);
      }
    });
  });

  // =========================================================================
  // MISSION 4: Period Rating boundaries & exact transition points
  // =========================================================================
  describe('Mission 4: Period Rating Exact Transition Point Boundaries', () => {
    it('M4.1: Tests exact boundary 8.5 (Tốt) vs 8.49 (Khá)', () => {
      const ratingAt85 = getPeriodRating(8.5);
      expect(ratingAt85.level).toBe('TOT');
      expect(ratingAt85.labelVi).toBe('Tốt');
      expect(ratingAt85.labelEn).toBe('Good');

      const ratingAt849 = getPeriodRating(8.49);
      expect(ratingAt849.level).toBe('KHA');
      expect(ratingAt849.labelVi).toBe('Khá');
      expect(ratingAt849.labelEn).toBe('Fair');
    });

    it('M4.2: Tests exact boundary 6.5 (Khá) vs 6.49 (Trung bình)', () => {
      const ratingAt65 = getPeriodRating(6.5);
      expect(ratingAt65.level).toBe('KHA');
      expect(ratingAt65.labelVi).toBe('Khá');
      expect(ratingAt65.labelEn).toBe('Fair');

      const ratingAt649 = getPeriodRating(6.49);
      expect(ratingAt649.level).toBe('TRUNG_BINH');
      expect(ratingAt649.labelVi).toBe('Trung bình');
      expect(ratingAt649.labelEn).toBe('Average');
    });

    it('M4.3: Tests exact boundary 5.0 (Trung bình) vs 4.99 (Yếu)', () => {
      const ratingAt50 = getPeriodRating(5.0);
      expect(ratingAt50.level).toBe('TRUNG_BINH');
      expect(ratingAt50.labelVi).toBe('Trung bình');
      expect(ratingAt50.labelEn).toBe('Average');

      const ratingAt499 = getPeriodRating(4.99);
      expect(ratingAt499.level).toBe('YEU');
      expect(ratingAt499.labelVi).toBe('Yếu');
      expect(ratingAt499.labelEn).toBe('Poor');
    });

    it('M4.4: Tests 0.0 (Yếu) and bottom boundary', () => {
      const ratingAt0 = getPeriodRating(0.0);
      expect(ratingAt0.level).toBe('YEU');
      expect(ratingAt0.labelVi).toBe('Yếu');
      expect(ratingAt0.labelEn).toBe('Poor');
    });

    it('M4.5: Tests razor-edge epsilon boundaries around transitions', () => {
      // 8.5 transition
      expect(getPeriodRating(8.500001).level).toBe('TOT');
      expect(getPeriodRating(8.499999).level).toBe('KHA');

      // 6.5 transition
      expect(getPeriodRating(6.500001).level).toBe('KHA');
      expect(getPeriodRating(6.499999).level).toBe('TRUNG_BINH');

      // 5.0 transition
      expect(getPeriodRating(5.000001).level).toBe('TRUNG_BINH');
      expect(getPeriodRating(4.999999).level).toBe('YEU');

      // 10.0 max
      expect(getPeriodRating(10.0).level).toBe('TOT');
    });
  });

  // =========================================================================
  // MISSION 5: Validation Integration (validatePeriodEntry & assertValidPeriodEntry)
  // =========================================================================
  describe('Mission 5: High-Level Period Entry Validators Adversarial Testing', () => {
    const validBaseEntry = {
      periodIndex: 1,
      subject: 'Toán học',
      lessonTopic: 'Phương trình bậc nhất',
      teacherSignature: 'Nguyễn Văn A',
      teacherId: 'teacher_1',
      teacherName: 'Nguyễn Văn A',
      absentStudents: [],
    };

    it('M5.1: Functional validator returns SCORE_EXCEEDS_MAX in errors array', () => {
      const result = validatePeriodEntry({
        ...validBaseEntry,
        scores: { learning: 4.5, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5 } as any,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SCORE_EXCEEDS_MAX')).toBe(true);
      expect(result.validatedEntry).toBeUndefined();
    });

    it('M5.2: Functional validator returns SCORE_TOTAL_EXCEEDS_10 in errors array', () => {
      const customConfig: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, customMax: 2.0 };
      const result = validatePeriodEntry(
        {
          ...validBaseEntry,
          scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.5 } as any,
        },
        customConfig
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SCORE_TOTAL_EXCEEDS_10')).toBe(true);
      expect(result.validatedEntry).toBeUndefined();
    });

    it('M5.3: Functional validator returns SCORE_NEGATIVE_VALUE in errors array', () => {
      const result = validatePeriodEntry({
        ...validBaseEntry,
        scores: { learning: -0.5, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5 } as any,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SCORE_NEGATIVE_VALUE')).toBe(true);
      expect(result.validatedEntry).toBeUndefined();
    });

    it('M5.4: Functional validator returns SCORE_NON_NUMERIC when scores object is missing or invalid', () => {
      const result = validatePeriodEntry({
        ...validBaseEntry,
        scores: undefined as any,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SCORE_NON_NUMERIC')).toBe(true);
    });

    it('M5.5: Assert validator throws exact canonical error codes', () => {
      // Exceeds max
      expect(() =>
        assertValidPeriodEntry({
          ...validBaseEntry,
          scores: { learning: 4.2, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5 } as any,
        })
      ).toThrowError(/SCORE_EXCEEDS_MAX/);

      // Total exceeds 10
      expect(() =>
        assertValidPeriodEntry(
          {
            ...validBaseEntry,
            scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.5 } as any,
          },
          { ...DEFAULT_SCORING_CONFIG, customMax: 2.0 }
        )
      ).toThrowError(/SCORE_TOTAL_EXCEEDS_10/);

      // Negative
      expect(() =>
        assertValidPeriodEntry({
          ...validBaseEntry,
          scores: { learning: 3.0, discipline: -0.1, hygiene: 1.0, customCriterion: 0.5 } as any,
        })
      ).toThrowError(/SCORE_NEGATIVE_VALUE/);

      // Non-numeric
      expect(() =>
        assertValidPeriodEntry({
          ...validBaseEntry,
          scores: { learning: 'abc' as any, discipline: 2.0, hygiene: 1.0, customCriterion: 0.5, total: 0 } as any,
        })
      ).toThrowError(/SCORE_NON_NUMERIC/);
    });

    it('M5.6: Valid entry passes both validators with exact total calculation', () => {
      const entry = {
        ...validBaseEntry,
        scores: { learning: 3.5, discipline: 2.5, hygiene: 1.5, customCriterion: 0.5, total: 8.0 },
      };

      const result = validatePeriodEntry(entry);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.validatedEntry?.scores.total).toBe(8.0);

      const asserted = assertValidPeriodEntry(entry);
      expect(asserted.scores.total).toBe(8.0);
    });
  });

  // =========================================================================
  // MISSION 6: Immutability, Sanitization & Negative Zero Handling
  // =========================================================================
  describe('Mission 6: Immutability, Sanitization & Special Value Stress Tests', () => {
    it('M6.1: Strips unknown / injected properties from returned score object', () => {
      const rawWithInjection = {
        learning: 3.0,
        discipline: 2.0,
        hygiene: 1.0,
        customCriterion: 0.5,
        __injectedProp: 'malicious_payload',
        adminOverride: true,
      };

      const sanitized = validateScores(rawWithInjection as any);
      expect(sanitized.total).toBe(6.5);
      expect((sanitized as any).__injectedProp).toBeUndefined();
      expect((sanitized as any).adminOverride).toBeUndefined();
      expect(Object.keys(sanitized).sort()).toEqual([
        'customCriterion',
        'discipline',
        'hygiene',
        'learning',
        'total',
      ]);
    });

    it('M6.2: Correctly handles -0 and normalizes score evaluation', () => {
      const res = validateScores({
        learning: -0,
        discipline: 0,
        hygiene: 0,
        customCriterion: 0,
      });

      expect(res.total === 0).toBe(true);
      const rating = getPeriodRating(res.total);
      expect(rating.level).toBe('YEU');
    });

    it('M6.3: Large valid numbers sum up to 10.0 with decimal combinations', () => {
      const res = validateScores({
        learning: 3.75,
        discipline: 2.75,
        hygiene: 1.5,
        customCriterion: 1.0,
      });

      expect(res.total).toBe(9.0);
      expect(getPeriodRating(res.total).level).toBe('TOT');
    });
  });
});
