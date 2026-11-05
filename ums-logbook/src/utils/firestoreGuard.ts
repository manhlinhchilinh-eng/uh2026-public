import {
  getDoc,
  getDocs,
  disableNetwork,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/** Thông báo khi tạm dừng tải dữ liệu (không dùng từ kỹ thuật như "cầu chì" hay tên truy vấn). */
export const GUARD_BANNER_TEXT =
  'Hệ thống tạm dừng tải dữ liệu vì trang này gửi quá nhiều yêu cầu trong thời gian ngắn (để tránh vượt chi phí). ' +
  'Vui lòng tải lại trang sau ít phút; nếu lặp lại, hãy báo lỗi qua Trợ lý UMS+.';

export const FIRESTORE_GUARD_LIMITS = {
  MAX_QUERIES_PER_MINUTE_PER_TAG: 40,
  // 05/11/2026: 8.000 → 3.000. Một phiên bình thường (kể cả Dashboard BGH ~500/lần) dưới 1.000.
  MAX_DOC_READS_PER_15_MIN: 3_000,
  QUERY_WINDOW_MS: 60_000,
  DOC_READ_WINDOW_MS: 15 * 60_000,
} as const;

export interface FirestoreTagStats {
  queries: number;
  docsRead: number;
  blocked: number;
  lastCallAt: number;
}

export interface FirestoreGuardStats {
  totalQueries: number;
  totalDocsRead: number;
  blockedCalls: number;
  tripped: boolean;
  tripReason: string | null;
  byTag: Record<string, FirestoreTagStats>;
}

const queryTimestampsByTag = new Map<string, number[]>();
const docReadEvents: Array<{ ts: number; count: number }> = [];

const stats: FirestoreGuardStats = {
  totalQueries: 0,
  totalDocsRead: 0,
  blockedCalls: 0,
  tripped: false,
  tripReason: null,
  byTag: {},
};

function ensureTagStats(tag: string): FirestoreTagStats {
  if (!stats.byTag[tag]) {
    stats.byTag[tag] = { queries: 0, docsRead: 0, blocked: 0, lastCallAt: 0 };
  }
  return stats.byTag[tag];
}

export function isTabHidden(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden === true || document.visibilityState === 'hidden';
}

function showCircuitBreakerBanner(reason: string): void {
  if (typeof document === 'undefined' || !document.body) return;
  const existing = document.getElementById('ums-firestore-guard-banner');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id = 'ums-firestore-guard-banner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:99999',
    'background:#b91c1c',
    'color:#ffffff',
    'padding:10px 16px',
    'font-size:14px',
    'font-weight:600',
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:12px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
  ].join(';');

  const text = document.createElement('span');
  // Câu dễ hiểu cho người dùng; tên kỹ thuật (reason) chỉ ghi ở console / báo lỗi (data-reason)
  text.textContent = GUARD_BANNER_TEXT;
  banner.setAttribute('data-reason', reason);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Tải lại trang';
  btn.style.cssText = [
    'background:#ffffff',
    'color:#b91c1c',
    'border:none',
    'border-radius:6px',
    'padding:6px 12px',
    'font-weight:700',
    'cursor:pointer',
    'white-space:nowrap',
  ].join(';');
  btn.onclick = () => window.location.reload();

  banner.appendChild(text);
  banner.appendChild(btn);
  document.body.appendChild(banner);
}

function tripCircuitBreaker(reason: string): void {
  if (!stats.tripped) {
    stats.tripped = true;
    stats.tripReason = reason;
    console.error(`[FIRESTORE_GUARD] Đã ngắt cầu chì bảo vệ: ${reason}`);
    showCircuitBreakerBanner(reason);
    try {
      void disableNetwork(db);
    } catch {
      // Bỏ qua trong môi trường test/mock
    }
  }
}

function pruneDocReads(now: number): number {
  const cutoff = now - FIRESTORE_GUARD_LIMITS.DOC_READ_WINDOW_MS;
  while (docReadEvents.length > 0 && docReadEvents[0].ts < cutoff) {
    docReadEvents.shift();
  }
  let sum = 0;
  for (const ev of docReadEvents) {
    sum += ev.count;
  }
  return sum;
}

/**
 * Kiểm tra xem có được phép thực hiện truy vấn Firestore hay không.
 * Trả về `false` nếu tab đang ẩn (khi `blockWhenHidden = true`) hoặc đã vượt ngưỡng an toàn.
 */
