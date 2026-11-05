/**
 * Tier 4: Real-World Application Scenario 5 - Weekly Logbook Summaries & Emulation Ranking
 * Simulates a full 5-day week (Monday to Friday, 40 periods):
 * - Aggregates period scores, criteria averages, and attendance breakdown.
 * - Applies emulation formula with penalties.
 * - Computes emulation leaderboard rank across classes.
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T4-SCEN-05: 40-period weekly aggregation and class emulation ranking calculates accurately', () => {
  const engine = new UMSContractEngine();
  const weekDates = [
    '2026-10-05', // Mon
    '2026-10-06', // Tue
    '2026-10-07', // Wed
    '2026-10-08', // Thu
    '2026-10-09', // Fri
  ];

  const gvcn6A1 = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(gvcn6A1.token, DEFAULT_PASSWORD, 'Pass6A1!');

  const gvcn8A3 = engine.login('mrlinhums', DEFAULT_PASSWORD);
  engine.changePassword(gvcn8A3.token, DEFAULT_PASSWORD, 'Pass8A3!');

  // Populate Class 6A1: 40 periods, high scores (9.5 average: 4.0 learning, 2.5 disc, 2.0 hyg, 1.0 cust)
  // Attendance: 1 Late in period 1 on Mon, 1 P on Tue
  for (const date of weekDates) {
    for (let p = 1; p <= 8; p++) {
      const absences = [];
      if (date === '2026-10-05' && p === 1) {
        absences.push({ studentId: '269048', studentName: 'Đinh Minh Tùng', type: 'Late' as const });
      } else if (date === '2026-10-06' && p === 1) {
        absences.push({ studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P' as const });
      }

      engine.submitPeriodEntry(gvcn6A1.token, {
        classId: '6A1',
        date,
        periodIndex: p,
        subject: `Môn ${p}`,
        lessonTopic: `Bài ${p}`,
        scores: { learning: 4.0, discipline: 2.5, hygiene: 2.0, customCriterion: 1.0, total: 9.5 },
        teacherComment: 'Tốt',
        teacherSignature: 'GVCN 6A1',
        absentStudents: absences,
      });
    }
  }

  // Populate Class 8A3: 40 periods, lower scores (9.0 average: 3.5 learning, 2.5 disc, 2.0 hyg, 1.0 cust)
  // Attendance: 3 unexcused (K) absences, 2 Late
  let kCount = 0;
  for (const date of weekDates) {
    for (let p = 1; p <= 8; p++) {
      const absences = [];
      if (kCount < 3 && p === 1) {
        absences.push({ studentId: '249697', studentName: 'Lê Hoàng Nam', type: 'K' as const });
        kCount++;
      } else if (p === 8 && (date === '2026-10-05' || date === '2026-10-06')) {
        absences.push({ studentId: '249807', studentName: 'Nguyễn Đức Minh', type: 'Late' as const });
      }

      engine.submitPeriodEntry(gvcn8A3.token, {
        classId: '8A3',
        date,
        periodIndex: p,
        subject: `Môn ${p}`,
        lessonTopic: `Bài ${p}`,
        scores: { learning: 3.5, discipline: 2.5, hygiene: 2.0, customCriterion: 1.0, total: 9.0 },
        teacherComment: 'Đạt yêu cầu',
        teacherSignature: 'GVCN 8A3',
        absentStudents: absences,
      });
    }
  }

  // Calculate summaries
  const summary6A1 = engine.calculateWeeklySummary('6A1', weekDates);
  const summary8A3 = engine.calculateWeeklySummary('8A3', weekDates);

  // Assertions for 6A1
  assert.strictEqual(summary6A1.totalPeriods, 40);
  assert.strictEqual(summary6A1.completedPeriods, 40);
  assert.strictEqual(summary6A1.totalScore, 380); // 40 * 9.5
  assert.strictEqual(summary6A1.averageScore, 9.5);
  assert.strictEqual(summary6A1.criteriaAverages.learning, 4.0);
  assert.strictEqual(summary6A1.criteriaAverages.discipline, 2.5);
  assert.strictEqual(summary6A1.attendanceTotals.late, 1);
  assert.strictEqual(summary6A1.attendanceTotals.excused, 1);
  assert.strictEqual(summary6A1.attendanceTotals.unexcused, 0);

  // Assertions for 8A3
  assert.strictEqual(summary8A3.completedPeriods, 40);
  assert.strictEqual(summary8A3.totalScore, 360); // 40 * 9.0
  assert.strictEqual(summary8A3.averageScore, 9.0);
  assert.strictEqual(summary8A3.attendanceTotals.unexcused, 3);
  assert.strictEqual(summary8A3.attendanceTotals.late, 2);

  // Emulation formula: 100 + (averageScore * 10) - (unexcused * 2) - (late * 0.5)
  // 6A1: 100 + (9.5 * 10) - 0 - (1 * 0.5) = 194.5
  // 8A3: 100 + (9.0 * 10) - (3 * 2) - (2 * 0.5) = 190 - 6 - 1 = 183.0
  assert.strictEqual(summary6A1.emulationScore, 194.5);
  assert.strictEqual(summary8A3.emulationScore, 183.0);

  // Emulation Leaderboard ranking: 6A1 ranks higher than 8A3
  const leaderboard = [summary6A1, summary8A3].sort((a, b) => b.emulationScore - a.emulationScore);
  assert.strictEqual(leaderboard[0].classId, '6A1', 'Class 6A1 must rank 1st on leaderboard');
  assert.strictEqual(leaderboard[1].classId, '8A3', 'Class 8A3 must rank 2nd on leaderboard');
});
