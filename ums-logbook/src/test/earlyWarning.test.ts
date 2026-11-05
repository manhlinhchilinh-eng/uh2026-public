/**
 * UMS Digital Class Logbook - Early Warning Engine Unit Tests
 * Milestone 3: Mathematical threshold evaluation, window calculations, & timeline generation
 * Path: src/test/earlyWarning.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getPeriodRange,
  evaluateEarlyWarnings,
  buildStudentTimeline,
  parseDateString,
  formatDateString,
} from '../utils/earlyWarning';
import { StudentDoc, BehaviorNote } from '../types';
import { AbsenceEvent } from '../types/earlyWarning';

describe('Milestone 3: Early Warning Alert Engine (src/utils/earlyWarning.ts)', () => {
  const mockStudents: StudentDoc[] = [
    {
      id: '269398',
      mhs: '269398',
      stt: 4,
      name: 'Lý Bảo Duy',
      classId: '6A1',
      grade: 6,
      dob: '2015-07-04',
      gender: 'Nữ',
      status: 'active',
      createdAt: Date.now(),
    },
    {
      id: '269048',
      mhs: '269048',
      stt: 5,
      name: 'Đinh Minh Tùng',
      classId: '6A1',
      grade: 6,
      dob: '2015-11-20',
      gender: 'Nữ',
      status: 'active',
      createdAt: Date.now(),
    },
    {
      id: '291001',
      mhs: '291001',
      stt: 1,
      name: 'Trần Văn Nam',
      classId: '9A3',
      grade: 9,
      dob: '2012-03-15',
      gender: 'Nam',
      status: 'active',
      createdAt: Date.now(),
    },
  ];

  const refDateStr = '2026-10-10'; // Saturday

  describe('1. Temporal Window Range Calculations', () => {
    it('calculates rolling 7-day window correctly (inclusive 7 calendar days)', () => {
      const range = getPeriodRange(refDateStr, 'rolling_7_days');
      expect(range.endDate).toBe('2026-10-10');
      expect(range.startDate).toBe('2026-10-04');
    });

    it('calculates school week window correctly from Monday to Sunday', () => {
      // 2026-10-07 is Wednesday -> Monday is 2026-10-05, Sunday is 2026-10-11
      const range = getPeriodRange('2026-10-07', 'school_week');
      expect(range.startDate).toBe('2026-10-05');
      expect(range.endDate).toBe('2026-10-11');
    });

    it('parses and formats date strings safely without timezone offset issues', () => {
      const parsed = parseDateString('2026-09-29');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(8); // September is 8 (0-indexed)
      expect(parsed.getDate()).toBe(29);
      expect(formatDateString(parsed)).toBe('2026-09-29');
    });
  });

  describe('2. Mathematical Threshold Rules for Early Warnings', () => {
    it('Test 1: Baseline - Student with 0 absences and 0 notes produces no alert', () => {
      const alerts = evaluateEarlyWarnings(mockStudents, [], [], {
        referenceDate: refDateStr,
      });
      expect(alerts).toEqual([]);
    });

    it('Test 2: Boundary - 2 unexcused absences (K) in 7 days does NOT trigger warning (2 < 3)', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-06', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-08', studentId: '269398', classId: '6A1', type: 'K' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: refDateStr,
      });
      expect(alerts).toEqual([]);
    });

    it('Test 3: Threshold Activation - Exactly 3 unexcused absences (K) triggers warning alert', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-09', studentId: '269398', classId: '6A1', type: 'K' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: refDateStr,
      });
      expect(alerts.length).toBe(1);
      expect(alerts[0].studentId).toBe('269398');
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].reasons.length).toBe(1);
      expect(alerts[0].reasons[0].type).toBe('unexcused_absences');
      expect(alerts[0].reasons[0].count).toBe(3);
    });

    it('Test 4: Beyond Threshold - 4 unexcused absences (K) triggers warning alert with count 4', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-08', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-09', studentId: '269398', classId: '6A1', type: 'K' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: refDateStr,
      });
      expect(alerts.length).toBe(1);
      expect(alerts[0].reasons[0].count).toBe(4);
    });

    it('Test 5: Exclusion Rule - Excused absences (P) and tardies (Late) strictly do NOT count towards absences', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: '269398', classId: '6A1', type: 'P' },
        { date: '2026-10-06', studentId: '269398', classId: '6A1', type: 'P' },
        { date: '2026-10-07', studentId: '269398', classId: '6A1', type: 'P' },
        { date: '2026-10-08', studentId: '269398', classId: '6A1', type: 'Late' },
        { date: '2026-10-09', studentId: '269398', classId: '6A1', type: 'Late' },
        { date: '2026-10-10', studentId: '269398', classId: '6A1', type: 'Late' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: refDateStr,
      });
      expect(alerts).toEqual([]);
    });

    it('Test 6: Boundary - 2 negative behavior notes does NOT trigger warning (2 < 3)', () => {
      const notes: BehaviorNote[] = [
        {
          id: 'n1',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'missing_homework',
          content: 'Quên vở bài tập',
          description: 'Quên vở bài tập',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-06',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'n2',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'inattention',
          content: 'Nói chuyện riêng',
          description: 'Nói chuyện riêng',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-08',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, {
        referenceDate: refDateStr,
      });
      expect(alerts).toEqual([]);
    });

    it('Test 7: Threshold Activation - Exactly 3 negative notes triggers behavior warning', () => {
      const notes: BehaviorNote[] = [
        {
          id: 'n1',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'missing_homework',
          content: 'Quên vở bài tập',
          description: 'Quên vở bài tập',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-05',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'n2',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'inattention',
          content: 'Nói chuyện riêng',
          description: 'Nói chuyện riêng',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-07',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'n3',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'phone_usage',
          content: 'Sử dụng điện thoại trong giờ',
          description: 'Sử dụng điện thoại trong giờ',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-09',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, {
        referenceDate: refDateStr,
      });
      expect(alerts.length).toBe(1);
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].reasons[0].type).toBe('negative_notes');
      expect(alerts[0].reasons[0].count).toBe(3);
    });

    it('Test 8: Exclusion Rule - Positive commendation notes strictly do NOT trigger alerts', () => {
      const notes: BehaviorNote[] = [
        {
          id: 'p1',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Phát biểu hăng hái',
          description: 'Phát biểu hăng hái',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-05',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'p2',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'outstanding_homework',
          content: 'Bài làm xuất sắc',
          description: 'Bài làm xuất sắc',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-06',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'p3',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'peer_support',
          content: 'Giúp bạn học tốt',
          description: 'Giúp bạn học tốt',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-07',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'p4',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'exemplary_discipline',
          content: 'Ý thức tốt',
          description: 'Ý thức tốt',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-08',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, {
        referenceDate: refDateStr,
      });
      expect(alerts).toEqual([]);
    });

    it('Test 9: Compounded Condition 3 - BOTH >= 3 K absences AND >= 3 negative notes triggers CRITICAL alert', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-09', studentId: '269398', classId: '6A1', type: 'K' },
      ];
      const notes: BehaviorNote[] = [
        {
          id: 'n1',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'missing_homework',
          content: 'Quên vở bài tập',
          description: 'Quên vở bài tập',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-05',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'n2',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'inattention',
          content: 'Nói chuyện riêng',
          description: 'Nói chuyện riêng',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-06',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'n3',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'phone_usage',
          content: 'Sử dụng điện thoại trong giờ',
          description: 'Sử dụng điện thoại trong giờ',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-08',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, {
        referenceDate: refDateStr,
      });
      expect(alerts.length).toBe(1);
      expect(alerts[0].level).toBe('critical');
      expect(alerts[0].reasons.length).toBe(2);
      expect(alerts[0].reasons.some((r) => r.type === 'unexcused_absences')).toBe(true);
      expect(alerts[0].reasons.some((r) => r.type === 'negative_notes')).toBe(true);
    });

    it('Test 10: Temporal Rolling Window - Events outside the 7-day window are filtered out', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-01', studentId: '269398', classId: '6A1', type: 'K' }, // Outside 7-day window (ref is 2026-10-10)
        { date: '2026-10-02', studentId: '269398', classId: '6A1', type: 'K' }, // Outside
        { date: '2026-10-08', studentId: '269398', classId: '6A1', type: 'K' }, // Inside
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: refDateStr,
      });
      expect(alerts).toEqual([]);
    });

    it('Test 11: Deduplication option - deduplicateAbsencesPerDay groups multiple K records on same day', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', periodIndex: 1, studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-05', periodIndex: 2, studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-05', periodIndex: 3, studentId: '269398', classId: '6A1', type: 'K' },
      ];
      // Without deduplication -> raw event count is 3 -> triggers warning
      const rawAlerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: refDateStr,
        deduplicateAbsencesPerDay: false,
      });
      expect(rawAlerts.length).toBe(1);

      // With deduplication -> distinct day count is 1 -> does NOT trigger warning (1 < 3)
      const dedupAlerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: refDateStr,
        deduplicateAbsencesPerDay: true,
      });
      expect(dedupAlerts).toEqual([]);
    });

    it('Test 12: Sorting Order - Critical alerts appear before Warning alerts', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: '269048', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: '269048', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: '269048', classId: '6A1', type: 'K' },

        { date: '2026-10-05', studentId: '291001', classId: '9A3', type: 'K' },
        { date: '2026-10-06', studentId: '291001', classId: '9A3', type: 'K' },
        { date: '2026-10-07', studentId: '291001', classId: '9A3', type: 'K' },
      ];

      // Make 291001 critical with 3 negative notes
      const notes: BehaviorNote[] = [
        {
          id: 'n1',
          studentId: '291001',
          studentName: 'Trần Văn Nam',
          classId: '9A3',
          type: 'negative',
          category: 'disruption',
          content: 'Mất trật tự',
          description: 'Mất trật tự',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-05',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'n2',
          studentId: '291001',
          studentName: 'Trần Văn Nam',
          classId: '9A3',
          type: 'negative',
          category: 'disruption',
          content: 'Mất trật tự',
          description: 'Mất trật tự',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-06',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
        {
          id: 'n3',
          studentId: '291001',
          studentName: 'Trần Văn Nam',
          classId: '9A3',
          type: 'negative',
          category: 'disruption',
          content: 'Mất trật tự',
          description: 'Mất trật tự',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-07',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        },
      ];

      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, {
        referenceDate: refDateStr,
      });

      expect(alerts.length).toBe(2);
      expect(alerts[0].studentId).toBe('291001'); // Critical student first
      expect(alerts[0].level).toBe('critical');
      expect(alerts[1].studentId).toBe('269048');
      expect(alerts[1].level).toBe('warning');
    });

    it('Test 13: Class Filtering - options.classId only evaluates students in that class', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: '269398', classId: '6A1', type: 'K' },
        { date: '2026-10-05', studentId: '291001', classId: '9A3', type: 'K' },
        { date: '2026-10-06', studentId: '291001', classId: '9A3', type: 'K' },
        { date: '2026-10-07', studentId: '291001', classId: '9A3', type: 'K' },
      ];

      const alerts6A1 = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: refDateStr,
        classId: '6A1',
      });
      expect(alerts6A1.length).toBe(1);
      expect(alerts6A1[0].studentId).toBe('269398');
    });
  });

  describe('3. Unified Student Timeline Builder', () => {
    it('merges absences and behavior notes and sorts chronologically newest first', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-04', studentId: '269398', classId: '6A1', type: 'K', periodIndex: 2 },
        { date: '2026-10-06', studentId: '269398', classId: '6A1', type: 'P' },
        { date: '2026-10-08', studentId: '269398', classId: '6A1', type: 'Late' },
      ];

      const notes: BehaviorNote[] = [
        {
          id: 'n1',
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Phát biểu bài xuất sắc',
          description: 'Phát biểu bài xuất sắc',
          authorId: 'mrlinhums',
          authorName: 'Nguyễn Mạnh Linh',
          authorRole: 'admin',
          date: '2026-10-09',
          createdAt: parseDateString('2026-10-09').getTime(),
          updatedAt: parseDateString('2026-10-09').getTime(),
          timestamp: parseDateString('2026-10-09').getTime(),
        },
      ];

      const timeline = buildStudentTimeline('269398', absences, notes);
      expect(timeline.length).toBe(4);

      // Newest first
      expect(timeline[0].date).toBe('2026-10-09');
      expect(timeline[0].badgeVariant).toBe('emerald');
      expect(timeline[0].badgeLabel).toBe('Khen ngợi');

      expect(timeline[1].date).toBe('2026-10-08');
      expect(timeline[1].badgeVariant).toBe('blue');
      expect(timeline[1].badgeLabel).toBe('Đi muộn');

      expect(timeline[2].date).toBe('2026-10-06');
      expect(timeline[2].badgeVariant).toBe('amber');
      expect(timeline[2].badgeLabel).toBe('Vắng có phép (P)');

      expect(timeline[3].date).toBe('2026-10-04');
      expect(timeline[3].badgeVariant).toBe('rose');
      expect(timeline[3].badgeLabel).toBe('Vắng không phép (K)');
    });
  });
});
