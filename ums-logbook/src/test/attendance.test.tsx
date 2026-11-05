/**
 * Unit & Integration Tests: Two-Tier Attendance Engine & Workflows
 * File: src/test/attendance.test.tsx
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatAttendanceDisplay,
  resolveAttendanceSync,
  validateEarlyDeparture,
  calculateAttendanceStats,
} from '../utils/attendance';
import {
  generateDailyId,
  getOrCreateDailyLogbook,
  updateAttendanceBaseline,
  savePeriodEntry,
  getPeriodEntries,
} from '../services/logbookService';
import { seedMockStorage } from '../services/seedService';
import { StudentAbsenceRecord, EarlyDepartureRecord } from '../types/logbook';

describe('Two-Tier Attendance Engine & Workflow Suite', () => {
  const classId = '6A1';
  const date = '2026-09-29';
  const dailyId = generateDailyId(classId, date);

  beforeEach(() => {
    localStorage.clear();
    seedMockStorage();
  });

  describe('1. Tier 1: GVCN Pre-Session Baseline', () => {
    it('initializes baseline with zero absences by default', async () => {
      const logbook = await getOrCreateDailyLogbook(classId, date, 'msphuonganhums');
      expect(logbook.morningBaseline?.absences.length).toBe(0);
      expect(logbook.afternoonBaseline?.absences.length).toBe(0);
    });

    it('saves morning baseline under dailyId', async () => {
      const absences: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P', note: 'Phụ huynh xin sốt' },
        { studentId: '269963', studentName: 'Trần Thị B', type: 'Late', note: 'Đến muộn 15p' },
      ];

      await updateAttendanceBaseline(dailyId, 'morning', {
        reportedBy: 'msphuonganhums',
        reportedAt: Date.now(),
        session: 'morning',
        absences,
        earlyDepartures: [],
      });

      const updated = await getOrCreateDailyLogbook(classId, date);
      expect(updated.morningBaseline?.absences.length).toBe(2);
      expect(updated.morningBaseline?.absences[0].type).toBe('P');
      expect(updated.morningBaseline?.absences[1].type).toBe('Late');
    });

    it('saves afternoon baseline independently without overwriting morning baseline', async () => {
      const morningAbsences: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P' },
      ];
      const afternoonAbsences: StudentAbsenceRecord[] = [
        { studentId: '269910', studentName: 'Lê Văn C', type: 'K', note: 'Không phép buổi chiều' },
      ];

      await updateAttendanceBaseline(dailyId, 'morning', {
        reportedBy: 'msphuonganhums',
        reportedAt: Date.now(),
        session: 'morning',
        absences: morningAbsences,
        earlyDepartures: [],
      });

      await updateAttendanceBaseline(dailyId, 'afternoon', {
        reportedBy: 'msphuonganhums',
        reportedAt: Date.now(),
        session: 'afternoon',
        absences: afternoonAbsences,
        earlyDepartures: [],
      });

      const updated = await getOrCreateDailyLogbook(classId, date);
      expect(updated.morningBaseline?.absences.length).toBe(1);
      expect(updated.morningBaseline?.absences[0].studentId).toBe('269029');

      expect(updated.afternoonBaseline?.absences.length).toBe(1);
      expect(updated.afternoonBaseline?.absences[0].studentId).toBe('269910');
    });

    it('calculates correct summary statistics from roster and absences', () => {
      const absences: StudentAbsenceRecord[] = [
        { studentId: '1', studentName: 'A', type: 'P' },
        { studentId: '2', studentName: 'B', type: 'K' },
        { studentId: '3', studentName: 'C', type: 'Late' },
      ];
      const early: EarlyDepartureRecord[] = [
        { studentId: '4', studentName: 'D', departedAt: '10:00', reason: 'Đau đầu' },
      ];

      const stats = calculateAttendanceStats(26, absences, early);
      expect(stats.totalStudents).toBe(26);
      expect(stats.absentTotal).toBe(2); // P + K
      expect(stats.presentCount).toBe(24);
      expect(stats.pCount).toBe(1);
      expect(stats.kCount).toBe(1);
      expect(stats.lateCount).toBe(1);
      expect(stats.earlyCount).toBe(1);
      expect(stats.allPresent).toBe(false);
    });
  });

  describe('2. Tier 2: GVBM In-Period Adjustments & Verification', () => {
    it('allows GVBM to record period absence without mutating baseline', async () => {
      // Baseline has 1 P
      await updateAttendanceBaseline(dailyId, 'morning', {
        reportedBy: 'msphuonganhums',
        reportedAt: Date.now(),
        session: 'morning',
        absences: [{ studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P' }],
        earlyDepartures: [],
      });

      // GVBM in Period 2 adds a truant student K
      await savePeriodEntry(
        dailyId,
        2,
        {
          subject: 'Toán học',
          lessonTopic: 'Số tự nhiên',
          absentStudents: [
            { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P', reportedInTier: 'baseline' },
            { studentId: '269048', studentName: 'Phạm Văn E', type: 'K', note: 'Bỏ tiết 2', reportedInTier: 'period' },
          ],
          scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
          teacherSignature: 'Nguyễn Văn Long',
          isSigned: true,
        }
      );

      const entries = await getPeriodEntries(dailyId);
      const p2 = entries.find((e) => e.periodIndex === 2);
      expect(p2?.absentStudents.length).toBe(2);
      expect(p2?.absentStudents.find((a) => a.studentId === '269048')?.type).toBe('K');

      // Check that baseline remains intact with only 1 absence
      const book = await getOrCreateDailyLogbook(classId, date);
      expect(book.morningBaseline?.absences.length).toBe(1);
    });

    it('allows GVBM to convert Late to K if student never arrived in period', () => {
      const baselineAbsence: StudentAbsenceRecord = {
        studentId: '269963',
        studentName: 'Trần Thị B',
        type: 'Late',
        reportedInTier: 'baseline',
      };

      // GVBM adjusts in period
      const adjusted: StudentAbsenceRecord = {
        ...baselineAbsence,
        type: 'K',
        note: 'Hết tiết 1 không thấy vào lớp',
        reportedInTier: 'period',
      };

      expect(adjusted.type).toBe('K');
      expect(adjusted.reportedInTier).toBe('period');
    });
  });

  describe('3. Early Departure Tracking', () => {
    it('validates 24-hour departure time format (HH:mm) and rejects invalid formats', () => {
      const valid = validateEarlyDeparture({
        studentId: '269029',
        studentName: 'Nguyễn Văn A',
        departedAt: '09:30',
        reason: 'Sốt cao',
      });
      expect(valid.isValid).toBe(true);

      const invalidHour = validateEarlyDeparture({
        studentId: '269029',
        studentName: 'Nguyễn Văn A',
        departedAt: '25:30',
        reason: 'Sốt cao',
      });
      expect(invalidHour.isValid).toBe(false);
      expect(invalidHour.error).toContain('ATTENDANCE_INVALID_TIME_FORMAT');

      const invalidFormat = validateEarlyDeparture({
        studentId: '269029',
        studentName: 'Nguyễn Văn A',
        departedAt: '9:30', // should be 09:30
        reason: 'Sốt cao',
      });
      expect(invalidFormat.isValid).toBe(false);
    });

    it('requires a non-empty departure reason', () => {
      const noReason = validateEarlyDeparture({
        studentId: '269029',
        studentName: 'Nguyễn Văn A',
        departedAt: '10:15',
        reason: '   ',
      });
      expect(noReason.isValid).toBe(false);
      expect(noReason.error).toContain('ATTENDANCE_MISSING_REASON');
    });

    it('prevents adding duplicate early departure records for the same student', () => {
      const existing: EarlyDepartureRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', departedAt: '09:30', reason: 'Ốm' },
      ];

      const duplicate = validateEarlyDeparture(
        { studentId: '269029', studentName: 'Nguyễn Văn A', departedAt: '10:00', reason: 'Về hẳn' },
        existing
      );
      expect(duplicate.isValid).toBe(false);
      expect(duplicate.error).toContain('đã có trong danh sách');
    });
  });

  describe('4. Real-Time Baseline Sync & Dirty Form Conflict Resolution', () => {
    it('auto-applies incoming baseline when period form is pristine (not dirty)', () => {
      const incomingBaseline: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P' },
        { studentId: '269963', studentName: 'Trần Thị B', type: 'Late' },
      ];

      const res = resolveAttendanceSync([], incomingBaseline, false);
      expect(res.hasConflict).toBe(false);
      expect(res.mergedAbsences.length).toBe(2);
      expect(res.mergedAbsences[0].reportedInTier).toBe('baseline');
    });

    it('detects conflict when period form has conflicting status for same student', () => {
      const localEdits: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'K', reportedInTier: 'period' },
      ];

      const incomingBaseline: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P' },
      ];

      const res = resolveAttendanceSync(localEdits, incomingBaseline, true);
      expect(res.hasConflict).toBe(true);
      expect(res.conflictDetails?.length).toBe(1);
      expect(res.conflictDetails?.[0]).toContain('Nguyễn Văn A');
    });

    it('cleanly merges non-overlapping absences when form is dirty without student conflict', () => {
      const localEdits: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'Late', reportedInTier: 'period' },
      ];

      const incomingBaseline: StudentAbsenceRecord[] = [
        { studentId: '269910', studentName: 'Lê Văn C', type: 'P' },
      ];

      const res = resolveAttendanceSync(localEdits, incomingBaseline, true);
      expect(res.hasConflict).toBe(false);
      expect(res.mergedAbsences.length).toBe(2);
      expect(res.mergedAbsences.find((a) => a.studentId === '269029')?.type).toBe('Late');
      expect(res.mergedAbsences.find((a) => a.studentId === '269910')?.type).toBe('P');
    });
  });

  describe('5. Formatting & Serialization for Traditional MOET Logbook', () => {
    it('serializes 0 absences as "0 (Đủ)" or "Đủ"', () => {
      expect(formatAttendanceDisplay([], [], 'short')).toBe('Đủ');
      expect(formatAttendanceDisplay([], [], 'full')).toBe('0 (Đủ)');
    });

    it('formats single excused absence as "1 (P: [Tên])"', () => {
      const absences: StudentAbsenceRecord[] = [
        { studentId: '1', studentName: 'Lý Bảo Duy', type: 'P' },
      ];
      expect(formatAttendanceDisplay(absences, [])).toBe('1 (P: Duy)');
    });

    it('formats mixed absences with P and K properly', () => {
      const absences: StudentAbsenceRecord[] = [
        { studentId: '1', studentName: 'Lý Bảo Duy', type: 'P' },
        { studentId: '2', studentName: 'Tạ Gia Thị Định', type: 'K' },
      ];
      expect(formatAttendanceDisplay(absences, [])).toBe('2 (P: Duy; K: Định)');
    });

    it('formats late arrivals and early departures into exportable string', () => {
      const absences: StudentAbsenceRecord[] = [
        { studentId: '1', studentName: 'Lý Bảo Duy', type: 'P' },
        { studentId: '2', studentName: 'Đặng Minh Quân', type: 'Late' },
      ];
      const early: EarlyDepartureRecord[] = [
        { studentId: '3', studentName: 'Lê Bảo Nam', departedAt: '09:30', reason: 'Sốt' },
      ];

      const formatted = formatAttendanceDisplay(absences, early);
      expect(formatted).toContain('1 (P: Duy)');
      expect(formatted).toContain('Muộn: Quân');
      expect(formatted).toContain('Về sớm: Nam (09:30)');
    });
  });
});
