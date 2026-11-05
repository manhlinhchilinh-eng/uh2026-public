import { describe, it, expect } from 'vitest';
import { buildConductSummary, suggestComment, termRanges } from '../utils/conductSummary';

const students = [
  { mhs: '1', fullName: 'HS Một', stt: 2 },
  { mhs: '2', fullName: 'HS Hai', stt: 1 },
];
const n = (studentId: string, type: 'positive' | 'negative', category: string, date: string) => ({ studentId, type, category, content: '', date });
const notes = [
  n('1', 'positive', 'active_participation', '2026-10-05'),
  n('1', 'positive', 'active_participation', '2026-10-06'),
  n('1', 'positive', 'peer_support', '2026-10-07'),
  n('1', 'negative', 'missing_homework', '2026-10-08'),
  n('1', 'negative', 'phone_usage', '2026-12-01'), // ngoài khoảng tháng 10
  n('2', 'negative', 'missing_homework', '2026-10-02'),
  n('2', 'negative', 'missing_homework', '2026-10-09'),
];
const att = [
  { mhs: '2', morning: 'K', afternoon: 'K' },
  { mhs: '2', morning: 'P', afternoon: null },
  { mhs: '1', morning: 'Late', afternoon: null },
];

describe('Tổng hợp nề nếp cho nhận xét học bạ', () => {
  const r = buildConductSummary(students, notes, att, { from: '2026-10-01', to: '2026-10-31' });

  it('đếm khen/nhắc trong khoảng thời gian, sắp theo STT', () => {
    expect(r.map((x) => x.mhs)).toEqual(['2', '1']);
    expect(r[1]).toMatchObject({ positive: 3, negative: 1, topPositive: ['Phát biểu tích cực (2)', expect.any(String)] });
    expect(r[0]).toMatchObject({ positive: 0, negative: 2, unexcused: 2, excused: 1 });
  });

  it('gợi ý nhận xét theo ghi nhận', () => {
    expect(r[1].suggestion).toMatch(/^Có nhiều biểu hiện tích cực, nổi bật: phát biểu tích cực/);
    expect(r[1].suggestion).toMatch(/Cần khắc phục:/);
    expect(r[0].suggestion).toMatch(/Cần khắc phục: .*\. Nghỉ không phép 2 buổi/);
    expect(suggestComment({ positive: 0, negative: 0, topPositive: [], topNegative: [], unexcused: 0 })).toMatch(/Chấp hành tốt nội quy/);
  });

  it('mốc học kỳ theo năm học', () => {
    const t = termRanges('2026-2027', '2026-10-10');
    expect(t.find((x) => x.id === 'month')).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(t.find((x) => x.id === 'hk1')).toMatchObject({ from: '2026-09-01', to: '2027-01-15' });
    expect(t.find((x) => x.id === 'year')?.to).toBe('2027-05-31');
  });
});
