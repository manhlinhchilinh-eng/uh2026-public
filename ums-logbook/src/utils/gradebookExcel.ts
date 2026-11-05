/**
 * Excel sổ điểm theo bản xuất "BẢNG ĐIỂM HỌC KỲ" của CSDL ngành:
 *  dòng 2–4 tiêu đề (trường, năm học – học kỳ, lớp, môn) · dòng 6–8 tiêu đề cột (gộp ô):
 *  STT · Tên lớp · Mã định danh Bộ GD&ĐT · Họ và tên · Ngày sinh · ĐĐGtx 1–n · ĐĐGgk · ĐĐGck · dữ liệu từ dòng 9, điểm dạng số.
 *  n = số cột ĐĐGtx của môn (`txSpecOf`: Toán 4, Công nghệ 3, GDCD 2…). File nhập có thể có tới 5 cột ĐĐGtx (bản CSDL cũ):
 *  cột vượt số cột của môn mà có điểm → báo ô sai, không nhập.
 * Xuất đúng bố cục đó (thêm ĐTBmhk + Nhận xét ở cuối, GV xóa nếu CSDL không nhận) để GV nhập lên CSDL;
 * nhập lại từ file CSDL / file GV tự làm (có cột phụ như "Sử", "Địa", "Chốt" → GV chọn cột nào là ĐĐGgk/ĐĐGck).
 * Hàm thuần trên mảng 2 chiều.
 */

import { isValidScore, parseGradeInput, termResult, type GradeValue } from './gradeCalc';
import { TX_SLOTS_MAX, normalizeRow, setField, txSpecOf, withinSlots, type GradeField, type GradeRow, type Gradebook } from './gradebook';

export interface ExcelStudent {
  mhs: string;
  name: string;
  stt: number;
  moetId?: string;
  /** yyyy-mm-dd */
  dob?: string;
}

type Cell = string | number | null | undefined;
type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

const fold = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const dmy = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso || '');
/** Ô điểm: số giữ dạng số (CSDL đọc số), Đ/CĐ giữ chữ. */
const cellOf = (v: GradeValue): Cell => (v == null ? '' : v);

/** Vị trí cột trong bản xuất (0-based) khi môn có `slots` cột ĐĐGtx. */
export function sheetCols(slots: number) {
  return { stt: 0, className: 1, moet: 2, name: 3, dob: 4, tx: 5, gk: 5 + slots, ck: 6 + slots, avg: 7 + slots, comment: 8 + slots } as const;
}
/** Dòng tiêu đề cột (0-based, dòng 6 trên Excel khi dòng 1 để trống) */
export const SHEET_HEADER_ROW = 5;

export function buildGradebookSheet(
  gb: Gradebook,
  students: ExcelStudent[],
  meta: { schoolName?: string } = {}
): { aoa: Cell[][]; merges: Merge[] } {
  const spec = txSpecOf(gb);
  const C = sheetCols(spec.txSlots);
  const width = C.comment + 1;
  const blank = (): Cell[] => Array(width).fill('');
  const term = gb.term === 1 ? 'I' : 'II';

  const r0 = blank(); // dòng 1 trống như bản CSDL
  const r1 = blank(); r1[C.name + 1] = 'BẢNG ĐIỂM HỌC KỲ';
  const r2 = blank(); r2[0] = `Trường: ${meta.schoolName || 'THCS Ngoại Ngữ'}`; r2[C.dob] = `Năm học: ${gb.year} - Học kỳ: ${term}`;
  const r3 = blank(); r3[0] = `Lớp: ${gb.classId}`; r3[C.dob] = `Môn học: ${gb.subjectName.toUpperCase()}`;
  const r4 = blank();
  const h1 = blank();
  Object.assign(h1, { [C.stt]: 'STT', [C.className]: 'Tên lớp', [C.moet]: 'Mã định danh Bộ GD&ĐT', [C.name]: 'Họ và tên', [C.dob]: 'Ngày sinh', [C.tx]: 'ĐĐGtx', [C.gk]: 'ĐĐGgk', [C.ck]: 'ĐĐGck', [C.avg]: `ĐTBmhk${gb.term}`, [C.comment]: 'Nhận xét' });
  const h2 = blank();
  const h3 = blank();
  for (let i = 0; i < spec.txSlots; i++) h3[C.tx + i] = i + 1;

  const body = students.map((s, i): Cell[] => {
    const r = normalizeRow(gb.rows[s.mhs], spec.txSlots);
    const res = termResult(withinSlots(r, spec.txSlots), gb.mode, spec.txMin);
    const row = blank();
    row[C.stt] = i + 1;
    row[C.className] = gb.classId;
    row[C.moet] = s.moetId || '';
    row[C.name] = s.name;
    row[C.dob] = dmy(s.dob);
    r.tx.slice(0, spec.txSlots).forEach((v, k) => (row[C.tx + k] = cellOf(v)));
    row[C.gk] = cellOf(r.gk);
    row[C.ck] = cellOf(r.ck);
    row[C.avg] = res.status === 'ok' ? ('avg' in res ? res.avg : res.result === 'Đạt' ? 'Đ' : 'CĐ') : '';
    row[C.comment] = r.comment;
    return row;
  });

  const H = SHEET_HEADER_ROW;
  const merges: Merge[] = [C.stt, C.className, C.moet, C.name, C.dob, C.gk, C.ck, C.avg, C.comment].map((c) => ({ s: { r: H, c }, e: { r: H + 2, c } }));
  if (spec.txSlots > 1) merges.push({ s: { r: H, c: C.tx }, e: { r: H + 1, c: C.tx + spec.txSlots - 1 } });
  merges.push({ s: { r: 1, c: C.name + 1 }, e: { r: 1, c: C.ck } });
  return { aoa: [r0, r1, r2, r3, r4, h1, h2, h3, ...body], merges };
}

