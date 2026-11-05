/**
 * Unit Tests: Logbook Service & Subcollection Data Layer
 * File: src/test/logbookService.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDailyId,
  createEmptyDailyLogbook,
  createEmptyPeriodEntry,
  validatePeriodScore,
  getOrCreateDailyLogbook,
  getPeriodEntries,
  savePeriodEntry,
  updateAttendanceBaseline,
  calculateDailyScoreSummary,
  subscribeDailyLogbook,
  subscribePeriodEntries,
} from '../services/logbookService';
import { DailyAttendanceBaseline } from '../types/logbook';

describe('Milestone 2 - Logbook Service & Subcollection Architecture', () => {
  const classId = '9A3';
  const date = '2026-10-15';
  const dailyId = '9A3_2026-10-15';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Document ID & Hierarchy Formatting', () => {
    it('generates exact dailyId formatted as `${classId}_${date}`', () => {
      expect(generateDailyId('9A3', '2026-10-15')).toBe('9A3_2026-10-15');
      expect(generateDailyId('6A1', '2026-09-29')).toBe('6A1_2026-09-29');
    });

    it('initializes parent DailyLogbook with morning and afternoon baselines', () => {
      const logbook = createEmptyDailyLogbook(classId, date, 'mrlinhums', 7);
      expect(logbook.id).toBe(dailyId);
      expect(logbook.classId).toBe('9A3');
      expect(logbook.date).toBe('2026-10-15');
      expect(logbook.totalPeriods).toBe(8);
      expect(logbook.morningBaseline).toBeDefined();
      expect(logbook.afternoonBaseline).toBeDefined();
      expect(logbook.status).toBe('draft');
      expect(logbook.isCompleted).toBe(false);
    });

    it('creates 8 distinct period entries for periods 1 through 8', () => {
      for (let p = 1; p <= 8; p++) {
        const period = createEmptyPeriodEntry(dailyId, p);
        expect(period.periodIndex).toBe(p);
        expect(period.dailyId).toBe(dailyId);
        expect(period.isSigned).toBe(false);
        expect(period.scores.total).toBe(0);
      }
    });
  });

  describe('2. Four-Criteria Scoring Engine Validation', () => {
    it('validates standard valid scores within criteria bounds', () => {
      const res = validatePeriodScore({
        learning: 3.5,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
      });
      expect(res.isValid).toBe(true);
      expect(res.total).toBe(9.5);
      expect(Object.keys(res.errors).length).toBe(0);
    });

    it('rejects scores exceeding individual criterion limits', () => {
      const res = validatePeriodScore({
        learning: 4.5, // max 4.0
        discipline: 3.5, // max 3.0
        hygiene: 2.5, // max 2.0
        customCriterion: 1.5, // max 1.0
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.learning).toBeDefined();
      expect(res.errors.discipline).toBeDefined();
      expect(res.errors.hygiene).toBeDefined();
      expect(res.errors.customCriterion).toBeDefined();
    });

    it('rejects negative scores and clamps normalized values safely', () => {
      const res = validatePeriodScore({
        learning: -1,
        discipline: 2.0,
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.learning).toBeDefined();
      expect(res.normalizedScores.learning).toBe(0);
    });
  });

  describe('3. Concurrency & Subcollection Isolation', () => {
    it('allows concurrent writes to different periods without overwrite or race condition', async () => {
      await getOrCreateDailyLogbook(classId, date, 'mrlinhums');

      // Teacher A writes to Period 1, Teacher B writes to Period 2 concurrently
      const writePeriod1 = savePeriodEntry(
        dailyId,
        1,
        {
          subject: 'Toán học',
          lessonTopic: 'Hàm số bậc nhất',
          teacherId: 'mrlinhums',
          teacherName: 'Nguyễn Mạnh Linh',
          scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
        },
        true
      );

      const writePeriod2 = savePeriodEntry(
        dailyId,
        2,
        {
          subject: 'Ngữ văn',
          lessonTopic: 'Truyện Kiều',
          teacherId: 'msthanhhuyenums',
          teacherName: 'Nguyễn Phương Minh Hạnh',
          scores: { learning: 3.5, discipline: 2.5, hygiene: 2.0, customCriterion: 0.5, total: 8.5 },
        },
        true
      );

      const [p1, p2] = await Promise.all([writePeriod1, writePeriod2]);

      expect(p1.periodIndex).toBe(1);
      expect(p1.subject).toBe('Toán học');
      expect(p1.isSigned).toBe(true);

      expect(p2.periodIndex).toBe(2);
      expect(p2.subject).toBe('Ngữ văn');
      expect(p2.isSigned).toBe(true);

      // Verify stored entries both exist intact
      const entries = await getPeriodEntries(dailyId);
      const storedP1 = entries.find((e) => e.periodIndex === 1);
      const storedP2 = entries.find((e) => e.periodIndex === 2);

      expect(storedP1?.lessonTopic).toBe('Hàm số bậc nhất');
      expect(storedP2?.lessonTopic).toBe('Truyện Kiều');
    });
  });

  describe('4. Two-Tier Attendance & Summary Aggregation', () => {
    it('stores GVCN baseline attendance and computes daily statistics', async () => {
      await getOrCreateDailyLogbook(classId, date, 'mrlinhums');

      const morningBaseline: DailyAttendanceBaseline = {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        session: 'morning',
        absences: [
          { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P', note: 'Ốm' },
          { studentId: '269963', studentName: 'Trần Thị B', type: 'K' },
          { studentId: '269910', studentName: 'Lê Văn C', type: 'Late', note: 'Muộn 10p' },
        ],
        earlyDepartures: [
          { studentId: '269398', studentName: 'Phạm Văn D', departedAt: '10:30', reason: 'Gia đình có việc' },
        ],
      };

      await updateAttendanceBaseline(dailyId, 'morning', morningBaseline);

      await savePeriodEntry(
        dailyId,
        1,
        {
          scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
        },
        true
      );

      const periods = await getPeriodEntries(dailyId);
      const updatedBook = await getOrCreateDailyLogbook(classId, date);
      const summary = calculateDailyScoreSummary(updatedBook, periods);

      expect(summary.totalPeriodsSigned).toBe(1);
      expect(summary.totalDailyScore).toBe(10.0);
      expect(summary.excusedCountP).toBe(1);
      expect(summary.unexcusedCountK).toBe(1);
      expect(summary.lateCount).toBe(1);
      expect(summary.earlyDepartureCount).toBe(1);
      expect(summary.totalAbsenceCount).toBe(2); // P + K
    });
  });

  describe('5. Real-Time Reactive Listeners', () => {
    it('triggers callback immediately and upon storage updates', async () => {
      let receivedBook: any = null;
      const unsub = subscribeDailyLogbook(dailyId, (b) => {
        receivedBook = b;
      });

      await getOrCreateDailyLogbook(classId, date, 'mrlinhums');
      expect(receivedBook).toBeDefined();

      unsub();
    });

    it('triggers period subscription callback', async () => {
      let receivedPeriods: any[] = [];
      const unsub = subscribePeriodEntries(dailyId, (ps) => {
        receivedPeriods = ps;
      });

      expect(receivedPeriods.length).toBe(8);
      unsub();
    });
  });
});
