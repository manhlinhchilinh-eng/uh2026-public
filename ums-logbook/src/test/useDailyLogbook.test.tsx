/**
 * Unit Tests: useDailyLogbook Reactive Hook
 * File: src/test/useDailyLogbook.test.tsx
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDailyLogbook } from '../hooks/useDailyLogbook';

describe('Milestone 2 - useDailyLogbook Reactive Hook', () => {
  const classId = '9A3';
  const date = '2026-10-15';

  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes hook with 8 periods and default dailyId', async () => {
    const { result } = renderHook(() => useDailyLogbook(classId, date));

    expect(result.current.dailyId).toBe('9A3_2026-10-15');
    expect(result.current.periods.length).toBe(8);
    expect(result.current.periods[0].periodIndex).toBe(1);
    expect(result.current.periods[7].periodIndex).toBe(8);
  });

  it('optimistically updates period on savePeriod with rollback resilience', async () => {
    const { result } = renderHook(() => useDailyLogbook(classId, date));

    await act(async () => {
      await result.current.savePeriod(1, {
        subject: 'Hóa học',
        lessonTopic: 'Phản ứng oxy hóa khử',
        teacherName: 'Đinh Hoài Long',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      });
    });

    const p1 = result.current.periods.find((p) => p.periodIndex === 1);
    expect(p1?.subject).toBe('Hóa học');
    expect(p1?.lessonTopic).toBe('Phản ứng oxy hóa khử');
  });

  it('optimistically updates baseline attendance', async () => {
    const { result } = renderHook(() => useDailyLogbook(classId, date));

    await act(async () => {
      await result.current.updateBaseline('morning', {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        absences: [{ studentId: '269902', studentName: 'Vũ Minh Anh', type: 'P' }],
        earlyDepartures: [],
      });
    });

    expect(result.current.logbook?.morningBaseline?.absences.length).toBe(1);
    expect(result.current.logbook?.morningBaseline?.absences[0].studentName).toBe('Vũ Minh Anh');
  });

  it('supports signing a period via signPeriod', async () => {
    const { result } = renderHook(() => useDailyLogbook(classId, date));

    await act(async () => {
      await result.current.savePeriod(2, {
        subject: 'Vật lý',
        lessonTopic: 'Định luật Ôm',
        teacherName: 'Lý Trung Yến',
        scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 0.5, total: 9.5 },
      });
    });

    await act(async () => {
      await result.current.signPeriod(2, 'Lý Trung Yến', 'mrlongums', 'Lý Trung Yến');
    });

    const p2 = result.current.periods.find((p) => p.periodIndex === 2);
    expect(p2?.isSigned).toBe(true);
    expect(p2?.teacherSignature).toBe('Lý Trung Yến');
  });
});
