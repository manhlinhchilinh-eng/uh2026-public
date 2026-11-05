/**
 * Bảng "Vắng/muộn hôm nay" toàn trường (giám thị, BGH, TPT).
 * Đọc 1 lần khi mở / bấm Làm mới — không giữ kết nối đọc liên tục:
 *  - sổ ngày của mọi lớp trong ngày (≤ 60 doc, có tóm tắt `periodAttendance`)
 *  - bản tin từng HS vắng/muộn/về sớm trong ngày (/student_daily, ≤ 500 doc)
 */

import { collection, doc, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';
import type { BoardLogbook } from '../utils/periodAttendance';
import type { StudentDaily } from '../utils/studentDaily';
import { generateDailyId, getMockDailyLogbooks } from './logbookService';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

export const BOARD_LOGBOOK_LIMIT = 60;
export const BOARD_STUDENT_LIMIT = 500;

export interface SchoolAttendanceData {
  logbooks: BoardLogbook[];
  students: StudentDaily[];
  /** true khi chạm giới hạn đọc — có thể thiếu dữ liệu */
  truncated: boolean;
}

export async function fetchSchoolAttendance(date: string): Promise<SchoolAttendanceData> {
  if (isTestEnv) {
    const logbooks = getMockDailyLogbooks().filter((b) => b.date === date);
    return { logbooks, students: [], truncated: false };
  }
  const [books, students] = await Promise.all([
    guardedGetDocs(
      'attendance_board:logbooks',
      query(collection(db, 'daily_logbooks'), where('date', '==', date), limit(BOARD_LOGBOOK_LIMIT))
    ),
    guardedGetDocs(
      'attendance_board:students',
      query(collection(db, 'student_daily'), where('date', '==', date), limit(BOARD_STUDENT_LIMIT))
    ),
  ]);
  return {
    logbooks: books.docs.map((d) => {
      const data = d.data() as BoardLogbook;
      return { ...data, classId: data.classId || d.id.split('_')[0] };
    }),
    students: students.docs.map((d) => d.data() as StudentDaily),
    truncated: books.size >= BOARD_LOGBOOK_LIMIT || students.size >= BOARD_STUDENT_LIMIT,
  };
}

/* ---------------- Cache RAM dùng chung (trang Vắng/muộn + Trợ lý UMS+) ---------------- */

export const ATTENDANCE_CACHE_MS = 5 * 60_000;

type CachedAttendance = SchoolAttendanceData & { loadedAt: number };
const attendanceCache = new Map<string, CachedAttendance>();
const attendanceInflight = new Map<string, Promise<CachedAttendance>>();

/**
 * Như `fetchSchoolAttendance` nhưng giữ kết quả trong RAM theo ngày 5 phút; các nơi gọi cùng lúc dùng chung 1 lượt đọc.
 * `force` bỏ qua cache (nút Làm mới). Lỗi không được cache.
 */
export async function fetchSchoolAttendanceCached(
  date: string,
  opts: { force?: boolean; now?: number } = {}
): Promise<CachedAttendance> {
  const now = opts.now ?? Date.now();
  const hit = attendanceCache.get(date);
  if (!opts.force && hit && now - hit.loadedAt < ATTENDANCE_CACHE_MS) return hit;
  const pending = attendanceInflight.get(date);
  if (!opts.force && pending) return pending;
  const p = fetchSchoolAttendance(date)
    .then((data) => {
      const entry = { ...data, loadedAt: now };
      attendanceCache.set(date, entry);
      return entry;
    })
    .finally(() => {
      if (attendanceInflight.get(date) === p) attendanceInflight.delete(date);
    });
  attendanceInflight.set(date, p);
  return p;
}

/* ---------------- 1 lớp (GVCN hỏi Trợ lý UMS+) ---------------- */

export const CLASS_STUDENT_LIMIT = 60;

/**
 * Điểm danh 1 lớp trong ngày cho GVCN: 1 doc sổ ngày + bản tin HS của lớp (≤ 60 doc).
 * Không dùng bản toàn trường (~80 lượt/lần) — 30 GVCN hỏi sẽ tốn ~2.400 lượt.
 */
export async function fetchClassAttendanceUncached(classId: string, date: string): Promise<SchoolAttendanceData> {
  const [book, students] = await Promise.all([
    guardedGetDoc('attendance_class:logbook', doc(db, 'daily_logbooks', generateDailyId(classId, date))),
    guardedGetDocs(
      'attendance_class:students',
      query(
        collection(db, 'student_daily'),
        where('classId', '==', classId),
        where('date', '==', date),
        limit(CLASS_STUDENT_LIMIT)
      )
    ),
  ]);
  const logbooks: BoardLogbook[] = book.exists() ? [{ ...(book.data() as BoardLogbook), classId }] : [];
  return {
    logbooks,
    students: students.docs.map((d) => d.data() as StudentDaily),
    truncated: students.size >= CLASS_STUDENT_LIMIT,
  };
}

/** Như `fetchClassAttendanceUncached`, giữ RAM 5 phút theo `${classId}|${date}`; gọi đồng thời dùng chung 1 lượt. Lỗi không cache. */
export async function fetchClassAttendance(
  classId: string,
  date: string,
  opts: { force?: boolean; now?: number } = {}
): Promise<CachedAttendance> {
  const key = `${classId}|${date}`;
  const now = opts.now ?? Date.now();
  const hit = attendanceCache.get(key);
  if (!opts.force && hit && now - hit.loadedAt < ATTENDANCE_CACHE_MS) return hit;
  const pending = attendanceInflight.get(key);
  if (!opts.force && pending) return pending;
  const p = fetchClassAttendanceUncached(classId, date)
    .then((data) => {
      const entry = { ...data, loadedAt: now };
      attendanceCache.set(key, entry);
      return entry;
    })
    .finally(() => {
      if (attendanceInflight.get(key) === p) attendanceInflight.delete(key);
    });
  attendanceInflight.set(key, p);
  return p;
}

/** Chỉ dùng cho test. */
export function resetSchoolAttendanceCache(): void {
  attendanceCache.clear();
  attendanceInflight.clear();
}
