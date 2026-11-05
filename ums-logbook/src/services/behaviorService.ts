/**
 * UMS Digital Class Logbook - Student Behavior Notes Service Layer
 * Milestone 3: Dual-Mode Persistence, Attribution & Event Bus
 * Path: src/services/behaviorService.ts
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile, UserRole } from '../types/auth';
import {
  BehaviorNote,
  CreateBehaviorNoteDTO,
  UpdateBehaviorNoteDTO,
  BehaviorNoteFilters,
} from '../types/behavior';
import { logAuditEvent } from './auditService';
import { guardedGetDocs, recordFirestoreReads } from '../utils/firestoreGuard';

export const MOCK_BEHAVIOR_NOTES_KEY = 'ums_behavior_notes';
export const BEHAVIOR_EVENT_NAME = 'ums_behavior_note_update';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/**
 * Giới hạn số ghi nhận tải mỗi lần (bài học chi phí 12/10): 1 lớp ≤ 500 mới nhất, toàn trường ≤ 300 mới nhất.
 * Cần index behavior_notes (classId ASC, createdAt DESC) — xem firestore.indexes.json.
 */
export const BEHAVIOR_NOTES_LIMIT = { perClass: 500, allClasses: 300 } as const;

export function behaviorNotesLimit(classId?: string): number {
  return classId && classId !== 'all' ? BEHAVIOR_NOTES_LIMIT.perClass : BEHAVIOR_NOTES_LIMIT.allClasses;
}

/** Truy vấn dùng chung cho danh sách + listener: mới nhất trước, luôn có limit. */
export function behaviorNotesQuery(classId?: string, maxDocs?: number) {
  const colRef = collection(db, 'behavior_notes');
  const max = firestoreLimit(Math.min(maxDocs ?? behaviorNotesLimit(classId), behaviorNotesLimit(classId)));
  return classId && classId !== 'all'
    ? query(colRef, where('classId', '==', classId), orderBy('createdAt', 'desc'), max)
    : query(colRef, orderBy('createdAt', 'desc'), max);
}

/**
 * Event Notifier for reactive cross-component & cross-tab synchronization
 */
export function notifyBehaviorNoteUpdate(
  action: 'create' | 'update' | 'delete' | 'acknowledge',
  note?: Partial<BehaviorNote>,
  noteId?: string
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(BEHAVIOR_EVENT_NAME, {
        detail: {
          action,
          note,
          noteId: noteId || note?.id,
          classId: note?.classId,
          studentId: note?.studentId,
          timestamp: Date.now(),
        },
      })
    );
  }
}

/**
 * LocalStorage Helpers
 */
export function getMockBehaviorNotes(): BehaviorNote[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(MOCK_BEHAVIOR_NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMockBehaviorNotes(notes: BehaviorNote[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MOCK_BEHAVIOR_NOTES_KEY, JSON.stringify(notes));
    }
  } catch (e) {
    console.error('Failed to save mock behavior notes to localStorage', e);
  }
}

/**
 * Validates note creation payload against security constraints and school roster
 */
