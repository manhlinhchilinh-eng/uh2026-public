/**
 * Sổ điểm môn học (bản của trường, trước khi đưa lên CSDL ngành). Hàm thuần — không gọi Firebase.
 *
 * Firestore:
 *  - grade_assignments/{năm}_{lớp}_{môn}       — ai được nhập điểm lớp-môn nào (BGH dựng từ TKB, sửa tay)
 *  - gradebooks/{năm}_HK{hk}_{lớp}_{môn}       — 1 doc / lớp / môn / HK, `rows[mhs]` = điểm từng HS
 *  - gradebooks/{id}/history/{auto}            — lịch sử sửa (chỉ thêm)
 *  - grade_reports/{năm}_HK{hk}_{mhs}          — bản công bố cho PH/HS (chỉ chứa điểm của 1 HS)
 */

import { formatGrade, termResult, type GradeValue, type SubjectMode, type TermResult } from './gradeCalc';
import { buildAliasIndex, normAlias, type TeacherAliasDoc } from './teacherAssignment';
import type { ClassSchedule } from '../types/schedule';

/**
 * Số cột ĐĐGtx tối đa một dòng điểm có thể giữ. Số cột hiển thị/nhập theo từng môn (`SubjectDef.txSlots`, mẫu học bạ
 * của trường: Toán/Văn/NN/KHTN/LS&ĐL 4 · Công nghệ 3 · GDCD/Tin 2 · môn nhận xét 2). Sổ cũ lưu mảng 5 ô vẫn đọc được:
 * điểm nằm ngoài số cột của môn không bị xóa (xem `normalizeRow`).
 */
export const TX_SLOTS_MAX = 5;
export const GRADEBOOK_MAX_ROWS = 80;

export interface SubjectDef {
  key: string;
  name: string;
  nameEn: string;
  mode: SubjectMode;
  /** Số lần ĐGtx bắt buộc — bằng số cột ĐĐGtx của môn trên mẫu học bạ (người dùng chốt 05/11/2026) */
  txMin: number;
  /** Số cột ĐĐGtx trên lưới nhập / Excel / học bạ */
  txSlots: number;
}

/** Các môn THCS (CT GDPT 2018). Môn lạ trong TKB → `subjectFromTimetable` tạo khóa riêng, mặc định điểm số. */
export const SUBJECTS: readonly SubjectDef[] = [
  { key: 'toan', name: 'Toán', nameEn: 'Mathematics', mode: 'score', txMin: 4, txSlots: 4 },
  { key: 'ngu_van', name: 'Ngữ văn', nameEn: 'Literature', mode: 'score', txMin: 4, txSlots: 4 },
  { key: 'ngoai_ngu_1', name: 'Ngoại ngữ 1 (Tiếng Anh)', nameEn: 'English', mode: 'score', txMin: 4, txSlots: 4 },
  { key: 'ngoai_ngu_2', name: 'Ngoại ngữ 2', nameEn: 'Second Foreign Language', mode: 'score', txMin: 4, txSlots: 4 },
  { key: 'gdcd', name: 'Giáo dục công dân', nameEn: 'Civic Education', mode: 'score', txMin: 2, txSlots: 2 },
  { key: 'cong_nghe', name: 'Công nghệ', nameEn: 'Technology', mode: 'score', txMin: 3, txSlots: 3 },
  { key: 'tin_hoc', name: 'Tin học', nameEn: 'Informatics', mode: 'score', txMin: 2, txSlots: 2 },
  { key: 'khtn', name: 'Khoa học tự nhiên', nameEn: 'Natural Science', mode: 'score', txMin: 4, txSlots: 4 },
  { key: 'lich_su_dia_li', name: 'Lịch sử và Địa lí', nameEn: 'History & Geography', mode: 'score', txMin: 4, txSlots: 4 },
  { key: 'gdtc', name: 'Giáo dục thể chất', nameEn: 'Physical Education', mode: 'comment', txMin: 2, txSlots: 2 },
  { key: 'am_nhac', name: 'Nghệ thuật (Âm nhạc)', nameEn: 'Arts (Music)', mode: 'comment', txMin: 2, txSlots: 2 },
  { key: 'mi_thuat', name: 'Nghệ thuật (Mĩ thuật)', nameEn: 'Arts (Fine Arts)', mode: 'comment', txMin: 2, txSlots: 2 },
  { key: 'hdtn', name: 'Hoạt động trải nghiệm, hướng nghiệp', nameEn: 'Experiential Activities', mode: 'comment', txMin: 2, txSlots: 2 },
  { key: 'gddp', name: 'Nội dung giáo dục địa phương', nameEn: 'Local Education', mode: 'comment', txMin: 2, txSlots: 2 },
];

