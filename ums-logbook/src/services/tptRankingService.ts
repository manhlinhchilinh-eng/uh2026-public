/**
 * Xếp hạng thi đua (quy chế TPT 05/11): dữ liệu đầu vào + điểm sổ cờ đỏ do TPT nhập.
 * - Sổ đầu bài: dùng chung bộ nhớ đệm khoảng ngày với Dashboard (fetchSharedSchoolRangeData) — không đọc thêm.
 * - TKB, lịch nghỉ: đã cache. Không listener, không polling.
 * - Cờ đỏ: /red_flag_weekly/{weekStart}_{classId} — đọc 1 truy vấn theo các tuần đang xem (≤ 6 tuần × 26 lớp).
 */

import { collection, doc, limit, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import { guardedGetDocs } from '../utils/firestoreGuard';
import { fetchSharedSchoolRangeData } from './dashboardService';
import { fetchSchedulesStrict } from './scheduleService';
import { fetchSchoolCalendar } from './schoolCalendarService';
import { offDatesBetween } from '../utils/schoolCalendar';
import { weekStartOf, type RedFlagClassDay, type RedFlagDaily, type RedFlagWeekly, type SdbInput } from '../utils/tptRanking';

const COL = 'red_flag_weekly';

export async function fetchTptRankingInput(start: string, end: string): Promise<Omit<SdbInput, 'isPeriodOver'>> {
  const [shared, schedules, calendar] = await Promise.all([
    fetchSharedSchoolRangeData(start, end),
    fetchSchedulesStrict().catch(() => ({})),
    fetchSchoolCalendar(),
  ]);
  const classIds = shared.classDocs
    .filter((d) => d.data.active !== false)
    .map((d) => d.id)
    .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  return {
    start,
    end,
    holidays: offDatesBetween(calendar, start, end),
    classIds,
    schedules,
    periodsByDaily: shared.periodsByDaily,
  };
}

/** Điểm cờ đỏ của các tuần (mã tuần = Thứ Hai). Firestore `in` tối đa 10 giá trị. */
export async function fetchRedFlags(weekStarts: string[]): Promise<RedFlagWeekly[]> {
  const weeks = [...new Set(weekStarts)].slice(0, 10);
  if (weeks.length === 0) return [];
  const snap = await guardedGetDocs('red_flag_weekly:range', query(collection(db, COL), where('weekStart', 'in', weeks)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<RedFlagWeekly, 'id'>), id: d.id }));
}

/** TPT/BGH lưu điểm cờ đỏ 1 tuần cho nhiều lớp (1 lần ghi theo lô). */
export async function saveRedFlags(
  weekStart: string,
  rows: Array<{ classId: string; score: number; note?: string }>,
  maxScore: number,
  by: Pick<UserProfile, 'uid' | 'displayName' | 'username'>
): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();
  for (const r of rows) {
    const data: Omit<RedFlagWeekly, 'id'> = {
      weekStart,
      classId: r.classId,
      score: r.score,
      maxScore,
      note: (r.note || '').slice(0, 300),
      updatedBy: by.uid,
      updatedByName: by.displayName || by.username,
      updatedAt: now,
    };
    batch.set(doc(db, COL, `${weekStart}_${r.classId}`), data);
  }
  await batch.commit();
}

const DAILY = 'red_flag_daily';

/** Sổ cờ đỏ theo ngày của các tuần đang xem: 1 doc/ngày (≤ 5 doc/tuần, ≤ 30 doc/tháng). */
export async function fetchRedFlagDaily(weekStarts: string[]): Promise<RedFlagDaily[]> {
  const weeks = [...new Set(weekStarts)].slice(0, 10);
  if (weeks.length === 0) return [];
  const snap = await guardedGetDocs('red_flag_daily:range', query(collection(db, DAILY), where('weekStart', 'in', weeks), limit(70)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<RedFlagDaily, 'id'>), id: d.id }));
}

/** TPT/BGH nhập sổ cờ đỏ từ file Excel: ghi đè từng ngày có trong file (1 doc/ngày, 1 lần ghi theo lô). */
export async function saveRedFlagDaily(
  byDate: Record<string, Record<string, RedFlagClassDay>>,
  by: Pick<UserProfile, 'uid' | 'displayName' | 'username'>
): Promise<number> {
  const dates = Object.keys(byDate).sort();
  const batch = writeBatch(db);
  const now = Date.now();
  for (const date of dates) {
    const data: Omit<RedFlagDaily, 'id'> = {
      date,
      weekStart: weekStartOf(date),
      classes: byDate[date],
      updatedBy: by.uid,
      updatedByName: by.displayName || by.username,
      updatedAt: now,
    };
    batch.set(doc(db, DAILY, date), data);
  }
  await batch.commit();
  return dates.length;
}
