/**
 * Dashboard BGH & Xếp hạng Thi đua — đọc dữ liệu thật từ Firestore (chỉ BGH/nhân sự có quyền đọc).
 * Có bộ nhớ đệm ngắn hạn (TTL 2 phút) + gộp truy vấn đồng thời (promise deduplication)
 * để tránh việc mở trang Thi đua (/emulation) hoặc chuyển tab làm nhân đôi số lượt đọc N+1.
 */

import { collection, collectionGroup, doc, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DailyLogbook, PeriodEntry } from '../types/logbook';
import type { DashboardInput } from '../utils/dashboard';
import { slotPlanByClass } from '../utils/mixedPeriods';
import { fetchMixedRules } from './mixedPeriodService';
import { fetchSchedulesStrict } from './scheduleService';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';

export interface SharedSchoolRangeData {
  classDocs: Array<{ id: string; data: Record<string, any> }>;
  logbooks: DailyLogbook[];
  periodsByDaily: Record<string, PeriodEntry[]>;
  noteDocs: Array<{ id: string; data: Record<string, any> }>;
}

const CLASSES_TTL_MS = 10 * 60_000;
/** 10 phút: mỗi lần tải lại toàn trường ≈ 450–500 lượt đọc (sự cố hết quota 05/11/2026). */
const RANGE_TTL_MS = 10 * 60_000;

/** Firestore `in` tối đa 30 giá trị/truy vấn. */
export const PERIOD_QUERY_CHUNK = 30;

/** Chia danh sách mã sổ thành các lô ≤ size (bỏ trùng). */
export function chunkIds(ids: string[], size = PERIOD_QUERY_CHUNK): string[][] {
  const uniq = [...new Set(ids)];
  const out: string[][] = [];
  for (let i = 0; i < uniq.length; i += size) out.push(uniq.slice(i, i + size));
  return out;
}

let classesCache: { ts: number; docs: Array<{ id: string; data: Record<string, any> }> } | null = null;
const rangeCache = new Map<string, { ts: number; data: SharedSchoolRangeData }>();
const inflightRangePromises = new Map<string, Promise<SharedSchoolRangeData>>();
/** Sổ ngày vừa sửa trên máy này → chỉ đọc lại đúng sổ đó, không tải lại cả trường. */
const dirtyDailyIds = new Set<string>();

if (typeof window !== 'undefined') {
  window.addEventListener('ums_logbook_update', (e: Event) => {
    const dailyId = (e as CustomEvent<{ dailyId?: string }>).detail?.dailyId;
    if (dailyId) dirtyDailyIds.add(dailyId);
    else rangeCache.clear();
  });
  window.addEventListener('ums_behavior_update', () => rangeCache.clear());
}

export function _resetDashboardCacheForTest(): void {
  classesCache = null;
  rangeCache.clear();
  inflightRangePromises.clear();
  dirtyDailyIds.clear();
}

/** Đọc lại sổ ngày + tiết của các sổ vừa sửa, vá vào bản đệm (≤ 9 lượt đọc/sổ thay vì ~500). */
async function patchDirtyLogbooks(start: string, end: string, data: SharedSchoolRangeData): Promise<SharedSchoolRangeData> {
  const ids = [...dirtyDailyIds].filter((id) => {
    const date = id.split('_').slice(1).join('_');
    return date >= start && date <= end;
  });
  if (!ids.length) return data;
  const logbooks = [...data.logbooks];
  const periodsByDaily = { ...data.periodsByDaily };
  await Promise.all(
    ids.map(async (id) => {
      const [bookSnap, ps] = await Promise.all([
        guardedGetDoc('daily_logbooks:range_patch', doc(db, 'daily_logbooks', id)),
        guardedGetDocs('daily_logbooks:range_patch_periods', query(collection(db, 'daily_logbooks', id, 'periods'), limit(8))),
      ]);
      const idx = logbooks.findIndex((b) => b.id === id);
      if (bookSnap.exists()) {
        const book = { id, ...(bookSnap.data() as any) } as DailyLogbook;
        if (idx >= 0) logbooks[idx] = book;
        else logbooks.push(book);
      }
      periodsByDaily[id] = ps.docs.map((d) => d.data() as PeriodEntry);
    })
  );
  return { ...data, logbooks, periodsByDaily };
}

async function fetchClassesCached(): Promise<Array<{ id: string; data: Record<string, any> }>> {
  if (classesCache && Date.now() - classesCache.ts < CLASSES_TTL_MS) {
    return classesCache.docs;
  }
  const snap = await guardedGetDocs('classes:all', collection(db, 'classes'));
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }));
  classesCache = { ts: Date.now(), docs };
  return docs;
}

