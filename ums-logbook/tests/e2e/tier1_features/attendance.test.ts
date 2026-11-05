/**
 * Tier 1: Feature Coverage - Attendance Tracking & Early Departure
 * Requirements: ORIGINAL_REQUEST.md (R1), PROJECT.md (F10, F11)
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T1-ATTEND-01: GVCN can record pre-session attendance with excused (P) absence', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const baseline = engine.recordPreSessionAttendance(
    session.token,
    '6A1',
    '2026-10-05',
    [
      {
        studentId: '269398',
        studentName: 'Lý Bảo Duy',
        type: 'P',
        note: 'Gia đình có việc riêng, phụ huynh đã xin phép',
      },
    ]
  );

  assert.strictEqual(baseline.absences.length, 1);
  assert.strictEqual(baseline.absences[0].studentId, '269398');
  assert.strictEqual(baseline.absences[0].type, 'P');
});

test('T1-ATTEND-02: GVCN can record unexcused (K) and Late attendance in pre-session', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const baseline = engine.recordPreSessionAttendance(
    session.token,
    '6A1',
    '2026-10-05',
    [
      {
        studentId: '269048',
        studentName: 'Đinh Minh Tùng',
        type: 'K',
        note: 'Không có lý do',
      },
      {
        studentId: '269387',
        studentName: 'Tạ Hoài Thu Ngân',
        type: 'Late',
        note: 'Đến muộn 15 phút do hỏng xe',
      },
    ]
  );

  assert.strictEqual(baseline.absences.length, 2);
  assert.strictEqual(baseline.absences[0].type, 'K');
  assert.strictEqual(baseline.absences[1].type, 'Late');
});

test('T1-ATTEND-03: Early departure is recorded with valid time HH:mm and justification reason', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const baseline = engine.recordPreSessionAttendance(
    session.token,
    '6A1',
    '2026-10-05',
    [],
    [
      {
        studentId: '269516',
        studentName: 'Dương Khánh Hiếu',
        departedAt: '10:30',
        reason: 'Sốt nhẹ, phụ huynh đến đón về phòng khám',
      },
    ]
  );

  assert.strictEqual(baseline.earlyDepartures.length, 1);
  assert.strictEqual(baseline.earlyDepartures[0].studentId, '269516');
  assert.strictEqual(baseline.earlyDepartures[0].departedAt, '10:30');
  assert.ok(baseline.earlyDepartures[0].reason.includes('Sốt nhẹ'));
});

test('T1-ATTEND-04: Subject teacher (GVBM) records period-specific absences during period entry', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const periodEntry = engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date: '2026-10-05',
    periodIndex: 2,
    subject: 'Toán',
    lessonTopic: 'Tập hợp các số tự nhiên',
    scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
    teacherComment: 'Học sinh chú ý nghe giảng',
    teacherSignature: 'Trần Văn Thành',
    absentStudents: [
      {
        studentId: '269594',
        studentName: 'Tạ Gia Thị Định',
        type: 'Late',
        note: 'Vào lớp muộn 10 phút',
      },
    ],
  });

  assert.strictEqual(periodEntry.absentStudents.length, 1);
  assert.strictEqual(periodEntry.absentStudents[0].studentId, '269594');
  assert.strictEqual(periodEntry.absentStudents[0].type, 'Late');
});

test('T1-ATTEND-05: Daily logbook retains both pre-session baseline and period-specific absences', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const date = '2026-10-05';
  engine.recordPreSessionAttendance(
    session.token,
    '6A1',
    date,
    [{ studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P' }]
  );

  engine.submitPeriodEntry(session.token, {
    classId: '6A1',
    date,
    periodIndex: 1,
    subject: 'Tiếng Anh',
    lessonTopic: 'Unit 1: My New School',
    scores: { learning: 3.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 9.5 },
    teacherComment: 'Tốt',
    teacherSignature: 'Teacher A',
    absentStudents: [{ studentId: '269048', studentName: 'Đinh Minh Tùng', type: 'K' }],
  });

  const logbook = engine.getDailyLogbook('6A1', date);
  assert.ok(logbook);
  assert.strictEqual(logbook.preSessionAttendance.absences.length, 1);
  assert.strictEqual(logbook.preSessionAttendance.absences[0].studentId, '269398');
  assert.strictEqual(logbook.periods[1].absentStudents.length, 1);
  assert.strictEqual(logbook.periods[1].absentStudents[0].studentId, '269048');
});

test('T1-ATTEND-06: Pre-session attendance correctly records reporting teacher and timestamp', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const mockTime = 1760000000000;
  const baseline = engine.recordPreSessionAttendance(
    session.token,
    '6A1',
    '2026-10-05',
    [],
    [],
    mockTime
  );

  assert.strictEqual(baseline.reportedBy, session.user.uid);
  assert.strictEqual(baseline.reportedAt, mockTime);
});
