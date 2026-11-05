/**
 * Tính điểm trung bình môn theo Thông tư 22/2021/TT-BGDĐT (THCS). Hàm thuần — không gọi Firebase.
 *
 * - Môn đánh giá bằng điểm số: ĐTBmhk = (ΣĐĐGtx + 2·ĐĐGgk + 3·ĐĐGck) / (số ĐĐGtx + 5), làm tròn 1 chữ số thập phân.
 * - Cả năm: ĐTBmcn = (ĐTBmhkI + 2·ĐTBmhkII) / 3.
 * - Môn đánh giá bằng nhận xét: HK "Đạt" khi đủ số lần ĐGtx, ≥ 2/3 số lần ĐGtx "Đ", và ĐĐGgk, ĐĐGck đều "Đ".
 * Tính trên số nguyên (đơn vị 0,1 điểm) để tránh lỗi số thực (vd. 6,25 → 6,3).
 */

export type CommentMark = 'Đ' | 'CĐ';
export type GradeValue = number | CommentMark | null;
export type SubjectMode = 'score' | 'comment';

/** Số lần ĐGtx tối thiểu theo số tiết/năm (TT22 Điều 7). */
export function minRegularAssessments(periodsPerYear: number): number {
  if (periodsPerYear <= 35) return 2;
  if (periodsPerYear <= 70) return 3;
  return 4;
}

const toTenths = (v: number) => Math.round(v * 10);
/** Làm tròn nửa lên phân số dương a/b (số nguyên) → số nguyên. */
const roundDiv = (a: number, b: number) => Math.floor((2 * a + b) / (2 * b));

/** Ô điểm số hợp lệ: 0–10, tối đa 1 chữ số thập phân. */
export function isValidScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
}

export function isCommentMark(v: unknown): v is CommentMark {
  return v === 'Đ' || v === 'CĐ';
}

/**
 * Đọc chữ GV gõ vào ô. Trả `undefined` khi không hợp lệ (để tô đỏ ô), `null` khi để trống.
 * Điểm số: "8", "8.5", "8,5". Nhận xét: "Đ"/"D"/"đ", "CĐ"/"CD".
 * `shorthand` (lưới nhập điểm): gõ 2 chữ số không dấu = điểm lẻ — "95" → 9,5; "76" → 7,6; "90" → 9,0; riêng "10" vẫn là 10, "100" → 10,0.
 */
export function parseGradeInput(raw: string, mode: SubjectMode, opts: { shorthand?: boolean } = {}): GradeValue | undefined {
  let s = raw.trim();
  if (opts.shorthand && mode === 'score') {
    if (/^\d{2}$/.test(s) && s !== '10') s = `${s[0]}.${s[1]}`;
    else if (s === '100') s = '10';
  }
  if (s === '') return null;
  if (mode === 'comment') {
    const t = s.normalize('NFC').toUpperCase().replace(/\s+/g, '');
    if (t === 'Đ' || t === 'D') return 'Đ';
    if (t === 'CĐ' || t === 'CD') return 'CĐ';
    return undefined;
  }
  if (!/^\d{1,2}([.,]\d)?$/.test(s)) return undefined;
  const n = Number(s.replace(',', '.'));
  return isValidScore(n) ? n : undefined;
}

/** Hiển thị điểm kiểu Việt Nam: 8,5 — số nguyên giữ nguyên. */
export function formatGrade(v: GradeValue | undefined): string {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
  return v;
}

export interface TermInput {
  tx: GradeValue[];
  gk: GradeValue;
  ck: GradeValue;
}

export type TermResult =
  | { status: 'ok'; avg: number }
  | { status: 'ok'; result: 'Đạt' | 'Chưa đạt' }
  | { status: 'missing'; missing: string[] };

/** Kết quả học kì của 1 HS 1 môn. `txMin` = số lần ĐGtx tối thiểu của môn. */
export function termResult(input: TermInput, mode: SubjectMode, txMin: number): TermResult {
  const missing: string[] = [];
  if (mode === 'score') {
    const tx = input.tx.filter(isValidScore);
    if (tx.length < txMin) missing.push(`ĐĐGtx (${tx.length}/${txMin})`);
    if (!isValidScore(input.gk)) missing.push('ĐĐGgk');
    if (!isValidScore(input.ck)) missing.push('ĐĐGck');
    if (missing.length) return { status: 'missing', missing };
    const sum = tx.reduce((a, v) => a + toTenths(v), 0) + 2 * toTenths(input.gk as number) + 3 * toTenths(input.ck as number);
    return { status: 'ok', avg: roundDiv(sum, tx.length + 5) / 10 };
  }
  const tx = input.tx.filter(isCommentMark);
  if (tx.length < txMin) missing.push(`ĐĐGtx (${tx.length}/${txMin})`);
  if (!isCommentMark(input.gk)) missing.push('ĐĐGgk');
  if (!isCommentMark(input.ck)) missing.push('ĐĐGck');
  if (missing.length) return { status: 'missing', missing };
  const passed = tx.filter((v) => v === 'Đ').length;
  const ok = 3 * passed >= 2 * tx.length && input.gk === 'Đ' && input.ck === 'Đ';
  return { status: 'ok', result: ok ? 'Đạt' : 'Chưa đạt' };
}

/** ĐTBmcn = (ĐTBmhkI + 2·ĐTBmhkII) / 3, làm tròn 1 chữ số thập phân. */
export function yearAverage(hk1: number, hk2: number): number {
  return roundDiv(toTenths(hk1) + 2 * toTenths(hk2), 3) / 10;
}

/** Chữ hiển thị ở cột ĐTBmhk (như học bạ): "7,8" · "Đ" (Đạt) / "CĐ" (Chưa đạt) · "" (thiếu điểm). */
export function termResultText(r: TermResult): string {
  if (r.status === 'missing') return '';
  return 'avg' in r ? formatGrade(r.avg) : r.result === 'Đạt' ? 'Đ' : 'CĐ';
}

/** ĐTBmhk đã công bố (chuỗi trong grade_reports) có phải mức thấp: < 5,0 hoặc Chưa đạt (cả cách ghi cũ "Chưa đạt"). */
export function isLowResult(result: string | undefined): boolean {
  if (!result) return false;
  if (result === 'CĐ' || result === 'Chưa đạt') return true;
  const n = Number(result.replace(',', '.'));
  return Number.isFinite(n) && n < 5;
}
