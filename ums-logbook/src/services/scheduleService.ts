/**
 * UMS Digital Class Logbook - Schedule & Timetable Service Layer
 * Supports Cloud Firestore with fallback to LocalStorage mock storage.
 * Provides 40-slot weekly schedule generation, teacher schedule aggregation,
 * and non-destructive auto-population for daily logbook periods.
 */

import {
  doc,
  setDoc,
  collection,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  ClassSchedule,
  ScheduleSlot,
  TeacherScheduleSlot,
  getDayOfWeekFromDate,
} from '../types/schedule';
import { PeriodEntry } from '../types/logbook';
import { createEmptyPeriodEntry } from './logbookService';
import { GVCN_USER_MAPPING, ALL_CLASSES } from './seedService';
import { logAuditEvent } from './auditService';
import { guardedGetDoc, guardedGetDocs, recordFirestoreReads } from '../utils/firestoreGuard';

export const MOCK_SCHEDULES_KEY = 'ums_schedules';
const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

// In-Memory Fast Cache for Instant Synchronous Resolution
const scheduleCache = new Map<string, ClassSchedule>();

const SCHEDULES_TTL_MS = 10 * 60_000;
let firestoreSchedulesCache: { ts: number; data: Record<string, ClassSchedule> } | null = null;
let inflightSchedulesPromise: Promise<Record<string, ClassSchedule>> | null = null;

/** Giữ TKB qua lần tải lại trang (cùng tab) — mỗi lần đọc cả trường = 52 lượt (sự cố quota 05/11/2026). */
const SCHEDULES_SESSION_KEY = 'ums_schedules_fs_v1';

function readSessionSchedules(): { ts: number; data: Record<string, ClassSchedule> } | null {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SCHEDULES_SESSION_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.ts === 'number' && parsed.data && Date.now() - parsed.ts < SCHEDULES_TTL_MS) return parsed;
  } catch {
    // sessionStorage hỏng/không truy cập được → đọc Firestore
  }
  return null;
}

async function fetchFirestoreSchedulesCached(): Promise<Record<string, ClassSchedule>> {
  if (firestoreSchedulesCache && Date.now() - firestoreSchedulesCache.ts < SCHEDULES_TTL_MS) {
    return firestoreSchedulesCache.data;
  }
  if (!isTestEnv) {
    const session = readSessionSchedules();
    if (session) {
      Object.entries(session.data).forEach(([id, s]) => scheduleCache.set(id, s));
      firestoreSchedulesCache = session;
      return session.data;
    }
  }
  if (inflightSchedulesPromise) {
    return inflightSchedulesPromise;
  }
  inflightSchedulesPromise = (async () => {
    try {
      const snap = await guardedGetDocs('schedules:all', collection(db, 'schedules'));
      const out: Record<string, ClassSchedule> = {};
      snap.forEach((d) => {
        if (!/^\d[A-Z]\d{1,2}$/.test(d.id)) return;
        const data = d.data() as ClassSchedule;
        out[d.id] = { ...data, classId: d.id };
        scheduleCache.set(d.id, out[d.id]);
      });
      firestoreSchedulesCache = { ts: Date.now(), data: out };
      try {
        if (!isTestEnv && typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(SCHEDULES_SESSION_KEY, JSON.stringify(firestoreSchedulesCache));
        }
      } catch {
        // Hết chỗ sessionStorage → chỉ giữ trong bộ nhớ
      }
      return out;
    } finally {
      inflightSchedulesPromise = null;
    }
  })();
  return inflightSchedulesPromise;
}

/**
 * Standard weekly subject matrix template across 5 days (Thứ 2 to Thứ 6)
 */
interface SlotTemplate {
  dayOfWeek: number;
  periodIndex: number;
  subject: string;
  defaultRoomType: 'class' | 'sports' | 'lab';
}

