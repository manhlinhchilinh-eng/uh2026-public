import { describe, it, expect } from 'vitest';
import { academicYearOf, semesterOf, week1Monday, weekNumberOf, weekDates, currentAcademic, displayYear } from '../utils/academicCalendar';
import { getWeekDatesForAcademicYear } from '../services/summaryService';

describe('Năm học / học kỳ / tuần tính theo ngày', () => {
  it('năm học: tháng 8–12 thuộc năm học mới', () => {
    expect(academicYearOf('2026-10-12')).toBe('2026-2027');
    expect(academicYearOf('2027-03-01')).toBe('2026-2027');
    expect(academicYearOf('2027-08-15')).toBe('2027-2028');
  });

  it('học kỳ I tới 15/01, học kỳ II từ 16/01', () => {
    expect(semesterOf('2026-10-12')).toBe(1);
    expect(semesterOf('2027-01-15')).toBe(1);
    expect(semesterOf('2027-01-16')).toBe(2);
    expect(semesterOf('2027-05-20')).toBe(2);
  });

  it('tuần 1 = thứ Hai đầu tiên từ 01/09 (2026: 07/09); tuần 6 chứa 12/10/2026', () => {
    expect(week1Monday('2026-2027')).toBe('2026-09-07');
    expect(week1Monday('2025-2026')).toBe('2025-09-01'); // 01/09/2025 là thứ Hai
    expect(weekNumberOf('2026-09-07')).toBe(1);
    expect(weekNumberOf('2026-10-11')).toBe(5); // CN cuối tuần 5
    expect(weekNumberOf('2026-10-12')).toBe(6);
    expect(weekNumberOf('2026-09-02')).toBe(1); // trước tuần 1 → 1
  });

  it('các ngày của tuần khớp hàm cũ của Tổng kết (tuần 5 = 05/10 → 09/10)', () => {
    expect(weekDates(5, '2026-2027')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
    expect(getWeekDatesForAcademicYear(5, '2026-2027').weekDates).toEqual(weekDates(5, '2026-2027'));
  });

  it('hiện tại & hiển thị', () => {
    expect(currentAcademic('2026-10-12')).toEqual({ academicYear: '2026-2027', semester: 1, weekNumber: 6 });
    expect(displayYear('2026-2027')).toBe('2026 - 2027');
  });
});
