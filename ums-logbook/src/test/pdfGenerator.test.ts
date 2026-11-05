/**
 * Unit & Integration Tests: MOET A4 Landscape PDF Generator Utilities
 * Milestone 5: Layout Geometry, Absence Formatting & Vector PDF Exporter
 * Path: src/test/pdfGenerator.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getWeekDates,
  formatStudentAbsences,
  exportWeeklyLogbookPdf,
  mergePrintPeriods,
} from '../utils/pdfGenerator';
import { StudentAbsenceRecord } from '../types/logbook';

describe('Milestone 5: MOET PDF Generator Utilities', () => {
  it('1. Calculates correct Monday to Friday dates for Week 1', () => {
    const w1 = getWeekDates(1, '2026-09-07');
    expect(w1.startDate).toBe('07/09/2026');
    expect(w1.endDate).toBe('11/09/2026');
    expect(w1.days).toHaveLength(5);
    expect(w1.days[0].dayNameVi).toBe('Thứ Hai');
    expect(w1.days[4].dayNameVi).toBe('Thứ Sáu');
  });

  it('2. Calculates correct Monday to Friday dates for Week 10', () => {
    const w10 = getWeekDates(10, '2026-09-07');
    expect(w10.days).toHaveLength(5);
    expect(w10.days[0].dayOfWeek).toBe(2);
    expect(w10.days[4].dayOfWeek).toBe(6);
  });

  it('3. Formats absence lists properly with P, K, and Late tags', () => {
    expect(formatStudentAbsences([])).toBe('Đủ');

    const absences: StudentAbsenceRecord[] = [
      { studentId: '1', studentName: 'Minh An', type: 'P' },
      { studentId: '2', studentName: 'Đức Huy', type: 'K' },
      { studentId: '3', studentName: 'Lan Anh', type: 'Late' },
    ];

    const formatted = formatStudentAbsences(absences);
    expect(formatted).toContain('Minh An (P)');
    expect(formatted).toContain('Đức Huy (K)');
    expect(formatted).toContain('Lan Anh (M)');
  });

  it('4. Generates a valid jsPDF vector document with 2 pages and tables without throwing', async () => {
    const weekDates = getWeekDates(5, '2026-09-07');
    const sampleData = {
      schoolName: 'TRƯỜNG THCS NGOẠI NGỮ - ULIS',
      districtName: 'UBND QUẬN CẦU GIẤY',
      academicYear: '2026 - 2027',
      classId: '9A3',
      gvcnName: 'Nguyễn Mạnh Linh',
      totalStudents: 26,
      weekNumber: 5,
      startDate: weekDates.startDate,
      endDate: weekDates.endDate,
      days: weekDates.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        dayNameVi: d.dayNameVi,
        date: d.date,
        periods: [],
      })),
      summary: {
        totalPeriodsExpected: 40,
        totalPeriodsTaught: 40,
        totalPeriodsSigned: 39,
        unsignedPeriodsCount: 1,
        unsignedSubjects: ['Toán học'],
        attendanceStats: {
          totalAbsences: 2,
          excusedP: 1,
          unexcusedK: 1,
          late: 0,
        },
        criteriaAverage: {
          learningAvg: 3.8,
          disciplineAvg: 2.8,
          hygieneAvg: 1.9,
          customAvg: 0.9,
          totalWeeklyScore: 9.4,
        },
        emulationScore: 97.0,
        emulationStatus: 'good' as const,
        emulationStatusLabel: 'Tuần học tốt',
        rank: 3,
        gvcnComments: 'Lớp nề nếp tốt, cần chú ý ký sổ đúng hạn.',
      },
    };

    const doc = await exportWeeklyLogbookPdf(sampleData);
    expect(doc).toBeDefined();
    // At least 2 pages (table + weekly summary)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
});

describe('mergePrintPeriods — bản in lấy tiết đã ký trên Firestore (lỗi 05/11: in ra lưới trống)', () => {
  const p = (periodIndex: number, over: Record<string, unknown> = {}) =>
    ({ periodIndex, subject: 'S', lessonTopic: '', isSigned: false, updatedAt: 1, ...over }) as any;

  it('máy in không có bản nháp → dùng tiết từ Firestore', () => {
    const out = mergePrintPeriods([], [p(2, { isSigned: true, lessonTopic: 'Civics' }), p(1, { isSigned: true })]);
    expect(out.map((x) => x.periodIndex)).toEqual([1, 2]);
    expect(out[1].lessonTopic).toBe('Civics');
  });

  it('Firestore đã ký đè bản nháp cũ trên máy; giữ tiết chỉ có ở máy', () => {
    const out = mergePrintPeriods([p(1, { lessonTopic: 'nháp' }), p(3, { lessonTopic: 'chỉ máy' })], [p(1, { isSigned: true, lessonTopic: 'thật' })]);
    expect(out.find((x) => x.periodIndex === 1)?.lessonTopic).toBe('thật');
    expect(out.find((x) => x.periodIndex === 3)?.lessonTopic).toBe('chỉ máy');
  });

  it('bản chưa ký trên Firestore cũ hơn không đè tiết đã ký trên máy', () => {
    const out = mergePrintPeriods([p(1, { isSigned: true, updatedAt: 5 })], [p(1, { isSigned: false, updatedAt: 2 })]);
    expect(out[0].isSigned).toBe(true);
  });

  it('bỏ qua dữ liệu hỏng', () => {
    expect(mergePrintPeriods(undefined, [null as any, p(4)])).toHaveLength(1);
  });
});
