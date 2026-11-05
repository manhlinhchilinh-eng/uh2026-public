/**
 * Tier 4: Real-World Application Scenario 4 - Dual-Role Teacher (Admin + GVCN + GVBM) Workflow
 * Simulates a complex day of teacher mrlinhums:
 * 1. Initial login -> forces password change.
 * 2. As GVCN of 8A3: takes pre-session attendance for 8A3.
 * 3. As GVBM for Math in 6A1: teaches Period 2, enters lesson topic & score, writes praise note.
 * 4. As Admin: inspects audit trail and reconfigures school-wide scoring criteria.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T4-SCEN-04: Dual-role teacher seamlessly executes multi-hat duties', () => {
  const engine = new UMSContractEngine();
  const date = '2026-10-07';

  // 1. Initial login -> must change password
  const initialSession = engine.login('mrlinhums', DEFAULT_PASSWORD);
  assert.strictEqual(initialSession.user.mustChangePassword, true);

  engine.changePassword(initialSession.token, DEFAULT_PASSWORD, 'AdminLinh2026!');
  const activeSession = engine.validateSession(initialSession.token);
  assert.strictEqual(activeSession.user.mustChangePassword, false);

  // 2. Hat 1: GVCN of Class 8A3 - Pre-session attendance
  const baseline8A3 = engine.recordPreSessionAttendance(
    activeSession.token,
    '8A3',
    date,
    [{ studentId: '249694', studentName: 'Phan Hải Định', type: 'P', note: 'Xin nghỉ phép' }]
  );
  assert.strictEqual(baseline8A3.absences.length, 1);

  // 3. Hat 2: GVBM of Math teaching in Class 6A1 (Period 2)
  const mathEntry = engine.submitPeriodEntry(activeSession.token, {
    classId: '6A1',
    date,
    periodIndex: 2,
    subject: 'Toán học',
    ppctLessonIndex: 20,
    lessonTopic: 'Quy tắc cộng và nhân các số nguyên',
    scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
    teacherComment: 'Học sinh rất tập trung, hiểu bài tốt',
    teacherSignature: 'Hồ Thanh Quang Uyên (Mr. Linh)',
  });
  assert.strictEqual(mathEntry.subject, 'Toán học');
  assert.strictEqual(mathEntry.isSigned, true);

  // Leave praise note for 6A1 student Lý Bảo Duy
  const note = engine.createBehaviorNote(activeSession.token, {
    studentId: '269398',
    studentName: 'Lý Bảo Duy',
    classId: '6A1',
    type: 'positive',
    category: 'Khen ngợi',
    description: 'Giải được bài toán tư duy nâng cao trong 2 phút',
  });
  assert.strictEqual(note.studentId, '269398');

  // 4. Hat 3: School Admin - Reconfigures 4th criterion and inspects audit log
  engine.updateScoringConfig(activeSession.token, {
    customLabel: 'Ý thức tự quản',
    customMax: 1.0,
  });

  const auditLogs = engine.getAuditLogs();
  const userLogs = auditLogs.filter((l) => l.actorId === activeSession.user.uid);
  
  assert.ok(userLogs.some((l) => l.action === 'PASSWORD_CHANGE'), 'Audit must contain password change');
  assert.ok(userLogs.some((l) => l.targetCollection === 'daily_logbooks'), 'Audit must contain 8A3 attendance');
  assert.ok(userLogs.some((l) => l.targetCollection === 'periods'), 'Audit must contain 6A1 period entry');
  assert.ok(userLogs.some((l) => l.targetCollection === 'behavior_notes'), 'Audit must contain praise note');
});