const WEEKLY_SLOT_TEMPLATES: SlotTemplate[] = [
  // Thứ 2 (Day 2)
  { dayOfWeek: 2, periodIndex: 1, subject: 'Hoạt động trải nghiệm', defaultRoomType: 'class' },
  { dayOfWeek: 2, periodIndex: 2, subject: 'Toán học', defaultRoomType: 'class' },
  { dayOfWeek: 2, periodIndex: 3, subject: 'Ngữ văn', defaultRoomType: 'class' },
  { dayOfWeek: 2, periodIndex: 4, subject: 'Tiếng Anh', defaultRoomType: 'class' },
  { dayOfWeek: 2, periodIndex: 5, subject: 'Khoa học tự nhiên', defaultRoomType: 'class' },
  { dayOfWeek: 2, periodIndex: 6, subject: 'Lịch sử và Địa lí', defaultRoomType: 'class' },
  { dayOfWeek: 2, periodIndex: 7, subject: 'Giáo dục thể chất', defaultRoomType: 'sports' },
  { dayOfWeek: 2, periodIndex: 8, subject: 'Tin học', defaultRoomType: 'lab' },

  // Thứ 3 (Day 3)
  { dayOfWeek: 3, periodIndex: 1, subject: 'Tiếng Anh', defaultRoomType: 'class' },
  { dayOfWeek: 3, periodIndex: 2, subject: 'Tiếng Anh', defaultRoomType: 'class' },
  { dayOfWeek: 3, periodIndex: 3, subject: 'Toán học', defaultRoomType: 'class' },
  { dayOfWeek: 3, periodIndex: 4, subject: 'Ngữ văn', defaultRoomType: 'class' },
  { dayOfWeek: 3, periodIndex: 5, subject: 'Khoa học tự nhiên', defaultRoomType: 'class' },
  { dayOfWeek: 3, periodIndex: 6, subject: 'Công nghệ', defaultRoomType: 'class' },
  { dayOfWeek: 3, periodIndex: 7, subject: 'Giáo dục công dân', defaultRoomType: 'class' },
  { dayOfWeek: 3, periodIndex: 8, subject: 'Nghệ thuật', defaultRoomType: 'class' },

  // Thứ 4 (Day 4)
  { dayOfWeek: 4, periodIndex: 1, subject: 'Ngữ văn', defaultRoomType: 'class' },
  { dayOfWeek: 4, periodIndex: 2, subject: 'Ngữ văn', defaultRoomType: 'class' },
  { dayOfWeek: 4, periodIndex: 3, subject: 'Toán học', defaultRoomType: 'class' },
  { dayOfWeek: 4, periodIndex: 4, subject: 'Tiếng Anh', defaultRoomType: 'class' },
  { dayOfWeek: 4, periodIndex: 5, subject: 'Hoạt động trải nghiệm', defaultRoomType: 'class' },
  { dayOfWeek: 4, periodIndex: 6, subject: 'Khoa học tự nhiên', defaultRoomType: 'class' },
  { dayOfWeek: 4, periodIndex: 7, subject: 'Lịch sử và Địa lí', defaultRoomType: 'class' },
  { dayOfWeek: 4, periodIndex: 8, subject: 'Giáo dục thể chất', defaultRoomType: 'sports' },

  // Thứ 5 (Day 5)
  { dayOfWeek: 5, periodIndex: 1, subject: 'Toán học', defaultRoomType: 'class' },
  { dayOfWeek: 5, periodIndex: 2, subject: 'Toán học', defaultRoomType: 'class' },
  { dayOfWeek: 5, periodIndex: 3, subject: 'Tiếng Anh', defaultRoomType: 'class' },
  { dayOfWeek: 5, periodIndex: 4, subject: 'Ngữ văn', defaultRoomType: 'class' },
  { dayOfWeek: 5, periodIndex: 5, subject: 'Khoa học tự nhiên', defaultRoomType: 'class' },
  { dayOfWeek: 5, periodIndex: 6, subject: 'Khoa học tự nhiên', defaultRoomType: 'class' },
  { dayOfWeek: 5, periodIndex: 7, subject: 'Tin học', defaultRoomType: 'lab' },
  { dayOfWeek: 5, periodIndex: 8, subject: 'Công nghệ', defaultRoomType: 'class' },

  // Thứ 6 (Day 6)
  { dayOfWeek: 6, periodIndex: 1, subject: 'Tiếng Anh', defaultRoomType: 'class' },
  { dayOfWeek: 6, periodIndex: 2, subject: 'Tiếng Anh', defaultRoomType: 'class' },
  { dayOfWeek: 6, periodIndex: 3, subject: 'Lịch sử và Địa lí', defaultRoomType: 'class' },
  { dayOfWeek: 6, periodIndex: 4, subject: 'Giáo dục công dân', defaultRoomType: 'class' },
  { dayOfWeek: 6, periodIndex: 5, subject: 'Nghệ thuật', defaultRoomType: 'class' },
  { dayOfWeek: 6, periodIndex: 6, subject: 'Giáo dục thể chất', defaultRoomType: 'sports' },
  { dayOfWeek: 6, periodIndex: 7, subject: 'Bổ trợ Tiếng Anh', defaultRoomType: 'class' },
  { dayOfWeek: 6, periodIndex: 8, subject: 'Hoạt động trải nghiệm', defaultRoomType: 'class' },
];

