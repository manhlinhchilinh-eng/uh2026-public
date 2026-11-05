/**
 * UMS Digital Class Logbook - Real-Time Reactive Hook for Behavior Notes
 * Milestone 3: Real-Time Sync, Analytics & Filtering
 * Path: src/hooks/useBehaviorNotes.ts
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { BehaviorNote, BehaviorType, UserRole } from '../types';
import {
  behaviorNotesQuery,
  getNotesByClass,
  createBehaviorNote,
  deleteBehaviorNote,
  MOCK_BEHAVIOR_NOTES_KEY,
  BEHAVIOR_EVENT_NAME,
} from '../services/behaviorService';
import { recordFirestoreReads } from '../utils/firestoreGuard';

export interface BehaviorNotesFilterState {
  dateRange: 'today' | 'week' | 'month' | 'all' | 'custom';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  studentId: string;  // 'all' | specific studentId
  type: 'all' | BehaviorType; // 'all' | 'positive' | 'negative'
  category: string;   // 'all' | category key or name
  authorRole: 'all' | UserRole;
  searchQuery: string;
}

export interface StudentBehaviorScore {
  studentId: string;
  studentName: string;
  studentNumber?: number | string;
  positiveCount: number;
  negativeCount: number;
  totalCount: number;
}

export interface BehaviorAnalytics {
  totalNotes: number;
  positiveCount: number;
  negativeCount: number;
  positivePercentage: number; // 0.0 - 100.0 rounded to 1 decimal place
  categoryDistribution: Record<string, number>;
  topCommended: Array<{ studentId: string; studentName: string; count: number }>;
  topNeedsImprovement: Array<{ studentId: string; studentName: string; count: number }>;
  studentSummaries: Record<string, StudentBehaviorScore>;
}

export interface UseBehaviorNotesReturn {
  // Data lists
  notes: BehaviorNote[];           // All raw notes for classId
  filteredNotes: BehaviorNote[];   // Notes filtered by current filter state
  // State
  filters: BehaviorNotesFilterState;
  analytics: BehaviorAnalytics;
  loading: boolean;
  error: string | null;
  // Mutators & controls
  setFilters: React.Dispatch<React.SetStateAction<BehaviorNotesFilterState>>;
  updateFilter: (updates: Partial<BehaviorNotesFilterState>) => void;
  resetFilters: () => void;
  addNote: (noteData: Omit<BehaviorNote, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => Promise<BehaviorNote>;
  deleteNote: (noteId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_FILTERS: BehaviorNotesFilterState = {
  dateRange: 'all',
  studentId: 'all',
  type: 'all',
  category: 'all',
  authorRole: 'all',
  searchQuery: '',
};


export function useBehaviorNotes(classId?: string): UseBehaviorNotesReturn {
  const [notes, setNotes] = useState<BehaviorNote[]>([]);
  const [filters, setFilters] = useState<BehaviorNotesFilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const previousNotesRef = useRef<BehaviorNote[]>([]);

  // 1. Data Loading
  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getNotesByClass(classId);
      const sorted = [...data].sort(
        (a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0)
      );
      setNotes(sorted);
      previousNotesRef.current = sorted;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải ghi nhận nề nếp');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    let unsubFirestore: Unsubscribe | null = null;
    let isMounted = true;

    // A. Firestore Live Listener (when db is active and not test env)
    // typeof process: trình duyệt dev không có biến process (trước đây làm sập trang Nề nếp ở dev)
    const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    if (db && typeof window !== 'undefined' && !isTestEnv) {
      try {
        // Có limit (500/lớp, 300 toàn trường, mới nhất trước) — không nghe cả collection
        unsubFirestore = onSnapshot(
          behaviorNotesQuery(classId),
          (snapshot) => {
            if (!isMounted) return;
            recordFirestoreReads('behavior_notes:listen', Math.max(1, snapshot.docChanges().length));
            const liveNotes: BehaviorNote[] = [];
            snapshot.forEach((d) => {
              liveNotes.push({ id: d.id, ...(d.data() as any) });
            });
            liveNotes.sort(
              (a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0)
            );
            setNotes(liveNotes);
            previousNotesRef.current = liveNotes;
            setLoading(false);
          },
          (err) => {
            if (!isMounted) return;
            console.warn('Firestore behavior listener error, falling back to mock:', err);
            loadNotes();
          }
        );
      } catch {
        loadNotes();
      }
    } else {
      loadNotes();
    }

    // B. Window Event Listener for Mock / LocalStorage reactivity
    const handleCustomUpdate = (e: any) => {
      if (!isMounted) return;
      if (!e.detail?.classId || e.detail.classId === classId || classId === 'all') {
        loadNotes();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (!isMounted) return;
      if (e.key === MOCK_BEHAVIOR_NOTES_KEY) {
        loadNotes();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(BEHAVIOR_EVENT_NAME, handleCustomUpdate as EventListener);
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      isMounted = false;
      if (unsubFirestore) unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener(BEHAVIOR_EVENT_NAME, handleCustomUpdate as EventListener);
        window.removeEventListener('storage', handleStorage);
      }
    };
  }, [classId, loadNotes]);

  // 2. Filter Update Helpers
  const updateFilter = useCallback((updates: Partial<BehaviorNotesFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // 3. Computed Date Boundaries
  const dateBoundaries = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Current week Monday to Sunday
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const mondayStr = monday.toISOString().split('T')[0];

    // Current month 1st
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    return { todayStr, mondayStr, monthStartStr };
  }, []);

  // 4. Memoized Filtered Notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Date filter
      if (filters.dateRange !== 'all') {
        const noteDateStr =
          note.date ||
          (note.createdAt || note.timestamp
            ? new Date(note.createdAt || note.timestamp).toISOString().split('T')[0]
            : '');

        if (filters.dateRange === 'today' && noteDateStr !== dateBoundaries.todayStr) {
          return false;
        }
        if (filters.dateRange === 'week' && noteDateStr < dateBoundaries.mondayStr) {
          return false;
        }
        if (filters.dateRange === 'month' && noteDateStr < dateBoundaries.monthStartStr) {
          return false;
        }
        if (filters.dateRange === 'custom') {
          if (filters.startDate && noteDateStr < filters.startDate) return false;
          if (filters.endDate && noteDateStr > filters.endDate) return false;
        }
      }

      // Student filter
      if (filters.studentId !== 'all' && note.studentId !== filters.studentId) {
        return false;
      }

      // Type filter
      if (filters.type !== 'all' && note.type !== filters.type) {
        return false;
      }

      // Category filter
      if (filters.category !== 'all' && note.category !== filters.category) {
        return false;
      }

      // Author Role filter
      if (filters.authorRole !== 'all' && note.authorRole !== filters.authorRole) {
        return false;
      }

      // Search Query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchesName = note.studentName?.toLowerCase().includes(q);
        const matchesDesc = (note.content || note.description || '').toLowerCase().includes(q);
        const matchesAuthor = note.authorName?.toLowerCase().includes(q);
        const matchesCat = note.category?.toLowerCase().includes(q);
        const matchesSubject = note.subject?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesAuthor && !matchesCat && !matchesSubject) {
          return false;
        }
      }

      return true;
    });
  }, [notes, filters, dateBoundaries]);

  // 5. Memoized Real-Time Analytics
  const analytics: BehaviorAnalytics = useMemo(() => {
    const totalNotes = filteredNotes.length;
    let positiveCount = 0;
    let negativeCount = 0;
    const categoryDistribution: Record<string, number> = {};
    const studentSummaries: Record<string, StudentBehaviorScore> = {};

    filteredNotes.forEach((note) => {
      if (note.type === 'positive') positiveCount++;
      if (note.type === 'negative') negativeCount++;

      // Category distribution
      const cat = note.category || 'Khác';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;

      // Student summary
      if (!studentSummaries[note.studentId]) {
        studentSummaries[note.studentId] = {
          studentId: note.studentId,
          studentName: note.studentName,
          studentNumber: note.studentNumber,
          positiveCount: 0,
          negativeCount: 0,
          totalCount: 0,
        };
      }
      if (note.type === 'positive') studentSummaries[note.studentId].positiveCount++;
      if (note.type === 'negative') studentSummaries[note.studentId].negativeCount++;
      studentSummaries[note.studentId].totalCount++;
    });

    const positivePercentage =
      totalNotes > 0 ? Math.round((positiveCount / totalNotes) * 1000) / 10 : 0;

    const studentArr = Object.values(studentSummaries);
    const topCommended = [...studentArr]
      .filter((s) => s.positiveCount > 0)
      .sort((a, b) => b.positiveCount - a.positiveCount)
      .slice(0, 5)
      .map((s) => ({ studentId: s.studentId, studentName: s.studentName, count: s.positiveCount }));

    const topNeedsImprovement = [...studentArr]
      .filter((s) => s.negativeCount > 0)
      .sort((a, b) => b.negativeCount - a.negativeCount)
      .slice(0, 5)
      .map((s) => ({ studentId: s.studentId, studentName: s.studentName, count: s.negativeCount }));

    return {
      totalNotes,
      positiveCount,
      negativeCount,
      positivePercentage,
      categoryDistribution,
      topCommended,
      topNeedsImprovement,
      studentSummaries,
    };
  }, [filteredNotes]);

  // 6. Optimistic Mutations
  const addNote = useCallback(
    async (noteData: Omit<BehaviorNote, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => {
      const created = await createBehaviorNote(noteData);
      setNotes((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
      return created;
    },
    []
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const backup = [...notes];
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      try {
        await deleteBehaviorNote(noteId);
      } catch (err) {
        setNotes(backup); // Rollback on failure
        throw err;
      }
    },
    [notes]
  );

  return {
    notes,
    filteredNotes,
    filters,
    analytics,
    loading,
    error,
    setFilters,
    updateFilter,
    resetFilters,
    addNote,
    deleteNote,
    refresh: loadNotes,
  };
}
