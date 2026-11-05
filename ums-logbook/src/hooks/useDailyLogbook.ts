/**
 * UMS Digital Class Logbook - Reactive Daily Logbook Hook
 * Real-time synchronization via onSnapshot and custom event bus.
 * Optimistic state management with automatic rollback on error.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DailyLogbook,
  PeriodEntry,
  DailyAttendanceBaseline,
  DailyScoreSummary,
} from '../types/logbook';
import {
  generateDailyId,
  getOrCreateDailyLogbook,
  subscribeDailyLogbook,
  subscribePeriodEntries,
  updateAttendanceBaseline,
  savePeriodEntry,
  calculateDailyScoreSummary,
} from '../services/logbookService';

export interface UseDailyLogbookReturn {
  dailyId: string;
  logbook: DailyLogbook | null;
  periods: PeriodEntry[];
  loading: boolean;
  isSyncing: boolean;
  error: string | null;
  summary: DailyScoreSummary | null;
  updateBaseline: (session: 'morning' | 'afternoon', baseline: DailyAttendanceBaseline) => Promise<void>;
  savePeriod: (periodIndex: number, entry: Partial<PeriodEntry>, autoSign?: boolean) => Promise<void>;
  signPeriod: (periodIndex: number, signature: string, teacherId: string, teacherName: string) => Promise<void>;
  refresh: () => Promise<void>;
}

import { getAutoPopulatedPeriods, getClassSchedule } from '../services/scheduleService';
import { academicYearOf, semesterOf, weekNumberOf } from '../utils/academicCalendar';

/**
 * enabled = false (vd. ngày nghỉ): không tạo/nạp sổ, trả về rỗng.
 * createIfMissing = false (mặc định): chỉ khởi tạo sổ nháp trên bộ nhớ RAM, không tự ghi doc rỗng lên Firestore khi chỉ mở xem.
 */
