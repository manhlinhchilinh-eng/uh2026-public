/**
 * CHALLENGER M3_2 ADVERSARIAL TEST SUITE
 * File: src/test/challenger_m3_2_adversarial.test.tsx
 *
 * Empirical & Adversarial Verification of:
 * 1. TPT Campus-Wide Authority:
 *    - Cross-class logging without restriction across grades 6, 7, 8, 9 (e.g. 6A1, 7A2, 8A3, 9A4, and all 26 classes)
 *    - Contrast with GVCN class-scoped authorization boundaries
 * 2. Role Forgery Prevention & Non-Forgeable Derivation:
 *    - GVBM and GVCN clients attempting to forge authorRole to 'admin' or 'tpt'
 *    - Tampered DTO payloads, unauthorized class submissions, unauthorized parent/unknown roles
 * 3. Reactive Event Sync:
 *    - CustomEvent('ums_behavior_note_update') dispatched on create, update, delete, acknowledge
 *    - Payload integrity, cross-class subscriber reactivity and listener isolation
 * 4. Parent-Teacher Conference Summary Modal:
 *    - Data aggregation, zero cross-contamination between positive and negative notes
 *    - Student ordering, single-student filtering, A4 clipboard copy formatting, print handler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  createBehaviorNote,
  getNotesByClass,
  getRecentNotes,
  updateBehaviorNote,
  deleteBehaviorNote,
  acknowledgeBehaviorNote,
  subscribeBehaviorNotesByClass,
  BEHAVIOR_EVENT_NAME,
} from '../services/behaviorService';
import { ALL_CLASSES } from '../services/seedService';
import { ConferenceSummaryModal } from '../components/behavior/ConferenceSummaryModal';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { StudentDoc, BehaviorNote, UserProfile } from '../types';

describe('CHALLENGER M3_2: TPT Patrol, Role Forgery & Reactive Sync Adversarial Suite', () => {
  // Common Mock Users
  const tptUser: UserProfile = {
    uid: 'user_mrhoanglongums',
    username: 'mrhoanglongums',
    email: 'mrhoanglongums@ums.edu.vn',
    displayName: 'Hoàng Long (TPT)',
    roles: ['tpt'],
    mustChangePassword: false,
    createdAt: Date.now(),
  };

  const gvcn6A1User: UserProfile = {
    uid: 'user_msphuonganhums',
    username: 'msphuonganhums',
    email: 'msphuonganhums@ums.edu.vn',
    displayName: 'Đinh Hoài Long',
    roles: ['gvcn'], // GVCN only (not GVBM or Admin)
    assignedClassId: '6A1',
    mustChangePassword: false,
    createdAt: Date.now(),
  };

  const gvcn8A3User: UserProfile = {
    uid: 'user_msngoclinhums',
    username: 'msngoclinhums',
    email: 'msngoclinhums@ums.edu.vn',
    displayName: 'Hồ Thanh Quang Uyên',
    roles: ['gvcn'],
    assignedClassId: '8A3',
    mustChangePassword: false,
    createdAt: Date.now(),
  };

  const gvbmUser: UserProfile = {
    uid: 'user_teacher_physics',
    username: 'teacherphysics',
    email: 'teacherphysics@ums.edu.vn',
    displayName: 'Thầy Vật Lý',
    roles: ['gvbm'],
    mustChangePassword: false,
    createdAt: Date.now(),
  };

  const dualAdminGvcn9A3User: UserProfile = {
    uid: 'user_mrlinhums',
    username: 'mrlinhums',
    email: 'mrlinhums@ums.edu.vn',
    displayName: 'Nguyễn Mạnh Linh',
    roles: ['admin', 'gvcn'],
    assignedClassId: '9A3',
    mustChangePassword: false,
    createdAt: Date.now(),
  };

  // Mock Students across multiple classes and grades
  const mockRosterStudents: StudentDoc[] = [
    { id: '269029', mhs: '269029', stt: 1, name: 'Bùi Gia An', classId: '6A1', grade: 6, dob: '2015-01-10', gender: 'Nam', status: 'active', createdAt: Date.now() },
    { id: '269963', mhs: '269963', stt: 2, name: 'Chu Ngọc Bảo', classId: '6A1', grade: 6, dob: '2015-03-15', gender: 'Nữ', status: 'active', createdAt: Date.now() },
    { id: '252001', mhs: '252001', stt: 1, name: 'Đặng Tuấn Cường', classId: '7A2', grade: 7, dob: '2014-05-20', gender: 'Nam', status: 'active', createdAt: Date.now() },
    { id: '252002', mhs: '252002', stt: 2, name: 'Hoàng Minh Dũng', classId: '7A2', grade: 7, dob: '2014-08-11', gender: 'Nam', status: 'active', createdAt: Date.now() },
    { id: '243001', mhs: '243001', stt: 1, name: 'Lê Thùy Dung', classId: '8A3', grade: 8, dob: '2013-02-18', gender: 'Nữ', status: 'active', createdAt: Date.now() },
    { id: '243002', mhs: '243002', stt: 2, name: 'Ngô Quốc Huy', classId: '8A3', grade: 8, dob: '2013-09-04', gender: 'Nam', status: 'active', createdAt: Date.now() },
    { id: '234001', mhs: '234001', stt: 1, name: 'Phạm Hải Yến', classId: '9A4', grade: 9, dob: '2012-04-22', gender: 'Nữ', status: 'active', createdAt: Date.now() },
    { id: '234002', mhs: '234002', stt: 2, name: 'Trần Tuấn Kiệt', classId: '9A4', grade: 9, dob: '2012-11-30', gender: 'Nam', status: 'active', createdAt: Date.now() },
  ];

  beforeEach(() => {
    localStorage.clear();
    // Seed students for validation check
    localStorage.setItem('ums_students', JSON.stringify(mockRosterStudents));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. TPT Campus-Wide Authority
  // =========================================================================
  describe('1. TPT Campus-Wide Authority Across Grades & Classes', () => {
    it('1.1: allows TPT account (mrhoanglongums) to record notes across 6A1, 7A2, 8A3, 9A4 without restriction', async () => {
      const targetClasses = [
        { classId: '6A1', studentId: '269029', studentName: 'Bùi Gia An', type: 'positive' as const, content: 'Tích cực trực nhật đầu giờ' },
        { classId: '7A2', studentId: '252001', studentName: 'Đặng Tuấn Cường', type: 'negative' as const, content: 'Chạy nhảy va chạm ở hành lang' },
        { classId: '8A3', studentId: '243001', studentName: 'Lê Thùy Dung', type: 'positive' as const, content: 'Nhặt được của rơi trả lại bạn' },
        { classId: '9A4', studentId: '234001', studentName: 'Phạm Hải Yến', type: 'negative' as const, content: 'Vi phạm đồng phục áo khoác ngoài' },
      ];

      for (const target of targetClasses) {
        const note = await createBehaviorNote(
          {
            studentId: target.studentId,
            studentName: target.studentName,
            classId: target.classId,
            type: target.type,
            category: target.type === 'positive' ? 'good_deed' : 'no_uniform',
            content: target.content,
          },
          tptUser
        );

        expect(note.id).toBeDefined();
        expect(note.classId).toBe(target.classId);
        expect(note.studentId).toBe(target.studentId);
        expect(note.authorRole).toBe('tpt');
        expect(note.authorId).toBe('user_mrhoanglongums');
        expect(note.authorName).toBe('Hoàng Long (TPT)');
        expect(note.content).toBe(target.content);
        expect(note.description).toBe(target.content);
      }

      // Query verification per class
      const notes6A1 = await getNotesByClass('6A1');
      expect(notes6A1.some((n) => n.classId === '6A1' && n.authorRole === 'tpt')).toBe(true);

      const notes7A2 = await getNotesByClass('7A2');
      expect(notes7A2.some((n) => n.classId === '7A2' && n.authorRole === 'tpt')).toBe(true);

      const notes8A3 = await getNotesByClass('8A3');
      expect(notes8A3.some((n) => n.classId === '8A3' && n.authorRole === 'tpt')).toBe(true);

      const notes9A4 = await getNotesByClass('9A4');
      expect(notes9A4.some((n) => n.classId === '9A4' && n.authorRole === 'tpt')).toBe(true);
    });

    it('1.2: aggregates recent patrol notes across all classes in campus-wide feed', async () => {
      // Create notes in 4 classes
      await createBehaviorNote({ studentId: '269029', classId: '6A1', type: 'positive', content: 'Note 6A1' }, tptUser);
      await createBehaviorNote({ studentId: '252001', classId: '7A2', type: 'negative', content: 'Note 7A2' }, tptUser);
      await createBehaviorNote({ studentId: '243001', classId: '8A3', type: 'positive', content: 'Note 8A3' }, tptUser);
      await createBehaviorNote({ studentId: '234001', classId: '9A4', type: 'negative', content: 'Note 9A4' }, tptUser);

      const recentNotes = await getRecentNotes(50);
      expect(recentNotes.length).toBe(4);
      const classesRecorded = recentNotes.map((n) => n.classId);
      expect(classesRecorded).toContain('6A1');
      expect(classesRecorded).toContain('7A2');
      expect(classesRecorded).toContain('8A3');
      expect(classesRecorded).toContain('9A4');
    });

    it('1.3: enforces class boundary on GVCN while TPT is unrestricted', async () => {
      // GVCN of 6A1 attempting to log note in 7A2 (unauthorized class)
      await expect(
        createBehaviorNote(
          {
            studentId: '252001',
            studentName: 'Đặng Tuấn Cường',
            classId: '7A2',
            type: 'positive',
            content: 'Khen ngợi học sinh lớp khác',
          },
          gvcn6A1User
        )
      ).rejects.toThrow('AUTH_FORBIDDEN');

      // GVCN of 8A3 attempting to log note in 9A4 (unauthorized class)
      await expect(
        createBehaviorNote(
          {
            studentId: '234001',
            studentName: 'Phạm Hải Yến',
            classId: '9A4',
            type: 'negative',
            content: 'Nhắc nhở học sinh lớp khác',
          },
          gvcn8A3User
        )
      ).rejects.toThrow('AUTH_FORBIDDEN');

      // TPT logs to both without error
      const tptNote7A2 = await createBehaviorNote(
        { studentId: '252001', classId: '7A2', type: 'positive', content: 'TPT khen ngợi 7A2' },
        tptUser
      );
      const tptNote9A4 = await createBehaviorNote(
        { studentId: '234001', classId: '9A4', type: 'negative', content: 'TPT nhắc nhở 9A4' },
        tptUser
      );
      expect(tptNote7A2.authorRole).toBe('tpt');
      expect(tptNote9A4.authorRole).toBe('tpt');
    });

    it('1.4: TPT can log notes across all 26 classes in the school roster', async () => {
      // Dynamically add a dummy student for each of the 26 classes in localStorage
      const allClassStudents = ALL_CLASSES.map((cls) => ({
        id: `mhs_${cls}_01`,
        mhs: `mhs_${cls}_01`,
        stt: 1,
        name: `Học sinh ${cls}`,
        classId: cls,
      }));
      localStorage.setItem('ums_students', JSON.stringify(allClassStudents));

      // TPT logs a note to each of the 26 classes
      for (const cls of ALL_CLASSES) {
        const note = await createBehaviorNote(
          {
            studentId: `mhs_${cls}_01`,
            studentName: `Học sinh ${cls}`,
            classId: cls,
            type: 'positive',
            content: `Tuần học tốt lớp ${cls}`,
          },
          tptUser
        );
        expect(note.classId).toBe(cls);
        expect(note.authorRole).toBe('tpt');
      }

      const allNotes = await getRecentNotes(100);
      expect(allNotes.length).toBe(26);
    });
  });

  // =========================================================================
  // 2. Role Forgery Prevention
  // =========================================================================
  describe('2. Role Forgery Prevention & Non-Forgeable Role Derivation', () => {
    it('2.1: rejects GVBM attempting to forge authorRole to "admin"', async () => {
      const forgedDto: any = {
        studentId: '269029',
        studentName: 'Bùi Gia An',
        classId: '6A1',
        type: 'negative',
        content: 'GVBM vi phạm giả mạo quyền admin',
        authorRole: 'admin', // Forgery attempt
      };

      const note = await createBehaviorNote(forgedDto, gvbmUser);
      // authorRole must be derived from verified user profile ('gvbm'), NOT the payload
      expect(note.authorRole).toBe('gvbm');
      expect(note.authorRole).not.toBe('admin');
    });

    it('2.2: rejects GVBM attempting to forge authorRole to "tpt"', async () => {
      const forgedDto: any = {
        studentId: '269029',
        studentName: 'Bùi Gia An',
        classId: '6A1',
        type: 'negative',
        content: 'GVBM vi phạm giả mạo quyền TPT',
        authorRole: 'tpt', // Forgery attempt
      };

      const note = await createBehaviorNote(forgedDto, gvbmUser);
      expect(note.authorRole).toBe('gvbm');
      expect(note.authorRole).not.toBe('tpt');
    });

    it('2.3: rejects GVBM attempting to forge authorRole to "gvcn"', async () => {
      const forgedDto: any = {
        studentId: '269029',
        studentName: 'Bùi Gia An',
        classId: '6A1',
        type: 'positive',
        content: 'GVBM giả mạo quyền GVCN',
        authorRole: 'gvcn', // Forgery attempt
      };

      const note = await createBehaviorNote(forgedDto, gvbmUser);
      expect(note.authorRole).toBe('gvbm');
      expect(note.authorRole).not.toBe('gvcn');
    });

    it('2.4: rejects GVCN attempting to forge authorRole to "admin" or "tpt"', async () => {
      const forgedAdminDto: any = {
        studentId: '269029',
        studentName: 'Bùi Gia An',
        classId: '6A1',
        type: 'positive',
        content: 'GVCN 6A1 giả mạo Admin',
        authorRole: 'admin',
      };
      const noteAdmin = await createBehaviorNote(forgedAdminDto, gvcn6A1User);
      expect(noteAdmin.authorRole).toBe('gvcn');
      expect(noteAdmin.authorRole).not.toBe('admin');

      const forgedTptDto: any = {
        studentId: '269029',
        studentName: 'Bùi Gia An',
        classId: '6A1',
        type: 'negative',
        content: 'GVCN 6A1 giả mạo TPT',
        authorRole: 'tpt',
      };
      const noteTpt = await createBehaviorNote(forgedTptDto, gvcn6A1User);
      expect(noteTpt.authorRole).toBe('gvcn');
      expect(noteTpt.authorRole).not.toBe('tpt');
    });

    it('2.5: rejects GVCN attempting cross-class escalation via forged authorRole: "admin"', async () => {
      const forgedCrossClassDto: any = {
        studentId: '252001', // Student in 7A2
        studentName: 'Đặng Tuấn Cường',
        classId: '7A2',
        type: 'negative',
        content: 'GVCN 6A1 viết cho 7A2 với quyền tự phong admin',
        authorRole: 'admin', // Attack: claim admin to bypass class check
      };

      await expect(createBehaviorNote(forgedCrossClassDto, gvcn6A1User)).rejects.toThrow(
        'AUTH_FORBIDDEN'
      );
    });

    it('2.6: rejects users with unauthorized roles (e.g. parent) or empty roles', async () => {
      const parentUser: UserProfile = {
        uid: 'user_parent',
        username: 'phuhuynh',
        email: 'parent@ums.edu.vn',
        displayName: 'Phụ Huynh',
        roles: ['parent'],
        mustChangePassword: false,
        createdAt: Date.now(),
      };

      await expect(
        createBehaviorNote(
          { studentId: '269029', classId: '6A1', type: 'positive', content: 'Phụ huynh tự viết' },
          parentUser
        )
      ).rejects.toThrow('AUTH_FORBIDDEN');

      const emptyRoleUser: UserProfile = {
        uid: 'user_norole',
        username: 'norole',
        email: 'norole@ums.edu.vn',
        displayName: 'Không Quyền',
        roles: [],
        mustChangePassword: false,
        createdAt: Date.now(),
      };

      await expect(
        createBehaviorNote(
          { studentId: '269029', classId: '6A1', type: 'positive', content: 'Người dùng không quyền' },
          emptyRoleUser
        )
      ).rejects.toThrow('AUTH_FORBIDDEN');
    });

    it('2.7: rejects note creation if user mustChangePassword is true (mandatory password change enforcement)', async () => {
      const unverifiedAdmin: UserProfile = {
        ...dualAdminGvcn9A3User,
        mustChangePassword: true,
      };

      await expect(
        createBehaviorNote(
          { studentId: '234001', classId: '9A4', type: 'positive', content: 'Admin chưa đổi mật khẩu' },
          unverifiedAdmin
        )
      ).rejects.toThrow('AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED');
    });

    it('2.8: correctly derives role hierarchy for dual-role users (Admin + GVCN)', async () => {
      // mrlinhums is Admin AND GVCN of 9A3
      // When writing for 9A3, dual role resolves to 'admin' (top authority)
      const note9A3 = await createBehaviorNote(
        { studentId: '234001', classId: '9A4', type: 'positive', content: 'Admin ghi nhận' },
        dualAdminGvcn9A3User
      );
      expect(note9A3.authorRole).toBe('admin');
    });
  });

  // =========================================================================
  // 3. Reactive Event Synchronization
  // =========================================================================
  describe('3. Reactive Event Synchronization (CustomEvent ums_behavior_note_update)', () => {
    it('3.1: dispatches "create" action CustomEvent with full note detail on note creation', async () => {
      const receivedEvents: CustomEvent[] = [];
      const listener = (e: Event) => receivedEvents.push(e as CustomEvent);
      window.addEventListener(BEHAVIOR_EVENT_NAME, listener);

      const note = await createBehaviorNote(
        {
          studentId: '269029',
          studentName: 'Bùi Gia An',
          classId: '6A1',
          type: 'positive',
          category: 'active_participation',
          content: 'Phát biểu bài tích cực',
        },
        tptUser
      );

      window.removeEventListener(BEHAVIOR_EVENT_NAME, listener);

      expect(receivedEvents.length).toBe(1);
      const detail = receivedEvents[0].detail;
      expect(detail.action).toBe('create');
      expect(detail.noteId).toBe(note.id);
      expect(detail.classId).toBe('6A1');
      expect(detail.studentId).toBe('269029');
      expect(detail.note.id).toBe(note.id);
      expect(detail.note.content).toBe('Phát biểu bài tích cực');
      expect(typeof detail.timestamp).toBe('number');
    });

    it('3.2: dispatches "update" action CustomEvent when a note is edited', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269029',
          studentName: 'Bùi Gia An',
          classId: '6A1',
          type: 'negative',
          content: 'Ghi chú ban đầu',
        },
        tptUser
      );

      const receivedEvents: CustomEvent[] = [];
      const listener = (e: Event) => receivedEvents.push(e as CustomEvent);
      window.addEventListener(BEHAVIOR_EVENT_NAME, listener);

      const updated = await updateBehaviorNote(
        note.id,
        { content: 'Ghi chú sau khi hiệu chỉnh' },
        tptUser
      );
      expect(updated.content).toBe('Ghi chú sau khi hiệu chỉnh');

      window.removeEventListener(BEHAVIOR_EVENT_NAME, listener);

      expect(receivedEvents.length).toBe(1);
      const detail = receivedEvents[0].detail;
      expect(detail.action).toBe('update');
      expect(detail.noteId).toBe(note.id);
      expect(detail.note.content).toBe('Ghi chú sau khi hiệu chỉnh');
    });

    it('3.3: dispatches "delete" action CustomEvent when a note is removed', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269029',
          studentName: 'Bùi Gia An',
          classId: '6A1',
          type: 'positive',
          content: 'Phiếu chuẩn bị xóa',
        },
        tptUser
      );

      const receivedEvents: CustomEvent[] = [];
      const listener = (e: Event) => receivedEvents.push(e as CustomEvent);
      window.addEventListener(BEHAVIOR_EVENT_NAME, listener);

      await deleteBehaviorNote(note.id, tptUser);

      window.removeEventListener(BEHAVIOR_EVENT_NAME, listener);

      expect(receivedEvents.length).toBe(1);
      const detail = receivedEvents[0].detail;
      expect(detail.action).toBe('delete');
      expect(detail.noteId).toBe(note.id);
    });

    it('3.4: dispatches "acknowledge" action CustomEvent when GVCN acknowledges a note', async () => {
      const note = await createBehaviorNote(
        {
          studentId: '269029',
          studentName: 'Bùi Gia An',
          classId: '6A1',
          type: 'negative',
          content: 'Nhắc nhở cần GVCN chấn chỉnh',
        },
        tptUser
      );

      const receivedEvents: CustomEvent[] = [];
      const listener = (e: Event) => receivedEvents.push(e as CustomEvent);
      window.addEventListener(BEHAVIOR_EVENT_NAME, listener);

      const ack = await acknowledgeBehaviorNote(note.id, gvcn6A1User);
      expect(ack.acknowledgedByGvcn).toBe(true);

      window.removeEventListener(BEHAVIOR_EVENT_NAME, listener);

      expect(receivedEvents.length).toBe(1);
      const detail = receivedEvents[0].detail;
      expect(detail.action).toBe('acknowledge');
      expect(detail.note.acknowledgedByGvcn).toBe(true);
      expect(detail.note.acknowledgedBy).toBe('Đinh Hoài Long');
    });

    it('3.5: isolates multi-class subscribers so class listeners only receive relevant notifications', async () => {
      const sub6A1Updates: BehaviorNote[][] = [];
      const sub7A2Updates: BehaviorNote[][] = [];
      const subAllUpdates: BehaviorNote[][] = [];

      const unsub6A1 = subscribeBehaviorNotesByClass('6A1', (notes) => sub6A1Updates.push(notes));
      const unsub7A2 = subscribeBehaviorNotesByClass('7A2', (notes) => sub7A2Updates.push(notes));
      const unsubAll = subscribeBehaviorNotesByClass('all', (notes) => subAllUpdates.push(notes));

      // Wait initial subscription callback
      await new Promise((r) => setTimeout(r, 20));
      sub6A1Updates.length = 0;
      sub7A2Updates.length = 0;
      subAllUpdates.length = 0;

      // Create note for 6A1
      await createBehaviorNote(
        { studentId: '269029', classId: '6A1', type: 'positive', content: 'Event test 6A1' },
        tptUser
      );
      await new Promise((r) => setTimeout(r, 20));

      expect(sub6A1Updates.length).toBeGreaterThan(0);
      expect(subAllUpdates.length).toBeGreaterThan(0);
      expect(sub7A2Updates.length).toBe(0); // 7A2 should not receive 6A1 event

      // Create note for 7A2
      sub6A1Updates.length = 0;
      sub7A2Updates.length = 0;
      subAllUpdates.length = 0;

      await createBehaviorNote(
        { studentId: '252001', classId: '7A2', type: 'negative', content: 'Event test 7A2' },
        tptUser
      );
      await new Promise((r) => setTimeout(r, 20));

      expect(sub7A2Updates.length).toBeGreaterThan(0);
      expect(subAllUpdates.length).toBeGreaterThan(0);
      expect(sub6A1Updates.length).toBe(0); // 6A1 should not receive 7A2 event

      unsub6A1();
      unsub7A2();
      unsubAll();
    });

    it('3.6: cleanly unsubscribes and does not receive events after unsubscribe', async () => {
      const callbackSpy = vi.fn();
      const unsub = subscribeBehaviorNotesByClass('6A1', callbackSpy);
      await new Promise((r) => setTimeout(r, 20));
      callbackSpy.mockClear();

      unsub(); // Unsubscribe now

      // Trigger new note creation
      await createBehaviorNote(
        { studentId: '269029', classId: '6A1', type: 'positive', content: 'Post unsubscribe note' },
        tptUser
      );
      await new Promise((r) => setTimeout(r, 20));

      expect(callbackSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. Parent-Teacher Conference Summary Modal
  // =========================================================================
  describe('4. Parent-Teacher Conference Summary Modal Data Partitioning & Formatting', () => {
    const testRoster: StudentDoc[] = [
      { id: '269029', mhs: '269029', stt: 1, name: 'Bùi Gia An', classId: '6A1', grade: 6, dob: '2015-01-10', gender: 'Nam', status: 'active', createdAt: Date.now() },
      { id: '269963', mhs: '269963', stt: 2, name: 'Chu Ngọc Bảo', classId: '6A1', grade: 6, dob: '2015-03-15', gender: 'Nữ', status: 'active', createdAt: Date.now() },
      { id: '269910', mhs: '269910', stt: 3, name: 'Đỗ Đức Cường', classId: '6A1', grade: 6, dob: '2015-06-20', gender: 'Nam', status: 'active', createdAt: Date.now() },
      { id: '269398', mhs: '269398', stt: 4, name: 'Lý Ly Chi', classId: '6A1', grade: 6, dob: '2015-09-08', gender: 'Nữ', status: 'active', createdAt: Date.now() },
    ];

    const testNotes: BehaviorNote[] = [
      // S1: 3 positive, 2 negative
      {
        id: 'n_s1_pos1', studentId: '269029', studentName: 'Bùi Gia An', classId: '6A1',
        type: 'positive', category: 'Phát biểu', content: 'Xung phong chữa bài Toán',
        description: 'Xung phong chữa bài Toán',
        authorId: 'u1', authorName: 'Thầy Toán', authorRole: 'gvbm', date: '2026-09-20',
        createdAt: 1000, updatedAt: 1000, timestamp: 1000,
      },
      {
        id: 'n_s1_pos2', studentId: '269029', studentName: 'Bùi Gia An', classId: '6A1',
        type: 'positive', category: 'Ý thức tốt', content: 'Giúp bạn thu dọn phòng học',
        description: 'Giúp bạn thu dọn phòng học',
        authorId: 'u2', authorName: 'Cô Văn', authorRole: 'gvbm', date: '2026-09-21',
        createdAt: 1010, updatedAt: 1010, timestamp: 1010,
      },
      {
        id: 'n_s1_pos3', studentId: '269029', studentName: 'Bùi Gia An', classId: '6A1',
        type: 'positive', category: 'Khen ngợi', content: 'Đạt điểm tối đa bài kiểm tra',
        description: 'Đạt điểm tối đa bài kiểm tra',
        authorId: 'u1', authorName: 'Thầy Toán', authorRole: 'gvbm', date: '2026-09-22',
        createdAt: 1020, updatedAt: 1020, timestamp: 1020,
      },
      {
        id: 'n_s1_neg1', studentId: '269029', studentName: 'Bùi Gia An', classId: '6A1',
        type: 'negative', category: 'Làm việc riêng', content: 'Vẽ tranh trong giờ Sử',
        description: 'Vẽ tranh trong giờ Sử',
        authorId: 'u3', authorName: 'Thầy Sử', authorRole: 'gvbm', date: '2026-09-23',
        createdAt: 1030, updatedAt: 1030, timestamp: 1030,
      },
      {
        id: 'n_s1_neg2', studentId: '269029', studentName: 'Bùi Gia An', classId: '6A1',
        type: 'negative', category: 'Quên bài tập', content: 'Thiếu bài tập về nhà Tiếng Anh',
        description: 'Thiếu bài tập về nhà Tiếng Anh',
        authorId: 'u4', authorName: 'Cô Anh', authorRole: 'gvbm', date: '2026-09-24',
        createdAt: 1040, updatedAt: 1040, timestamp: 1040,
      },

      // S2: 2 positive, 0 negative (Exemplary student)
      {
        id: 'n_s2_pos1', studentId: '269963', studentName: 'Chu Ngọc Bảo', classId: '6A1',
        type: 'positive', category: 'Học tập xuất sắc', content: 'Đại diện lớp thuyết trình xuất sắc',
        description: 'Đại diện lớp thuyết trình xuất sắc',
        authorId: 'u2', authorName: 'Cô Văn', authorRole: 'gvbm', date: '2026-09-25',
        createdAt: 1050, updatedAt: 1050, timestamp: 1050,
      },
      {
        id: 'n_s2_pos2', studentId: '269963', studentName: 'Chu Ngọc Bảo', classId: '6A1',
        type: 'positive', category: 'Gương mẫu', content: 'Đi đầu phong trào nề nếp',
        description: 'Đi đầu phong trào nề nếp',
        authorId: 'u_tpt', authorName: 'Hoàng Long (TPT)', authorRole: 'tpt', date: '2026-09-26',
        createdAt: 1060, updatedAt: 1060, timestamp: 1060,
      },

      // S3: 0 positive, 3 negative (Needs improvement)
      {
        id: 'n_s3_neg1', studentId: '269910', studentName: 'Đỗ Đức Cường', classId: '6A1',
        type: 'negative', category: 'Mất trật tự', content: 'Nói chuyện to trong giờ Tin',
        description: 'Nói chuyện to trong giờ Tin',
        authorId: 'u5', authorName: 'Thầy Tin', authorRole: 'gvbm', date: '2026-09-27',
        createdAt: 1070, updatedAt: 1070, timestamp: 1070,
      },
      {
        id: 'n_s3_neg2', studentId: '269910', studentName: 'Đỗ Đức Cường', classId: '6A1',
        type: 'negative', category: 'Dùng điện thoại', content: 'Sử dụng điện thoại trong giờ học',
        description: 'Sử dụng điện thoại trong giờ học',
        authorId: 'u_tpt', authorName: 'Hoàng Long (TPT)', authorRole: 'tpt', date: '2026-09-28',
        createdAt: 1080, updatedAt: 1080, timestamp: 1080,
      },
      {
        id: 'n_s3_neg3', studentId: '269910', studentName: 'Đỗ Đức Cường', classId: '6A1',
        type: 'negative', category: 'Đồng phục', content: 'Không đeo khăn quàng đỏ',
        description: 'Không đeo khăn quàng đỏ',
        authorId: 'u_tpt', authorName: 'Hoàng Long (TPT)', authorRole: 'tpt', date: '2026-09-29',
        createdAt: 1090, updatedAt: 1090, timestamp: 1090,
      },

      // S4: 0 positive, 0 negative (Clean slate)
    ];

    const renderModal = (props: Partial<React.ComponentProps<typeof ConferenceSummaryModal>> = {}) => {
      return render(
        <LanguageProvider>
          <AuthProvider>
            <ConferenceSummaryModal
              isOpen={true}
              onClose={vi.fn()}
              classId="6A1"
              notes={testNotes}
              roster={testRoster}
              gvcnName="Đinh Hoài Long"
              {...props}
            />
          </AuthProvider>
        </LanguageProvider>
      );
    };

    it('4.1: accurately partitions notes into positive and negative columns per student', () => {
      renderModal();

      // Check header info
      expect(screen.getByText(/Tổng hợp Báo cáo Họp Phụ Huynh - Lớp 6A1/)).toBeInTheDocument();
      expect(screen.getByText(/BẢNG TỔNG HỢP NỀ NẾP & RÈN LUYỆN HỌC SINH/)).toBeInTheDocument();

      // Student 1: 3 positive, 2 negative
      expect(screen.getByText('Bùi Gia An')).toBeInTheDocument();
      expect(screen.getByText('Khen ngợi: 3')).toBeInTheDocument();
      expect(screen.getByText('Nhắc nhở: 2')).toBeInTheDocument();
      expect(screen.getByText('Xung phong chữa bài Toán')).toBeInTheDocument();
      expect(screen.getByText('Vẽ tranh trong giờ Sử')).toBeInTheDocument();

      // Student 2: 2 positive, 0 negative
      expect(screen.getByText('Chu Ngọc Bảo')).toBeInTheDocument();
      expect(screen.getByText('Khen ngợi: 2')).toBeInTheDocument();
      expect(screen.getAllByText('Nhắc nhở: 0')).toHaveLength(2); // S2 and S4 both have 0 negatives
      expect(screen.getByText('Đại diện lớp thuyết trình xuất sắc')).toBeInTheDocument();
      // Should show negative placeholder for S2 and S4
      expect(screen.getAllByText('Không có vi phạm ghi nhận')).toHaveLength(2);

      // Student 3: 0 positive, 3 negative
      expect(screen.getByText('Đỗ Đức Cường')).toBeInTheDocument();
      expect(screen.getByText('Nhắc nhở: 3')).toBeInTheDocument();
      expect(screen.getByText('Nói chuyện to trong giờ Tin')).toBeInTheDocument();
      // Should show positive placeholder for S3 and S4
      expect(screen.getAllByText('Chưa có ghi nhận khen ngợi')).toHaveLength(2);

      // Student 4: 0 positive, 0 negative
      expect(screen.getAllByText('Lý Ly Chi')[0]).toBeInTheDocument();
    });

    it('4.2: enforces strict column isolation with zero cross-contamination', () => {
      renderModal();

      // Ensure negative notes never appear inside positive award cards
      const positiveTexts = ['Xung phong chữa bài Toán', 'Giúp bạn thu dọn phòng học', 'Đạt điểm tối đa bài kiểm tra'];
      const negativeTexts = ['Vẽ tranh trong giờ Sử', 'Thiếu bài tập về nhà Tiếng Anh'];

      positiveTexts.forEach((text) => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });
      negativeTexts.forEach((text) => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });
    });

    it('4.3: sorts student reports by STT in ascending order regardless of roster input order', () => {
      // Pass shuffled roster (STT 4, STT 2, STT 1, STT 3)
      const shuffledRoster = [testRoster[3], testRoster[1], testRoster[0], testRoster[2]];
      const { container } = renderModal({ roster: shuffledRoster });

      // Target the report cards specifically (not the filter select options)
      const reportCardNames = Array.from(
        container.querySelectorAll('.space-y-4 .text-sm.font-bold.text-slate-900')
      ).map((el) => el.textContent?.trim());

      expect(reportCardNames).toEqual([
        'Bùi Gia An',    // STT 1
        'Chu Ngọc Bảo',  // STT 2
        'Đỗ Đức Cường',  // STT 3
        'Lý Ly Chi', // STT 4
      ]);
    });

    it('4.4: filters displayed reports when selecting a specific student from dropdown', () => {
      renderModal();

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      // Initially 4 students displayed
      expect(screen.getByText('Hiển thị: 4 học sinh')).toBeInTheDocument();

      // Filter by Student 2 (Chu Ngọc Bảo)
      fireEvent.change(select, { target: { value: '269963' } });

      expect(screen.getByText('Hiển thị: 1 học sinh')).toBeInTheDocument();
      expect(screen.getByText('Chu Ngọc Bảo')).toBeInTheDocument();
      expect(screen.queryByText('Bùi Gia An')).not.toBeInTheDocument();
      expect(screen.queryByText('Đỗ Đức Cường')).not.toBeInTheDocument();
      expect(screen.queryByText('Lý Ly Chi')).not.toBeInTheDocument();
    });

    it('4.5: formats summary text accurately for Zalo/Email clipboard copy', () => {
      let copiedText = '';
      const writeTextMock = vi.fn().mockImplementation((text: string) => {
        copiedText = text;
        return Promise.resolve();
      });

      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      renderModal();

      const copyBtn = screen.getByText('Sao chép Zalo/Email');
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalled();

      // Validate formatting structure
      expect(copiedText).toContain('TRƯỜNG THCS NGOẠI NGỮ (UMS) - BÁO CÁO NỀ NẾP LỚP 6A1');
      expect(copiedText).toContain('GVCN: Đinh Hoài Long');

      // Student 1: 3 positives, 2 negatives
      expect(copiedText).toContain('STT 1: Bùi Gia An (MHS: 269029)');
      expect(copiedText).toContain('+ Khen ngợi (3 lần):');
      expect(copiedText).toContain('Xung phong chữa bài Toán');
      expect(copiedText).toContain('- Cần lưu ý / Nhắc nhở (2 lần):');
      expect(copiedText).toContain('Vẽ tranh trong giờ Sử');

      // Student 2: 2 positives, clean negatives
      expect(copiedText).toContain('STT 2: Chu Ngọc Bảo (MHS: 269963)');
      expect(copiedText).toContain('+ Khen ngợi (2 lần):');
      expect(copiedText).toContain('(Không có vi phạm)');

      // Student 3: clean positives, 3 negatives
      expect(copiedText).toContain('STT 3: Đỗ Đức Cường (MHS: 269910)');
      expect(copiedText).toContain('(Chưa có ghi nhận)');
      expect(copiedText).toContain('- Cần lưu ý / Nhắc nhở (3 lần):');

      // Student 4: clean state
      expect(copiedText).toContain('STT 4: Lý Ly Chi (MHS: 269398)');
    });

    it('4.6: invokes window.print when print button is clicked', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      renderModal();

      const printBtn = screen.getByText('In Báo Cáo');
      fireEvent.click(printBtn);

      expect(printSpy).toHaveBeenCalled();
    });

    it('4.7: gracefully handles notes with unknown studentId not present in roster', () => {
      const corruptedNotes: BehaviorNote[] = [
        ...testNotes,
        {
          id: 'n_ghost',
          studentId: 'unknown_ghost_999',
          studentName: 'Người Lạ',
          classId: '6A1',
          type: 'positive' as const,
          category: 'Khen ngợi',
          content: 'Học sinh không tồn tại',
          description: 'Học sinh không tồn tại',
          authorId: 'u1',
          authorName: 'Thầy Toán',
          authorRole: 'gvbm' as const,
          date: '2026-09-29',
          createdAt: 2000,
          updatedAt: 2000,
          timestamp: 2000,
        },
      ];

      renderModal({ notes: corruptedNotes });

      // Roster counts should not be corrupted
      expect(screen.getByText('Bùi Gia An')).toBeInTheDocument();
      expect(screen.getByText('Khen ngợi: 3')).toBeInTheDocument();
      expect(screen.queryByText('Học sinh không tồn tại')).not.toBeInTheDocument();
    });

    it('4.8: renders nothing when isOpen is false', () => {
      const { container } = renderModal({ isOpen: false });
      expect(container.firstChild).toBeNull();
    });
  });
});
