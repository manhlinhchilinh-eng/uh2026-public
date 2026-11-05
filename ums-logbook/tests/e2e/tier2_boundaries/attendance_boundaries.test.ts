/**
 * Tier 2: Boundary & Corner Cases - Attendance Tracking
 * Requirements: ORIGINAL_REQUEST.md (R1), PROJECT.md (F10, F11)
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';
import { assertThrowsContractError } from '../harness/assertions.ts';

test('T2-ATTEND-01: Rejection of invalid absence type code', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  assertThrowsContractError(
    () =>
      engine.recordPreSessionAttendance(
        session.token,
        '6A1',
        '2026-10-05',
        [{ studentId: '269398', studentName: 'Lý Bảo Duy', type: 'INVALID_CODE' as any }]
      ),
    'ATTENDANCE_INVALID_TYPE'
  );
});

test('T2-ATTEND-02: Rejection when student does not belong to the class roster', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  // '999999' is not in 6A1
  assertThrowsContractError(
    () =>
      engine.recordPreSessionAttendance(
        session.token,
        '6A1',
        '2026-10-05',
        [{ studentId: '999999', studentName: 'Ghost Student', type: 'P' }]
      ),
    'ATTENDANCE_UNKNOWN_STUDENT'
  );
});

test('T2-ATTEND-03: Rejection of malformed early departure time format', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const invalidTimes = ['25:00', '09:65', '9:30', '10-30', 'morning'];
  for (const timeStr of invalidTimes) {
    assertThrowsContractError(
      () =>
        engine.recordPreSessionAttendance(
          session.token,
          '6A1',
          '2026-10-05',
          [],
          [{ studentId: '269398', studentName: 'Lý Bảo Duy', departedAt: timeStr, reason: 'Sốt' }]
        ),
      'ATTENDANCE_INVALID_TIME_FORMAT'
    );
  }
});

test('T2-ATTEND-04: Rejection of early departure with missing or empty reason', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  assertThrowsContractError(
    () =>
      engine.recordPreSessionAttendance(
        session.token,
        '6A1',
        '2026-10-05',
        [],
        [{ studentId: '269398', studentName: 'Lý Bảo Duy', departedAt: '10:00', reason: '   ' }]
      ),
    'ATTENDANCE_MISSING_REASON'
  );
});

test('T2-ATTEND-05: Rejection of duplicate absence entries for same student in a single period', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  assertThrowsContractError(
    () =>
      engine.submitPeriodEntry(session.token, {
        classId: '6A1',
        date: '2026-10-05',
        periodIndex: 1,
        subject: 'Văn',
        lessonTopic: 'Chủ đề',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
        teacherComment: 'Tốt',
        teacherSignature: 'Đinh Hoài Long',
        absentStudents: [
          { studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P' },
          { studentId: '269398', studentName: 'Lý Bảo Duy', type: 'Late' },
        ],
      }),
    'ATTENDANCE_DUPLICATE_ENTRY'
  );
});

test('T2-ATTEND-06: GVCN cannot record pre-session attendance for a different class', () => {
  const engine = new UMSContractEngine();
  // msphuonganhums is assigned to 6A1, not 8A3
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  assertThrowsContractError(
    () =>
      engine.recordPreSessionAttendance(
        session.token,
        '8A3',
        '2026-10-05',
        [{ studentId: '249694', studentName: 'Phan Hải Định', type: 'P' }]
      ),
    'AUTH_FORBIDDEN'
  );
});
