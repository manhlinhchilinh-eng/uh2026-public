/**
 * Đồng bộ bản tin chuyên cần từng HS (/student_daily) từ Sổ đầu bài — phục vụ Cổng phụ huynh.
 */

import { collection, doc, limit, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DailyLogbook, PeriodEntry } from '../types/logbook';
import { computeStudentDaily, studentDailyId, type StudentDaily } from '../utils/studentDaily';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';

const COL = 'student_daily';

/**
 * Bản tin đã ghi của mỗi sổ ngày trong phiên này (mhs → JSON đã ghi).
 * Lần lưu đầu tiên của 1 sổ ngày mới query bản tin cũ; các lần sau dùng bộ nhớ → không đọc lại
 * cả lớp mỗi lần lưu tiết (sự cố hết 50k lượt đọc 05/11/2026), và chỉ ghi HS có thay đổi.
 * Rủi ro chấp nhận: 2 máy cùng sửa 1 sổ ngày → máy này có thể sót xóa bản tin cũ do máy kia ghi;
 * BGH "Đồng bộ lại" (resyncAllStudentDaily) luôn query đầy đủ nên sửa được.
 */
const writtenByDaily = new Map<string, Map<string, string>>();

export function _resetStudentDailyCacheForTest(): void {
  writtenByDaily.clear();
}

/**
 * Tính lại bản tin của mọi HS trong 1 sổ ngày; xóa bản tin cũ không còn đúng.
 * Cho phép truyền sẵn `preloadedLogbook` và `preloadedPeriods` để tránh đọc lặp lại từ Firestore.
 */
export async function syncStudentDaily(
  dailyId: string,
  preloadedLogbook?: Partial<DailyLogbook> | null,
  preloadedPeriods?: PeriodEntry[],
  opts: { fullCheck?: boolean } = {}
): Promise<number> {
  let lb: any = preloadedLogbook;
  if (!lb) {
    const snap = await guardedGetDoc('student_daily:read_logbook', doc(db, 'daily_logbooks', dailyId));
    if (!snap.exists()) return 0;
    lb = snap.data() as any;
  }

  const classId: string = lb.classId || dailyId.split('_')[0];
  const date: string = lb.date || dailyId.split('_').slice(1).join('_');

  const periods: PeriodEntry[] =
    preloadedPeriods ??
    (await guardedGetDocs('student_daily:read_periods', collection(db, 'daily_logbooks', dailyId, 'periods'))).docs.map(
      (d) => d.data() as PeriodEntry
    );

  const fresh = computeStudentDaily(classId, date, lb, periods);

  let written = opts.fullCheck ? undefined : writtenByDaily.get(dailyId);
  if (!written) {
    const existing = await guardedGetDocs(
      'student_daily:existing',
      query(collection(db, COL), where('classId', '==', classId), where('date', '==', date), limit(100))
    );
    written = new Map(existing.docs.map((d) => {
      const s = d.data() as StudentDaily;
      return [s.mhs, JSON.stringify(s)] as const;
    }));
  }

  const toDelete = [...written.keys()].filter((mhs) => !fresh[mhs]);
  const toSet = Object.values(fresh).filter((s) => written!.get(s.mhs) !== JSON.stringify(s));

  if (toDelete.length || toSet.length) {
    const batch = writeBatch(db);
    for (const mhs of toDelete) batch.delete(doc(db, COL, studentDailyId(mhs, date)));
    for (const s of toSet) batch.set(doc(db, COL, studentDailyId(s.mhs, s.date)), s);
    await batch.commit();
  }
  writtenByDaily.set(dailyId, new Map(Object.values(fresh).map((s) => [s.mhs, JSON.stringify(s)] as const)));
  return Object.keys(fresh).length;
}

/** Gọi sau khi lưu sổ: lỗi đồng bộ KHÔNG được làm hỏng việc ghi sổ. */
export async function syncStudentDailySafe(
  dailyId: string,
  preloadedLogbook?: Partial<DailyLogbook> | null,
  preloadedPeriods?: PeriodEntry[]
): Promise<void> {
  try {
    await syncStudentDaily(dailyId, preloadedLogbook, preloadedPeriods);
  } catch (e) {
    console.warn('[studentDaily] sync failed (sổ đầu bài vẫn đã lưu):', e);
  }
}

/**
 * BGH: đồng bộ lại dữ liệu chuyên cần trong khoảng ngày (mặc định 30 ngày gần nhất để tránh quét toàn bộ lịch sử).
 */
export async function resyncAllStudentDaily(
  onProgress?: (done: number, total: number) => void,
  range?: { startDate?: string; endDate?: string }
): Promise<{ logbooks: number; records: number }> {
  const todayIso = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const start = range?.startDate || thirtyDaysAgoIso;
  const end = range?.endDate || todayIso;

  const books = await guardedGetDocs(
    'student_daily:resync_books',
    query(
      collection(db, 'daily_logbooks'),
      where('date', '>=', start),
      where('date', '<=', end),
      limit(800)
    )
  );
  let records = 0;
  let done = 0;
  for (const b of books.docs) {
    records += await syncStudentDaily(b.id, b.data() as DailyLogbook, undefined, { fullCheck: true });
    onProgress?.(++done, books.size);
  }
  return { logbooks: books.size, records };
}

export async function fetchStudentDaily(mhs: string, max = 90): Promise<StudentDaily[]> {
  const snap = await guardedGetDocs(
    'student_daily:by_mhs',
    query(collection(db, COL), where('mhs', '==', mhs), limit(max))
  );
  return snap.docs.map((d) => d.data() as StudentDaily).sort((a, b) => b.date.localeCompare(a.date));
}
