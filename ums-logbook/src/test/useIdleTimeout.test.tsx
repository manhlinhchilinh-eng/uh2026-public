/**
 * UMS Digital Class Logbook - useIdleTimeout Hook Unit & Integration Suite
 * Milestone 6: Inactivity Detection, Event Throttling, Advance Countdown & Timeout
 * Path: src/test/useIdleTimeout.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useIdleTimeout } from '../hooks/useIdleTimeout';

// Mock useAuth
const mockLogout = vi.fn().mockResolvedValue(undefined);
let mockUser: any = { uid: 'user_123', email: 'mrlinhums@ums.edu.vn' };

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useIdleTimeout Hook Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUser = { uid: 'user_123', email: 'mrlinhums@ums.edu.vn' };
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1.1: initializes with warning modal closed and full countdown remaining', () => {
    const { result } = renderHook(
      () =>
        useIdleTimeout({
          timeoutMs: 30 * 60 * 1000,
          warningMs: 25 * 60 * 1000,
        }),
      { wrapper }
    );

    expect(result.current.isWarningOpen).toBe(false);
    expect(result.current.isWarningModalOpen).toBe(false);
    expect(result.current.remainingSeconds).toBe(300); // 5 minutes = 300s
    expect(result.current.formattedRemaining).toBe('5:00');
  });

  it('1.2: opens warning modal when inactivity reaches warningMs threshold', () => {
    const onWarning = vi.fn();
    const { result } = renderHook(
      () =>
        useIdleTimeout({
          timeoutMs: 30 * 1000, // 30s timeout
          warningMs: 25 * 1000, // 25s warning
          onWarning,
        }),
      { wrapper }
    );

    expect(result.current.isWarningOpen).toBe(false);

    // Fast-forward 25 seconds
    act(() => {
      vi.advanceTimersByTime(25000);
    });

    expect(result.current.isWarningOpen).toBe(true);
    expect(result.current.isWarningModalOpen).toBe(true);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(result.current.remainingSeconds).toBeLessThanOrEqual(5);
  });

  it('1.3: decrements countdown timer every second when warning is open', () => {
    const { result } = renderHook(
      () =>
        useIdleTimeout({
          timeoutMs: 30 * 1000,
          warningMs: 20 * 1000,
        }),
      { wrapper }
    );

    // Reach warning threshold
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(result.current.isWarningOpen).toBe(true);
    const initialSeconds = result.current.remainingSeconds;

    // Advance 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.remainingSeconds).toBe(initialSeconds - 2);
  });

  it('1.4: extendSession resets timer and closes warning modal', () => {
    const { result } = renderHook(
      () =>
        useIdleTimeout({
          timeoutMs: 30 * 1000,
          warningMs: 20 * 1000,
        }),
      { wrapper }
    );

    // Trigger warning
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(result.current.isWarningOpen).toBe(true);

    // User clicks "Stay logged in"
    act(() => {
      result.current.extendSession();
    });

    expect(result.current.isWarningOpen).toBe(false);
    expect(result.current.remainingSeconds).toBe(10); // reset to initial countdown (30s - 20s)
  });

  it('1.5: triggers timeout and logout callback when elapsed time exceeds timeoutMs', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(
      () =>
        useIdleTimeout({
          timeoutMs: 30 * 1000,
          warningMs: 25 * 1000,
          onTimeout,
        }),
      { wrapper }
    );

    // Advance past timeout threshold
    act(() => {
      vi.advanceTimersByTime(31000);
    });

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(result.current.isWarningOpen).toBe(false);
  });

  it('1.6: resetActivity / resetTimer updates activity timestamp', () => {
    const { result } = renderHook(
      () =>
        useIdleTimeout({
          timeoutMs: 60 * 1000,
          warningMs: 50 * 1000,
        }),
      { wrapper }
    );

    // Advance 20 seconds (greater than 15s throttle)
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    act(() => {
      result.current.resetActivity();
    });

    const storedLastActivity = localStorage.getItem('ums_last_activity');
    expect(storedLastActivity).not.toBeNull();
  });
});
