import { describe, it, expect } from 'vitest';
import {
  UMS_BELL_SCHEDULE,
  UMS_BREAKS,
  parseTimeToMinutes,
  minutesToTimeString,
  getPeriodTimeRange,
  isWithinPeriod,
  resolveCurrentBellPeriod,
} from '../utils/schedule';

// Giờ chuông chính thức UMS (người dùng xác nhận 2026-10-10). Ghi tay ở đây, KHÔNG suy ra từ code,
// để test bắt được mọi thay đổi ngoài ý muốn trong src/utils/schedule.ts.
const OFFICIAL_PERIODS: Array<[number, string, string]> = [
  [1, '07:30', '08:15'],
  [2, '08:25', '09:10'],
  [3, '09:20', '10:05'],
  [4, '10:15', '11:00'],
  [5, '13:00', '13:45'],
  [6, '13:50', '14:35'],
  [7, '14:45', '15:30'],
  [8, '15:35', '16:20'],
];

const OFFICIAL_BREAKS: Array<[string, string, string, number]> = [
  // [type, start, end, next period]
  ['changeover', '08:15', '08:25', 2],
  ['morning_recess', '09:10', '09:20', 3],
  ['changeover', '10:05', '10:15', 4],
  ['lunch', '11:00', '13:00', 5],
  ['changeover', '13:45', '13:50', 6],
  ['afternoon_recess', '14:35', '14:45', 7],
  ['changeover', '15:30', '15:35', 8],
];

// Thứ Hai 2026-10-12 (ngày học), giờ địa phương
const at = (hhmm: string, sec = 0, ms = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 9, 12, h, m, sec, ms);
};
const MIN = 60_000;

