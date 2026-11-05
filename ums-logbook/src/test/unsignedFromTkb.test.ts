import { describe, it, expect } from 'vitest';
import { calculateWeeklySummary } from '../services/summaryService';
import { periodOver, isSummaryStale } from '../hooks/useWeeklySummary';

// Tuần 10 năm học 2026-2027: 09/11 → 13/11 (Thứ Hai = 2)
const W = 10;
const slots = [
  { dayOfWeek: 2, periodIndex: 1, subject: 'Civics', teacherName: 'M.L.(Civic)' },
  { dayOfWeek: 2, periodIndex: 2, subject: 'S.Sci Geo', teacherName: 'Ms Xuân' },
  { dayOfWeek: 2, periodIndex: 3, subject: 'NN2_1', teacherName: 'NN2_1' },
  { dayOfWeek: 3, periodIndex: 1, subject: 'Maths', teacherName: 'Ms Linh' },
];
const signed = (dailyId: string, periodIndex: number) =>
  ({ dailyId, periodIndex, isSigned: true, subject: 'X', scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 } }) as any;

describe('Tiết chưa ký: lấy TKB làm chuẩn (lỗi BGH chỉ thấy 1 tiết)', () => {
  it('tiết có trên TKB mà GV chưa mở cũng bị liệt kê, gắn notStarted', () => {
    const s = calculateWeeklySummary('9A2', W, [], { '9A2_2026-11-09': [signed('9A2_2026-11-09', 2)] }, {
      tkbSlots: slots,
      today: '2026-11-10',
      isMixedSlot: (subj) => subj.startsWith('NN2'),
    });
    expect(s.unsignedPeriods.map((p) => `${p.date}#${p.periodIndex}`)).toEqual(['2026-11-09#1', '2026-11-10#1']);
    expect(s.unsignedPeriods.every((p) => p.notStarted)).toBe(true);
    expect(s.unsignedPeriods[0]).toMatchObject({ subject: 'Civics', teacherName: 'M.L.(Civic)' });
  });

  it('không đòi ký: ngày sau hôm nay, ngày nghỉ, tiết lớp trộn, tiết hôm nay chưa hết giờ', () => {
    const s = calculateWeeklySummary('9A2', W, [], {}, {
      tkbSlots: slots,
      today: '2026-11-10',
      isOffDate: (d) => d === '2026-11-09',
      isPeriodOver: (d, p) => !(d === '2026-11-10' && p === 1),
      isMixedSlot: (subj) => subj.startsWith('NN2'),
    });
    expect(s.unsignedPeriods).toEqual([]);
  });

  it('tiết đã mở chưa ký vẫn trừ điểm; tiết chưa mở chỉ cảnh báo (điểm thi đua giữ cách tính cũ)', () => {
    const draft = { dailyId: '9A2_2026-11-09', periodIndex: 1, isSigned: false, subject: 'Civics', teacherName: 'Thầy L' } as any;
    const withTkb = calculateWeeklySummary('9A2', W, [], { '9A2_2026-11-09': [draft] }, { tkbSlots: slots, today: '2026-11-09' });
    const without = calculateWeeklySummary('9A2', W, [], { '9A2_2026-11-09': [draft] });
    expect(withTkb.unsignedPeriods.length).toBe(3); // tiết 1 (nháp) + tiết 2, 3 chưa mở (không truyền isMixedSlot)
    expect(withTkb.unsignedPeriods.filter((p) => !p.notStarted)).toHaveLength(1);
    expect(withTkb.emulationScore).toBe(without.emulationScore);
  });

  it('không truyền TKB → giữ hành vi cũ', () => {
    const s = calculateWeeklySummary('9A2', W, [], {});
    expect(s.unsignedPeriods).toEqual([]);
  });
});

describe('periodOver', () => {
  const now = new Date(2026, 10, 10, 9, 0); // 10/11 09:00
  it('ngày trước: rồi; ngày sau: chưa; hôm nay theo giờ chuông', () => {
    expect(periodOver('2026-11-09', 8, now)).toBe(true);
    expect(periodOver('2026-11-11', 1, now)).toBe(false);
    expect(periodOver('2026-11-10', 1, now)).toBe(true);
    expect(periodOver('2026-11-10', 8, now)).toBe(false);
  });
});

describe('isSummaryStale — bản tổng kết lưu sẵn bị cũ (BGH chỉ thấy 1 tiết chưa ký)', () => {
  const now = new Date(2026, 10, 5, 10, 0).getTime();
  it('mới lưu < 10 phút: dùng bản lưu', () => {
    expect(isSummaryStale(now - 5 * 60_000, '2026-11-06', now)).toBe(false);
  });
  it('lưu > 10 phút, tuần đang diễn ra hoặc vừa qua: tính lại', () => {
    expect(isSummaryStale(now - 60 * 60_000, '2026-11-06', now)).toBe(true);
    expect(isSummaryStale(now - 60 * 60_000, '2026-10-16', now)).toBe(true);
  });
  it('tuần đã qua > 30 ngày: giữ bản lưu (đỡ đọc); chưa có thời điểm lưu: tính lại', () => {
    expect(isSummaryStale(now - 60 * 60_000, '2026-09-11', now)).toBe(false);
    expect(isSummaryStale(undefined, '2026-09-11', now)).toBe(true);
  });
});