const SUBJECT_BY_KEY = new Map(SUBJECTS.map((s) => [s.key, s]));

const fold = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Nhận diện tên môn trên TKB. TKB của trường ghi tiếng Anh ("Maths", "Eng 1", "N.Sci Bio", "S.Sci His"…), file cũ ghi tiếng Việt
 * ("Anh", "Văn", "LS&ĐL", "KHTN-Lý"). Tiết không có trên CSDL ngành → null: Chào cờ/SHL, môn riêng của trường
 * (UMS maths/literature, test prep, Native, Public Speaking, ESL, CRC).
 */
const SUBJECT_PATTERNS: Array<[RegExp, string | null]> = [
  [/\b(chao co|sinh hoat|shl|shcn|cc)\b/, null],
  [/\b(test prep|ums maths?|ums literature|native \d*|public speaking|esl|crc)\b/, null],
  [/\bhomeroom\b/, 'hdtn'],
  [/\b(n scie?|natural science)\b/, 'khtn'],
  [/\b(s sci|social science|history|geography)\b/, 'lich_su_dia_li'],
  [/\bcivics?\b/, 'gdcd'],
  [/\btechnology\b/, 'cong_nghe'],
  [/\b(computer|informatics|ict)\b/, 'tin_hoc'],
  [/\b(physical|pe)\b/, 'gdtc'],
  [/\bmusic\b/, 'am_nhac'],
  [/\b(fine art|art|arts)\b/, 'mi_thuat'],
  [/\b(maths?|mathematics)\b/, 'toan'],
  [/\bliterature\b/, 'ngu_van'],
  [/\b(foreign language 2|second language)\b/, 'ngoai_ngu_2'],
  [/\b(dia phuong|gddp)\b/, 'gddp'],
  [/\b(hdtn|trai nghiem|huong nghiep)\b/, 'hdtn'],
  [/\b(khtn|khoa hoc tu nhien|ly|vat ly|hoa|hoa hoc|sinh|sinh hoc)\b/, 'khtn'],
  [/\b(lich su|dia|dia li|dia ly|su|ls|lsdl|ls dl)\b/, 'lich_su_dia_li'],
  [/\b(gdcd|cong dan)\b/, 'gdcd'],
  [/\b(cong nghe|cn)\b/, 'cong_nghe'],
  [/\b(tin|tin hoc)\b/, 'tin_hoc'],
  [/\b(gdtc|the duc|td)\b/, 'gdtc'],
  [/\b(am nhac|nhac|an)\b/, 'am_nhac'],
  [/\b(mi thuat|my thuat|mt)\b/, 'mi_thuat'],
  [/\b(toan)\b/, 'toan'],
  [/\b(van|ngu van)\b/, 'ngu_van'],
  [/\b(ngoai ngu 2|nn2|tieng (phap|duc|nhat|han|trung|nga))\b/, 'ngoai_ngu_2'],
  [/\b(anh|tieng anh|t anh|ta|eng|english|ngoai ngu)\b/, 'ngoai_ngu_1'],
];

/** Môn trên TKB → môn sổ điểm. Môn không nhận diện được vẫn có khóa riêng (BGH sửa tên/kiểu sau). */
export function subjectFromTimetable(raw: string): SubjectDef | null {
  const f = fold(raw);
  if (!f) return null;
  for (const [re, key] of SUBJECT_PATTERNS) {
    if (re.test(f)) return key ? SUBJECT_BY_KEY.get(key)! : null;
  }
  return { key: f.replace(/ /g, '_').slice(0, 30), name: raw.trim(), nameEn: raw.trim(), mode: 'score', txMin: 2, txSlots: 2 };
}