/**
 * Returns room label based on room type and class ID
 */
function resolveRoom(classId: string, roomType: 'class' | 'sports' | 'lab'): string {
  if (roomType === 'sports') return 'Sân thể thao';
  if (roomType === 'lab') return 'Phòng Tin học';
  return `P.${classId}`;
}

/**
 * Assigns realistic teachers for each subject in a given class
 */
function resolveSubjectTeacher(
  classId: string,
  subject: string,
  _periodIndex?: number,
  _dayOfWeek?: number
): { username: string; name: string } {
  const gvcn = GVCN_USER_MAPPING[classId] || { username: `gvcn_${classId}`, name: `GVCN ${classId}` };

  // Homeroom activity always handled by GVCN
  if (subject === 'Hoạt động trải nghiệm') {
    return { username: gvcn.username, name: gvcn.name };
  }

  // TPT manages physical education & sports
  if (subject === 'Giáo dục thể chất') {
    return { username: 'mrhoanglongums', name: 'Hoàng Long' };
  }

  // Informatics teacher
  if (subject === 'Tin học') {
    return { username: 'mshaiyen8a6ums', name: 'Lê Thị Khánh Châm' };
  }

  // 9A3 Specialization
  if (classId === '9A3') {
    if (subject === 'Toán học') return { username: 'mrlinhums', name: 'Nguyễn Mạnh Linh' };
    if (subject === 'Ngữ văn') return { username: 'msgiangums', name: 'Bùi Hoài Khánh Châm' };
    if (subject === 'Tiếng Anh' || subject === 'Bổ trợ Tiếng Anh') return { username: 'mrphuongums', name: 'Phạm Gia Ly' };
    if (subject === 'Khoa học tự nhiên') return { username: 'msmaiums', name: 'Phan Đức Tùng' };
    if (subject === 'Lịch sử và Địa lí') return { username: 'msbaoums', name: 'Trần Bảo Tuệ Hiếu' };
    if (subject === 'Giáo dục công dân') return { username: 'mrhoanggiangums', name: 'Hoàng Giang' };
    if (subject === 'Công nghệ') return { username: 'msngoclinhums', name: 'Hồ Thanh Quang Uyên' };
    if (subject === 'Nghệ thuật') return { username: 'msthuytrangums', name: 'Nguyễn Văn Hạnh' };
  }

  // 6A1 Specialization
  if (classId === '6A1') {
    if (subject === 'Tiếng Anh' || subject === 'Bổ trợ Tiếng Anh') return { username: 'msphuonganhums', name: 'Đinh Hoài Long' };
    if (subject === 'Toán học') return { username: 'mrlongums', name: 'Lý Trung Yến' };
    if (subject === 'Ngữ văn') return { username: 'msmaihuong6a2ums', name: 'Phạm Hà Ánh Định' };
    if (subject === 'Khoa học tự nhiên') return { username: 'mshuyenums', name: 'Hồ Gia Trâm' };
    if (subject === 'Lịch sử và Địa lí') return { username: 'msbaoums', name: 'Trần Bảo Tuệ Hiếu' };
    if (subject === 'Giáo dục công dân') return { username: 'mrhoanggiangums', name: 'Hoàng Giang' };
    if (subject === 'Công nghệ') return { username: 'msngaums', name: 'Đặng Bảo Giang' };
    if (subject === 'Nghệ thuật') return { username: 'msquynhtrangums', name: 'Bùi Đức An Xuân' };
  }

  // Grade-based distribution for all other classes
  const grade = parseInt(classId[0], 10);
  switch (grade) {
    case 6:
      if (subject === 'Toán học') return { username: 'mrlongums', name: 'Lý Trung Yến' };
      if (subject === 'Ngữ văn') return { username: 'msquynhtrangums', name: 'Bùi Đức An Xuân' };
      if (subject === 'Tiếng Anh' || subject === 'Bổ trợ Tiếng Anh') return { username: 'msphuonganh6a4ums', name: 'Trần Ngọc Đạt' };
      if (subject === 'Khoa học tự nhiên') return { username: 'msngaums', name: 'Đặng Bảo Giang' };
      if (subject === 'Lịch sử và Địa lí') return { username: 'msbaoums', name: 'Trần Bảo Tuệ Hiếu' };
      if (subject === 'Giáo dục công dân') return { username: 'mrhoanggiangums', name: 'Hoàng Giang' };
      if (subject === 'Công nghệ') return { username: 'mshuyenums', name: 'Hồ Gia Trâm' };
      if (subject === 'Nghệ thuật') return { username: 'mshienums', name: 'Nguyễn Minh Vy' };
      break;
    case 7:
      if (subject === 'Toán học') return { username: 'msquynhngaums', name: 'Lê Phương Quang Khoa' };
      if (subject === 'Ngữ văn') return { username: 'msthaoums', name: 'Phạm Hải Yến' };
      if (subject === 'Tiếng Anh' || subject === 'Bổ trợ Tiếng Anh') return { username: 'mrhuyums', name: 'Lâm Phương Quân' };
      if (subject === 'Khoa học tự nhiên') return { username: 'mrdatums', name: 'Đinh Trung Vy' };
      if (subject === 'Lịch sử và Địa lí') return { username: 'msbaoums', name: 'Trần Bảo Tuệ Hiếu' };
      if (subject === 'Giáo dục công dân') return { username: 'msthanhhuyenums', name: 'Nguyễn Phương Minh Hạnh' };
      if (subject === 'Công nghệ') return { username: 'mrdatums', name: 'Đinh Trung Vy' };
      if (subject === 'Nghệ thuật') return { username: 'msthuytrangums', name: 'Nguyễn Văn Hạnh' };
      break;
    case 8:
      if (subject === 'Toán học') return { username: 'mshuonglyums', name: 'Dương Trung Hoài Châm' };
      if (subject === 'Ngữ văn') return { username: 'mshongnhungums', name: 'Mai An Thanh Giang' };
      if (subject === 'Tiếng Anh' || subject === 'Bổ trợ Tiếng Anh') return { username: 'mshangums', name: 'Mai Quang Hưng' };
      if (subject === 'Khoa học tự nhiên') return { username: 'msngoclinhums', name: 'Hồ Thanh Quang Uyên' };
      if (subject === 'Lịch sử và Địa lí') return { username: 'mshueums', name: 'Bùi Bảo Cường' };
      if (subject === 'Giáo dục công dân') return { username: 'mrhoanggiangums', name: 'Hoàng Giang' };
      if (subject === 'Công nghệ') return { username: 'msngoclinhums', name: 'Hồ Thanh Quang Uyên' };
      if (subject === 'Nghệ thuật') return { username: 'mshongnhungums', name: 'Mai An Thanh Giang' };
      break;
    case 9:
    default:
      if (subject === 'Toán học') return { username: 'mshaiyen9a2ums', name: 'Lý Gia Đạt' };
      if (subject === 'Ngữ văn') return { username: 'msgiangums', name: 'Bùi Hoài Khánh Châm' };
      if (subject === 'Tiếng Anh' || subject === 'Bổ trợ Tiếng Anh') return { username: 'mrphuongums', name: 'Phạm Gia Ly' };
      if (subject === 'Khoa học tự nhiên') return { username: 'msmaiums', name: 'Phan Đức Tùng' };
      if (subject === 'Lịch sử và Địa lí') return { username: 'msbaoums', name: 'Trần Bảo Tuệ Hiếu' };
      if (subject === 'Giáo dục công dân') return { username: 'mrhoanggiangums', name: 'Hoàng Giang' };
      if (subject === 'Công nghệ') return { username: 'msmaiums', name: 'Phan Đức Tùng' };
      if (subject === 'Nghệ thuật') return { username: 'msthuytrangums', name: 'Nguyễn Văn Hạnh' };
      break;
  }

  return { username: gvcn.username, name: gvcn.name };
}

