/**
 * Góp ý & lỗi (P1) — /feedback/{uid_ngày_stt} = bản tóm tắt (< 3 KB), ảnh ở /feedback/{id}/images/{0|1}
 * (≤ 200 KB/ảnh, đã nén trên máy). Ảnh CHỈ tải khi admin bấm mở. Không polling, không listener.
 */
import { Bytes, collection, doc, getDoc, limit, orderBy, query, startAfter, updateDoc, where, writeBatch, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { guardedGetDocs } from '../utils/firestoreGuard';
import {
  FEEDBACK_MAX_PER_DAY,
  FEEDBACK_PAGE_SIZE,
  dayIndex,
  feedbackId,
  fitSize,
  nextSeq,
  validateFeedback,
  type FeedbackDoc,
  type FeedbackKind,
  type FeedbackStatus,
  FEEDBACK_IMAGE_MAX_BYTES,
} from '../utils/feedback';

const COL = 'feedback';

/** Nén ảnh trên máy: cạnh dài ≤ 1600 px, JPEG, giảm chất lượng/kích thước tới khi ≤ 200 KB. */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let side = 1600;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { w, h } = fitSize(bitmap.width, bitmap.height, side);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    for (const q of [0.82, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= FEEDBACK_IMAGE_MAX_BYTES) return blob;
    }
    side = Math.round(side * 0.75);
  }
  throw new Error('Không nén được ảnh xuống dưới 200 KB.');
}

export interface NewFeedback {
  kind: FeedbackKind;
  message: string;
  question?: string;
  page: string;
  appVersion: string;
  images: Blob[];
}

export async function submitFeedback(
  author: { uid: string; displayName?: string | null; username?: string },
  role: string,
  fb: NewFeedback
): Promise<string> {
  const err = validateFeedback(fb.message, fb.images.map((b) => ({ size: b.size, type: b.type })));
  if (err) throw new Error(err);
  const day = dayIndex(Date.now());
  // Bản đã gửi hôm nay của chính mình (≤ 10 lượt đọc) → số thứ tự kế tiếp.
  const mine = await guardedGetDocs(
    'feedback:mine-today',
    query(collection(db, COL), where('authorId', '==', author.uid), where('day', '==', day), limit(FEEDBACK_MAX_PER_DAY))
  );
  const seq = nextSeq(mine.docs.map((d) => (d.data() as FeedbackDoc).seq));
  if (seq == null) throw new Error(`Mỗi người gửi tối đa ${FEEDBACK_MAX_PER_DAY} góp ý mỗi ngày.`);
  const id = feedbackId(author.uid, day, seq);
  const data: Omit<FeedbackDoc, 'id'> = {
    authorId: author.uid,
    authorName: (author.displayName || author.username || '').slice(0, 80),
    role,
    kind: fb.kind,
    message: fb.message.trim(),
    question: (fb.question || '').slice(0, 200),
    page: fb.page.slice(0, 120),
    appVersion: fb.appVersion.slice(0, 60),
    imageCount: fb.images.length,
    day,
    seq,
    status: 'new',
    createdAt: Date.now(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, COL, id), data);
  for (let i = 0; i < fb.images.length; i++) {
    const bytes = new Uint8Array(await fb.images[i].arrayBuffer());
    batch.set(doc(db, COL, id, 'images', String(i)), { data: Bytes.fromUint8Array(bytes), type: fb.images[i].type || 'image/jpeg' });
  }
  await batch.commit();
  return id;
}

export interface FeedbackPage {
  items: FeedbackDoc[];
  cursor: QueryDocumentSnapshot | null;
}

/** Admin: 30 bản mới nhất mỗi lần (bấm "Tải thêm" mới đọc tiếp). */
export async function listFeedback(after: QueryDocumentSnapshot | null = null): Promise<FeedbackPage> {
  const q = after
    ? query(collection(db, COL), orderBy('createdAt', 'desc'), startAfter(after), limit(FEEDBACK_PAGE_SIZE))
    : query(collection(db, COL), orderBy('createdAt', 'desc'), limit(FEEDBACK_PAGE_SIZE));
  const snap = await guardedGetDocs('feedback:list', q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedbackDoc, 'id'>) })),
    cursor: snap.docs.length === FEEDBACK_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}

/** Ảnh của 1 góp ý — chỉ gọi khi admin bấm mở (≤ 2 lượt đọc). */
export async function loadFeedbackImages(fb: FeedbackDoc): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < Math.min(fb.imageCount, 2); i++) {
    const s = await getDoc(doc(db, COL, fb.id, 'images', String(i)));
    if (!s.exists()) continue;
    const d = s.data() as { data: Bytes; type: string };
    urls.push(URL.createObjectURL(new Blob([d.data.toUint8Array() as Uint8Array<ArrayBuffer>], { type: d.type })));
  }
  return urls;
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus, by: string, adminNote?: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status,
    updatedAt: Date.now(),
    updatedBy: by.slice(0, 80),
    ...(adminNote !== undefined ? { adminNote: adminNote.slice(0, 500) } : {}),
  });
}
