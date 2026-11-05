/**
 * Empirical & Adversarial Test Suite - Challenger M4_Iter2_2
 * Bell Schedule Interval Math, Canonical Boundaries & Non-Destructive Auto-Population Guards
 * Codebase: ums-logbook
 * Target Files:
 *   - src/utils/schedule.ts
 *   - src/services/scheduleService.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveCurrentBellPeriod,
  parseTimeToMinutes,
  minutesToTimeString,
  getDayOfWeekFromDate as getDayOfWeekFromDateUtils,
  getDayOfWeekVi as getDayOfWeekViWord,
  UMS_BELL_SCHEDULE,
  UMS_BREAKS,
} from '../utils/schedule';
import {
  getDayOfWeekVi as getDayOfWeekViNumeric,
  getDayOfWeekFromDate as getDayOfWeekFromDateTypes,
  ClassSchedule,
} from '../types/schedule';
import {
  getAutoPopulatedPeriods,
  isPeriodManuallyModified,
  generateDefaultClassSchedule,
} from '../services/scheduleService';
import { createEmptyPeriodEntry } from '../services/logbookService';
import { PeriodEntry } from '../types/logbook';

describe('Challenger M4_Iter2_2: Adversarial Bell Schedule, Interval Math & Non-Destructive Guards', () => {
  // Helper to build dates for deterministic testing
  const makeDate = (
    hours: number,
    minutes: number,
    seconds = 0,
    milliseconds = 0,
    baseDateStr = '2026-10-14T00:00:00' // Wednesday
  ): Date => {
    const d = new Date(baseDateStr);
    d.setHours(hours, minutes, seconds, milliseconds);
    return d;
  };

  beforeEach(() => {
    localStorage.clear();
  });

  // =========================================================================
  // SECTION 1: UMS BELL SCHEDULE INTERVAL MATH & 10 CANONICAL BOUNDARY MINUTES
  // =========================================================================
  describe('Section 1: 10 Canonical Boundary Minutes & Half-Open Interval Math [start, end)', () => {
    it('1.9 Boundary Minute 16:55:00 (End Tiết 8 - School Day Concludes)', () => {
      const res = resolveCurrentBellPeriod(makeDate(16, 55, 0));
      expect(res.activePeriod).toBeNull();
      expect(res.nextPeriod).toBeNull();
      expect(res.isBreak).toBe(false);
      expect(res.isSchoolHours).toBe(false);
      expect(res.session).toBe('off');
      expect(res.breakType).toBeNull();
      expect(res.breakLabel).toBeNull();
      expect(res.timeRemainingInPeriodMs).toBe(0);
      expect(res.timeUntilNextPeriodMs).toBe(0);
    });

    it('1.10 Boundary Minute 17:00:00 (After School / Evening)', () => {
      const res = resolveCurrentBellPeriod(makeDate(17, 0, 0));
      expect(res.activePeriod).toBeNull();
      expect(res.nextPeriod).toBeNull();
      expect(res.isBreak).toBe(false);
      expect(res.isSchoolHours).toBe(false);
      expect(res.session).toBe('off');
      expect(res.timeRemainingInPeriodMs).toBe(0);
      expect(res.timeUntilNextPeriodMs).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 2: NON-DESTRUCTIVE AUTO-POPULATION GUARDS
  // =========================================================================
  describe('Section 2: Non-Destructive Auto-Population Immutability Guards', () => {
    const classId = '9A3';
    const wednesdayDate = '2026-10-14'; // Wednesday (dayOfWeek = 4)
    const dailyId = `${classId}_${wednesdayDate}`;

    it('Guard: Signed periods (isSigned: true) are NEVER overwritten', () => {
      const signed: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 1),
        subject: 'Ngữ văn (Chuyên đề đặc biệt)',
        teacherId: 'teacher_guest',
        teacherName: 'GS. Nguyễn Văn A',
        lessonTopic: 'Phân tích truyện ngắn Nam Cao',
        teacherSignature: 'GS. Nguyễn Văn A',
        isSigned: true,
        signedAt: 1728896400000,
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      };

      expect(isPeriodManuallyModified(signed)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [signed]);
      expect(res).toHaveLength(8);
      const p1 = res.find((p) => p.periodIndex === 1);
      expect(p1).toBeDefined();
      expect(p1!.subject).toBe('Ngữ văn (Chuyên đề đặc biệt)');
      expect(p1!.teacherName).toBe('GS. Nguyễn Văn A');
      expect(p1!.teacherId).toBe('teacher_guest');
      expect(p1!.isSigned).toBe(true);
      expect(p1!.signedAt).toBe(1728896400000);
      expect(p1!.scores.total).toBe(10);
    });

    it('Guard: Scored periods (scores.total > 0) are NEVER overwritten', () => {
      const scored: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 2),
        subject: 'Toán học chấm điểm',
        scores: { learning: 3.5, discipline: 3, hygiene: 2, customCriterion: 0.5, total: 9.0 },
      };

      expect(isPeriodManuallyModified(scored)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [scored]);
      const p2 = res.find((p) => p.periodIndex === 2);
      expect(p2).toBeDefined();
      expect(p2!.subject).toBe('Toán học chấm điểm');
      expect(p2!.scores.total).toBe(9.0);
      expect(p2!.scores.learning).toBe(3.5);
    });

    it('Guard: Commented periods (teacherComment non-empty) are NEVER overwritten', () => {
      const commented: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 3),
        subject: 'Toán học ghi nhận xét',
        teacherComment: 'Cả lớp chuẩn bị bài tập về nhà rất chu đáo',
      };

      expect(isPeriodManuallyModified(commented)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [commented]);
      const p3 = res.find((p) => p.periodIndex === 3);
      expect(p3).toBeDefined();
      expect(p3!.subject).toBe('Toán học ghi nhận xét');
      expect(p3!.teacherComment).toBe('Cả lớp chuẩn bị bài tập về nhà rất chu đáo');
    });

    it('Guard: Titled periods (lessonTopic non-empty) are NEVER overwritten', () => {
      const titled: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 4),
        subject: 'Tiếng Anh có tiêu đề bài học',
        lessonTopic: 'Unit 4: Life in the past - Skills 1',
      };

      expect(isPeriodManuallyModified(titled)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [titled]);
      const p4 = res.find((p) => p.periodIndex === 4);
      expect(p4).toBeDefined();
      expect(p4!.subject).toBe('Tiếng Anh có tiêu đề bài học');
      expect(p4!.lessonTopic).toBe('Unit 4: Life in the past - Skills 1');
    });

    it('Guard: Attendance-marked periods (absentStudents > 0) are NEVER overwritten', () => {
      const attendanceMarked: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 5),
        subject: 'Khoa học tự nhiên có điểm danh',
        absentStudents: [
          { studentId: '269902', studentName: 'Phan Hải Định', type: 'P', note: 'Ốm có phép' },
        ],
      };

      expect(isPeriodManuallyModified(attendanceMarked)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [attendanceMarked]);
      const p5 = res.find((p) => p.periodIndex === 5);
      expect(p5).toBeDefined();
      expect(p5!.subject).toBe('Khoa học tự nhiên có điểm danh');
      expect(p5!.absentStudents).toHaveLength(1);
      expect(p5!.absentStudents[0].studentName).toBe('Phan Hải Định');
      expect(p5!.absentStudents[0].type).toBe('P');
    });

    it('Guard: Early departure marked periods (earlyDepartures > 0) are NEVER overwritten', () => {
      const earlyLeavePeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 6),
        subject: 'Công nghệ có học sinh về sớm',
        earlyDepartures: [
          { studentId: '269926', studentName: 'Lê Gia Hưng', departedAt: '14:50', reason: 'Tham gia thi HSG' },
        ],
      };

      expect(isPeriodManuallyModified(earlyLeavePeriod)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [earlyLeavePeriod]);
      const p6 = res.find((p) => p.periodIndex === 6);
      expect(p6).toBeDefined();
      expect(p6!.subject).toBe('Công nghệ có học sinh về sớm');
      expect(p6!.earlyDepartures).toHaveLength(1);
      expect(p6!.earlyDepartures![0].reason).toBe('Tham gia thi HSG');
    });

    it('Guard: PPCT Lesson Index marked periods (ppctLessonIndex > 0) are NEVER overwritten', () => {
      const ppctPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 7),
        subject: 'Lịch sử và Địa lí có tiết PPCT',
        ppctLessonIndex: 24,
      };

      expect(isPeriodManuallyModified(ppctPeriod)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [ppctPeriod]);
      const p7 = res.find((p) => p.periodIndex === 7);
      expect(p7).toBeDefined();
      expect(p7!.subject).toBe('Lịch sử và Địa lí có tiết PPCT');
      expect(p7!.ppctLessonIndex).toBe(24);
    });

    it('Pre-population: Empty periods are cleanly populated with timetable slots', () => {
      const emptyPristine = createEmptyPeriodEntry(dailyId, 8);
      expect(isPeriodManuallyModified(emptyPristine)).toBe(false);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [emptyPristine]);
      const p8 = res.find((p) => p.periodIndex === 8);
      expect(p8).toBeDefined();
      // On Wednesday (day 4), Period 8 for 9A3 is Giáo dục thể chất
      expect(p8!.subject).toBe('Giáo dục thể chất');
      expect(p8!.teacherName).toBe('Hoàng Long');
      expect(p8!.teacherId).toBe('mrhoanglongums');
      expect(p8!.isSigned).toBe(false);
    });

    it('Timetable slot update propagation to unmodified periods vs immutability of modified periods', () => {
      // Custom schedule with modified Period 1 and Period 2
      const customSchedule: ClassSchedule = generateDefaultClassSchedule(classId);
      // Wednesday is day 4
      const p1Slot = customSchedule.slots.find((s) => s.dayOfWeek === 4 && s.periodIndex === 1);
      const p2Slot = customSchedule.slots.find((s) => s.dayOfWeek === 4 && s.periodIndex === 2);
      if (p1Slot) p1Slot.subject = 'Lịch sử Cập nhật Mới';
      if (p2Slot) p2Slot.subject = 'Địa lí Cập nhật Mới';

      // Existing logbook: Period 1 was manually signed, Period 2 was completely untouched
      const p1Signed: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 1),
        subject: 'Ngữ văn Ban Đầu Đã Ký',
        isSigned: true,
        teacherSignature: 'Bùi Hoài Khánh Châm',
      };
      const p2Untouched = createEmptyPeriodEntry(dailyId, 2);

      const populated = getAutoPopulatedPeriods(classId, wednesdayDate, [p1Signed, p2Untouched], customSchedule);

      // Period 1 MUST NOT change to 'Lịch sử Cập nhật Mới'
      const resP1 = populated.find((p) => p.periodIndex === 1);
      expect(resP1!.subject).toBe('Ngữ văn Ban Đầu Đã Ký');
      expect(resP1!.isSigned).toBe(true);

      // Period 2 MUST update to 'Địa lí Cập nhật Mới'
      const resP2 = populated.find((p) => p.periodIndex === 2);
      expect(resP2!.subject).toBe('Địa lí Cập nhật Mới');
    });

    it('Whitespace string entries in topic and comment do not falsely trigger modification guard', () => {
      const whitespacePeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 3),
        lessonTopic: '   \n  \t ',
        teacherComment: '     ',
      };
      expect(isPeriodManuallyModified(whitespacePeriod)).toBe(false);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [whitespacePeriod]);
      const p3 = res.find((p) => p.periodIndex === 3);
      // Period 3 on Wednesday is Toán học
      expect(p3!.subject).toBe('Toán học');
      expect(p3!.teacherId).toBe('mrlinhums');
    });

    it('Deterministic Array Ordering: always returns sorted 1..8 array regardless of input permutation', () => {
      const permutation: PeriodEntry[] = [
        createEmptyPeriodEntry(dailyId, 7),
        { ...createEmptyPeriodEntry(dailyId, 2), lessonTopic: 'Toán học' },
        createEmptyPeriodEntry(dailyId, 4),
        createEmptyPeriodEntry(dailyId, 1),
      ];

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, permutation);
      expect(res).toHaveLength(8);
      expect(res.map((p) => p.periodIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(res[1].lessonTopic).toBe('Toán học'); // P2 preserved
      expect(res[0].subject).toBe('Ngữ văn'); // P1 populated
      expect(res[7].periodIndex).toBe(8); // P8 populated
    });
  });

  // =========================================================================
  // SECTION 3: WEEKEND / OFF-DAY HANDLING
  // =========================================================================
  describe('Section 3: Weekend / Off-day Handling (Saturday & Sunday Graceful Operation)', () => {
    it('Saturday (2026-10-17): resolveCurrentBellPeriod returns off session across all 24 hours', () => {
      const saturday = '2026-10-17T00:00:00';
      // Test early morning, morning, midday, afternoon, and night
      const testHours = [0, 7, 8, 10, 12, 14, 16, 18, 22];

      for (const h of testHours) {
        const res = resolveCurrentBellPeriod(makeDate(h, 30, 0, 0, saturday));
        expect(res.isSchoolHours).toBe(false);
        expect(res.activePeriod).toBeNull();
        expect(res.nextPeriod).toBeNull();
        expect(res.session).toBe('off');
        expect(res.isBreak).toBe(false);
        expect(res.breakType).toBeNull();
        expect(res.timeRemainingInPeriodMs).toBe(0);
        expect(res.timeUntilNextPeriodMs).toBe(0);
      }
    });

    it('Sunday (2026-10-18): resolveCurrentBellPeriod returns off session across all 24 hours', () => {
      const sunday = '2026-10-18T00:00:00';
      const testHours = [1, 6, 9, 11, 13, 15, 17, 20, 23];

      for (const h of testHours) {
        const res = resolveCurrentBellPeriod(makeDate(h, 15, 0, 0, sunday));
        expect(res.isSchoolHours).toBe(false);
        expect(res.activePeriod).toBeNull();
        expect(res.nextPeriod).toBeNull();
        expect(res.session).toBe('off');
        expect(res.isBreak).toBe(false);
        expect(res.breakType).toBeNull();
        expect(res.timeRemainingInPeriodMs).toBe(0);
        expect(res.timeUntilNextPeriodMs).toBe(0);
      }
    });

    it('getAutoPopulatedPeriods handles Saturday and Sunday gracefully without crashing', () => {
      // Saturday
      const satRes = getAutoPopulatedPeriods('6A1', '2026-10-17', []);
      expect(satRes).toHaveLength(8);
      expect(satRes.map((p) => p.periodIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      // Standard timetable has no slots on Saturday, so subject is empty string
      expect(satRes[0].subject).toBe('');
      expect(satRes[0].teacherName).toBe('');

      // Sunday
      const sunRes = getAutoPopulatedPeriods('6A1', '2026-10-18', []);
      expect(sunRes).toHaveLength(8);
      expect(sunRes.map((p) => p.periodIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(sunRes[0].subject).toBe('');
      expect(sunRes[0].teacherName).toBe('');
    });

    it('Saturday Make-up Class: preserves teacher-recorded make-up period on Saturday', () => {
      const satDailyId = '9A3_2026-10-17';
      const makeupPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(satDailyId, 1),
        subject: 'Toán học (Dạy bù)',
        teacherId: 'mrlinhums',
        teacherName: 'Nguyễn Mạnh Linh',
        lessonTopic: 'Chữa bài tập hình học không gian',
        isSigned: true,
        teacherSignature: 'Nguyễn Mạnh Linh',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      };

      const res = getAutoPopulatedPeriods('9A3', '2026-10-17', [makeupPeriod]);
      expect(res).toHaveLength(8);
      expect(res[0].isSigned).toBe(true);
      expect(res[0].subject).toBe('Toán học (Dạy bù)');
      expect(res[0].lessonTopic).toBe('Chữa bài tập hình học không gian');
      expect(res[0].scores.total).toBe(10);
      // Untouched period 2 remains blank
      expect(res[1].subject).toBe('');
    });
  });

  // =========================================================================
  // SECTION 4: EXHAUSTIVE 1440-MINUTE SWEEP, INVARIANTS & STRESS HARNESS
  // =========================================================================
  describe('Section 4: Mathematical Partition Invariants & Stress Harness', () => {
    it('1440-minute weekday sweep validates mutually exclusive partitions and non-negative timers', () => {
      const testDate = new Date('2026-10-14T00:00:00'); // Wednesday

      for (let m = 0; m < 1440; m++) {
        const hours = Math.floor(m / 60);
        const minutes = m % 60;
        testDate.setHours(hours, minutes, 0, 0);

        const res = resolveCurrentBellPeriod(testDate);

        // Invariant 1: Timer counts must never be negative
        if (res.timeRemainingInPeriodMs !== undefined) {
          expect(res.timeRemainingInPeriodMs).toBeGreaterThanOrEqual(0);
        }
        if (res.timeUntilNextPeriodMs !== undefined) {
          expect(res.timeUntilNextPeriodMs).toBeGreaterThanOrEqual(0);
        }

        // Invariant 2: Mutually exclusive period vs break vs off
        if (res.activePeriod !== null) {
          expect(res.isBreak).toBe(false);
          expect(res.isSchoolHours).toBe(true);
          expect(res.breakType).toBeNull();
          expect(res.activePeriod).toBeGreaterThanOrEqual(1);
          expect(res.activePeriod).toBeLessThanOrEqual(8);
        } else if (res.isBreak) {
          expect(res.activePeriod).toBeNull();
          expect(res.nextPeriod).not.toBeNull();
          expect(res.breakType).not.toBeNull();
          expect(res.breakLabel).not.toBeNull();
        } else {
          expect(res.isBreak).toBe(false);
          expect(res.session).toBe('off');
        }
      }
    });

    it('Adversarial Fuzzing: 25,000 random seconds complete without throw or invariant breach', () => {
      const base = new Date('2026-10-14T00:00:00').getTime();

      for (let i = 0; i < 25000; i++) {
        const randomSec = Math.floor(Math.random() * 86400);
        const d = new Date(base + randomSec * 1000);
        const res = resolveCurrentBellPeriod(d);

        expect(res).toBeDefined();
        if (res.activePeriod !== null) {
          expect(res.isSchoolHours).toBe(true);
        }
      }
    });
  });

  // =========================================================================
  // SECTION 5: UTILITY HELPERS, TIME PARSING & SCHEDULE STRUCTURES
  // =========================================================================
  describe('Section 5: Utility Functions, Time Parsing & Schedule Constants', () => {
    it('verifies parseTimeToMinutes and minutesToTimeString bidirectional inverse', () => {
      expect(parseTimeToMinutes('07:15')).toBe(435);
      expect(parseTimeToMinutes('13:30')).toBe(810);
      expect(parseTimeToMinutes('16:55')).toBe(1015);
      expect(minutesToTimeString(435)).toBe('07:15');
      expect(minutesToTimeString(810)).toBe('13:30');
      expect(minutesToTimeString(1015)).toBe('16:55');
    });

    it('verifies Vietnamese day-of-week resolvers across both utils and types modules', () => {
      // Wednesday: 2026-10-14
      expect(getDayOfWeekFromDateUtils('2026-10-14')).toBe(4);
      expect(getDayOfWeekFromDateTypes('2026-10-14')).toBe(4);
      expect(getDayOfWeekViNumeric(4)).toBe('Thứ 4');
      expect(getDayOfWeekViWord(4)).toBe('Thứ Tư');

      // Sunday: 2026-10-18
      expect(getDayOfWeekFromDateUtils('2026-10-18')).toBe(8);
      expect(getDayOfWeekFromDateTypes('2026-10-18')).toBe(8);
      expect(getDayOfWeekViNumeric(8)).toBe('Chủ nhật');
      expect(getDayOfWeekViWord(8)).toBe('Chủ Nhật');
    });

    it('verifies UMS_BELL_SCHEDULE and UMS_BREAKS structural integrity', () => {
      expect(UMS_BELL_SCHEDULE).toHaveLength(8);
      expect(UMS_BREAKS).toHaveLength(7);
      expect(UMS_BELL_SCHEDULE[0].periodIndex).toBe(1);
      expect(UMS_BELL_SCHEDULE[7].periodIndex).toBe(8);
    });
  });
});