export function subjectByKey(key: string): SubjectDef | undefined {
  return SUBJECT_BY_KEY.get(key);
}

/** Thứ tự môn như mẫu học bạ (Toán, Ngữ văn, NN1, NN2, GDCD, Công nghệ, Tin, KHTN, LS&ĐL, GDTC, Nghệ thuật, HĐTN, GDĐP); môn lạ xếp cuối. */
const REPORT_ORDER = ['toan', 'ngu_van', 'ngoai_ngu_1', 'ngoai_ngu_2', 'gdcd', 'cong_nghe', 'tin_hoc', 'khtn', 'lich_su_dia_li', 'gdtc', 'am_nhac', 'mi_thuat', 'hdtn', 'gddp'];
export function subjectOrder(key: string): number {
  const i = REPORT_ORDER.indexOf(key);
  return i < 0 ? REPORT_ORDER.length : i;
}
export function compareSubjects(a: { key: string; name: string }, b: { key: string; name: string }): number {
  return subjectOrder(a.key) - subjectOrder(b.key) || a.name.localeCompare(b.name, 'vi');
}

/**
 * Số cột ĐĐGtx và số lần bắt buộc của một sổ/phân công. Môn chuẩn lấy theo `SUBJECTS` (không phụ thuộc `txMin` đã lưu
 * trên Firestore từ trước 05/11 — vd. Công nghệ 2 → 3, GDTC 3 → 2, HĐTN 4 → 2); môn lạ dùng `txMin` đã lưu.
 */
export interface TxSpec {
  txSlots: number;
  txMin: number;
}
export function txSpecOf(x: { subjectKey: string; txMin?: number }): TxSpec {
  const def = SUBJECT_BY_KEY.get(x.subjectKey);
  if (def) return { txSlots: def.txSlots, txMin: def.txMin };
  const n = Math.max(1, Math.min(4, Math.round(Number(x.txMin) || 2)));
  return { txSlots: Math.max(2, n), txMin: n };
}

export const assignmentId = (year: string, classId: string, subjectKey: string) => `${year}_${classId}_${subjectKey}`;
export const gradebookId = (year: string, term: number, classId: string, subjectKey: string) =>
  `${year}_HK${term}_${classId}_${subjectKey}`;
export const reportId = (year: string, term: number, mhs: string) => `${year}_HK${term}_${mhs}`;

export interface GradeAssignment {
  id: string;
  year: string;
  classId: string;
  subjectKey: string;
  subjectName: string;
  mode: SubjectMode;
  txMin: number;
  teacherUids: string[];
  teacherNames: string[];
  /** Tên GV trên TKB chưa gắn tài khoản (BGH cần xử lý) */
  unresolvedNames: string[];
  source: 'tkb' | 'manual';
  updatedAt?: number;
  updatedBy?: string;
}

/**
 * Dựng phân công nhập điểm từ TKB: lớp × môn → các GV (theo `teacherUsername` của ô TKB hoặc tên TKB đã gắn trong `teacher_aliases`).
 * Không ghi đè phân công BGH đã sửa tay (`source: 'manual'`) — bước đó do nơi gọi quyết định.
 */
export function buildAssignmentsFromTimetable(
  schedules: Record<string, ClassSchedule | undefined>,
  aliasDocs: TeacherAliasDoc[],
  year: string
): GradeAssignment[] {
  const { byAlias } = buildAliasIndex(aliasDocs);
  const byUsername = new Map(aliasDocs.filter((d) => d.username).map((d) => [d.username, d]));
  const map = new Map<string, GradeAssignment>();
  for (const [classId, sch] of Object.entries(schedules)) {
    for (const slot of sch?.slots || []) {
      const subj = subjectFromTimetable(slot.subject);
      if (!subj) continue;
      const id = assignmentId(year, classId, subj.key);
      let a = map.get(id);
      if (!a) {
        a = {
          id, year, classId, subjectKey: subj.key, subjectName: subj.name, mode: subj.mode, txMin: subj.txMin,
          teacherUids: [], teacherNames: [], unresolvedNames: [], source: 'tkb',
        };
        map.set(id, a);
      }
      const owners = slot.teacherUsername && byUsername.has(slot.teacherUsername)
        ? [byUsername.get(slot.teacherUsername)!]
        : byAlias.get(normAlias(slot.teacherName)) || [];
      if (owners.length === 0) {
        const n = (slot.teacherName || '').trim();
        if (n && !a.unresolvedNames.includes(n)) a.unresolvedNames.push(n);
      }
      for (const o of owners) {
        if (!a.teacherUids.includes(o.uid)) {
          a.teacherUids.push(o.uid);
          a.teacherNames.push(o.displayName || o.username);
        }
      }
    }
  }
  return [...map.values()].sort((x, y) => x.classId.localeCompare(y.classId, 'vi', { numeric: true }) || x.subjectName.localeCompare(y.subjectName, 'vi'));
}

