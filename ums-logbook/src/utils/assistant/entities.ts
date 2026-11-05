/**
 * Trợ lý hành động (phương án A, 05/11/2026): tách lớp / ngày / tiết / tên HS từ câu hỏi — chạy offline,
 * không AI ngoài. Chỉ nhận diện; dữ liệu thật do AssistantFab lấy từ danh sách lớp (không dùng dữ liệu mẫu).
 * Hàm thuần, có test: __tests__/entities.test.ts
 */
import type { UserRole } from '../../types/auth';
import { normalize } from './normalize';

export interface ParsedQuery {
  /** Câu gốc, chữ thường, giữ dấu (NFC) — phân biệt "còn"/"con", "muộn"/"muốn"… khi đã bỏ dấu. */
  raw: string;
  norm: string;
  classId: string | null; // "9A2"
  date: string | null; // ISO "2026-11-04"
  period: number | null; // 1..10
  /** Hỏi thông tin 1 học sinh. */
  wantsStudent: boolean;
  /** Muốn mở sổ đầu bài của 1 tiết/ngày cụ thể (có tiết hoặc ngày). */
  wantsLogbook: boolean;
  /** Chức năng UMS+ chưa có (đã kiểm trong mã nguồn). */
  missing: MissingFeature | null;
}

export interface MissingFeature {
  id: string;
  vi: string;
  en: string;
  /** Việc làm được thay thế (nếu có). */
  altVi?: string;
  altEn?: string;
  altPath?: string;
}

/** Chức năng đã kiểm là CHƯA có — trả lời thật, mời gửi thành ý tưởng. */
const MISSING: Array<MissingFeature & { all: string[]; any: string[] }> = [
  {
    id: 'print-grade-per-student',
    all: ['in', 'diem'],
    any: ['tung ban', 'tung hs', 'tung hoc sinh', 'tung em', 'moi ban', 'moi hs', 'moi em', 'phieu diem', 'ca nhan', 'rieng'],
    vi: 'UMS+ chưa có chức năng in phiếu/sổ điểm riêng cho từng học sinh.',
    en: 'UMS+ cannot print a separate grade sheet per student yet.',
    altVi: 'Hiện làm được: vào Sổ điểm, xuất Excel cả lớp theo mẫu CSDL.',
    altEn: 'Available now: open the Gradebook and export the whole class to Excel.',
    altPath: '/so-diem',
  },
];

const STUDENT_CUES = ['thong tin', 'hoc sinh', 'hs', 'ban', 'em', 'ho so', 'ngay sinh', 'ma hs', 'ma hoc sinh', 'tra cuu'];
const LOGBOOK_CUES = ['so dau bai', 'sdb', 'tiet'];
const WEEKDAY: Record<string, number> = { '2': 1, hai: 1, '3': 2, ba: 2, '4': 3, tu: 3, '5': 4, nam: 4, '6': 5, sau: 5, '7': 6, bay: 6 };

