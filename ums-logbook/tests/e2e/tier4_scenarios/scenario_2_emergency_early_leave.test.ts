/**
 * Tier 4: Real-World Application Scenario 2 - Student Emergency Early Departure
 * Simulates a student developing a high fever mid-day:
 * - Attends Periods 1 and 2 normally.
 * - At 09:30 during Period 3, medical staff advises home rest.
 * - GVCN records Early Departure at 09:35 with timestamp and medical reason.
 * - In subsequent afternoon periods, student is recorded as Excused (P).
 * - Verifies consistency across the daily logbook without regressions.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T4-SCEN-02: Emergency medical early departure maintains logbook consistency', () => {
  const engine = new UMSContractEngine();
  const date = '2026-10-06'; // Tuesday
  const classId = '6A1';
  const sickStudentId = '269516'; // Dương Khánh Hiếu

  const gvcnSession = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(gvcnSession.token, DEFAULT_PASSWORD, 'GvcnPass2026!');

  // 1. Period 1 and Period 2 - Student is present and active
  engine.submitPeriodEntry(gvcnSession.token, {
    classId,
    date,
    periodIndex: 1,
    subject: 'Toán học',
    lessonTopic: 'Phép nhân phân số',
    scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
    teacherComment: 'Học sinh có mặt đầy đủ',
    teacherSignature: 'GV Toán',
    absentStudents: [],
  });

  engine.submitPeriodEntry(gvcnSession.token, {
    classId,
    date,
    periodIndex: 2,
    subject: 'Ngữ văn',
    lessonTopic: 'Viết đoạn văn biểu cảm',
    scores: { learning: 3.5, discipline: 3, hygiene: 2, customCriterion: 1, total: 9.5 },
    teacherComment: 'Lớp nghiêm túc',
    teacherSignature: 'GV Văn',
    absentStudents: [],
  });

  // 2. Mid-morning (09:35): School nurse contacts GVCN, parent arrives to pick up student
  const baseline = engine.recordPreSessionAttendance(
    gvcnSession.token,
    classId,
    date,
    [],
    [
      {
        studentId: sickStudentId,
        studentName: 'Dương Khánh Hiếu',
        departedAt: '09:35',
        reason: 'Sốt cao 38.8 độ C, phụ huynh đưa đi khám tại viện Nhi TW',
      },
    ]
  );
  assert.strictEqual(baseline.earlyDepartures.length, 1);
  assert.strictEqual(baseline.earlyDepartures[0].departedAt, '09:35');

  // 3. Periods 3 through 8: Student is marked Excused (P)
  for (let p = 3; p <= 8; p++) {
    engine.submitPeriodEntry(gvcnSession.token, {
      classId,
      date,
      periodIndex: p,
      subject: `Môn học tiết ${p}`,
      lessonTopic: `Nội dung tiết ${p}`,
      scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      teacherComment: 'Đạt yêu cầu',
      teacherSignature: `GV Tiết ${p}`,
      absentStudents: [
        {
          studentId: sickStudentId,
          studentName: 'Dương Khánh Hiếu',
          type: 'P',
          note: 'Về sớm do sốt từ 09:35 (theo xác nhận y tế)',
        },
      ],
    });
  }

  // 4. Verify end-of-day integrity
  const logbook = engine.getDailyLogbook(classId, date);
  assert.ok(logbook);
  assert.strictEqual(logbook.isCompleted, true);

  // Period 1 and 2 should have 0 absent students
  assert.strictEqual(logbook.periods[1].absentStudents.length, 0);
  assert.strictEqual(logbook.periods[2].absentStudents.length, 0);

  // Period 3 to 8 should have exactly 1 absent student with type 'P'
  for (let p = 3; p <= 8; p++) {
    assert.strictEqual(logbook.periods[p].absentStudents.length, 1);
    assert.strictEqual(logbook.periods[p].absentStudents[0].type, 'P');
    assert.strictEqual(logbook.periods[p].absentStudents[0].studentId, sickStudentId);
  }

  // Early departure list preserved
  assert.strictEqual(logbook.preSessionAttendance.earlyDepartures.length, 1);
  assert.strictEqual(logbook.preSessionAttendance.earlyDepartures[0].studentId, sickStudentId);
});
