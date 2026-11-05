import { describe, it, expect } from 'vitest';
import { rankClasses, weekOf, monthOf } from '../utils/logbookRanking';
import { offDatesBetween } from '../utils/schoolCalendar';

const row = (classId: string, avgScore: number | null, signedRate: number | null) => ({
  classId, grade: 6, expectedPeriods: 40, signedPeriods: 0, signedRate, avgScore, absP: 0, absK: 0, late: 0, positive: 0, negative: 0,
});

describe('Tổng kết sổ đầu bài toàn trường', () => {
  it('xếp hạng theo điểm TB, đồng hạng khi bằng nhau, lớp chưa ký không xếp', () => {
    const r = rankClasses([row('6A1', 9.2, 1), row('6A2', null, 0), row('6A3', 9.5, 0.9), row('6A4', 9.2, 1), row('6A5', 9.2, 0.5)]);
    expect(r.map((x) => `${x.classId}:${x.rank}`)).toEqual(['6A3:1', '6A1:2', '6A4:2', '6A5:4', '6A2:null']);
  });

  it('tuần T2–T6, tháng đủ ngày', () => {
    expect(weekOf('2026-10-10')).toEqual({ start: '2026-10-05', end: '2026-10-09' }); // T7 → tuần đó
    expect(weekOf('2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-16' });
    expect(monthOf('2027-02')).toEqual({ start: '2027-02-01', end: '2027-02-28' });
  });

  it('ngày nghỉ BGH khai trong khoảng', () => {
    const cal = { offPeriods: [{ from: '2026-10-08', to: '2026-10-13', reason: 'x' }] };
    expect(offDatesBetween(cal, '2026-10-05', '2026-10-09')).toEqual(['2026-10-08', '2026-10-09']);
  });
});