/** Tên GVCN thật của lớp, lấy từ Firestore `classes/{id}.gvcnName` (dùng chung cache 26 lớp ở trên). */
export async function fetchClassGvcnName(classId: string): Promise<string> {
  const docs = await fetchClassesCached();
  const d = docs.find((x) => x.id === classId)?.data;
  return String(d?.gvcnName || d?.homeroomTeacherName || '').trim();
}

export async function fetchSharedSchoolRangeData(start: string, end: string): Promise<SharedSchoolRangeData> {
  const key = `${start}__${end}`;
  const cached = rangeCache.get(key);
  if (cached && Date.now() - cached.ts < RANGE_TTL_MS) {
    if (!dirtyDailyIds.size) return cached.data;
    const patched = await patchDirtyLogbooks(start, end, cached.data);
    rangeCache.set(key, { ts: cached.ts, data: patched });
    // Các bản đệm khoảng ngày khác vẫn có thể chứa sổ cũ → bỏ đi (tải lại khi cần)
    for (const k of [...rangeCache.keys()]) if (k !== key) rangeCache.delete(k);
    dirtyDailyIds.clear();
    return patched;
  }
  const inflight = inflightRangePromises.get(key);
  if (inflight) {
    return inflight;
  }

  const p = (async (): Promise<SharedSchoolRangeData> => {
    try {
      const [classDocs, bookSnap, noteSnap] = await Promise.all([
        fetchClassesCached(),
        guardedGetDocs(
          'daily_logbooks:range',
          query(
            collection(db, 'daily_logbooks'),
            where('date', '>=', start),
            where('date', '<=', end),
            limit(800)
          )
        ),
        guardedGetDocs(
          'behavior_notes:range',
          query(
            collection(db, 'behavior_notes'),
            where('date', '>=', start),
            where('date', '<=', end),
            limit(1000)
          )
        ),
      ]);

      const logbooks = bookSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as DailyLogbook));
      // Tiết của mọi sổ trong khoảng: truy vấn collectionGroup theo lô 30 mã sổ (dailyId in [...]).
      // Trước đây mỗi sổ 1 truy vấn (N+1): 1 tuần ≈ 130 truy vấn → vượt ngưỡng 40/phút, trang Xếp hạng/Dashboard bị chặn.
      // Nay 1 tuần ≈ 5 truy vấn, 1 tháng ≈ 20; số tài liệu đọc giữ nguyên. Cần index collection-group `periods.dailyId`.
      const periodsByDaily: Record<string, PeriodEntry[]> = Object.fromEntries(logbooks.map((b) => [b.id, [] as PeriodEntry[]]));
      for (const ids of chunkIds(logbooks.map((b) => b.id), PERIOD_QUERY_CHUNK)) {
        const ps = await guardedGetDocs(
          'daily_logbooks:range_periods',
          query(collectionGroup(db, 'periods'), where('dailyId', 'in', ids), limit(ids.length * 8))
        );
        for (const d of ps.docs) {
          const entry = d.data() as PeriodEntry;
          const dailyId = entry.dailyId || d.ref?.parent?.parent?.id || '';
          if (periodsByDaily[dailyId]) periodsByDaily[dailyId].push(entry);
        }
      }

      const result: SharedSchoolRangeData = {
        classDocs,
        logbooks,
        periodsByDaily,
        noteDocs: noteSnap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> })),
      };
      rangeCache.set(key, { ts: Date.now(), data: result });
      return result;
    } finally {
      inflightRangePromises.delete(key);
    }
  })();

  inflightRangePromises.set(key, p);
  return p;
}

export async function fetchDashboardInput(start: string, end: string, holidays: string[]): Promise<DashboardInput> {
  const [shared, schedules, mixedRules] = await Promise.all([
    fetchSharedSchoolRangeData(start, end),
    fetchSchedulesStrict().catch(() => ({})),
    fetchMixedRules(),
  ]);

  const classIds = shared.classDocs
    .filter((d) => d.data.active !== false)
    .map((d) => d.id)
    .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));

  return {
    start,
    end,
    holidays,
    classIds,
    logbooks: shared.logbooks,
    periodsByDaily: shared.periodsByDaily,
    slotPlans: slotPlanByClass(schedules, mixedRules),
    notes: shared.noteDocs.map((d) => ({
      classId: d.data.classId,
      type: d.data.type,
      date: d.data.date,
    })),
  };
}
