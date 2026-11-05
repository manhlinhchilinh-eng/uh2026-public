/**
 * UMS SmartConnect - Thông báo thông minh (Firestore)
 * Truy vấn khớp với rules: staff đọc tất cả; PH/HS chỉ truy vấn theo audienceKeys của mình.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile, UserRole } from '../types/auth';
import { FAMILY_ROLES, STAFF_ROLES } from '../types/auth';
import type { Announcement, AnnouncementRead, NewAnnouncementInput } from '../types/announcement';
import { buildAudienceKeys, familyAudienceKeys } from '../utils/announcements';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';
import { NEW_CHECK_LIMIT } from '../utils/desktopNotify';

const COL = 'announcements';

/**
 * Cache trạng thái đã đọc thông báo theo từng uid:
 * - Bản ghi `reads/{uid}` chỉ tạo 1 lần (không xóa theo Firestore Rules) nên lưu bền vững các ID đã đọc vào localStorage.
 * - Các ID chưa đọc đã kiểm tra trong phiên hiện tại được giữ trong RAM để không gọi lại N lệnh `getDoc`.
 */
const sessionReadCache = new Map<string, Map<string, boolean>>();

function getSessionReadMap(uid: string): Map<string, boolean> {
  let map = sessionReadCache.get(uid);
  if (!map) {
    map = new Map<string, boolean>();
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(`ums_ann_read_ids_${uid}`);
        if (raw) {
          const ids: string[] = JSON.parse(raw);
          ids.forEach((id) => map!.set(id, true));
        }
      } catch {
        // Bỏ qua lỗi đọc cache
      }
    }
    sessionReadCache.set(uid, map);
  }
  return map;
}

function persistReadIdsToLocal(uid: string, map: Map<string, boolean>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const readList: string[] = [];
    map.forEach((isRead, id) => {
      if (isRead) readList.push(id);
    });
    localStorage.setItem(`ums_ann_read_ids_${uid}`, JSON.stringify(readList.slice(-200)));
  } catch {
    // Bỏ qua lỗi ghi cache
  }
}

function toAnnouncement(id: string, d: Record<string, any>): Announcement {
  return {
    id,
    title: d.title,
    body: d.body,
    level: d.level,
    audience: d.audience,
    audienceKeys: d.audienceKeys || [],
    classId: d.classId ?? null,
    forwardableToParents: Boolean(d.forwardableToParents),
    authorId: d.authorId,
    authorName: d.authorName,
    authorRole: d.authorRole,
    createdAt: d.createdAt || 0,
    ...(d.kind ? { kind: d.kind } : {}),
    ...(Array.isArray(d.scheduleChanges) ? { scheduleChanges: d.scheduleChanges } : {}),
  };
}

export async function fetchAnnouncementsFor(role: UserRole, profile: UserProfile, max = 50): Promise<Announcement[]> {
  const isFamily = FAMILY_ROLES.includes(role);
  const q = isFamily
    ? query(
        collection(db, COL),
        where('audienceKeys', 'array-contains-any', familyAudienceKeys(role as 'parent' | 'student', profile.assignedClassId)),
        limit(max)
      )
    : query(collection(db, COL), orderBy('createdAt', 'desc'), limit(max));
  const snap = await guardedGetDocs('announcements:list', q);
  return snap.docs.map((d) => toAnnouncement(d.id, d.data()));
}

/**
 * Kiểm tra thông báo mới (thông báo trên màn hình): chỉ tin sau mốc `since` — thường 0–1 lượt đọc.
 * PH/HS cần index audienceKeys (CONTAINS) + createdAt (DESC).
 */
export async function fetchAnnouncementsSince(role: UserRole, profile: UserProfile, since: number, max = NEW_CHECK_LIMIT): Promise<Announcement[]> {
  const base = FAMILY_ROLES.includes(role)
    ? [where('audienceKeys', 'array-contains-any', familyAudienceKeys(role as 'parent' | 'student', profile.assignedClassId))]
    : [];
  const q = query(collection(db, COL), ...base, where('createdAt', '>', since), orderBy('createdAt', 'desc'), limit(max));
  const snap = await guardedGetDocs('announcements:new', q);
  return snap.docs.map((d) => toAnnouncement(d.id, d.data()));
}

