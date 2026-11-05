import { describe, it, expect, beforeEach } from 'vitest';
import { weeksInMonth, weekDates } from '../academicCalendar';
import { buildSlotMap } from '../timetableGrid';
import { recalculateMonthlySummaryFromRealData } from '../../services/summaryService';
import { savePeriodEntry, getOrCreateDailyLogbook } from '../../services/logbookService';

describe('P3 Tech Debt — weeksInMonth & buildSlotMap & recalculateMonthlySummaryFromRealData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('weeksInMonth returns non-overlapping weeks whose Wednesday falls in the target month', () => {
    const octWeeks = weeksInMonth(10, 2026, '2026-2027');
    expect(octWeeks.length).toBeGreaterThanOrEqual(4);
    const sepWeeks = weeksInMonth(9, 2026, '2026-2027');
    // Ensure no week belongs to both September and October
    const overlap = octWeeks.filter((w) => sepWeeks.includes(w));
    expect(overlap).toEqual([]);
  });

  it('buildSlotMap maps dayOfWeek_periodIndex and resolves teacherUsername via aliasMap', () => {
    const slots = [
      { dayOfWeek: 2 as const, periodIndex: 1, subject: 'Anh', teacherName: 'Ms P.Anh(Eng)', teacherUsername: '' },
      { dayOfWeek: 2 as const, periodIndex: 2, subject: 'Toán', teacherName: 'Chưa rõ', teacherUsername: '' },
    ];
    const map = buildSlotMap(slots, new Map([['Ms P.Anh(Eng)', 'msphuonganhums']]));
    expect(map['2_1']).toEqual({
      subject: 'Anh',
      teacherName: 'Ms P.Anh(Eng)',
      teacherUsername: 'msphuonganhums',
    });
    expect(map['2_2']).toEqual({
      subject: 'Toán',
      teacherName: 'Chưa rõ',
      teacherUsername: '',
    });
  });

  it('recalculateMonthlySummaryFromRealData aggregates real daily logbooks across all weeks in the month', async () => {
    const octWeeks = weeksInMonth(10, 2026, '2026-2027');
    const wFirst = octWeeks[0];
    const wSecond = octWeeks[1];
    const d1 = weekDates(wFirst, '2026-2027')[0];
    const d2 = weekDates(wSecond, '2026-2027')[0];

    await getOrCreateDailyLogbook('6A1', d1, 'msphuonganhums', wFirst);
    await savePeriodEntry(
      `6A1_${d1}`,
      1,
      {
        subject: 'Anh',
        lessonTopic: 'Unit 1',
        teacherId: 'msphuonganhums',
        teacherName: 'Phương Anh',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      },
      true
    );

    await getOrCreateDailyLogbook('6A1', d2, 'msphuonganhums', wSecond);
    await savePeriodEntry(
      `6A1_${d2}`,
      1,
      {
        subject: 'Anh',
        lessonTopic: 'Unit 2',
        teacherId: 'msphuonganhums',
        teacherName: 'Phương Anh',
        scores: { learning: 3, discipline: 3, hygiene: 2, customCriterion: 1, total: 9 },
      },
      true
    );

    const monthly = await recalculateMonthlySummaryFromRealData('6A1', 10, 2026, '2026-2027');
    expect(monthly.weeksIncluded).toEqual(octWeeks);
    expect(monthly.totalPeriodsSigned).toBe(2);
    expect(monthly.criteriaAverages.totalAverage).toBe(9.5);
    expect(monthly.monthlyAverageScore).toBe(9.5);
  });
});
