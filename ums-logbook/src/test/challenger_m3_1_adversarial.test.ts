/**
 * CHALLENGER M3_1 ADVERSARIAL TEST SUITE
 * File: src/test/challenger_m3_1_adversarial.test.ts
 *
 * Empirical & Adversarial Stress Testing of the Early Warning Alert Engine:
 * 1. Exact Threshold Stepping (0, 1, 2 vs 3 unexcused, 0, 1, 2 vs 3 negative notes, compound critical)
 * 2. Strict Isolation & False Positive Prevention (P, Late, Positive notes immunity & contamination checks)
 * 3. Rolling 7-Day Window Boundary Testing (Day 1 & Day 7 inclusive, Day 8 exclusive, month/year transitions)
 * 4. Scale, Edge Cases & Data Robustness (Empty arrays, unknown students, unsorted timestamps, stress load)
 */

import { describe, it, expect } from 'vitest';
import {
  getPeriodRange,
  evaluateEarlyWarnings,
  buildStudentTimeline,
  parseDateString,
  getNoteDate,
} from '../utils/earlyWarning';
import { StudentDoc, BehaviorNote } from '../types';
import { AbsenceEvent } from '../types/earlyWarning';

describe('CHALLENGER M3_1: Early Warning Alert Engine Adversarial Suite', () => {
  // Mock student roster spanning multiple classes
  const mockStudents: StudentDoc[] = [
    {
      id: 'student_6a1_01',
      mhs: '269029',
      stt: 1,
      name: 'Bùi Gia An',
      classId: '6A1',
      grade: 6,
      dob: '2015-01-10',
      gender: 'Nam',
      status: 'active',
      createdAt: Date.now(),
    },
    {
      id: 'student_6a1_02',
      mhs: '269963',
      stt: 2,
      name: 'Chu Ngọc Bảo',
      classId: '6A1',
      grade: 6,
      dob: '2015-03-15',
      gender: 'Nữ',
      status: 'active',
      createdAt: Date.now(),
    },
    {
      id: 'student_7a2_01',
      mhs: '252001',
      stt: 1,
      name: 'Đặng Tuấn Cường',
      classId: '7A2',
      grade: 7,
      dob: '2014-05-20',
      gender: 'Nam',
      status: 'active',
      createdAt: Date.now(),
    },
    {
      id: 'student_9a3_01',
      mhs: '233001',
      stt: 1,
      name: 'Hoàng Nhật Minh',
      classId: '9A3',
      grade: 9,
      dob: '2012-08-08',
      gender: 'Nam',
      status: 'active',
      createdAt: Date.now(),
    },
  ];

  const REF_DATE = '2026-10-10'; // Saturday. Window [2026-10-04 .. 2026-10-10]

  // Helper to build a negative behavior note
  const makeNegativeNote = (
    studentId: string,
    date: string,
    idSuffix: string = 'neg',
    content: string = 'Làm việc riêng trong giờ'
  ): BehaviorNote => ({
    id: `note_${studentId}_${idSuffix}`,
    studentId,
    studentName: 'Test Student',
    classId: '6A1',
    type: 'negative',
    category: 'disruption',
    content,
    description: content,
    authorId: 'gvbm_math',
    authorName: 'Thầy Toán',
    authorRole: 'gvbm',
    date,
    createdAt: parseDateString(date).getTime(),
    updatedAt: parseDateString(date).getTime(),
    timestamp: parseDateString(date).getTime(),
  });

  // Helper to build a positive behavior note
  const makePositiveNote = (
    studentId: string,
    date: string,
    idSuffix: string = 'pos',
    content: string = 'Phát biểu hăng hái'
  ): BehaviorNote => ({
    id: `note_${studentId}_${idSuffix}`,
    studentId,
    studentName: 'Test Student',
    classId: '6A1',
    type: 'positive',
    category: 'active_participation',
    content,
    description: content,
    authorId: 'gvbm_eng',
    authorName: 'Cô Tiếng Anh',
    authorRole: 'gvbm',
    date,
    createdAt: parseDateString(date).getTime(),
    updatedAt: parseDateString(date).getTime(),
    timestamp: parseDateString(date).getTime(),
  });

  // =========================================================================
  // 1. EXACT THRESHOLD TESTING
  // =========================================================================
  describe('1. Exact Threshold Stepping (K Absences, Negative Notes & Compound Alerts)', () => {
    it('1.1: 0 unexcused absences (K) produces zero alerts', () => {
      const alerts = evaluateEarlyWarnings(mockStudents, [], [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('1.2: 1 unexcused absence (K) produces zero alerts', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-08', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('1.3: Exactly 2 unexcused absences (K) produces zero alerts (strict < 3 threshold boundary)', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-09', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('1.4: Exactly 3 unexcused absences (K) triggers warning alert with unexcused_absences reason', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-09', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].studentId).toBe('student_6a1_01');
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].reasons).toHaveLength(1);
      expect(alerts[0].reasons[0].type).toBe('unexcused_absences');
      expect(alerts[0].reasons[0].count).toBe(3);
      expect(alerts[0].reasons[0].threshold).toBe(3);
      expect(alerts[0].reasons[0].details).toHaveLength(3);
    });

    it('1.5: 4, 5, and 10 unexcused absences (K) maintain warning alert with exact counted numbers', () => {
      const absences: AbsenceEvent[] = Array.from({ length: 5 }, (_, i) => ({
        date: `2026-10-0${5 + (i % 5)}`,
        periodIndex: i + 1,
        studentId: 'student_6a1_01',
        classId: '6A1',
        type: 'K',
      }));
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].reasons[0].count).toBe(5);
    });

    it('1.6: 0 negative behavior notes produces zero alerts', () => {
      const alerts = evaluateEarlyWarnings(mockStudents, [], [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('1.7: 1 negative behavior note produces zero alerts', () => {
      const notes = [makeNegativeNote('student_6a1_01', '2026-10-07', '1')];
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('1.8: Exactly 2 negative behavior notes produces zero alerts (strict < 3 threshold boundary)', () => {
      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-06', '1'),
        makeNegativeNote('student_6a1_01', '2026-10-08', '2'),
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('1.9: Exactly 3 negative behavior notes triggers warning alert with negative_notes reason', () => {
      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-05', '1'),
        makeNegativeNote('student_6a1_01', '2026-10-07', '2'),
        makeNegativeNote('student_6a1_01', '2026-10-09', '3'),
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].studentId).toBe('student_6a1_01');
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].reasons).toHaveLength(1);
      expect(alerts[0].reasons[0].type).toBe('negative_notes');
      expect(alerts[0].reasons[0].count).toBe(3);
      expect(alerts[0].reasons[0].threshold).toBe(3);
    });

    it('1.10: 4, 7 negative behavior notes maintain warning alert with exact counted numbers', () => {
      const notes = Array.from({ length: 7 }, (_, i) =>
        makeNegativeNote('student_6a1_01', `2026-10-0${4 + (i % 6)}`, `bulk_${i}`)
      );
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].reasons[0].count).toBe(7);
    });

    it('1.11: Compound alert: exactly 3 K absences AND 3 negative notes elevates level to CRITICAL', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-08', 'n1'),
        makeNegativeNote('student_6a1_01', '2026-10-09', 'n2'),
        makeNegativeNote('student_6a1_01', '2026-10-10', 'n3'),
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].studentId).toBe('student_6a1_01');
      expect(alerts[0].level).toBe('critical');
      expect(alerts[0].reasons).toHaveLength(2);

      const types = alerts[0].reasons.map((r) => r.type).sort();
      expect(types).toEqual(['negative_notes', 'unexcused_absences']);
    });

    it('1.12: Asymmetric compound (3 K absences + 2 negative notes) produces WARNING, not critical', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-08', 'n1'),
        makeNegativeNote('student_6a1_01', '2026-10-09', 'n2'),
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].reasons).toHaveLength(1);
      expect(alerts[0].reasons[0].type).toBe('unexcused_absences');
    });

    it('1.13: Asymmetric compound (2 K absences + 3 negative notes) produces WARNING, not critical', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-07', 'n1'),
        makeNegativeNote('student_6a1_01', '2026-10-08', 'n2'),
        makeNegativeNote('student_6a1_01', '2026-10-09', 'n3'),
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].reasons).toHaveLength(1);
      expect(alerts[0].reasons[0].type).toBe('negative_notes');
    });

    it('1.14: Sub-threshold compound (2 K absences + 2 negative notes) produces NO alert at all', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-07', 'n1'),
        makeNegativeNote('student_6a1_01', '2026-10-08', 'n2'),
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('1.15: Super-threshold compound (10 K absences + 12 negative notes) retains CRITICAL level with exact counts', () => {
      const absences: AbsenceEvent[] = Array.from({ length: 10 }, (_, i) => {
        const day = 4 + (i % 7);
        const dayStr = String(day).padStart(2, '0');
        return {
          date: `2026-10-${dayStr}`,
          periodIndex: (i % 8) + 1,
          studentId: 'student_6a1_01',
          classId: '6A1',
          type: 'K' as const,
        };
      });
      const notes = Array.from({ length: 12 }, (_, i) => {
        const day = 4 + (i % 7);
        const dayStr = String(day).padStart(2, '0');
        return makeNegativeNote('student_6a1_01', `2026-10-${dayStr}`, `crit_${i}`);
      });
      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].level).toBe('critical');
      const attReason = alerts[0].reasons.find((r) => r.type === 'unexcused_absences');
      const behReason = alerts[0].reasons.find((r) => r.type === 'negative_notes');
      expect(attReason?.count).toBe(10);
      expect(behReason?.count).toBe(12);
    });
  });

  // =========================================================================
  // 2. ISOLATION & FALSE POSITIVE TESTING
  // =========================================================================
  describe('2. Isolation & False Positive Prevention', () => {
    it('2.1: Exactly 5 excused absences (P) MUST NOT trigger an alert', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-04', studentId: 'student_6a1_01', classId: '6A1', type: 'P' },
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'P' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'P' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'P' },
        { date: '2026-10-08', studentId: 'student_6a1_01', classId: '6A1', type: 'P' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('2.2: Exactly 10 tardy periods (Late) MUST NOT trigger an unexcused absence alert', () => {
      const absences: AbsenceEvent[] = Array.from({ length: 10 }, (_, i) => ({
        date: `2026-10-0${5 + (i % 5)}`,
        periodIndex: i + 1,
        studentId: 'student_6a1_01',
        classId: '6A1',
        type: 'Late',
      }));
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('2.3: Exactly 20 positive behavior notes MUST NOT trigger a negative behavior alert', () => {
      const notes = Array.from({ length: 20 }, (_, i) =>
        makePositiveNote('student_6a1_01', `2026-10-0${4 + (i % 7)}`, `pos_${i}`)
      );
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('2.4: Massive isolation stress: 50 P + 50 Late + 50 Positive notes -> ZERO alerts', () => {
      const absences: AbsenceEvent[] = [
        ...Array.from({ length: 50 }, (_, i) => ({
          date: `2026-10-0${4 + (i % 7)}`,
          periodIndex: (i % 8) + 1,
          studentId: 'student_6a1_01',
          classId: '6A1',
          type: 'P' as const,
        })),
        ...Array.from({ length: 50 }, (_, i) => ({
          date: `2026-10-0${4 + (i % 7)}`,
          periodIndex: (i % 8) + 1,
          studentId: 'student_6a1_01',
          classId: '6A1',
          type: 'Late' as const,
        })),
      ];
      const notes = Array.from({ length: 50 }, (_, i) =>
        makePositiveNote('student_6a1_01', `2026-10-0${4 + (i % 7)}`, `heavy_pos_${i}`)
      );
      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('2.5: Contamination resistance: 2 K + 15 P + 15 Late -> STRICTLY NO ALERT (P and Late do not contaminate K count)', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        ...Array.from({ length: 15 }, (_, i) => ({
          date: `2026-10-0${4 + (i % 7)}`,
          periodIndex: (i % 8) + 1,
          studentId: 'student_6a1_01',
          classId: '6A1',
          type: 'P' as const,
        })),
        ...Array.from({ length: 15 }, (_, i) => ({
          date: `2026-10-0${4 + (i % 7)}`,
          periodIndex: (i % 8) + 1,
          studentId: 'student_6a1_01',
          classId: '6A1',
          type: 'Late' as const,
        })),
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('2.6: Contamination resistance: 2 negative notes + 30 positive notes -> STRICTLY NO ALERT', () => {
      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-05', 'neg1'),
        makeNegativeNote('student_6a1_01', '2026-10-06', 'neg2'),
        ...Array.from({ length: 30 }, (_, i) =>
          makePositiveNote('student_6a1_01', `2026-10-0${4 + (i % 7)}`, `pos_contam_${i}`)
        ),
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, [], notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('2.7: Student-to-student isolation: Student A has 2 K and Student B has 2 K -> zero alerts for either student', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-05', studentId: 'student_6a1_02', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_02', classId: '6A1', type: 'K' },
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('2.8: Timeline item isolation & badge formatting in buildStudentTimeline', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-04', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'P' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'Late' },
      ];
      const notes: BehaviorNote[] = [
        makePositiveNote('student_6a1_01', '2026-10-07', 'p1'),
        makeNegativeNote('student_6a1_01', '2026-10-08', 'n1'),
      ];

      const timeline = buildStudentTimeline('student_6a1_01', absences, notes);
      expect(timeline).toHaveLength(5);

      const kItem = timeline.find((t) => t.date === '2026-10-04');
      const pItem = timeline.find((t) => t.date === '2026-10-05');
      const lateItem = timeline.find((t) => t.date === '2026-10-06');
      const posItem = timeline.find((t) => t.date === '2026-10-07');
      const negItem = timeline.find((t) => t.date === '2026-10-08');

      expect(kItem?.badgeVariant).toBe('rose');
      expect(kItem?.badgeLabel).toBe('Vắng không phép (K)');

      expect(pItem?.badgeVariant).toBe('amber');
      expect(pItem?.badgeLabel).toBe('Vắng có phép (P)');

      expect(lateItem?.badgeVariant).toBe('blue');
      expect(lateItem?.badgeLabel).toBe('Đi muộn');

      expect(posItem?.badgeVariant).toBe('emerald');
      expect(posItem?.badgeLabel).toBe('Khen ngợi');

      expect(negItem?.badgeVariant).toBe('rose');
      expect(negItem?.badgeLabel).toBe('Vi phạm nề nếp');
    });
  });

  // =========================================================================
  // 3. ROLLING 7-DAY WINDOW BOUNDARY TESTING
  // =========================================================================
  describe('3. Rolling 7-Day Window Boundary Testing', () => {
    it('3.1: Event on Day 1 (reference date) and Day 7 (start date) MUST be counted', () => {
      // REF_DATE is 2026-10-10. Start date is 2026-10-04.
      const absences: AbsenceEvent[] = [
        { date: '2026-10-04', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 7 (start)
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Mid-window
        { date: '2026-10-10', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 1 (end)
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].reasons[0].count).toBe(3);
    });

    it('3.2: Event on Day 8 (one day before start date) MUST NOT be counted', () => {
      // Day 8 is 2026-10-03 (one day before 2026-10-04)
      const absences: AbsenceEvent[] = [
        { date: '2026-10-03', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 8 (out)
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 6 (in)
        { date: '2026-10-08', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 3 (in)
      ];
      // Only 2 are inside window -> threshold 3 NOT reached
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('3.3: Event on Day 0 (future date / one day after reference date) MUST NOT be counted', () => {
      // Day 0 is 2026-10-11 (future relative to 2026-10-10)
      const absences: AbsenceEvent[] = [
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // In
        { date: '2026-10-08', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // In
        { date: '2026-10-11', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Future (out)
      ];
      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(0);
    });

    it('3.4: Boundary tipping test: shifting Day 8 event to Day 7 tips status from clean to warning', () => {
      // Scenario A: 2 in window + 1 on Day 8 (2026-10-03) -> NO ALERT
      const absencesA: AbsenceEvent[] = [
        { date: '2026-10-03', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-09', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      expect(evaluateEarlyWarnings(mockStudents, absencesA, [], { referenceDate: REF_DATE })).toHaveLength(0);

      // Scenario B: Shift 2026-10-03 to 2026-10-04 (Day 7 start date) -> ALERT TRIGGERED
      const absencesB: AbsenceEvent[] = [
        { date: '2026-10-04', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-09', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const alertsB = evaluateEarlyWarnings(mockStudents, absencesB, [], { referenceDate: REF_DATE });
      expect(alertsB).toHaveLength(1);
      expect(alertsB[0].reasons[0].count).toBe(3);
    });

    it('3.5: Date input formats: Date instance vs "YYYY-MM-DD" string produce identical boundaries', () => {
      const strRange = getPeriodRange('2026-10-10', 'rolling_7_days');
      const dateRange = getPeriodRange(new Date(2026, 9, 10), 'rolling_7_days');

      expect(strRange.startDate).toBe('2026-10-04');
      expect(strRange.endDate).toBe('2026-10-10');
      expect(dateRange.startDate).toBe(strRange.startDate);
      expect(dateRange.endDate).toBe(strRange.endDate);
    });

    it('3.6: Month transition boundary: rolling 7 days handles leap and non-leap month rollovers', () => {
      // 2026 is non-leap year: February has 28 days
      // Reference date: 2026-03-03
      // Past 6 days: March 3, 2, 1, Feb 28, 27, 26, 25 -> startDate is 2026-02-25
      const marchRange = getPeriodRange('2026-03-03', 'rolling_7_days');
      expect(marchRange.startDate).toBe('2026-02-25');
      expect(marchRange.endDate).toBe('2026-03-03');

      const absences: AbsenceEvent[] = [
        { date: '2026-02-24', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 8 (excluded)
        { date: '2026-02-25', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 7 (included)
        { date: '2026-02-28', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 4 (included)
        { date: '2026-03-03', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 1 (included)
        { date: '2026-03-04', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Future (excluded)
      ];

      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: '2026-03-03' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].reasons[0].count).toBe(3); // exactly 3 inside window
    });

    it('3.7: Year transition boundary: rolling 7 days handles December-to-January rollover', () => {
      // Reference date: 2026-01-03
      // 6 days prior -> 2025-12-28
      const yearRange = getPeriodRange('2026-01-03', 'rolling_7_days');
      expect(yearRange.startDate).toBe('2025-12-28');
      expect(yearRange.endDate).toBe('2026-01-03');

      const absences: AbsenceEvent[] = [
        { date: '2025-12-27', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 8 (excluded)
        { date: '2025-12-28', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 7 (included)
        { date: '2025-12-31', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Included
        { date: '2026-01-03', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Day 1 (included)
        { date: '2026-01-04', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Future (excluded)
      ];

      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], { referenceDate: '2026-01-03' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].reasons[0].count).toBe(3);
    });

    it('3.8: School week mode boundary: evaluates strictly Monday through Sunday of current week', () => {
      // Wednesday 2026-10-07 -> Mon 2026-10-05 to Sun 2026-10-11
      const weekRange = getPeriodRange('2026-10-07', 'school_week');
      expect(weekRange.startDate).toBe('2026-10-05');
      expect(weekRange.endDate).toBe('2026-10-11');

      const absences: AbsenceEvent[] = [
        { date: '2026-10-04', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Previous Sunday (excluded)
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Monday (included)
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Wednesday (included)
        { date: '2026-10-11', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Sunday (included)
        { date: '2026-10-12', studentId: 'student_6a1_01', classId: '6A1', type: 'K' }, // Next Monday (excluded)
      ];

      const alerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: '2026-10-07',
        windowMode: 'school_week',
      });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].reasons[0].count).toBe(3);
    });
  });

  // =========================================================================
  // 4. SCALE, EDGE CASES & DATA ROBUSTNESS
  // =========================================================================
  describe('4. Scale, Edge Cases & Data Robustness', () => {
    it('4.1: Empty inputs: completely empty arrays return empty alerts without throwing', () => {
      expect(evaluateEarlyWarnings([], [], [])).toEqual([]);
      expect(evaluateEarlyWarnings(mockStudents, [], [])).toEqual([]);
      expect(
        evaluateEarlyWarnings([], [{ date: '2026-10-05', studentId: 's1', classId: '6A1', type: 'K' }], [])
      ).toEqual([]);
    });

    it('4.2: Unknown students in absences/notes: gracefully ignored without errors', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'ghost_student_999', classId: '99Z', type: 'K' },
        { date: '2026-10-06', studentId: 'ghost_student_999', classId: '99Z', type: 'K' },
        { date: '2026-10-07', studentId: 'ghost_student_999', classId: '99Z', type: 'K' },
      ];
      const notes = [
        makeNegativeNote('ghost_student_999', '2026-10-05', 'g1'),
        makeNegativeNote('ghost_student_999', '2026-10-06', 'g2'),
        makeNegativeNote('ghost_student_999', '2026-10-07', 'g3'),
      ];

      expect(() => {
        const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
        expect(alerts).toEqual([]);
      }).not.toThrow();
    });

    it('4.3: Unsorted timestamps and inverted dates yield identical deterministic alerts', () => {
      const absencesSorted: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-09', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];

      const absencesShuffled: AbsenceEvent[] = [
        { date: '2026-10-09', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];

      const alertsSorted = evaluateEarlyWarnings(mockStudents, absencesSorted, [], { referenceDate: REF_DATE });
      const alertsShuffled = evaluateEarlyWarnings(mockStudents, absencesShuffled, [], { referenceDate: REF_DATE });

      expect(alertsSorted).toHaveLength(1);
      expect(alertsShuffled).toHaveLength(1);
      expect(alertsSorted[0].studentId).toBe(alertsShuffled[0].studentId);
      expect(alertsSorted[0].level).toBe(alertsShuffled[0].level);
      expect(alertsSorted[0].reasons[0].count).toBe(alertsShuffled[0].reasons[0].count);
      expect(alertsSorted[0].reasons[0].type).toBe(alertsShuffled[0].reasons[0].type);
      expect(alertsSorted[0].reasons[0].threshold).toBe(alertsShuffled[0].reasons[0].threshold);
      expect(alertsSorted[0].reasons[0].details.slice().sort()).toEqual(
        alertsShuffled[0].reasons[0].details.slice().sort()
      );
    });

    it('4.4: buildStudentTimeline chronological ordering: strictly newest first with stable ties', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K', periodIndex: 1 },
        { date: '2026-10-08', studentId: 'student_6a1_01', classId: '6A1', type: 'P', periodIndex: 2 },
      ];
      const notes: BehaviorNote[] = [
        makePositiveNote('student_6a1_01', '2026-10-09', 'p1'),
        makeNegativeNote('student_6a1_01', '2026-10-06', 'n1'),
      ];

      const timeline = buildStudentTimeline('student_6a1_01', absences, notes);
      expect(timeline).toHaveLength(4);

      // Verify descending chronological order
      for (let i = 0; i < timeline.length - 1; i++) {
        expect(timeline[i].timestamp).toBeGreaterThanOrEqual(timeline[i + 1].timestamp);
      }
      expect(timeline[0].date).toBe('2026-10-09');
      expect(timeline[timeline.length - 1].date).toBe('2026-10-05');
    });

    it('4.5: Deduplication option: deduplicateAbsencesPerDay groups intra-day period absences correctly', () => {
      // Student absent periods 1, 2, 3, 4 on single date 2026-10-06
      const absences: AbsenceEvent[] = [
        { date: '2026-10-06', periodIndex: 1, studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', periodIndex: 2, studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', periodIndex: 3, studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', periodIndex: 4, studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];

      // Raw mode (default): 4 period events >= 3 -> WARNING
      const rawAlerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: REF_DATE,
        deduplicateAbsencesPerDay: false,
      });
      expect(rawAlerts).toHaveLength(1);
      expect(rawAlerts[0].reasons[0].count).toBe(4);

      // Deduplicated mode: 1 unique calendar date < 3 -> NO ALERT
      const dedupAlerts = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: REF_DATE,
        deduplicateAbsencesPerDay: true,
      });
      expect(dedupAlerts).toHaveLength(0);
    });

    it('4.6: BehaviorNote timestamp fallback resolution in getNoteDate', () => {
      // 1. Explicit date string
      const noteWithDate: BehaviorNote = {
        ...makeNegativeNote('s1', '2026-10-08'),
        date: '2026-10-08',
      };
      expect(getNoteDate(noteWithDate)).toBe('2026-10-08');

      // 2. Missing date, fallback to timestamp
      const ts = parseDateString('2026-10-07').getTime();
      const noteWithTs = {
        ...makeNegativeNote('s1', ''),
        date: undefined as any,
        timestamp: ts,
      } as BehaviorNote;
      expect(getNoteDate(noteWithTs)).toBe('2026-10-07');

      // 3. Missing date & timestamp, fallback to createdAt
      const noteWithCreatedAt = {
        ...makeNegativeNote('s1', ''),
        date: undefined as any,
        timestamp: undefined as any,
        createdAt: ts,
      } as BehaviorNote;
      expect(getNoteDate(noteWithCreatedAt)).toBe('2026-10-07');
    });

    it('4.7: Alert sorting hierarchy: Critical before Warning, higher violations first, alphabetical tie-break', () => {
      // Setup 3 students:
      // - student_6a1_01: Warning (3 K absences)
      // - student_6a1_02: Critical (3 K + 3 neg notes = 6 violations)
      // - student_7a2_01: Warning (5 K absences = 5 violations)
      // - student_9a3_01: Critical (4 K + 4 neg notes = 8 violations)

      const absences: AbsenceEvent[] = [
        // student_6a1_01 (3 K)
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },

        // student_6a1_02 (3 K)
        { date: '2026-10-05', studentId: 'student_6a1_02', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_02', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_02', classId: '6A1', type: 'K' },

        // student_7a2_01 (5 K)
        ...Array.from({ length: 5 }, (_, i) => ({
          date: `2026-10-0${5 + i}`,
          studentId: 'student_7a2_01',
          classId: '7A2',
          type: 'K' as const,
        })),

        // student_9a3_01 (4 K)
        ...Array.from({ length: 4 }, (_, i) => ({
          date: `2026-10-0${5 + i}`,
          studentId: 'student_9a3_01',
          classId: '9A3',
          type: 'K' as const,
        })),
      ];

      const notes: BehaviorNote[] = [
        // student_6a1_02 (3 neg)
        makeNegativeNote('student_6a1_02', '2026-10-08', '1'),
        makeNegativeNote('student_6a1_02', '2026-10-09', '2'),
        makeNegativeNote('student_6a1_02', '2026-10-10', '3'),

        // student_9a3_01 (4 neg)
        makeNegativeNote('student_9a3_01', '2026-10-06', 'a1'),
        makeNegativeNote('student_9a3_01', '2026-10-07', 'a2'),
        makeNegativeNote('student_9a3_01', '2026-10-08', 'a3'),
        makeNegativeNote('student_9a3_01', '2026-10-09', 'a4'),
      ];

      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(4);

      // 1st: Critical with 8 total violations (student_9a3_01)
      expect(alerts[0].studentId).toBe('student_9a3_01');
      expect(alerts[0].level).toBe('critical');

      // 2nd: Critical with 6 total violations (student_6a1_02)
      expect(alerts[1].studentId).toBe('student_6a1_02');
      expect(alerts[1].level).toBe('critical');

      // 3rd: Warning with 5 total violations (student_7a2_01)
      expect(alerts[2].studentId).toBe('student_7a2_01');
      expect(alerts[2].level).toBe('warning');

      // 4th: Warning with 3 total violations (student_6a1_01)
      expect(alerts[3].studentId).toBe('student_6a1_01');
      expect(alerts[3].level).toBe('warning');
    });

    it('4.8: Class filtering: options.classId strictly scopes alerts to the specified class roster', () => {
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-05', studentId: 'student_7a2_01', classId: '7A2', type: 'K' },
        { date: '2026-10-06', studentId: 'student_7a2_01', classId: '7A2', type: 'K' },
        { date: '2026-10-07', studentId: 'student_7a2_01', classId: '7A2', type: 'K' },
      ];

      const alerts6A1 = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: REF_DATE,
        classId: '6A1',
      });
      expect(alerts6A1).toHaveLength(1);
      expect(alerts6A1[0].classId).toBe('6A1');
      expect(alerts6A1[0].studentId).toBe('student_6a1_01');

      const alerts7A2 = evaluateEarlyWarnings(mockStudents, absences, [], {
        referenceDate: REF_DATE,
        classId: '7A2',
      });
      expect(alerts7A2).toHaveLength(1);
      expect(alerts7A2[0].classId).toBe('7A2');
      expect(alerts7A2[0].studentId).toBe('student_7a2_01');
    });

    it('4.9: Custom threshold override: absenceThreshold and noteThreshold options are honored', () => {
      // Test custom absenceThreshold: 5, noteThreshold: 2
      const absences: AbsenceEvent[] = [
        { date: '2026-10-05', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-06', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
        { date: '2026-10-07', studentId: 'student_6a1_01', classId: '6A1', type: 'K' },
      ];
      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-08', '1'),
        makeNegativeNote('student_6a1_01', '2026-10-09', '2'),
      ];

      // With default thresholds (3, 3): absences triggers warning, notes does not
      const defaultAlerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(defaultAlerts[0].level).toBe('warning');
      expect(defaultAlerts[0].reasons[0].type).toBe('unexcused_absences');

      // With custom thresholds (5, 2): absences (3 < 5) does not trigger, notes (2 >= 2) triggers warning!
      const customAlerts = evaluateEarlyWarnings(mockStudents, absences, notes, {
        referenceDate: REF_DATE,
        absenceThreshold: 5,
        noteThreshold: 2,
      });
      expect(customAlerts).toHaveLength(1);
      expect(customAlerts[0].reasons[0].type).toBe('negative_notes');
      expect(customAlerts[0].reasons[0].threshold).toBe(2);
    });

    it('4.10: High-volume stress testing: 100 students, 2,000 absences, 2,000 notes completes in < 150ms', () => {
      const largeStudentRoster: StudentDoc[] = Array.from({ length: 100 }, (_, i) => ({
        id: `stress_student_${i}`,
        mhs: `2600${String(i).padStart(3, '0')}`,
        stt: i + 1,
        name: `Học Sinh Test ${i}`,
        classId: `6A${(i % 8) + 1}`,
        grade: 6,
        dob: '2015-01-01',
        gender: i % 2 === 0 ? 'Nam' : 'Nữ',
        status: 'active',
        createdAt: Date.now(),
      }));

      // Generate 2000 absence events across students and dates
      const largeAbsences: AbsenceEvent[] = [];
      for (let i = 0; i < 2000; i++) {
        const student = largeStudentRoster[i % 100];
        const dayOffset = i % 14; // Some in window (0..6), some outside (7..13)
        const day = 10 - dayOffset;
        const date = day > 0 ? `2026-10-${String(day).padStart(2, '0')}` : '2026-09-28';
        const type: AbsenceEvent['type'] = i % 4 === 0 ? 'K' : i % 4 === 1 ? 'P' : 'Late';
        largeAbsences.push({
          date,
          periodIndex: (i % 8) + 1,
          studentId: student.id,
          classId: student.classId,
          type,
        });
      }

      // Generate 2000 behavior notes
      const largeNotes: BehaviorNote[] = [];
      for (let i = 0; i < 2000; i++) {
        const student = largeStudentRoster[i % 100];
        const dayOffset = i % 14;
        const day = 10 - dayOffset;
        const date = day > 0 ? `2026-10-${String(day).padStart(2, '0')}` : '2026-09-28';
        const isNeg = i % 3 === 0;
        largeNotes.push({
          id: `stress_note_${i}`,
          studentId: student.id,
          studentName: student.name,
          classId: student.classId,
          type: isNeg ? 'negative' : 'positive',
          category: isNeg ? 'disruption' : 'active_participation',
          content: `Test note ${i}`,
          description: `Test note ${i}`,
          authorId: 'gvbm_stress',
          authorName: 'GV Test',
          authorRole: 'gvbm',
          date,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
        });
      }

      const startTime = performance.now();
      const alerts = evaluateEarlyWarnings(largeStudentRoster, largeAbsences, largeNotes, {
        referenceDate: REF_DATE,
      });
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(150); // Performance budget: under 150ms
      expect(Array.isArray(alerts)).toBe(true);

      // Verify that every generated alert satisfies the mathematical invariants
      for (const alert of alerts) {
        expect(alert.reasons.length).toBeGreaterThanOrEqual(1);
        const hasK = alert.reasons.some((r) => r.type === 'unexcused_absences' && r.count >= 3);
        const hasNeg = alert.reasons.some((r) => r.type === 'negative_notes' && r.count >= 3);

        if (alert.level === 'critical') {
          expect(hasK && hasNeg).toBe(true);
        } else {
          expect(hasK || hasNeg).toBe(true);
          expect(hasK && hasNeg).toBe(false);
        }
      }
    });

    it('4.11: Unicode, Vietnamese accents, and formatting safety in alert details', () => {
      const absences: AbsenceEvent[] = [
        {
          date: '2026-10-05',
          periodIndex: 1,
          studentId: 'student_6a1_01',
          classId: '6A1',
          type: 'K',
          note: 'Không phép, không liên lạc được với phụ huynh',
        },
        {
          date: '2026-10-06',
          periodIndex: 3,
          studentId: 'student_6a1_01',
          classId: '6A1',
          type: 'K',
          note: 'Trốn tiết 3 môn Toán 📐',
        },
        {
          date: '2026-10-07',
          studentId: 'student_6a1_01',
          classId: '6A1',
          type: 'K',
          note: 'Đầu buổi không có mặt ❌',
        },
      ];

      const notes = [
        makeNegativeNote('student_6a1_01', '2026-10-08', 'n1', 'Sử dụng điện thoại di động trong giờ học Văn 📱'),
        makeNegativeNote('student_6a1_01', '2026-10-09', 'n2', 'Không làm bài tập về nhà môn Tiếng Anh 📚'),
        makeNegativeNote('student_6a1_01', '2026-10-10', 'n3', 'Gây mất trật tự, cãi lại lời nhắc nhở của giáo viên!'),
      ];

      const alerts = evaluateEarlyWarnings(mockStudents, absences, notes, { referenceDate: REF_DATE });
      expect(alerts).toHaveLength(1);
      const alert = alerts[0];
      expect(alert.level).toBe('critical');

      // Check detail string formatting
      const attDetails = alert.reasons.find((r) => r.type === 'unexcused_absences')?.details || [];
      expect(attDetails[0]).toContain('2026-10-05 (Tiết 1): Vắng không phép (K) - Không phép');
      expect(attDetails[1]).toContain('Trốn tiết 3 môn Toán 📐');
      expect(attDetails[2]).toContain('2026-10-07 (Đầu buổi): Vắng không phép (K) - Đầu buổi không có mặt ❌');

      const behDetails = alert.reasons.find((r) => r.type === 'negative_notes')?.details || [];
      expect(behDetails[0]).toContain('Sử dụng điện thoại di động trong giờ học Văn 📱');
      expect(behDetails[2]).toContain('Gây mất trật tự, cãi lại lời nhắc nhở của giáo viên!');
    });
  });
});
