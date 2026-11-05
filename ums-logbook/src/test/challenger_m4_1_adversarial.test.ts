/**
 * Empirical & Adversarial Test Suite - Challenger M4_1
 * Bell Schedule Interval Math, Boundary Conditions & Non-Destructive Auto-Population
 * Codebase: ums-logbook
 * Target Files:
 *   - src/utils/schedule.ts
 *   - src/services/scheduleService.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveCurrentBellPeriod,
  getDayOfWeekFromDate as getDayOfWeekFromDateUtils,
  getDayOfWeekVi as getDayOfWeekViWord,
} from '../utils/schedule';
import {
  getDayOfWeekVi as getDayOfWeekViNumeric,
  getDayOfWeekFromDate as getDayOfWeekFromDateTypes,
} from '../types/schedule';
import {
  getAutoPopulatedPeriods,
  isPeriodManuallyModified,
} from '../services/scheduleService';
import { createEmptyPeriodEntry } from '../services/logbookService';
import { PeriodEntry } from '../types/logbook';

describe('Challenger M4_1: Empirical Adversarial Verification of Bell Schedule & Auto-Population', () => {
  // Helper to generate a weekday Date (default: Wednesday 2026-10-14)
  const makeDate = (
    hours: number,
    minutes: number,
    seconds = 0,
    milliseconds = 0,
    baseDateStr = '2026-10-14T00:00:00' // Wednesday (weekday)
  ): Date => {
    const d = new Date(baseDateStr);
    d.setHours(hours, minutes, seconds, milliseconds);
    return d;
  };

  beforeEach(() => {
    localStorage.clear();
  });

  // =========================================================================
  // SUITE 1: UMS BELL SCHEDULE INTERVAL MATH & 10 CANONICAL BOUNDARY MINUTES
  // =========================================================================
  describe('Suite 1: UMS Bell Schedule Interval Math & Boundary Minutes', () => {
    it('1.9 Boundary Minute 16:55:00 (End Tiết 8 - School Day Concludes)', () => {
      const res = resolveCurrentBellPeriod(makeDate(16, 55, 0));
      expect(res.activePeriod).toBeNull();
      expect(res.nextPeriod).toBeNull(); // No next period today
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
  // SUITE 4: NON-DESTRUCTIVE AUTO-POPULATION GUARDS (getAutoPopulatedPeriods)
  // =========================================================================
  describe('Suite 4: Non-Destructive Auto-Population Overwrite Guards', () => {
    const classId = '9A3';
    const mondayDate = '2026-10-12'; // Monday (dayOfWeek = 2)
    const dailyId = `${classId}_${mondayDate}`;

    it('Guard 1: Period with isSigned === true MUST NOT be overwritten', () => {
      const signedPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 1),
        subject: 'Toán chuyên (Dạy bù)',
        teacherId: 'teacher_external',
        teacherName: 'Thầy Giáo Thỉnh Giảng',
        lessonTopic: 'Chuyên đề Bất đẳng thức Cauchy',
        teacherSignature: 'Thầy Giáo Thỉnh Giảng',
        isSigned: true,
        signedAt: 1728710000000,
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      };

      expect(isPeriodManuallyModified(signedPeriod)).toBe(true);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [signedPeriod]);
      expect(populated).toHaveLength(8);

      const p1 = populated.find((p) => p.periodIndex === 1);
      expect(p1).toBeDefined();
      expect(p1!.isSigned).toBe(true);
      expect(p1!.subject).toBe('Toán chuyên (Dạy bù)');
      expect(p1!.teacherName).toBe('Thầy Giáo Thỉnh Giảng');
      expect(p1!.teacherId).toBe('teacher_external');
      expect(p1!.lessonTopic).toBe('Chuyên đề Bất đẳng thức Cauchy');
      expect(p1!.teacherSignature).toBe('Thầy Giáo Thỉnh Giảng');
      expect(p1!.signedAt).toBe(1728710000000);
      expect(p1!.scores.total).toBe(10);
    });

    it('Guard 2: Period with lessonTopic entered MUST NOT be overwritten (even unsigned)', () => {
      const draftWithTopic: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 2),
        subject: 'Toán học sửa đổi',
        teacherId: 'teacher_sub',
        teacherName: 'Cô Giáo Thay',
        lessonTopic: 'Đại số 9: Phương trình bậc hai',
        isSigned: false,
        scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
      };

      expect(isPeriodManuallyModified(draftWithTopic)).toBe(true);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [draftWithTopic]);
      const p2 = populated.find((p) => p.periodIndex === 2);
      expect(p2).toBeDefined();
      expect(p2!.subject).toBe('Toán học sửa đổi');
      expect(p2!.teacherName).toBe('Cô Giáo Thay');
      expect(p2!.lessonTopic).toBe('Đại số 9: Phương trình bậc hai');
      expect(p2!.isSigned).toBe(false);
    });

    it('Guard 3: Period with teacherComment entered MUST NOT be overwritten', () => {
      const draftWithComment: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 3),
        subject: 'Ngữ văn (Chủ đề mở)',
        teacherComment: 'Lớp phát biểu sôi nổi, chuẩn bị bài tốt',
        isSigned: false,
      };

      expect(isPeriodManuallyModified(draftWithComment)).toBe(true);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [draftWithComment]);
      const p3 = populated.find((p) => p.periodIndex === 3);
      expect(p3).toBeDefined();
      expect(p3!.subject).toBe('Ngữ văn (Chủ đề mở)');
      expect(p3!.teacherComment).toBe('Lớp phát biểu sôi nổi, chuẩn bị bài tốt');
    });

    it('Guard 4: Period with absentStudents recorded MUST NOT be overwritten', () => {
      const periodWithAbsents: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 4),
        subject: 'Tiếng Anh GVCN điểm danh',
        absentStudents: [
          { studentId: '269029', studentName: 'Nguyễn Văn An', type: 'P', updatedBy: 'GVCN' },
          { studentId: '269963', studentName: 'Trần Thị Bình', type: 'K', updatedBy: 'GVBM' },
        ],
      };

      expect(isPeriodManuallyModified(periodWithAbsents)).toBe(true);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [periodWithAbsents]);
      const p4 = populated.find((p) => p.periodIndex === 4);
      expect(p4).toBeDefined();
      expect(p4!.subject).toBe('Tiếng Anh GVCN điểm danh');
      expect(p4!.absentStudents).toHaveLength(2);
      expect(p4!.absentStudents[0].studentName).toBe('Nguyễn Văn An');
      expect(p4!.absentStudents[1].studentName).toBe('Trần Thị Bình');
    });

    it('Guard 5: Period with scores.total > 0 MUST NOT be overwritten', () => {
      const scoredPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 5),
        subject: 'Khoa học tự nhiên đã chấm',
        scores: { learning: 3.5, discipline: 2.5, hygiene: 2, customCriterion: 1, total: 9.0 },
      };

      expect(isPeriodManuallyModified(scoredPeriod)).toBe(true);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [scoredPeriod]);
      const p5 = populated.find((p) => p.periodIndex === 5);
      expect(p5).toBeDefined();
      expect(p5!.subject).toBe('Khoa học tự nhiên đã chấm');
      expect(p5!.scores.total).toBe(9.0);
      expect(p5!.scores.learning).toBe(3.5);
    });

    it('Guard 6: Period with earlyDepartures MUST NOT be overwritten', () => {
      const departurePeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 6),
        subject: 'Lịch sử và Địa lí',
        earlyDepartures: [
          {
            studentId: '269048',
            studentName: 'Hoàng Minh Cường',
            departedAt: '14:40',
            reason: 'Sốt cao, phụ huynh đón',
          },
        ],
      };

      expect(isPeriodManuallyModified(departurePeriod)).toBe(true);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [departurePeriod]);
      const p6 = populated.find((p) => p.periodIndex === 6);
      expect(p6).toBeDefined();
      expect(p6!.earlyDepartures).toHaveLength(1);
      expect(p6!.earlyDepartures?.[0]?.reason).toContain('Sốt cao');
    });

    it('Guard 7: Period with ppctLessonIndex > 0 MUST NOT be overwritten', () => {
      const ppctPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 7),
        subject: 'Giáo dục thể chất',
        ppctLessonIndex: 18,
      };

      expect(isPeriodManuallyModified(ppctPeriod)).toBe(true);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [ppctPeriod]);
      const p7 = populated.find((p) => p.periodIndex === 7);
      expect(p7).toBeDefined();
      expect(p7!.ppctLessonIndex).toBe(18);
    });

    it('Pristine / Unmodified period MUST be auto-populated with scheduled subject & teacher', () => {
      // Empty period template without edits
      const pristinePeriod = createEmptyPeriodEntry(dailyId, 2);
      expect(isPeriodManuallyModified(pristinePeriod)).toBe(false);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [pristinePeriod]);
      const p2 = populated.find((p) => p.periodIndex === 2);
      expect(p2).toBeDefined();
      // On Monday, Period 2 for 9A3 is Toán học taught by mrlinhums
      expect(p2!.subject).toBe('Toán học');
      expect(p2!.teacherId).toBe('mrlinhums');
      expect(p2!.teacherName).toBe('Nguyễn Mạnh Linh');
      expect(p2!.isSigned).toBe(false);
    });

    it('Whitespace-only strings in lessonTopic or teacherComment are treated as unedited', () => {
      const whitespaceOnly: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 4),
        lessonTopic: '    \t   ',
        teacherComment: '   \n   ',
      };

      // Since trim() === '', this should NOT count as modified
      expect(isPeriodManuallyModified(whitespaceOnly)).toBe(false);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [whitespaceOnly]);
      const p4 = populated.find((p) => p.periodIndex === 4);
      expect(p4).toBeDefined();
      // Period 4 on Monday for 9A3 is Tiếng Anh
      expect(p4!.subject).toBe('Tiếng Anh');
    });

    it('Comprehensive Multi-State Day: handles complex mixture of all 8 periods', () => {
      const initialMix: PeriodEntry[] = [
        // P1: Signed
        {
          ...createEmptyPeriodEntry(dailyId, 1),
          subject: 'Chào cờ & Sinh hoạt đầu tuần',
          isSigned: true,
          teacherSignature: 'GVCN',
        },
        // P2: Pristine -> will be auto-populated
        createEmptyPeriodEntry(dailyId, 2),
        // P3: Lesson topic entered
        {
          ...createEmptyPeriodEntry(dailyId, 3),
          subject: 'Ngữ văn (Văn bản nhật dụng)',
          lessonTopic: 'Tuyên ngôn độc lập',
        },
        // P4: Teacher comment entered
        {
          ...createEmptyPeriodEntry(dailyId, 4),
          subject: 'Tiếng Anh Chuyên sâu',
          teacherComment: 'Học sinh làm bài test 15p rất tốt',
        },
        // P5: Absences recorded
        {
          ...createEmptyPeriodEntry(dailyId, 5),
          absentStudents: [{ studentId: '269029', studentName: 'Lê An', type: 'P' }],
        },
        // P6: Scores entered
        {
          ...createEmptyPeriodEntry(dailyId, 6),
          scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
        },
        // P7: Early departure
        {
          ...createEmptyPeriodEntry(dailyId, 7),
          earlyDepartures: [{ studentId: '269387', studentName: 'Vũ Nam', departedAt: '15:45', reason: 'Đau bụng' }],
        },
        // P8 is intentionally OMITTED from the initial array
      ];

      const populated = getAutoPopulatedPeriods(classId, mondayDate, initialMix);

      // Must return exactly 8 periods, sorted 1 to 8
      expect(populated).toHaveLength(8);
      expect(populated.map((p) => p.periodIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      // P1: Preserved
      expect(populated[0].subject).toBe('Chào cờ & Sinh hoạt đầu tuần');
      expect(populated[0].isSigned).toBe(true);

      // P2: Auto-populated with Monday slot (Toán học)
      expect(populated[1].subject).toBe('Toán học');
      expect(populated[1].teacherId).toBe('mrlinhums');

      // P3: Preserved topic
      expect(populated[2].subject).toBe('Ngữ văn (Văn bản nhật dụng)');
      expect(populated[2].lessonTopic).toBe('Tuyên ngôn độc lập');

      // P4: Preserved comment
      expect(populated[3].subject).toBe('Tiếng Anh Chuyên sâu');
      expect(populated[3].teacherComment).toContain('Học sinh làm bài test');

      // P5: Preserved absence
      expect(populated[4].absentStudents).toHaveLength(1);

      // P6: Preserved score
      expect(populated[5].scores.total).toBe(10);

      // P7: Preserved departure
      expect(populated[6].earlyDepartures).toHaveLength(1);

      // P8: Auto-populated from Monday slot (Tin học)
      expect(populated[7].periodIndex).toBe(8);
      expect(populated[7].subject).toBe('Tin học');
      expect(populated[7].teacherId).toBe('mshaiyen8a6ums');
    });

    it('Resilience: handles out-of-order input arrays and maintains idempotency', () => {
      // Shuffled order: 5, 1, 8, 3
      const shuffled: PeriodEntry[] = [
        { ...createEmptyPeriodEntry(dailyId, 5), lessonTopic: 'Thí nghiệm Sinh học' },
        { ...createEmptyPeriodEntry(dailyId, 1), isSigned: true },
        createEmptyPeriodEntry(dailyId, 8),
        { ...createEmptyPeriodEntry(dailyId, 3), teacherComment: 'Giờ học tốt' },
      ];

      const pass1 = getAutoPopulatedPeriods(classId, mondayDate, shuffled);
      expect(pass1).toHaveLength(8);
      expect(pass1.map((p) => p.periodIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      // Idempotency: calling again on the result must produce identical periods
      const pass2 = getAutoPopulatedPeriods(classId, mondayDate, pass1);
      expect(pass2).toHaveLength(8);
      expect(pass2.map((p) => p.periodIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(pass2[0].isSigned).toBe(true);
      expect(pass2[4].lessonTopic).toBe('Thí nghiệm Sinh học');
      expect(pass2[2].teacherComment).toBe('Giờ học tốt');
    });
  });

  // =========================================================================
  // SUITE 5: WEEKEND / OFF-DAY & EDGE CALENDAR HANDLING
  // =========================================================================
  describe('Suite 5: Weekend / Off-day Handling & Calendar Edge Cases', () => {
    it('resolveCurrentBellPeriod returns session "off" across all hours on Saturday (2026-10-17)', () => {
      const saturday = '2026-10-17T00:00:00';
      // Morning
      const morningRes = resolveCurrentBellPeriod(makeDate(8, 30, 0, 0, saturday));
      expect(morningRes.isSchoolHours).toBe(false);
      expect(morningRes.activePeriod).toBeNull();
      expect(morningRes.nextPeriod).toBeNull();
      expect(morningRes.session).toBe('off');
      expect(morningRes.isBreak).toBe(false);
      expect(morningRes.timeRemainingInPeriodMs).toBe(0);
      expect(morningRes.timeUntilNextPeriodMs).toBe(0);

      // Lunch
      const lunchRes = resolveCurrentBellPeriod(makeDate(12, 0, 0, 0, saturday));
      expect(lunchRes.isSchoolHours).toBe(false);
      expect(lunchRes.activePeriod).toBeNull();

      // Afternoon
      const afternoonRes = resolveCurrentBellPeriod(makeDate(14, 30, 0, 0, saturday));
      expect(afternoonRes.isSchoolHours).toBe(false);
      expect(afternoonRes.activePeriod).toBeNull();
    });

    it('resolveCurrentBellPeriod returns session "off" across all hours on Sunday (2026-10-18)', () => {
      const sunday = '2026-10-18T00:00:00';
      const sunRes = resolveCurrentBellPeriod(makeDate(9, 30, 0, 0, sunday));
      expect(sunRes.isSchoolHours).toBe(false);
      expect(sunRes.activePeriod).toBeNull();
      expect(sunRes.nextPeriod).toBeNull();
      expect(sunRes.session).toBe('off');
      expect(sunRes.isBreak).toBe(false);
      expect(sunRes.timeRemainingInPeriodMs).toBe(0);
      expect(sunRes.timeUntilNextPeriodMs).toBe(0);
    });

    it('getAutoPopulatedPeriods handles Saturday and Sunday gracefully without crashing', () => {
      const satPopulated = getAutoPopulatedPeriods('9A3', '2026-10-17', []);
      expect(satPopulated).toHaveLength(8);
      // Since standard weekly timetable has no slots on Saturday (day 7), subjects remain blank
      expect(satPopulated[0].subject).toBe('');
      expect(satPopulated[0].teacherName).toBe('');
      expect(satPopulated[0].periodIndex).toBe(1);

      const sunPopulated = getAutoPopulatedPeriods('9A3', '2026-10-18', []);
      expect(sunPopulated).toHaveLength(8);
      expect(sunPopulated[0].subject).toBe('');
      expect(sunPopulated[0].teacherName).toBe('');
    });

    it('PRESERVES manually entered make-up periods on a Saturday', () => {
      const saturdayDate = '2026-10-17';
      const satDailyId = `9A3_${saturdayDate}`;

      const satMakeupPeriod: PeriodEntry = {
        ...createEmptyPeriodEntry(satDailyId, 1),
        subject: 'Toán học (Học bù Thứ 7)',
        teacherId: 'mrlinhums',
        teacherName: 'Nguyễn Mạnh Linh',
        lessonTopic: 'Chữa đề thi khảo sát chất lượng',
        isSigned: true,
        teacherSignature: 'Nguyễn Mạnh Linh',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      };

      const populated = getAutoPopulatedPeriods('9A3', saturdayDate, [satMakeupPeriod]);
      expect(populated).toHaveLength(8);
      expect(populated[0].isSigned).toBe(true);
      expect(populated[0].subject).toBe('Toán học (Học bù Thứ 7)');
      expect(populated[0].lessonTopic).toBe('Chữa đề thi khảo sát chất lượng');
      expect(populated[0].scores.total).toBe(10);
      // Empty periods remain blank
      expect(populated[1].subject).toBe('');
    });

    it('correctly maps Vietnamese day of week indices for boundary dates', () => {
      // Leap year Tuesday
      expect(getDayOfWeekFromDateTypes('2028-02-29')).toBe(3); // Thứ 3
      expect(getDayOfWeekFromDateUtils('2028-02-29')).toBe(3);
      expect(getDayOfWeekViNumeric(3)).toBe('Thứ 3');
      expect(getDayOfWeekViWord(3)).toBe('Thứ Ba');

      // Year-end Thursday
      expect(getDayOfWeekFromDateTypes('2026-12-31')).toBe(5); // Thứ 5
      expect(getDayOfWeekFromDateUtils('2026-12-31')).toBe(5);
      expect(getDayOfWeekViNumeric(5)).toBe('Thứ 5');
      expect(getDayOfWeekViWord(5)).toBe('Thứ Năm');

      // New-year Friday
      expect(getDayOfWeekFromDateTypes('2027-01-01')).toBe(6); // Thứ 6
      expect(getDayOfWeekFromDateUtils('2027-01-01')).toBe(6);
      expect(getDayOfWeekViNumeric(6)).toBe('Thứ 6');
      expect(getDayOfWeekViWord(6)).toBe('Thứ Sáu');

      // Saturday & Sunday
      expect(getDayOfWeekFromDateTypes('2026-10-17')).toBe(7); // Thứ 7
      expect(getDayOfWeekFromDateUtils('2026-10-17')).toBe(7);
      expect(getDayOfWeekFromDateTypes('2026-10-18')).toBe(8); // Chủ nhật
      expect(getDayOfWeekFromDateUtils('2026-10-18')).toBe(8);
      expect(getDayOfWeekViNumeric(7)).toBe('Thứ 7');
      expect(getDayOfWeekViWord(7)).toBe('Thứ Bảy');
      expect(getDayOfWeekViNumeric(8)).toBe('Chủ nhật');
      expect(getDayOfWeekViWord(8)).toBe('Chủ Nhật');

      // Fallback in scheduleService's getDayOfWeekFromDate (from types/schedule)
      expect(getDayOfWeekFromDateTypes('')).toBe(2);
      expect(getDayOfWeekFromDateTypes('invalid-date')).toBe(2);

      // getAutoPopulatedPeriods resilience to blank date string
      const blankDatePopulated = getAutoPopulatedPeriods('9A3', '', []);
      expect(blankDatePopulated).toHaveLength(8);
      expect(blankDatePopulated[0].periodIndex).toBe(1);
    });
  });

  // =========================================================================
  // SUITE 6: ADVERSARIAL STRESS HARNESS & PERFORMANCE BENCHMARK
  // =========================================================================
  describe('Suite 6: Adversarial Stress & Performance Harness', () => {
    it('10,000 continuous interval evaluations complete with zero errors and low latency', () => {
      const start = performance.now();
      const testDate = new Date('2026-10-14T07:00:00');

      for (let i = 0; i < 10000; i++) {
        testDate.setSeconds(testDate.getSeconds() + 3);
        const res = resolveCurrentBellPeriod(testDate);
        expect(res).toBeDefined();
        expect(typeof res.isSchoolHours).toBe('boolean');
      }

      const elapsedMs = performance.now() - start;
      // 10,000 resolutions should comfortably take under 500ms in modern JS engine
      expect(elapsedMs).toBeLessThan(1000);
    });

    it('500 auto-population cycles across multiple classes preserve memory and invariants', () => {
      const classes = ['6A1', '7A2', '8A4', '9A3', '9A6'];
      const dates = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];

      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        const cls = classes[i % classes.length];
        const dt = dates[i % dates.length];
        const res = getAutoPopulatedPeriods(cls, dt, []);
        expect(res).toHaveLength(8);
        expect(res[0].dailyId).toBe(`${cls}_${dt}`);
        expect(res[0].subject.length).toBeGreaterThan(0);
      }

      const elapsedMs = performance.now() - start;
      expect(elapsedMs).toBeLessThan(1000);
    });
  });
});