/** Gộp phân công mới dựng từ TKB với phân công đang có: giữ nguyên bản BGH sửa tay. */
export function mergeAssignments(fromTkb: GradeAssignment[], existing: GradeAssignment[]): GradeAssignment[] {
  const manual = new Map(existing.filter((a) => a.source === 'manual').map((a) => [a.id, a]));
  const old = new Map(existing.map((a) => [a.id, a]));
  // TKB không tự ra GV (tên chưa ghép được) → giữ GV đã gán trước đó
  const keep = (a: GradeAssignment) => {
    const prev = old.get(a.id);
    return a.teacherUids.length === 0 && prev?.teacherUids.length
      ? { ...a, teacherUids: prev.teacherUids, teacherNames: prev.teacherNames, unresolvedNames: [] }
      : a;
  };
  const out = fromTkb.map((a) => manual.get(a.id) ?? keep(a));
  for (const m of manual.values()) if (!out.some((a) => a.id === m.id)) out.push(m);
  return out;
}

export type GradebookStatus = 'draft' | 'published' | 'locked';

export interface GradeRow {
  tx: GradeValue[];
  gk: GradeValue;
  ck: GradeValue;
  comment: string;
}

export interface Gradebook {
  id: string;
  year: string;
  term: 1 | 2;
  classId: string;
  subjectKey: string;
  subjectName: string;
  mode: SubjectMode;
  txMin: number;
  status: GradebookStatus;
  rows: Record<string, GradeRow>;
  version: number;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: number;
  publishedAt?: number;
  lockedAt?: number;
}

