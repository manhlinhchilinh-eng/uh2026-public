/**
 * Tier 3: Cross-Feature - Attendance Tracking & Attendance Alert Triggers
 * Interaction: Accumulation of >=3 unexcused absences (K) triggers attendance alert; P does not.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T3-COMB-10: Student with 2 unexcused absences does not trigger attendance alert', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  // Day 1: K in pre-session
  engine.recordPreSessionAttendance(session.token, '6A1', '2026-10-05', [
    { studentId: '269048', studentName: 'Đinh Minh Tùng', type: 'K' },
  ]);

  // Day 2: K in pre-session
  engine.recordPreSessionAttendance(session.token, '6A1', '2026-10-06', [
    { studentId: '269048', studentName: 'Đinh Minh Tùng', type: 'K' },
  ]);

  const alerts = engine.evaluateStudentAlerts('6A1', '269048');
  assert.strictEqual(alerts.unexcusedAbsenceCount, 2);
  assert.strictEqual(alerts.attendanceAlert, false);
});

test('T3-COMB-11: 3rd unexcused absence (K) triggers weekly attendance early warning alert', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  // Days 1, 2, 3: K in pre-session
  for (let d = 5; d <= 7; d++) {
    engine.recordPreSessionAttendance(session.token, '6A1', `2026-10-0${d}`, [
      { studentId: '269048', studentName: 'Đinh Minh Tùng', type: 'K' },
    ]);
  }

  const alerts = engine.evaluateStudentAlerts('6A1', '269048');
  assert.strictEqual(alerts.unexcusedAbsenceCount, 3);
  assert.strictEqual(alerts.attendanceAlert, true, 'Attendance alert MUST trigger at >=3 unexcused absences');
});

test('T3-COMB-12: Excused absences (P) do not count toward unexcused alert threshold', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  // 5 days of excused absences (P)
  for (let d = 5; d <= 9; d++) {
    engine.recordPreSessionAttendance(session.token, '6A1', `2026-10-0${d}`, [
      { studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P' },
    ]);
  }

  const alerts = engine.evaluateStudentAlerts('6A1', '269398');
  assert.strictEqual(alerts.unexcusedAbsenceCount, 0);
  assert.strictEqual(alerts.attendanceAlert, false, 'Excused absences (P) must NOT trigger attendance alert');
});
