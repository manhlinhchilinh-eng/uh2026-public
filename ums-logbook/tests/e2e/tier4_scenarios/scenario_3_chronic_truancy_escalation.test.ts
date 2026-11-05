/**
 * Tier 4: Real-World Application Scenario 3 - Chronic Truancy & Discipline Escalation
 * Simulates a student developing repeated truancy and behavioral issues over a week:
 * - Monday: Cuts class (K in pre-session). Negative note 1 from GVBM.
 * - Tuesday: Cuts class (K in pre-session). Negative note 2 from TPT.
 * - Wednesday: Attends, but disrupts class. Negative note 3 from GVBM.
 *   -> Triggers discipline alert (>=3 negative notes). Attendance alert still false (2 K's).
 * - Thursday: Cuts class again (3rd K).
 *   -> Triggers attendance alert (>=3 unexcused absences). Both flags now active!
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T4-SCEN-03: Multi-day violation progression activates early warning flags predictably', () => {
  const engine = new UMSContractEngine();
  const classId = '6A1';
  const targetStudentId = '269048'; // Đinh Minh Tùng

  const gvcnSession = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(gvcnSession.token, DEFAULT_PASSWORD, 'GvcnPass2026!');

  const tptSession = engine.login('mrhoanglongums', DEFAULT_PASSWORD);
  engine.changePassword(tptSession.token, DEFAULT_PASSWORD, 'TptPass2026!');

  // --- DAY 1: Monday (2026-10-05) ---
  // Pre-session: K
  engine.recordPreSessionAttendance(gvcnSession.token, classId, '2026-10-05', [
    { studentId: targetStudentId, studentName: 'Đinh Minh Tùng', type: 'K', note: 'Nghỉ không phép' },
  ]);
  // GVBM note 1
  engine.createBehaviorNote(gvcnSession.token, {
    studentId: targetStudentId,
    studentName: 'Đinh Minh Tùng',
    classId,
    type: 'negative',
    category: 'Bài tập',
    description: 'Không làm bài tập về nhà 3 buổi liên tiếp',
  });

  let alerts = engine.evaluateStudentAlerts(classId, targetStudentId);
  assert.strictEqual(alerts.unexcusedAbsenceCount, 1);
  assert.strictEqual(alerts.negativeNoteCount, 1);
  assert.strictEqual(alerts.attendanceAlert, false);
  assert.strictEqual(alerts.disciplineAlert, false);

  // --- DAY 2: Tuesday (2026-10-06) ---
  // Pre-session: K
  engine.recordPreSessionAttendance(gvcnSession.token, classId, '2026-10-06', [
    { studentId: targetStudentId, studentName: 'Đinh Minh Tùng', type: 'K', note: 'Nghỉ không phép' },
  ]);
  // TPT note 2 (campus patrol)
  engine.createBehaviorNote(tptSession.token, {
    studentId: targetStudentId,
    studentName: 'Đinh Minh Tùng',
    classId,
    type: 'negative',
    category: 'Nề nếp',
    description: 'Thấy tụ tập bên ngoài cổng trường giờ tự học, không mặc đồng phục',
  });

  alerts = engine.evaluateStudentAlerts(classId, targetStudentId);
  assert.strictEqual(alerts.unexcusedAbsenceCount, 2);
  assert.strictEqual(alerts.negativeNoteCount, 2);
  assert.strictEqual(alerts.attendanceAlert, false);
  assert.strictEqual(alerts.disciplineAlert, false);

  // --- DAY 3: Wednesday (2026-10-07) ---
  // Student comes to school (no absence), but commits classroom disruption
  engine.createBehaviorNote(gvcnSession.token, {
    studentId: targetStudentId,
    studentName: 'Đinh Minh Tùng',
    classId,
    type: 'negative',
    category: 'Kỷ luật',
    description: 'Sử dụng điện thoại di động trong giờ học Ngữ văn, cãi lại giáo viên',
  });

  alerts = engine.evaluateStudentAlerts(classId, targetStudentId);
  assert.strictEqual(alerts.unexcusedAbsenceCount, 2);
  assert.strictEqual(alerts.negativeNoteCount, 3);
  assert.strictEqual(alerts.attendanceAlert, false, 'Attendance alert still false (2 unexcused)');
  assert.strictEqual(alerts.disciplineAlert, true, 'Discipline alert ACTIVE on 3rd negative note');

  // --- DAY 4: Thursday (2026-10-08) ---
  // Student cuts class again (3rd K)
  engine.recordPreSessionAttendance(gvcnSession.token, classId, '2026-10-08', [
    { studentId: targetStudentId, studentName: 'Đinh Minh Tùng', type: 'K', note: 'Nghỉ không phép' },
  ]);

  alerts = engine.evaluateStudentAlerts(classId, targetStudentId);
  assert.strictEqual(alerts.unexcusedAbsenceCount, 3);
  assert.strictEqual(alerts.negativeNoteCount, 3);
  assert.strictEqual(alerts.attendanceAlert, true, 'Attendance alert ACTIVE on 3rd unexcused absence');
  assert.strictEqual(alerts.disciplineAlert, true, 'Discipline alert remains ACTIVE');
});
