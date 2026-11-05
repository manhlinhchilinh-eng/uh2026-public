/**
 * Đọc file Thời khóa biểu dạng LƯỚI của trường (sheet "TKB_Lop"):
 *   [_, "9A1", _, "Thứ 2", "Thứ 3", …, "Thứ 6"]      ← dòng tiêu đề mỗi lớp
 *   [_, "Sáng", 1, "Homeroom - Ms Giang", …]          ← 4 tiết sáng
 *   [_, "Chiều", 1, "Eng 1 - Ms Minh Huệ", …]         ← 4 tiết chiều
 * Ô = "Môn - Tên GV trên TKB". Sáng 1–4 → tiết 1–4; Chiều 1–4 → tiết 5–8.
 * Hàm thuần — không gọi Firebase.
 */

import type { ScheduleSlot, ScheduleSlotMapItem } from '../types/schedule';


export interface ParsedTimetable {
  classes: Record<string, ScheduleSlot[]>;
  academicYear: string | null;
  semester: number | null;
  warnings: string[];
}

const CLASS_RE = /^\d[A-Z]\d{1,2}$/;
const cell = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());

/** "N.Sci Bio - Ms P.Anh" → môn + GV (tách ở dấu " - " CUỐI để môn có thể chứa dấu gạch). */
export function splitSubjectTeacher(raw: string): { subject: string; teacherName: string } {
  const text = cell(raw);
  const i = text.lastIndexOf(' - ');
  if (i < 0) return { subject: text, teacherName: '' };
  return { subject: text.slice(0, i).trim(), teacherName: text.slice(i + 3).trim() };
}

function dayFromHeader(v: string): number | null {
  const m = v.match(/^Th[ứu]\s*([2-7])$/i);
  return m ? Number(m[1]) : null;
}

