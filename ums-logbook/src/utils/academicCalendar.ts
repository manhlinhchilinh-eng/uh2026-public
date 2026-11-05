/**
 * Năm học / học kỳ / tuần học tính theo NGÀY (thay cho các giá trị ghi cứng "2026-2027", "Học kỳ 1", "Tuần 5").
 * - Năm học bắt đầu tháng 8 (chuẩn bị) — tháng 8..12 thuộc năm học mới.
 * - Học kỳ I: 01/09 → 15/01; học kỳ II: 16/01 → hết năm học (khớp utils/conductSummary.termRanges).
 * - Tuần 1 bắt đầu thứ Hai đầu tiên kể từ 01/09 (năm 2026: 07/09).
 * Hàm thuần.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Ngày hôm nay theo giờ máy (không lệch UTC). */
export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function academicYearOf(iso: string): string {
  const d = parse(iso);
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function semesterOf(iso: string): 1 | 2 {
  const d = parse(iso);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (m >= 8) return 1;
  if (m === 1 && day <= 15) return 1;
  return 2;
}

/** Thứ Hai của tuần 1 năm học (thứ Hai đầu tiên kể từ 01/09 năm đầu). */
export function week1Monday(academicYear: string): string {
  const y = parseInt(academicYear.split('-')[0], 10);
  const sep1 = new Date(Date.UTC(y, 8, 1));
  const wd = sep1.getUTCDay(); // 0 = CN
  const add = (8 - wd) % 7; // tới thứ Hai gần nhất (0 nếu đã là thứ Hai)
  return toIso(new Date(sep1.getTime() + add * 86_400_000));
}

/** Tuần học (≥ 1) của ngày, trong năm học của ngày đó. */
export function weekNumberOf(iso: string): number {
  const start = parse(week1Monday(academicYearOf(iso)));
  const diff = Math.floor((parse(iso).getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

/** Các ngày T2–T6 của tuần học thứ N. */
export function weekDates(weekNumber: number, academicYear: string): string[] {
  const mon = parse(week1Monday(academicYear)).getTime() + (weekNumber - 1) * 7 * 86_400_000;
  return [0, 1, 2, 3, 4].map((i) => toIso(new Date(mon + i * 86_400_000)));
}

export function currentAcademic(today: string = localToday()) {
  return { academicYear: academicYearOf(today), semester: semesterOf(today), weekNumber: weekNumberOf(today) };
}

/**
 * Các tuần học (1..35) thuộc tháng `month` (1..12) năm `year`.
 * Quy tắc: tuần thuộc tháng chứa đa số ngày học T2–T6 (tức tháng của ngày thứ Tư trong tuần),
 * đảm bảo mỗi tuần thuộc đúng 1 tháng, không trùng lặp.
 */
export function weeksInMonth(
  month: number,
  year: number,
  academicYear: string = academicYearOf(`${year}-${pad(month)}-15`)
): number[] {
  const prefix = `${year}-${pad(month)}-`;
  const out: number[] = [];
  for (let w = 1; w <= 35; w++) {
    const days = weekDates(w, academicYear);
    if (days[2]?.startsWith(prefix)) {
      out.push(w);
    }
  }
  return out;
}

/** "2026-2027" → "2026 - 2027" (dạng in trên sổ). */
export const displayYear = (academicYear: string) => academicYear.replace('-', ' - ');

