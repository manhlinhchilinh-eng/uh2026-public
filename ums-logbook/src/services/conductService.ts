/**
 * UMS SmartConnect - Dữ liệu cho bảng tổng hợp nề nếp/chuyên cần theo HS (nhận xét học bạ).
 * Chỉ đọc: students, behavior_notes, student_daily của 1 lớp.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ConductAttendance, ConductNote } from '../utils/conductSummary';

export async function fetchConductData(classId: string, from: string, to: string) {
  const [studentsSnap, notesSnap, dailySnap] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('className', '==', classId))),
    getDocs(query(collection(db, 'behavior_notes'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'student_daily'), where('classId', '==', classId), where('date', '>=', from), where('date', '<=', to))),
  ]);
  const students = studentsSnap.docs
    .map((d) => d.data() as { mhs?: string; fullName?: string; name?: string; stt?: number; status?: string; active?: boolean })
    .filter((s) => s.mhs && s.status !== 'transferred' && s.active !== false)
    .map((s) => ({ mhs: String(s.mhs), fullName: String(s.fullName || s.name || ''), stt: Number(s.stt) || undefined }));
  const notes: ConductNote[] = notesSnap.docs.map((d) => {
    const x = d.data();
    return { studentId: String(x.studentId || ''), type: x.type, category: String(x.category || ''), content: String(x.content || ''), date: String(x.date || '') };
  });
  const attendance: ConductAttendance[] = dailySnap.docs.map((d) => {
    const x = d.data();
    return { mhs: String(x.mhs || ''), morning: x.morning ?? null, afternoon: x.afternoon ?? null };
  });
  return { students, notes, attendance };
}