export function useDailyLogbook(
  classId: string,
  date: string,
  enabled = true,
  createIfMissing = false
): UseDailyLogbookReturn {
  const dailyId = useMemo(() => generateDailyId(classId, date), [classId, date]);

  const [logbook, setLogbook] = useState<DailyLogbook | null>(null);
  const [periods, setPeriods] = useState<PeriodEntry[]>(() => {
    return getAutoPopulatedPeriods(classId, date, []);
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // References for rollback buffers
  const previousLogbookRef = useRef<DailyLogbook | null>(null);
  const previousPeriodsRef = useRef<PeriodEntry[]>(periods);

  // Initial load and real-time subscriptions
  useEffect(() => {
    let isMounted = true;
    if (!enabled) {
      setLogbook(null);
      setPeriods([]);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }
    setLoading(true);
    setError(null);

    // Tải TKB thật của lớp rồi điền môn/GV cho các tiết chưa ghi (không đụng tiết đã ghi)
    getClassSchedule(classId)
      .then((sch) => {
        if (!isMounted) return;
        setPeriods((prev) => getAutoPopulatedPeriods(classId, date, prev, sch));
      })
      .catch(() => {});

    // Ensure document initialized (in memory unless createIfMissing = true)
    getOrCreateDailyLogbook(classId, date, '', weekNumberOf(date), createIfMissing)
      .then((initialBook) => {
        if (!isMounted) return;
        setLogbook((prev) => {
          if (prev && (prev.updatedAt || 0) >= (initialBook.updatedAt || 0)) {
            return prev;
          }
          previousLogbookRef.current = initialBook;
          return initialBook;
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Subscribe to Parent Document changes
    const unsubLogbook = subscribeDailyLogbook(dailyId, (updatedBook) => {
      if (!isMounted || !updatedBook) return;
      setLogbook((prev) => {
        if (prev && (prev.updatedAt || 0) > (updatedBook.updatedAt || 0)) {
          return prev;
        }
        previousLogbookRef.current = updatedBook;
        return updatedBook;
      });
    });

    // Subscribe to Periods Subcollection changes
    const unsubPeriods = subscribePeriodEntries(dailyId, (updatedPeriods) => {
      if (!isMounted) return;
      const populated = getAutoPopulatedPeriods(classId, date, updatedPeriods);
      setPeriods(populated);
      previousPeriodsRef.current = populated;
    });

    return () => {
      isMounted = false;
      unsubLogbook();
      unsubPeriods();
    };
  }, [dailyId, classId, date, enabled, createIfMissing]);

  /**
   * Optimistic update for attendance baseline
   */
  const updateBaseline = useCallback(
    async (session: 'morning' | 'afternoon', baseline: DailyAttendanceBaseline) => {
      setError(null);
      setIsSyncing(true);

      const now = Date.now();
      const currentBook: DailyLogbook = logbook || {
        id: dailyId,
        classId,
        date,
        academicYear: academicYearOf(date),
        semester: semesterOf(date),
        weekNumber: weekNumberOf(date),
        morningBaseline: { reportedBy: '', reportedAt: now, session: 'morning', absences: [], earlyDepartures: [] },
        afternoonBaseline: { reportedBy: '', reportedAt: now, session: 'afternoon', absences: [], earlyDepartures: [] },
        preSessionAttendance: { reportedBy: '', reportedAt: now, session: 'morning', absences: [], earlyDepartures: [] },
        totalPeriods: 8,
        status: 'draft',
        isCompleted: false,
        createdAt: now,
        updatedAt: now,
      };

      // Snapshot for rollback
      previousLogbookRef.current = JSON.parse(JSON.stringify(currentBook));

      // Optimistic state update
      const updatedLogbook: DailyLogbook = {
        ...currentBook,
        morningBaseline: session === 'morning' ? baseline : currentBook.morningBaseline,
        afternoonBaseline: session === 'afternoon' ? baseline : currentBook.afternoonBaseline,
        preSessionAttendance: session === 'morning' ? baseline : currentBook.preSessionAttendance,
        updatedAt: now,
      };
      setLogbook(updatedLogbook);

      try {
        await updateAttendanceBaseline(dailyId, session, baseline);
      } catch (err: any) {
        // Rollback on failure
        setLogbook(previousLogbookRef.current);
        setError(`Lỗi cập nhật điểm danh: ${err.message}`);
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [dailyId, classId, date, logbook]
  );

  /**
   * Optimistic update for period saving
   */
  const savePeriod = useCallback(
    async (periodIndex: number, entry: Partial<PeriodEntry>, autoSign = false) => {
      if (periodIndex < 1 || periodIndex > 8) return;
      setError(null);
      setIsSyncing(true);

      // Snapshot for rollback
      const snapshotBefore = JSON.parse(JSON.stringify(periods)) as PeriodEntry[];
      previousPeriodsRef.current = snapshotBefore;

      // Optimistic state update
      const now = Date.now();
      setPeriods((prev) => {
        const next = [...prev];
        const idx = next.findIndex((p) => p.periodIndex === periodIndex);
        if (idx !== -1) {
          const current = next[idx];
          const isSigned = autoSign ? true : (entry.isSigned ?? current.isSigned);
          next[idx] = {
            ...current,
            ...entry,
            isSigned,
            teacherSignature: autoSign
              ? (entry.teacherSignature || entry.teacherName || current.teacherName)
              : (entry.teacherSignature ?? current.teacherSignature),
            signedAt: isSigned ? (current.signedAt || now) : undefined,
            updatedAt: now,
          };
        }
        return next;
      });

      try {
        await savePeriodEntry(dailyId, periodIndex, entry, autoSign, snapshotBefore);
      } catch (err: any) {
        // Rollback on failure
        setPeriods(previousPeriodsRef.current);
        setError(`Lỗi lưu tiết học: ${err.message}`);
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [dailyId, periods]
  );

  /**
   * Period sign-off action
   */
  const signPeriod = useCallback(
    async (periodIndex: number, signature: string, teacherId: string, teacherName: string) => {
      return savePeriod(
        periodIndex,
        {
          teacherSignature: signature,
          teacherId,
          teacherName,
          isSigned: true,
        },
        true
      );
    },
    [savePeriod]
  );

  /**
   * Manual refresh
   */
  const refresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      const book = await getOrCreateDailyLogbook(classId, date, '', weekNumberOf(date), false);
      setLogbook(book);
      previousLogbookRef.current = book;
    } finally {
      setIsSyncing(false);
    }
  }, [classId, date]);

  /**
   * Memoized daily score and attendance summary
   */
  const summary = useMemo(() => {
    if (!logbook) return null;
    return calculateDailyScoreSummary(logbook, periods);
  }, [logbook, periods]);

  return {
    dailyId,
    logbook,
    periods,
    loading,
    isSyncing,
    error,
    summary,
    updateBaseline,
    savePeriod,
    signPeriod,
    refresh,
  };
}
