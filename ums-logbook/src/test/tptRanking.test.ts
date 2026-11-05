import { describe, it, expect } from 'vitest';
import {
  computeClassSdb,
  forgottenByTeacher,
  isDefault10,
  parseRedFlagPaste,
  rankTpt,
  redFlagForRange,
  redFlagTo80,
  schoolDays,
  weekStartOf,
  weekStartsBetween,
  type SdbInput,
} from '../utils/tptRanking';

// Tuần 09/11 (T2) → 13/11 (T6) năm 2026
const MON = '2026-11-09';
const FRI = '2026-11-13';
const slots = (classId: string, subjectOf: (dow: number, p: number) => string = () => 'Maths') => ({
  slots: [2, 3, 4, 5, 6].flatMap((dow) =>
    [1, 2, 3, 4, 5, 6, 7, 8].map((p) => ({ dayOfWeek: dow, periodIndex: p, subject: subjectOf(dow, p), teacherName: `GV ${p}`, teacherUsername: '' }))
  ),
  classId,
});
const signed = (periodIndex: number, total = 10) => ({ periodIndex, isSigned: true, scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total } }) as any;
const fullDay = (total = 10) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => signed(p, total));

const base = (over: Partial<SdbInput> = {}): SdbInput => ({
  start: MON,
  end: FRI,
  holidays: [],
  classIds: ['7A1'],
  schedules: { '7A1': slots('7A1') as any },
  periodsByDaily: {},
  ...over,
});

describe('SĐB theo quy chế TPT', () => {
  it('1 ngày đủ 8 tiết 10đ = 80', () => {
    const r = computeClassSdb('7A1', base({ end: MON, periodsByDaily: { [`7A1_${MON}`]: fullDay() } }));
    expect(r.days).toEqual([{ date: MON, score: 80, max: 80, weight: 1, signed: 8, default10: 0, unsigned: 0 }]);
    expect(r.sdb).toBe(80);
  });

  it('1 tuần đủ điểm = 360 (chiều thứ 6 không chấm), trung bình ngày = 80', () => {
    const periodsByDaily = Object.fromEntries(schoolDays(MON, FRI).map((d) => [`7A1_${d}`, fullDay()]));
    const r = computeClassSdb('7A1', base({ periodsByDaily }));
    expect(r.total).toBe(360);
    expect(r.totalMax).toBe(360);
    expect(r.sdb).toBe(80);
    expect(r.days.find((d) => d.date === FRI)).toMatchObject({ score: 40, max: 40, weight: 0.5, signed: 4 });
  });

  it('điểm ngày = TB tiết × 8: tiết 9đ cả ngày → 72', () => {
    const r = computeClassSdb('7A1', base({ end: MON, periodsByDaily: { [`7A1_${MON}`]: fullDay(9) } }));
    expect(r.sdb).toBe(72);
  });

  it('NN2 / Native / test prep & Eng 1 khối 9: mặc định 10đ dù GV không ký', () => {
    expect(isDefault10('6A1', 'Foreign language 2')).toBe(true);
    expect(isDefault10('7A2', 'Native 2')).toBe(true);
    expect(isDefault10('9A1', 'Literature test prep')).toBe(true);
    expect(isDefault10('9A1', 'Maths test prep')).toBe(true);
    expect(isDefault10('9A1', 'Eng 1')).toBe(true);
    expect(isDefault10('7A1', 'Eng 1')).toBe(false);
    expect(isDefault10('9A1', 'Eng Test prep')).toBe(false);
    expect(isDefault10('9A1', 'Homeroom')).toBe(false);
    const sch = slots('9A1', (_d, p) => (p <= 2 ? 'Foreign language 2' : 'Maths'));
    const r = computeClassSdb('9A1', base({ end: MON, classIds: ['9A1'], schedules: { '9A1': sch as any }, periodsByDaily: { [`9A1_${MON}`]: [3, 4, 5, 6, 7, 8].map((p) => signed(p, 8)) } }));
    // 2 tiết ×10 + 6 tiết ×8 = 68 → TB 8.5 × 8 = 68
    expect(r.days[0]).toMatchObject({ score: 68, default10: 2, signed: 6 });
  });

  it('tiết chưa ký: lớp được 0đ tiết đó (không trừ thêm −2đ), ghi nhận cho GV bộ môn', () => {
    const r = computeClassSdb('7A1', base({ end: MON, periodsByDaily: { [`7A1_${MON}`]: [1, 2, 3, 4, 5, 6, 7].map((p) => signed(p)) } }));
    expect(r.days[0]).toMatchObject({ score: 70, max: 80, signed: 7, unsigned: 1 });
    expect(r.sdb).toBe(70);
    expect(r.forgotten).toEqual([{ date: MON, classId: '7A1', periodIndex: 8, subject: 'Maths', teacherName: 'GV 8' }]);
    expect(forgottenByTeacher([r])).toEqual([{ teacherName: 'GV 8', count: 1, items: r.forgotten }]);
  });

  it('tiết chưa học (chưa qua giờ) không tính là quên ký; ngày chưa có tiết nào tính được bị loại khỏi mẫu số', () => {
    const r = computeClassSdb('7A1', base({
      end: '2026-11-10',
      periodsByDaily: { [`7A1_${MON}`]: fullDay() },
      isPeriodOver: (d) => d === MON,
    }));
    expect(r.days.map((d) => d.date)).toEqual([MON]);
    expect(r.forgotten).toEqual([]);
    expect(r.sdb).toBe(80);
  });

  it('lớp chưa ai ký chỉ được điểm tiết mặc định 10đ — không đứng đầu', () => {
    const sch = slots('6A2', (_d, p) => (p <= 2 ? 'Native 2' : 'Maths'));
    const empty = computeClassSdb('6A2', base({ end: MON, classIds: ['6A2'], schedules: { '6A2': sch as any } }));
    expect(empty.days[0]).toMatchObject({ score: 20, max: 80, default10: 2, unsigned: 6 });
    expect(empty.sdb).toBe(20);
    expect(empty.forgotten).toHaveLength(6);
    const real = computeClassSdb('6A1', base({ end: MON, classIds: ['6A1'], schedules: { '6A1': sch as any }, periodsByDaily: { [`6A1_${MON}`]: [3, 4, 5, 6, 7, 8].map((p) => signed(p, 9)) } }));
    expect(real.sdb).toBe(74);
    expect(rankTpt([empty, real], {}).map((r) => [r.classId, r.rank])).toEqual([['6A1', 1], ['6A2', 2]]);
  });

  it('ví dụ người dùng (05/11): hôm qua ký 2 tiết, hôm nay 4 tiết (đều 10đ), 8 tiết đã học mỗi ngày → 60/160 = 30, KHÔNG phải 80', () => {
    const r = computeClassSdb('6A1', base({
      start: '2026-11-02', end: '2026-11-05', classIds: ['6A1'], schedules: { '6A1': slots('6A1') as any },
      periodsByDaily: { '6A1_2026-11-04': [1, 2].map((p) => signed(p)), '6A1_2026-11-05': [1, 2, 3, 4].map((p) => signed(p)) },
    }));
    expect(r.days.map((d) => [d.date, d.score, d.max])).toEqual([['2026-11-04', 20, 80], ['2026-11-05', 40, 80]]);
    expect(r.total).toBe(60);
    expect(r.totalMax).toBe(160);
    expect(r.sdb).toBe(30);
  });

  it('chỉ tính từ 04/11/2026 (ngày bắt đầu ký sổ thật); hôm nay chỉ tính tiết đã học', () => {
    const r = computeClassSdb('6A1', base({
      start: '2026-11-02', end: '2026-11-05', classIds: ['6A1'], schedules: { '6A1': slots('6A1') as any },
      periodsByDaily: { '6A1_2026-11-05': [1, 2].map((p) => signed(p)) },
      isPeriodOver: (d, p) => d < '2026-11-05' || p <= 4, // 05/11 mới học 4 tiết
    }));
    expect(r.days.map((d) => [d.date, d.score, d.max])).toEqual([['2026-11-04', 0, 80], ['2026-11-05', 20, 40]]);
    expect(r.sdb).toBe(13.33);
  });

  it('ngày nghỉ lễ loại khỏi mẫu số', () => {
    const periodsByDaily = Object.fromEntries(schoolDays(MON, FRI).map((d) => [`7A1_${d}`, fullDay()]));
    const r = computeClassSdb('7A1', base({ holidays: ['2026-11-11'], periodsByDaily }));
    expect(r.days).toHaveLength(4);
    expect(r.totalMax).toBe(280);
    expect(r.sdb).toBe(80);
  });
});

