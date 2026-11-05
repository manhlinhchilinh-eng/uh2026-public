/**
 * Unit Tests: Period Scoring Engine
 * File: src/test/scoring.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePeriodTotal,
  getPeriodRating,
  validateScores,
  DEFAULT_SCORING_CONFIG,
  ScoringConfig,
} from '../utils/scoring';

describe('Scoring Engine Unit Tests', () => {
  it('correctly calculates total score with 2-decimal safety', () => {
    expect(calculatePeriodTotal(3.5, 2.5, 1.5, 0.5)).toBe(8.0);
    expect(calculatePeriodTotal(4.0, 3.0, 2.0, 1.0)).toBe(10.0);
    expect(calculatePeriodTotal(3.8, 2.7, 1.9, 0.9)).toBe(9.3);
    // IEEE 754 precision safeguard
    expect(calculatePeriodTotal(0.1, 0.2, 0.1, 0.1)).toBe(0.5);
  });

  describe('Period Rating Classification', () => {
    it('classifies scores >= 8.5 as TOT (Good / Emerald)', () => {
      const r1 = getPeriodRating(10.0);
      expect(r1.level).toBe('TOT');
      expect(r1.labelVi).toBe('Tốt');
      expect(r1.labelEn).toBe('Good');

      const r2 = getPeriodRating(8.5);
      expect(r2.level).toBe('TOT');
    });

    it('classifies scores in [6.5, 8.5) as KHA (Fair / Blue)', () => {
      const r1 = getPeriodRating(8.4);
      expect(r1.level).toBe('KHA');
      expect(r1.labelVi).toBe('Khá');
      expect(r1.labelEn).toBe('Fair');

      const r2 = getPeriodRating(6.5);
      expect(r2.level).toBe('KHA');
    });

    it('classifies scores in [5.0, 6.5) as TRUNG_BINH (Average / Amber)', () => {
      const r1 = getPeriodRating(6.4);
      expect(r1.level).toBe('TRUNG_BINH');
      expect(r1.labelVi).toBe('Trung bình');
      expect(r1.labelEn).toBe('Average');

      const r2 = getPeriodRating(5.0);
      expect(r2.level).toBe('TRUNG_BINH');
    });

    it('classifies scores < 5.0 as YEU (Poor / Rose)', () => {
      const r1 = getPeriodRating(4.9);
      expect(r1.level).toBe('YEU');
      expect(r1.labelVi).toBe('Yếu');
      expect(r1.labelEn).toBe('Poor');

      const r2 = getPeriodRating(0.0);
      expect(r2.level).toBe('YEU');
    });
  });

  describe('validateScores Boundaries & Rejections', () => {
    it('accepts valid score combination totaling <= 10.0', () => {
      const validated = validateScores({
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
      });
      expect(validated.total).toBe(10.0);
      expect(validated.learning).toBe(4.0);
      expect(validated.discipline).toBe(3.0);
      expect(validated.hygiene).toBe(2.0);
      expect(validated.customCriterion).toBe(1.0);
    });

    it('rejects missing or invalid scores object', () => {
      expect(() => validateScores(null)).toThrowError(/SCORE_INVALID_INPUT/);
      expect(() => validateScores(undefined)).toThrowError(/SCORE_INVALID_INPUT/);
      expect(() => validateScores('invalid')).toThrowError(/SCORE_INVALID_INPUT/);
    });

    it('rejects learning score exceeding 4.0', () => {
      expect(() =>
        validateScores({ learning: 4.5, discipline: 3.0, hygiene: 2.0, customCriterion: 0.5 })
      ).toThrowError(/SCORE_EXCEEDS_MAX/);
    });

    it('rejects discipline score exceeding 3.0', () => {
      expect(() =>
        validateScores({ learning: 3.0, discipline: 3.5, hygiene: 2.0, customCriterion: 0.5 })
      ).toThrowError(/SCORE_EXCEEDS_MAX/);
    });

    it('rejects hygiene score exceeding 2.0', () => {
      expect(() =>
        validateScores({ learning: 3.0, discipline: 2.0, hygiene: 2.5, customCriterion: 0.5 })
      ).toThrowError(/SCORE_EXCEEDS_MAX/);
    });

    it('rejects custom criterion exceeding ceiling', () => {
      expect(() =>
        validateScores({ learning: 3.0, discipline: 2.0, hygiene: 1.0, customCriterion: 1.5 })
      ).toThrowError(/SCORE_EXCEEDS_MAX/);
    });

    it('rejects negative scores', () => {
      expect(() =>
        validateScores({ learning: -0.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0 })
      ).toThrowError(/SCORE_NEGATIVE_VALUE/);

      expect(() =>
        validateScores({ learning: 3.0, discipline: -1, hygiene: 2.0, customCriterion: 1.0 })
      ).toThrowError(/SCORE_NEGATIVE_VALUE/);
    });

    it('rejects non-numeric inputs', () => {
      expect(() =>
        validateScores({ learning: '4.0', discipline: 3.0, hygiene: 2.0, customCriterion: 1.0 })
      ).toThrowError(/SCORE_NON_NUMERIC/);

      expect(() =>
        validateScores({ learning: NaN, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0 })
      ).toThrowError(/SCORE_NON_NUMERIC/);
    });

    it('rejects total exceeding 10.0 when customMax is raised', () => {
      const customConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        customMax: 2.0,
      };
      // 4.0 + 3.0 + 2.0 + 1.5 = 10.5 > 10.0
      expect(() =>
        validateScores(
          { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.5 },
          customConfig
        )
      ).toThrowError(/SCORE_TOTAL_EXCEEDS_10/);
    });
  });
});
