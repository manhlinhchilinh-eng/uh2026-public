/**
 * Xếp hạng thi đua theo quy chế TPT (05/11/2026). Hàm thuần — không gọi Firebase.
 *
 * Quy chế (TPT Long):
 *  - Điểm thi đua = (Điểm sổ đầu bài × 2 + Điểm sổ cờ đỏ) / 3.
 *  - Sổ đầu bài (SĐB) tính theo ngày, tối đa 80đ/ngày (8 tiết × 10). Chiều thứ 6 không chấm (tối đa 40đ, tính nửa ngày)
 *    → tối đa 360đ/tuần. Điểm tuần/tháng = trung bình theo ngày (thang 80): tổng điểm các ngày / số ngày (thứ 6 = 0,5).
 *  - Tiết NN2, Native, lớp chia phòng K9 (Văn/Toán test prep), Eng 1 khối 9: mặc định 10đ (GV không chấm vẫn cộng 10).
 *  - Ngày nghỉ (lịch nghỉ) loại khỏi mẫu số.
 * Quyết định của người dùng (05/11):
 *  - Thang SĐB = trung bình ngày (tối đa 80). Cờ đỏ quy về cùng thang 80.
 *  - Điểm ngày = TỔNG điểm thực các tiết đã học (tiết chưa ký = 0đ, không trừ thêm −2đ), tối đa 80; ghi nhận
 *    tiết chưa ký là trách nhiệm của GV bộ môn. (Sửa 05/11 chiều: trước đây bỏ tiết chưa ký khỏi mẫu số → lớp ký
 *    4/8 tiết vẫn được 80, không thực tế.) Tính từ SDB_START_DATE (04/11/2026).
 *  - Chưa có điểm cờ đỏ: xếp hạng tạm theo SĐB, ghi rõ trên giao diện.
 */

import type { PeriodEntry } from '../types/logbook';
import type { ClassSchedule } from '../types/schedule';
import { normAlias } from './teacherAssignment';
import { DEFAULT_MIXED_RULES } from './mixedPeriods';

export const SDB_DAY_MAX = 80;
export const PERIOD_MAX = 10;
/** Thứ 6 chỉ chấm buổi sáng (tiết 1–4) */
export const FRIDAY = 6;
export const FRIDAY_LAST_PERIOD = 4;

/** Môn tính mặc định 10đ. grade null = mọi khối. So tên đã chuẩn hóa. */
export interface Default10Rule {
  subject: string;
  grade: number | null;
  /** true = mọi môn BẮT ĐẦU bằng tên này (vd. "Native" → Native 1, Native 2) */
  prefix?: boolean;
}

/** Lấy từ danh sách chung DEFAULT_MIXED_RULES (utils/mixedPeriods) — không khai riêng ở đây nữa. */
export const DEFAULT10_RULES: Default10Rule[] = DEFAULT_MIXED_RULES.filter((r) => r.mode === 'auto10').map((r) => ({ subject: r.subject, grade: r.grade }));

const gradeOf = (classId: string) => Number(classId.match(/^(\d)/)?.[1] ?? 0);

export function isDefault10(classId: string, subject: string, rules: Default10Rule[] = DEFAULT10_RULES): boolean {
  const s = normAlias(subject);
  if (!s) return false;
  const g = gradeOf(classId);
  return rules.some((r) => {
    const k = normAlias(r.subject);
    return (r.grade == null || r.grade === g) && (r.prefix ? s.startsWith(k) : s === k);
  });
}

/** Thứ theo quy ước app (2 = Thứ Hai … 8 = CN) */
export function dowOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 8 : wd + 1;
}

/** Các ngày học (T2–T6, không nằm trong ngày nghỉ) trong [start, end] */
export function schoolDays(start: string, end: string, holidays: string[] = []): string[] {
  const off = new Set(holidays);
  const out: string[] = [];
  const [y, m, d] = start.split('-').map(Number);
  for (let t = Date.UTC(y, m - 1, d); ; t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (iso > end) break;
    const dow = dowOf(iso);
    if (dow >= 2 && dow <= 6 && !off.has(iso)) out.push(iso);
  }
  return out;
}

