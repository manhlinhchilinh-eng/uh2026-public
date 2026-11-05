/**
 * ePortfolio GV (Firestore): tự gom minh chứng + minh chứng tự nộp.
 */

import { addDoc, collection, collectionGroup, deleteDoc, deleteField, doc, limit, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import type { SignedPeriodLite, TeacherEvidence } from '../utils/teacherPortfolio';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';

/** Tiết do GV ghi/ký (PeriodEntry.teacherId = username của GV, giới hạn tối đa `max` tiết). */
export async function fetchPeriodsByTeacher(username: string, max = 500): Promise<SignedPeriodLite[]> {
  const snap = await guardedGetDocs(
    'teacher_portfolio:periods',
    query(collectionGroup(db, 'periods'), where('teacherId', '==', username), limit(max))
  );
  return snap.docs.map((d) => {
    const p = d.data();
    return {
      dailyId: p.dailyId || d.ref.parent.parent?.id,
      subject: p.subject || '',
      lessonTopic: p.lessonTopic || '',
      isSigned: Boolean(p.isSigned),
      periodIndex: p.periodIndex,
    };
  });
}

export async function countApprovedSubstitutions(uid: string, start: string, end: string): Promise<number> {
  const snap = await guardedGetDocs(
    'teacher_portfolio:substitutions',
    query(collection(db, 'substitutions'), where('substituteUid', '==', uid), limit(200))
  );
  return snap.docs.filter((d) => d.data().status === 'approved' && d.data().date >= start && d.data().date <= end).length;
}

export async function countBehaviorNotesByAuthor(uid: string, start: string, end: string) {
  const snap = await guardedGetDocs(
    'teacher_portfolio:behavior_notes',
    query(collection(db, 'behavior_notes'), where('authorId', '==', uid), limit(300))
  );
  const inRange = snap.docs.map((d) => d.data()).filter((n) => n.date >= start && n.date <= end);
  return { positive: inRange.filter((n) => n.type === 'positive').length, negative: inRange.filter((n) => n.type === 'negative').length };
}

export async function fetchEvidence(uid: string): Promise<TeacherEvidence[]> {
  const snap = await guardedGetDocs(
    'teacher_portfolio:evidence',
    query(collection(db, 'teacher_evidence'), where('uid', '==', uid), limit(200))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeacherEvidence, 'id'>) })).sort((a, b) => b.date.localeCompare(a.date));
}

export async function createEvidence(e: Omit<TeacherEvidence, 'id' | 'uid' | 'teacherName' | 'createdAt'>, author: UserProfile): Promise<string> {
  const ref = await addDoc(collection(db, 'teacher_evidence'), {
    ...e,
    title: e.title.trim(),
    description: e.description.trim(),
    links: e.links.filter(Boolean),
    uid: author.uid,
    teacherName: author.displayName || author.username,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function setEvidenceVerified(id: string, verified: boolean, admin: UserProfile): Promise<void> {
  await updateDoc(
    doc(db, 'teacher_evidence', id),
    verified
      ? { verifiedBy: admin.uid, verifiedByName: admin.displayName || admin.username, verifiedAt: Date.now() }
      : // Xóa hẳn trường (không gán null) để GV sửa lại được theo rules
        { verifiedBy: deleteField(), verifiedByName: deleteField(), verifiedAt: deleteField() }
  );
}

export async function deleteEvidence(id: string): Promise<void> {
  await deleteDoc(doc(db, 'teacher_evidence', id));
}

/** BGH xem hồ sơ GV khác: cần username để tìm tiết đã ký. */
export async function fetchUsername(uid: string): Promise<string | null> {
  const snap = await guardedGetDoc('teacher_portfolio:username', doc(db, 'users', uid));
  return snap.exists() ? (snap.data().username as string) : null;
}
