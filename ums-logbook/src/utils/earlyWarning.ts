/**
 * UMS Digital Class Logbook - Student Early Warning Alert Engine
 * File: src/utils/earlyWarning.ts
 *
 * Implements pure mathematical threshold evaluation for attendance and disciplinary risk detection.
 */

import { StudentDoc } from '../types';
import { BehaviorNote } from '../types/behavior';
import {
  EarlyWarningAlert,
  EarlyWarningReason,
  EarlyWarningOptions,
  AbsenceEvent,
  StudentTimelineItem,
} from '../types/earlyWarning';

// Timezone-safe date helper parsing "YYYY-MM-DD"
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Timezone-safe date formatter returning "YYYY-MM-DD"
export function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates start and end dates for the evaluation window.
 * - 'rolling_7_days': [referenceDate - 6 days, referenceDate] (inclusive 7 calendar days)
 * - 'school_week': [Monday of week, Sunday of week]
 */
export function getPeriodRange(
  referenceDate: string | Date = new Date(),
  mode: 'rolling_7_days' | 'school_week' = 'rolling_7_days'
): { startDate: string; endDate: string } {
  const ref = typeof referenceDate === 'string' ? parseDateString(referenceDate) : new Date(referenceDate);

  if (mode === 'school_week') {
    const day = ref.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - daysSinceMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: formatDateString(monday),
      endDate: formatDateString(sunday),
    };
  }

  // rolling_7_days: 6 days prior to reference date up to reference date (7 calendar days inclusive)
  const past = new Date(ref);
  past.setDate(ref.getDate() - 6);

  return {
    startDate: formatDateString(past),
    endDate: formatDateString(ref),
  };
}

/**
 * Extracts note date formatted as "YYYY-MM-DD".
 */
export function getNoteDate(note: BehaviorNote): string {
  if (note.date && typeof note.date === 'string') {
    return note.date;
  }
  const ts = note.createdAt || note.timestamp;
  if (ts) {
    return formatDateString(new Date(ts));
  }
  return formatDateString(new Date());
}

/**
 * Pure evaluation function for Early Warning Alerts.
 */
export function evaluateEarlyWarnings(
  students: StudentDoc[],
  absences: AbsenceEvent[],
  behaviorNotes: BehaviorNote[],
  options?: EarlyWarningOptions
): EarlyWarningAlert[] {
  const mode = options?.windowMode ?? 'rolling_7_days';
  const absenceThreshold = options?.absenceThreshold ?? 3;
  const noteThreshold = options?.noteThreshold ?? 3;
  const range = getPeriodRange(options?.referenceDate, mode);
  const deduplicate = options?.deduplicateAbsencesPerDay ?? false;

  // Filter students by class if specified
  const targetStudents = options?.classId
    ? students.filter((s) => s.classId === options.classId)
    : students;

  // Filter events within period range (inclusive)
  const windowAbsences = absences.filter(
    (a) => a.date >= range.startDate && a.date <= range.endDate
  );
  const windowNotes = behaviorNotes.filter((n) => {
    const d = getNoteDate(n);
    return d >= range.startDate && d <= range.endDate;
  });

  const alerts: EarlyWarningAlert[] = [];
  const now = Date.now();

  for (const student of targetStudents) {
    // 1. Evaluate Unexcused Absences (strictly type === 'K')
    // Strictly exclude excused absences ('P') and tardies ('Late')
    const studentKAbsences = windowAbsences.filter(
      (a) => (a.studentId === student.id || a.studentId === student.mhs) && a.type === 'K'
    );

    let unexcusedCount = studentKAbsences.length;
    let absenceDetails: string[] = [];

    if (deduplicate) {
      const datesWithK = Array.from(new Set(studentKAbsences.map((a) => a.date))).sort();
      unexcusedCount = datesWithK.length;
      absenceDetails = datesWithK.map((d) => `${d}: Nghỉ học không phép (K)`);
    } else {
      absenceDetails = studentKAbsences.map((a) => {
        const periodText = a.periodIndex ? `Tiết ${a.periodIndex}` : 'Đầu buổi';
        return `${a.date} (${periodText}): Vắng không phép (K)${a.note ? ` - ${a.note}` : ''}`;
      });
    }

    // 2. Evaluate Negative Behavior Notes (strictly type === 'negative')
    // Strictly exclude positive notes ('positive')
    const studentNegNotes = windowNotes.filter(
      (n) => (n.studentId === student.id || n.studentId === student.mhs) && n.type === 'negative'
    );
    const negativeCount = studentNegNotes.length;
    const noteDetails = studentNegNotes.map((n) => {
      const d = getNoteDate(n);
      return `${d}: [${n.category}] ${n.content || n.description} (bởi ${n.authorName || n.authorId})`;
    });

    const isAttendanceTriggered = unexcusedCount >= absenceThreshold;
    const isBehaviorTriggered = negativeCount >= noteThreshold;

    if (!isAttendanceTriggered && !isBehaviorTriggered) {
      continue;
    }

    const reasons: EarlyWarningReason[] = [];

    if (isAttendanceTriggered) {
      reasons.push({
        type: 'unexcused_absences',
        count: unexcusedCount,
        threshold: absenceThreshold,
        details: absenceDetails,
      });
    }

    if (isBehaviorTriggered) {
      reasons.push({
        type: 'negative_notes',
        count: negativeCount,
        threshold: noteThreshold,
        details: noteDetails,
      });
    }

    // Compounded Condition 3: Both conditions met -> critical, otherwise warning
    const level = isAttendanceTriggered && isBehaviorTriggered ? 'critical' : 'warning';

    alerts.push({
      studentId: student.id,
      studentName: student.name,
      studentNumber: student.stt ? String(student.stt).padStart(2, '0') : student.mhs,
      classId: student.classId,
      level,
      reasons,
      periodRange: range,
      detectedAt: now,
    });
  }

  // Sort: Critical first, then by total violations descending, then by studentName
  return alerts.sort((a, b) => {
    if (a.level === 'critical' && b.level !== 'critical') return -1;
    if (b.level === 'critical' && a.level !== 'critical') return 1;

    const totalA = a.reasons.reduce((sum, r) => sum + r.count, 0);
    const totalB = b.reasons.reduce((sum, r) => sum + r.count, 0);
    if (totalB !== totalA) return totalB - totalA;

    return a.studentName.localeCompare(b.studentName);
  });
}