export function checkFirestoreGuard(
  tag: string,
  options?: { blockWhenHidden?: boolean },
): boolean {
  const tagStat = ensureTagStats(tag);
  const now = Date.now();

  if (options?.blockWhenHidden && isTabHidden()) {
    tagStat.blocked += 1;
    stats.blockedCalls += 1;
    return false;
  }

  if (stats.tripped) {
    tagStat.blocked += 1;
    stats.blockedCalls += 1;
    return false;
  }

  const timestamps = queryTimestampsByTag.get(tag) ?? [];
  const cutoff = now - FIRESTORE_GUARD_LIMITS.QUERY_WINDOW_MS;
  const recent = timestamps.filter((t) => t >= cutoff);
  recent.push(now);
  queryTimestampsByTag.set(tag, recent);

  if (recent.length > FIRESTORE_GUARD_LIMITS.MAX_QUERIES_PER_MINUTE_PER_TAG) {
    tagStat.blocked += 1;
    stats.blockedCalls += 1;
    tripCircuitBreaker(
      `Quá ${FIRESTORE_GUARD_LIMITS.MAX_QUERIES_PER_MINUTE_PER_TAG} truy vấn/phút tại "${tag}"`,
    );
    return false;
  }

  const recentDocs = pruneDocReads(now);
  if (recentDocs > FIRESTORE_GUARD_LIMITS.MAX_DOC_READS_PER_15_MIN) {
    tagStat.blocked += 1;
    stats.blockedCalls += 1;
    tripCircuitBreaker(
      `Quá ${FIRESTORE_GUARD_LIMITS.MAX_DOC_READS_PER_15_MIN} lượt đọc tài liệu trong 15 phút`,
    );
    return false;
  }

  tagStat.queries += 1;
  tagStat.lastCallAt = now;
  stats.totalQueries += 1;
  return true;
}

/**
 * Ghi nhận số lượng document vừa đọc được từ một truy vấn hoặc listener.
 */
export function recordFirestoreReads(tag: string, docCount: number): void {
  const safeCount = Math.max(0, docCount);
  const now = Date.now();
  const tagStat = ensureTagStats(tag);
  tagStat.docsRead += safeCount;
  stats.totalDocsRead += safeCount;

  if (safeCount > 0) {
    docReadEvents.push({ ts: now, count: safeCount });
    const recentDocs = pruneDocReads(now);
    if (recentDocs > FIRESTORE_GUARD_LIMITS.MAX_DOC_READS_PER_15_MIN) {
      tripCircuitBreaker(
        `Quá ${FIRESTORE_GUARD_LIMITS.MAX_DOC_READS_PER_15_MIN} lượt đọc tài liệu trong 15 phút (tại "${tag}")`,
      );
    }
  }
}

export async function guardedGetDocs<T>(
  tag: string,
  q: Query<T>,
  options?: { blockWhenHidden?: boolean },
): Promise<QuerySnapshot<T>> {
  if (!checkFirestoreGuard(tag, options)) {
    throw new Error(`[FIRESTORE_GUARD] Truy vấn "${tag}" đã bị chặn để bảo vệ hạn mức.`);
  }
  const snap = await getDocs(q);
  // Mỗi truy vấn getDocs bị Firestore tính tối thiểu 1 lượt đọc kể cả khi kết quả rỗng.
  recordFirestoreReads(tag, Math.max(1, snap.size));
  return snap;
}

export async function guardedGetDoc<T>(
  tag: string,
  ref: DocumentReference<T>,
  options?: { blockWhenHidden?: boolean },
): Promise<DocumentSnapshot<T>> {
  if (!checkFirestoreGuard(tag, options)) {
    throw new Error(`[FIRESTORE_GUARD] Đọc tài liệu "${tag}" đã bị chặn để bảo vệ hạn mức.`);
  }
  const snap = await getDoc(ref);
  recordFirestoreReads(tag, 1);
  return snap;
}

export function getFirestoreGuardStats(): FirestoreGuardStats {
  return {
    ...stats,
    byTag: { ...stats.byTag },
  };
}

export function resetFirestoreGuardStats(): void {
  queryTimestampsByTag.clear();
  docReadEvents.length = 0;
  stats.totalQueries = 0;
  stats.totalDocsRead = 0;
  stats.blockedCalls = 0;
  stats.tripped = false;
  stats.tripReason = null;
  stats.byTag = {};
  if (typeof document !== 'undefined') {
    document.getElementById('ums-firestore-guard-banner')?.remove();
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as { __FIRESTORE_STATS__?: () => FirestoreGuardStats }).__FIRESTORE_STATS__ =
    getFirestoreGuardStats;
}
