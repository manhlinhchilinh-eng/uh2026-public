/**
 * UMS Digital Class Logbook - Behavior Notes Service Unit & Integration Tests
 * Milestone 3: Persistence, Taxonomy, Attribution, TPT Authority & Event Bus
 * Path: src/test/behaviorService.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  POSITIVE_BEHAVIOR_CATEGORIES,
  NEGATIVE_BEHAVIOR_CATEGORIES,
  resolveCategoryLabel,
  resolveCategoryBadge,
} from '../types/behavior';
import {
  createBehaviorNote,
  getNotesByClass,
  getNotesByStudent,
  getRecentNotes,
  updateBehaviorNote,
  deleteBehaviorNote,
  acknowledgeBehaviorNote,
  subscribeBehaviorNotesByClass,
  MOCK_BEHAVIOR_NOTES_KEY,
  BEHAVIOR_EVENT_NAME,
} from '../services/behaviorService';
import { UserProfile } from '../types/auth';

describe('Milestone 3: Behavior Notes & Service Layer (src/services/behaviorService.ts)', () => {
  const mockTptUser: UserProfile = {
    uid: 'user_mrhoanglongums',
    username: 'mrhoanglongums',
    email: 'mrhoanglongums@ums.edu.vn',
    displayName: 'Hoàng Long (TPT)',
    roles: ['tpt'],
    mustChangePassword: false,
    createdAt: Date.now(),
  };

  const mockGvcn6A1: UserProfile = {
    uid: 'user_msphuonganhums',
    username: 'msphuonganhums',
    email: 'msphuonganhums@ums.edu.vn',
    displayName: 'Đinh Hoài Long',
    roles: ['gvcn', 'gvbm'],
    assignedClassId: '6A1',
    mustChangePassword: false,
    createdAt: Date.now(),
  };


  const mockGvbmUser: UserProfile = {
    uid: 'user_teacher_math',
    username: 'teachermath',
    email: 'teachermath@ums.edu.vn',
    displayName: 'Thầy Toán',
    roles: ['gvbm'],
    mustChangePassword: false,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
    // Seed mock students
    localStorage.setItem(
      'ums_students',
      JSON.stringify([
        { id: '269398', mhs: '269398', name: 'Lý Bảo Duy', classId: '6A1', stt: 4 },
        { id: '269048', mhs: '269048', name: 'Đinh Minh Tùng', classId: '6A1', stt: 5 },
        { id: '291001', mhs: '291001', name: 'Trần Văn Nam', classId: '9A3', stt: 1 },
      ])
    );
  });

  describe('1. Taxonomy & Label Resolution', () => {
    it('contains all 5 positive categories and 6 negative categories', () => {
      expect(POSITIVE_BEHAVIOR_CATEGORIES.length).toBe(5);
      expect(NEGATIVE_BEHAVIOR_CATEGORIES.length).toBe(6);
      expect(POSITIVE_BEHAVIOR_CATEGORIES.map((c) => c.id)).toContain('active_participation');
      expect(NEGATIVE_BEHAVIOR_CATEGORIES.map((c) => c.id)).toContain('classroom_disruption');
    });

    it('resolves localized labels correctly in VI and EN', () => {
      expect(resolveCategoryLabel('active_participation', 'vi')).toBe('Phát biểu tích cực');
      expect(resolveCategoryLabel('active_participation', 'en')).toBe('Active participation');
      expect(resolveCategoryLabel('Tùy chỉnh cá nhân', 'vi')).toBe('Tùy chỉnh cá nhân');
    });

    it('resolves visual badge styling for standard and custom categories', () => {
      const posBadge = resolveCategoryBadge('active_participation', 'positive');
      expect(posBadge.bg).toContain('emerald');

      const negBadge = resolveCategoryBadge('classroom_disruption', 'negative');
      expect(negBadge.bg).toContain('rose');

      const customBadge = resolveCategoryBadge('custom_item', 'positive');
      expect(customBadge.bg).toBe('bg-emerald-50');
    });
  });

  describe('2. Validation & Role Attribution', () => {
    it('creates note with authorRole: "tpt" when logged by TPT', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Phát biểu rất tích cực trong giờ học',
        },
        mockTptUser
      );

      expect(note.authorRole).toBe('tpt');
      expect(note.authorName).toBe('Hoàng Long (TPT)');
      expect(note.content).toBe('Phát biểu rất tích cực trong giờ học');
      expect(note.description).toBe('Phát biểu rất tích cực trong giờ học');
      expect(note.timestamp).toBeDefined();
    });

    it('creates note with authorRole: "gvcn" when homeroom teacher logs for their class', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Ý thức tốt',
        },
        mockGvcn6A1
      );

      expect(note.authorRole).toBe('gvcn');
      expect(note.authorName).toBe('Đinh Hoài Long');
    });

    it('creates note with authorRole: "gvbm" when subject teacher logs for a class', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'missing_homework',
          content: 'Không làm bài tập Toán',
          subject: 'Toán học',
          periodIndex: 3,
        },
        mockGvbmUser
      );

      expect(note.authorRole).toBe('gvbm');
      expect(note.subject).toBe('Toán học');
      expect(note.periodIndex).toBe(3);
    });

    it('rejects empty content with NOTE_EMPTY_DESCRIPTION', async () => {
      await expect(
        createBehaviorNote(
          {
            studentId: '269398',
            studentName: 'Lý Bảo Duy',
            classId: '6A1',
            type: 'positive',
            category: 'active_participation',
            content: '   ',
          },
          mockTptUser
        )
      ).rejects.toThrow('NOTE_EMPTY_DESCRIPTION');
    });

    it('rejects invalid note type with NOTE_INVALID_TYPE', async () => {
      await expect(
        createBehaviorNote(
          {
            studentId: '269398',
            studentName: 'Lý Bảo Duy',
            classId: '6A1',
            type: 'invalid_type' as any,
            category: 'test',
            content: 'Nội dung hợp lệ',
          },
          mockTptUser
        )
      ).rejects.toThrow('NOTE_INVALID_TYPE');
    });

    it('rejects creation if user mustChangePassword', async () => {
      const unverifiedUser = { ...mockTptUser, mustChangePassword: true };
      await expect(
        createBehaviorNote(
          {
            studentId: '269398',
            studentName: 'Lý Bảo Duy',
            classId: '6A1',
            type: 'positive',
            category: 'active_participation',
            content: 'Ghi nhận tốt',
          },
          unverifiedUser
        )
      ).rejects.toThrow('AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED');
    });

    it('rejects note creation for unknown student ID not in class roster', async () => {
      await expect(
        createBehaviorNote(
          {
            studentId: '999999', // Unknown student
            studentName: 'Người Lạ',
            classId: '6A1',
            type: 'negative',
            category: 'disruption',
            content: 'Vi phạm nề nếp',
          },
          mockTptUser
        )
      ).rejects.toThrow('NOTE_UNKNOWN_STUDENT');
    });

    it('rejects GVCN from writing to another class where they are not authorized', async () => {
      const gvcn9A3Only: UserProfile = {
        uid: 'user_gvcn_9a3',
        username: 'gvcn9a3',
        email: 'gvcn9a3@ums.edu.vn',
        displayName: 'Cô 9A3',
        roles: ['gvcn'], // GVCN only, not GVBM or Admin or TPT
        assignedClassId: '9A3',
        mustChangePassword: false,
        createdAt: Date.now(),
      };

      await expect(
        createBehaviorNote(
          {
            studentId: '269398',
            studentName: 'Lý Bảo Duy',
            classId: '6A1', // Writing to 6A1
            type: 'positive',
            content: 'Khen ngợi',
          },
          gvcn9A3Only
        )
      ).rejects.toThrow('AUTH_FORBIDDEN');
    });
  });

  describe('3. TPT Campus-Wide Authority Across All Classes', () => {
    it('allows TPT to record notes for classes across different grades (6A1 and 9A3)', async () => {
      const note6A1 = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'exemplary_discipline',
          content: 'Xếp hàng nghiêm túc chào cờ',
        },
        mockTptUser
      );

      const note9A3 = await createBehaviorNote(
        {
          studentId: '291001',
          studentName: 'Trần Văn Nam',
          classId: '9A3',
          type: 'negative',
          category: 'phone_usage',
          content: 'Dùng điện thoại trong giờ ra chơi',
        },
        mockTptUser
      );

      expect(note6A1.classId).toBe('6A1');
      expect(note6A1.authorRole).toBe('tpt');
      expect(note9A3.classId).toBe('9A3');
      expect(note9A3.authorRole).toBe('tpt');
    });
  });

  describe('4. Dual-Mode LocalStorage Persistence & Queries', () => {
    it('persists notes to localStorage key and retrieves by class', async () => {
      await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Bài phát biểu hay',
        },
        mockTptUser
      );

      const raw = localStorage.getItem(MOCK_BEHAVIOR_NOTES_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.length).toBe(1);

      const notes = await getNotesByClass('6A1');
      expect(notes.length).toBe(1);
      expect(notes[0].studentId).toBe('269398');
    });

    it('filters notes by type (positive vs negative)', async () => {
      await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Tốt',
        },
        mockTptUser
      );

      await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'phone_usage',
          content: 'Dùng điện thoại',
        },
        mockTptUser
      );

      const positives = await getNotesByClass('6A1', { type: 'positive' });
      expect(positives.length).toBe(1);
      expect(positives[0].type).toBe('positive');

      const negatives = await getNotesByClass('6A1', { type: 'negative' });
      expect(negatives.length).toBe(1);
      expect(negatives[0].type).toBe('negative');
    });

    it('retrieves notes by student ID', async () => {
      await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Tích cực',
        },
        mockTptUser
      );

      const studentNotes = await getNotesByStudent('269398');
      expect(studentNotes.length).toBe(1);
      expect(studentNotes[0].studentName).toBe('Lý Bảo Duy');
    });

    it('retrieves recent notes across all classes', async () => {
      await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: '6A1 note',
        },
        mockTptUser
      );
      await createBehaviorNote(
        {
          studentId: '291001',
          studentName: 'Trần Văn Nam',
          classId: '9A3',
          type: 'negative',
          category: 'disruption',
          content: '9A3 note',
        },
        mockTptUser
      );

      const recent = await getRecentNotes(10);
      expect(recent.length).toBe(2);
    });
  });

  describe('5. Life Cycle: Update, Delete & GVCN Acknowledgment', () => {
    it('author can update note content', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Nội dung ban đầu',
        },
        mockTptUser
      );

      const updated = await updateBehaviorNote(
        note.id,
        { content: 'Nội dung đã được chỉnh sửa' },
        mockTptUser
      );

      expect(updated.content).toBe('Nội dung đã được chỉnh sửa');
      expect(updated.description).toBe('Nội dung đã được chỉnh sửa');
    });

    it('assigned GVCN can acknowledge a note', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'missing_homework',
          content: 'Quên làm bài tập Toán',
        },
        mockTptUser
      );

      expect(note.acknowledgedByGvcn).toBe(false);

      const ackNote = await acknowledgeBehaviorNote(note.id, mockGvcn6A1);
      expect(ackNote.acknowledgedByGvcn).toBe(true);
      expect(ackNote.acknowledgedBy).toBe('Đinh Hoài Long');
      expect(ackNote.acknowledgedAt).toBeDefined();
    });

    it('rejects non-assigned GVCN from acknowledging notes of another class', async () => {
      const mockGvcn7A1: UserProfile = {
        uid: 'user_msthaoums',
        username: 'msthaoums',
        email: 'msthaoums@ums.edu.vn',
        displayName: 'Phạm Hải Yến',
        roles: ['gvcn'],
        assignedClassId: '7A1',
        mustChangePassword: false,
        createdAt: Date.now(),
      };

      const note6A1 = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'negative',
          category: 'missing_homework',
          content: 'Quên làm bài',
        },
        mockTptUser
      );

      await expect(
        acknowledgeBehaviorNote(note6A1.id, mockGvcn7A1)
      ).rejects.toThrow('AUTH_FORBIDDEN');
    });

    it('author or admin can delete a note', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Để xóa',
        },
        mockTptUser
      );

      await deleteBehaviorNote(note.id, mockTptUser);
      const remaining = await getNotesByClass('6A1');
      expect(remaining.find((n) => n.id === note.id)).toBeUndefined();
    });

    it('non-author teacher cannot delete note', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Không thể xóa',
        },
        mockTptUser
      );

      await expect(
        deleteBehaviorNote(note.id, mockGvbmUser)
      ).rejects.toThrow('AUTH_FORBIDDEN');
    });
  });

  describe('6. Real-Time Event Bus', () => {
    it('dispatches CustomEvent on note creation', async () => {
      const listenerSpy = vi.fn();
      window.addEventListener(BEHAVIOR_EVENT_NAME, listenerSpy);

      await createBehaviorNote(
        {
          studentId: '269398',
          studentName: 'Lý Bảo Duy',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Tích cực xây dựng bài',
        },
        mockTptUser
      );

      expect(listenerSpy).toHaveBeenCalled();
      window.removeEventListener(BEHAVIOR_EVENT_NAME, listenerSpy);
    });

    it('subscribeBehaviorNotesByClass receives callback when subscription starts', async () => {
      const callbackSpy = vi.fn();
      const unsub = subscribeBehaviorNotesByClass('6A1', callbackSpy);

      // Wait for promise resolution
      await new Promise((r) => setTimeout(r, 20));
      expect(callbackSpy).toHaveBeenCalled();
      unsub();
    });
  });
});
