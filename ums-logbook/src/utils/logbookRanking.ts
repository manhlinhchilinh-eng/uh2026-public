/**
 * Tổng kết điểm sổ đầu bài toàn trường theo tuần/tháng (TPT, BGH, Giám thị) — từ dữ liệu thật.
 * Xếp hạng theo điểm tiết trung bình; chưa gộp sổ cờ đỏ (chưa có trong hệ thống). Hàm thuần.
 */

import type { ClassStats } from './dashboard';

export interface RankedClass extends ClassStats {
  rank: number | null;
}

/** Thứ Hai – Thứ Sáu của tuần chứa ngày đó. */
export function weekOf(iso: string): { start: string; end: string } {
  const d = new Date(iso + 'T00:00:00Z');
  const wd = d.getUTCDay() || 7;
  const mon = new Date(d.getTime() - (wd - 1) * 86_400_000);
  const fri = new Date(mon.getTime() + 4 * 86_400_000);
  return { start: mon.toISOString().slice(0, 10), end: fri.toISOString().slice(0, 10) };
}

export function monthOf(yyyyMm: string): { start: string; end: string } {
  const [y, m] = yyyyMm.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${yyyyMm}-01`, end: `${yyyyMm}-${String(last).padStart(2, '0')}` };
}

/** Xếp hạng: điểm TB tiết cao hơn đứng trước; bằng điểm thì lớp ký sổ đủ hơn đứng trước. Lớp chưa có tiết ký: không xếp hạng. */
export function rankClasses(rows: ClassStats[]): RankedClass[] {
  const scored = rows.filter((r) => r.avgScore != null).sort((a, b) => b.avgScore! - a.avgScore! || (b.signedRate ?? 0) - (a.signedRate ?? 0) || a.classId.localeCompare(b.classId));
  const ranked: RankedClass[] = [];
  scored.forEach((r, i) => {
    const prev = ranked[i - 1];
    const same = prev && prev.avgScore === r.avgScore && prev.signedRate === r.signedRate;
    ranked.push({ ...r, rank: same ? prev.rank : i + 1 });
  });
  const unscored = rows.filter((r) => r.avgScore == null).sort((a, b) => a.classId.localeCompare(b.classId)).map((r) => ({ ...r, rank: null }));
  return [...ranked, ...unscored];
}
