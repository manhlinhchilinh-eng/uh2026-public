import { describe, it, expect } from 'vitest';
import { scheduleDayOf, suggestPeriods, validatePlans, substituteLabels } from '../utils/substitution';
import type { ScheduleSlot } from '../types/schedule';

const slot = (dayOfWeek: number, periodIndex: number, teacherName: string, subject = 'Toán'): ScheduleSlot => ({
  dayOfWeek, periodIndex, teacherName, subject, teacherUsername: '',
});
const schedules = [
  { classId: '6A1', slots: [slot(2, 1, 'Ms P.Anh', 'Homeroom'), slot(2, 3, 'Ms Minh Huệ', 'Eng 1'), slot(3, 2, 'Ms  p.anh ', 'Toán')] },
  { classId: '7A3', slots: [slot(2, 5, 'Ms P.Anh', 'Toán'), slot(4, 1, 'Ms P.Anh', 'Toán')] },
];

describe('Dạy thay — gợi ý tiết từ TKB', () => {
  it('quy đổi thứ theo TKB (2 = Thứ Hai)', () => {
    expect(scheduleDayOf('2026-10-12')).toBe(2);
    expect(scheduleDayOf('2026-10-16')).toBe(6);
    expect(scheduleDayOf('2026-10-18')).toBe(8);
  });

  it('khớp tên trên TKB không phân biệt hoa/thường/khoảng trắng; bỏ cuối tuần và ngày lễ', () => {
    const r = suggestPeriods(schedules, 'ms p.anh', '2026-10-12', '2026-10-14', ['2026-10-14']);
    expect(r).toEqual([
      { date: '2026-10-12', classId: '6A1', periodIndex: 1, subject: 'Homeroom' },
      { date: '2026-10-12', classId: '7A3', periodIndex: 5, subject: 'Toán' },
      { date: '2026-10-13', classId: '6A1', periodIndex: 2, subject: 'Toán' },
    ]);
    expect(suggestPeriods(schedules, 'Ms P.Anh', '2026-10-17', '2026-10-18')).toEqual([]);
  });

  it('chưa khai tên trên TKB → không gợi ý (GV tự nhập)', () => {
    expect(suggestPeriods(schedules, undefined, '2026-10-12', '2026-10-16')).toEqual([]);
    expect(suggestPeriods(schedules, '  ', '2026-10-12', '2026-10-16')).toEqual([]);
  });
});

describe('Dạy thay — kiểm tra kế hoạch', () => {
  const range = { startDate: '2026-10-12', endDate: '2026-10-13' };
  const ok = { date: '2026-10-12', classId: '6A1', periodIndex: 1, subject: 'Toán', substituteUid: 'gv2', substituteName: 'Thầy B' };

  it('kế hoạch hợp lệ', () => {
    expect(validatePlans([ok], range, 'gv1')).toEqual([]);
  });

  it('chặn xếp 1 người dạy thay 2 lớp cùng tiết cùng ngày', () => {
    const errs = validatePlans([ok, { ...ok, classId: '7A3' }, { ...ok, classId: '8A1', periodIndex: 2 }], range, 'gv1');
    expect(errs).toEqual(['Dòng dạy thay 2: Thầy B đã được xếp dạy thay tiết 1 ngày 2026-10-12 ở dòng 1.']);
  });

  it('bắt lỗi: ngoài thời gian nghỉ, thiếu người, tự dạy thay mình, trùng tiết, tiết sai', () => {
    const errs = validatePlans(
      [
        { ...ok, date: '2026-10-20' },
        { ...ok, substituteUid: '', substituteName: '' },
        { ...ok, substituteUid: 'gv1' },
        { ...ok },
        { ...ok, periodIndex: 9, date: '2026-10-13' },
      ],
      range,
      'gv1'
    ).join('\n');
    expect(errs).toMatch(/Dòng dạy thay 1: ngày 2026-10-20 nằm ngoài/);
    expect(errs).toMatch(/Dòng dạy thay 2: chưa chọn GV dạy thay/);
    expect(errs).toMatch(/Dòng dạy thay 3: không thể tự dạy thay/);
    expect(errs).toMatch(/trùng tiết 1 lớp 6A1/);
    expect(errs).toMatch(/Dòng dạy thay 5: tiết phải từ 1 đến 8/);
  });
});

describe('Dạy thay — nhãn trên Sổ đầu bài', () => {
  it('chỉ hiện kế hoạch đã duyệt của đúng lớp, đúng ngày', () => {
    const subs = [
      { classId: '6A1', date: '2026-10-12', periodIndex: 1, substituteName: 'Thầy B', absentName: 'Cô A', status: 'approved' },
      { classId: '6A1', date: '2026-10-12', periodIndex: 2, substituteName: 'Thầy C', absentName: 'Cô A', status: 'planned' },
      { classId: '6A1', date: '2026-10-13', periodIndex: 3, substituteName: 'Thầy B', absentName: 'Cô A', status: 'approved' },
      { classId: '7A3', date: '2026-10-12', periodIndex: 4, substituteName: 'Thầy B', absentName: 'Cô A', status: 'approved' },
    ];
    expect(substituteLabels(subs, '6A1', '2026-10-12')).toEqual({ 1: 'Dạy thay: Thầy B (thay Cô A)' });
  });
});