export const hasPhrase = (norm: string, p: string) => ` ${norm} `.includes(` ${p} `);

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(iso: string, n: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

export function parseClass(norm: string): string | null {
  const m = norm.match(/(?:^|\s)([6-9])\s?a\s?(1[0-2]|[1-9])(?=\s|$)/);
  return m ? `${m[1]}A${m[2]}` : null;
}

/** Ngày từ câu hỏi, so với `todayIso`: hôm nay/qua/kia, ngày mai, thứ 2–7 (tuần này), chủ nhật, d/m(/y). */
export function parseDate(raw: string, norm: string, todayIso: string): string | null {
  const dm = raw.match(/(?:^|\D)(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?(?!\d)/);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    const y = dm[3] ? Number(dm[3]) : fromIso(todayIso).getFullYear();
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return isoOf(new Date(y, m - 1, d));
  }
  if (hasPhrase(norm, 'hom kia')) return addDays(todayIso, -2);
  if (hasPhrase(norm, 'hom qua')) return addDays(todayIso, -1);
  if (hasPhrase(norm, 'ngay mai')) return addDays(todayIso, 1);
  if (hasPhrase(norm, 'hom nay')) return todayIso;
  const w = norm.match(/(?:^|\s)thu (2|3|4|5|6|7|hai|ba|tu|nam|sau|bay)(?=\s|$)/);
  const sunday = hasPhrase(norm, 'chu nhat');
  if (w || sunday) {
    const target = sunday ? 7 : WEEKDAY[w![1]]; // 1 = thứ Hai … 7 = Chủ nhật
    const today = fromIso(todayIso).getDay() || 7;
    let iso = addDays(todayIso, target - today);
    if (hasPhrase(norm, 'tuan truoc')) iso = addDays(iso, -7);
    return iso;
  }
  return null;
}

export function parsePeriod(norm: string): number | null {
  const m = norm.match(/(?:^|\s)tiet (10|[1-9])(?=\s|$)/);
  return m ? Number(m[1]) : null;
}

export function parseQuery(raw: string, todayIso: string): ParsedQuery {
  const norm = normalize(raw);
  const classId = parseClass(norm);
  const date = parseDate(raw, norm, todayIso);
  const period = parsePeriod(norm);
  const missing =
    MISSING.find((f) => f.all.every((w) => hasPhrase(norm, w)) && f.any.some((w) => hasPhrase(norm, w))) || null;
  const logbookCue = LOGBOOK_CUES.some((c) => hasPhrase(norm, c));
  // Câu hướng dẫn ("làm sao ghi sổ đầu bài") không có tiết/ngày → để bộ câu hỏi trả lời.
  const howTo = /(^|\s)(lam sao|lam the nao|cach|huong dan)(\s|$)/.test(norm);
  const wantsLogbook = !missing && logbookCue && (period !== null || date !== null) && !(howTo && period === null && date === null);
  const wantsStudent = !missing && !wantsLogbook && !howTo && STUDENT_CUES.some((c) => hasPhrase(norm, c));
  return {
    raw: raw.normalize('NFC').toLowerCase(),
    norm, classId, date, period, wantsStudent, wantsLogbook, missing: missing ? stripRule(missing) : null,
  };
}

function stripRule(f: MissingFeature & { all: string[]; any: string[] }): MissingFeature {
  const { all: _a, any: _b, ...rest } = f;
  return rest;
}

/* ---------------- Quyền ---------------- */

/** Lớp được tra cứu HS: BGH/admin mọi lớp; GVCN chỉ lớp chủ nhiệm; vai trò khác không tra HS. */
export function studentLookupClass(
  role: UserRole | 'guest',
  assignedClassId: string | null | undefined,
  askedClass: string | null
): { classId: string } | { denied: 'role' | 'other_class' | 'need_class'; own?: string } {
  if (role === 'admin') return askedClass ? { classId: askedClass } : { denied: 'need_class' };
  if (role === 'gvcn' && assignedClassId) {
    if (askedClass && askedClass !== assignedClassId) return { denied: 'other_class', own: assignedClassId };
    return { classId: assignedClassId };
  }
  return { denied: 'role' };
}

const LOGBOOK_ROLES: Array<UserRole | 'guest'> = ['admin', 'gvcn', 'gvbm', 'tpt', 'giamthi'];

/** Đường mở sổ đầu bài đúng lớp/ngày/tiết. Trang sổ tự kiểm quyền xem/ký; ở đây chỉ chặn vai trò không có sổ. */
export function logbookLink(
  role: UserRole | 'guest',
  assignedClassId: string | null | undefined,
  p: Pick<ParsedQuery, 'classId' | 'date' | 'period'>,
  todayIso: string
): { path: string; classId: string; date: string; period: number | null } | { denied: 'role' | 'need_class' } {
  if (!LOGBOOK_ROLES.includes(role)) return { denied: 'role' };
  const classId = p.classId || (role === 'gvcn' ? assignedClassId || null : null);
  if (!classId) return { denied: 'need_class' };
  const date = p.date || todayIso;
  const q = new URLSearchParams({ classId, date });
  if (p.period) q.set('period', String(p.period));
  return { path: `/logbook?${q.toString()}`, classId, date, period: p.period };
}

/* ---------------- Tên học sinh ---------------- */

const NAME_PREFIX = ['ban', 'em', 'hs', 'hoc sinh', 'con', 'chau'];

export interface NamedStudent {
  name: string;
}

/**
 * Tìm HS theo tên trong câu (không dấu): khớp họ tên đầy đủ, hoặc tên gọi (1–2 chữ cuối) đứng thành cụm riêng.
 * Ưu tiên khớp dài nhất; trả mọi HS cùng độ dài khớp tốt nhất (trùng tên → để người dùng chọn).
 */
export function findStudents<T extends NamedStudent>(roster: T[], norm: string): T[] {
  let best = 0;
  let out: T[] = [];
  for (const s of roster) {
    const words = normalize(s.name).split(' ').filter(Boolean);
    let score = 0;
    for (let k = words.length; k >= 1; k--) {
      const tail = words.slice(-k).join(' ');
      // Chỉ 1 chữ (tên gọi) dễ trùng từ thường ("mai", "an", "anh") → phải đứng sau "bạn/em/hs/học sinh".
      const ok = k >= 2 ? hasPhrase(norm, tail) : NAME_PREFIX.some((p) => hasPhrase(norm, `${p} ${tail}`));
      if (ok) {
        score = k;
        break;
      }
    }
    if (score > best) {
      best = score;
      out = [s];
    } else if (score > 0 && score === best) out.push(s);
  }
  return out;
}
