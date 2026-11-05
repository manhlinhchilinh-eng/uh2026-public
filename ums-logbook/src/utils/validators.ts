/**
 * UMS Digital Class Logbook - Validation Utilities
 * File: src/utils/validators.ts
 *
 * Implements validation for PeriodEntry, attendance items, and error reporting.
 */

import { PeriodEntry } from '../types/logbook';
import { ScoringConfig, DEFAULT_SCORING_CONFIG, validateScores } from './scoring';

export interface ValidationErrorItem {
  field: string;
  code: string;
  messageVi: string;
  messageEn: string;
}

export interface PeriodValidationResult {
  isValid: boolean;
  errors: ValidationErrorItem[];
  validatedEntry?: PeriodEntry;
}

/**
 * Functional validator for UI forms returning detailed validation errors.
 */
export function validatePeriodEntry(
  entry: Partial<PeriodEntry>,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): PeriodValidationResult {
  const errors: ValidationErrorItem[] = [];

  if (!entry || typeof entry !== 'object') {
    return {
      isValid: false,
      errors: [
        {
          field: 'entry',
          code: 'ENTRY_INVALID',
          messageVi: 'Dữ liệu tiết học không hợp lệ',
          messageEn: 'Period entry data is invalid',
        },
      ],
    };
  }

  // 1. Period Index
  if (
    typeof entry.periodIndex !== 'number' ||
    !Number.isInteger(entry.periodIndex) ||
    entry.periodIndex < 1 ||
    entry.periodIndex > 8
  ) {
    errors.push({
      field: 'periodIndex',
      code: 'PERIOD_INDEX_OUT_OF_BOUNDS',
      messageVi: `Tiết học phải từ 1 đến 8 (nhận được: ${entry.periodIndex})`,
      messageEn: `Period index must be an integer between 1 and 8 (got: ${entry.periodIndex})`,
    });
  }

  // 2. Subject
  if (!entry.subject || !entry.subject.trim()) {
    errors.push({
      field: 'subject',
      code: 'PERIOD_MISSING_SUBJECT',
      messageVi: 'Vui lòng chọn hoặc nhập tên môn học',
      messageEn: 'Subject name is required',
    });
  }

  // 3. Lesson Topic
  if (!entry.lessonTopic || !entry.lessonTopic.trim()) {
    errors.push({
      field: 'lessonTopic',
      code: 'PERIOD_MISSING_LESSON_TOPIC',
      messageVi: 'Vui lòng nhập tên bài học hoặc nội dung tiết',
      messageEn: 'Lesson topic is required',
    });
  }

  // 4. PPCT Index (if provided)
  if (
    entry.ppctLessonIndex !== undefined &&
    entry.ppctLessonIndex !== null &&
    (!Number.isInteger(entry.ppctLessonIndex) || entry.ppctLessonIndex <= 0)
  ) {
    errors.push({
      field: 'ppctLessonIndex',
      code: 'PERIOD_INVALID_PPCT_INDEX',
      messageVi: 'Tiết PPCT phải là số nguyên dương lớn hơn 0',
      messageEn: 'PPCT lesson index must be a positive integer',
    });
  }

  // 5. Scores Validation
  let validatedScore = entry.scores;
  try {
    validatedScore = validateScores(entry.scores, config);
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('SCORE_EXCEEDS_MAX')) {
      errors.push({
        field: 'scores',
        code: 'SCORE_EXCEEDS_MAX',
        messageVi: 'Điểm tiêu chí vượt quá giới hạn tối đa',
        messageEn: 'Criterion value exceeds maximum allowed ceiling',
      });
    } else if (msg.includes('SCORE_TOTAL_EXCEEDS_10')) {
      errors.push({
        field: 'scores.total',
        code: 'SCORE_TOTAL_EXCEEDS_10',
        messageVi: 'Tổng điểm không được vượt quá 10.0',
        messageEn: 'Total period score exceeds maximum allowed of 10.0',
      });
    } else if (msg.includes('SCORE_NEGATIVE_VALUE')) {
      errors.push({
        field: 'scores',
        code: 'SCORE_NEGATIVE_VALUE',
        messageVi: 'Điểm số không được là số âm',
        messageEn: 'Criterion cannot be negative',
      });
    } else {
      errors.push({
        field: 'scores',
        code: 'SCORE_NON_NUMERIC',
        messageVi: 'Điểm số phải là số hợp lệ',
        messageEn: 'Scores must be valid numbers',
      });
    }
  }

  // 6. Absent Students validation
  if (entry.absentStudents && Array.isArray(entry.absentStudents)) {
    const seen = new Set<string>();
    for (const abs of entry.absentStudents) {
      if (!abs.studentId) continue;
      if (seen.has(abs.studentId)) {
        errors.push({
          field: 'absentStudents',
          code: 'ATTENDANCE_DUPLICATE_ENTRY',
          messageVi: `Học sinh ${abs.studentName || abs.studentId} bị trùng lặp trong danh sách vắng tiết`,
          messageEn: `Student ${abs.studentName || abs.studentId} recorded multiple times in period absence list`,
        });
      }
      seen.add(abs.studentId);

      if (!['P', 'K', 'Late'].includes(abs.type)) {
        errors.push({
          field: 'absentStudents.type',
          code: 'ATTENDANCE_INVALID_TYPE',
          messageVi: `Trạng thái điểm danh "${abs.type}" không hợp lệ (phải là P, K hoặc Late)`,
          messageEn: `Invalid absence type "${abs.type}" (must be P, K, or Late)`,
        });
      }
    }
  }

  // 7. Signature
  if (!entry.teacherSignature || !entry.teacherSignature.trim()) {
    errors.push({
      field: 'teacherSignature',
      code: 'PERIOD_MISSING_SIGNATURE',
      messageVi: 'Vui lòng ký tên xác nhận sổ đầu bài',
      messageEn: 'Teacher signature is required',
    });
  }

  const isValid = errors.length === 0;
  return {
    isValid,
    errors,
    validatedEntry: isValid ? ({
      ...entry,
      scores: validatedScore,
    } as PeriodEntry) : undefined,
  };
}

