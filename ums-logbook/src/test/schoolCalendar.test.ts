import { describe, it, expect } from 'vitest';
import { getOffDayInfo, validateOffPeriod, addOffPeriod, countSchoolDaysOff, formatOffPeriod } from '../utils/schoolCalendar';

describe('Lịch nghỉ của trường', () => {
  const cal = { offPeriods: [{ from: '2027-02-04', to: '2027-02-12', reason: 'Nghỉ Tết Nguyên đán' }, { from: '2026-11-20', to: '2026-11-20', reason: 'Ngày Nhà giáo VN' }] };

  it('Thứ Bảy, Chủ nhật tự nghỉ', () => {
    expect(getOffDayInfo('2026-10-10')).toEqual({ off: true, reason: 'Thứ Bảy', kind: 'weekend' });
    expect(getOffDayInfo('2026-10-11')).toEqual({ off: true, reason: 'Chủ nhật', kind: 'weekend' });
    expect(getOffDayInfo('2026-10-12').off).toBe(false); // Thứ Hai
  });

  it('ngày/khoảng nghỉ BGH khai (kể cả đầu, cuối khoảng)', () => {
    expect(getOffDayInfo('2026-11-20', cal)).toEqual({ off: true, reason: 'Ngày Nhà giáo VN', kind: 'holiday' });
    expect(getOffDayInfo('2027-02-04', cal).reason).toBe('Nghỉ Tết Nguyên đán');
    expect(getOffDayInfo('2027-02-12', cal).off).toBe(true);
    expect(getOffDayInfo('2027-02-15', cal).off).toBe(false);
    expect(getOffDayInfo('2027-02-06', cal).kind).toBe('holiday'); // T7 trong kỳ Tết → lý do Tết
  });

  it('ngày sai định dạng → không chặn', () => {
    expect(getOffDayInfo('').off).toBe(false);
  });

  it('kiểm tra dữ liệu nhập', () => {
    expect(validateOffPeriod({ from: '', to: '', reason: 'x' })).toMatch(/ngày bắt đầu/);
    expect(validateOffPeriod({ from: '2026-11-21', to: '2026-11-20', reason: 'x' })).toMatch(/sau ngày bắt đầu/);
    expect(validateOffPeriod({ from: '2026-11-20', to: '', reason: ' ' })).toMatch(/lý do/);
    expect(validateOffPeriod({ from: '2026-11-20', to: '', reason: 'Lễ' })).toBeNull();
  });

  it('thêm khoảng nghỉ: sắp xếp, ghi đè khoảng trùng', () => {
    let l = addOffPeriod([], { from: '2026-12-01', to: '', reason: 'A' });
    l = addOffPeriod(l, { from: '2026-11-01', to: '2026-11-02', reason: 'B' });
    l = addOffPeriod(l, { from: '2026-12-01', to: '2026-12-01', reason: 'A2' });
    expect(l).toEqual([{ from: '2026-11-01', to: '2026-11-02', reason: 'B' }, { from: '2026-12-01', to: '2026-12-01', reason: 'A2' }]);
  });

  it('đếm ngày học bị nghỉ & hiển thị', () => {
    expect(countSchoolDaysOff(cal.offPeriods[0])).toBe(7); // 04/02 (T5) → 12/02 (T6)
    expect(formatOffPeriod(cal.offPeriods[0])).toBe('04/02/2027 – 12/02/2027');
    expect(formatOffPeriod(cal.offPeriods[1])).toBe('20/11/2026');
  });
});
