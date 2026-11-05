/**
 * Tier 3: Cross-Feature - Pre-session Baseline & Period Attendance Reconciliation
 * Interaction: Pre-session absences set daily baseline; period absences record per-period events.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T3-COMB-04: Pre-session absences coexist with period-specific late entries', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const date = '2026-10-06';
  // GVCN records Lý Bảo Duy absent P in morning roll-call
  engine.recordPreSessionAttendance(session.token, '6A1', date, [
    { studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P' },
  ]);

  // In period 1, GVBM notes Đinh Minh Tùng arrived late
  engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date,
    periodIndex: 1,
    subject: 'Khoa học tự nhiên',
    lessonTopic: 'Đo lường',
    scores: { learning: 3.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 9.5 },
    teacherComment: 'Tốt',
    teacherSignature: 'Đinh Hoài Long',
    absentStudents: [
      { studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P', note: 'Theo danh sách GVCN' },
      { studentId: '269048', studentName: 'Đinh Minh Tùng', type: 'Late', note: 'Đến muộn 5p' },
    ],
  });

  const logbook = engine.getDailyLogbook('6A1', date);
  assert.ok(logbook);
  assert.strictEqual(logbook.preSessionAttendance.absences.length, 1);
  assert.strictEqual(logbook.periods[1].absentStudents.length, 2);
});

test('T3-COMB-05: Student leaving early does not retroactively invalidate earlier completed periods', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const date = '2026-10-06';

  // Period 1 and 2 completed normally
  engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date,
    periodIndex: 1,
    subject: 'Môn 1',
    lessonTopic: 'Chủ đề 1',
    scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
    teacherComment: 'Đầy đủ',
    teacherSignature: 'GV 1',
    absentStudents: [],
  });

  engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date,
    periodIndex: 2,
    subject: 'Môn 2',
    lessonTopic: 'Chủ đề 2',
    scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
    teacherComment: 'Đầy đủ',
    teacherSignature: 'GV 2',
    absentStudents: [],
  });

  // At 10:15, student 269516 departs early
  engine.recordPreSessionAttendance(
    session.token,
    '6A1',
    date,
    [],
    [{ studentId: '269516', studentName: 'Dương Khánh Hiếu', departedAt: '10:15', reason: 'Đau bụng cấp' }]
  );

  const logbook = engine.getDailyLogbook('6A1', date);
  assert.ok(logbook);
  // Earlier periods remain valid and signed
  assert.strictEqual(logbook.periods[1].isSigned, true);
  assert.strictEqual(logbook.periods[2].isSigned, true);
  assert.strictEqual(logbook.preSessionAttendance.earlyDepartures.length, 1);
});

test('T3-COMB-06: Pre-session attendance update overwrites previous baseline without affecting periods', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const date = '2026-10-06';
  // Initial baseline: 1 absent
  engine.recordPreSessionAttendance(session.token, '6A1', date, [
    { studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P' },
  ]);

  // Update baseline: student 269398 informed they will be late instead of full day absent
  engine.recordPreSessionAttendance(session.token, '6A1', date, [
    { studentId: '269398', studentName: 'Lý Bảo Duy', type: 'Late' },
  ]);

  const logbook = engine.getDailyLogbook('6A1', date);
  assert.ok(logbook);
  assert.strictEqual(logbook.preSessionAttendance.absences.length, 1);
  assert.strictEqual(logbook.preSessionAttendance.absences[0].type, 'Late');
});
