/**
 * Bản tin chuyên cần riêng từng học sinh (cho Cổng phụ huynh) — hàm thuần.
 * Sổ đầu bài chứa thông tin cả lớp nên PH không được đọc; mỗi lần GV lưu sổ, hệ thống tách ra
 * /student_daily/{mhs}_{date} chỉ chứa dữ liệu của đúng 1 HS. HS không vắng/muộn → không có doc.
 */

import type { AbsenceType, DailyAttendanceBaseline, PeriodEntry } from '../types/logbook';

export interface StudentDaily {
  mhs: string;
  studentName: string;
  classId: string;
  date: string;
  morning: AbsenceType | null;
  afternoon: AbsenceType | null;
  periodAbsences: Array<{ periodIndex: number; type: AbsenceType; subject: string }>;
  earlyDeparture: { departedAt: string; reason: string } | null;
  updatedAt: number;
}

export const studentDailyId = (mhs: string, date: string) => `${mhs}_${date}`;

export function computeStudentDaily(
  classId: string,
  date: string,
  logbook: { morningBaseline?: DailyAttendanceBaseline; afternoonBaseline?: DailyAttendanceBaseline; preSessionAttendance?: DailyAttendanceBaseline },
  periods: PeriodEntry[],
  now = Date.now()
): Record<string, StudentDaily> {
  const out: Record<string, StudentDaily> = {};
  const get = (mhs: string, name: string): StudentDaily =>
    (out[mhs] ??= { mhs, studentName: name, classId, date, morning: null, afternoon: null, periodAbsences: [], earlyDeparture: null, updatedAt: now });

  const morning = logbook.morningBaseline || logbook.preSessionAttendance;
  for (const [session, b] of [['morning', morning], ['afternoon', logbook.afternoonBaseline]] as const) {
    for (const a of b?.absences || []) {
      if (!a.studentId) continue;
      get(a.studentId, a.studentName)[session] = a.type;
    }
    for (const e of b?.earlyDepartures || []) {
      if (!e.studentId) continue;
      get(e.studentId, e.studentName).earlyDeparture = { departedAt: e.departedAt, reason: e.reason };
    }
  }
  for (const p of [...periods].sort((x, y) => x.periodIndex - y.periodIndex)) {
    for (const a of p.absentStudents || []) {
      if (!a.studentId || a.reportedInTier === 'baseline') continue;
      get(a.studentId, a.studentName).periodAbsences.push({ periodIndex: p.periodIndex, type: a.type, subject: p.subject || '' });
    }
    for (const e of p.earlyDepartures || []) {
      if (!e.studentId) continue;
      get(e.studentId, e.studentName).earlyDeparture ??= { departedAt: e.departedAt, reason: e.reason };
    }
  }
  return out;
}

/** Tóm tắt cho PH: số buổi vắng có phép / không phép, số lần muộn, số lần về sớm. */
export function summarizeAttendance(days: StudentDaily[]) {
  let P = 0, K = 0, late = 0, early = 0;
  for (const d of days) {
    for (const s of [d.morning, d.afternoon]) {
      if (s === 'P') P++;
      else if (s === 'K') K++;
      else if (s === 'Late') late++;
    }
    if (d.earlyDeparture) early++;
  }
  return { sessionsP: P, sessionsK: K, late, early };
}

export function describeDay(d: StudentDaily): string {
  const label = (t: AbsenceType | null) => (t === 'P' ? 'vắng có phép' : t === 'K' ? 'vắng không phép' : t === 'Late' ? 'đi muộn' : null);
  const parts: string[] = [];
  const m = label(d.morning);
  const a = label(d.afternoon);
  if (m && a && m === a) parts.push(`Cả ngày ${m}`);
  else {
    if (m) parts.push(`Sáng ${m}`);
    if (a) parts.push(`Chiều ${a}`);
  }
  for (const p of d.periodAbsences) parts.push(`Tiết ${p.periodIndex}${p.subject ? ` (${p.subject})` : ''} ${label(p.type)}`);
  if (d.earlyDeparture) parts.push(`Về sớm lúc ${d.earlyDeparture.departedAt}${d.earlyDeparture.reason ? ` — ${d.earlyDeparture.reason}` : ''}`);
  return parts.join(' • ');
}
