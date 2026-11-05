/**
 * Tier 1: Feature Coverage - Period Scoring Engine
 * Requirements: ORIGINAL_REQUEST.md (R1), PROJECT.md (F8, F12, F13, F14)
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';
import { assertValidScoreSum } from '../harness/assertions.ts';

test('T1-SCORE-01: Standard maximum period score totaling 10.0 passes validation', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const scores = engine.validateScores({
    learning: 4.0,
    discipline: 3.0,
    hygiene: 2.0,
    customCriterion: 1.0,
  });

  assertValidScoreSum(4.0, 3.0, 2.0, 1.0, scores.total);
  assert.strictEqual(scores.total, 10.0);
});

test('T1-SCORE-02: Typical intermediate period score calculates correctly', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const scores = engine.validateScores({
    learning: 3.5,
    discipline: 2.5,
    hygiene: 1.5,
    customCriterion: 0.5,
  });

  assertValidScoreSum(3.5, 2.5, 1.5, 0.5, scores.total);
  assert.strictEqual(scores.total, 8.0);
});

test('T1-SCORE-03: Decimal step scores (0.5 increments) round accurately without floating precision errors', () => {
  const engine = new UMSContractEngine();
  const scores = engine.validateScores({
    learning: 3.5,
    discipline: 2.5,
    hygiene: 1.5,
    customCriterion: 1.0,
  });

  assert.strictEqual(scores.total, 8.5);
});

test('T1-SCORE-04: Period entry successfully records subject, PPCT, topic, and teacher signature', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const periodEntry = engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date: '2026-10-05',
    periodIndex: 1,
    subject: 'Ngữ văn',
    ppctLessonIndex: 12,
    lessonTopic: 'Thánh Gióng - Tượng đài anh hùng dân tộc',
    scores: {
      learning: 4.0,
      discipline: 3.0,
      hygiene: 2.0,
      customCriterion: 1.0,
      total: 10.0,
    },
    teacherComment: 'Lớp trật tự, chuẩn bị bài chu đáo',
    teacherSignature: 'Đinh Hoài Long',
  });

  assert.strictEqual(periodEntry.periodIndex, 1);
  assert.strictEqual(periodEntry.subject, 'Ngữ văn');
  assert.strictEqual(periodEntry.ppctLessonIndex, 12);
  assert.strictEqual(periodEntry.isSigned, true);
  assert.strictEqual(periodEntry.scores.total, 10.0);
});

test('T1-SCORE-05: Submitting all 8 periods marks the daily logbook as completed', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const date = '2026-10-05';
  for (let p = 1; p <= 8; p++) {
    engine.submitPeriodEntry(session.token, {
      classId: '6A1',
      date,
      periodIndex: p,
      subject: `Môn học ${p}`,
      lessonTopic: `Bài học ${p}`,
      scores: { learning: 3.5, discipline: 2.5, hygiene: 2.0, customCriterion: 1.0, total: 9.0 },
      teacherComment: 'Đạt yêu cầu',
      teacherSignature: 'GV Môn',
    });
  }

  const logbook = engine.getDailyLogbook('6A1', date);
  assert.ok(logbook);
  assert.strictEqual(Object.keys(logbook.periods).length, 8);
  assert.strictEqual(logbook.isCompleted, true);
});

test('T1-SCORE-06: Configurable 4th criterion reflects custom label and max points', () => {
  const engine = new UMSContractEngine();
  const adminSession = engine.login('mrlinhums', DEFAULT_PASSWORD);
  engine.changePassword(adminSession.token, DEFAULT_PASSWORD, 'Admin2026!');

  engine.updateScoringConfig(adminSession.token, {
    customLabel: 'Đồng phục & Nề nếp',
    customMax: 0.5,
  });

  const updatedConfig = engine.getScoringConfig();
  assert.strictEqual(updatedConfig.customLabel, 'Đồng phục & Nề nếp');
  assert.strictEqual(updatedConfig.customMax, 0.5);

  // Validation with new customMax 0.5
  const validScores = engine.validateScores({
    learning: 4.0,
    discipline: 3.0,
    hygiene: 2.0,
    customCriterion: 0.5,
  });
  assert.strictEqual(validScores.total, 9.5);
});
