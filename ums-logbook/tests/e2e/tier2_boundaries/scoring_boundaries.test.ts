/**
 * Tier 2: Boundary & Corner Cases - Period Scoring Engine
 * Requirements: ORIGINAL_REQUEST.md (R1), PROJECT.md (F12, F14)
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { assertThrowsContractError } from '../harness/assertions.ts';

test('T2-SCORE-01: Rejection when Learning (Học tập) score exceeds 4.0 ceiling', () => {
  const engine = new UMSContractEngine();

  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: 4.5,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 0.5,
      }),
    'SCORE_EXCEEDS_MAX'
  );
});

test('T2-SCORE-02: Rejection when Discipline (Kỷ luật) score exceeds 3.0 ceiling', () => {
  const engine = new UMSContractEngine();

  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: 3.0,
        discipline: 3.5,
        hygiene: 2.0,
        customCriterion: 0.5,
      }),
    'SCORE_EXCEEDS_MAX'
  );
});

test('T2-SCORE-03: Rejection when Hygiene/Awareness score exceeds 2.0 ceiling', () => {
  const engine = new UMSContractEngine();

  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: 3.0,
        discipline: 2.0,
        hygiene: 2.5,
        customCriterion: 0.5,
      }),
    'SCORE_EXCEEDS_MAX'
  );
});

test('T2-SCORE-04: Rejection when Custom 4th criterion exceeds configured ceiling (1.0)', () => {
  const engine = new UMSContractEngine();

  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: 3.0,
        discipline: 2.0,
        hygiene: 1.0,
        customCriterion: 1.5,
      }),
    'SCORE_EXCEEDS_MAX'
  );
});

test('T2-SCORE-05: Rejection when total sum exceeds 10.0', () => {
  const engine = new UMSContractEngine();
  const admin = engine.login('mrlinhums', 'demo@2026');
  engine.changePassword(admin.token, 'demo@2026', 'AdminPass2026!');
  
  // Set custom max to 2.0
  engine.updateScoringConfig(admin.token, { customMax: 2.0 });

  // Sum = 4.0 + 3.0 + 2.0 + 1.5 = 10.5 > 10.0
  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.5,
      }),
    'SCORE_TOTAL_EXCEEDS_10'
  );
});

test('T2-SCORE-06: Rejection of negative score values', () => {
  const engine = new UMSContractEngine();

  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: -0.5,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
      }),
    'SCORE_NEGATIVE_VALUE'
  );

  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: 4.0,
        discipline: -1.0,
        hygiene: 2.0,
        customCriterion: 1.0,
      }),
    'SCORE_NEGATIVE_VALUE'
  );
});

test('T2-SCORE-07: Rejection of non-numeric, NaN, or null inputs', () => {
  const engine = new UMSContractEngine();

  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: NaN,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
      }),
    'SCORE_NON_NUMERIC'
  );

  assertThrowsContractError(
    () =>
      engine.validateScores({
        learning: '4.0' as any,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
      }),
    'SCORE_NON_NUMERIC'
  );

  assertThrowsContractError(
    () => engine.validateScores(null as any),
    'SCORE_INVALID_INPUT'
  );
});