/**
 * Generates a full 40-slot weekly timetable for a given class
 */
export function generateDefaultClassSchedule(classId: string): ClassSchedule {
  const slots: ScheduleSlot[] = WEEKLY_SLOT_TEMPLATES.map((tmpl) => {
    const teacher = resolveSubjectTeacher(classId, tmpl.subject, tmpl.periodIndex, tmpl.dayOfWeek);
    return {
      dayOfWeek: tmpl.dayOfWeek,
      periodIndex: tmpl.periodIndex,
      subject: tmpl.subject,
      teacherUsername: teacher.username,
      teacherName: teacher.name,
      room: resolveRoom(classId, tmpl.defaultRoomType),
    };
  });

  return {
    classId,
    academicYear: '2026-2027',
    semester: 1,
    slots,
    updatedAt: Date.now(),
    updatedBy: 'system',
  };
}

/**
 * Returns mock schedules map from LocalStorage
 */
export function getMockSchedules(): Record<string, ClassSchedule> {
  try {
    const raw = localStorage.getItem(MOCK_SCHEDULES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves mock schedules map to LocalStorage
 */
export function saveMockSchedules(schedules: Record<string, ClassSchedule>): void {
  try {
    localStorage.setItem(MOCK_SCHEDULES_KEY, JSON.stringify(schedules));
  } catch (e) {
    console.error('Failed to save mock schedules to localStorage', e);
  }
}

/**
 * Notifies application of schedule changes
 */
export function notifyScheduleUpdate(classId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ums_schedule_update', {
        detail: { classId, timestamp: Date.now() },
      })
    );
  }
}

