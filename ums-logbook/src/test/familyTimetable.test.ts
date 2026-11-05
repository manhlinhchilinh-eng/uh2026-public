import { describe, it, expect } from 'vitest';
import { dayTimetable, defaultSchoolDay, hasTimetable } from '../utils/familyTimetable';

const sch = {
  slots: [
    { dayOfWeek: 2, periodIndex: 1, subject: 'Maths ', teacherName: 'Mr Huy' },
    { dayOfWeek: 2, periodIndex: 3, subject: 'Literature', teacherName: 'Ms P.Nga' },
    { dayOfWeek: 3, periodIndex: 1, subject: 'Civics', teacherName: 'M.L.(Civic)' },
  ],
} as any;

describe('TKB cho PH/HS', () => {
  it('8 tiết của 1 thứ, tiết trống để rỗng', () => {
    const rows = dayTimetable(sch, 2);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({ periodIndex: 1, subject: 'Maths', teacherName: 'Mr Huy' });
    expect(rows[1]).toEqual({ periodIndex: 2, subject: '', teacherName: '' });
    expect(rows[2].subject).toBe('Literature');
    expect(dayTimetable(null, 2).every((r) => r.subject === '')).toBe(true);
  });

  it('thứ mặc định: hôm nay; T7/CN → Thứ Hai', () => {
    expect(defaultSchoolDay(new Date(2026, 10, 5))).toBe(5); // Thứ Năm
    expect(defaultSchoolDay(new Date(2026, 10, 7))).toBe(2); // Thứ Bảy
    expect(defaultSchoolDay(new Date(2026, 10, 8))).toBe(2); // CN
  });

  it('nhận biết chưa có TKB', () => {
    expect(hasTimetable(sch)).toBe(true);
    expect(hasTimetable({ slots: [] } as any)).toBe(false);
    expect(hasTimetable(null)).toBe(false);
  });
});
