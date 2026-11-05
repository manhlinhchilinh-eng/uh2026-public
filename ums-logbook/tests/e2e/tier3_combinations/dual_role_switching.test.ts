/**
 * Tier 3: Cross-Feature - Dual-Role Context Switching (Admin + GVCN + GVBM)
 * Interaction: User mrlinhums operates as Admin, GVCN of 8A3, and GVBM in 6A1.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T3-COMB-16: Dual-role user can record pre-session attendance for their assigned class 8A3', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('mrlinhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'AdminLinh2026!');

  const baseline = engine.recordPreSessionAttendance(
    session.token,
    '8A3',
    '2026-10-05',
    [{ studentId: '249694', studentName: 'Phan Hải Định', type: 'P' }]
  );

  assert.strictEqual(baseline.absences.length, 1);
  assert.strictEqual(baseline.absences[0].studentId, '249694');
});

test('T3-COMB-17: Dual-role user can act as GVBM and score period in another class 6A1', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('mrlinhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'AdminLinh2026!');

  const periodEntry = engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date: '2026-10-05',
    periodIndex: 3,
    subject: 'Toán học',
    ppctLessonIndex: 15,
    lessonTopic: 'Lũy thừa với số mũ tự nhiên',
    scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
    teacherComment: 'Học sinh hiểu bài nhanh',
    teacherSignature: 'Hồ Thanh Quang Uyên',
  });

  assert.strictEqual(periodEntry.periodIndex, 3);
  assert.strictEqual(periodEntry.subject, 'Toán học');
  assert.strictEqual(periodEntry.isSigned, true);
});

test('T3-COMB-18: Dual-role user can exercise Admin privileges to configure school-wide criteria', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('mrlinhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'AdminLinh2026!');

  const newConfig = engine.updateScoringConfig(session.token, {
    customLabel: 'Phong trào thể thao',
    customMax: 1.5,
  });

  assert.strictEqual(newConfig.customLabel, 'Phong trào thể thao');
  assert.strictEqual(newConfig.customMax, 1.5);
});
