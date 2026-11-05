/**
 * Unit Tests: Period Entry Validator
 * File: src/test/validators.test.ts
 */

import { describe, it, expect } from 'vitest';
import { validatePeriodEntry, assertValidPeriodEntry } from '../utils/validators';

describe('Period Entry Validator Unit Tests', () => {
  const validEntry = {
    periodIndex: 1,
    subject: 'Ngữ văn',
    ppctLessonIndex: 12,
    lessonTopic: 'Thánh Gióng - Tượng đài anh hùng dân tộc',
    teacherId: 'teacher_123',
    teacherName: 'Đinh Hoài Long',
    absentStudents: [
      { studentId: 'HS001', studentName: 'Nguyễn Văn A', type: 'P' as const },
    ],
    scores: {
      learning: 4.0,
      discipline: 3.0,
      hygiene: 2.0,
      customCriterion: 1.0,
      total: 10.0,
    },
    teacherComment: 'Lớp chuẩn bị bài tốt',
    teacherSignature: 'Đinh Hoài Long',
    isSigned: true,
  };

  it('validates a complete, conformant period entry successfully', () => {
    const result = validatePeriodEntry(validEntry);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.validatedEntry).toBeDefined();
  });

  it('detects invalid periodIndex (< 1 or > 8)', () => {
    const r1 = validatePeriodEntry({ ...validEntry, periodIndex: 0 });
    expect(r1.isValid).toBe(false);
    expect(r1.errors.some((e) => e.code === 'PERIOD_INDEX_OUT_OF_BOUNDS')).toBe(true);

    const r2 = validatePeriodEntry({ ...validEntry, periodIndex: 9 });
    expect(r2.isValid).toBe(false);
    expect(r2.errors.some((e) => e.code === 'PERIOD_INDEX_OUT_OF_BOUNDS')).toBe(true);
  });

  it('detects missing subject', () => {
    const r = validatePeriodEntry({ ...validEntry, subject: '   ' });
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.code === 'PERIOD_MISSING_SUBJECT')).toBe(true);
  });

  it('detects missing lesson topic', () => {
    const r = validatePeriodEntry({ ...validEntry, lessonTopic: '' });
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.code === 'PERIOD_MISSING_LESSON_TOPIC')).toBe(true);
  });

  it('detects invalid PPCT lesson index', () => {
    const r1 = validatePeriodEntry({ ...validEntry, ppctLessonIndex: -2 });
    expect(r1.isValid).toBe(false);
    expect(r1.errors.some((e) => e.code === 'PERIOD_INVALID_PPCT_INDEX')).toBe(true);

    const r2 = validatePeriodEntry({ ...validEntry, ppctLessonIndex: 0 });
    expect(r2.isValid).toBe(false);
    expect(r2.errors.some((e) => e.code === 'PERIOD_INVALID_PPCT_INDEX')).toBe(true);
  });

  it('detects missing signature', () => {
    const r = validatePeriodEntry({ ...validEntry, teacherSignature: '' });
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.code === 'PERIOD_MISSING_SIGNATURE')).toBe(true);
  });

  it('detects duplicate student IDs in absentStudents list', () => {
    const r = validatePeriodEntry({
      ...validEntry,
      absentStudents: [
        { studentId: 'HS001', studentName: 'Nguyễn Văn A', type: 'P' },
        { studentId: 'HS001', studentName: 'Nguyễn Văn A', type: 'K' },
      ],
    });
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.code === 'ATTENDANCE_DUPLICATE_ENTRY')).toBe(true);
  });

  it('detects invalid absence type in absentStudents list', () => {
    const r = validatePeriodEntry({
      ...validEntry,
      absentStudents: [
        { studentId: 'HS002', studentName: 'Trần B', type: 'Invalid' as any },
      ],
    });
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.code === 'ATTENDANCE_INVALID_TYPE')).toBe(true);
  });

  it('assertValidPeriodEntry throws contract errors', () => {
    expect(() =>
      assertValidPeriodEntry({ ...validEntry, subject: '' })
    ).toThrowError(/PERIOD_MISSING_SUBJECT/);

    expect(() =>
      assertValidPeriodEntry({ ...validEntry, periodIndex: 10 })
    ).toThrowError(/PERIOD_INDEX_OUT_OF_BOUNDS/);

    expect(() =>
      assertValidPeriodEntry({ ...validEntry, lessonTopic: '' })
    ).toThrowError(/PERIOD_MISSING_LESSON_TOPIC/);

    expect(() =>
      assertValidPeriodEntry({ ...validEntry, teacherSignature: '  ' })
    ).toThrowError(/PERIOD_MISSING_SIGNATURE/);

    expect(() =>
      assertValidPeriodEntry({ ...validEntry, scores: { ...validEntry.scores, learning: 4.5 } })
    ).toThrowError(/SCORE_EXCEEDS_MAX/);
  });
});
