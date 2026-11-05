/**
 * Hành chính – Văn bản – Quy trình (/admin_docs/{id}): lưu thông tin + link (Drive/Docs…) và/hoặc tệp tải lên trực tiếp
 * (chia khối lưu tại /admin_docs/{id}/files/{fileId}/chunks/{i} — không cần Blaze/Storage).
 * Nhân sự + Văn phòng đọc; BGH / Văn phòng thêm, sửa, xoá. Tải 1 lần khi mở trang (tối đa ADMIN_DOC_LIMIT).
 */

import { Bytes, collection, doc, documentId, limit, orderBy, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import { ADMIN_DOC_LIMIT, safeDocUrl, type AdminDoc, type AdminDocInput } from '../utils/adminDocs';
import { guardedGetDocs } from '../utils/firestoreGuard';
import { chunkCountFor, joinChunks, safeFileName, splitChunks, type NoticeFileMeta } from '../utils/noticeFiles';
import type { NoticeAttachment } from '../utils/officeNotices';

const COL = 'admin_docs';

export async function fetchAdminDocs(max = ADMIN_DOC_LIMIT): Promise<AdminDoc[]> {
  const snap = await guardedGetDocs('admin_docs:list', query(collection(db, COL), orderBy('updatedAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<AdminDoc, 'id'>), id: d.id }));
}

/** Chỉ phần đổi sau mốc `afterUpdatedAt` (range + orderBy cùng 1 trường: không cần index ghép). */
export async function fetchAdminDocsSince(afterUpdatedAt: number, max = 50): Promise<AdminDoc[]> {
  const snap = await guardedGetDocs(
    'admin_docs:since',
    query(collection(db, COL), where('updatedAt', '>', afterUpdatedAt), orderBy('updatedAt'), limit(max))
  );
  return snap.docs.map((d) => ({ ...(d.data() as Omit<AdminDoc, 'id'>), id: d.id }));
}

const clean = (d: AdminDocInput) => ({
  title: d.title.trim(),
  category: d.category,
  url: safeDocUrl(d.url) || '',
  ...(d.attachments ? { attachments: d.attachments } : {}),
  description: d.description.trim(),
  docNumber: d.docNumber.trim(),
  issuedDate: d.issuedDate,
  pinned: d.pinned,
});

/** Mã tài liệu tạo trước (để tải tệp lên trước rồi mới tạo bản ghi tài liệu). */
export function newAdminDocId(): string {
  return doc(collection(db, COL)).id;
}

export async function createAdminDoc(d: AdminDocInput, author: UserProfile, id: string = newAdminDocId()): Promise<string> {
  const now = Date.now();
  const ref = doc(db, COL, id);
  await setDoc(ref, {
    ...clean(d),
    authorId: author.uid,
    authorName: author.displayName || author.username,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateAdminDoc(id: string, d: AdminDocInput, removedAttachments: NoticeAttachment[] = []): Promise<void> {
  if (removedAttachments.length === 0) {
    await updateDoc(doc(db, COL, id), { ...clean(d), updatedAt: Date.now() });
    return;
  }
  const batch = writeBatch(db);
  for (const a of removedAttachments) {
    if (!a.fileId) continue;
    for (let i = 0; i < chunkCountFor(a.size || 0); i++) {
      batch.delete(doc(db, COL, id, 'files', a.fileId, 'chunks', String(i)));
    }
    batch.delete(doc(db, COL, id, 'files', a.fileId));
  }
  batch.update(doc(db, COL, id), { ...clean(d), updatedAt: Date.now() });
  await batch.commit();
}

export async function deleteAdminDoc(id: string, attachments: NoticeAttachment[] = []): Promise<void> {
  const batch = writeBatch(db);
  for (const a of attachments) {
    if (!a.fileId) continue;
    for (let i = 0; i < chunkCountFor(a.size || 0); i++) {
      batch.delete(doc(db, COL, id, 'files', a.fileId, 'chunks', String(i)));
    }
    batch.delete(doc(db, COL, id, 'files', a.fileId));
  }
  batch.delete(doc(db, COL, id));
  await batch.commit();
}

/** Tải 1 tệp lên dưới tài liệu `docId` (1 batch: thông tin + các khối). Gọi TRƯỚC createAdminDoc / updateAdminDoc. */
export async function uploadAdminDocFile(docId: string, file: File, author: Pick<UserProfile, 'uid'>): Promise<NoticeAttachment> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parts = splitChunks(bytes);
  const fileRef = doc(collection(db, COL, docId, 'files'));
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

/** Nhân sự / Văn phòng tải tệp về (1 truy vấn = số khối lượt đọc). */
export async function downloadAdminDocFile(docId: string, a: NoticeAttachment): Promise<Blob> {
  if (!a.fileId) throw new Error('Không phải tệp tải lên');
  const snap = await guardedGetDocs(
    'admin_docs:file',
    query(collection(db, COL, docId, 'files', a.fileId, 'chunks'), orderBy(documentId()), limit(chunkCountFor(a.size || 0) + 1))
  );
  const parts = snap.docs
    .map((d) => d.data() as { i: number; data: Bytes })
    .sort((x, y) => x.i - y.i)
    .map((d) => d.data.toUint8Array());
  const bytes = joinChunks(parts);
  if (a.size != null && bytes.length !== a.size) throw new Error('Tệp chưa tải đủ, thử lại.');
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: a.type || 'application/octet-stream' });
}