/** Tập ID thông báo người dùng đã đọc (chỉ gọi getDoc cho các thông báo mới chưa có trong cache). */
export async function fetchReadIds(uid: string, announcementIds: string[]): Promise<Set<string>> {
  const userMap = getSessionReadMap(uid);
  const uncachedIds = announcementIds.filter((id) => !userMap.has(id)).slice(0, 30);

  if (uncachedIds.length > 0) {
    let anyNewRead = false;
    await Promise.all(
      uncachedIds.map(async (id) => {
        const snap = await guardedGetDoc('announcements:read_check', doc(db, COL, id, 'reads', uid)).catch(() => null);
        if (snap) {
          const exists = snap.exists();
          userMap.set(id, exists);
          if (exists) anyNewRead = true;
        }
      })
    );
    if (anyNewRead) {
      persistReadIdsToLocal(uid, userMap);
    }
  }

  const out = new Set<string>();
  for (const id of announcementIds) {
    if (userMap.get(id) === true) out.add(id);
  }
  return out;
}

export async function markAnnouncementRead(announcementId: string, profile: UserProfile): Promise<void> {
  await setDoc(doc(db, COL, announcementId, 'reads', profile.uid), {
    uid: profile.uid,
    displayName: profile.displayName || profile.username,
    readAt: Date.now(),
  });
  const userMap = getSessionReadMap(profile.uid);
  userMap.set(announcementId, true);
  persistReadIdsToLocal(profile.uid, userMap);
}

export async function fetchReaders(announcementId: string): Promise<AnnouncementRead[]> {
  const snap = await guardedGetDocs('announcements:readers', query(collection(db, COL, announcementId, 'reads'), limit(250)));
  return snap.docs.map((d) => d.data() as AnnouncementRead).sort((a, b) => a.readAt - b.readAt);
}

let staffDirectoryCache: { ts: number; data: Array<{ uid: string; displayName: string; roles: UserProfile['roles']; assignedClassId?: string }> } | null = null;
const STAFF_DIRECTORY_TTL_MS = 10 * 60_000;

/** BGH: danh sách nhân sự để biết ai CHƯA đọc thông báo gửi giáo viên (có cache 10 phút). */
export async function fetchStaffDirectory(): Promise<Array<{ uid: string; displayName: string; roles: UserProfile['roles']; assignedClassId?: string }>> {
  if (staffDirectoryCache && Date.now() - staffDirectoryCache.ts < STAFF_DIRECTORY_TTL_MS) {
    return staffDirectoryCache.data;
  }
  // Chỉ lấy tài khoản nhân sự (không để TK PH/HS chiếm chỗ trong giới hạn 250)
  const snap = await guardedGetDocs(
    'users:staff_directory',
    query(collection(db, 'users'), where('roles', 'array-contains-any', [...STAFF_ROLES, 'vanphong']), limit(250))
  );
  const data = snap.docs
    .map((d) => d.data() as UserProfile)
    .filter((u) => (u.roles || []).some((r) => !FAMILY_ROLES.includes(r)))
    .map((u) => ({
      uid: u.uid,
      displayName: u.displayName || u.username,
      roles: u.roles || [],
      // Lớp chủ nhiệm → chọn "GVCN khối 6/7/8/9" khi gửi thông báo
      ...((u.roles || []).includes('gvcn') && u.assignedClassId ? { assignedClassId: u.assignedClassId } : {}),
    }));
  staffDirectoryCache = { ts: Date.now(), data };
  return data;
}

export async function createAnnouncement(
  input: NewAnnouncementInput,
  author: UserProfile,
  authorRole: UserRole
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    title: input.title.trim(),
    body: input.body.trim(),
    level: input.level,
    audience: input.audience,
    audienceKeys: buildAudienceKeys(input.audience),
    classId: input.audience.classId,
    forwardableToParents: input.forwardableToParents,
    authorId: author.uid,
    authorName: author.displayName || author.username,
    authorRole,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
