/**
 * Lịch nghỉ của trường: Thứ Bảy, Chủ nhật tự nghỉ; BGH khai thêm ngày/khoảng nghỉ (lễ, Tết, sự kiện).
 * Lưu tại system_settings/school_calendar. Hàm thuần — không gọi Firebase.
 */

export interface OffPeriod {
  /** yyyy-mm-dd */
  from: string;
  /** yyyy-mm-dd (bằng from nếu nghỉ 1 ngày) */
  to: string;
  reason: string;
}

export interface SchoolCalendar {
  offPeriods: OffPeriod[];
  updatedAt?: number;
  updatedBy?: string;
}

export const EMPTY_CALENDAR: SchoolCalendar = { offPeriods: [] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = CN, 6 = T7
}

export interface OffDayInfo {
  off: boolean;
  reason: string | null;
  kind: 'weekend' | 'holiday' | null;
}

/** Ngày đó có học không? Ưu tiên ngày nghỉ BGH khai (có lý do cụ thể), rồi tới cuối tuần. */
export function getOffDayInfo(iso: string, calendar: SchoolCalendar | null | undefined = EMPTY_CALENDAR): OffDayInfo {
  if (!ISO.test(iso)) return { off: false, reason: null, kind: null };
  const hit = (calendar?.offPeriods || []).find((p) => p.from <= iso && iso <= (p.to || p.from));
  if (hit) return { off: true, reason: hit.reason || 'Ngày nghỉ', kind: 'holiday' };
  const wd = weekdayOf(iso);
  if (wd === 6) return { off: true, reason: 'Thứ Bảy', kind: 'weekend' };
  if (wd === 0) return { off: true, reason: 'Chủ nhật', kind: 'weekend' };
  return { off: false, reason: null, kind: null };
}

export function validateOffPeriod(p: OffPeriod): string | null {
  if (!ISO.test(p.from)) return 'Chọn ngày bắt đầu.';
  if (p.to && !ISO.test(p.to)) return 'Ngày kết thúc không hợp lệ.';
  if ((p.to || p.from) < p.from) return 'Ngày kết thúc phải sau ngày bắt đầu.';
  if (!p.reason.trim()) return 'Nhập lý do nghỉ (vd. Nghỉ Tết Nguyên đán).';
  if (p.reason.trim().length > 100) return 'Lý do tối đa 100 ký tự.';
  return null;
}

/** Thêm khoảng nghỉ, sắp theo ngày; trùng y hệt thì bỏ qua. */
export function addOffPeriod(list: OffPeriod[], p: OffPeriod): OffPeriod[] {
  const clean = { from: p.from, to: p.to || p.from, reason: p.reason.trim() };
  if (list.some((x) => x.from === clean.from && x.to === clean.to)) return list.map((x) => (x.from === clean.from && x.to === clean.to ? clean : x));
  return [...list, clean].sort((a, b) => a.from.localeCompare(b.from));
}

/** Số ngày học (T2–T6) bị nghỉ trong khoảng — để BGH thấy ảnh hưởng. */
export function countSchoolDaysOff(p: OffPeriod): number {
  let n = 0;
  const [y, m, d] = p.from.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const end = p.to || p.from;
  for (let i = 0; i < 400; i++) {
    const iso = cur.toISOString().slice(0, 10);
    if (iso > end) break;
    const wd = cur.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

export function formatOffPeriod(p: OffPeriod): string {
  const vi = (iso: string) => iso.split('-').reverse().join('/');
  return p.to && p.to !== p.from ? `${vi(p.from)} – ${vi(p.to)}` : vi(p.from);
}

/** Các ngày nghỉ BGH khai (yyyy-mm-dd) nằm trong khoảng — dùng để không tính tiết "dự kiến" ngày nghỉ. */
export function offDatesBetween(calendar: SchoolCalendar | null | undefined, start: string, end: string): string[] {
  const out: string[] = [];
  for (const p of calendar?.offPeriods || []) {
    const [y, m, d] = p.from.split('-').map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    for (let i = 0; i < 400; i++) {
      const iso = cur.toISOString().slice(0, 10);
      if (iso > (p.to || p.from) || iso > end) break;
      if (iso >= start) out.push(iso);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return [...new Set(out)].sort();
}
