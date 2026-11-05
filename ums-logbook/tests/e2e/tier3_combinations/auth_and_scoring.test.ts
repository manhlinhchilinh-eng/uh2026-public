/**
 * Tier 3: Cross-Feature - Auth Security Gate + Period Scoring
 * Interaction: Password change gate prevents period score submission until completed.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';
import { assertThrowsContractError } from '../harness/assertions.ts';

test('T3-COMB-01: Period score submission is strictly blocked until mandatory password change is fulfilled', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);

  // Attempt to submit period while mustChangePassword is true
  assertThrowsContractError(
    () =>
      engine.submitPeriodEntry(session.token, {
        classId: '6A1',
        date: '2026-10-05',
        periodIndex: 1,
        subject: 'Toán',
        lessonTopic: 'Số tự nhiên',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
        teacherComment: 'Tốt',
        teacherSignature: 'Đinh Hoài Long',
      }),
    'AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED'
  );
});

test('T3-COMB-02: After password change, period submission succeeds immediately without re-login', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);

  engine.changePassword(session.token, DEFAULT_PASSWORD, 'TeacherPass2026!');

  const periodEntry = engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date: '2026-10-05',
    periodIndex: 1,
    subject: 'Toán',
    lessonTopic: 'Số tự nhiên',
    scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
    teacherComment: 'Tốt',
    teacherSignature: 'Đinh Hoài Long',
  });

  assert.strictEqual(periodEntry.periodIndex, 1);
  assert.strictEqual(periodEntry.isSigned, true);
});

test('T3-COMB-03: Audit log captures complete chain from login to password change to period entry', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'TeacherPass2026!');

  engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date: '2026-10-05',
    periodIndex: 1,
    subject: 'Văn',
    lessonTopic: 'Truyền thuyết',
    scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
    teacherComment: 'Tốt',
    teacherSignature: 'Đinh Hoài Long',
  });

  const logs = engine.getAuditLogs();
  const actions = logs.map((l) => l.action);

  assert.ok(actions.includes('LOGIN'), 'Audit must include LOGIN');
  assert.ok(actions.includes('PASSWORD_CHANGE'), 'Audit must include PASSWORD_CHANGE');
  assert.ok(actions.includes('CREATE'), 'Audit must include period CREATE');
});
