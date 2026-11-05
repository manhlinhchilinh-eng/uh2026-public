/**
 * UMS Digital Class Logbook - Period Scoring Engine
 * File: src/utils/scoring.ts
 *
 * Implements 4-criteria period scoring, decimal precision arithmetic,
 * rating classification, and dynamic 4th criterion binding.
 */

import { PeriodScore, PeriodRatingLevel } from '../types/logbook';

export interface ScoringConfig {
  learningMax: number; // default 4.0
  disciplineMax: number; // default 3.0
  hygieneMax: number; // default 2.0
  customMax: number; // default 1.0 (admin configurable 0.0 - 5.0)
  customLabel: string; // default 'Hoạt động / Chuyên cần'
  customLabelEn: string; // default 'Activities / Diligence'
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  learningMax: 4.0,
  disciplineMax: 3.0,
  hygieneMax: 2.0,
  customMax: 1.0,
  customLabel: 'Hoạt động / Chuyên cần',
  customLabelEn: 'Activities / Diligence',
};

export interface PeriodRatingInfo {
  level: PeriodRatingLevel;
  labelVi: string;
  labelEn: string;
  badgeClass: string;
  solidClass: string;
  textColor: string;
}

export const RATING_DEFINITIONS: Record<PeriodRatingLevel, PeriodRatingInfo> = {
  TOT: {
    level: 'TOT',
    labelVi: 'Tốt',
    labelEn: 'Good',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    solidClass: 'bg-emerald-600 text-white',
    textColor: 'text-emerald-700',
  },
  KHA: {
    level: 'KHA',
    labelVi: 'Khá',
    labelEn: 'Fair',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    solidClass: 'bg-blue-600 text-white',
    textColor: 'text-blue-700',
  },
  TRUNG_BINH: {
    level: 'TRUNG_BINH',
    labelVi: 'Trung bình',
    labelEn: 'Average',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    solidClass: 'bg-amber-500 text-white',
    textColor: 'text-amber-700',
  },
  YEU: {
    level: 'YEU',
    labelVi: 'Yếu',
    labelEn: 'Poor',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    solidClass: 'bg-rose-600 text-white',
    textColor: 'text-rose-700',
  },
};

/** Bước chấm điểm tiết: 0,5 (góp ý GV 30/10 — trước đây bậc 1). */
export const SCORE_STEP = 0.5;

/** Làm tròn điểm nhập về bậc 0,5 gần nhất, kẹp trong [0, max]; ô trống/không phải số → 0. */
export function roundScoreInput(raw: string | number, max: number): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n / SCORE_STEP) * SCORE_STEP;
  return Math.min(max, Math.max(0, r));
}

/**
 * Calculates sum of 4 criteria with 2-decimal floating point safeguard.
 */
export function calculatePeriodTotal(
  learning: number,
  discipline: number,
  hygiene: number,
  customCriterion: number
): number {
  return Math.round((learning + discipline + hygiene + customCriterion) * 100) / 100;
}

/**
 * Classifies a total score into one of the 4 MOET period evaluation rating tiers.
 */
export function getPeriodRating(totalScore: number): PeriodRatingInfo {
  if (totalScore >= 8.5) {
    return RATING_DEFINITIONS.TOT;
  }
  if (totalScore >= 6.5) {
    return RATING_DEFINITIONS.KHA;
  }
  if (totalScore >= 5.0) {
    return RATING_DEFINITIONS.TRUNG_BINH;
  }
  return RATING_DEFINITIONS.YEU;
}

/**
 * Validates raw score inputs against configuration ceilings and constraints.
 * Throws contract-compliant Error matching UMS contract test specifications.
 */
export function validateScores(
  rawScores: any,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): PeriodScore {
  if (!rawScores || typeof rawScores !== 'object') {
    throw new Error('SCORE_INVALID_INPUT: Scores object must be provided.');
  }

  const { learning, discipline, hygiene, customCriterion } = rawScores;
  const items = [
    { name: 'learning', val: learning, max: config.learningMax },
    { name: 'discipline', val: discipline, max: config.disciplineMax },
    { name: 'hygiene', val: hygiene, max: config.hygieneMax },
    { name: 'customCriterion', val: customCriterion, max: config.customMax },
  ];

  for (const item of items) {
    if (typeof item.val !== 'number' || isNaN(item.val)) {
      throw new Error(`SCORE_NON_NUMERIC: Criterion "${item.name}" must be a valid number, got ${item.val}`);
    }
    if (item.val < 0) {
      throw new Error(`SCORE_NEGATIVE_VALUE: Criterion "${item.name}" cannot be negative (${item.val})`);
    }
    if (item.val > item.max) {
      throw new Error(
        `SCORE_EXCEEDS_MAX: Criterion "${item.name}" value ${item.val} exceeds maximum allowed ceiling of ${item.max}`
      );
    }
  }

  const sum = calculatePeriodTotal(learning, discipline, hygiene, customCriterion);
  if (sum > 10.0) {
    throw new Error(`SCORE_TOTAL_EXCEEDS_10: Total period score ${sum} exceeds maximum allowed of 10.0`);
  }

  return {
    learning,
    discipline,
    hygiene,
    customCriterion,
    total: sum,
  };
}
