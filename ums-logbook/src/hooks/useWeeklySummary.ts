/**
 * UMS Digital Class Logbook - useWeeklySummary Reactive Hook
 * Milestone 5: Reactive weekly summary data fetching, lazy calculation & GVCN review
 * Path: src/hooks/useWeeklySummary.ts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WeeklySummary } from '../types/summary';
import { DailyLogbook, PeriodEntry } from '../types/logbook';
import {
  getWeeklySummary,
  saveWeeklySummary,
  calculateWeeklySummary,
  getWeekDatesForAcademicYear,
  fetchClassWeekData,
} from '../services/summaryService';
import { fetchSchedulesStrict } from '../services/scheduleService';
import { fetchSchoolCalendar } from '../services/schoolCalendarService';
import { fetchMixedRules } from '../services/mixedPeriodService';
import { getOffDayInfo } from '../utils/schoolCalendar';
import { findMixedRule } from '../utils/mixedPeriods';
import { localToday } from '../utils/academicCalendar';
import { UMS_BELL_SCHEDULE } from '../utils/schedule';


/**
 * TKB thật của lớp + lịch nghỉ + lớp trộn, để liệt kê ĐỦ tiết chưa ký (kể cả tiết GV chưa mở).
 * Không có TKB thật trên Firestore → bỏ qua (không dùng TKB mẫu để tránh cảnh báo giả).
 */
/** Tiết đã hết giờ chưa (ngày trước hôm nay: rồi; hôm nay: theo giờ chuông) */
export function periodOver(date: string, periodIndex: number, now: Date = new Date()): boolean {
  const today = localToday(now);
  if (date !== today) return date < today;
  const bell = UMS_BELL_SCHEDULE.find((b) => b.periodIndex === periodIndex);
  if (!bell) return true;
  const [h, m] = bell.endTime.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
}

/** Bản tổng kết tuần đã lưu cần tính lại khi: lưu cách đây > 10 phút VÀ tuần chưa qua quá 30 ngày (GV còn ký muộn). */
export const SUMMARY_STALE_MS = 10 * 60_000;
export function isSummaryStale(updatedAt: number | undefined, weekEndIso: string, now: number = Date.now()): boolean {
  if (!updatedAt) return true;
  if (now - updatedAt < SUMMARY_STALE_MS) return false;
  const [y, m, d] = weekEndIso.split('-').map(Number);
  const weekEndMs = new Date(y, m - 1, d, 23, 59, 59).getTime();
  return now - weekEndMs < 30 * 86_400_000;
}

async function loadTkbContext(classId: string) {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return {};
  try {
    const [schedules, calendar, mixedRules] = await Promise.all([
      fetchSchedulesStrict(),
      fetchSchoolCalendar(),
      fetchMixedRules(),
    ]);
    const sch = schedules[classId];
    if (!sch?.slots?.length) return {};
    return {
      tkbSlots: sch.slots,
      today: localToday(),
      isOffDate: (d: string) => getOffDayInfo(d, calendar).off,
      isMixedSlot: (subject: string) => !!findMixedRule(classId, subject, mixedRules),
      isDefault10Slot: (subject: string) => findMixedRule(classId, subject, mixedRules)?.mode === 'auto10',
      isPeriodOver: (date: string, periodIndex: number) => periodOver(date, periodIndex),
    };
  } catch {
    return {};
  }
}

export interface UseWeeklySummaryResult {
  summary: WeeklySummary | null;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  recalculate: () => Promise<WeeklySummary | null>;
  saveGvcnNote: (note: string) => Promise<boolean>;
  saveBghComment: (comment: string) => Promise<boolean>;
}

