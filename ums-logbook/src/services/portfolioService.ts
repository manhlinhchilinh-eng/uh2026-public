/**
 * UMS SmartConnect - ePortfolio học sinh (Firestore)
 */

import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile, UserRole } from '../types/auth';
import type { NewPortfolioInput, PortfolioAiResult, PortfolioItem } from '../types/portfolio';

const COL = 'portfolio_items';
const toItem = (id: string, d: Record<string, any>): PortfolioItem => ({ id, ...(d as Omit<PortfolioItem, 'id'>) });

export async function fetchPortfolioForStudent(mhs: string): Promise<PortfolioItem[]> {
  const snap = await getDocs(query(collection(db, COL), where('mhs', '==', mhs)));
  return snap.docs.map((d) => toItem(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

/** GV: hàng chờ duyệt (GVCN: lớp mình; BGH/GVBM: toàn trường). */
export async function fetchPendingPortfolio(classId?: string): Promise<PortfolioItem[]> {
  const q = classId
    ? query(collection(db, COL), where('status', '==', 'submitted'), where('classId', '==', classId))
    : query(collection(db, COL), where('status', '==', 'submitted'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toItem(d.id, d.data())).sort((a, b) => a.createdAt - b.createdAt);
}

export async function createPortfolioItem(p: {
  input: NewPortfolioInput;
  ai: PortfolioAiResult | null;
  student: { mhs: string; docId: string; name: string; classId: string };
  author: UserProfile;
  authorRole: UserRole;
}): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collection(db, COL), {
    mhs: p.student.mhs,
    studentDocId: p.student.docId,
    studentName: p.student.name,
    classId: p.student.classId,
    title: p.input.title.trim(),
    type: p.input.type,
    category: p.input.category,
    content: p.input.content.trim(),
    reflection: p.input.reflection.trim(),
    links: p.input.links.filter(Boolean),
    status: 'submitted',
    createdByUid: p.author.uid,
    createdByRole: p.authorRole,
    ai: p.ai,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

/** HS sửa lại minh chứng bị trả lại → nộp lại. */
export async function resubmitPortfolioItem(id: string, input: NewPortfolioInput, ai: PortfolioAiResult | null): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    title: input.title.trim(),
    type: input.type,
    category: input.category,
    content: input.content.trim(),
    reflection: input.reflection.trim(),
    links: input.links.filter(Boolean),
    ai,
    status: 'submitted',
    updatedAt: Date.now(),
  });
}

export async function reviewPortfolioItem(id: string, approve: boolean, comment: string, teacherScore: number | null, reviewer: UserProfile): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: approve ? 'approved' : 'returned',
    teacherComment: comment.trim(),
    teacherScore,
    reviewerUid: reviewer.uid,
    reviewerName: reviewer.displayName || reviewer.username,
    reviewedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function deletePortfolioItem(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
