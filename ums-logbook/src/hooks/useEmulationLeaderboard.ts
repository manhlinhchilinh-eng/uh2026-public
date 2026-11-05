/**
 * UMS Digital Class Logbook - useEmulationLeaderboard Reactive Hook
 * Milestone 5: 26-Class Emulation Standings, Olympic Podium & Grade Filtering
 * Path: src/hooks/useEmulationLeaderboard.ts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClassEmulationRank } from '../types/summary';
import { getAllClassSummariesForWeek, fetchRealEmulationWeekData } from '../services/summaryService';
import { rankClassesForEmulation, ClassMetadataInfo } from '../utils/emulation';
import { getMockBehaviorNotes, BEHAVIOR_EVENT_NAME } from '../services/behaviorService';
import { generateSeedDataset } from '../services/seedService';
import { currentAcademic } from '../utils/academicCalendar';

export interface UseEmulationLeaderboardResult {
  weekNumber: number;
  setWeekNumber: (w: number) => void;
  gradeFilter: number | 'all';
  setGradeFilter: (g: number | 'all') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  rankings: ClassEmulationRank[];
  filteredRankings: ClassEmulationRank[];
  podium: ClassEmulationRank[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  stats: {
    totalClasses: number;
    goodStudyWeekCount: number;
    averageSchoolScore: number;
    topScore: number;
  };
}

export function useEmulationLeaderboard(
  initialWeekNumber = currentAcademic().weekNumber,
  initialGrade: number | 'all' = 'all',
  academicYear = currentAcademic().academicYear
): UseEmulationLeaderboardResult {
  const [weekNumber, setWeekNumber] = useState<number>(initialWeekNumber);
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>(initialGrade);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rankings, setRankings] = useState<ClassEmulationRank[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cached fallback metadata for the 26 classes
  const fallbackClassesMetadata = useMemo(() => {
    const { classes } = generateSeedDataset();
    const map: Record<string, ClassMetadataInfo> = {};
    for (const c of classes) {
      map[c.id] = {
        classId: c.id,
        className: c.name,
        grade: c.grade,
        gvcnName: c.gvcnName,
      };
    }
    return map;
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const isOfflineDemo =
        typeof window !== 'undefined' &&
        (new URLSearchParams(window.location.search).get('offline_demo') === '1' ||
          localStorage.getItem('ums_offline_demo') === '1');

      if (!isOfflineDemo) {
        const real = await fetchRealEmulationWeekData(weekNumber, academicYear);
        if (real) {
          const meta =
            Object.keys(real.classesMetadata).length > 0
              ? { ...fallbackClassesMetadata, ...real.classesMetadata }
              : fallbackClassesMetadata;
          const rankedList = rankClassesForEmulation(real.summaries, real.notes, meta);
          setRankings(rankedList);
          setIsLoading(false);
          return;
        }
      }

      // Fallback cho môi trường unit test hoặc chế độ demo offline
      const summaries = await getAllClassSummariesForWeek(weekNumber, academicYear);
      const notes = getMockBehaviorNotes();
      const rankedList = rankClassesForEmulation(summaries, notes, fallbackClassesMetadata);

      setRankings(rankedList);
      setIsLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi tải bảng xếp hạng thi đua';
      setError(msg);
      setIsLoading(false);
    }
  }, [weekNumber, academicYear, fallbackClassesMetadata]);


  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Reactive event listener for summary updates and behavior notes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUpdate = () => {
      loadLeaderboard();
    };

    window.addEventListener('ums_summary_update', handleUpdate);
    window.addEventListener(BEHAVIOR_EVENT_NAME, handleUpdate);

    return () => {
      window.removeEventListener('ums_summary_update', handleUpdate);
      window.removeEventListener(BEHAVIOR_EVENT_NAME, handleUpdate);
    };
  }, [loadLeaderboard]);

  // Filter rankings by grade and search query
  const filteredRankings = useMemo(() => {
    return rankings.filter((item) => {
      if (gradeFilter !== 'all' && item.grade !== gradeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchClass = item.className.toLowerCase().includes(query);
        const matchGvcn = item.gvcnName.toLowerCase().includes(query);
        return matchClass || matchGvcn;
      }
      return true;
    });
  }, [rankings, gradeFilter, searchQuery]);

  // Top 3 Podium (from current filtered view, or global if not enough)
  const podium = useMemo(() => {
    return filteredRankings.slice(0, 3);
  }, [filteredRankings]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalClasses = rankings.length;
    const goodStudyWeekCount = rankings.filter((r) => r.isGoodStudyWeek).length;
    const sumScore = rankings.reduce((acc, r) => acc + r.totalScore, 0);
    const averageSchoolScore =
      totalClasses > 0 ? Math.round((sumScore / totalClasses) * 10) / 10 : 0;
    const topScore = rankings.length > 0 ? rankings[0].totalScore : 100;

    return {
      totalClasses,
      goodStudyWeekCount,
      averageSchoolScore,
      topScore,
    };
  }, [rankings]);

  return {
    weekNumber,
    setWeekNumber,
    gradeFilter,
    setGradeFilter,
    searchQuery,
    setSearchQuery,
    rankings,
    filteredRankings,
    podium,
    isLoading,
    error,
    refresh: loadLeaderboard,
    stats,
  };
}