export interface ForgottenPeriod {
  date: string;
  classId: string;
  periodIndex: number;
  subject: string;
  /** Tên GV trên TKB (trách nhiệm ký sổ) */
  teacherName: string;
}

export interface DayScore {
  date: string;
  /** Điểm ngày (thang 80; thứ 6 tối đa 40) */
  score: number;
  max: number;
  /** 1 = ngày đủ, 0,5 = thứ 6 */
  weight: number;
  signed: number;
  default10: number;
  /** Tiết đã qua giờ nhưng chưa ký (không tính cho lớp) */
  unsigned: number;
}

export interface ClassSdb {
  classId: string;
  grade: number;
  days: DayScore[];
  /** Điểm SĐB trung bình ngày (thang 80), null nếu chưa có ngày nào tính được */
  sdb: number | null;
  /** Tổng điểm các ngày và tối đa tương ứng (vd. 312/360) */
  total: number;
  totalMax: number;
  forgotten: ForgottenPeriod[];
}

/** Ngày bắt đầu tính thi đua từ sổ đầu bài thật (người dùng chốt 05/11/2026: dữ liệu ký sổ thật bắt đầu 04/11). */
export const SDB_START_DATE = '2026-11-04';

export interface SdbInput {
  start: string;
  end: string;
  holidays: string[];
  classIds: string[];
  schedules: Record<string, Pick<ClassSchedule, 'slots'> | undefined>;
  periodsByDaily: Record<string, PeriodEntry[]>;
  /** Tiết (ngày, tiết) đã kết thúc chưa — tiết chưa học không tính. Mặc định: mọi tiết đã qua. */
  isPeriodOver?: (date: string, periodIndex: number) => boolean;
  default10Rules?: Default10Rule[];
  /** Không tính ngày trước mốc này (mặc định SDB_START_DATE) */
  startFloor?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Điểm 1 tiết đã ký (tổng 4 tiêu chí, kẹp 0..10) */
const periodScore = (p: PeriodEntry) => Math.max(0, Math.min(PERIOD_MAX, Number(p.scores?.total) || 0));

export function computeClassSdb(classId: string, input: SdbInput): ClassSdb {
  const slots = input.schedules[classId]?.slots || [];
  const days: DayScore[] = [];
  const forgotten: ForgottenPeriod[] = [];
  const over = input.isPeriodOver ?? (() => true);

  const from = input.start > (input.startFloor ?? SDB_START_DATE) ? input.start : input.startFloor ?? SDB_START_DATE;
  for (const date of schoolDays(from, input.end, input.holidays)) {
    const dow = dowOf(date);
    const isFri = dow === FRIDAY;
    const daySlots = slots
      .filter((s) => s.dayOfWeek === dow && (s.subject || '').trim() && (!isFri || s.periodIndex <= FRIDAY_LAST_PERIOD))
      .sort((a, b) => a.periodIndex - b.periodIndex);
    if (daySlots.length === 0) continue;
    const entries = input.periodsByDaily[`${classId}_${date}`] || [];
    let sum = 0;
    let max = 0;
    let signed = 0;
    let def10 = 0;
    let unsigned = 0;
    for (const s of daySlots) {
      const e = entries.find((p) => p.periodIndex === s.periodIndex);
      // Tiết chưa học (hôm nay, chưa hết giờ) và chưa ký: chưa tính vào cả điểm lẫn tối đa
      if (!e?.isSigned && !over(date, s.periodIndex)) continue;
      max += PERIOD_MAX;
      if (isDefault10(classId, s.subject, input.default10Rules)) {
        sum += PERIOD_MAX;
        def10++;
      } else if (e?.isSigned) {
        sum += periodScore(e);
        signed++;
      } else {
        // Đã qua giờ mà GV chưa ký: lớp được 0 điểm tiết đó (không trừ thêm), ghi nhận trách nhiệm GV bộ môn
        unsigned++;
        forgotten.push({ date, classId, periodIndex: s.periodIndex, subject: s.subject, teacherName: (s.teacherName || '').trim() });
      }
    }
    if (max === 0) continue; // ngày chưa có tiết nào đã học
    // Điểm ngày = TỔNG điểm thực các tiết (tối đa 10/tiết → 80/ngày, thứ 6 sáng 40)
    days.push({ date, score: round2(sum), max, weight: max / SDB_DAY_MAX, signed, default10: def10, unsigned });
  }

  const total = round2(days.reduce((a, d) => a + d.score, 0));
  const totalMax = days.reduce((a, d) => a + d.max, 0);
  const w = days.reduce((a, d) => a + d.weight, 0);
  // SĐB (thang 80) = tổng điểm / tổng tối đa × 80 — tương đương trung bình ngày (thứ 6 sáng = nửa ngày)
  return { classId, grade: gradeOf(classId), days, sdb: w > 0 ? round2((total / totalMax) * SDB_DAY_MAX) : null, total, totalMax, forgotten };
}

/** Điểm cờ đỏ đã nhập (thang tùy TPT) → quy về thang 80 */
export const redFlagTo80 = (score: number, maxScore: number) => (maxScore > 0 ? round2((Math.max(0, Math.min(score, maxScore)) / maxScore) * SDB_DAY_MAX) : null);

export interface RankedRow extends ClassSdb {
  /** Điểm cờ đỏ (thang 80), null = chờ TPT nhập */
  redFlag: number | null;
  /** (SĐB × 2 + Cờ đỏ) / 3; chưa có cờ đỏ → bằng SĐB (xếp hạng tạm) */
  score: number | null;
  provisional: boolean;
  rank: number | null;
}

/** Thi đua = (SĐB×2 + Cờ đỏ)/3. Không có cờ đỏ → tạm = SĐB. Xếp hạng giảm dần, bằng điểm đồng hạng. */
export function rankTpt(rows: ClassSdb[], redFlag80: Record<string, number | null | undefined>): RankedRow[] {
  const withScore = rows.map((r) => {
    const rf = redFlag80[r.classId] ?? null;
    const score = r.sdb == null ? null : rf == null ? r.sdb : round2((r.sdb * 2 + rf) / 3);
    return { ...r, redFlag: rf, score, provisional: rf == null, rank: null as number | null };
  });
  const scored = withScore.filter((r) => r.score != null).sort((a, b) => b.score! - a.score! || a.classId.localeCompare(b.classId, 'vi', { numeric: true }));
  scored.forEach((r, i) => {
    r.rank = i > 0 && scored[i - 1].score === r.score ? scored[i - 1].rank : i + 1;
  });
  const rest = withScore.filter((r) => r.score == null).sort((a, b) => a.classId.localeCompare(b.classId, 'vi', { numeric: true }));
  return [...scored, ...rest];
}

/** Gom tiết quên ký theo GV (trách nhiệm GV bộ môn — dùng xét GV sau này) */
export function forgottenByTeacher(rows: Array<Pick<ClassSdb, 'forgotten'>>): Array<{ teacherName: string; count: number; items: ForgottenPeriod[] }> {
  const m = new Map<string, ForgottenPeriod[]>();
  for (const r of rows) for (const f of r.forgotten) m.set(f.teacherName || '(chưa có tên trên TKB)', [...(m.get(f.teacherName || '(chưa có tên trên TKB)') || []), f]);
  return [...m]
    .map(([teacherName, items]) => ({ teacherName, count: items.length, items: items.sort((a, b) => a.date.localeCompare(b.date) || a.periodIndex - b.periodIndex) }))
    .sort((a, b) => b.count - a.count || a.teacherName.localeCompare(b.teacherName, 'vi'));
}

/** Mã tuần = Thứ Hai của tuần (yyyy-mm-dd) */
export function weekStartOf(iso: string): string {
  const dow = dowOf(iso); // 2..8
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - (dow - 2) * 86_400_000).toISOString().slice(0, 10);
}

