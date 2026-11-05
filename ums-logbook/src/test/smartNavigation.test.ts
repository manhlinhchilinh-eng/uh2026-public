/**
 * Unit Tests: Smart GVBM Navigation & Teacher Context Hook
 * File: src/test/smartNavigation.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSmartNavigation } from '../hooks/useSmartNavigation';
import * as authHook from '../hooks/useAuth';
import { scheduleService } from '../services/scheduleService';
import { TeacherScheduleSlot } from '../types/schedule';

// Mock react-router-dom useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('Milestone 4 - Smart GVBM Navigation Hook', () => {
  const mockTeacherSlots: TeacherScheduleSlot[] = [
    // Wednesday (day 4)
    {
      dayOfWeek: 4,
      periodIndex: 1,
      subject: 'Toán học',
      teacherUsername: 'mrlinhums',
      teacherName: 'Nguyễn Mạnh Linh',
      classId: '9A3',
      room: 'P.9A3',
    },
    {
      dayOfWeek: 4,
      periodIndex: 3,
      subject: 'Toán học',
      teacherUsername: 'mrlinhums',
      teacherName: 'Nguyễn Mạnh Linh',
      classId: '9A3',
      room: 'P.9A3',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock useAuth
    vi.spyOn(authHook, 'useAuth').mockReturnValue({
      user: { uid: 'u1' } as any,
      profile: {
        uid: 'u1',
        username: 'mrlinhums',
        displayName: 'Nguyễn Mạnh Linh',
        roles: ['gvcn', 'gvbm'],
        assignedClassId: '9A3',
        mustChangePassword: false,
      } as any,
      activeRole: 'gvbm',
      switchActiveRole: vi.fn(),
      setActiveRole: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      mustChangePassword: false,
      isIdleWarningOpen: false,
      idleRemainingSeconds: 1800,
      extendSession: vi.fn(),
      isLoading: false,
      error: null,
      clearError: vi.fn(),
      hasRole: vi.fn().mockReturnValue(true),
      canAccessClass: vi.fn().mockReturnValue(true),
      canEditPeriod: vi.fn().mockReturnValue(true),
    } as any);

    vi.spyOn(scheduleService, 'getTeacherSchedule').mockResolvedValue(mockTeacherSlots);
  });

  it('detects isTeachingNow = true when teacher is currently in class', async () => {
    // Wednesday 2026-10-14 at 07:30 (during Period 1: 07:15 - 08:00)
    const testDate = new Date('2026-10-14T07:30:00');

    const { result } = renderHook(() => useSmartNavigation(testDate));

    await waitFor(() => {
      expect(result.current.allTeacherSlots.length).toBe(2);
    });

    expect(result.current.bellStatus.activePeriod).toBe(1);
    expect(result.current.isTeachingNow).toBe(true);
    expect(result.current.currentTeachingSlot?.periodIndex).toBe(1);
    expect(result.current.currentTeachingSlot?.classId).toBe('9A3');
    expect(result.current.minutesRemainingInClass).toBe(45); // 08:15 - 07:30 = 45m
  });

  it('detects nextTeachingSlot when teacher is on break before next class', async () => {
    // Wednesday 2026-10-14 at 08:55 (during morning recess: 08:50 - 09:10, next class Period 3 at 09:10)
    const testDate = new Date('2026-10-14T08:55:00');

    const { result } = renderHook(() => useSmartNavigation(testDate));

    await waitFor(() => {
      expect(result.current.allTeacherSlots.length).toBe(2);
    });

    expect(result.current.isTeachingNow).toBe(false);
    expect(result.current.hasNextTeachingToday).toBe(true);
    expect(result.current.nextTeachingSlot?.periodIndex).toBe(3);
    expect(result.current.nextTeachingSlot?.subject).toBe('Toán học');
    expect(result.current.minutesUntilNextTeaching).toBe(25); // 09:20 - 08:55 = 25m
  });

  it('constructs correct logbook URL and navigates properly', () => {
    const testDate = new Date('2026-10-14T08:00:00');
    const { result } = renderHook(() => useSmartNavigation(testDate));

    const url = result.current.getLogbookUrl('9A3', 2, '2026-10-14');
    expect(url).toBe('/logbook?classId=9A3&date=2026-10-14&period=2');

    result.current.navigateToLogbook('9A3', 2, '2026-10-14');
    expect(mockNavigate).toHaveBeenCalledWith('/logbook?classId=9A3&date=2026-10-14&period=2');
  });

  it('indicates no teaching today on free days', async () => {
    // Sunday
    const testDate = new Date('2026-10-18T10:00:00');
    const { result } = renderHook(() => useSmartNavigation(testDate));

    await waitFor(() => {
      expect(result.current.allTeacherSlots.length).toBe(2);
    });

    expect(result.current.todaySlots.length).toBe(0);
    expect(result.current.isTeachingNow).toBe(false);
    expect(result.current.hasNextTeachingToday).toBe(false);
  });
});
