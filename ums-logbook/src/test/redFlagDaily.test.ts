import { describe, it, expect } from 'vitest';
import {
  computeClassSdb,
  dailyRanks,
  redFlagDeductions,
  redFlagForDay,
  redFlagForWeek,
  redFlagForWeeks,
  type RedFlagDaily,
  type RedFlagWeekly,
  type SdbInput,
} from '../utils/tptRanking';
import { parseSaoDoDate, parseSaoDoSheets } from '../utils/saoDoImport';

const W1 = '2026-11-02';
const W2 = '2026-11-09';
const day = (date: string, weekStart: string, classes: Record<string, number>): RedFlagDaily => ({
  id: date,
  date,
  weekStart,
  classes: Object.fromEntries(Object.entries(classes).map(([c, d]) => [c, { d, n: d > 0 ? 1 : 0, items: [] }])),
});

describe('Sổ cờ đỏ theo ngày (100đ/tuần, trừ theo lỗi)', () => {
  const daily = [day('2026-11-04', W1, { '6A1': 3, '6A2': 0 }), day('2026-11-05', W1, { '6A1': 6, '6A2': 3 })];

  it('điểm ngày = 100 − điểm trừ trong ngày, quy thang 80', () => {
    expect(redFlagForDay(daily, '2026-11-05')).toEqual({ '6A1': 75.2, '6A2': 77.6 });
    expect(redFlagForDay(daily, '2026-11-06')).toEqual({});
  });

  it('điểm tuần = 100 − tổng trừ cả tuần; tuần không có sổ ngày → dùng điểm tuần nhập tay', () => {
    expect(redFlagForWeek([], daily, W1)).toEqual({ '6A1': 72.8, '6A2': 77.6 });
    const weekly: RedFlagWeekly[] = [
      { id: `${W2}_6A1`, weekStart: W2, classId: '6A1', score: 90, maxScore: 100 },
      { id: `${W1}_6A1`, weekStart: W1, classId: '6A1', score: 50, maxScore: 100 },
    ];
    // Tuần 1 có sổ ngày → sổ ngày thắng; tuần 2 chỉ có nhập tay
    expect(redFlagForWeek(weekly, daily, W1)['6A1']).toBe(72.8);
    expect(redFlagForWeek(weekly, daily, W2)).toEqual({ '6A1': 72 });
  });

  it('điểm tháng = trung bình các tuần có dữ liệu', () => {
    const d2 = [...daily, day('2026-11-10', W2, { '6A1': 0, '6A2': 20 })];
    // 6A1: tuần1 91 → 72.8, tuần2 100 → 80 → TB 76.4; 6A2: 97 → 77.6, 80 → 64 → 70.8
    expect(redFlagForWeeks([], d2, [W1, W2])).toEqual({ '6A1': 76.4, '6A2': 70.8 });
  });

  it('tổng điểm trừ + số lỗi trong kỳ', () => {
    expect(redFlagDeductions(daily)).toEqual({ '6A1': { d: 9, n: 2 }, '6A2': { d: 3, n: 1 } });
  });

  it('điểm trừ vượt 100 không âm', () => {
    expect(redFlagForDay([day('2026-11-04', W1, { '6A1': 130 })], '2026-11-04')).toEqual({ '6A1': 0 });
  });
});

describe('Xếp hạng từng ngày = (SĐB ngày×2 + Cờ đỏ ngày)/3', () => {
  const slots = { slots: [4, 5].flatMap((dow) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => ({ dayOfWeek: dow, periodIndex: p, subject: 'Maths', teacherName: 'GV' }))) } as any;
  const signed = (p: number, total = 10) => ({ periodIndex: p, isSigned: true, scores: { total } }) as any;
  const all = (t = 10) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => signed(p, t));
  const input: SdbInput = {
    start: '2026-11-04',
    end: '2026-11-05',
    holidays: [],
    classIds: ['6A1', '6A2'],
    schedules: { '6A1': slots, '6A2': slots },
    periodsByDaily: {
      '6A1_2026-11-04': all(10),
      '6A2_2026-11-04': all(10),
      '6A1_2026-11-05': all(10),
      '6A2_2026-11-05': all(9),
    },
  };
  const rows = ['6A1', '6A2'].map((c) => computeClassSdb(c, input));

  it('hạng mỗi hôm tính riêng: 04/11 6A2 không lỗi đứng đầu, 05/11 6A1 SĐB cao hơn đứng đầu', () => {
    const daily = [day('2026-11-04', W1, { '6A1': 3, '6A2': 0 }), day('2026-11-05', W1, { '6A1': 3, '6A2': 3 })];
    const r = dailyRanks(rows, daily);
    expect(r['2026-11-04']['6A2']).toMatchObject({ sdb: 80, redFlag: 80, score: 80, rank: 1, provisional: false });
    expect(r['2026-11-04']['6A1']).toMatchObject({ redFlag: 77.6, score: 79.2, rank: 2 });
    // 05/11: 6A1 SĐB 80, 6A2 SĐB 72; cùng −3
    expect(r['2026-11-05']['6A1'].rank).toBe(1);
    expect(r['2026-11-05']['6A2']).toMatchObject({ sdb: 72, score: 73.87, rank: 2 });
  });

  it('ngày chưa có sổ cờ đỏ: xếp hạng tạm theo SĐB', () => {
    const r = dailyRanks(rows, []);
    expect(r['2026-11-05']['6A2']).toMatchObject({ score: 72, provisional: true, rank: 2 });
  });
});