export function parseSchoolTimetable(rows: unknown[][]): ParsedTimetable {
  const classes: Record<string, ScheduleSlot[]> = {};
  const warnings: string[] = [];
  let academicYear: string | null = null;
  let semester: number | null = null;

  let current: { classId: string; dayCols: Array<{ col: number; day: number }>; session: 'morning' | 'afternoon' | null; seen: Set<string> } | null = null;

  rows.forEach((row, r) => {
    const cells = (row || []).map(cell);
    const joined = cells.join(' ');
    if (!academicYear) {
      const y = joined.match(/(20\d{2})\s*[-–]\s*(20\d{2})/);
      if (y && /năm học/i.test(joined)) academicYear = `${y[1]}-${y[2]}`;
    }
    if (semester == null && /TKB\s*HK\s*II\b|HKII\b/i.test(joined)) semester = 2;
    else if (semester == null && /TKB\s*HK\s*I\b|HKI\b/i.test(joined)) semester = 1;

    // Dòng tiêu đề lớp: có mã lớp và các ô "Thứ N"
    const dayCols = cells.map((c, col) => ({ col, day: dayFromHeader(c) })).filter((x): x is { col: number; day: number } => x.day != null);
    const classCell = cells.find((c) => CLASS_RE.test(c.toUpperCase()));
    if (classCell && dayCols.length >= 3) {
      const classId = classCell.toUpperCase();
      if (classes[classId]) warnings.push(`Lớp ${classId} xuất hiện nhiều lần (dòng ${r + 1}) — dùng khối sau cùng.`);
      classes[classId] = [];
      current = { classId, dayCols, session: null, seen: new Set() };
      return;
    }
    if (!current) return;

    // Dòng tiết: buổi (Sáng/Chiều, có thể để trống = giữ buổi trước) + số tiết trong buổi
    if (cells.some((c) => /^s[áa]ng$/i.test(c))) current.session = 'morning';
    if (cells.some((c) => /^chi[ềe]u$/i.test(c))) current.session = 'afternoon';
    const firstDayCol = Math.min(...current.dayCols.map((d) => d.col));
    const numCell = cells.slice(0, firstDayCol).map(Number).find((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    if (!numCell || !current.session) return;
    const periodIndex = current.session === 'afternoon' ? 4 + numCell : numCell;
    if (periodIndex > 8) {
      warnings.push(`Lớp ${current.classId}: tiết ${numCell} buổi chiều vượt quá 8 tiết/ngày (dòng ${r + 1}) — bỏ qua.`);
      return;
    }

    for (const { col, day } of current.dayCols) {
      const raw = cells[col];
      if (!raw) continue;
      const key = `${day}_${periodIndex}`;
      if (current.seen.has(key)) {
        warnings.push(`Lớp ${current.classId}: trùng Thứ ${day} tiết ${periodIndex} (dòng ${r + 1}).`);
        continue;
      }
      current.seen.add(key);
      const { subject, teacherName } = splitSubjectTeacher(raw);
      if (!teacherName) warnings.push(`Lớp ${current.classId} Thứ ${day} tiết ${periodIndex}: "${raw}" không có tên GV.`);
      classes[current.classId].push({ dayOfWeek: day, periodIndex, subject, teacherName, teacherUsername: '', room: `P.${current.classId}` });
    }
  });

  for (const id of Object.keys(classes)) {
    classes[id].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.periodIndex - b.periodIndex);
    if (classes[id].length === 0) warnings.push(`Lớp ${id} không có tiết nào.`);
  }
  return { classes, academicYear, semester, warnings };
}

/** Gắn tài khoản GV theo "tên trên TKB" (khai trong Hồ sơ phép). Không khớp → để trống. */
export function attachTeacherAccounts(slots: ScheduleSlot[], aliasToUsername: Map<string, string>): ScheduleSlot[] {
  const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  const map = new Map([...aliasToUsername].map(([k, v]) => [norm(k), v]));
  return slots.map((s) => ({ ...s, teacherUsername: map.get(norm(s.teacherName)) || s.teacherUsername || '' }));
}

/**
 * Tạo map "${dayOfWeek}_${periodIndex}" → { subject, teacherName, teacherUsername }
 * từ danh sách slots để Firestore Security Rules tra cứu quyền ghi tiết trực tiếp.
 */
export function buildSlotMap(
  slots: ScheduleSlot[],
  aliasToUsername?: Map<string, string>
): Record<string, ScheduleSlotMapItem> {
  const resolved = aliasToUsername ? attachTeacherAccounts(slots, aliasToUsername) : slots;
  const out: Record<string, ScheduleSlotMapItem> = {};
  for (const s of resolved) {
    out[`${s.dayOfWeek}_${s.periodIndex}`] = {
      subject: s.subject || '',
      teacherName: (s.teacherName || '').trim(),
      teacherUsername: (s.teacherUsername || '').trim(),
    };
  }
  return out;
}


/** So TKB mới với TKB đang dùng của 1 lớp. */
export function diffClassSchedule(oldSlots: ScheduleSlot[] = [], newSlots: ScheduleSlot[]) {
  const key = (s: ScheduleSlot) => `${s.dayOfWeek}_${s.periodIndex}`;
  const sig = (s: ScheduleSlot) => `${s.subject}|${s.teacherName}`;
  const oldMap = new Map(oldSlots.map((s) => [key(s), sig(s)]));
  const newMap = new Map(newSlots.map((s) => [key(s), sig(s)]));
  let changed = 0, added = 0, removed = 0;
  for (const [k, v] of newMap) {
    if (!oldMap.has(k)) added++;
    else if (oldMap.get(k) !== v) changed++;
  }
  for (const k of oldMap.keys()) if (!newMap.has(k)) removed++;
  return { changed, added, removed, total: changed + added + removed };
}

// ---------------------------------------------------------------------------
// Thay đổi chi tiết từng tiết + bản tin thông báo
// ---------------------------------------------------------------------------

export interface SlotCell {
  subject: string;
  teacherName: string;
}

/** 1 tiết thay đổi. before = null → tiết mới thêm; after = null → tiết bị bỏ. */
export interface ScheduleChange {
  dayOfWeek: number;
  periodIndex: number;
  before: SlotCell | null;
  after: SlotCell | null;
}

const toCell = (s: ScheduleSlot): SlotCell => ({ subject: s.subject, teacherName: s.teacherName });

export function listScheduleChanges(oldSlots: ScheduleSlot[] = [], newSlots: ScheduleSlot[]): ScheduleChange[] {
  const key = (s: { dayOfWeek: number; periodIndex: number }) => s.dayOfWeek * 10 + s.periodIndex;
  const oldMap = new Map(oldSlots.map((s) => [key(s), s]));
  const newMap = new Map(newSlots.map((s) => [key(s), s]));
  const keys = [...new Set([...oldMap.keys(), ...newMap.keys()])].sort((a, b) => a - b);
  const out: ScheduleChange[] = [];
  for (const k of keys) {
    const o = oldMap.get(k);
    const n = newMap.get(k);
    if (o && n && o.subject === n.subject && o.teacherName === n.teacherName) continue;
    out.push({ dayOfWeek: Math.floor(k / 10), periodIndex: k % 10, before: o ? toCell(o) : null, after: n ? toCell(n) : null });
  }
  return out;
}

/** Giữ tài khoản GV đã gắn ở TKB cũ nếu tên trên TKB không đổi. */
export function carryTeacherAccounts(newSlots: ScheduleSlot[], oldSlots: ScheduleSlot[] = []): ScheduleSlot[] {
  const known = new Map(oldSlots.filter((s) => s.teacherUsername).map((s) => [s.teacherName, s.teacherUsername]));
  return newSlots.map((s) => (s.teacherUsername ? s : { ...s, teacherUsername: known.get(s.teacherName) || '' }));
}

const DAY_LABEL: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };
const cellText = (c: SlotCell | null) => (c ? (c.teacherName ? `${c.subject} (${c.teacherName})` : c.subject) : 'trống');