export function useWeeklySummary(
  classId: string,
  weekNumber: number,
  academicYear = '2026-2027'
): UseWeeklySummaryResult {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Recalculates summary from raw daily logbooks & period records
  const recalculate = useCallback(async (): Promise<WeeklySummary | null> => {
    if (!classId || !weekNumber) return null;
    setIsLoading(true);
    setError(null);

    try {
      const range = getWeekDatesForAcademicYear(weekNumber, academicYear);

      // 1. Gather raw daily logbooks for this class and week
      let dailyLogbooks: DailyLogbook[] = [];
      const periodsByDailyId: Record<string, PeriodEntry[]> = {};

      // Dữ liệu THẬT từ Firestore; chỉ khi chạy test mới dùng dữ liệu thử trong trình duyệt
      const real = await fetchClassWeekData(classId, range.weekDates);
      if (real) {
        dailyLogbooks = real.dailyLogbooks;
        Object.assign(periodsByDailyId, real.periodsByDailyId);
      } else if (typeof localStorage !== 'undefined') {
        try {
          const rawLb = localStorage.getItem('ums_daily_logbooks');
          if (rawLb) {
            const parsed = JSON.parse(rawLb);
            const allLb: DailyLogbook[] = Array.isArray(parsed) ? parsed : Object.values(parsed);
            dailyLogbooks = allLb.filter(
              (b) => b.classId === classId && range.weekDates.includes(b.date)
            );
          }

          // Gather period entries
          for (const date of range.weekDates) {
            const dailyId = `${classId}_${date}`;
            const rawP = localStorage.getItem(`ums_period_entries_${dailyId}`);
            if (rawP) {
              periodsByDailyId[dailyId] = JSON.parse(rawP);
            }
          }
        } catch (e) {
          console.warn('Failed to parse local storage logbooks during recalculation', e);
        }
      }

      // Preserve existing notes
      const existing = await getWeeklySummary(classId, weekNumber, academicYear);
      const gvcnNote = existing?.gvcnWeeklyNote || existing?.gvcnComments || '';

      const freshSummary = calculateWeeklySummary(
        classId,
        weekNumber,
        dailyLogbooks,
        periodsByDailyId,
        {
          academicYear,
          startDate: range.startDate,
          endDate: range.endDate,
          gvcnWeeklyNote: gvcnNote,
          ...(await loadTkbContext(classId)),
        }
      );

      // Lưu lại để BGH/TPT dùng; không có quyền ghi (TPT, Giám thị) vẫn hiển thị kết quả
      await saveWeeklySummary(freshSummary).catch((e) => console.warn('[Tổng kết tuần] không lưu được', e));

      if (mountedRef.current) {
        setSummary(freshSummary);
        setIsLoading(false);
      }
      return freshSummary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tính toán tổng kết tuần';
      if (mountedRef.current) {
        setError(msg);
        setIsLoading(false);
      }
      return null;
    }
  }, [classId, weekNumber, academicYear]);

  // Primary loader: nếu đã có bản lưu weekly_summaries thì dùng ngay (1 lượt đọc),
  // chỉ tự tính lại toàn tuần khi chưa có bản lưu hoặc khi có sự kiện cập nhật sổ / bấm nút "Tính lại".
  const loadSummary = useCallback(async () => {
    if (!classId || !weekNumber) {
      setSummary(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const stored = await getWeeklySummary(classId, weekNumber, academicYear);
      // Bản lưu cũ (GV ký trên máy khác không làm máy này tính lại) → tính lại từ sổ thật, tối đa 10 phút/lần
      const weekEnd = getWeekDatesForAcademicYear(weekNumber, academicYear).endDate;
      if (stored && !isSummaryStale(stored.updatedAt, weekEnd)) {
        if (mountedRef.current) {
          setSummary(stored);
          setIsLoading(false);
        }
        return;
      }
      await recalculate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi tải tổng kết tuần';
      if (mountedRef.current) {
        setError(msg);
        setIsLoading(false);
      }
    }
  }, [classId, weekNumber, academicYear, recalculate]);

  useEffect(() => {
    mountedRef.current = true;
    loadSummary();

    return () => {
      mountedRef.current = false;
    };
  }, [loadSummary]);

  // Listen to summary updates and logbook period changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSummaryUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (
        detail &&
        detail.classId === classId &&
        (!detail.weekNumber || detail.weekNumber === weekNumber)
      ) {
        // Chỉ đọc lại bản đã lưu (KHÔNG tính + lưu lại → tránh vòng lặp lưu → sự kiện → lưu)
        getWeeklySummary(classId, weekNumber, academicYear)
          .then((s) => s && mountedRef.current && setSummary(s))
          .catch(() => {});
      }
    };

    const handleLogbookUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.dailyId && detail.dailyId.startsWith(`${classId}_`)) {
        // Trigger non-blocking re-evaluation
        recalculate();
      }
    };

    window.addEventListener('ums_summary_update', handleSummaryUpdate);
    window.addEventListener('ums_logbook_update', handleLogbookUpdate);

    return () => {
      window.removeEventListener('ums_summary_update', handleSummaryUpdate);
      window.removeEventListener('ums_logbook_update', handleLogbookUpdate);
    };
  }, [classId, weekNumber, academicYear, recalculate]);

  // Save GVCN weekly note with optimistic local update
  const saveGvcnNote = useCallback(
    async (note: string): Promise<boolean> => {
      if (!summary) return false;

      setIsSaving(true);
      const previousSummary = { ...summary };
      const updatedSummary: WeeklySummary = {
        ...summary,
        gvcnWeeklyNote: note,
        gvcnComments: note,
        updatedAt: Date.now(),
      };

      // Optimistic update
      setSummary(updatedSummary);

      try {
        await saveWeeklySummary(updatedSummary);
        if (mountedRef.current) {
          setIsSaving(false);
        }
        return true;
      } catch (err) {
        // Rollback on failure
        if (mountedRef.current) {
          setSummary(previousSummary);
          setError('Không thể lưu nhận xét GVCN. Đã khôi phục dữ liệu.');
          setIsSaving(false);
        }
        return false;
      }
    },
    [summary]
  );

  // Save BGH feedback
  const saveBghComment = useCallback(
    async (comment: string): Promise<boolean> => {
      if (!summary) return false;

      setIsSaving(true);
      const updatedSummary: WeeklySummary = {
        ...summary,
        bghComments: comment,
        updatedAt: Date.now(),
      };

      setSummary(updatedSummary);

      try {
        await saveWeeklySummary(updatedSummary);
        if (mountedRef.current) {
          setIsSaving(false);
        }
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError('Không thể lưu ý kiến BGH.');
          setIsSaving(false);
        }
        return false;
      }
    },
    [summary]
  );

  return {
    summary,
    isLoading,
    error,
    isSaving,
    recalculate,
    saveGvcnNote,
    saveBghComment,
  };
}
