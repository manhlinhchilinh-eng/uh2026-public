/**
 * UMS Digital Class Logbook - Attendance Utilities
 * File: src/utils/attendance.ts
 */

import {
  StudentAbsenceRecord,
  EarlyDepartureRecord,
} from '../types/logbook';

/**
 * Serializes period attendance into traditional MOET school logbook notation.
 *
 * Example Outputs:
 * - When all present: "Đủ" or "0 (Đủ)"
 * - When excused only: "1 (P: Quỳnh An)"
 * - When unexcused only: "1 (K: Nhật Anh)"
 * - When mixed: "2 (P: Quỳnh An; K: Nhật Anh)"
 * - When tardy included: "2 (P: Quỳnh An; K: Nhật Anh); Muộn: Minh Quân"
 * - When early departure: "1 (P: Quỳnh An); Về sớm: Bảo Nam (09:30)"
 */
export function formatAttendanceDisplay(
  absences: StudentAbsenceRecord[] = [],
  earlyDepartures: EarlyDepartureRecord[] = [],
  mode: 'short' | 'full' = 'full'
): string {
  const pList = absences.filter((a) => a.type === 'P');
  const kList = absences.filter((a) => a.type === 'K');
  const lateList = absences.filter((a) => a.type === 'Late');
  const totalAbsent = pList.length + kList.length;

  if (totalAbsent === 0 && lateList.length === 0 && earlyDepartures.length === 0) {
    return mode === 'short' ? 'Đủ' : '0 (Đủ)';
  }

  const parts: string[] = [];

  if (totalAbsent > 0) {
    const details: string[] = [];
    if (pList.length > 0) {
      const names = pList.map((s) => s.studentName.split(' ').pop() || s.studentName).join(', ');
      details.push(`P: ${names}`);
    }
    if (kList.length > 0) {
      const names = kList.map((s) => s.studentName.split(' ').pop() || s.studentName).join(', ');
      details.push(`K: ${names}`);
    }
    parts.push(`${totalAbsent} (${details.join('; ')})`);
  }

  if (lateList.length > 0) {
    const lateNames = lateList.map((s) => s.studentName.split(' ').pop() || s.studentName).join(', ');
    parts.push(`Muộn: ${lateNames}`);
  }

  if (earlyDepartures.length > 0) {
    const earlyDetails = earlyDepartures
      .map((e) => `${e.studentName.split(' ').pop()} (${e.departedAt})`)
      .join(', ');
    parts.push(`Về sớm: ${earlyDetails}`);
  }

  return parts.join(' • ');
}

/**
 * Resolves incoming real-time baseline updates against local period form state.
 */
export function resolveAttendanceSync(
  currentPeriodAbsences: StudentAbsenceRecord[],
  incomingBaselineAbsences: StudentAbsenceRecord[],
  isPeriodAttendanceDirty: boolean
): {
  mergedAbsences: StudentAbsenceRecord[];
  hasConflict: boolean;
  conflictDetails?: string[];
} {
  if (!isPeriodAttendanceDirty) {
    // Pristine form: adopt baseline directly with baseline tag
    return {
      mergedAbsences: incomingBaselineAbsences.map((a) => ({
        ...a,
        reportedInTier: 'baseline' as const,
      })),
      hasConflict: false,
    };
  }

  // Dirty form: check for overlapping student conflicts
  const periodStudentIds = new Set(currentPeriodAbsences.map((a) => a.studentId));
  const conflicts: string[] = [];

  for (const b of incomingBaselineAbsences) {
    const existing = currentPeriodAbsences.find((a) => a.studentId === b.studentId);
    if (existing && existing.type !== b.type) {
      conflicts.push(
        `${b.studentName}: GVCN báo [${b.type}], bạn đang chọn [${existing.type}]`
      );
    }
  }

  if (conflicts.length > 0) {
    return {
      mergedAbsences: currentPeriodAbsences, // retain local changes pending user decision
      hasConflict: true,
      conflictDetails: conflicts,
    };
  }

  // Non-conflicting additions: merge GVCN absences not already modified by GVBM
  const nonConflictingBaseline = incomingBaselineAbsences
    .filter((b) => !periodStudentIds.has(b.studentId))
    .map((b) => ({ ...b, reportedInTier: 'baseline' as const }));

  return {
    mergedAbsences: [...currentPeriodAbsences, ...nonConflictingBaseline],
    hasConflict: false,
  };
}

/**
 * Validates early departure records
 */
export function validateEarlyDeparture(
  record: Partial<EarlyDepartureRecord>,
  existingRecords: EarlyDepartureRecord[] = []
): { isValid: boolean; error?: string } {
  if (!record.studentId) {
    return { isValid: false, error: 'Vui lòng chọn học sinh' };
  }

  if (existingRecords.some((r) => r.studentId === record.studentId)) {
    return { isValid: false, error: 'Học sinh này đã có trong danh sách về sớm' };
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!record.departedAt || !timeRegex.test(record.departedAt)) {
    return { isValid: false, error: 'ATTENDANCE_INVALID_TIME_FORMAT: Giờ về phải theo định dạng HH:mm (ví dụ: 09:30)' };
  }

  if (!record.reason || !record.reason.trim()) {
    return { isValid: false, error: 'ATTENDANCE_MISSING_REASON: Vui lòng nhập lý do về sớm' };
  }

  return { isValid: true };
}

/**
 * Calculates summary metrics for an attendance list
 */
export function calculateAttendanceStats(
  totalStudents: number,
  absences: StudentAbsenceRecord[] = [],
  earlyDepartures: EarlyDepartureRecord[] = []
) {
  const pCount = absences.filter((a) => a.type === 'P').length;
  const kCount = absences.filter((a) => a.type === 'K').length;
  const lateCount = absences.filter((a) => a.type === 'Late').length;
  const earlyCount = earlyDepartures.length;
  const absentTotal = pCount + kCount;
  const presentCount = Math.max(0, totalStudents - absentTotal);

  return {
    totalStudents,
    presentCount,
    absentTotal,
    pCount,
    kCount,
    lateCount,
    earlyCount,
    allPresent: absentTotal === 0 && lateCount === 0,
  };
}
