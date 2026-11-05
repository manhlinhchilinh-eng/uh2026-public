/**
 * UMS SmartConnect - Dữ liệu cho phụ huynh / học sinh.
 * Chỉ đọc đúng phần Firestore rules cho phép: hồ sơ HS được liên kết và ghi chú hành vi của HS đó.
 */

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface LinkedStudent {
  docId: string;
  mhs: string;
  fullName: string;
  className: string;
  grade?: number;
}

export interface FamilyBehaviorNote {
  id: string;
  type: 'positive' | 'negative';
  content: string;
  category?: string;
  authorName?: string;
  subject?: string;
  date: string;
  createdAt: number;
}

export async function fetchLinkedStudents(studentDocIds: string[] = []): Promise<LinkedStudent[]> {
  const snaps = await Promise.all(studentDocIds.map((id) => getDoc(doc(db, 'students', id))));
  return snaps
    .filter((s) => s.exists())
    .map((s) => {
      const d = s.data() as Record<string, any>;
      return { docId: s.id, mhs: String(d.mhs), fullName: d.fullName, className: d.className, grade: d.grade };
    });
}

/** Ghi chú hành vi mới nhất của 1 HS (truy vấn PHẢI lọc theo studentId — rules chặn truy vấn rộng). */
export async function fetchBehaviorNotesForStudent(mhs: string, max = 10): Promise<FamilyBehaviorNote[]> {
  const snap = await getDocs(query(collection(db, 'behavior_notes'), where('studentId', '==', mhs)));
  return sortRecent(
    snap.docs.map((d) => {
      const n = d.data() as Record<string, any>;
      return {
        id: d.id,
        type: n.type,
        content: n.content || n.description || '',
        category: n.category,
        authorName: n.authorName,
        subject: n.subject,
        date: n.date,
        createdAt: n.createdAt || n.timestamp || 0,
      };
    })
  ).slice(0, max);
}

export function sortRecent<T extends { createdAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

export function summarizeBehavior(notes: Pick<FamilyBehaviorNote, 'type'>[]): { positive: number; negative: number } {
  return {
    positive: notes.filter((n) => n.type === 'positive').length,
    negative: notes.filter((n) => n.type === 'negative').length,
  };
}