export const STATUS_LABEL: Record<GradebookStatus, { vi: string; en: string; className: string }> = {
  draft: { vi: 'Nháp', en: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  published: { vi: 'Đã công bố cho PH/HS', en: 'Published to families', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  locked: { vi: 'Đã khóa (đã đưa lên CSDL)', en: 'Locked (sent to MOET DB)', className: 'bg-amber-50 text-amber-800 border-amber-300' },
};

export const COMMENT_MAX = 300;

export function emptyRow(slots = 4): GradeRow {
  return { tx: Array(slots).fill(null), gk: null, ck: null, comment: '' };
}

/**
 * Chuẩn hóa dòng điểm: mảng `tx` dài `slots` ô (số cột của môn). Ô ĐĐGtx có điểm nằm ngoài số cột (sổ cũ 5 cột)
 * được giữ lại — mảng dài tới ô có điểm cuối cùng (tối đa `TX_SLOTS_MAX`) để không mất điểm khi lưu lại.
 */
export function normalizeRow(r: Partial<GradeRow> | undefined, slots = 4): GradeRow {
  const src = r?.tx || [];
  let len = slots;
  for (let i = slots; i < Math.min(src.length, TX_SLOTS_MAX); i++) if (src[i] != null) len = i + 1;
  const tx = Array.from({ length: len }, (_, i) => src[i] ?? null);
  return { tx, gk: r?.gk ?? null, ck: r?.ck ?? null, comment: (r?.comment || '').slice(0, COMMENT_MAX) };
}

export function newGradebook(a: Pick<GradeAssignment, 'year' | 'classId' | 'subjectKey' | 'subjectName' | 'mode' | 'txMin'>, term: 1 | 2): Gradebook {
  return {
    id: gradebookId(a.year, term, a.classId, a.subjectKey),
    year: a.year, term, classId: a.classId, subjectKey: a.subjectKey, subjectName: a.subjectName,
    mode: a.mode, txMin: txSpecOf(a).txMin, status: 'draft', rows: {}, version: 0,
  };
}

export const rowResult = (gb: Pick<Gradebook, 'mode' | 'txMin' | 'subjectKey'>, r: GradeRow | undefined): TermResult => {
  const spec = txSpecOf(gb);
  return termResult(withinSlots(normalizeRow(r, spec.txSlots), spec.txSlots), gb.mode, spec.txMin);
};

/** Chỉ các ô ĐĐGtx trong số cột của môn mới vào ĐTBmhk; ô thừa (sổ nhập trước 05/11 theo mẫu 5 cột) giữ nguyên nhưng không tính. */
export function withinSlots(r: GradeRow, slots: number): GradeRow {
  return r.tx.length <= slots ? r : { ...r, tx: r.tx.slice(0, slots) };
}

/**
 * Điểm đã nhập khi chưa đủ để tính ĐTBmhk (vd. mới có GK): "GK 10" · "TX 9 8 · GK 10" · "" (chưa nhập gì).
 * Dùng cho bảng tổng hợp lớp — GVCN thấy điểm ngay cả khi sổ còn dở/nháp.
 */
export function partialSummary(gb: Pick<Gradebook, 'subjectKey' | 'txMin'>, r: GradeRow | undefined): string {
  if (!r) return '';
  const { txSlots } = txSpecOf(gb);
  const row = withinSlots(normalizeRow(r, txSlots), txSlots);
  const tx = row.tx.filter((v) => v != null).map((v) => formatGrade(v));
  const parts = [
    tx.length ? `TX ${tx.join(' ')}` : '',
    row.gk != null ? `GK ${formatGrade(row.gk)}` : '',
    row.ck != null ? `CK ${formatGrade(row.ck)}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

/** HS có điểm ở cột ĐĐGtx vượt số cột của môn (để báo GV/BGH, không tự xóa). */
export function extraTxStudents(gb: Pick<Gradebook, 'rows' | 'subjectKey' | 'txMin'>): string[] {
  const { txSlots } = txSpecOf(gb);
  return Object.entries(gb.rows || {})
    .filter(([, r]) => (r?.tx || []).some((v, i) => i >= txSlots && i < TX_SLOTS_MAX && v != null))
    .map(([mhs]) => mhs);
}

/** Tên ô dùng trong lịch sử / Excel. */
export type GradeField = `tx${number}` | 'gk' | 'ck' | 'comment';
/** Các ô của một dòng điểm có `slots` cột ĐĐGtx. */
export function gradeFields(slots: number): GradeField[] {
  return [...Array.from({ length: slots }, (_, i) => `tx${i + 1}` as GradeField), 'gk', 'ck', 'comment'];
}

export function getField(r: GradeRow, f: GradeField): GradeValue | string {
  if (f === 'gk' || f === 'ck') return r[f];
  if (f === 'comment') return r.comment;
  return r.tx[Number(f.slice(2)) - 1] ?? null;
}

export function setField(r: GradeRow, f: GradeField, v: GradeValue | string): GradeRow {
  const k = /^tx\d+$/.test(f) ? Number(f.slice(2)) : 0;
  const next = normalizeRow(r, Math.min(TX_SLOTS_MAX, Math.max(r?.tx?.length ?? 0, k)));
  if (f === 'comment') next.comment = String(v ?? '').slice(0, COMMENT_MAX);
  else if (f === 'gk' || f === 'ck') next[f] = v as GradeValue;
  else next.tx[Number(f.slice(2)) - 1] = v as GradeValue;
  return next;
}

export interface GradeChange {
  mhs: string;
  field: GradeField;
  from: GradeValue | string;
  to: GradeValue | string;
}

/** Các ô đã đổi giữa 2 bản (để ghi lịch sử). */
export function diffRows(before: Record<string, GradeRow>, after: Record<string, GradeRow>): GradeChange[] {
  const out: GradeChange[] = [];
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const mhs of [...ids].sort()) {
    const a = normalizeRow(before[mhs], 0);
    const b = normalizeRow(after[mhs], 0);
    for (const f of gradeFields(Math.max(a.tx.length, b.tx.length))) {
      const from = getField(a, f);
      const to = getField(b, f);
      if ((from ?? '') !== (to ?? '')) out.push({ mhs, field: f, from: from ?? null, to: to ?? null });
    }
  }
  return out;
}

/** Bỏ dòng rỗng hoàn toàn để doc gọn. */
export function compactRows(rows: Record<string, GradeRow>): Record<string, GradeRow> {
  const out: Record<string, GradeRow> = {};
  for (const [mhs, r] of Object.entries(rows)) {
    const n = normalizeRow(r, r?.tx?.length ?? 0);
    if (n.tx.some((v) => v != null) || n.gk != null || n.ck != null || n.comment.trim()) out[mhs] = n;
  }
  return out;
}

/** Đã công bố/khóa → sửa điểm phải ghi lý do. */
export const needsReason = (status: GradebookStatus) => status !== 'draft';

/** Tiến độ nhập: số ô bắt buộc đã có / cần có (txMin + GK + CK cho mỗi HS). */
export function gradebookProgress(gb: Pick<Gradebook, 'rows' | 'txMin' | 'subjectKey'>, studentIds: string[]): { filled: number; required: number; complete: number } {
  let filled = 0;
  let complete = 0;
  const spec = txSpecOf(gb);
  const per = spec.txMin + 2;
  for (const mhs of studentIds) {
    const r = normalizeRow(gb.rows[mhs], spec.txSlots);
    const tx = Math.min(r.tx.filter((v) => v != null).length, spec.txMin);
    const n = tx + (r.gk != null ? 1 : 0) + (r.ck != null ? 1 : 0);
    filled += n;
    if (n === per) complete++;
  }
  return { filled, required: per * studentIds.length, complete };
}

export interface ReportSubject {
  name: string;
  mode: SubjectMode;
  /** Ô ĐĐGtx theo số cột của môn (bản công bố trước 05/11 có thể dài 5 ô) */
  tx: GradeValue[];
  gk: GradeValue;
  ck: GradeValue;
  /** ĐTBmhk: "7.6" (điểm số) · "Đ" / "CĐ" (nhận xét) · "" (chưa đủ điểm). Bản công bố cũ có thể ghi "Đạt"/"Chưa đạt". */
  result: string;
  comment: string;
  publishedAt: number;
}

/** Phần điểm của 1 HS trong bản công bố. */
export function reportSubjectOf(gb: Gradebook, mhs: string, publishedAt: number): ReportSubject {
  const r = normalizeRow(gb.rows[mhs], txSpecOf(gb).txSlots);
  const res = rowResult(gb, r);
  return {
    name: gb.subjectName, mode: gb.mode, tx: r.tx, gk: r.gk, ck: r.ck,
    result: res.status === 'ok' ? ('avg' in res ? String(res.avg) : res.result === 'Đạt' ? 'Đ' : 'CĐ') : '',
    comment: r.comment, publishedAt,
  };
}

/** Bảng tổng hợp lớp cho GVCN: HS × môn → kết quả HK (chuỗi) hoặc '' khi thiếu. */
export function classMatrix(gradebooks: Gradebook[], studentIds: string[]): Record<string, Record<string, TermResult>> {
  const m: Record<string, Record<string, TermResult>> = {};
  for (const mhs of studentIds) {
    m[mhs] = {};
    for (const gb of gradebooks) m[mhs][gb.subjectKey] = rowResult(gb, gb.rows[mhs]);
  }
  return m;
}

/** Lưới nhập điểm: ô kế tiếp khi Enter theo chế độ "Nhảy cột" (xuống) / "Nhảy dòng" (sang phải). */
export type JumpMode = 'column' | 'row';
export function nextCell(row: number, col: number, rows: number, cols: number, mode: JumpMode, back = false): [number, number] {
  const d = back ? -1 : 1;
  if (mode === 'column') {
    let r = row + d;
    let c = col;
    if (r >= rows) { r = 0; c = col + 1; }
    if (r < 0) { r = rows - 1; c = col - 1; }
    if (c >= cols || c < 0) return [row, col];
    return [r, c];
  }
  let c = col + d;
  let r = row;
  if (c >= cols) { c = 0; r = row + 1; }
  if (c < 0) { c = cols - 1; r = row - 1; }
  if (r >= rows || r < 0) return [row, col];
  return [r, c];
}