describe('Thi đua = (SĐB×2 + Cờ đỏ)/3', () => {
  const row = (classId: string, sdb: number | null) => ({ classId, grade: 7, days: [], sdb, total: 0, totalMax: 0, forgotten: [] });

  it('có cờ đỏ: dùng công thức; chưa có: tạm theo SĐB; đồng điểm đồng hạng', () => {
    const out = rankTpt([row('7A1', 72), row('7A2', 78), row('7A3', 75), row('7A4', null)], { '7A1': 78, '7A3': 72 });
    expect(out.map((r) => [r.classId, r.score, r.provisional, r.rank])).toEqual([
      ['7A2', 78, true, 1],
      ['7A1', 74, false, 2],
      ['7A3', 74, false, 2],
      ['7A4', null, true, null],
    ]);
  });

  it('cờ đỏ quy về thang 80 từ thang TPT nhập; trung bình các tuần trong tháng', () => {
    expect(redFlagTo80(90, 100)).toBe(72);
    expect(redFlagTo80(120, 100)).toBe(80);
    const docs = [
      { id: 'a', weekStart: '2026-11-02', classId: '7A1', score: 100, maxScore: 100 },
      { id: 'b', weekStart: '2026-11-09', classId: '7A1', score: 50, maxScore: 100 },
      { id: 'c', weekStart: '2026-10-26', classId: '7A1', score: 0, maxScore: 100 },
    ];
    expect(redFlagForRange(docs, ['2026-11-02', '2026-11-09'])).toEqual({ '7A1': 60 });
  });

  it('mã tuần = Thứ Hai; các tuần trong tháng', () => {
    expect(weekStartOf('2026-11-13')).toBe(MON);
    expect(weekStartOf(MON)).toBe(MON);
    expect(weekStartsBetween('2026-11-01', '2026-11-30')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  });

  it('dán từ Excel: Lớp<tab>Điểm, bỏ tiêu đề, báo lỗi điểm sai', () => {
    const r = parseRedFlagPaste('Lớp\tĐiểm\n7A1\t95\n7a2;88,5\n7A3\t120\n9Z9\t50', ['7A1', '7A2', '7A3'], 100);
    expect(r.rows).toEqual([{ classId: '7A1', score: 95 }, { classId: '7A2', score: 88.5 }]);
    expect(r.errors).toEqual(['7A3: điểm "120" không hợp lệ (0–100)', 'Không có lớp "9Z9"']);
  });
});
