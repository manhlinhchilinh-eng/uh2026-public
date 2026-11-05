/**
 * UMS SmartConnect - Danh sách cán bộ – giáo viên (/staff_members). CHỈ BGH đọc/ghi (có thể chứa SĐT).
 */

import { collection, doc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { StaffMember } from '../utils/staffDirectory';

const COL = 'staff_members';

export async function fetchStaffMembers(): Promise<StaffMember[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ ...(d.data() as StaffMember), id: d.id })).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
}

/** Thêm nhiều người (chỉ họ tên) trong 1 lần. */
export async function addStaffMembers(names: string[], by: string): Promise<number> {
  const now = Date.now();
  for (let i = 0; i < names.length; i += 400) {
    const batch = writeBatch(db);
    for (const fullName of names.slice(i, i + 400)) {
      const ref = doc(collection(db, COL));
      const m: StaffMember = { id: ref.id, fullName, title: '', active: true, createdAt: now, updatedAt: now, updatedBy: by };
      batch.set(ref, m);
    }
    await batch.commit();
  }
  return names.length;
}

export async function updateStaffMember(id: string, patch: Partial<Omit<StaffMember, 'id' | 'createdAt'>>, by: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...patch, updatedAt: Date.now(), updatedBy: by });
}

export async function addStaffMember(fullName: string, by: string): Promise<void> {
  const ref = doc(collection(db, COL));
  const now = Date.now();
  await setDoc(ref, { id: ref.id, fullName: fullName.trim(), title: '', active: true, createdAt: now, updatedAt: now, updatedBy: by } satisfies StaffMember);
}