export interface RedFlagWeekly {
  id: string; // `${weekStart}_${classId}`
  weekStart: string;
  classId: string;
  score: number;
  maxScore: number;
  note?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: number;
}

/** Điểm cờ đỏ (thang 80) của mỗi lớp trong khoảng: trung bình các tuần có nhập */
export function redFlagForRange(docs: RedFlagWeekly[], weekStarts: string[]): Record<string, number> {
  const ws = new Set(weekStarts);
  const acc = new Map<string, number[]>();
  for (const d of docs) {
    if (!ws.has(d.weekStart)) continue;
    const v = redFlagTo80(d.score, d.maxScore);
    if (v != null) acc.set(d.classId, [...(acc.get(d.classId) || []), v]);
  }
  return Object.fromEntries([...acc].map(([k, v]) => [k, round2(v.reduce((a, b) => a + b, 0) / v.length)]));
}

/** Các mã tuần (Thứ Hai) giao với khoảng [start, end] */
export function weekStartsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const [y, m, d] = weekStartOf(start).split('-').map(Number);
  for (let t = Date.UTC(y, m - 1, d); ; t += 7 * 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (iso > end) break;
    out.push(iso);
  }
  return out;
}

/** Đọc bảng dán từ Excel: mỗi dòng "Lớp<tab>Điểm" (hoặc dấu phẩy/chấm phẩy). Bỏ dòng tiêu đề/không hợp lệ. */
export function parseRedFlagPaste(text: string, knownClasses: string[], maxScore: number): { rows: Array<{ classId: string; score: number }>; errors: string[] } {
  const known = new Set(knownClasses.map((c) => c.toUpperCase()));
  const rows: Array<{ classId: string; score: number }> = [];
  const errors: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // Cột cách nhau bằng Tab (dán từ Excel) hoặc ";" — dấu phẩy là dấu thập phân (88,5). Không có thì tách ở khoảng trắng đầu tiên.
    const parts = /[\t;]/.test(line) ? line.split(/[\t;]/) : line.split(/\s+/);
    const [c, s] = parts.map((x) => x.trim());
    const classId = (c || '').toUpperCase();
    if (!known.has(classId)) {
      if (/\d/.test(s || '') && /\d[A-Z]\d/i.test(classId)) errors.push(`Không có lớp "${c}"`);
      continue;
    }
    const score = Number((s || '').replace(',', '.'));
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
      errors.push(`${classId}: điểm "${s}" không hợp lệ (0–${maxScore})`);
      continue;
    }
    rows.push({ classId, score });
  }
  return { rows, errors };
}

