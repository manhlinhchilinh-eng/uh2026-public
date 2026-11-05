/**
 * Danh sách HS của lớp cho điểm danh, ghi sổ tiết, nề nếp.
 * Bản build (production) KHÔNG còn dữ liệu HS trong JS (vite.config.ts thay class_data.json bằng {} từ 23/10),
 * nên phải đọc /students trên Firestore: 1 truy vấn theo lớp (≤ 60 doc), nhớ trong phiên để không đọc lặp.
 * Dev/test/offline: dùng dữ liệu mẫu (getClassRoster) khi Firestore không có HS lớp đó.
 */

import { collection, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { guardedGetDocs } from '../utils/firestoreGuard';
import type { StudentDoc } from '../types';
import { generateSeedDataset } from './seedService';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

export const ROSTER_LIMIT = 60;

/** Doc /students trên Firestore (nhập từ Excel): className, mhs, fullName, stt, active, … */
export interface FirestoreStudent {
  className?: string;
  classId?: string;
  mhs?: string | number;
  fullName?: string;
  name?: string;
  stt?: number | string;
  grade?: number;
  dateOfBirth?: string;
  gender?: string;
  active?: boolean;
  status?: string;
  createdAt?: number;
  moetId?: string;
}

/** Chuyển doc Firestore → StudentDoc; bỏ HS đã chuyển/không hoạt động; sắp theo STT rồi tên. */
export function mapStudentDocs(docs: Array<{ id: string; data: FirestoreStudent }>, classId: string): StudentDoc[] {
  return docs
    .filter(({ data }) => data.active !== false && data.status !== 'transferred')
    .map(({ id, data }): StudentDoc => {
      const mhs = String(data.mhs ?? id);
      return {
        id: mhs,
        mhs,
        stt: Number(data.stt) || 0,
        name: String(data.fullName || data.name || mhs),
        classId: String(data.className || data.classId || classId),
        grade: Number(data.grade) || Number(classId.charAt(0)) || 0,
        dob: String(data.dateOfBirth || ''),
        gender: data.gender === 'Nữ' ? 'Nữ' : 'Nam',
        status: 'active',
        createdAt: Number(data.createdAt) || 0,
        docId: id,
        ...(data.moetId ? { moetId: String(data.moetId) } : {}),
      };
    })
    .sort((a, b) => (a.stt || 999) - (b.stt || 999) || a.name.localeCompare(b.name, 'vi'));
}

/** Dữ liệu mẫu (chỉ có ở dev/test; bản build rỗng) — giữ thứ tự cũ: localStorage rồi seed. */
export function getLocalRoster(classId: string): StudentDoc[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('ums_students') : null;
    if (raw) {
      const filtered = (JSON.parse(raw) as StudentDoc[]).filter((s) => s.classId === classId);
      if (filtered.length > 0) return filtered.sort((a, b) => a.stt - b.stt);
    }
  } catch {}
  const { students } = generateSeedDataset();
  return students.filter((s) => s.classId === classId).sort((a, b) => a.stt - b.stt);
}

export async function fetchClassRosterFromFirestore(classId: string): Promise<StudentDoc[]> {
  const snap = await guardedGetDocs(
    'students:class_roster',
    query(collection(db, 'students'), where('className', '==', classId), limit(ROSTER_LIMIT))
  );
  return mapStudentDocs(
    snap.docs.map((d) => ({ id: d.id, data: d.data() as FirestoreStudent })),
    classId
  );
}

const cache = new Map<string, Promise<StudentDoc[]>>();
/** Nguồn của danh sách đã nhớ: 'firestore' = dữ liệu thật; 'sample' = dữ liệu mẫu (dev/lỗi đọc). */
const source = new Map<string, 'firestore' | 'sample'>();

/**
 * Danh sách HS lớp: Firestore (nhớ trong phiên) → nếu rỗng/lỗi thì dữ liệu mẫu.
 * Lỗi đọc không được nhớ để lần sau thử lại.
 */
export function fetchClassRoster(classId: string): Promise<StudentDoc[]> {
  if (!classId) return Promise.resolve([]);
  if (isTestEnv) return Promise.resolve(getLocalRoster(classId));
  const hit = cache.get(classId);
  if (hit) return hit;
  const p = fetchClassRosterFromFirestore(classId)
    .then((list) => {
      source.set(classId, list.length > 0 ? 'firestore' : 'sample');
      return list.length > 0 ? list : getLocalRoster(classId);
    })
    .catch((e) => {
      cache.delete(classId);
      source.set(classId, 'sample');
      console.warn('[roster] đọc danh sách HS thất bại, dùng dữ liệu mẫu:', e);
      return getLocalRoster(classId);
    });
  cache.set(classId, p);
  return p;
}

/**
 * Danh sách HS CHỈ từ dữ liệu thật (Trợ lý: không được bịa). Dùng chung bộ nhớ với fetchClassRoster
 * (không đọc thêm). Trả null nếu chỉ có dữ liệu mẫu (lớp chưa có HS trên Firestore hoặc đọc lỗi).
 */
export async function fetchClassRosterStrict(classId: string): Promise<StudentDoc[] | null> {
  if (!classId) return null;
  if (isTestEnv) return getLocalRoster(classId);
  const list = await fetchClassRoster(classId);
  return source.get(classId) === 'firestore' ? list : null;
}

export function clearRosterCache(): void {
  cache.clear();
  source.clear();
}