export function exportFileName(gb: Pick<Gradebook, 'classId' | 'subjectKey' | 'term' | 'year'>): string {
  return `SoDiem_${gb.classId}_${gb.subjectKey}_HK${gb.term}_${gb.year}.xlsx`;
}

type ColKind = { kind: 'stt' | 'moet' | 'name' | 'mhs' | 'gk' | 'ck' | 'comment' } | { kind: 'tx'; n: number };

export interface SheetColumn {
  index: number;
  /** Tiêu đề hiển thị (vd. "ĐĐGgk", "Chốt", "Sử") */
  label: string;
  kind: ColKind['kind'] | 'other';
  /** Số ô có giá trị trong phần dữ liệu */
  filled: number;
}

/** Nhận diện cột theo tiêu đề 1–3 dòng (ô gộp: chỉ cột con đánh số 1..n mới kế thừa nhãn bên trái). */
function detectColumns(rows: Cell[][]): { header: number; dataStart: number; cols: Map<number, ColKind>; labels: Map<number, string> } | null {
  const header = rows.findIndex((r) => (r || []).some((c) => /^ho (va )?ten/.test(fold(c))));
  if (header < 0) return null;
  const h1 = rows[header] || [];
  // Dòng con của ô gộp ĐĐGtx: có dãy 1, 2 liền nhau (dòng dữ liệu không có)
  const isSubRow = (r: Cell[] | undefined) => !!r && r.some((c, i) => fold(c) === '1' && fold(r[i + 1]) === '2');
  const isBlank = (r: Cell[] | undefined) => !r || r.every((c) => fold(c) === '');
  let subIdx = -1;
  for (let k = header + 1; k <= header + 2 && k < rows.length; k++) {
    if (isSubRow(rows[k])) { subIdx = k; break; }
    if (!isBlank(rows[k])) break;
  }
  const h2 = subIdx >= 0 ? rows[subIdx] : [];
  const cols = new Map<number, ColKind>();
  const labels = new Map<number, string>();
  let txCount = 0;
  let carry = '';
  let carryRaw = '';
  const width = Math.max(h1.length, h2.length);
  for (let c = 0; c < width; c++) {
    const top = fold(h1[c]);
    const sub = fold(h2[c]);
    if (top) { carry = top; carryRaw = String(h1[c]).trim(); }
    // Cột không có tiêu đề trên: chỉ là cột con của ô gộp khi dòng con là số (1, 2, 3…); còn lại dùng tiêu đề dòng con
    const label = top || (/^\d+$/.test(sub) ? carry : sub);
    const raw = top ? String(h1[c]).trim() : /^\d+$/.test(sub) ? `${carryRaw} ${sub}` : String(h2[c] ?? '').trim();
    if (!label) continue;
    labels.set(c, raw);
    if (label === 'stt') cols.set(c, { kind: 'stt' });
    else if (/dinh danh/.test(label)) cols.set(c, { kind: 'moet' });
    else if (/^ho (va )?ten/.test(label)) cols.set(c, { kind: 'name' });
    else if (/^(ma hs|ma hoc sinh)/.test(label)) cols.set(c, { kind: 'mhs' });
    else if (/^(ddg)?tx/.test(label)) {
      const n = /^\d+$/.test(sub) ? Number(sub) : label.match(/(\d)$/) ? Number(label.match(/(\d)$/)![1]) : ++txCount;
      if (n >= 1 && n <= TX_SLOTS_MAX) cols.set(c, { kind: 'tx', n });
      txCount = Math.max(txCount, n);
    } else if (/^(ddggk|gk\b|giua k)/.test(label)) cols.set(c, { kind: 'gk' });
    else if (/^(ddgck|ck\b|cuoi k)/.test(label)) cols.set(c, { kind: 'ck' });
    else if (/nhan xet/.test(label)) cols.set(c, { kind: 'comment' });
  }
  return { header, dataStart: (subIdx >= 0 ? subIdx : header) + 1, cols, labels };
}