// ───────────────────────── Sổ cờ đỏ theo NGÀY (Sổ Sao Đỏ GUMS, 05/11 tối) ─────────────────────────
// Mỗi lớp 100 điểm/tuần, trừ theo lỗi từng ngày (file "GUMS - Sổ Sao Đỏ"). Lưu /red_flag_daily/{date}: 1 doc/ngày
// chứa mọi lớp (lớp không lỗi = trừ 0) → tuần đọc ≤ 5 doc, tháng ≤ 23 doc. Không lưu tên học sinh.
//  - Điểm ngày  = 100 − điểm trừ trong ngày (quy về thang 80).
//  - Điểm tuần  = 100 − tổng điểm trừ các ngày đã nhập trong tuần (thang 80). Tuần không có dữ liệu ngày → dùng
//                 điểm tuần nhập tay (/red_flag_weekly) nếu có.
//  - Điểm tháng = trung bình điểm các tuần có dữ liệu.

export const RED_FLAG_WEEK_BASE = 100;

export interface RedFlagViolation {
  /** Lỗi vi phạm (vd. "Đi học muộn") */
  v: string;
  /** Điểm trừ */
  p: number;
  /** Số lần */
  n: number;
}

export interface RedFlagClassDay {
  /** Tổng điểm trừ trong ngày */
  d: number;
  /** Số lượt vi phạm */
  n: number;
  items: RedFlagViolation[];
}

export interface RedFlagDaily {
  id: string; // = date
  date: string;
  weekStart: string;
  classes: Record<string, RedFlagClassDay>;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: number;
}

