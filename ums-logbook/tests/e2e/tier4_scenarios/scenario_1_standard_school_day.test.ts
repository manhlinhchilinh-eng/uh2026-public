/**
 * Tier 4: Real-World Application Scenario 1 - Standard Full Monday School Day
 * Simulates a realistic Monday school day at ULIS Middle School:
 * - GVCN morning roll-call (1 P, 1 Late).
 * - 4 morning periods (1-4) by Literature, Math, English, History.
 * - 4 afternoon periods (5-8) by Science, PE, Art, Technology.
 * - Positive behavior note in PE.
 * - Daily completion verification with 8 signed periods and total daily score.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T4-SCEN-01: Standard Full Monday School Day workflow executes completely', () => {
  const engine = new UMSContractEngine();
  const date = '2026-10-05'; // Monday

  // 1. 07:15 - GVCN logs in and performs pre-session attendance for 6A1
  const gvcnSession = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(gvcnSession.token, DEFAULT_PASSWORD, 'GvcnPass2026!');

  const baseline = engine.recordPreSessionAttendance(
    gvcnSession.token,
    '6A1',
    date,
    [
      { studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P', note: 'Phụ huynh xin phép đi khám mắt' },
      { studentId: '269048', studentName: 'Đinh Minh Tùng', type: 'Late', note: 'Kẹt xe, đến muộn 10 phút' },
    ]
  );
  assert.strictEqual(baseline.absences.length, 2);

  // 2. Schedule of 8 periods with teachers, subjects, topics, and scores
  const periodsData = [
    { period: 1, subject: 'Ngữ văn', teacher: 'Cô Phương Anh', topic: 'Thánh Gióng', scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 } },
    { period: 2, subject: 'Toán học', teacher: 'Thầy Thành', topic: 'Tập hợp số tự nhiên', scores: { learning: 3.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 9.5 } },
    { period: 3, subject: 'Tiếng Anh', teacher: 'Cô Thảo', topic: 'Unit 1: My New School', scores: { learning: 4.0, discipline: 2.5, hygiene: 2.0, customCriterion: 0.5, total: 9.0 } },
    { period: 4, subject: 'Lịch sử & Địa lí', teacher: 'Thầy Hưng', topic: 'Sơ lược về lịch sử', scores: { learning: 3.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 9.5 } },
    { period: 5, subject: 'Khoa học tự nhiên', teacher: 'Cô Lan', topic: 'Tế bào nhân sơ', scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 } },
    { period: 6, subject: 'Giáo dục thể chất', teacher: 'Thầy Cường', topic: 'Chạy cự ly ngắn 60m', scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 } },
    { period: 7, subject: 'Nghệ thuật (Âm nhạc)', teacher: 'Cô Mai', topic: 'Hát: Mùa khai trường', scores: { learning: 3.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 9.5 } },
    { period: 8, subject: 'Tin học', teacher: 'Thầy Tuấn', topic: 'An toàn thông tin', scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 } },
  ];

  for (const item of periodsData) {
    const entry = engine.submitPeriodEntry(gvcnSession.token, {
      classId: '6A1',
      date,
      periodIndex: item.period,
      subject: item.subject,
      lessonTopic: item.topic,
      scores: item.scores,
      teacherComment: 'Lớp học nghiêm túc, sôi nổi',
      teacherSignature: item.teacher,
    });
    assert.strictEqual(entry.periodIndex, item.period);
    assert.strictEqual(entry.isSigned, true);
  }

  // 3. In Period 6 (PE), teacher praises student Tạ Gia Thị Định for athletic achievement
  const praiseNote = engine.createBehaviorNote(gvcnSession.token, {
    studentId: '269594',
    studentName: 'Tạ Gia Thị Định',
    classId: '6A1',
    type: 'positive',
    category: 'Khen ngợi',
    description: 'Đạt thành tích xuất sắc chạy 60m vượt chuẩn khối 6',
  });
  assert.strictEqual(praiseNote.studentId, '269594');

  // 4. Verify end-of-day completion
  const logbook = engine.getDailyLogbook('6A1', date);
  assert.ok(logbook);
  assert.strictEqual(Object.keys(logbook.periods).length, 8);
  assert.strictEqual(logbook.isCompleted, true, 'Daily logbook must be marked completed when all 8 periods signed');

  // Total daily score: 10 + 9.5 + 9.0 + 9.5 + 10 + 10 + 9.5 + 10 = 77.5
  let dayTotal = 0;
  for (const p of Object.values(logbook.periods)) {
    dayTotal += p.scores.total;
  }
  assert.strictEqual(dayTotal, 77.5);
});
