/**
 * UMS SmartConnect - Tên GV trên TKB ↔ tài khoản (/teacher_aliases/{uid}).
 * GV tự chọn tên của mình; BGH xem & sửa cho mọi GV.
 */

import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { guardedGetDocs } from '../utils/firestoreGuard';
import type { UserProfile } from '../types/auth';
import type { TeacherAliasDoc } from '../utils/teacherAssignment';

const COL = 'teacher_aliases';

/** Cache 10 phút (bộ nhớ + sessionStorage): trước đây mỗi lần mở Sổ đầu bài đọc lại cả collection. */
const ALIASES_TTL_MS = 10 * 60_000;
const ALIASES_SESSION_KEY = 'ums_teacher_aliases_v1';
let aliasesCache: { ts: number; data: TeacherAliasDoc[] } | null = null;
let aliasesInflight: Promise<TeacherAliasDoc[]> | null = null;

export function invalidateTeacherAliasesCache(): void {
  aliasesCache = null;
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ALIASES_SESSION_KEY);
  } catch {
    // bỏ qua
  }
}

export async function fetchAllTeacherAliases(): Promise<TeacherAliasDoc[]> {
  if (aliasesCache && Date.now() - aliasesCache.ts < ALIASES_TTL_MS) return aliasesCache.data;
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ALIASES_SESSION_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.data) && Date.now() - parsed.ts < ALIASES_TTL_MS) {
      aliasesCache = parsed;
      return parsed.data;
    }
  } catch {
    // sessionStorage hỏng → đọc Firestore
  }
  if (aliasesInflight) return aliasesInflight;
  aliasesInflight = (async () => {
    try {
      const snap = await guardedGetDocs('teacher_aliases:all', collection(db, COL));
      const data = snap.docs.map((d) => ({ ...(d.data() as TeacherAliasDoc), uid: d.id }));
      aliasesCache = { ts: Date.now(), data };
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(ALIASES_SESSION_KEY, JSON.stringify(aliasesCache));
      } catch {
        // chỉ giữ trong bộ nhớ
      }
      return data;
    } finally {
      aliasesInflight = null;
    }
  })();
  return aliasesInflight;
}

export async function fetchMyAliases(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, COL, uid));
  return snap.exists() ? ((snap.data() as TeacherAliasDoc).aliases || []) : [];
}

/** Ghi tên TKB cho 1 GV. `by` = người thao tác (chính GV đó hoặc BGH). */
export async function saveTeacherAliases(
  teacher: Pick<UserProfile, 'uid' | 'username' | 'displayName'>,
  aliases: string[],
  by: Pick<UserProfile, 'username'>
): Promise<void> {
  const clean = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
  const data: TeacherAliasDoc = {
    uid: teacher.uid,
    username: teacher.username,
    displayName: teacher.displayName || teacher.username,
    aliases: clean,
    updatedAt: Date.now(),
    updatedBy: by.username,
  };
  await setDoc(doc(db, COL, teacher.uid), data);
  invalidateTeacherAliasesCache();
}