const base100To80 = (v: number) => round2((Math.max(0, Math.min(RED_FLAG_WEEK_BASE, v)) / RED_FLAG_WEEK_BASE) * SDB_DAY_MAX);

/** Điểm cờ đỏ 1 ngày (thang 80) của các lớp có trong sổ ngày đó */
export function redFlagForDay(daily: RedFlagDaily[], date: string): Record<string, number> {
  const doc = daily.find((d) => d.date === date);
  if (!doc) return {};
  return Object.fromEntries(Object.entries(doc.classes).map(([c, x]) => [c, base100To80(RED_FLAG_WEEK_BASE - (Number(x.d) || 0))]));
}

/** Điểm cờ đỏ 1 tuần (thang 80): ưu tiên sổ theo ngày (100 − tổng trừ), không có → điểm tuần nhập tay */
export function redFlagForWeek(weekly: RedFlagWeekly[], daily: RedFlagDaily[], weekStart: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of weekly) {
    if (w.weekStart !== weekStart) continue;
    const v = redFlagTo80(w.score, w.maxScore);
    if (v != null) out[w.classId] = v;
  }
  const ded = new Map<string, number>();
  for (const d of daily) {
    if (d.weekStart !== weekStart) continue;
    for (const [c, x] of Object.entries(d.classes)) ded.set(c, (ded.get(c) || 0) + (Number(x.d) || 0));
  }
  for (const [c, total] of ded) out[c] = base100To80(RED_FLAG_WEEK_BASE - total);
  return out;
}

/** Điểm cờ đỏ (thang 80) của mỗi lớp trong khoảng: trung bình các tuần có dữ liệu (ngày hoặc tuần nhập tay) */
export function redFlagForWeeks(weekly: RedFlagWeekly[], daily: RedFlagDaily[], weekStarts: string[]): Record<string, number> {
  const acc = new Map<string, number[]>();
  for (const ws of weekStarts) for (const [c, v] of Object.entries(redFlagForWeek(weekly, daily, ws))) acc.set(c, [...(acc.get(c) || []), v]);
  return Object.fromEntries([...acc].map(([k, v]) => [k, round2(v.reduce((a, b) => a + b, 0) / v.length)]));
}

/** Tổng điểm trừ + số lượt vi phạm của lớp trong các ngày đang xem */
export function redFlagDeductions(daily: RedFlagDaily[], dates?: Set<string>): Record<string, { d: number; n: number }> {
  const out: Record<string, { d: number; n: number }> = {};
  for (const doc of daily) {
    if (dates && !dates.has(doc.date)) continue;
    for (const [c, x] of Object.entries(doc.classes)) {
      const cur = out[c] || { d: 0, n: 0 };
      out[c] = { d: round2(cur.d + (Number(x.d) || 0)), n: cur.n + (Number(x.n) || 0) };
    }
  }
  return out;
}

export interface DayRank {
  sdb: number | null;
  redFlag: number | null;
  score: number | null;
  rank: number | null;
  provisional: boolean;
}

/** Xếp hạng từng ngày: SĐB ngày (quy thang 80) × 2 + cờ đỏ ngày, /3. Trả về date → classId → hạng. */
export function dailyRanks(rows: ClassSdb[], daily: RedFlagDaily[]): Record<string, Record<string, DayRank>> {
  const dates = [...new Set(rows.flatMap((r) => r.days.map((d) => d.date)))].sort();
  const out: Record<string, Record<string, DayRank>> = {};
  for (const date of dates) {
    const pseudo: ClassSdb[] = rows.map((r) => {
      const d = r.days.find((x) => x.date === date);
      return { ...r, days: d ? [d] : [], sdb: d && d.max > 0 ? round2((d.score / d.max) * SDB_DAY_MAX) : null, total: d?.score ?? 0, totalMax: d?.max ?? 0, forgotten: [] };
    });
    out[date] = Object.fromEntries(
      rankTpt(pseudo, redFlagForDay(daily, date)).map((r) => [r.classId, { sdb: r.sdb, redFlag: r.redFlag, score: r.score, rank: r.rank, provisional: r.provisional }])
    );
  }
  return out;
}