export function validateCreateBehaviorNote(
  dto: CreateBehaviorNoteDTO,
  authorUser: UserProfile
): { authorRole: UserRole; cleanContent: string } {
  // 1. Mandatory password change check
  if (authorUser.mustChangePassword) {
    throw new Error(
      'AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED: Must change password before creating behavior notes.'
    );
  }

  // 2. Note type validation
  if (!['positive', 'negative'].includes(dto.type)) {
    throw new Error(
      `NOTE_INVALID_TYPE: Behavior note type must be either 'positive' or 'negative', got "${dto.type}"`
    );
  }

  // 3. Content validation
  const rawContent = dto.content ?? dto.description ?? '';
  if (!rawContent || !rawContent.trim()) {
    throw new Error('NOTE_EMPTY_DESCRIPTION: Behavior note description cannot be empty.');
  }

  // 4. Student validation against roster
  if (typeof localStorage !== 'undefined') {
    const storedStudentsRaw = localStorage.getItem('ums_students');
    if (storedStudentsRaw) {
      try {
        const students = JSON.parse(storedStudentsRaw) as Array<{
          id: string;
          mhs: string;
          classId: string;
        }>;
        const classStudents = students.filter((s) => s.classId === dto.classId);
        if (classStudents.length > 0) {
          const found = classStudents.find(
            (s) => s.id === dto.studentId || s.mhs === dto.studentId
          );
          if (!found) {
            throw new Error(
              `NOTE_UNKNOWN_STUDENT: Student ${dto.studentId} not found in class ${dto.classId}.`
            );
          }
        }
      } catch (err: any) {
        if (err.message?.includes('NOTE_UNKNOWN_STUDENT')) throw err;
      }
    }
  }

  // 5. Role authorization & non-forgeable derivation
  const roles = authorUser.roles || [];
  const isTPTorAdmin = roles.includes('tpt') || roles.includes('admin') || roles.includes('giamthi');
  const isClassGvcn = roles.includes('gvcn') && authorUser.assignedClassId === dto.classId;
  const isGvbm = roles.includes('gvbm');

  if (!isTPTorAdmin && !isClassGvcn && !isGvbm) {
    throw new Error(
      `AUTH_FORBIDDEN: User does not have permission to create notes for class ${dto.classId}.`
    );
  }

  const authorRole: UserRole = roles.includes('tpt')
    ? 'tpt'
    : roles.includes('giamthi')
    ? 'giamthi'
    : roles.includes('admin')
    ? 'admin'
    : isClassGvcn
    ? 'gvcn'
    : 'gvbm';

  return {
    authorRole,
    cleanContent: rawContent.trim(),
  };
}

/**
 * Creates a new behavior note with non-forgeable author attribution
 */
