/**
 * UMS SmartConnect - Dạy thay (Firestore)
 */

import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import type { ScheduleSlot } from '../types/schedule';
import type { Substitution, SubstitutionPlan, SubstitutionStatus } from '../types/substitution';

const COL = 'substitutions';
const toSub = (id: string, d: Record<string, any>): Substitution => ({ id, ...(d as Omit<Substitution, 'id'>) });

export async function createSubstitutions(leaveRequestId: string, plans: SubstitutionPlan[], absent: UserProfile): Promise<void> {
  if (plans.length === 0) return;
  const batch = writeBatch(db);
  for (const p of plans) {
    batch.set(doc(collection(db, COL)), {
      ...p,
      leaveRequestId,
      absentUid: absent.uid,
      absentName: absent.displayName || absent.username,
      status: 'planned',
      createdAt: Date.now(),
    });
  }
  await batch.commit();
}

export async function fetchSubstitutionsForLeave(leaveRequestId: string): Promise<Substitution[]> {
  const snap = await getDocs(query(collection(db, COL), where('leaveRequestId', '==', leaveRequestId)));
  return snap.docs
    .map((d) => toSub(d.id, d.data()))
    .sort((a, b) => a.date.localeCompare(b.date) || a.periodIndex - b.periodIndex || a.classId.localeCompare(b.classId));
}

/** Đổi trạng thái mọi kế hoạch dạy thay của 1 đơn (BGH duyệt/từ chối, hoặc GV hủy đơn). */
export async function setSubstitutionStatus(leaveRequestId: string, status: Exclude<SubstitutionStatus, 'planned'>): Promise<void> {
  const subs = await fetchSubstitutionsForLeave(leaveRequestId);
  if (subs.length === 0) return;
  const batch = writeBatch(db);
  for (const s of subs) if (s.status !== status) batch.update(doc(db, COL, s.id), { status });
  await batch.commit();
}

export async function fetchMySubstituteDuties(uid: string): Promise<Substitution[]> {
  const snap = await getDocs(query(collection(db, COL), where('substituteUid', '==', uid)));
  return snap.docs.map((d) => toSub(d.id, d.data())).sort((a, b) => a.date.localeCompare(b.date) || a.periodIndex - b.periodIndex);
}

export async function fetchSubstitutionsForClassDate(classId: string, date: string): Promise<Substitution[]> {
  const snap = await getDocs(query(collection(db, COL), where('classId', '==', classId), where('date', '==', date)));
  return snap.docs.map((d) => toSub(d.id, d.data()));
}

/** Toàn bộ TKB các lớp (để gợi ý tiết của GV xin nghỉ). Chỉ lấy doc dạng mã lớp (vd. '6A1'). */
export async function fetchAllClassSchedules(): Promise<Array<{ classId: string; slots: ScheduleSlot[] }>> {
  const snap = await getDocs(collection(db, 'schedules'));
  return snap.docs
    .filter((d) => /^\d[A-Z]\d+$/.test(d.id))
    .map((d) => ({ classId: d.id, slots: ((d.data().slots as ScheduleSlot[]) || []) }));
}

// ---------------------------------------------------------------------------
// Danh bạ nhân sự (uid + họ tên) — GV đọc được để chọn người dạy thay; BGH đồng bộ từ /users.
// ---------------------------------------------------------------------------
export type StaffEntry = { uid: string; displayName: string; roles?: import('../types/auth').UserRole[]; assignedClassId?: string };

export async function fetchStaffDirectoryPublic(): Promise<StaffEntry[]> {
  const snap = await getDoc(doc(db, 'directory', 'staff'));
  return snap.exists() ? ((snap.data().staff as StaffEntry[]) || []) : [];
}

export async function syncStaffDirectory(staff: StaffEntry[]): Promise<void> {
  const sorted = [...staff].sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
  await setDoc(doc(db, 'directory', 'staff'), { staff: sorted, updatedAt: Date.now() });
}
