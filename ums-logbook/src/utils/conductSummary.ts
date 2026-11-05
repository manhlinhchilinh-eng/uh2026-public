/**
 * Tổng hợp ghi nhận trong sổ đầu bài (khen/nhắc nhở/vi phạm) + chuyên cần theo từng HS,
 * gợi ý câu nhận xét để GVCN dùng khi viết học bạ. Hàm thuần — không gọi Firebase.
 */

import { BEHAVIOR_CATEGORY_MAP } from '../types/behavior';

export interface ConductNote {
  studentId: string;
  type: 'positive' | 'negative';
  category: string;
  content: string;
  date: string;
}

export interface ConductAttendance {
  mhs: string;
  morning: string | null;
  afternoon: string | null;
}

export interface StudentConduct {
  mhs: string;
  fullName: string;
  stt: number;
  positive: number;
  negative: number;
  topPositive: string[];
  topNegative: string[];
  excused: number;
  unexcused: number;
  suggestion: string;
}

export interface TermRange {
  id: string;
  label: string;
  from: string;
  to: string;
}

/** Mốc mặc định của năm học (có thể sửa trên màn hình). Năm học bắt đầu tháng 9. */
export function termRanges(academicYear: string, today: string): TermRange[] {
  const [y1, y2] = academicYear.split('-').map(Number);
  const month = today.slice(0, 7);
  const [ty, tm] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return [
    { id: 'month', label: `Tháng ${tm}/${ty}`, from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` },
    { id: 'hk1', label: 'Học kỳ I', from: `${y1}-09-01`, to: `${y2}-01-15` },
    { id: 'hk2', label: 'Học kỳ II', from: `${y2}-01-16`, to: `${y2}-05-31` },
    { id: 'year', label: 'Cả năm', from: `${y1}-09-01`, to: `${y2}-05-31` },
  ];
}

const labelOf = (category: string) => BEHAVIOR_CATEGORY_MAP[category]?.labelVi || category;

function topLabels(notes: ConductNote[], n = 2): string[] {
  const count = new Map<string, number>();
  notes.forEach((x) => count.set(labelOf(x.category), (count.get(labelOf(x.category)) || 0) + 1));
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi')).slice(0, n).map(([k, v]) => (v > 1 ? `${k} (${v})` : k));
}

const strip = (s: string) => s.replace(/\s*\(\d+\)$/, '').toLowerCase();

/** Câu gợi ý nhận xét — chỉ là bản nháp để GVCN sửa, không tự đưa vào học bạ. */
export function suggestComment(c: Pick<StudentConduct, 'positive' | 'negative' | 'topPositive' | 'topNegative' | 'unexcused'>): string {
  const parts: string[] = [];
  if (c.positive === 0 && c.negative === 0) parts.push('Chấp hành tốt nội quy, chưa có ghi nhận đặc biệt trong kỳ.');
  else if (c.positive >= c.negative * 2) {
    parts.push(`Có nhiều biểu hiện tích cực${c.topPositive.length ? `, nổi bật: ${c.topPositive.map(strip).join(', ')}` : ''}.`);
  } else if (c.positive > 0) {
    parts.push(`Có tiến bộ${c.topPositive.length ? ` (${c.topPositive.map(strip).join(', ')})` : ''}.`);
  }
  if (c.negative > 0 && c.topNegative.length) {
    parts.push(`Cần khắc phục: ${c.topNegative.map(strip).join(', ')}.`);
  }
  if (c.unexcused > 0) parts.push(`Nghỉ không phép ${c.unexcused} buổi, cần chú ý chuyên cần.`);
  return parts.join(' ');
}

export function buildConductSummary(
  students: Array<{ mhs: string; fullName: string; stt?: number }>,
  notes: ConductNote[],
  attendance: ConductAttendance[],
  range: { from: string; to: string }
): StudentConduct[] {
  const inRange = notes.filter((n) => n.date >= range.from && n.date <= range.to);
  return students
    .map((s, i) => {
      const mine = inRange.filter((n) => n.studentId === s.mhs);
      const pos = mine.filter((n) => n.type === 'positive');
      const neg = mine.filter((n) => n.type === 'negative');
      const att = attendance.filter((a) => a.mhs === s.mhs);
      const sessions = att.flatMap((a) => [a.morning, a.afternoon]).filter(Boolean) as string[];
      const row = {
        mhs: s.mhs,
        fullName: s.fullName,
        stt: s.stt ?? i + 1,
        positive: pos.length,
        negative: neg.length,
        topPositive: topLabels(pos),
        topNegative: topLabels(neg),
        excused: sessions.filter((x) => x === 'P').length,
        unexcused: sessions.filter((x) => x === 'K').length,
      };
      return { ...row, suggestion: suggestComment(row) };
    })
    .sort((a, b) => a.stt - b.stt);
}