export interface ImportResult {
  rows: Record<string, GradeRow>;
  matched: number;
  /** Dòng Excel không khớp HS nào trong lớp */
  unmatched: Array<{ line: number; name: string }>;
  /** Ô không hợp lệ (bỏ qua khi nhập) */
  invalid: Array<{ line: number; name: string; field: GradeField; value: string }>;
  /** Mã định danh đọc được, theo mã HS (để BGH lưu vào hồ sơ HS) */
  moetIds: Record<string, string>;
  /** Các cột có tiêu đề — để GV chọn lại cột ĐĐGgk/ĐĐGck khi file có cột phụ */
  columns: SheetColumn[];
  /** Cột đang dùng cho GK/CK (-1 = không có) */
  used: { gk: number; ck: number };
  error?: string;
}

const cellText = (v: Cell) => (typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v ?? '').trim());

/**
 * Đọc bảng Excel → điểm theo mã HS. Khớp HS theo: Mã định danh Bộ → Mã HS → Họ tên (duy nhất trong lớp).
 * Ô trống trong Excel giữ nguyên điểm đang có (không xóa).
 * `pick` = chọn cột (chỉ số 0-based) làm ĐĐGgk/ĐĐGck thay cho cột nhận diện được (-1 = không nhập).
 */
export function parseGradebookSheet(
  rows: Cell[][],
  gb: Pick<Gradebook, 'mode' | 'rows' | 'subjectKey'> & Partial<Pick<Gradebook, 'txMin'>>,
  students: ExcelStudent[],
  pick: Partial<Record<'gk' | 'ck', number>> = {}
): ImportResult {
  const slots = txSpecOf(gb).txSlots;
  const res: ImportResult = { rows: { ...gb.rows }, matched: 0, unmatched: [], invalid: [], moetIds: {}, columns: [], used: { gk: -1, ck: -1 } };
  const det = detectColumns(rows);
  if (!det) return { ...res, error: 'Không thấy cột "Họ tên" / "Họ và tên" trong file.' };

  const cols = new Map(det.cols);
  for (const f of ['gk', 'ck'] as const) {
    if (pick[f] == null) continue;
    for (const [c, k] of cols) if (k.kind === f) cols.delete(c);
    if (pick[f]! >= 0) cols.set(pick[f]!, { kind: f });
  }
  for (const [c, k] of cols) if (k.kind === 'gk' || k.kind === 'ck') res.used[k.kind] = c;
  const dataRows = rows.slice(det.dataStart);
  res.columns = [...det.labels].map(([index, label]) => ({
    index, label, kind: det.cols.get(index)?.kind ?? 'other',
    filled: dataRows.filter((r) => cellText(r?.[index]) !== '').length,
  }));

  const byMoet = new Map(students.filter((s) => s.moetId).map((s) => [String(s.moetId).trim(), s]));
  const byMhs = new Map(students.map((s) => [s.mhs, s]));
  const nameCount = new Map<string, number>();
  for (const s of students) nameCount.set(fold(s.name), (nameCount.get(fold(s.name)) || 0) + 1);
  const byName = new Map(students.filter((s) => nameCount.get(fold(s.name)) === 1).map((s) => [fold(s.name), s]));
  // Tên trùng trong lớp: chỉ nhận khi STT trên file khớp vị trí trong danh sách lớp
  const byNameStt = new Map(students.map((s, i) => [`${fold(s.name)}#${i + 1}`, s]));

  for (let i = det.dataStart; i < rows.length; i++) {
    const r = rows[i] || [];
    let moet = '';
    let name = '';
    let mhs = '';
    let stt = '';
    for (const [c, k] of cols) {
      if (k.kind === 'stt') stt = cellText(r[c]);
      if (k.kind === 'moet') moet = cellText(r[c]);
      if (k.kind === 'name') name = cellText(r[c]);
      if (k.kind === 'mhs') mhs = cellText(r[c]);
    }
    if (!name && !moet && !mhs) continue;
    const st =
      (moet && byMoet.get(moet)) || (mhs && byMhs.get(mhs)) || byName.get(fold(name)) ||
      ((nameCount.get(fold(name)) || 0) > 1 ? byNameStt.get(`${fold(name)}#${Number(stt)}`) : undefined);
    if (!st) {
      res.unmatched.push({ line: i + 1, name: name || moet || mhs });
      continue;
    }
    res.matched++;
    if (moet && /^\d{6,15}$/.test(moet)) res.moetIds[st.mhs] = moet;
    let row = normalizeRow(res.rows[st.mhs], slots);
    for (const [c, k] of cols) {
      const raw = cellText(r[c]);
      if (!raw) continue;
      const field: GradeField | null =
        k.kind === 'tx' ? (`tx${k.n}` as GradeField) : k.kind === 'gk' || k.kind === 'ck' || k.kind === 'comment' ? k.kind : null;
      if (!field) continue;
      if (field === 'comment') {
        row = setField(row, 'comment', raw);
        continue;
      }
      const v = typeof r[c] === 'number' && gb.mode === 'score' ? (isValidScore(r[c]) ? (r[c] as number) : undefined) : parseGradeInput(raw, gb.mode);
      if (v === undefined || (k.kind === 'tx' && k.n > slots)) res.invalid.push({ line: i + 1, name: st.name, field, value: raw });
      else row = setField(row, field, v);
    }
    res.rows[st.mhs] = row;
  }
  return res;
}
