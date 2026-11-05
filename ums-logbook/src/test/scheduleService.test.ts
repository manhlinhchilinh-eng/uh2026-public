/**
 * Unit Tests: Schedule Architecture, 40-Slot TKB & Auto-Population Engine
 * File: src/test/scheduleService.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDayOfWeekVi,
  getDayOfWeekFromDate,
  TOTAL_WEEKLY_SLOTS,
  ScheduleSlot,
} from '../types/schedule';
import {
  generateDefaultClassSchedule,
  getClassSchedule,
  saveClassSchedule,
  getAllSchedules,
  getTeacherSchedule,
  getAutoPopulatedPeriods,
  isPeriodManuallyModified,
} from '../services/scheduleService';
import { createEmptyPeriodEntry } from '../services/logbookService';
import { PeriodEntry } from '../types/logbook';

describe('Milestone 4 - Schedule Architecture, 40-Slot TKB & Auto-Population', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Day of Week Resolution & Vietnamese Localization Helpers', () => {
    it('correctly maps date strings to Vietnamese DayOfWeek indices', () => {
      // 2026-10-12 is Monday (Thứ 2)
      expect(getDayOfWeekFromDate('2026-10-12')).toBe(2);
      // 2026-10-13 is Tuesday (Thứ 3)
      expect(getDayOfWeekFromDate('2026-10-13')).toBe(3);
      // 2026-10-14 is Wednesday (Thứ 4)
      expect(getDayOfWeekFromDate('2026-10-14')).toBe(4);
      // 2026-10-15 is Thursday (Thứ 5)
      expect(getDayOfWeekFromDate('2026-10-15')).toBe(5);
      // 2026-10-16 is Friday (Thứ 6)
      expect(getDayOfWeekFromDate('2026-10-16')).toBe(6);
      // 2026-10-17 is Saturday (Thứ 7)
      expect(getDayOfWeekFromDate('2026-10-17')).toBe(7);
      // 2026-10-18 is Sunday (Chủ nhật)
      expect(getDayOfWeekFromDate('2026-10-18')).toBe(8);
    });

    it('robustly handles ISO timestamps without UTC day shifts', () => {
      expect(getDayOfWeekFromDate('2026-10-15T00:00:00.000Z')).toBe(5);
      expect(getDayOfWeekFromDate('2026-10-16T23:59:59.000Z')).toBe(6);
    });

    it('translates day indices to standard Vietnamese strings', () => {
      expect(getDayOfWeekVi(2)).toBe('Thứ 2');
      expect(getDayOfWeekVi(3)).toBe('Thứ 3');
      expect(getDayOfWeekVi(4)).toBe('Thứ 4');
      expect(getDayOfWeekVi(5)).toBe('Thứ 5');
      expect(getDayOfWeekVi(6)).toBe('Thứ 6');
      expect(getDayOfWeekVi(7)).toBe('Thứ 7');
      expect(getDayOfWeekVi(8)).toBe('Chủ nhật');
      expect(getDayOfWeekVi(0)).toBe('Chủ nhật');
      expect(getDayOfWeekVi(1)).toBe('Chủ nhật');
    });
  });

  describe('2. 40-Slot Timetable Generation & Faculty Integrity', () => {
    it('generates exactly 40 slots for 5 school days x 8 periods per day', () => {
      const schedule = generateDefaultClassSchedule('9A3');
      expect(schedule.classId).toBe('9A3');
      expect(schedule.slots).toHaveLength(TOTAL_WEEKLY_SLOTS);

      // Verify slot counts per day
      for (let day = 2; day <= 6; day++) {
        const slotsForDay = schedule.slots.filter((s) => s.dayOfWeek === day);
        expect(slotsForDay).toHaveLength(8);

        const periods = slotsForDay.map((s) => s.periodIndex).sort();
        expect(periods).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      }
    });

    it('assigns correct teachers and subjects for class 9A3', () => {
      const schedule = generateDefaultClassSchedule('9A3');

      // GVCN Nguyễn Mạnh Linh (mrlinhums) teaches Toán & HĐTN-HN
      const linhSlots = schedule.slots.filter((s) => s.teacherUsername === 'mrlinhums');
      expect(linhSlots.length).toBeGreaterThan(0);
      expect(linhSlots.every((s) => s.subject === 'Toán học' || s.subject === 'Hoạt động trải nghiệm')).toBe(true);

      // TPT Hoàng Long teaches GDTC
      const gdtcSlots = schedule.slots.filter((s) => s.subject === 'Giáo dục thể chất');
      expect(gdtcSlots.length).toBe(3);
      expect(gdtcSlots.every((s) => s.teacherUsername === 'mrhoanglongums')).toBe(true);
      expect(gdtcSlots.every((s) => s.room === 'Sân thể thao')).toBe(true);

      // Informatics in lab
      const tinSlots = schedule.slots.filter((s) => s.subject === 'Tin học');
      expect(tinSlots.length).toBe(2);
      expect(tinSlots.every((s) => s.room === 'Phòng Tin học')).toBe(true);
    });

    it('assigns correct teachers and subjects for class 6A1', () => {
      const schedule = generateDefaultClassSchedule('6A1');
      expect(schedule.classId).toBe('6A1');

      // GVCN Đinh Hoài Long (msphuonganhums) teaches Tiếng Anh & HĐTN-HN
      const paSlots = schedule.slots.filter((s) => s.teacherUsername === 'msphuonganhums');
      expect(paSlots.length).toBeGreaterThan(0);
      expect(paSlots.every((s) => s.subject.includes('Tiếng Anh') || s.subject === 'Hoạt động trải nghiệm')).toBe(true);
    });
  });

  describe('3. Persistence & Timetable Modification', () => {
    it('saves and retrieves class schedule with updated attributes', async () => {
      const initial = await getClassSchedule('7A1');
      expect(initial.classId).toBe('7A1');
      expect(initial.slots).toHaveLength(40);

      // Modify a slot
      const updatedSlots: ScheduleSlot[] = initial.slots.map((s) => {
        if (s.dayOfWeek === 2 && s.periodIndex === 2) {
          return { ...s, subject: 'Toán học nâng cao', teacherName: 'Thầy Linh Khách Mời' };
        }
        return s;
      });

      await saveClassSchedule({
        ...initial,
        slots: updatedSlots,
        updatedBy: 'mrlinhums',
      });

      const retrieved = await getClassSchedule('7A1');
      const targetSlot = retrieved.slots.find((s) => s.dayOfWeek === 2 && s.periodIndex === 2);
      expect(targetSlot?.subject).toBe('Toán học nâng cao');
      expect(targetSlot?.teacherName).toBe('Thầy Linh Khách Mời');
    });

    it('rejects saving a schedule without classId', async () => {
      await expect(
        saveClassSchedule({
          classId: '',
          slots: [],
          academicYear: '2026-2027',
          semester: 1,
          updatedAt: Date.now(),
        })
      ).rejects.toThrow();
    });
  });

  describe('4. Teacher Schedule Cross-Class Aggregation', () => {
    it('aggregates all teaching slots for a teacher across classes', async () => {
      const tptSchedule = await getTeacherSchedule('mrhoanglongums');
      expect(tptSchedule.length).toBeGreaterThan(0);
      // TPT slots should have valid classIds
      expect(tptSchedule.every((s) => typeof s.classId === 'string' && s.classId.length > 0)).toBe(true);
      // Slots must be sorted by dayOfWeek then periodIndex
      for (let i = 0; i < tptSchedule.length - 1; i++) {
        const cur = tptSchedule[i];
        const next = tptSchedule[i + 1];
        if (cur.dayOfWeek === next.dayOfWeek) {
          expect(cur.periodIndex).toBeLessThanOrEqual(next.periodIndex);
        } else {
          expect(cur.dayOfWeek).toBeLessThan(next.dayOfWeek);
        }
      }
    });

    it('returns empty array for non-existent teacher username', async () => {
      const slots = await getTeacherSchedule('non_existent_teacher');
      expect(slots).toEqual([]);
    });

    it('retrieves all 26 class schedules', async () => {
      const all = await getAllSchedules();
      expect(Object.keys(all).length).toBeGreaterThanOrEqual(26);
      expect(all['9A3']).toBeDefined();
      expect(all['6A1']).toBeDefined();
    });
  });

  describe('5. Smart Auto-Population & Non-Destructive Protection', () => {
    const classId = '9A3';
    const mondayDate = '2026-10-12'; // Monday (dayOfWeek = 2)

    it('populates empty periods from class timetable on a fresh day', () => {
      const populated = getAutoPopulatedPeriods(classId, mondayDate, []);
      expect(populated).toHaveLength(8);

      // Period 1 on Monday is HĐTN-HN
      expect(populated[0].periodIndex).toBe(1);
      expect(populated[0].subject).toBe('Hoạt động trải nghiệm');
      expect(populated[0].teacherId).toBe('mrlinhums');
      expect(populated[0].teacherName).toBe('Nguyễn Mạnh Linh');
      expect(populated[0].isSigned).toBe(false);

      // Period 2 on Monday is Toán học
      expect(populated[1].periodIndex).toBe(2);
      expect(populated[1].subject).toBe('Toán học');
      expect(populated[1].teacherId).toBe('mrlinhums');
    });

    it('PRESERVES signed period without overwriting subject, signature, or scores', () => {
      const dailyId = `${classId}_${mondayDate}`;
      const signedPeriod1: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 1),
        subject: 'Toán học (Dạy bù)',
        teacherId: 'teacher_substitute',
        teacherName: 'Giáo Viên Dạy Bù',
        lessonTopic: 'Chương 1: Ôn tập Đại số',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
        teacherSignature: 'Giáo Viên Dạy Bù',
        isSigned: true,
        signedAt: 123456789,
      };

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [signedPeriod1]);
      expect(populated[0].isSigned).toBe(true);
      expect(populated[0].subject).toBe('Toán học (Dạy bù)');
      expect(populated[0].teacherName).toBe('Giáo Viên Dạy Bù');
      expect(populated[0].lessonTopic).toBe('Chương 1: Ôn tập Đại số');
      expect(populated[0].scores.total).toBe(10);

      // Period 2 should still be auto-populated
      expect(populated[1].periodIndex).toBe(2);
      expect(populated[1].subject).toBe('Toán học');
    });

    it('PRESERVES manually edited period even if unsigned (lessonTopic entered)', () => {
      const dailyId = `${classId}_${mondayDate}`;
      const draftPeriod2: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 2),
        subject: 'Hình học 9',
        teacherId: 'mrlinhums',
        teacherName: 'Nguyễn Mạnh Linh',
        lessonTopic: 'Đường tròn và tiếp tuyến',
        isSigned: false,
      };

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [draftPeriod2]);
      expect(populated[1].lessonTopic).toBe('Đường tròn và tiếp tuyến');
      expect(populated[1].subject).toBe('Hình học 9');
    });

    it('PRESERVES period with student absences entered', () => {
      const dailyId = `${classId}_${mondayDate}`;
      const periodWithAbsence: PeriodEntry = {
        ...createEmptyPeriodEntry(dailyId, 3),
        absentStudents: [{ studentId: '269398', studentName: 'Lý Bảo Duy', type: 'P' }],
      };

      expect(isPeriodManuallyModified(periodWithAbsence)).toBe(true);

      const populated = getAutoPopulatedPeriods(classId, mondayDate, [periodWithAbsence]);
      expect(populated[2].absentStudents).toHaveLength(1);
      expect(populated[2].absentStudents[0].studentName).toBe('Lý Bảo Duy');
    });

    it('gracefully returns blank periods for weekend dates', () => {
      const sundayDate = '2026-10-18'; // Sunday (dayOfWeek = 8)
      const populated = getAutoPopulatedPeriods(classId, sundayDate, []);
      expect(populated).toHaveLength(8);
      // No slots configured for Sunday -> subjects remain blank
      expect(populated[0].subject).toBe('');
      expect(populated[0].teacherName).toBe('');
    });
  });
});