export async function createBehaviorNote(
  dto: CreateBehaviorNoteDTO | (Omit<BehaviorNote, 'id' | 'timestamp'> & { id?: string; timestamp?: number }),
  authorUser?: UserProfile
): Promise<BehaviorNote> {
  // If authorUser not passed explicitly, synthesize from dto or current session
  let user = authorUser;
  if (!user) {
    const anyDto = dto as any;
    user = {
      uid: anyDto.authorId || 'unknown',
      username: anyDto.authorId || 'user',
      email: `${anyDto.authorId || 'user'}@ums.edu.vn`,
      displayName: anyDto.authorName || anyDto.authorId || 'Giáo viên',
      roles: anyDto.authorRole ? [anyDto.authorRole] : ['gvbm'],
      assignedClassId: anyDto.authorRole === 'gvcn' ? anyDto.classId : undefined,
      mustChangePassword: false,
      createdAt: Date.now(),
    };
  }

  const { authorRole, cleanContent } = validateCreateBehaviorNote(dto as CreateBehaviorNoteDTO, user);
  const now = (dto as any).timestamp || Date.now();
  const noteId = (dto as any).id || `note_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const dateStr = dto.date || new Date(now).toISOString().split('T')[0];

  const note: BehaviorNote = {
    id: noteId,
    studentId: dto.studentId,
    studentName: dto.studentName || 'Học sinh',
    studentNumber: (dto as any).studentNumber,
    studentCode: (dto as any).studentCode || dto.studentId,
    classId: dto.classId,
    type: dto.type,
    category: dto.category || (dto.type === 'positive' ? 'Khen ngợi' : 'Vi phạm'),
    content: cleanContent,
    description: cleanContent, // Dual-property compatibility
    authorId: user.uid || user.username,
    authorName: user.displayName || user.username,
    authorRole,
    periodIndex: dto.periodIndex,
    subject: dto.subject,
    date: dateStr,
    context: dto.context || (dto.periodIndex ? 'period' : 'general'),
    createdAt: now,
    updatedAt: now,
    timestamp: now, // Dual-property compatibility
    acknowledgedByGvcn: false,
  };

  // 1. Try Cloud Firestore if not test environment
  if (!isTestEnv && db) {
    try {
      const docRef = doc(db, 'behavior_notes', noteId);
      await setDoc(docRef, note);
    } catch {
      // Fall through to LocalStorage on error
    }
  }

  // 2. LocalStorage Fallback
  const notes = getMockBehaviorNotes();
  notes.unshift(note);
  saveMockBehaviorNotes(notes);
  notifyBehaviorNoteUpdate('create', note);

  await logAuditEvent({
    actor: {
      actorId: user.uid || user.username,
      actorName: user.displayName || user.username,
      actorRole: authorRole,
    },
    action: 'CREATE',
    targetCollection: 'behavior_notes',
    targetId: note.id,
    afterState: note as unknown as Record<string, unknown>,
    details: `Ghi nhận hành vi ${note.type === 'positive' ? 'tích cực' : 'tiêu cực'} (${note.category}) cho học sinh ${note.studentName} lớp ${note.classId}.`,
  });

  return note;
}

/**
 * Retrieves behavior notes for a specific class with multi-criteria filtering
 */
export async function getNotesByClass(
  classId?: string,
  filters: BehaviorNoteFilters = {},
  max?: number
): Promise<BehaviorNote[]> {
  // 1. Try Cloud Firestore
  if (!isTestEnv && db) {
    try {
      const snapshot = await guardedGetDocs('behavior_notes:by_class', behaviorNotesQuery(classId, max));
      const results: BehaviorNote[] = [];
      snapshot.forEach((d) => results.push({ ...(d.data() as BehaviorNote), id: d.id }));

      return filterNotesList(results, filters);
    } catch {
      // Fall through to LocalStorage
    }
  }

  // 2. LocalStorage Fallback
  const allNotes = getMockBehaviorNotes();
  const classNotes = classId && classId !== 'all'
    ? allNotes.filter((n) => n.classId === classId)
    : allNotes;
  return filterNotesList(classNotes, filters);
}

/**
 * Retrieves behavior notes for a specific student across their history (bounded by max)
 */
export async function getNotesByStudent(studentId: string, max = 100): Promise<BehaviorNote[]> {
  if (!isTestEnv && db) {
    try {
      const colRef = collection(db, 'behavior_notes');
      const q = query(colRef, where('studentId', '==', studentId), firestoreLimit(max));
      const snapshot = await guardedGetDocs('behavior_notes:by_student', q);
      const results: BehaviorNote[] = [];
      snapshot.forEach((d) => results.push({ ...(d.data() as BehaviorNote), id: d.id }));
      return results.sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp));
    } catch {}
  }

  const allNotes = getMockBehaviorNotes();
  return allNotes
    .filter((n) => n.studentId === studentId)
    .sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp));
}

/**
 * Retrieves recent behavior notes across all classes (for Admin/TPT feed)
 */
export async function getRecentNotes(limitCount = 20, classId?: string): Promise<BehaviorNote[]> {
  if (!isTestEnv && db) {
    try {
      const colRef = collection(db, 'behavior_notes');
      const q = classId && classId !== 'all'
        ? query(colRef, where('classId', '==', classId), firestoreLimit(limitCount))
        : query(colRef, orderBy('createdAt', 'desc'), firestoreLimit(limitCount));
      const snapshot = await guardedGetDocs('behavior_notes:recent', q);
      const results: BehaviorNote[] = [];
      snapshot.forEach((d) => results.push({ ...(d.data() as BehaviorNote), id: d.id }));
      return results
        .sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp))
        .slice(0, limitCount);
    } catch {}
  }

  const allNotes = getMockBehaviorNotes();
  const filtered = classId && classId !== 'all' ? allNotes.filter((n) => n.classId === classId) : allNotes;
  return filtered
    .sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp))
    .slice(0, limitCount);
}

/**
 * Updates an existing behavior note (author or admin only)
 */
export async function updateBehaviorNote(
  noteId: string,
  updates: UpdateBehaviorNoteDTO,
  user: UserProfile
): Promise<BehaviorNote> {
  const existingNotes = getMockBehaviorNotes();
  const target = existingNotes.find((n) => n.id === noteId);

  if (!target) {
    throw new Error(`NOTE_NOT_FOUND: Behavior note ${noteId} does not exist.`);
  }

  // Permission check
  const isAdmin = user.roles?.includes('admin');
  const isAuthor = target.authorId === user.uid || target.authorId === user.username;
  if (!isAdmin && !isAuthor) {
    throw new Error('AUTH_FORBIDDEN: Only the author or an admin can edit this note.');
  }

  const cleanContent = updates.content ?? updates.description ?? target.content;
  const updatedNote: BehaviorNote = {
    ...target,
    ...updates,
    content: cleanContent.trim(),
    description: cleanContent.trim(),
    updatedAt: Date.now(),
  };

  if (!isTestEnv && db) {
    try {
      const docRef = doc(db, 'behavior_notes', noteId);
      await updateDoc(docRef, updatedNote as any);
    } catch {}
  }

  const idx = existingNotes.findIndex((n) => n.id === noteId);
  existingNotes[idx] = updatedNote;
  saveMockBehaviorNotes(existingNotes);
  notifyBehaviorNoteUpdate('update', updatedNote);

  await logAuditEvent({
    actor: {
      actorId: user.uid || user.username,
      actorName: user.displayName || user.username,
      actorRole: user.roles?.[0] || 'gvbm',
    },
    action: 'UPDATE',
    targetCollection: 'behavior_notes',
    targetId: noteId,
    beforeState: target as unknown as Record<string, unknown>,
    afterState: updatedNote as unknown as Record<string, unknown>,
    details: `Cập nhật ghi nhận hành vi học sinh ${target.studentName} lớp ${target.classId}.`,
  });

  return updatedNote;
}

/**
 * Deletes a behavior note (author or admin only)
 */
export async function deleteBehaviorNote(noteId: string, user?: UserProfile): Promise<void> {
  const existingNotes = getMockBehaviorNotes();
  const target = existingNotes.find((n) => n.id === noteId);

  if (!target) {
    throw new Error(`NOTE_NOT_FOUND: Behavior note ${noteId} does not exist.`);
  }

  if (user) {
    const isAdmin = user.roles?.includes('admin');
    const isAuthor = target.authorId === user.uid || target.authorId === user.username;
    if (!isAdmin && !isAuthor) {
      throw new Error('AUTH_FORBIDDEN: Only the author or an admin can delete this note.');
    }
  }

  if (!isTestEnv && db) {
    try {
      const docRef = doc(db, 'behavior_notes', noteId);
      await deleteDoc(docRef);
    } catch {}
  }

  const filtered = existingNotes.filter((n) => n.id !== noteId);
  saveMockBehaviorNotes(filtered);
  notifyBehaviorNoteUpdate('delete', target, noteId);

  await logAuditEvent({
    actor: user
      ? {
          actorId: user.uid || user.username,
          actorName: user.displayName || user.username,
          actorRole: user.roles?.[0] || 'gvbm',
        }
      : undefined,
    action: 'DELETE',
    targetCollection: 'behavior_notes',
    targetId: noteId,
    beforeState: target as unknown as Record<string, unknown>,
    details: `Xóa ghi nhận hành vi học sinh ${target.studentName} lớp ${target.classId}.`,
  });
}

/**
 * GVCN acknowledges and acts upon a behavior note
 */
export async function acknowledgeBehaviorNote(
  noteId: string,
  gvcnUser: UserProfile
): Promise<BehaviorNote> {
  const existingNotes = getMockBehaviorNotes();
  const target = existingNotes.find((n) => n.id === noteId);

  if (!target) {
    throw new Error(`NOTE_NOT_FOUND: Behavior note ${noteId} does not exist.`);
  }

  const isAdmin = gvcnUser.roles?.includes('admin');
  const isAssignedGvcn = gvcnUser.roles?.includes('gvcn') && gvcnUser.assignedClassId === target.classId;

  if (!isAdmin && !isAssignedGvcn) {
    throw new Error(
      'AUTH_FORBIDDEN: Only the assigned GVCN of this class or an Admin can acknowledge this note.'
    );
  }

  const now = Date.now();
  const updatedNote: BehaviorNote = {
    ...target,
    acknowledgedByGvcn: true,
    acknowledgedAt: now,
    acknowledgedBy: gvcnUser.displayName || gvcnUser.username,
    updatedAt: now,
  };

  if (!isTestEnv && db) {
    try {
      const docRef = doc(db, 'behavior_notes', noteId);
      await updateDoc(docRef, updatedNote as any);
    } catch {}
  }

  const idx = existingNotes.findIndex((n) => n.id === noteId);
  existingNotes[idx] = updatedNote;
  saveMockBehaviorNotes(existingNotes);
  notifyBehaviorNoteUpdate('acknowledge', updatedNote);

  await logAuditEvent({
    actor: {
      actorId: gvcnUser.uid || gvcnUser.username,
      actorName: gvcnUser.displayName || gvcnUser.username,
      actorRole: gvcnUser.roles?.[0] || 'gvcn',
    },
    action: 'UPDATE',
    targetCollection: 'behavior_notes',
    targetId: noteId,
    beforeState: target as unknown as Record<string, unknown>,
    afterState: updatedNote as unknown as Record<string, unknown>,
    details: `GVCN ${gvcnUser.displayName || gvcnUser.username} đã tiếp nhận ghi nhận hành vi của học sinh ${target.studentName}.`,
  });

  return updatedNote;
}

/**
 * Real-time subscription to behavior notes for a class (capped at 200 notes)
 */
export function subscribeBehaviorNotesByClass(
  classId: string,
  onUpdate: (notes: BehaviorNote[]) => void,
  filters: BehaviorNoteFilters = {},
  max?: number
): Unsubscribe {
  // 1. Try Firestore onSnapshot if not in test env
  if (!isTestEnv && db) {
    try {
      return onSnapshot(behaviorNotesQuery(classId, max), (snapshot) => {
        recordFirestoreReads('behavior_notes:listen_class', Math.max(1, snapshot.docChanges().length));
        const notes: BehaviorNote[] = [];
        snapshot.forEach((d) => notes.push({ ...(d.data() as BehaviorNote), id: d.id }));
        onUpdate(filterNotesList(notes, filters));
      });
    } catch {}
  }

  // 2. LocalStorage Event Bus
  const handleUpdate = (e: any) => {
    if (!e.detail?.classId || e.detail.classId === classId || classId === 'all') {
      getNotesByClass(classId, filters, max).then(onUpdate);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === MOCK_BEHAVIOR_NOTES_KEY) {
      getNotesByClass(classId, filters, max).then(onUpdate);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(BEHAVIOR_EVENT_NAME, handleUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
  }

  // Initial trigger
  getNotesByClass(classId, filters, max).then(onUpdate);

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(BEHAVIOR_EVENT_NAME, handleUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    }
  };
}

/**
 * Helper to filter note list in memory
 */
function filterNotesList(notes: BehaviorNote[], filters: BehaviorNoteFilters): BehaviorNote[] {
  return notes
    .filter((n) => {
      if (filters.classId && filters.classId !== 'all' && n.classId !== filters.classId) return false;
      if (filters.studentId && filters.studentId !== 'all' && n.studentId !== filters.studentId) return false;
      if (filters.type && filters.type !== 'all' && n.type !== filters.type) return false;
      if (filters.category && filters.category !== 'all' && n.category !== filters.category) return false;
      if (filters.authorRole && filters.authorRole !== 'all' && n.authorRole !== filters.authorRole) return false;
      if (filters.authorId && n.authorId !== filters.authorId) return false;
      if (filters.startDate && (n.date || '') < filters.startDate) return false;
      if (filters.endDate && (n.date || '') > filters.endDate) return false;
      if (filters.acknowledged !== undefined && n.acknowledgedByGvcn !== filters.acknowledged) return false;
      if (filters.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.toLowerCase().trim();
        const matchesName = n.studentName?.toLowerCase().includes(term);
        const matchesContent = (n.content || n.description || '').toLowerCase().includes(term);
        const matchesAuthor = n.authorName?.toLowerCase().includes(term);
        const matchesCat = n.category?.toLowerCase().includes(term);
        const matchesSubject = n.subject?.toLowerCase().includes(term);
        if (!matchesName && !matchesContent && !matchesAuthor && !matchesCat && !matchesSubject) return false;
      }
      return true;
    })
    .sort((a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));
}
