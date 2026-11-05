/**
 * Thống kê HS nghỉ có phép (đơn đã duyệt) — hàm thuần, có test.
 * Đếm theo HS riêng biệt trong kỳ xem: HS nghỉ 3 ngày trong tuần = 1 HS (chi tiết liệt kê ngày).
 */
import { schoolDates, type StudentLeave } from './studentLeave';

export interface LeaveClassStat {
  classId: string;
  grade: number;
  fullDay: number;
  periods: number;
  noMeal: number;
  students: Array<{ mhs: string; name: string; detail: string }>;
}
export interface LeaveStats {
  total: number;
  byGrade: Array<{ grade: number; count: number }>;
  byClass: LeaveClassStat[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

/** Thứ Hai..thứ Bảy của tuần chứa todayIso (Chủ nhật → tuần vừa qua). */
export function weekSchoolDates(todayIso: string): string[] {
  const [y, m, d] = todayIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const back = (dt.getDay() + 6) % 7; // T2=0 ... CN=6
  dt.setDate(dt.getDate() - back);
  return schoolDates(toIso(dt), 6);
}

export function leaveStats(leaves: StudentLeave[], dates: string[]): LeaveStats {
  const inView = new Set(dates);
  const per = new Map<string, { classId: string; mhs: string; name: string; full: boolean; noMeal: boolean; parts: string[] }>();
  for (const l of leaves) {
    if (l.status !== 'approved') continue;
    const hit = [...l.dates].filter((d) => inView.has(d)).sort();
    if (!hit.length) continue;
    const key = `${l.classId}|${l.mhs}`;
    const cur = per.get(key) ?? { classId: l.classId, mhs: l.mhs, name: l.studentName, full: false, noMeal: false, parts: [] };
    if (l.kind === 'day' || l.periods.length === 0) cur.full = true;
    if (l.meal === false) cur.noMeal = true;
    const what = l.periods.length === 0 ? 'cả ngày' : `tiết ${[...l.periods].sort((a, b) => a - b).join(',')}`;
    cur.parts.push(`${hit.map(fmt).join(', ')}: ${what}`);
    per.set(key, cur);
  }
  const classes = new Map<string, LeaveClassStat>();
  for (const s of per.values()) {
    const c = classes.get(s.classId) ?? { classId: s.classId, grade: parseInt(s.classId, 10) || 0, fullDay: 0, periods: 0, noMeal: 0, students: [] };
    if (s.full) c.fullDay++;
    else c.periods++;
    if (s.noMeal) c.noMeal++;
    c.students.push({ mhs: s.mhs, name: s.name, detail: s.parts.join('; ') });
    classes.set(s.classId, c);
  }
  const byClass = [...classes.values()].sort((a, b) => a.classId.localeCompare(b.classId, 'vi', { numeric: true }));
  byClass.forEach((c) => c.students.sort((a, b) => a.name.localeCompare(b.name, 'vi')));
  const byGrade = [6, 7, 8, 9].map((grade) => ({
    grade,
    count: byClass.filter((c) => c.grade === grade).reduce((n, c) => n + c.students.length, 0),
  }));
  return { total: byClass.reduce((n, c) => n + c.students.length, 0), byGrade, byClass };
}
