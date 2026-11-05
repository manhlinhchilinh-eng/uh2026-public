import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import {
  resolveCurrentBellPeriod,
  getDayOfWeekFromDate,
  UMS_BELL_SCHEDULE,
  BellPeriodResolution,
} from '../utils/schedule';
import { TeacherScheduleSlot } from '../types/schedule';
import { scheduleService } from '../services/scheduleService';

export interface UseSmartNavigationResult {
  // Live clock & Bell state
  currentTime: Date;
  todayDateStr: string;
  todayDayOfWeek: number;
  bellStatus: BellPeriodResolution;

  // Live GVBM teaching state
  isTeachingNow: boolean;
  currentTeachingSlot: TeacherScheduleSlot | null;
  minutesRemainingInClass: number | null;

  hasNextTeachingToday: boolean;
  nextTeachingSlot: TeacherScheduleSlot | null;
  minutesUntilNextTeaching: number | null;

  todaySlots: TeacherScheduleSlot[];
  allTeacherSlots: TeacherScheduleSlot[];
  isLoadingSchedule: boolean;

  // Actions
  navigateToLogbook: (classId: string, periodIndex: number, dateStr?: string) => void;
  getLogbookUrl: (classId: string, periodIndex: number, dateStr?: string) => string;
  refreshSchedule: () => Promise<void>;
}

export function useSmartNavigation(mockDate?: Date): UseSmartNavigationResult {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [currentTime, setCurrentTime] = useState<Date>(mockDate || new Date());
  const [allTeacherSlots, setAllTeacherSlots] = useState<TeacherScheduleSlot[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // 1. Live Heartbeat Clock (ticks every 30s)
  useEffect(() => {
    if (mockDate) {
      setCurrentTime(mockDate);
      return;
    }
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [mockDate]);

  // 2. Bell schedule resolution
  const bellStatus = useMemo(() => {
    return resolveCurrentBellPeriod(currentTime);
  }, [currentTime]);

  const todayDateStr = useMemo(() => {
    const y = currentTime.getFullYear();
    const m = String(currentTime.getMonth() + 1).padStart(2, '0');
    const d = String(currentTime.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [currentTime]);

  const todayDayOfWeek = useMemo(() => {
    return getDayOfWeekFromDate(currentTime);
  }, [currentTime]);

  // 3. Load Teacher's Timetable
  const loadSchedule = useCallback(async () => {
    if (!profile?.username) return;
    setIsLoadingSchedule(true);
    try {
      const slots = await scheduleService.getTeacherSchedule(profile.username);
      setAllTeacherSlots(slots || []);
    } catch {
      setAllTeacherSlots([]);
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [profile?.username]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // 4. Filter slots for today (ordered by periodIndex 1..8)
  const todaySlots = useMemo(() => {
    return allTeacherSlots
      .filter((s) => s.dayOfWeek === todayDayOfWeek)
      .sort((a, b) => a.periodIndex - b.periodIndex);
  }, [allTeacherSlots, todayDayOfWeek]);

  // 5. Determine if teacher is teaching right now
  const currentTeachingSlot = useMemo(() => {
    if (!bellStatus.activePeriod) return null;
    return todaySlots.find((s) => s.periodIndex === bellStatus.activePeriod) || null;
  }, [bellStatus.activePeriod, todaySlots]);

  const isTeachingNow = Boolean(currentTeachingSlot);

  const minutesRemainingInClass = useMemo(() => {
    if (!currentTeachingSlot || !bellStatus.activePeriod) return null;
    const slotBell = UMS_BELL_SCHEDULE.find((s) => s.periodIndex === bellStatus.activePeriod);
    if (!slotBell) return null;
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    return Math.max(0, slotBell.endMinutes - currentMins);
  }, [currentTeachingSlot, bellStatus.activePeriod, currentTime]);

  // 6. Determine next upcoming teaching slot today
  const nextTeachingSlot = useMemo(() => {
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    for (const slot of todaySlots) {
      const slotBell = UMS_BELL_SCHEDULE.find((s) => s.periodIndex === slot.periodIndex);
      if (slotBell && slotBell.startMinutes > currentMins) {
        return slot;
      }
    }
    return null;
  }, [todaySlots, currentTime]);

  const hasNextTeachingToday = Boolean(nextTeachingSlot);

  const minutesUntilNextTeaching = useMemo(() => {
    if (!nextTeachingSlot) return null;
    const slotBell = UMS_BELL_SCHEDULE.find((s) => s.periodIndex === nextTeachingSlot.periodIndex);
    if (!slotBell) return null;
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    return Math.max(0, slotBell.startMinutes - currentMins);
  }, [nextTeachingSlot, currentTime]);

  // 7. Navigation Helpers
  const getLogbookUrl = useCallback(
    (classId: string, periodIndex: number, dateStr?: string) => {
      const targetDate = dateStr || todayDateStr;
      return `/logbook?classId=${encodeURIComponent(classId)}&date=${targetDate}&period=${periodIndex}`;
    },
    [todayDateStr]
  );

  const navigateToLogbook = useCallback(
    (classId: string, periodIndex: number, dateStr?: string) => {
      navigate(getLogbookUrl(classId, periodIndex, dateStr));
    },
    [getLogbookUrl, navigate]
  );

  return {
    currentTime,
    todayDateStr,
    todayDayOfWeek,
    bellStatus,
    isTeachingNow,
    currentTeachingSlot,
    minutesRemainingInClass,
    hasNextTeachingToday,
    nextTeachingSlot,
    minutesUntilNextTeaching,
    todaySlots,
    allTeacherSlots,
    isLoadingSchedule,
    navigateToLogbook,
    getLogbookUrl,
    refreshSchedule: loadSchedule,
  };
}
