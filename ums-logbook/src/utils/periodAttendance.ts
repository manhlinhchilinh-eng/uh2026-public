/**
 * Điểm danh đầu tiết — hàm thuần.
 * Luồng mỗi tiết: đầu tiết GV điểm danh (vắng/muộn) và lưu ngay (chưa ký) để giám thị, GVCN thấy;
 * cuối tiết GV ký sổ và ghi thêm HS về sớm / ghi chú.
 * Mỗi lần lưu tiết, sổ ngày giữ bản tóm tắt gọn `periodAttendance.{tiết}` để bảng
 * "Vắng/muộn hôm nay" chỉ đọc 1 doc/lớp thay vì quét cả 8 tiết.
 */

import type { DailyAttendanceBaseline, PeriodEntry } from '../types/logbook';
import type { StudentDaily } from './studentDaily';

export interface PeriodAttendanceSummary {
  /** Thời điểm điểm danh (epoch ms) */
  at: number;
  by: string;
  byName: string;
  subject: string;
  absentP: number;
  absentK: number;
  late: number;
  early: number;
  signed: boolean;
  /** HS vắng/muộn trong tiết (tối đa 60) — để đối soát với đơn nghỉ học; doc cũ không có trường này */
  absentees?: Array<{ mhs: string; name: string; type: string }>;
}

/** Tiết đã điểm danh khi đã ký hoặc đã bấm "Lưu điểm danh". */
export function isAttendanceTaken(entry: Partial<PeriodEntry> | null | undefined): boolean {
  return !!entry && (entry.isSigned === true || typeof entry.attendanceTakenAt === 'number');
}

export function summarizePeriodAttendance(entry: PeriodEntry, now = Date.now()): PeriodAttendanceSummary {
  const absents = entry.absentStudents || [];
  const absentees = absents
    .filter((a) => a.studentId)
    .slice(0, 60)
    .map((a) => ({ mhs: a.studentId, name: a.studentName, type: a.type }));
  return {
    at: entry.attendanceTakenAt ?? entry.signedAt ?? now,
    by: entry.attendanceTakenBy || entry.teacherId || '',
    byName: entry.attendanceTakenByName || entry.teacherName || '',
    subject: entry.subject || '',
    absentP: absents.filter((a) => a.type === 'P').length,
    absentK: absents.filter((a) => a.type === 'K').length,
    late: absents.filter((a) => a.type === 'Late').length,
    early: (entry.earlyDepartures || []).length,
    signed: entry.isSigned === true,
    // Firestore không nhận undefined → chỉ thêm khi có HS vắng
    ...(absentees.length ? { absentees } : {}),
  };
}

/** "HH:mm" theo giờ máy. */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface BoardLogbook {
  classId: string;
  morningBaseline?: DailyAttendanceBaseline;
  afternoonBaseline?: DailyAttendanceBaseline;
  preSessionAttendance?: DailyAttendanceBaseline;
  periodAttendance?: Record<string, PeriodAttendanceSummary>;
}

export interface BoardRow {
  classId: string;
  hasLogbook: boolean;
  /** GVCN đã điểm danh đầu buổi */
  morningChecked: boolean;
  afternoonChecked: boolean;
  /** index 0..7 = tiết 1..8; null = chưa điểm danh */
  periods: Array<PeriodAttendanceSummary | null>;
  students: StudentDaily[];
  issueCount: number;
}

export interface BoardTotals {
  classes: number;
  /** Số lớp đã điểm danh tiết đang xét (nếu có) */
  checkedForPeriod: number;
  studentsWithIssues: number;
  absentP: number;
  absentK: number;
  late: number;
  early: number;
}

const baselineChecked = (b?: DailyAttendanceBaseline) => !!b?.reportedBy;

/** Ghép sổ ngày + bản tin từng HS thành bảng toàn trường (sắp theo tên lớp). */
export function buildAttendanceBoard(
  classIds: string[],
  logbooks: BoardLogbook[],
  students: StudentDaily[]
): BoardRow[] {
  const books = new Map(logbooks.map((b) => [b.classId, b]));
  const byClass = new Map<string, StudentDaily[]>();
  for (const s of students) {
    const list = byClass.get(s.classId) || [];
    list.push(s);
    byClass.set(s.classId, list);
  }
  const ids = Array.from(new Set([...classIds, ...books.keys(), ...byClass.keys()])).filter(Boolean);
  ids.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));

  return ids.map((classId) => {
    const lb = books.get(classId);
    const pa = lb?.periodAttendance || {};
    const list = (byClass.get(classId) || []).sort((a, b) => a.studentName.localeCompare(b.studentName, 'vi'));
    return {
      classId,
      hasLogbook: !!lb,
      morningChecked: baselineChecked(lb?.morningBaseline || lb?.preSessionAttendance),
      afternoonChecked: baselineChecked(lb?.afternoonBaseline),
      periods: Array.from({ length: 8 }, (_, i) => pa[String(i + 1)] || null),
      students: list,
      issueCount: list.length,
    };
  });
}

/** Tổng hợp theo HS (mỗi HS tính 1 lần cho từng loại): vắng P/K, muộn, về sớm trong ngày. */
export function boardTotals(rows: BoardRow[], periodIndex: number | null): BoardTotals {
  const t: BoardTotals = { classes: rows.length, checkedForPeriod: 0, studentsWithIssues: 0, absentP: 0, absentK: 0, late: 0, early: 0 };
  for (const r of rows) {
    if (periodIndex && r.periods[periodIndex - 1]) t.checkedForPeriod++;
    for (const s of r.students) {
      t.studentsWithIssues++;
      const types = [s.morning, s.afternoon, ...s.periodAbsences.map((p) => p.type)];
      if (types.includes('K')) t.absentK++;
      else if (types.includes('P')) t.absentP++;
      if (types.includes('Late')) t.late++;
      if (s.earlyDeparture) t.early++;
    }
  }
  return t;
}

/** Nhãn ngắn cho 1 ô tiết, VD "2V 1M" hoặc "Đủ". */
export function periodCellLabel(s: PeriodAttendanceSummary): string {
  const parts: string[] = [];
  const absent = s.absentP + s.absentK;
  if (absent) parts.push(`${absent}V`);
  if (s.late) parts.push(`${s.late}M`);
  if (s.early) parts.push(`${s.early}S`);
  return parts.length ? parts.join(' ') : 'Đủ';
}
