/**
 * Tier 3: Cross-Feature - Dynamic Scoring Config & Period Validation Propagation
 * Interaction: Admin adjusts 4th criterion max -> period scoring validates against new ceiling.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';
import { assertThrowsContractError } from '../harness/assertions.ts';

test('T3-COMB-13: Admin lowers custom max to 0.5; period score of 1.0 is rejected', () => {
  const engine = new UMSContractEngine();
  const admin = engine.login('mrlinhums', DEFAULT_PASSWORD);
  engine.changePassword(admin.token, DEFAULT_PASSWORD, 'AdminPass2026!');

  // Admin configures 4th criterion max to 0.5
  engine.updateScoringConfig(admin.token, { customMax: 0.5, customLabel: 'Nề nếp' });

  const teacher = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(teacher.token, DEFAULT_PASSWORD, 'TeacherPass2026!');

  // Submitting 1.0 for customCriterion should now fail
  assertThrowsContractError(
    () =>
      engine.submitPeriodEntry(teacher.token, {
        classId: '6A1',
        date: '2026-10-05',
        periodIndex: 1,
        subject: 'Tin học',
        lessonTopic: 'Làm quen bảng tính',
        scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
        teacherComment: 'Tốt',
        teacherSignature: 'Đinh Hoài Long',
      }),
    'SCORE_EXCEEDS_MAX'
  );
});

test('T3-COMB-14: Submitting custom score conforming to newly configured ceiling succeeds', () => {
  const engine = new UMSContractEngine();
  const admin = engine.login('mrlinhums', DEFAULT_PASSWORD);
  engine.changePassword(admin.token, DEFAULT_PASSWORD, 'AdminPass2026!');

  engine.updateScoringConfig(admin.token, { customMax: 0.5 });

  const teacher = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(teacher.token, DEFAULT_PASSWORD, 'TeacherPass2026!');

  const periodEntry = engine.submitPeriodEntry(teacher.token, {
    classId: '6A1',
    date: '2026-10-05',
    periodIndex: 1,
    subject: 'Tin học',
    lessonTopic: 'Làm quen bảng tính',
    scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 0.5, total: 9.5 },
    teacherComment: 'Tốt',
    teacherSignature: 'Đinh Hoài Long',
  });

  assert.strictEqual(periodEntry.scores.customCriterion, 0.5);
  assert.strictEqual(periodEntry.scores.total, 9.5);
});

test('T3-COMB-15: Non-admin cannot modify custom scoring criteria even if they are GVCN', () => {
  const engine = new UMSContractEngine();
  const teacher = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(teacher.token, DEFAULT_PASSWORD, 'TeacherPass2026!');

  assertThrowsContractError(
    () => engine.updateScoringConfig(teacher.token, { customMax: 0.5 }),
    'AUTH_FORBIDDEN'
  );
});