/**
 * Synchronously retrieves or generates a class schedule from memory cache or LocalStorage
 */
export function getCachedOrClassScheduleSync(classId: string): ClassSchedule {
  if (scheduleCache.has(classId)) {
    return scheduleCache.get(classId)!;
  }

  // Bản chạy thật: bỏ qua TKB lưu trong trình duyệt (có thể là TKB mẫu cũ)
  const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;
  const mock = isProd ? {} : getMockSchedules();
  if (mock[classId] && mock[classId].slots?.length > 0) {
    scheduleCache.set(classId, mock[classId]);
    return mock[classId];
  }

  // Bản chạy thật: KHÔNG sinh TKB mẫu (dữ liệu giả) — trả TKB rỗng cho tới khi tải được TKB thật
  if (isProd) {
    return { classId, academicYear: '', semester: 1, slots: [], updatedAt: 0 };
  }
  const generated = generateDefaultClassSchedule(classId);
  scheduleCache.set(classId, generated);
  mock[classId] = generated;
  saveMockSchedules(mock);
  return generated;
}

/**
 * Retrieves ClassSchedule (Cloud Firestore with LocalStorage mock fallback)
 */
export async function getClassSchedule(classId: string): Promise<ClassSchedule> {
  if (!isTestEnv) {
    if (firestoreSchedulesCache && Date.now() - firestoreSchedulesCache.ts < SCHEDULES_TTL_MS) {
      const cached = firestoreSchedulesCache.data[classId];
      if (cached) return cached;
    }
    try {
      const docRef = doc(db, 'schedules', classId);
      const snap = await guardedGetDoc('schedules:one', docRef);
      if (snap.exists()) {
        const schedule = snap.data() as ClassSchedule;
        scheduleCache.set(classId, schedule);
        if (firestoreSchedulesCache) {
          firestoreSchedulesCache.data[classId] = schedule;
        }
        return schedule;
      }
    } catch {}
  }

  return getCachedOrClassScheduleSync(classId);
}

/**
 * Saves or updates a ClassSchedule
 */