describe('Giờ chuông UMS (lịch 07:30)', () => {
  describe('1. Bảng chuông khớp lịch chính thức', () => {
    it('8 tiết đúng giờ bắt đầu/kết thúc', () => {
      expect(UMS_BELL_SCHEDULE.map((s) => [s.periodIndex, s.startTime, s.endTime])).toEqual(OFFICIAL_PERIODS);
    });

    it('7 quãng nghỉ đúng loại, giờ và tiết kế tiếp', () => {
      expect(UMS_BREAKS.map((b) => [b.type, b.startTime, b.endTime, b.succeedingPeriod])).toEqual(OFFICIAL_BREAKS);
    });

    it('startMinutes/endMinutes/durationMinutes nhất quán với chuỗi giờ', () => {
      for (const s of UMS_BELL_SCHEDULE) {
        expect(s.startMinutes).toBe(parseTimeToMinutes(s.startTime));
        expect(s.endMinutes).toBe(parseTimeToMinutes(s.endTime));
      }
      for (const b of UMS_BREAKS) {
        expect(b.startMinutes).toBe(parseTimeToMinutes(b.startTime));
        expect(b.endMinutes).toBe(parseTimeToMinutes(b.endTime));
        expect(b.durationMinutes).toBe(b.endMinutes - b.startMinutes);
      }
    });

    it('tiết và nghỉ nối liền, không chồng lấn, phủ kín 07:30–16:20', () => {
      const slots = [
        ...UMS_BELL_SCHEDULE.map((s) => [s.startMinutes, s.endMinutes]),
        ...UMS_BREAKS.map((b) => [b.startMinutes, b.endMinutes]),
      ].sort((a, b) => a[0] - b[0]);
      expect(slots[0][0]).toBe(450);
      expect(slots[slots.length - 1][1]).toBe(980);
      for (let i = 1; i < slots.length; i++) expect(slots[i][0]).toBe(slots[i - 1][1]);
    });

    it('buổi sáng tiết 1–4, buổi chiều tiết 5–8', () => {
      for (const s of UMS_BELL_SCHEDULE) expect(s.session).toBe(s.periodIndex <= 4 ? 'morning' : 'afternoon');
    });
  });

  describe('2. Hàm tiện ích thời gian', () => {
    it('parseTimeToMinutes và minutesToTimeString là hàm ngược của nhau', () => {
      expect(parseTimeToMinutes('07:30')).toBe(450);
      expect(parseTimeToMinutes('16:20')).toBe(980);
      expect(minutesToTimeString(450)).toBe('07:30');
      expect(minutesToTimeString(0)).toBe('00:00');
      for (let m = 0; m < 1440; m++) expect(parseTimeToMinutes(minutesToTimeString(m))).toBe(m);
    });

    it('getPeriodTimeRange trả đúng nhãn, tiết không tồn tại trả chuỗi rỗng', () => {
      for (const [p, start, end] of OFFICIAL_PERIODS) expect(getPeriodTimeRange(p)).toBe(`${start} - ${end}`);
      expect(getPeriodTimeRange(0)).toBe('');
      expect(getPeriodTimeRange(9)).toBe('');
    });

    it('isWithinPeriod theo khoảng nửa mở [start, end)', () => {
      for (const [p, start, end] of OFFICIAL_PERIODS) {
        const s = parseTimeToMinutes(start);
        const e = parseTimeToMinutes(end);
        expect(isWithinPeriod(minutesToTimeString(s - 1), p)).toBe(false);
        expect(isWithinPeriod(start, p)).toBe(true);
        expect(isWithinPeriod(minutesToTimeString(e - 1), p)).toBe(true);
        expect(isWithinPeriod(end, p)).toBe(false);
      }
      expect(isWithinPeriod('08:00', 9)).toBe(false);
    });
  });

  describe('3. resolveCurrentBellPeriod tại mọi mốc', () => {
    it('trước giờ học: chưa vào trường, tiết kế tiếp là 1, đếm ngược đúng', () => {
      const r = resolveCurrentBellPeriod(at('07:29', 59, 999));
      expect(r).toMatchObject({ activePeriod: null, nextPeriod: 1, isBreak: false, isSchoolHours: false, session: 'off' });
      expect(r.timeUntilNextPeriodMs).toBe(1000);
    });

    it.each(OFFICIAL_PERIODS)('Tiết %i (%s–%s): đầu tiết, cuối tiết, ngay sau tiết', (p, start, end) => {
      const len = parseTimeToMinutes(end) - parseTimeToMinutes(start);
      const first = resolveCurrentBellPeriod(at(start));
      expect(first).toMatchObject({
        activePeriod: p,
        nextPeriod: p < 8 ? p + 1 : null,
        isBreak: false,
        isSchoolHours: true,
        session: p <= 4 ? 'morning' : 'afternoon',
      });
      expect(first.timeRemainingInPeriodMs).toBe(len * MIN);

      const last = resolveCurrentBellPeriod(at(minutesToTimeString(parseTimeToMinutes(end) - 1), 59));
      expect(last.activePeriod).toBe(p);
      expect(last.timeRemainingInPeriodMs).toBe(1000);

      expect(resolveCurrentBellPeriod(at(end)).activePeriod).toBeNull();
    });

    it.each(OFFICIAL_BREAKS)('Nghỉ %s (%s–%s) trước tiết %i', (type, start, end, next) => {
      const r = resolveCurrentBellPeriod(at(start));
      expect(r).toMatchObject({
        activePeriod: null,
        nextPeriod: next,
        isBreak: true,
        breakType: type,
        isSchoolHours: type !== 'lunch',
      });
      expect(r.timeUntilNextPeriodMs).toBe((parseTimeToMinutes(end) - parseTimeToMinutes(start)) * MIN);
      const last = resolveCurrentBellPeriod(at(minutesToTimeString(parseTimeToMinutes(end) - 1), 59));
      expect(last.breakType).toBe(type);
      expect(last.timeUntilNextPeriodMs).toBe(1000);
    });

    it('sau tiết 8 và nửa đêm: ngoài giờ, không có tiết kế tiếp', () => {
      for (const t of ['16:20', '20:00', '23:59']) {
        expect(resolveCurrentBellPeriod(at(t))).toMatchObject({ activePeriod: null, nextPeriod: null, session: 'off', isSchoolHours: false });
      }
      expect(resolveCurrentBellPeriod(at('00:00')).nextPeriod).toBe(1);
    });

    it('cuối tuần: không có tiết', () => {
      const sat = new Date(2026, 9, 17, 9, 0);
      expect(resolveCurrentBellPeriod(sat)).toMatchObject({ activePeriod: null, nextPeriod: null, isSchoolHours: false });
    });
  });

  describe('4. Quét toàn bộ 1440 phút', () => {
    it('mỗi phút thuộc đúng 1 trạng thái; tổng phút tiết + nghỉ = 530', () => {
      let teaching = 0;
      let breaks = 0;
      for (let m = 0; m < 1440; m++) {
        const r = resolveCurrentBellPeriod(at(minutesToTimeString(m)));
        expect(r.activePeriod !== null && r.isBreak).toBe(false);
        if (r.activePeriod !== null) teaching++;
        if (r.isBreak) breaks++;
        expect(r.timeRemainingInPeriodMs ?? 0).toBeGreaterThanOrEqual(0);
        expect(r.timeUntilNextPeriodMs ?? 0).toBeGreaterThanOrEqual(0);
      }
      expect(teaching).toBe(360); // 8 tiết × 45'
      expect(breaks).toBe(170); // 10+10+10+120+5+10+5
    });

    it('đếm ngược giảm đúng 1000ms mỗi giây trong tiết và trong giờ nghỉ', () => {
      for (const start of ['07:30', '09:10']) {
        let prev: number | undefined;
        for (let s = 0; s < 60; s++) {
          const r = resolveCurrentBellPeriod(at(start, s));
          const v = r.isBreak ? r.timeUntilNextPeriodMs! : r.timeRemainingInPeriodMs!;
          if (prev !== undefined) expect(prev - v).toBe(1000);
          prev = v;
        }
      }
    });
  });
});
