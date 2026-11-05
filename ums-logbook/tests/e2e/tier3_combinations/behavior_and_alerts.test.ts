/**
 * Tier 3: Cross-Feature - Behavior Notes & Early Warning Alert Triggers
 * Interaction: Accumulation of >=3 negative behavior notes in a week triggers discipline alert.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T3-COMB-07: Less than 3 negative notes does not trigger discipline alert', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  // Create 2 negative notes
  engine.createBehaviorNote(session.token, {
    studentId: '269048',
    studentName: 'Đinh Minh Tùng',
    classId: '6A1',
    type: 'negative',
    category: 'Mất trật tự',
    description: 'Vi phạm lần 1',
  });

  engine.createBehaviorNote(session.token, {
    studentId: '269048',
    studentName: 'Đinh Minh Tùng',
    classId: '6A1',
    type: 'negative',
    category: 'Quên bài',
    description: 'Vi phạm lần 2',
  });

  const alerts = engine.evaluateStudentAlerts('6A1', '269048');
  assert.strictEqual(alerts.negativeNoteCount, 2);
  assert.strictEqual(alerts.disciplineAlert, false, 'Discipline alert should not trigger with only 2 notes');
});

test('T3-COMB-08: Exactly 3 negative notes triggers discipline early warning alert', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  for (let i = 1; i <= 3; i++) {
    engine.createBehaviorNote(session.token, {
      studentId: '269048',
      studentName: 'Đinh Minh Tùng',
      classId: '6A1',
      type: 'negative',
      category: 'Vi phạm',
      description: `Vi phạm số ${i}`,
    });
  }

  const alerts = engine.evaluateStudentAlerts('6A1', '269048');
  assert.strictEqual(alerts.negativeNoteCount, 3);
  assert.strictEqual(alerts.disciplineAlert, true, 'Discipline alert MUST trigger at >=3 negative notes');
});

test('T3-COMB-09: Positive notes do not trigger discipline alert or increment violation count', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  for (let i = 1; i <= 5; i++) {
    engine.createBehaviorNote(session.token, {
      studentId: '269398',
      studentName: 'Lý Bảo Duy',
      classId: '6A1',
      type: 'positive',
      category: 'Khen ngợi',
      description: `Khen ngợi lần ${i}`,
    });
  }

  const alerts = engine.evaluateStudentAlerts('6A1', '269398');
  assert.strictEqual(alerts.negativeNoteCount, 0);
  assert.strictEqual(alerts.disciplineAlert, false);
});