/**
 * Throwing assertion validator for service/backend contract enforcement.
 */
export function assertValidPeriodEntry(
  entry: Partial<PeriodEntry>,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): PeriodEntry {
  if (typeof entry.periodIndex !== 'number' || !Number.isInteger(entry.periodIndex) || entry.periodIndex < 1 || entry.periodIndex > 8) {
    throw new Error(`PERIOD_INDEX_OUT_OF_BOUNDS: Period index must be an integer between 1 and 8, got ${entry.periodIndex}`);
  }
  if (!entry.subject || !entry.subject.trim()) {
    throw new Error('PERIOD_MISSING_SUBJECT: Subject name is required.');
  }
  if (!entry.lessonTopic || !entry.lessonTopic.trim()) {
    throw new Error('PERIOD_MISSING_LESSON_TOPIC: Lesson topic is required.');
  }
  if (!entry.teacherSignature || !entry.teacherSignature.trim()) {
    throw new Error('PERIOD_MISSING_SIGNATURE: Teacher signature is required.');
  }

  const scores = validateScores(entry.scores, config);

  if (entry.absentStudents && Array.isArray(entry.absentStudents)) {
    const seen = new Set<string>();
    for (const abs of entry.absentStudents) {
      if (seen.has(abs.studentId)) {
        throw new Error(`ATTENDANCE_DUPLICATE_ENTRY: Student ${abs.studentId} recorded multiple times in period ${entry.periodIndex}`);
      }
      seen.add(abs.studentId);
      if (!['P', 'K', 'Late'].includes(abs.type)) {
        throw new Error(`ATTENDANCE_INVALID_TYPE: Invalid absence type "${abs.type}"`);
      }
    }
  }

  return {
    ...entry,
    periodIndex: entry.periodIndex,
    subject: entry.subject.trim(),
    lessonTopic: entry.lessonTopic.trim(),
    teacherSignature: entry.teacherSignature.trim(),
    scores,
    isSigned: entry.isSigned ?? true,
    absentStudents: entry.absentStudents || [],
    updatedAt: entry.updatedAt || Date.now(),
  } as PeriodEntry;
}
