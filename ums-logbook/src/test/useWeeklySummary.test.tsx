/**
 * Unit & Integration Tests: useWeeklySummary Reactive Hook
 * Milestone 5: Summary Loading, Lazy Calculation & Optimistic Note Updates
 * Path: src/test/useWeeklySummary.test.tsx
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeeklySummary } from '../hooks/useWeeklySummary';
import { saveWeeklySummary, calculateWeeklySummary } from '../services/summaryService';

describe('Milestone 5: useWeeklySummary Reactive Hook', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('1. Initializes and auto-calculates summary when missing in storage', async () => {
    const { result } = renderHook(() => useWeeklySummary('6A1', 5));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).not.toBeNull();
    expect(result.current.summary?.classId).toBe('6A1');
    expect(result.current.summary?.weekNumber).toBe(5);
    expect(result.current.summary?.totalPeriodsExpected).toBe(40);
  });

  it('2. Loads pre-existing weekly summary from storage', async () => {
    const preSummary = calculateWeeklySummary('8A3', 5, [], []);
    preSummary.gvcnWeeklyNote = 'Ghi chú ban đầu của GVCN';
    await saveWeeklySummary(preSummary);

    const { result } = renderHook(() => useWeeklySummary('8A3', 5));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary?.gvcnWeeklyNote).toBe('Ghi chú ban đầu của GVCN');
  });

  it('3. saveGvcnNote optimistically updates note and persists to storage', async () => {
    const { result } = renderHook(() => useWeeklySummary('7A1', 5));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.saveGvcnNote('Lớp đạt giải Nhất văn nghệ tuần này');
    });

    expect(success).toBe(true);
    expect(result.current.summary?.gvcnWeeklyNote).toBe('Lớp đạt giải Nhất văn nghệ tuần này');
  });

  it('4. recalculate manual action re-runs aggregation and updates state', async () => {
    const { result } = renderHook(() => useWeeklySummary('9A3', 5));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const updated = await result.current.recalculate();
      expect(updated).not.toBeNull();
    });

    expect(result.current.summary?.classId).toBe('9A3');
  });
});
