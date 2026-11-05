/**
 * UMS SmartConnect - Thông báo Văn phòng (/office_notices/{id}, xác nhận /office_notices/{id}/acks/{uid}).
 * Người nhận được chốt khi gửi (recipientUids) → mỗi GV chỉ đọc được tin gửi cho mình.
 */

import { Bytes, collection, doc, documentId, limit, orderBy, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import { OFFICE_NOTICE_LIMIT, type NoticeAck, type OfficeNotice } from '../utils/officeNotices';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';
import { NEW_CHECK_LIMIT } from '../utils/desktopNotify';
import { chunkCountFor, joinChunks, safeFileName, splitChunks, type NoticeFileMeta } from '../utils/noticeFiles';
import type { NoticeAttachment } from '../utils/officeNotices';

const COL = 'office_notices';
const toNotice = (id: string, d: Record<string, unknown>) => ({ ...(d as Omit<OfficeNotice, 'id'>), id }) as OfficeNotice;

/** Tin gửi cho tôi — mới nhất trước, tối đa OFFICE_NOTICE_LIMIT (index: recipientUids + createdAt desc). Không tải khi tab ẩn. */
export async function fetchMyNotices(uid: string, max = OFFICE_NOTICE_LIMIT): Promise<OfficeNotice[]> {
  const snap = await guardedGetDocs(
    'office_notices:mine',
    query(collection(db, COL), where('recipientUids', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(max)),
    { blockWhenHidden: true }
  );
  return snap.docs.map((d) => toNotice(d.id, d.data()));
}

/**
 * Kiểm tra tin mới (thông báo trên màn hình): chỉ tin sau mốc `since` — thường 0–1 lượt đọc.
 * Cho phép chạy khi tab ẩn (tối thiểu 15 phút/lần, chỉ khi người dùng đã bật thông báo trên máy). Cùng index với fetchMyNotices.
 */
export async function fetchMyNoticesSince(uid: string, since: number, max = NEW_CHECK_LIMIT): Promise<OfficeNotice[]> {
  const snap = await guardedGetDocs(
    'office_notices:new',
    query(collection(db, COL), where('recipientUids', 'array-contains', uid), where('createdAt', '>', since), orderBy('createdAt', 'desc'), limit(max))
  );
  return snap.docs.map((d) => toNotice(d.id, d.data()));
}

/** BGH / Văn phòng: mọi tin (mới nhất trước). */
export async function fetchAllNotices(max = 100): Promise<OfficeNotice[]> {
  const snap = await guardedGetDocs(
    'office_notices:all',
    query(collection(db, COL), orderBy('createdAt', 'desc'), limit(max))
  );
  return snap.docs.map((d) => toNotice(d.id, d.data()));
}

/** Xác nhận của tôi cho các tin (OfficeNoticesContext chỉ gọi cho tin chưa kiểm tra trong phiên). */
export async function fetchMyAcks(uid: string, noticeIds: string[]): Promise<Map<string, NoticeAck>> {
  const out = new Map<string, NoticeAck>();
  await Promise.all(
    noticeIds.map(async (id) => {
      const s = await guardedGetDoc('office_notices:my_ack', doc(db, COL, id, 'acks', uid)).catch(() => null);
      if (s?.exists()) out.set(id, s.data() as NoticeAck);
    })
  );
  return out;
}

/** Người gửi / BGH / Văn phòng: mọi xác nhận của 1 tin. */
export async function fetchAcks(noticeId: string): Promise<NoticeAck[]> {
  const snap = await guardedGetDocs('office_notices:acks', query(collection(db, COL, noticeId, 'acks'), limit(200)));
  return snap.docs.map((d) => d.data() as NoticeAck);
}

/** Đánh dấu đã đọc / đã thực hiện (hoặc bỏ "đã thực hiện"). */
export async function ackNotice(
  noticeId: string,
  me: Pick<UserProfile, 'uid' | 'displayName' | 'username'>,
  kind: 'read' | 'done' | 'undone',
  prev?: NoticeAck
): Promise<NoticeAck> {
  const now = Date.now();
  const next: NoticeAck = {
    uid: me.uid,
    displayName: me.displayName || me.username,
    readAt: prev?.readAt || now,
    ...(kind === 'done' ? { doneAt: now } : kind === 'read' && prev?.doneAt ? { doneAt: prev.doneAt } : {}),
  };
  await setDoc(doc(db, COL, noticeId, 'acks', me.uid), next);
  return next;
}

export type NewNotice = Omit<OfficeNotice, 'id' | 'authorId' | 'authorName' | 'createdAt' | 'updatedAt'>;

/** Mã tin tạo trước (để tải tệp lên trước rồi mới tạo tin). */
export function newNoticeId(): string {
  return doc(collection(db, COL)).id;
}

export async function createNotice(n: NewNotice, author: UserProfile, id: string = newNoticeId()): Promise<string> {
  const now = Date.now();
  const ref = doc(db, COL, id);
  await setDoc(ref, {
    ...n,
    title: n.title.trim(),
    body: n.body.trim(),
    parentMessage: (n.parentMessage || '').trim(),
    authorId: author.uid,
    authorName: author.displayName || author.username,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function setNoticePinned(id: string, pinned: boolean): Promise<void> {
  await updateDoc(doc(db, COL, id), { pinned, updatedAt: Date.now() });
}

/** Xóa tin + tệp tải lên của tin (Firestore không tự xóa collection con). Không cần đọc thêm: số khối có trong attachments. */
export async function deleteNotice(id: string, attachments: NoticeAttachment[] = []): Promise<void> {
  const batch = writeBatch(db);
  for (const a of attachments) {
    // Tệp chuyển tiếp từ Hành chính – Văn bản (srcDocId) thuộc văn bản gốc → không xóa theo tin
    if (!a.fileId || a.srcDocId) continue;
    for (let i = 0; i < chunkCountFor(a.size || 0); i++) batch.delete(doc(db, COL, id, 'files', a.fileId, 'chunks', String(i)));
    batch.delete(doc(db, COL, id, 'files', a.fileId));
  }
  batch.delete(doc(db, COL, id));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Tệp tải lên (lưu trong Firestore, chia khối) — xem utils/noticeFiles.ts
// ---------------------------------------------------------------------------

/** Tải 1 tệp lên dưới tin `noticeId` (1 batch: thông tin + các khối). Gọi TRƯỚC createNotice. */
export async function uploadNoticeFile(noticeId: string, file: File, author: Pick<UserProfile, 'uid'>): Promise<NoticeAttachment> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parts = splitChunks(bytes);
  const fileRef = doc(collection(db, COL, noticeId, 'files'));
  const meta: NoticeFileMeta = {
    name: safeFileName(file.name),
    size: bytes.length,
    type: (file.type || 'application/octet-stream').slice(0, 100),
    chunkCount: parts.length,
    authorId: author.uid,
    createdAt: Date.now(),
  };
  const batch = writeBatch(db);
  batch.set(fileRef, meta);
  parts.forEach((p, i) => batch.set(doc(fileRef, 'chunks', String(i)), { i, data: Bytes.fromUint8Array(p) }));
  await batch.commit();
  return { name: meta.name, fileId: fileRef.id, size: meta.size, type: meta.type };
}

/** Người nhận tải tệp về (1 truy vấn = số khối lượt đọc). */
export async function downloadNoticeFile(noticeId: string, a: NoticeAttachment): Promise<Blob> {
  if (!a.fileId) throw new Error('Không phải tệp tải lên');
  const snap = await guardedGetDocs(
    'office_notices:file',
    query(collection(db, COL, noticeId, 'files', a.fileId, 'chunks'), orderBy(documentId()), limit(chunkCountFor(a.size || 0) + 1))
  );
  const parts = snap.docs
    .map((d) => d.data() as { i: number; data: Bytes })
    .sort((x, y) => x.i - y.i)
    .map((d) => d.data.toUint8Array());
  const bytes = joinChunks(parts);
  if (a.size != null && bytes.length !== a.size) throw new Error('Tệp chưa tải đủ, thử lại.');
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: a.type || 'application/octet-stream' });
}
