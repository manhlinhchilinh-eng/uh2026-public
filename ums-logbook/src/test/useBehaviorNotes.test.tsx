/**
 * UMS Digital Class Logbook - useBehaviorNotes Hook Tests
 * Milestone 3: Real-Time Sync, Analytics, Filtering & Optimistic Mutations
 * Path: src/test/useBehaviorNotes.test.tsx
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBehaviorNotes } from '../hooks/useBehaviorNotes';
import {
  saveMockBehaviorNotes,
  notifyBehaviorNoteUpdate,
} from '../services/behaviorService';
import { BehaviorNote } from '../types';

describe('Milestone 3: useBehaviorNotes Reactive Hook', () => {
  const mockNotes: BehaviorNote[] = [
    {
      id: 'note_1',
      studentId: '269398',
      studentName: 'Lý Bảo Duy',
      classId: '6A1',
      type: 'positive',
      category: 'active_participation',
      content: 'Tích cực xây dựng bài học',
      description: 'Tích cực xây dựng bài học',
      authorId: 'mrlinhums',
      authorName: 'Nguyễn Mạnh Linh',
      authorRole: 'admin',
      date: new Date().toISOString().split('T')[0], // Today
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
      timestamp: Date.now() - 10000,
    },
    {
      id: 'note_2',
      studentId: '269048',
      studentName: 'Đinh Minh Tùng',
      classId: '6A1',
      type: 'negative',
      category: 'missing_homework',
      content: 'Không làm bài tập Toán',
      description: 'Không làm bài tập Toán',
      authorId: 'mrlinhums',
      authorName: 'Nguyễn Mạnh Linh',
      authorRole: 'admin',
      date: new Date().toISOString().split('T')[0], // Today
      createdAt: Date.now() - 5000,
      updatedAt: Date.now() - 5000,
      timestamp: Date.now() - 5000,
    },
    {
      id: 'note_3',
      studentId: '269398',
      studentName: 'Lý Bảo Duy',
      classId: '6A1',
      type: 'positive',
      category: 'outstanding_homework',
      content: 'Bài kiểm tra 10 điểm',
      description: 'Bài kiểm tra 10 điểm',
      authorId: 'mrlinhums',
      authorName: 'Nguyễn Mạnh Linh',
      authorRole: 'admin',
      date: '2026-01-01', // Past date
      createdAt: 1767225600000,
      updatedAt: 1767225600000,
      timestamp: 1767225600000,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    saveMockBehaviorNotes(mockNotes);
  });

  it('initializes hook and loads notes for specified class', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notes.length).toBe(3);
    expect(result.current.filteredNotes.length).toBe(3);
  });

  it('filters notes by type (positive vs negative)', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateFilter({ type: 'positive' });
    });

    expect(result.current.filteredNotes.length).toBe(2);
    expect(result.current.filteredNotes.every((n) => n.type === 'positive')).toBe(true);

    act(() => {
      result.current.updateFilter({ type: 'negative' });
    });

    expect(result.current.filteredNotes.length).toBe(1);
    expect(result.current.filteredNotes[0].type).toBe('negative');
  });

  it('filters notes by studentId', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateFilter({ studentId: '269048' });
    });

    expect(result.current.filteredNotes.length).toBe(1);
    expect(result.current.filteredNotes[0].studentName).toBe('Đinh Minh Tùng');
  });

  it('filters notes by search query', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateFilter({ searchQuery: 'Bảo Duy' });
    });

    expect(result.current.filteredNotes.length).toBe(2);
    expect(result.current.filteredNotes.every((n) => n.studentName.includes('Bảo Duy'))).toBe(true);

    act(() => {
      result.current.updateFilter({ searchQuery: 'Toán' });
    });

    expect(result.current.filteredNotes.length).toBe(1);
    expect(result.current.filteredNotes[0].content).toContain('Toán');
  });

  it('filters notes by dateRange: today', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateFilter({ dateRange: 'today' });
    });

    // Notes 1 and 2 are today, note 3 is 2026-01-01
    expect(result.current.filteredNotes.length).toBe(2);
  });

  it('computes real-time behavioral analytics correctly', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const analytics = result.current.analytics;
    expect(analytics.totalNotes).toBe(3);
    expect(analytics.positiveCount).toBe(2);
    expect(analytics.negativeCount).toBe(1);
    expect(analytics.positivePercentage).toBe(66.7); // 2/3 = 66.7%

    expect(analytics.topCommended.length).toBe(1);
    expect(analytics.topCommended[0].studentName).toBe('Lý Bảo Duy');
    expect(analytics.topCommended[0].count).toBe(2);

    expect(analytics.topNeedsImprovement.length).toBe(1);
    expect(analytics.topNeedsImprovement[0].studentName).toBe('Đinh Minh Tùng');
    expect(analytics.topNeedsImprovement[0].count).toBe(1);
  });

  it('resets filters cleanly', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateFilter({ type: 'negative', searchQuery: 'something' });
    });

    expect(result.current.filters.type).toBe('negative');

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters.type).toBe('all');
    expect(result.current.filters.searchQuery).toBe('');
    expect(result.current.filteredNotes.length).toBe(3);
  });

  it('optimistically adds a note', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const added = await result.current.addNote({
        studentId: '269398',
        studentName: 'Lý Bảo Duy',
        classId: '6A1',
        type: 'positive',
        category: 'active_participation',
        content: 'Thêm mới thành công',
        description: 'Thêm mới thành công',
        authorId: 'mrlinhums',
        authorName: 'Nguyễn Mạnh Linh',
        authorRole: 'admin',
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      expect(added.id).toBeDefined();
    });

    expect(result.current.notes.length).toBe(4);
    expect(result.current.notes[0].content).toBe('Thêm mới thành công');
  });

  it('optimistically deletes a note', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteNote('note_1');
    });

    expect(result.current.notes.length).toBe(2);
    expect(result.current.notes.find((n) => n.id === 'note_1')).toBeUndefined();
  });

  it('reacts to external event bus notifications', async () => {
    const { result } = renderHook(() => useBehaviorNotes('6A1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notes.length).toBe(3);

    // Save a new note into localStorage and dispatch event
    const updated = [
      ...mockNotes,
      {
        id: 'note_external',
        studentId: '269398',
        studentName: 'Lý Bảo Duy',
        classId: '6A1',
        type: 'positive' as const,
        category: 'peer_support',
        content: 'Note từ tab khác',
        description: 'Note từ tab khác',
        authorId: 'mrlinhums',
        authorName: 'Nguyễn Mạnh Linh',
        authorRole: 'admin' as const,
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        timestamp: Date.now(),
      },
    ];
    saveMockBehaviorNotes(updated);

    act(() => {
      notifyBehaviorNoteUpdate('create', { classId: '6A1' });
    });

    await waitFor(() => {
      expect(result.current.notes.length).toBe(4);
    });
  });
});