/**
 * Compiles a rich unified timeline for the Student Profile Drawer.
 */
export function buildStudentTimeline(
  studentId: string,
  absences: AbsenceEvent[],
  behaviorNotes: BehaviorNote[]
): StudentTimelineItem[] {
  const items: StudentTimelineItem[] = [];

  // 1. Attendance events
  for (const a of absences) {
    if (a.studentId !== studentId) continue;

    const isP = a.type === 'P';
    const isLate = a.type === 'Late';

    let badgeVariant: StudentTimelineItem['badgeVariant'] = 'rose';
    let badgeLabel = 'Vắng không phép (K)';

    if (isP) {
      badgeVariant = 'amber';
      badgeLabel = 'Vắng có phép (P)';
    } else if (isLate) {
      badgeVariant = 'blue';
      badgeLabel = 'Đi muộn';
    }

    const timeObj = parseDateString(a.date);
    const baseTimestamp = a.timestamp || timeObj.getTime() + (a.periodIndex ? a.periodIndex * 3600000 : 0);

    items.push({
      id: `att_${a.date}_${a.periodIndex || 'pre'}_${a.studentId}`,
      studentId: a.studentId,
      studentName: a.studentName || '',
      classId: a.classId,
      type: 'absence',
      date: a.date,
      timestamp: baseTimestamp,
      title: a.periodIndex ? `Vắng Tiết ${a.periodIndex}` : 'Điểm danh đầu buổi',
      description: a.note || undefined,
      badgeLabel,
      badgeVariant,
      periodIndex: a.periodIndex,
    });
  }

  // 2. Behavior notes
  for (const n of behaviorNotes) {
    if (n.studentId !== studentId) continue;

    const isPositive = n.type === 'positive';
    const d = getNoteDate(n);
    const ts = n.createdAt || n.timestamp || (d ? parseDateString(d).getTime() : Date.now());

    items.push({
      id: n.id,
      studentId: n.studentId,
      studentName: n.studentName,
      classId: n.classId,
      type: isPositive ? 'positive_note' : 'negative_note',
      date: d,
      timestamp: ts,
      title: n.category || (isPositive ? 'Khen ngợi' : 'Nhắc nhở nề nếp'),
      description: n.content || n.description,
      authorName: n.authorName,
      authorRole: n.authorRole,
      category: n.category,
      badgeLabel: isPositive ? 'Khen ngợi' : 'Vi phạm nề nếp',
      badgeVariant: isPositive ? 'emerald' : 'rose',
      periodIndex: n.periodIndex,
    });
  }

  // Sort newest first
  return items.sort((a, b) => b.timestamp - a.timestamp);
}
