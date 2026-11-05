/**
 * Sĩ số từng lớp (`classes/{id}.studentCount`) cho Trợ lý UMS+.
 * 1 truy vấn collection 'classes' (limit 60), giữ trong RAM + sessionStorage 30 phút.
 */
import { collection, doc, limit, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';

export const CLASS_SIZES_KEY = 'ums.classSizes.v1';
export const CLASS_SIZES_TTL_MS = 30 * 60_000;
const CLASS_LIMIT = 60;

type Sizes = Record<string, number>;
let mem: { at: number; sizes: Sizes } | null = null;
let inflight: Promise<Sizes> | null = null;

function readSession(now: number): Sizes | null {
  try {
    const raw = sessionStorage.getItem(CLASS_SIZES_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at?: number; sizes?: Sizes };
    if (typeof v.at !== 'number' || !v.sizes || now - v.at >= CLASS_SIZES_TTL_MS) return null;
    mem = { at: v.at, sizes: v.sizes };
    return v.sizes;
  } catch {
    return null;
  }
}

export async function getClassSizes(): Promise<Sizes> {
  const now = Date.now();
  if (mem && now - mem.at < CLASS_SIZES_TTL_MS) return mem.sizes;
  const stored = readSession(now);
  if (stored) return stored;
  if (inflight) return inflight;
  // Ngoại lệ luật "where + limit": collection 'classes' nhỏ (26 lớp, chặn bằng limit 60), cần đủ mọi lớp;
  // mỗi phiên đọc tối đa 1 lần / 30 phút nhờ cache RAM + sessionStorage (~26 lượt/người/30 phút).
  inflight = guardedGetDocs('classes:sizes', query(collection(db, 'classes'), limit(CLASS_LIMIT)))
    .then((snap) => {
      const sizes: Sizes = {};
      snap.docs.forEach((d) => {
        const n = (d.data() as { studentCount?: unknown }).studentCount;
        if (typeof n === 'number' && n > 0) sizes[d.id] = n;
      });
      mem = { at: Date.now(), sizes };
      try {
        sessionStorage.setItem(CLASS_SIZES_KEY, JSON.stringify(mem));
      } catch {
        /* sessionStorage không dùng được → chỉ giữ RAM */
      }
      return sizes;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const oneMem = new Map<string, { at: number; size: number | null }>();

/**
 * Sĩ số 1 lớp (GVCN hỏi Trợ lý): dùng bảng toàn trường nếu đã có trong RAM/sessionStorage,
 * không thì đọc đúng 1 doc `classes/{id}` (thay vì 60 doc) và giữ RAM 30 phút. Không có sĩ số → null.
 */
export async function getClassSize(classId: string): Promise<number | null> {
  const now = Date.now();
  const all = mem && now - mem.at < CLASS_SIZES_TTL_MS ? mem.sizes : readSession(now);
  if (all) return all[classId] ?? null;
  const hit = oneMem.get(classId);
  if (hit && now - hit.at < CLASS_SIZES_TTL_MS) return hit.size;
  const snap = await guardedGetDoc('classes:size', doc(db, 'classes', classId));
  const n = snap.exists() ? (snap.data() as { studentCount?: unknown }).studentCount : undefined;
  const size = typeof n === 'number' && n > 0 ? n : null;
  oneMem.set(classId, { at: now, size });
  return size;
}

/** Chỉ dùng cho test. */
export function resetClassSizeCache(): void {
  mem = null;
  inflight = null;
  oneMem.clear();
  try {
    sessionStorage.removeItem(CLASS_SIZES_KEY);
  } catch {
    /* bỏ qua */
  }
}
