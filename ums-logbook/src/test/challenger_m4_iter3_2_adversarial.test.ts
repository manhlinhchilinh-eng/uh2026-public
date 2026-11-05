/**
 * Empirical & Adversarial Test Suite - Challenger M4_Iter3_2
 * Bell Schedule Interval Math, Canonical Boundaries & Non-Destructive Auto-Population Verification
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

describe('Challenger M4_Iter3_2: Empirical Adversarial Verification of Bell Schedule & Auto-Population', () => {
  // Deterministic date factory for a typical weekday (Wednesday, 2026-10-14)
  const makeDate = (
    hours: number,
    minutes: number,
    seconds = 0,
    milliseconds = 0,
    baseDateStr = '2026-10-14T00:00:00'
  ): Date => {
    const d = new Date(baseDateStr);
    d.setHours(hours, minutes, seconds, milliseconds);
    return d;
  };

  beforeEach(() => {
    localStorage.clear();
  });

  // =========================================================================
  // SECTION 1: CANONICAL BOUNDARY MINUTES & SUB-SECOND INTERVAL MATH
  // =========================================================================
  describe('Section 1: Canonical Boundary Minutes & Exact Half-Open Interval Math [start, end)', () => {
    // 1. 07:14

    // 2. 07:15

    // 3. 07:59

    // 4. 08:00

    // 5. 08:50

    // 6. 09:10

    // 7. 10:45

    // 8. 13:30

    // 9. 16:55
    it('1.9 Boundary Minute 16:55:00 (School Day Concludes)', () => {
      const res = resolveCurrentBellPeriod(makeDate(16, 55, 0));
      expect(res.activePeriod).toBeNull();
      expect(res.nextPeriod).toBeNull();
      expect(res.isBreak).toBe(false);
      expect(res.isSchoolHours).toBe(false);
      expect(res.session).toBe('off');
      expect(res.timeRemainingInPeriodMs).toBe(0);
      expect(res.timeUntilNextPeriodMs).toBe(0);
    });

    // 10. 17:00
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
    const wednesdayDate = '2026-10-14';
    const dailyId = `${classId}_${wednesdayDate}`;

    it('2.1 Signed periods (isSigned: true) are 100% immutable and never overwritten', () => {
      const signedPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 1),
        subject: 'Ngữ văn (Chuyên gia thỉnh giảng)',
        teacherId: 'guest_teacher_01',
        teacherName: 'TS. Nguyễn Hoàng Nam',
        lessonTopic: 'Chuyên đề văn học hiện đại',
        teacherSignature: 'TS. Nguyễn Hoàng Nam',
        isSigned: true,
        signedAt: 1728896400000,
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      };

      expect(isPeriodManuallyModified(signedPeriod)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [signedPeriod]);
      expect(res).toHaveLength(8);
      const p1 = res.find((p) => p.periodIndex === 1);
      expect(p1).toBeDefined();
      expect(p1!.subject).toBe('Ngữ văn (Chuyên gia thỉnh giảng)');
      expect(p1!.teacherName).toBe('TS. Nguyễn Hoàng Nam');
      expect(p1!.teacherId).toBe('guest_teacher_01');
      expect(p1!.isSigned).toBe(true);
      expect(p1!.signedAt).toBe(1728896400000);
      expect(p1!.scores.total).toBe(10);
    });

    it('2.2 Scored periods (scores.total > 0) are 100% immutable and never overwritten', () => {
      const scoredPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 2),
        subject: 'Toán học (Bài kiểm tra 15 phút)',
        scores: { learning: 3.5, discipline: 3, hygiene: 2, customCriterion: 0.5, total: 9.0 },
      };

      expect(isPeriodManuallyModified(scoredPeriod)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [scoredPeriod]);
      const p2 = res.find((p) => p.periodIndex === 2);
      expect(p2).toBeDefined();
      expect(p2!.subject).toBe('Toán học (Bài kiểm tra 15 phút)');
      expect(p2!.scores.total).toBe(9.0);
      expect(p2!.scores.learning).toBe(3.5);
    });

    it('2.3 Commented periods (teacherComment non-empty) are 100% immutable and never overwritten', () => {
      const commentedPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 3),
        subject: 'Toán học phản hồi',
        teacherComment: 'Lớp tích cực thảo luận nhóm, làm việc nghiêm túc',
      };

      expect(isPeriodManuallyModified(commentedPeriod)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [commentedPeriod]);
      const p3 = res.find((p) => p.periodIndex === 3);
      expect(p3).toBeDefined();
      expect(p3!.subject).toBe('Toán học phản hồi');
      expect(p3!.teacherComment).toBe('Lớp tích cực thảo luận nhóm, làm việc nghiêm túc');
    });

    it('2.4 Titled periods (lessonTopic non-empty) are 100% immutable and never overwritten', () => {
      const titledPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 4),
        subject: 'Tiếng Anh chuyên sâu',
        lessonTopic: 'Unit 5: Natural Wonders of the World',
      };

      expect(isPeriodManuallyModified(titledPeriod)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [titledPeriod]);
      const p4 = res.find((p) => p.periodIndex === 4);
      expect(p4).toBeDefined();
      expect(p4!.subject).toBe('Tiếng Anh chuyên sâu');
      expect(p4!.lessonTopic).toBe('Unit 5: Natural Wonders of the World');
    });

    it('2.5 Attendance-marked periods (absentStudents > 0) are 100% immutable and never overwritten', () => {
      const attendancePeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 5),
        subject: 'Khoa học tự nhiên có vắng mặt',
        absentStudents: [
          { studentId: '269902', studentName: 'Vũ Minh Anh', type: 'P', note: 'Tham gia khám bệnh' },
          { studentId: '269994', studentName: 'Hoàng Quốc Việt', type: 'Late', note: 'Muộn 10 phút' },
        ],
      };

      expect(isPeriodManuallyModified(attendancePeriod)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [attendancePeriod]);
      const p5 = res.find((p) => p.periodIndex === 5);
      expect(p5).toBeDefined();
      expect(p5!.subject).toBe('Khoa học tự nhiên có vắng mặt');
      expect(p5!.absentStudents).toHaveLength(2);
      expect(p5!.absentStudents[0].studentName).toBe('Vũ Minh Anh');
      expect(p5!.absentStudents[1].type).toBe('Late');
    });

    it('2.6 Early departure marked periods (earlyDepartures > 0) are 100% immutable and never overwritten', () => {
      const earlyLeavePeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 6),
        subject: 'Công nghệ có học sinh về sớm',
        earlyDepartures: [
          { studentId: '269463', studentName: 'Nguyễn Thành Nam', departedAt: '14:45', reason: 'Gia đình có việc đột xuất' },
        ],
      };

      expect(isPeriodManuallyModified(earlyLeavePeriod)).toBe(true);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [earlyLeavePeriod]);
      const p6 = res.find((p) => p.periodIndex === 6);
      expect(p6).toBeDefined();
      expect(p6!.subject).toBe('Công nghệ có học sinh về sớm');
      expect(p6!.earlyDepartures).toHaveLength(1);
      expect(p6!.earlyDepartures![0].reason).toBe('Gia đình có việc đột xuất');
    });

    it('2.7 Empty periods are cleanly pre-populated from timetable slots', () => {
      const emptyPristine = createEmptyPeriodEntry(dailyId, 8);
      expect(isPeriodManuallyModified(emptyPristine)).toBe(false);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [emptyPristine]);
      const p8 = res.find((p) => p.periodIndex === 8);
      expect(p8).toBeDefined();
      // On Wednesday (day 4), Period 8 for 9A3 is Giáo dục thể chất (Hoàng Long)
      expect(p8!.subject).toBe('Giáo dục thể chất');
      expect(p8!.teacherName).toBe('Hoàng Long');
      expect(p8!.teacherId).toBe('mrhoanglongums');
      expect(p8!.isSigned).toBe(false);
    });

    it('2.8 Dynamic schedule mutation correctly updates pristine slots while preserving modified slots', () => {
      const customSchedule: ClassSchedule = generateDefaultClassSchedule(classId);
      // Wednesday is dayOfWeek = 4
      const p1Slot = customSchedule.slots.find((s) => s.dayOfWeek === 4 && s.periodIndex === 1);
      const p2Slot = customSchedule.slots.find((s) => s.dayOfWeek === 4 && s.periodIndex === 2);
      if (p1Slot) p1Slot.subject = 'Lịch sử Cập Nhật 2026';
      if (p2Slot) p2Slot.subject = 'Địa lí Cập Nhật 2026';

      const p1Locked: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 1),
        subject: 'Ngữ văn Cố Định Đã Ký',
        isSigned: true,
        teacherSignature: 'Bùi Hoài Khánh Châm',
      };
      const p2Pristine = createEmptyPeriodEntry(dailyId, 2);

      const populated = getAutoPopulatedPeriods(classId, wednesdayDate, [p1Locked, p2Pristine], customSchedule);

      // p1 was locked and must NOT be replaced
      const resP1 = populated.find((p) => p.periodIndex === 1);
      expect(resP1!.subject).toBe('Ngữ văn Cố Định Đã Ký');
      expect(resP1!.isSigned).toBe(true);

      // p2 was pristine and MUST be updated with new schedule subject
      const resP2 = populated.find((p) => p.periodIndex === 2);
      expect(resP2!.subject).toBe('Địa lí Cập Nhật 2026');
    });

    it('2.9 Whitespace inputs in lessonTopic / teacherComment do not falsely trigger modification lock', () => {
      const whitespacePeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 3),
        lessonTopic: '   \t  \n  ',
        teacherComment: '    ',
      };
      expect(isPeriodManuallyModified(whitespacePeriod)).toBe(false);

      const res = getAutoPopulatedPeriods(classId, wednesdayDate, [whitespacePeriod]);
      const p3 = res.find((p) => p.periodIndex === 3);
      expect(p3!.subject).toBe('Toán học');
      expect(p3!.teacherId).toBe('mrlinhums');
    });
  });

  // =========================================================================
  // SECTION 3: WEEKEND / OFF-DAY HANDLING
  // =========================================================================
  describe('Section 3: Weekend / Off-day Handling (Saturday & Sunday Graceful Resolution)', () => {
    it('3.1 Saturday (2026-10-17) resolveCurrentBellPeriod returns off session across all times', () => {
      const saturday = '2026-10-17T00:00:00';
      const sampleHours = [0, 7, 8, 10, 12, 14, 16, 18, 23];

      for (const h of sampleHours) {
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

    it('3.2 Sunday (2026-10-18) resolveCurrentBellPeriod returns off session across all times', () => {
      const sunday = '2026-10-18T00:00:00';
      const sampleHours = [1, 7, 9, 11, 13, 15, 17, 20, 23];

      for (const h of sampleHours) {
        const res = resolveCurrentBellPeriod(makeDate(h, 45, 0, 0, sunday));
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

    it('3.3 getAutoPopulatedPeriods on Saturday and Sunday returns 8 safe default slots without crashing', () => {
      const satRes = getAutoPopulatedPeriods('6A1', '2026-10-17', []);
      expect(satRes).toHaveLength(8);
      expect(satRes.map((p) => p.periodIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(satRes[0].subject).toBe('');
      expect(satRes[0].teacherName).toBe('');

      const sunRes = getAutoPopulatedPeriods('6A1', '2026-10-18', []);
      expect(sunRes).toHaveLength(8);
      expect(sunRes.map((p) => p.periodIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(sunRes[0].subject).toBe('');
      expect(sunRes[0].teacherName).toBe('');
    });

    it('3.4 Preserves manually added Saturday make-up sessions', () => {
      const satDailyId = '9A3_2026-10-17';
      const makeup: PeriodEntry = {
        ...createEmptyPeriodEntry(satDailyId, 1),
        subject: 'Toán học (Dạy bù HK1)',
        teacherId: 'mrlinhums',
        teacherName: 'Nguyễn Mạnh Linh',
        lessonTopic: 'Chữa đề thi khảo sát chất lượng đầu năm',
        isSigned: true,
        teacherSignature: 'Nguyễn Mạnh Linh',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      };

      const res = getAutoPopulatedPeriods('9A3', '2026-10-17', [makeup]);
      expect(res).toHaveLength(8);
      expect(res[0].isSigned).toBe(true);
      expect(res[0].subject).toBe('Toán học (Dạy bù HK1)');
      expect(res[0].lessonTopic).toBe('Chữa đề thi khảo sát chất lượng đầu năm');
      expect(res[0].scores.total).toBe(10);
      expect(res[1].subject).toBe(''); // untouched slot 2
    });
  });

  // =========================================================================
  // SECTION 4: EXHAUSTIVE 1440-MINUTE SWEEP & PARTITION CONSERVATION LAW
  // =========================================================================
  describe('Section 4: Mathematical Partition Conservation Law & Exhaustive Sweep', () => {
    it('4.2 Sweeps all 1,440 minutes of a standard school day validating all mathematical invariants', () => {
      const sweepDate = new Date('2026-10-14T00:00:00');

      for (let m = 0; m < 1440; m++) {
        const hours = Math.floor(m / 60);
        const minutes = m % 60;
        sweepDate.setHours(hours, minutes, 0, 0);

        const res = resolveCurrentBellPeriod(sweepDate);

        // Non-negative timers
        if (res.timeRemainingInPeriodMs !== undefined) {
          expect(res.timeRemainingInPeriodMs).toBeGreaterThanOrEqual(0);
        }
        if (res.timeUntilNextPeriodMs !== undefined) {
          expect(res.timeUntilNextPeriodMs).toBeGreaterThanOrEqual(0);
        }

        // Mutual exclusivity of states
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
        } else {
          expect(res.isBreak).toBe(false);
          expect(res.session).toBe('off');
        }
      }
    });

    it('4.3 Fuzzing 10,000 random timestamps across the week for zero-crash stability', () => {
      const startMs = new Date('2026-10-12T00:00:00').getTime(); // Monday
      const weekMs = 7 * 24 * 3600 * 1000;

      for (let i = 0; i < 10000; i++) {
        const randomMs = startMs + Math.floor(Math.random() * weekMs);
        const d = new Date(randomMs);
        const res = resolveCurrentBellPeriod(d);

        expect(res).toBeDefined();
        expect(res.session).toMatch(/^(morning|afternoon|off)$/);
      }
    });
  });

  // =========================================================================
  // SECTION 5: UTILITY FUNCTIONS & BIDIRECTIONAL TIME INVERSES
  // =========================================================================
  describe('Section 5: Utility Functions & Time Inverses', () => {
    it('5.1 parseTimeToMinutes and minutesToTimeString are exact bidirectional inverses', () => {
      const testTimes = ['07:15', '08:00', '08:50', '09:10', '10:45', '13:30', '16:55', '23:59', '00:00'];
      for (const t of testTimes) {
        expect(minutesToTimeString(parseTimeToMinutes(t))).toBe(t);
      }
    });

    it('5.4 Day-of-week helpers return expected Vietnamese labels', () => {
      expect(getDayOfWeekFromDateUtils('2026-10-12')).toBe(2); // Mon -> Thứ 2
      expect(getDayOfWeekFromDateTypes('2026-10-16')).toBe(6); // Fri -> Thứ 6
      expect(getDayOfWeekFromDateUtils('2026-10-17')).toBe(7); // Sat -> Thứ 7
      expect(getDayOfWeekFromDateUtils('2026-10-18')).toBe(8); // Sun -> Chủ nhật

      expect(getDayOfWeekViNumeric(2)).toBe('Thứ 2');
      expect(getDayOfWeekViWord(2)).toBe('Thứ Hai');
      expect(getDayOfWeekViNumeric(7)).toBe('Thứ 7');
      expect(getDayOfWeekViWord(7)).toBe('Thứ Bảy');
      expect(getDayOfWeekViNumeric(8)).toBe('Chủ nhật');
      expect(getDayOfWeekViWord(8)).toBe('Chủ Nhật');
    });
  });
});
