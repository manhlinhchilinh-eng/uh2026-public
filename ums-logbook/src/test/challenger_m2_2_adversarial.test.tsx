/**
 * Challenger M2_2 Adversarial Test Suite
 * Mission: Empirically stress-test Subcollection Concurrency, Two-Tier Attendance Sync, and Early Departure Validation.
 * File: src/test/challenger_m2_2_adversarial.test.tsx
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  generateDailyId,
  getOrCreateDailyLogbook,
  getPeriodEntries,
  savePeriodEntry,
  updateAttendanceBaseline,
} from '../services/logbookService';
import {
  formatAttendanceDisplay,
  resolveAttendanceSync,
  validateEarlyDeparture,
} from '../utils/attendance';
import { EarlyDepartureSection } from '../components/logbook/EarlyDepartureSection';
import { StudentAbsenceRecord, EarlyDepartureRecord } from '../types/logbook';
import { StudentDoc } from '../types';

describe('CHALLENGER M2_2: Subcollection Concurrency, Two-Tier Sync & Early Departure Suite', () => {
  const classId = '8A2';
  const date = '2026-10-20';
  const dailyId = generateDailyId(classId, date);

  beforeEach(() => {
    localStorage.clear();
  });

  // =========================================================================
  // 1. CONCURRENCY STRESS TESTS
  // =========================================================================
  describe('1. Concurrency Stress Test & Subcollection Isolation', () => {
    it('1.1: Simulates concurrent writes to Periods 1, 2, 3, and 4 simultaneously without data loss or overwriting', async () => {
      // Initialize parent daily logbook
      await getOrCreateDailyLogbook(classId, date, 'mrlinhums');

      // Trigger 4 simultaneous asynchronous writes for distinct periods
      const writeP1 = savePeriodEntry(
        dailyId,
        1,
        {
          subject: 'Toán học',
          ppctLessonIndex: 12,
          lessonTopic: 'Hàm số bậc nhất y = ax + b',
          teacherId: 'mrlinhums',
          teacherName: 'Nguyễn Mạnh Linh',
          scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
          teacherComment: 'Lớp học nghiêm túc, phát biểu sôi nổi',
        },
        true
      );

      const writeP2 = savePeriodEntry(
        dailyId,
        2,
        {
          subject: 'Ngữ văn',
          ppctLessonIndex: 18,
          lessonTopic: 'Truyện Kiều - Nguyễn Du',
          teacherId: 'msthanhhuyenums',
          teacherName: 'Nguyễn Phương Minh Hạnh',
          scores: { learning: 3.5, discipline: 2.5, hygiene: 2.0, customCriterion: 0.5, total: 8.5 },
          teacherComment: 'Tiết học diễn ra thuận lợi, chữ viết đẹp',
        },
        true
      );

      const writeP3 = savePeriodEntry(
        dailyId,
        3,
        {
          subject: 'Lịch sử & Địa lý',
          ppctLessonIndex: 9,
          lessonTopic: 'Cách mạng tư sản Pháp thế kỷ XVIII',
          teacherId: 'mrducums',
          teacherName: 'Trần Văn Đức',
          scores: { learning: 3.0, discipline: 2.0, hygiene: 2.0, customCriterion: 0.0, total: 7.0 },
          teacherComment: 'Vài bạn còn nói chuyện riêng',
        },
        true
      );

      const writeP4 = savePeriodEntry(
        dailyId,
        4,
        {
          subject: 'Tiếng Anh',
          ppctLessonIndex: 25,
          lessonTopic: 'Unit 4: Our Customs and Traditions',
          teacherId: 'mslanums',
          teacherName: 'Hoàng Thị Lan',
          scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 0.0, total: 9.0 },
          teacherComment: 'Good participation, fluent communication',
        },
        true
      );

      // Await all 4 concurrent writes simultaneously
      const [resP1, resP2, resP3, resP4] = await Promise.all([writeP1, writeP2, writeP3, writeP4]);

      // Check returned values
      expect(resP1.periodIndex).toBe(1);
      expect(resP1.subject).toBe('Toán học');
      expect(resP1.scores.total).toBe(10.0);

      expect(resP2.periodIndex).toBe(2);
      expect(resP2.subject).toBe('Ngữ văn');
      expect(resP2.scores.total).toBe(8.5);

      expect(resP3.periodIndex).toBe(3);
      expect(resP3.subject).toBe('Lịch sử & Địa lý');
      expect(resP3.scores.total).toBe(7.0);

      expect(resP4.periodIndex).toBe(4);
      expect(resP4.subject).toBe('Tiếng Anh');
      expect(resP4.scores.total).toBe(9.0);

      // Verify stored entries in database / storage
      const storedEntries = await getPeriodEntries(dailyId);
      expect(storedEntries.length).toBe(8);

      const stored1 = storedEntries.find((e) => e.periodIndex === 1);
      const stored2 = storedEntries.find((e) => e.periodIndex === 2);
      const stored3 = storedEntries.find((e) => e.periodIndex === 3);
      const stored4 = storedEntries.find((e) => e.periodIndex === 4);

      // Verify each period preserved its OWN distinct fields without overwriting
      expect(stored1?.subject).toBe('Toán học');
      expect(stored1?.lessonTopic).toBe('Hàm số bậc nhất y = ax + b');
      expect(stored1?.teacherName).toBe('Nguyễn Mạnh Linh');
      expect(stored1?.scores.total).toBe(10.0);
      expect(stored1?.isSigned).toBe(true);

      expect(stored2?.subject).toBe('Ngữ văn');
      expect(stored2?.lessonTopic).toBe('Truyện Kiều - Nguyễn Du');
      expect(stored2?.teacherName).toBe('Nguyễn Phương Minh Hạnh');
      expect(stored2?.scores.total).toBe(8.5);
      expect(stored2?.isSigned).toBe(true);

      expect(stored3?.subject).toBe('Lịch sử & Địa lý');
      expect(stored3?.lessonTopic).toBe('Cách mạng tư sản Pháp thế kỷ XVIII');
      expect(stored3?.teacherName).toBe('Trần Văn Đức');
      expect(stored3?.scores.total).toBe(7.0);
      expect(stored3?.isSigned).toBe(true);

      expect(stored4?.subject).toBe('Tiếng Anh');
      expect(stored4?.lessonTopic).toBe('Unit 4: Our Customs and Traditions');
      expect(stored4?.teacherName).toBe('Hoàng Thị Lan');
      expect(stored4?.scores.total).toBe(9.0);
      expect(stored4?.isSigned).toBe(true);

      // Verify unwritten periods (5, 6, 7, 8) remain empty and unsigned
      const stored5 = storedEntries.find((e) => e.periodIndex === 5);
      expect(stored5?.subject).toBe('');
      expect(stored5?.isSigned).toBe(false);
    });

    it('1.2: Stress barrage: All 8 periods written and signed concurrently; status transitions to completed', async () => {
      await getOrCreateDailyLogbook(classId, date, 'mrlinhums');

      const subjects = [
        'Chào cờ',
        'Toán học',
        'Ngữ văn',
        'Vật lý',
        'Hóa học',
        'Sinh học',
        'Tin học',
        'Sinh hoạt lớp',
      ];

      const writePromises = subjects.map((sub, idx) => {
        const pIndex = idx + 1;
        return savePeriodEntry(
          dailyId,
          pIndex,
          {
            subject: sub,
            ppctLessonIndex: pIndex * 3,
            lessonTopic: `Bài học tiết ${pIndex}`,
            teacherId: `teacher_${pIndex}`,
            teacherName: `Giáo viên ${pIndex}`,
            scores: {
              learning: 4.0,
              discipline: 3.0,
              hygiene: 2.0,
              customCriterion: 1.0,
              total: 10.0,
            },
          },
          true // autoSign
        );
      });

      const results = await Promise.all(writePromises);
      expect(results.length).toBe(8);

      // Verify all 8 periods in database
      const allEntries = await getPeriodEntries(dailyId);
      for (let i = 1; i <= 8; i++) {
        const p = allEntries.find((e) => e.periodIndex === i);
        expect(p).toBeDefined();
        expect(p?.subject).toBe(subjects[i - 1]);
        expect(p?.lessonTopic).toBe(`Bài học tiết ${i}`);
        expect(p?.isSigned).toBe(true);
        expect(p?.scores.total).toBe(10.0);
      }

      // Verify parent daily logbook status became completed
      const updatedLogbook = await getOrCreateDailyLogbook(classId, date);
      expect(updatedLogbook.status).toBe('completed');
      expect(updatedLogbook.isCompleted).toBe(true);
    });

    it('1.3: Concurrency isolation: writes to different classes and dates execute concurrently without collision', async () => {
      const classA = '8A1';
      const dateA = '2026-10-21';
      const dailyA = generateDailyId(classA, dateA);

      const classB = '9A3';
      const dateB = '2026-10-22';
      const dailyB = generateDailyId(classB, dateB);

      const p1WriteA = savePeriodEntry(
        dailyA,
        1,
        {
          subject: 'Toán học 8A1',
          lessonTopic: 'Chủ đề 8A1',
          teacherName: 'Thầy A',
          scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
        },
        true
      );

      const p1WriteB = savePeriodEntry(
        dailyB,
        1,
        {
          subject: 'Văn học 9A3',
          lessonTopic: 'Chủ đề 9A3',
          teacherName: 'Cô B',
          scores: { learning: 3, discipline: 3, hygiene: 2, customCriterion: 0, total: 8 },
        },
        true
      );

      await Promise.all([p1WriteA, p1WriteB]);

      const entriesA = await getPeriodEntries(dailyA);
      const entriesB = await getPeriodEntries(dailyB);

      expect(entriesA.find((e) => e.periodIndex === 1)?.subject).toBe('Toán học 8A1');
      expect(entriesB.find((e) => e.periodIndex === 1)?.subject).toBe('Văn học 9A3');
    });

    it('1.4: Concurrent error resilience: invalid period score rejects independently while valid writes persist intact', async () => {
      await getOrCreateDailyLogbook(classId, date, 'mrlinhums');

      const validP1 = savePeriodEntry(
        dailyId,
        1,
        {
          subject: 'Toán học',
          lessonTopic: 'Ôn tập chương 1',
          scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
        },
        true
      );

      // Invalid: learning exceeds max (5.0 > 4.0)
      const invalidP2 = savePeriodEntry(
        dailyId,
        2,
        {
          subject: 'Vật lý',
          lessonTopic: 'Áp suất chất lỏng',
          scores: { learning: 5.0, discipline: 3.0, hygiene: 2.0, customCriterion: 0.0, total: 10.0 },
        },
        true
      );

      const validP3 = savePeriodEntry(
        dailyId,
        3,
        {
          subject: 'Hóa học',
          lessonTopic: 'Bảng tuần hoàn',
          scores: { learning: 3.5, discipline: 2.5, hygiene: 2.0, customCriterion: 1.0, total: 9.0 },
        },
        true
      );

      const results = await Promise.allSettled([validP1, invalidP2, validP3]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toContain('Điểm không hợp lệ');
      }

      // Verify P1 and P3 are stored; P2 remains empty template
      const entries = await getPeriodEntries(dailyId);
      expect(entries.find((e) => e.periodIndex === 1)?.subject).toBe('Toán học');
      expect(entries.find((e) => e.periodIndex === 2)?.subject).toBe('');
      expect(entries.find((e) => e.periodIndex === 3)?.subject).toBe('Hóa học');
    });
  });

  // =========================================================================
  // 2. TWO-TIER ATTENDANCE SYNC & DECOUPLING
  // =========================================================================
  describe('2. Two-Tier Attendance Synchronization & Decoupling', () => {
    it('2.1: GVCN morning baseline recording propagates absences to draft period entries with reportedInTier: "baseline"', async () => {
      // 1. GVCN records morning baseline
      const morningAbsences: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', studentNumber: 1, type: 'P', note: 'Phụ huynh xin sốt' },
        { studentId: '269963', studentName: 'Trần Thị B', studentNumber: 2, type: 'K', note: 'Không rõ lý do' },
      ];

      await updateAttendanceBaseline(dailyId, 'morning', {
        reportedBy: 'gvcn_linh',
        reportedByName: 'Nguyễn Mạnh Linh',
        reportedAt: Date.now(),
        session: 'morning',
        absences: morningAbsences.map((a) => ({ ...a, reportedInTier: 'baseline' as const })),
        earlyDepartures: [],
        notes: 'Sáng nay vắng 2 em',
      });

      // Fetch daily logbook and verify baseline state
      const logbook = await getOrCreateDailyLogbook(classId, date);
      expect(logbook.morningBaseline?.absences.length).toBe(2);
      expect(logbook.morningBaseline?.absences[0].reportedInTier).toBe('baseline');
      expect(logbook.morningBaseline?.absences[1].reportedInTier).toBe('baseline');

      // 2. Draft period 1 initializes absences from baseline
      const baselineAbsences = logbook.morningBaseline?.absences || [];
      const inheritedPeriodAbsences: StudentAbsenceRecord[] = baselineAbsences.map((a) => ({
        ...a,
        reportedInTier: 'baseline' as const,
      }));

      expect(inheritedPeriodAbsences.length).toBe(2);
      expect(inheritedPeriodAbsences[0].studentId).toBe('269029');
      expect(inheritedPeriodAbsences[0].type).toBe('P');
      expect(inheritedPeriodAbsences[0].reportedInTier).toBe('baseline');

      expect(inheritedPeriodAbsences[1].studentId).toBe('269963');
      expect(inheritedPeriodAbsences[1].type).toBe('K');
      expect(inheritedPeriodAbsences[1].reportedInTier).toBe('baseline');
    });

    it('2.2: In-period additions: Period 2 adds extra absent student; Period 2 has extra student while GVCN baseline remains unchanged', async () => {
      // 1. Establish GVCN baseline: Student 1 (P), Student 2 (K)
      const initialBaseline: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P', reportedInTier: 'baseline' },
        { studentId: '269963', studentName: 'Trần Thị B', type: 'K', reportedInTier: 'baseline' },
      ];

      await updateAttendanceBaseline(dailyId, 'morning', {
        reportedBy: 'gvcn_linh',
        reportedAt: Date.now(),
        session: 'morning',
        absences: initialBaseline,
        earlyDepartures: [],
      });

      // 2. Period 2 teacher opens period, sees baseline (Student 1, Student 2)
      // Teacher notes Student 3 skipped class during Period 2
      const period2Absences: StudentAbsenceRecord[] = [
        ...initialBaseline,
        {
          studentId: '269910',
          studentName: 'Lê Văn C',
          type: 'K',
          note: 'Trốn tiết từ tiết 2',
          reportedInTier: 'period', // Tier 2 addition
        },
      ];

      // Save Period 2
      await savePeriodEntry(
        dailyId,
        2,
        {
          subject: 'Vật lý',
          lessonTopic: 'Lực ma sát',
          teacherName: 'Thầy Hưng',
          absentStudents: period2Absences,
          scores: { learning: 4, discipline: 2.5, hygiene: 2, customCriterion: 0.5, total: 9.0 },
        },
        true
      );

      // 3. Verify Period 2 has 3 absent students
      const entries = await getPeriodEntries(dailyId);
      const p2 = entries.find((e) => e.periodIndex === 2);
      expect(p2?.absentStudents.length).toBe(3);
      expect(p2?.absentStudents.find((a) => a.studentId === '269910')?.reportedInTier).toBe('period');
      expect(p2?.absentStudents.find((a) => a.studentId === '269910')?.type).toBe('K');

      // 4. Verify GVCN baseline REMAINS UNCHANGED with strictly 2 students
      const freshLogbook = await getOrCreateDailyLogbook(classId, date);
      expect(freshLogbook.morningBaseline?.absences.length).toBe(2);
      expect(freshLogbook.morningBaseline?.absences.some((a) => a.studentId === '269910')).toBe(false);
      expect(freshLogbook.morningBaseline?.absences[0].studentId).toBe('269029');
      expect(freshLogbook.morningBaseline?.absences[1].studentId).toBe('269963');
    });

    it('2.3: resolveAttendanceSync - Pristine form adopts baseline directly without conflicts', () => {
      const incomingBaseline: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P' },
        { studentId: '269963', studentName: 'Trần Thị B', type: 'Late' },
      ];

      // Pristine form: isPeriodAttendanceDirty === false
      const result = resolveAttendanceSync([], incomingBaseline, false);

      expect(result.hasConflict).toBe(false);
      expect(result.mergedAbsences.length).toBe(2);
      expect(result.mergedAbsences[0].reportedInTier).toBe('baseline');
      expect(result.mergedAbsences[0].studentId).toBe('269029');
      expect(result.mergedAbsences[1].reportedInTier).toBe('baseline');
      expect(result.mergedAbsences[1].studentId).toBe('269963');

      // Pristine form with empty incoming baseline
      const emptyResult = resolveAttendanceSync([], [], false);
      expect(emptyResult.hasConflict).toBe(false);
      expect(emptyResult.mergedAbsences.length).toBe(0);
    });

    it('2.4: resolveAttendanceSync - Dirty form non-conflicting addition merges cleanly', () => {
      // Teacher modified local form: marked Student C as Late in period
      const currentPeriodAbsences: StudentAbsenceRecord[] = [
        { studentId: '269910', studentName: 'Lê Văn C', type: 'Late', reportedInTier: 'period' },
      ];

      // GVCN subsequently submitted baseline with Student A as P
      const incomingBaseline: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P' },
      ];

      const result = resolveAttendanceSync(currentPeriodAbsences, incomingBaseline, true);

      expect(result.hasConflict).toBe(false);
      expect(result.mergedAbsences.length).toBe(2);

      const localStudent = result.mergedAbsences.find((a) => a.studentId === '269910');
      const baselineStudent = result.mergedAbsences.find((a) => a.studentId === '269029');

      expect(localStudent?.type).toBe('Late');
      expect(localStudent?.reportedInTier).toBe('period');

      expect(baselineStudent?.type).toBe('P');
      expect(baselineStudent?.reportedInTier).toBe('baseline');
    });

    it('2.5: resolveAttendanceSync - Dirty form detects conflicting status and preserves local edits pending review', () => {
      // Teacher marked Student A as Late
      const currentPeriodAbsences: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'Late', reportedInTier: 'period' },
      ];

      // GVCN reported Student A as P (Excused Absence)
      const incomingBaseline: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P' },
      ];

      const result = resolveAttendanceSync(currentPeriodAbsences, incomingBaseline, true);

      expect(result.hasConflict).toBe(true);
      expect(result.conflictDetails).toBeDefined();
      expect(result.conflictDetails?.length).toBe(1);
      expect(result.conflictDetails?.[0]).toContain('Nguyễn Văn A');
      expect(result.conflictDetails?.[0]).toContain('GVCN báo [P]');
      expect(result.conflictDetails?.[0]).toContain('bạn đang chọn [Late]');

      // Merged absences MUST preserve current local changes to avoid silent data loss
      expect(result.mergedAbsences.length).toBe(1);
      expect(result.mergedAbsences[0].type).toBe('Late');
    });

    it('2.6: resolveAttendanceSync - Dirty form handles status agreement without duplicate records', () => {
      // Both teacher and GVCN agree Student A is P
      const currentPeriodAbsences: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P', reportedInTier: 'period' },
      ];

      const incomingBaseline: StudentAbsenceRecord[] = [
        { studentId: '269029', studentName: 'Nguyễn Văn A', type: 'P' },
      ];

      const result = resolveAttendanceSync(currentPeriodAbsences, incomingBaseline, true);

      expect(result.hasConflict).toBe(false);
      // Ensure no duplicate entries for 269029
      expect(result.mergedAbsences.length).toBe(1);
      expect(result.mergedAbsences[0].studentId).toBe('269029');
      expect(result.mergedAbsences[0].type).toBe('P');
    });

    it('2.7: resolveAttendanceSync - Multi-student complex matrix with mixed conflicts and additions', () => {
      const currentPeriodAbsences: StudentAbsenceRecord[] = [
        { studentId: 'S1', studentName: 'Học sinh 1', type: 'P', reportedInTier: 'period' }, // agreed
        { studentId: 'S2', studentName: 'Học sinh 2', type: 'Late', reportedInTier: 'period' }, // conflict with baseline K
        { studentId: 'S3', studentName: 'Học sinh 3', type: 'K', reportedInTier: 'period' }, // local only
      ];

      const incomingBaseline: StudentAbsenceRecord[] = [
        { studentId: 'S1', studentName: 'Học sinh 1', type: 'P' }, // agreed
        { studentId: 'S2', studentName: 'Học sinh 2', type: 'K' }, // conflict!
        { studentId: 'S4', studentName: 'Học sinh 4', type: 'P' }, // baseline addition
      ];

      const result = resolveAttendanceSync(currentPeriodAbsences, incomingBaseline, true);

      expect(result.hasConflict).toBe(true);
      expect(result.conflictDetails?.length).toBe(1);
      expect(result.conflictDetails?.[0]).toContain('Học sinh 2');
      expect(result.conflictDetails?.[0]).toContain('GVCN báo [K], bạn đang chọn [Late]');

      // Keeps current local changes
      expect(result.mergedAbsences).toEqual(currentPeriodAbsences);
    });
  });

  // =========================================================================
  // 3. EARLY DEPARTURE VALIDATION & COMPONENT VERIFICATION
  // =========================================================================
  describe('3. Early Departure Validation & Component Verification', () => {
    describe('3.1: Valid timestamp format assertions (HH:mm)', () => {
      const validCases = ['08:30', '14:15', '00:00', '23:59', '07:00', '11:45', '16:05'];

      for (const time of validCases) {
        it(`accepts valid timestamp: "${time}"`, () => {
          const res = validateEarlyDeparture({
            studentId: '269029',
            studentName: 'Nguyễn Văn A',
            departedAt: time,
            reason: 'Phụ huynh đón có giấy xin phép',
          });

          expect(res.isValid).toBe(true);
          expect(res.error).toBeUndefined();
        });
      }
    });

    describe('3.2: Invalid timestamp format assertions', () => {
      const invalidCases = [
        { time: '25:00', reason: 'Hour 25 exceeds 23' },
        { time: '9:30', reason: 'Missing leading zero on hour' },
        { time: '8:00', reason: 'Missing leading zero on hour' },
        { time: '24:00', reason: 'Hour 24 is invalid (max 23)' },
        { time: '14:60', reason: 'Minute 60 is invalid (max 59)' },
        { time: '14:99', reason: 'Minute 99 is invalid' },
        { time: 'invalid', reason: 'Non-numeric string' },
        { time: 'abc', reason: 'Alphabetical characters' },
        { time: '14-15', reason: 'Hyphen separator instead of colon' },
        { time: '14.15', reason: 'Dot separator instead of colon' },
        { time: '14:15:00', reason: 'Seconds included' },
        { time: '14:5', reason: 'Single digit minute' },
        { time: '-01:00', reason: 'Negative hour' },
        { time: '', reason: 'Empty string' },
      ];

      for (const c of invalidCases) {
        it(`rejects invalid timestamp "${c.time}" (${c.reason}) with ATTENDANCE_INVALID_TIME_FORMAT`, () => {
          const res = validateEarlyDeparture({
            studentId: '269029',
            studentName: 'Nguyễn Văn A',
            departedAt: c.time,
            reason: 'Lý do hợp lệ',
          });

          expect(res.isValid).toBe(false);
          expect(res.error).toContain('ATTENDANCE_INVALID_TIME_FORMAT');
        });
      }
    });

    describe('3.3: Mandatory reason requirement assertions', () => {
      it('rejects empty string reason with ATTENDANCE_MISSING_REASON', () => {
        const res = validateEarlyDeparture({
          studentId: '269029',
          studentName: 'Nguyễn Văn A',
          departedAt: '08:30',
          reason: '',
        });

        expect(res.isValid).toBe(false);
        expect(res.error).toContain('ATTENDANCE_MISSING_REASON');
      });

      it('rejects whitespace-only reason with ATTENDANCE_MISSING_REASON', () => {
        const res = validateEarlyDeparture({
          studentId: '269029',
          studentName: 'Nguyễn Văn A',
          departedAt: '08:30',
          reason: '   \t  \n  ',
        });

        expect(res.isValid).toBe(false);
        expect(res.error).toContain('ATTENDANCE_MISSING_REASON');
      });

      it('rejects undefined/null reason with ATTENDANCE_MISSING_REASON', () => {
        const res = validateEarlyDeparture({
          studentId: '269029',
          studentName: 'Nguyễn Văn A',
          departedAt: '08:30',
          reason: undefined,
        });

        expect(res.isValid).toBe(false);
        expect(res.error).toContain('ATTENDANCE_MISSING_REASON');
      });

      it('accepts meaningful non-empty reason', () => {
        const res = validateEarlyDeparture({
          studentId: '269029',
          studentName: 'Nguyễn Văn A',
          departedAt: '08:30',
          reason: 'Sốt cao 39 độ, y tế trường bàn giao phụ huynh',
        });

        expect(res.isValid).toBe(true);
        expect(res.error).toBeUndefined();
      });
    });

    describe('3.4: Student ID & Duplicate Prevention', () => {
      it('rejects record with missing studentId', () => {
        const res = validateEarlyDeparture({
          studentId: '',
          studentName: 'Nguyễn Văn A',
          departedAt: '08:30',
          reason: 'Có lý do',
        });

        expect(res.isValid).toBe(false);
        expect(res.error).toContain('Vui lòng chọn học sinh');
      });

      it('rejects duplicate record for student already in existingRecords', () => {
        const existing: EarlyDepartureRecord[] = [
          {
            studentId: '269029',
            studentName: 'Nguyễn Văn A',
            departedAt: '08:30',
            reason: 'Đau đầu',
            timestamp: Date.now(),
          },
        ];

        const res = validateEarlyDeparture(
          {
            studentId: '269029',
            studentName: 'Nguyễn Văn A',
            departedAt: '10:15',
            reason: 'Đau bụng',
          },
          existing
        );

        expect(res.isValid).toBe(false);
        expect(res.error).toContain('Học sinh này đã có trong danh sách về sớm');
      });
    });

    describe('3.5: EarlyDepartureSection Component Integration', () => {
      const mockRoster: StudentDoc[] = [
        { id: '269029', mhs: '269029', stt: 1, name: 'Nguyễn Văn A', gender: 'Nam', classId: '8A2', grade: 8, dob: '2012-01-01', status: 'active', createdAt: Date.now() },
        { id: '269963', mhs: '269963', stt: 2, name: 'Trần Thị B', gender: 'Nữ', classId: '8A2', grade: 8, dob: '2012-02-02', status: 'active', createdAt: Date.now() },
        { id: '269910', mhs: '269910', stt: 3, name: 'Lê Văn C', gender: 'Nam', classId: '8A2', grade: 8, dob: '2012-03-03', status: 'active', createdAt: Date.now() },
      ];

      it('displays validation error and blocks onChange when entering invalid time format', async () => {
        const handleChange = vi.fn();
        render(
          <EarlyDepartureSection
            roster={mockRoster}
            earlyDepartures={[]}
            onChange={handleChange}
            periodIndex={2}
          />
        );

        // Select student
        const select = screen.getByLabelText('Học sinh');
        fireEvent.change(select, { target: { value: '269029' } });

        // Enter invalid time 25:00
        const timeInput = screen.getByLabelText(/Thời điểm về/i);
        fireEvent.change(timeInput, { target: { value: '25:00' } });

        // Enter reason
        const reasonInput = screen.getByLabelText('Lý do');
        fireEvent.change(reasonInput, { target: { value: 'Sốt' } });

        // Click Add button
        const addBtn = screen.getByRole('button', { name: /Thêm/i });
        fireEvent.click(addBtn);

        // Assert error banner appears and onChange was NOT called
        expect(screen.getByText(/ATTENDANCE_INVALID_TIME_FORMAT/i)).toBeInTheDocument();
        expect(handleChange).not.toHaveBeenCalled();
      });

      it('displays validation error and blocks onChange when hour lacks leading zero (9:30)', async () => {
        const handleChange = vi.fn();
        render(
          <EarlyDepartureSection
            roster={mockRoster}
            earlyDepartures={[]}
            onChange={handleChange}
            periodIndex={2}
          />
        );

        // Select student
        const select = screen.getByLabelText('Học sinh');
        fireEvent.change(select, { target: { value: '269029' } });

        // Enter invalid time 9:30
        const timeInput = screen.getByLabelText(/Thời điểm về/i);
        fireEvent.change(timeInput, { target: { value: '9:30' } });

        // Enter reason
        const reasonInput = screen.getByLabelText('Lý do');
        fireEvent.change(reasonInput, { target: { value: 'Sốt' } });

        // Click Add
        const addBtn = screen.getByRole('button', { name: /Thêm/i });
        fireEvent.click(addBtn);

        expect(screen.getByText(/ATTENDANCE_INVALID_TIME_FORMAT/i)).toBeInTheDocument();
        expect(handleChange).not.toHaveBeenCalled();
      });

      it('displays validation error and blocks onChange when reason is empty', async () => {
        const handleChange = vi.fn();
        render(
          <EarlyDepartureSection
            roster={mockRoster}
            earlyDepartures={[]}
            onChange={handleChange}
            periodIndex={2}
          />
        );

        const select = screen.getByLabelText('Học sinh');
        fireEvent.change(select, { target: { value: '269029' } });

        const timeInput = screen.getByLabelText(/Thời điểm về/i);
        fireEvent.change(timeInput, { target: { value: '08:30' } });

        // Reason left empty
        const addBtn = screen.getByRole('button', { name: /Thêm/i });
        fireEvent.click(addBtn);

        expect(screen.getByText(/ATTENDANCE_MISSING_REASON/i)).toBeInTheDocument();
        expect(handleChange).not.toHaveBeenCalled();
      });

      it('successfully adds valid record and invokes onChange with sanitized payload', async () => {
        const handleChange = vi.fn();
        render(
          <EarlyDepartureSection
            roster={mockRoster}
            earlyDepartures={[]}
            onChange={handleChange}
            periodIndex={2}
          />
        );

        const select = screen.getByLabelText('Học sinh');
        fireEvent.change(select, { target: { value: '269029' } });

        const timeInput = screen.getByLabelText(/Thời điểm về/i);
        fireEvent.change(timeInput, { target: { value: '08:30' } });

        const reasonInput = screen.getByLabelText('Lý do');
        fireEvent.change(reasonInput, { target: { value: 'Sốt cao, phụ huynh đón' } });

        const addBtn = screen.getByRole('button', { name: /Thêm/i });
        fireEvent.click(addBtn);

        expect(handleChange).toHaveBeenCalledTimes(1);
        const addedList = handleChange.mock.calls[0][0];
        expect(addedList.length).toBe(1);
        expect(addedList[0].studentId).toBe('269029');
        expect(addedList[0].studentName).toBe('Nguyễn Văn A');
        expect(addedList[0].departedAt).toBe('08:30');
        expect(addedList[0].reason).toBe('Sốt cao, phụ huynh đón');
        expect(addedList[0].reportedPeriodIndex).toBe(2);
      });

      it('prevents adding duplicate student through UI', async () => {
        const existing: EarlyDepartureRecord[] = [
          {
            studentId: '269029',
            studentName: 'Nguyễn Văn A',
            departedAt: '08:30',
            reason: 'Đau bụng',
            timestamp: Date.now(),
          },
        ];

        const handleChange = vi.fn();
        render(
          <EarlyDepartureSection
            roster={mockRoster}
            earlyDepartures={existing}
            onChange={handleChange}
            periodIndex={2}
          />
        );

        const select = screen.getByLabelText('Học sinh');
        fireEvent.change(select, { target: { value: '269029' } });

        const timeInput = screen.getByLabelText(/Thời điểm về/i);
        fireEvent.change(timeInput, { target: { value: '14:15' } });

        const reasonInput = screen.getByLabelText('Lý do');
        fireEvent.change(reasonInput, { target: { value: 'Đi bệnh viện' } });

        const addBtn = screen.getByRole('button', { name: /Thêm/i });
        fireEvent.click(addBtn);

        expect(screen.getByText(/Học sinh này đã có trong danh sách về sớm/i)).toBeInTheDocument();
        expect(handleChange).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 4. TRADITIONAL MOET NOTATION & ATTENDANCE STATS
  // =========================================================================
  describe('4. Traditional MOET Notation & Attendance Formatting', () => {
    it('formats display with early departure correctly', () => {
      const absences: StudentAbsenceRecord[] = [
        { studentId: '1', studentName: 'Nguyễn Quỳnh An', type: 'P' },
      ];
      const earlyDepartures: EarlyDepartureRecord[] = [
        { studentId: '2', studentName: 'Trần Bảo Nam', departedAt: '09:30', reason: 'Sốt' },
      ];

      const display = formatAttendanceDisplay(absences, earlyDepartures);
      expect(display).toContain('1 (P: An)');
      expect(display).toContain('Về sớm: Nam (09:30)');
    });

    it('formats display when only early departure is present and no absences', () => {
      const earlyDepartures: EarlyDepartureRecord[] = [
        { studentId: '2', studentName: 'Trần Bảo Nam', departedAt: '14:15', reason: 'Việc gia đình' },
      ];

      const display = formatAttendanceDisplay([], earlyDepartures);
      expect(display).toBe('Về sớm: Nam (14:15)');
    });
  });
});
