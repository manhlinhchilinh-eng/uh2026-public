/**
 * Đọc file "GUMS - Sổ Sao Đỏ" (Excel của TPT): mỗi lớp 1 sheet "LỚP 6A1", bảng bên phải có cột
 * NGÀY / THÁNG | HỌ VÀ TÊN | LỖI VI PHẠM | ĐIỂM TRỪ. Hàm thuần (nhận mảng dòng) để test được.
 * KHÔNG giữ tên học sinh — chỉ gom theo lỗi + điểm trừ cho từng lớp/ngày.
 */

import type { RedFlagClassDay } from './tptRanking';

export interface SaoDoSheet {
  name: string;
  rows: unknown[][];
}

export interface SaoDoParseResult {
  /** date → classId → điểm trừ trong ngày */
  byDate: Record<string, Record<string, RedFlagClassDay>>;
  /** Dòng có ngày sau hôm nay (thường gõ nhầm) — không nhập */
  future: Array<{ classId: string; date: string; violation: string; points: number }>;
  /** Dòng có điểm trừ nhưng không đọc được ngày */
  errors: string[];
  /** Lớp tìm thấy trong file */
  classIds: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => (y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

/** Ngày trong ô Excel: số serial, Date, hoặc chữ "5/11/2026", "5/112026" (thiếu dấu /), "05-11-2026" */
export function parseSaoDoDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // SheetJS (cellDates) tạo Date theo giờ địa phương 00:00 — cộng 12h để tránh lệch ngày do múi giờ
    const t = new Date(v.getTime() + 12 * 3600_000);
    return iso(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 30000 && v < 80000) {
    const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-]?(\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

const norm = (v: unknown) => String(v ?? '').normalize('NFC').trim().toUpperCase();

export function parseSaoDoSheets(sheets: SaoDoSheet[], knownClasses: string[], today: string): SaoDoParseResult {
  const known = new Set(knownClasses.map((c) => c.toUpperCase()));
  const byDate: SaoDoParseResult['byDate'] = {};
  const future: SaoDoParseResult['future'] = [];
  const errors: string[] = [];
  const classIds: string[] = [];

  for (const sh of sheets) {
    const cm = norm(sh.name).match(/^LỚP\s*(\d[A-Z]\d{1,2})$/);
    if (!cm || !known.has(cm[1])) continue;
    const classId = cm[1];
    classIds.push(classId);
    // Dòng tiêu đề: có ô "NGÀY" và "LỖI VI PHẠM"; cột điểm = ô "ĐIỂM TRỪ" nằm sau cột lỗi
    const found = sh.rows.findIndex((r) => (r || []).some((c) => norm(c).startsWith('NGÀY')) && (r || []).some((c) => norm(c).startsWith('LỖI')));
    // Thiếu dòng tiêu đề (vd. sheet 9A1 bản 05/11 bị xóa ô tiêu đề) → dùng bố cục chuẩn của mẫu: F ngày, H lỗi, I điểm
    const hi = found < 0 ? 0 : found;
    const head = found < 0 ? ['', '', '', '', 'STT', 'NGÀY', 'HỌ VÀ TÊN', 'LỖI', 'ĐIỂM TRỪ'] : sh.rows[hi].map(norm);
    const dateCol = head.findIndex((c) => c.startsWith('NGÀY'));
    const violCol = head.findIndex((c) => c.startsWith('LỖI'));
    const ptsCol = head.findIndex((c, i) => i > violCol && c.startsWith('ĐIỂM'));
    if (dateCol < 0 || violCol < 0 || ptsCol < 0) {
      errors.push(`${classId}: thiếu cột NGÀY / LỖI VI PHẠM / ĐIỂM TRỪ`);
      continue;
    }
    for (let i = hi + 1; i < sh.rows.length; i++) {
      const r = sh.rows[i] || [];
      const rawPts = r[ptsCol];
      const points = Number(String(rawPts ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
      const violation = String(r[violCol] ?? '').trim().replace(/\s+/g, ' ');
      if (!(points > 0) && !violation) continue;
      if (!(points > 0)) {
        errors.push(`${classId} dòng ${i + 1}: "${violation}" chưa có điểm trừ`);
        continue;
      }
      const date = parseSaoDoDate(r[dateCol]);
      if (!date) {
        errors.push(`${classId} dòng ${i + 1}: không đọc được ngày "${String(r[dateCol] ?? '')}"`);
        continue;
      }
      if (date > today) {
        future.push({ classId, date, violation, points });
        continue;
      }
      const day = (byDate[date] ||= {});
      const cur = (day[classId] ||= { d: 0, n: 0, items: [] });
      cur.d = Math.round((cur.d + points) * 100) / 100;
      cur.n += 1;
      const key = violation || '(không ghi lỗi)';
      const it = cur.items.find((x) => x.v === key && x.p === points);
      if (it) it.n += 1;
      else cur.items.push({ v: key.slice(0, 120), p: points, n: 1 });
    }
  }
  // Ngày có trong file: lớp không có lỗi = trừ 0 (để biết lớp đó đã được chấm)
  for (const day of Object.values(byDate)) for (const c of classIds) day[c] ||= { d: 0, n: 0, items: [] };
  return { byDate, future, errors, classIds };
}