export async function saveClassSchedule(schedule: ClassSchedule): Promise<void> {
  if (!schedule.classId) {
    throw new Error('Mã lớp (classId) không được để trống');
  }

  const updated: ClassSchedule = {
    ...schedule,
    updatedAt: Date.now(),
  };

  if (!isTestEnv) {
    try {
      const docRef = doc(db, 'schedules', schedule.classId);
      await setDoc(docRef, updated);
    } catch (e) {
      // Không nuốt lỗi: người dùng phải biết TKB CHƯA được lưu
      throw new Error(`Không lưu được TKB lớp ${schedule.classId}: ${(e as Error).message}`);
    }
  }

  // Update in-memory cache
  scheduleCache.set(schedule.classId, updated);
  if (firestoreSchedulesCache) {
    firestoreSchedulesCache.data[schedule.classId] = updated;
  }

  // Update LocalStorage
  const mock = getMockSchedules();
  mock[schedule.classId] = updated;
  saveMockSchedules(mock);

  notifyScheduleUpdate(schedule.classId);

  await logAuditEvent({
    action: 'UPDATE',
    targetCollection: 'schedules',
    targetId: schedule.classId,
    afterState: schedule as unknown as Record<string, unknown>,
    details: `Cập nhật thời khóa biểu lớp ${schedule.classId} (${schedule.slots.length} tiết học).`,
  });
}

/**
 * Retrieves all class schedules across all 26 classes
 */
export async function getAllSchedules(): Promise<Record<string, ClassSchedule>> {
  const result: Record<string, ClassSchedule> = {};

  if (!isTestEnv) {
    try {
      const cached = await fetchFirestoreSchedulesCached();
      Object.assign(result, cached);
    } catch {}
  }

  // Bản chạy thật: chỉ TKB thật; lớp thiếu TKB thì để trống (không bù bằng dữ liệu giả)
  const mock = import.meta.env?.PROD ? {} : getMockSchedules();
  for (const cId of ALL_CLASSES) {
    if (!result[cId]) {
      result[cId] = (mock as Record<string, ClassSchedule>)[cId] || getCachedOrClassScheduleSync(cId);
    }
  }

  return result;
}

/**
 * Aggregates all schedule slots for a specific teacher across all classes
 * Augmented with `classId` and sorted by dayOfWeek ascending, periodIndex ascending.
 */
export async function getTeacherSchedule(teacherUsername: string): Promise<TeacherScheduleSlot[]> {
  const allSchedules = await getAllSchedules();
  const teacherSlots: TeacherScheduleSlot[] = [];

  for (const [classId, schedule] of Object.entries(allSchedules)) {
    if (!schedule.slots) continue;
    for (const slot of schedule.slots) {
      if (slot.teacherUsername === teacherUsername) {
        teacherSlots.push({
          ...slot,
          classId,
        });
      }
    }
  }

  return teacherSlots.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) {
      return a.dayOfWeek - b.dayOfWeek;
    }
    return a.periodIndex - b.periodIndex;
  });
}

/**
 * Checks whether an existing PeriodEntry has been manually edited or signed
 */
export function isPeriodManuallyModified(period: PeriodEntry): boolean {
  if (period.isSigned) return true;
  if (period.lessonTopic && period.lessonTopic.trim() !== '') return true;
  if (period.teacherComment && period.teacherComment.trim() !== '') return true;
  if (period.ppctLessonIndex !== undefined && period.ppctLessonIndex > 0) return true;
  if (period.scores && period.scores.total > 0) return true;
  if (period.absentStudents && period.absentStudents.length > 0) return true;
  if (period.earlyDepartures && period.earlyDepartures.length > 0) return true;
  return false;
}

/**
 * Auto-populates 8 periods for a class on a target date from weekly timetable.
 * Non-destructive: preserves all signed or manually edited periods.
 */