/** "Thứ 3 – tiết 2: Maths (Ms B) → Lit (Ms A)" */
export function describeChange(c: ScheduleChange): string {
  return `${DAY_LABEL[c.dayOfWeek] ?? `Thứ ${c.dayOfWeek}`} – tiết ${c.periodIndex}: ${cellText(c.before)} → ${cellText(c.after)}`;
}

/** Ngày áp dụng lấy từ tên file kiểu "TKB 12_10 VER2.xls" → "12/10". */
export function effectiveDateFromFileName(fileName: string): string | null {
  const m = fileName.match(/(?:^|\D)(\d{1,2})[_.\-/](\d{1,2})(?:\D|$)/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}` : null;
}

export function buildClassNotice(classId: string, changes: ScheduleChange[], effective: string | null) {
  const when = effective ? ` từ ${effective}` : '';
  return {
    title: `Lớp ${classId}: thời khóa biểu thay đổi ${changes.length} tiết${when}`,
    body: [`Thời khóa biểu lớp ${classId} được cập nhật${when}. Các tiết thay đổi:`, ...changes.map((c) => `• ${describeChange(c)}`), '', 'Xem TKB đầy đủ trong mục Thời khóa biểu.'].join('\n'),
  };
}

export function buildAdminNotice(changesByClass: Record<string, ScheduleChange[]>, totalClasses: number, effective: string | null) {
  const changed = Object.entries(changesByClass).filter(([, v]) => v.length > 0);
  const total = changed.reduce((n, [, v]) => n + v.length, 0);
  const when = effective ? ` từ ${effective}` : '';
  const teachers = new Set(changed.flatMap(([, v]) => v.flatMap((c) => [c.before?.teacherName, c.after?.teacherName])).filter((t): t is string => !!t));
  const lines = changed.map(([cls, v]) => `• ${cls}: ${v.length} tiết — ${v.map((c) => `${DAY_LABEL[c.dayOfWeek]} T${c.periodIndex}`).join(', ')}`);
  return {
    title: `Cập nhật TKB${when}: ${total} tiết thay đổi ở ${changed.length}/${totalClasses} lớp`,
    body: [
      `Đã cập nhật thời khóa biểu cho ${totalClasses} lớp${when}.`,
      `${changed.length} lớp có thay đổi, tổng ${total} tiết. ${teachers.size} GV liên quan: ${[...teachers].sort().join(', ')}.`,
      '',
      ...lines,
    ].join('\n'),
  };
}