describe('Đọc file "GUMS - Sổ Sao Đỏ"', () => {
  const head = [null, null, 'LỚP 6A1', null, 'STT', 'NGÀY / THÁNG', 'HỌ VÀ TÊN', 'LỖI VI PHẠM', 'ĐIỂM TRỪ'];
  const rulesRow = ['Học sinh đi học muộn', null, 'Trừ 3 điểm', null, null, null, null, null, null];
  const v = (date: unknown, name: string, viol: string, pts: unknown) => ['NỘI DUNG', null, 'ĐIỂM TRỪ', null, null, date, name, viol, pts];

  it('ngày: số serial Excel, Date, "5/11/2026", "5/112026" (thiếu dấu /)', () => {
    expect(parseSaoDoDate(46331)).toBe('2026-11-05');
    expect(parseSaoDoDate(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(parseSaoDoDate('5/11/2026')).toBe('2026-11-05');
    expect(parseSaoDoDate('5/112026')).toBe('2026-11-05');
    expect(parseSaoDoDate('abc')).toBeNull();
  });

  it('gom điểm trừ theo lớp/ngày, không giữ tên HS; bỏ dòng ngày tương lai; lớp không lỗi = trừ 0', () => {
    const r = parseSaoDoSheets(
      [
        { name: 'TRANG CHỦ', rows: [['x']] },
        { name: 'LỚP 6A1', rows: [head, v(46331, 'Diệu Anh ', 'Đi học muộn ', 3), rulesRow, v('5/112026', 'B', 'Đi học muộn', 3), v(46331, 'C', 'Không đeo khăn đỏ', 1)] },
        { name: 'LỚP 6A2', rows: [head.map((h) => (h === 'LỚP 6A1' ? 'LỚP 6A2' : h)), rulesRow] },
        { name: 'LỚP 7A1', rows: [head, v(46333, 'D', 'Đi học muộn ', 3)] },
      ],
      ['6A1', '6A2', '7A1'],
      '2026-11-05'
    );
    expect(r.classIds).toEqual(['6A1', '6A2', '7A1']);
    expect(Object.keys(r.byDate)).toEqual(['2026-11-05']);
    expect(r.byDate['2026-11-05']['6A1']).toEqual({
      d: 7,
      n: 3,
      items: [
        { v: 'Đi học muộn', p: 3, n: 2 },
        { v: 'Không đeo khăn đỏ', p: 1, n: 1 },
      ],
    });
    expect(r.byDate['2026-11-05']['6A2']).toEqual({ d: 0, n: 0, items: [] });
    expect(r.byDate['2026-11-05']['7A1']).toEqual({ d: 0, n: 0, items: [] });
    expect(r.future).toEqual([{ classId: '7A1', date: '2026-11-07', violation: 'Đi học muộn', points: 3 }]);
    expect(JSON.stringify(r.byDate)).not.toMatch(/Diệu Anh/);
    expect(r.errors).toEqual([]);
  });

  it('sheet mất dòng tiêu đề (như 9A1) → đọc theo bố cục chuẩn F/H/I', () => {
    const r = parseSaoDoSheets([{ name: 'LỚP 9A1', rows: [[null, null, 'LỚP 9A1'], v(46331, 'A', 'Đi học muộn ', 3)] }], ['9A1'], '2026-11-05');
    expect(r.byDate['2026-11-05']['9A1'].d).toBe(3);
    expect(r.errors).toEqual([]);
  });

  it('dòng có điểm nhưng không đọc được ngày → báo lỗi', () => {
    const r = parseSaoDoSheets([{ name: 'LỚP 6A1', rows: [head, v('hôm qua', 'A', 'Đi học muộn', 3)] }], ['6A1'], '2026-11-05');
    expect(r.errors[0]).toMatch(/không đọc được ngày/);
  });
});