export function getAutoPopulatedPeriods(
  classId: string,
  date: string,
  existingPeriods: PeriodEntry[] = [],
  schedule?: ClassSchedule
): PeriodEntry[] {
  const dayOfWeek = getDayOfWeekFromDate(date);
  const activeSchedule = schedule || getCachedOrClassScheduleSync(classId);

  // Match 8 slots for the resolved day of week
  const daySlots = (activeSchedule.slots || []).filter((s) => s.dayOfWeek === dayOfWeek);
  const slotMap = new Map<number, ScheduleSlot>(daySlots.map((s) => [s.periodIndex, s]));

  const existingMap = new Map<number, PeriodEntry>(existingPeriods.map((p) => [p.periodIndex, p]));
  const dailyId = `${classId}_${date.includes('T') ? date.split('T')[0] : date}`;
  const now = Date.now();

  const full8: PeriodEntry[] = [];

  for (let pIndex = 1; pIndex <= 8; pIndex++) {
    const existing = existingMap.get(pIndex);
    const slot = slotMap.get(pIndex);

    // Guard: Preserve signed or edited periods
    if (existing && isPeriodManuallyModified(existing)) {
      full8.push(existing);
      continue;
    }

    // Populate empty period slot
    const base = existing || createEmptyPeriodEntry(dailyId, pIndex);
    full8.push({
      ...base,
      dailyId,
      periodIndex: pIndex,
      subject: slot ? slot.subject : base.subject,
      teacherId: slot ? slot.teacherUsername : base.teacherId,
      teacherName: slot ? slot.teacherName : base.teacherName,
      updatedAt: now,
    });
  }

  return full8.sort((a, b) => a.periodIndex - b.periodIndex);
}

/**
 * Subscribes to real-time updates for a ClassSchedule
 */
export function subscribeClassSchedule(
  classId: string,
  onUpdate: (schedule: ClassSchedule | null) => void
): Unsubscribe {
  if (!isTestEnv) {
    try {
      const docRef = doc(db, 'schedules', classId);
      return onSnapshot(docRef, (snapshot) => {
        recordFirestoreReads('schedules:listen', 1);
        if (snapshot.exists()) {
          const data = snapshot.data() as ClassSchedule;
          scheduleCache.set(classId, data);
          if (firestoreSchedulesCache) {
            firestoreSchedulesCache.data[classId] = data;
          }
          onUpdate(data);
        } else {
          onUpdate(null);
        }
      });
    } catch {}
  }

  const handleUpdate = (e: any) => {
    if (e.detail?.classId === classId || !e.detail) {
      onUpdate(getCachedOrClassScheduleSync(classId));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('ums_schedule_update', handleUpdate as EventListener);
  }

  onUpdate(getCachedOrClassScheduleSync(classId));

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ums_schedule_update', handleUpdate as EventListener);
    }
  };
}

/**
 * Returns list of classIds where a given teacher is assigned to teach (from TKB schedule data).
 * Matches by teacherName or teacherUsername.
 */
export function getTeacherAssignedClasses(teacherIdentifier: string): string[] {
  if (!teacherIdentifier) return [];
  const classes: Set<string> = new Set();
  const lowerIdent = teacherIdentifier.toLowerCase();

  for (const [classId, schedule] of scheduleCache.entries()) {
    if (!schedule.slots) continue;
    for (const slot of schedule.slots) {
      const nameMatch = slot.teacherName && slot.teacherName.toLowerCase() === lowerIdent;
      const usernameMatch = slot.teacherUsername && slot.teacherUsername.toLowerCase() === lowerIdent;
      // Also support partial matching for TKB teacher names like "Mr.Linh", "Ms Giang"
      const partialMatch = slot.teacherName && (
        slot.teacherName.toLowerCase().includes(lowerIdent) ||
        lowerIdent.includes(slot.teacherName.toLowerCase())
      );
      if (nameMatch || usernameMatch || partialMatch) {
        classes.add(classId);
        break;
      }
    }
  }
  return Array.from(classes).sort();
}

// Unified Service Object Export for flexible imports
export const scheduleService = {
  getClassSchedule,
  saveClassSchedule,
  getAllSchedules,
  getTeacherSchedule,
  generateDefaultClassSchedule,
  getAutoPopulatedPeriods,
  isPeriodManuallyModified,
  getCachedOrClassScheduleSync,
  subscribeClassSchedule,
  getMockSchedules,
  saveMockSchedules,
  getTeacherAssignedClasses,
};

/**
 * Đọc TKB THẬT của mọi lớp từ Firestore (chỉ doc mã lớp, vd. "6A1"). Lỗi → ném lỗi, KHÔNG dùng dữ liệu giả.
 * Dùng cho cập nhật TKB, tiết dạy của tôi, gắn GV.
 */
export async function fetchSchedulesStrict(): Promise<Record<string, ClassSchedule>> {
  return fetchFirestoreSchedulesCached();
}
