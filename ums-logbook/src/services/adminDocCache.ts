/**
 * Cache dùng chung cho /admin_docs (Hành chính + Trợ lý UMS+).
 * - Lần đầu / hết hạn 3 ngày / force: đọc đủ danh sách (fetchAdminDocs).
 * - Các lần sau: chỉ đọc phần mới đổi (updatedAt > maxUpdatedAt) và ghép đè theo id.
 * - Trong 60 giây của cùng phiên: 0 lượt đọc (RAM).
 * - localStorage lỗi/đầy → chạy như không có cache, không ném lỗi.
 */
import { ADMIN_DOC_LIMIT, type AdminDoc } from '../utils/adminDocs';
import { fetchAdminDocs, fetchAdminDocsSince } from './adminDocService';

export const ADMIN_DOC_FULL_TTL_MS = 3 * 24 * 3600_000;
const FRESH_MS = 60_000;
const KEY_PREFIX = 'ums.adminDocs.v1.';

interface Stored {
  fullAt: number;
  maxUpdatedAt: number;
  docs: AdminDoc[];
}
interface Mem extends Stored {
  checkedAt: number;
}

const mem = new Map<string, Mem>();

const maxOf = (docs: AdminDoc[]) => docs.reduce((m, d) => Math.max(m, d.updatedAt || 0), 0);
const checkedAtOf = (c: Stored): number => (c as Partial<Mem>).checkedAt ?? 0;
const byNewest = (a: AdminDoc, b: AdminDoc) => (b.updatedAt || 0) - (a.updatedAt || 0);

function readStored(uid: string): Stored | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + uid);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || !Array.isArray(s.docs) || typeof s.fullAt !== 'number') return null;
    return { fullAt: s.fullAt, maxUpdatedAt: s.maxUpdatedAt || 0, docs: s.docs };
  } catch {
    return null;
  }
}

function writeStored(uid: string, s: Stored): void {
  try {
    localStorage.setItem(KEY_PREFIX + uid, JSON.stringify(s));
  } catch {
    // đầy/bị chặn: bỏ qua
  }
}

const inflight = new Map<string, Promise<AdminDoc[]>>();

/** Cùng uid đang đọc dở thì dùng chung 1 lượt (StrictMode, bấm đúp). */
export function getAdminDocsCached(uid: string, opts: { force?: boolean; now?: number } = {}): Promise<AdminDoc[]> {
  if (!uid) return Promise.resolve([]);
  const running = inflight.get(uid);
  if (running) return running;
  const p = loadAdminDocs(uid, opts).finally(() => inflight.delete(uid));
  inflight.set(uid, p);
  return p;
}

async function loadAdminDocs(uid: string, opts: { force?: boolean; now?: number }): Promise<AdminDoc[]> {
  const now = opts.now ?? Date.now();
  let cur: Mem | Stored | null = opts.force ? null : (mem.get(uid) ?? readStored(uid));
  if (cur && now - cur.fullAt > ADMIN_DOC_FULL_TTL_MS) cur = null;

  if (!cur) {
    const docs = await fetchAdminDocs();
    const s: Stored = { fullAt: now, maxUpdatedAt: maxOf(docs), docs };
    mem.set(uid, { ...s, checkedAt: now });
    writeStored(uid, s);
    return docs;
  }

  const checkedAt = checkedAtOf(cur);
  if (now >= checkedAt && now - checkedAt < FRESH_MS) return cur.docs;

  // Dựa vào updatedAt do máy khách ghi: lệch đồng hồ có thể làm văn bản hiện chậm đến lần tải đầy đủ kế tiếp.
  let delta: AdminDoc[];
  try {
    delta = await fetchAdminDocsSince(cur.maxUpdatedAt);
  } catch (e) {
    console.warn('[adminDocCache] đọc phần đổi lỗi, dùng bản cache', e);
    return cur.docs;
  }
  const map = new Map(cur.docs.map((d) => [d.id, d]));
  delta.forEach((d) => map.set(d.id, d));
  const docs = [...map.values()].sort(byNewest).slice(0, ADMIN_DOC_LIMIT);
  const s: Stored = { fullAt: cur.fullAt, maxUpdatedAt: Math.max(cur.maxUpdatedAt, maxOf(delta)), docs };
  mem.set(uid, { ...s, checkedAt: now });
  writeStored(uid, s);
  return docs;
}

function replaceDocs(uid: string, make: (docs: AdminDoc[]) => AdminDoc[]): void {
  const cur = mem.get(uid) ?? readStored(uid);
  if (!cur) return;
  const docs = make(cur.docs);
  mem.set(uid, {
    fullAt: cur.fullAt,
    maxUpdatedAt: cur.maxUpdatedAt,
    docs,
    checkedAt: checkedAtOf(cur),
  });
  writeStored(uid, { fullAt: cur.fullAt, maxUpdatedAt: cur.maxUpdatedAt, docs });
}

/** Sau khi tạo/sửa: cập nhật cache tại chỗ (không đọc lại). Giữ nguyên maxUpdatedAt để delta vẫn bắt thay đổi của người khác. */
export function upsertCachedAdminDoc(uid: string, d: AdminDoc): void {
  replaceDocs(uid, (docs) => [d, ...docs.filter((x) => x.id !== d.id)].sort(byNewest));
}

export function removeCachedAdminDoc(uid: string, id: string): void {
  replaceDocs(uid, (docs) => docs.filter((x) => x.id !== id));
}

/** Không truyền uid = xoá cache mọi tài khoản (đăng xuất trên máy dùng chung). */
export function clearAdminDocCache(uid?: string): void {
  if (uid) mem.delete(uid);
  else mem.clear();
  try {
    if (uid) {
      localStorage.removeItem(KEY_PREFIX + uid);
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // bỏ qua
  }
}
