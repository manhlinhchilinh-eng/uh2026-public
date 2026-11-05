/**
 * UMS Digital Class Logbook - Core Logbook Service Layer
 * Supports Cloud Firestore with fallback to LocalStorage mock storage.
 */
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  DailyLogbook,
  PeriodEntry,
  PeriodScore,
  DailyAttendanceBaseline,
  ScoringValidationResult,
  DailyScoreSummary,
  LogbookStatus,
} from '../types/logbook';
import { ScoringConfigDoc } from '../types';
import { logAuditEvent } from './auditService';
import { syncStudentDailySafe } from './studentDailyService';
import { academicYearOf, semesterOf, weekNumberOf } from '../utils/academicCalendar';
import { dayOfWeekOf } from '../utils/teacherAssignment';
import { guardedGetDoc, guardedGetDocs, recordFirestoreReads } from '../utils/firestoreGuard';
import { isAttendanceTaken, summarizePeriodAttendance } from '../utils/periodAttendance';
export { ALL_CLASSES } from './seedService';

export const SCORING_LIMITS = {
  learning: 4.0,
  discipline: 3.0,
  hygiene: 2.0,
  customCriterion: 1.0,
  maxTotal: 10.0,
};

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

// LocalStorage Keys
export const MOCK_DAILY_LOGBOOKS_KEY = 'ums_daily_logbooks';
export const getMockPeriodKey = (dailyId: string) => `ums_period_entries_${dailyId}`;

/**
 * Generates canonical dailyId: `${classId}_${date}`
 */
/** Bỏ các trường undefined (Firestore không nhận undefined). */
export function withoutUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function generateDailyId(classId: string, date: string): string {
  return `${classId.trim()}_${date.trim()}`;
}

/**
 * Creates an empty baseline structure
 */
export function createEmptyBaseline(
  reportedBy = '',
  session: 'morning' | 'afternoon' = 'morning'
): DailyAttendanceBaseline {
  return {
    reportedBy,
    reportedAt: Date.now(),
    session,
    absences: [],
    earlyDepartures: [],
    notes: '',
  };
}

/**
 * Creates a blank PeriodEntry template (1 to 8)
 */
export function createEmptyPeriodEntry(dailyId: string, periodIndex: number): PeriodEntry {
  return {
    id: `${periodIndex}`,
    dailyId,
    periodIndex,
    subject: '',
    ppctLessonIndex: undefined,
    lessonTopic: '',
    teacherId: '',
    teacherName: '',
    absentStudents: [],
    earlyDepartures: [],
    scores: {
      learning: 0,
      discipline: 0,
      hygiene: 0,
      customCriterion: 0,
      total: 0,
    },
    teacherComment: '',
    teacherSignature: '',
    isSigned: false,
    signedAt: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Creates a blank DailyLogbook document template
 */
export function createEmptyDailyLogbook(
  classId: string,
  date: string,
  gvcnId = '',
  weekNumber = weekNumberOf(date)
): DailyLogbook {
  const dailyId = generateDailyId(classId, date);
  const baseline = createEmptyBaseline(gvcnId, 'morning');
  const afternoon = createEmptyBaseline(gvcnId, 'afternoon');

  return {
    id: dailyId,
    classId,
    date,
    dayOfWeek: dayOfWeekOf(date),
    academicYear: academicYearOf(date),
    semester: semesterOf(date),
    weekNumber,
    morningBaseline: baseline,
    afternoonBaseline: afternoon,
    preSessionAttendance: baseline,
    totalPeriods: 8,
    status: 'draft',
    isCompleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Validates Period 4-criteria scores
 */
export function validatePeriodScore(
  scores: Partial<PeriodScore>,
  config?: ScoringConfigDoc
): ScoringValidationResult {
  const errors: Record<string, string> = {};
  const learningMax = config?.criteria.find((c) => c.id === 'learning')?.maxPoints ?? SCORING_LIMITS.learning;
  const disciplineMax = config?.criteria.find((c) => c.id === 'discipline')?.maxPoints ?? SCORING_LIMITS.discipline;
  const hygieneMax = config?.criteria.find((c) => c.id === 'hygiene')?.maxPoints ?? SCORING_LIMITS.hygiene;
  const customMax = config?.criteria.find((c) => c.id === 'customCriterion')?.maxPoints ?? SCORING_LIMITS.customCriterion;

  const rawLearning = Number(scores.learning ?? 0);
  const rawDiscipline = Number(scores.discipline ?? 0);
  const rawHygiene = Number(scores.hygiene ?? 0);
  const rawCustom = Number(scores.customCriterion ?? 0);

  if (rawLearning < 0 || rawLearning > learningMax) {
    errors.learning = `Điểm học tập phải từ 0 đến ${learningMax}`;
  }
  if (rawDiscipline < 0 || rawDiscipline > disciplineMax) {
    errors.discipline = `Điểm kỷ luật phải từ 0 đến ${disciplineMax}`;
  }
  if (rawHygiene < 0 || rawHygiene > hygieneMax) {
    errors.hygiene = `Điểm vệ sinh/ý thức phải từ 0 đến ${hygieneMax}`;
  }
  if (rawCustom < 0 || rawCustom > customMax) {
    errors.customCriterion = `Tiêu chí khác phải từ 0 đến ${customMax}`;
  }

  const learning = Math.max(0, Math.min(learningMax, rawLearning));
  const discipline = Math.max(0, Math.min(disciplineMax, rawDiscipline));
  const hygiene = Math.max(0, Math.min(hygieneMax, rawHygiene));
  const custom = Math.max(0, Math.min(customMax, rawCustom));

  const rawSum = learning + discipline + hygiene + custom;
  const total = Math.round(rawSum * 100) / 100;

  if (total > SCORING_LIMITS.maxTotal) {
    errors.total = `Tổng điểm không được vượt quá ${SCORING_LIMITS.maxTotal}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    total,
    normalizedScores: {
      learning,
      discipline,
      hygiene,
      customCriterion: custom,
      total,
    },
  };
}

/**
 * Mock Storage Helpers & Reactive Event Notifier
 */
export function notifyMockStorageUpdate(dailyId: string, periodIndex?: number, action = 'update') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ums_logbook_update', {
        detail: { dailyId, periodIndex, action, timestamp: Date.now() },
      })
    );
  }
}

export function getMockDailyLogbooks(): DailyLogbook[] {
  try {
    const raw = localStorage.getItem(MOCK_DAILY_LOGBOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMockDailyLogbooks(books: DailyLogbook[]) {
  try {
    localStorage.setItem(MOCK_DAILY_LOGBOOKS_KEY, JSON.stringify(books));
  } catch (e) {
    console.error('Failed to save mock logbooks', e);
  }
}

export function getMockPeriodEntries(dailyId: string): PeriodEntry[] {
  try {
    const raw = localStorage.getItem(getMockPeriodKey(dailyId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveMockPeriodEntries(dailyId: string, entries: PeriodEntry[]) {
  try {
    localStorage.setItem(getMockPeriodKey(dailyId), JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to save mock period entries', e);
  }
}

/**
 * Retrieves or creates DailyLogbook parent document.
 * Mặc định `createIfMissing = false` trên Firestore để việc chỉ mở xem sổ không tự động tạo hàng loạt doc `draft` rỗng.
 */
export async function getOrCreateDailyLogbook(
  classId: string,
  date: string,
  gvcnId = '',
  weekNumber = weekNumberOf(date),
  /** false = chỉ đọc: chưa có sổ thì trả sổ rỗng trên bộ nhớ, không ghi Firestore cho tới khi lưu tiết/điểm danh */
  createIfMissing = false
): Promise<DailyLogbook> {
  const dailyId = generateDailyId(classId, date);

  if (!isTestEnv) {
    try {
      const docRef = doc(db, 'daily_logbooks', dailyId);
      const snapshot = await guardedGetDoc('daily_logbooks:get', docRef);
      if (snapshot.exists()) {
        const data = snapshot.data() as DailyLogbook;
        return {
          ...data,
          morningBaseline: data.morningBaseline || data.preSessionAttendance || createEmptyBaseline(gvcnId, 'morning'),
          afternoonBaseline: data.afternoonBaseline || createEmptyBaseline(gvcnId, 'afternoon'),
          preSessionAttendance: data.morningBaseline || data.preSessionAttendance || createEmptyBaseline(gvcnId, 'morning'),
        };
      }

      const newBook = createEmptyDailyLogbook(classId, date, gvcnId, weekNumber);
      if (!createIfMissing) return newBook;
      await setDoc(docRef, newBook);
      return newBook;
    } catch (e: any) {
      console.error('[logbookService] Firestore getOrCreateDailyLogbook failed:', e);
      // Fall through to localStorage only as read-only cache fallback
    }
  }

  // LocalStorage Fallback (read-only cache for offline/error recovery)
  const list = getMockDailyLogbooks();
  const existing = list.find((b) => b.id === dailyId);
  if (existing) {
    return {
      ...existing,
      morningBaseline: existing.morningBaseline || existing.preSessionAttendance || createEmptyBaseline(gvcnId, 'morning'),
      afternoonBaseline: existing.afternoonBaseline || createEmptyBaseline(gvcnId, 'afternoon'),
      preSessionAttendance: existing.morningBaseline || existing.preSessionAttendance || createEmptyBaseline(gvcnId, 'morning'),
    };
  }

  const created = createEmptyDailyLogbook(classId, date, gvcnId, weekNumber);
  list.push(created);
  saveMockDailyLogbooks(list);
  notifyMockStorageUpdate(dailyId);
  return created;
}

/**
 * Retrieves all 8 period entries for a dailyId (fills missing slots with defaults)
 */
export async function getPeriodEntries(dailyId: string): Promise<PeriodEntry[]> {
  if (!isTestEnv) {
    try {
      const colRef = collection(db, 'daily_logbooks', dailyId, 'periods');
      const q = query(colRef, orderBy('periodIndex', 'asc'), limit(8));
      const snapshot = await guardedGetDocs('daily_logbooks:periods', q);
      const entriesMap = new Map<number, PeriodEntry>();
      snapshot.forEach((d) => {
        const entry = d.data() as PeriodEntry;
        entriesMap.set(entry.periodIndex, entry);
      });

      const full8: PeriodEntry[] = [];
      for (let i = 1; i <= 8; i++) {
        full8.push(entriesMap.get(i) || createEmptyPeriodEntry(dailyId, i));
      }
      return full8;
    } catch (e: any) {
      console.error('[logbookService] Firestore getPeriodEntries failed:', e);
      // Fall through to localStorage cache
    }
  }

  // LocalStorage Fallback
  const entries = getMockPeriodEntries(dailyId);
  const map = new Map<number, PeriodEntry>(entries.map((e) => [e.periodIndex, e]));
  const full: PeriodEntry[] = [];
  for (let i = 1; i <= 8; i++) {
    full.push(map.get(i) || createEmptyPeriodEntry(dailyId, i));
  }
  return full;
}

/**
 * Updates GVCN Morning or Afternoon Attendance Baseline
 */
export async function updateAttendanceBaseline(
  dailyId: string,
  session: 'morning' | 'afternoon',
  baseline: DailyAttendanceBaseline
): Promise<void> {
  const now = Date.now();
  const updatePayload: any = {
    updatedAt: now,
  };

  if (session === 'morning') {
    updatePayload.morningBaseline = baseline;
    updatePayload.preSessionAttendance = baseline; // Backwards compat
  } else {
    updatePayload.afternoonBaseline = baseline;
  }

  const parts = dailyId.split('_');
  const classId = parts[0] || '6A1';
  const date = parts.slice(1).join('_') || new Date().toISOString().split('T')[0];

  if (!isTestEnv) {
    try {
      const docRef = doc(db, 'daily_logbooks', dailyId);
      try {
        await updateDoc(docRef, updatePayload);
      } catch {
        // Doc chưa được tạo trên Firestore → khởi tạo lần đầu kèm điểm danh
        const created = { ...createEmptyDailyLogbook(classId, date), ...updatePayload };
        await setDoc(docRef, created);
      }

      // Cache to localStorage on success
      const list = getMockDailyLogbooks();
      let index = list.findIndex((b) => b.id === dailyId);
      if (index === -1) {
        const created = createEmptyDailyLogbook(classId, date);
        list.push(created);
        index = list.length - 1;
      }
      list[index] = { ...list[index], ...updatePayload };
      saveMockDailyLogbooks(list);
      // Cổng phụ huynh: tách chuyên cần từng HS (không chặn việc ghi sổ)
      await syncStudentDailySafe(dailyId, list[index]);
    } catch (e: any) {
      console.error('[logbookService] Firestore updateAttendanceBaseline failed:', e);
      throw new Error(`Không thể lưu điểm danh. Vui lòng kiểm tra kết nối: ${e.message || e}`);
    }
  } else {
    // Test env: localStorage only
    const list = getMockDailyLogbooks();
    let index = list.findIndex((b) => b.id === dailyId);
    if (index === -1) {
      const created = createEmptyDailyLogbook(classId, date);
      list.push(created);
      index = list.length - 1;
    }
    list[index] = { ...list[index], ...updatePayload };
    saveMockDailyLogbooks(list);
  }
  notifyMockStorageUpdate(dailyId, undefined, 'baseline_updated');

  // AUDIT LOGGING HOOK:
  await logAuditEvent({
    action: 'UPDATE',
    targetCollection: 'daily_logbooks',
    targetId: dailyId,
    beforeState: null,
    afterState: { session, baseline },
    details: `Cập nhật điểm danh đầu giờ buổi ${session === 'morning' ? 'sáng' : 'chiều'}: ${baseline.absences.length} vắng, ${baseline.earlyDepartures.length} về sớm.`,
  });
}

/**
 * Saves or updates a PeriodEntry document in `/daily_logbooks/{dailyId}/periods/{periodIndex}`
 */
export async function savePeriodEntry(
  dailyId: string,
  periodIndex: number,
  entryData: Partial<PeriodEntry>,
  autoSign = false,
  existingEntriesHint?: PeriodEntry[]
): Promise<PeriodEntry> {
  if (periodIndex < 1 || periodIndex > 8) {
    throw new Error('Tiết học phải từ 1 đến 8');
  }

  const existingEntries = existingEntriesHint && existingEntriesHint.length === 8
    ? existingEntriesHint
    : await getPeriodEntries(dailyId);
  const current = existingEntries.find((e) => e.periodIndex === periodIndex) || createEmptyPeriodEntry(dailyId, periodIndex);

  const scores = entryData.scores || current.scores;
  const validation = validatePeriodScore(scores);
  if (!validation.isValid) {
    throw new Error(`Điểm không hợp lệ: ${Object.values(validation.errors).join(', ')}`);
  }

  const now = Date.now();
  const isSigned = autoSign ? true : (entryData.isSigned ?? current.isSigned);
  const teacherSignature = autoSign
    ? (entryData.teacherSignature || entryData.teacherName || current.teacherName)
    : (entryData.teacherSignature ?? current.teacherSignature);

  const idParts = dailyId.split('_');
  // Lớp & thứ luôn suy từ dailyId (`<lớp>_<ngày>`) — Firestore rules cũng suy như vậy và từ chối nếu lệch.
  const parsedClassId = idParts[0] || entryData.classId || current.classId || '';
  const parsedDate = idParts.slice(1).join('_');
  const parsedDow = parsedDate ? dayOfWeekOf(parsedDate) : (entryData.dayOfWeek ?? current.dayOfWeek);

  const updatedEntry: PeriodEntry = {
    ...current,
    ...entryData,
    id: `${periodIndex}`,
    dailyId,
    classId: parsedClassId || undefined,
    dayOfWeek: parsedDow,
    periodIndex,
    scores: validation.normalizedScores,
    isSigned,
    teacherSignature,
    signedAt: isSigned ? (current.signedAt || now) : undefined,
    updatedAt: now,
  };

  const mergedPeriods = existingEntries.map((e) => (e.periodIndex === periodIndex ? updatedEntry : e));

  if (!isTestEnv) {
    try {
      const periodDocRef = doc(db, 'daily_logbooks', dailyId, 'periods', `${periodIndex}`);
      await setDoc(periodDocRef, withoutUndefined(updatedEntry));
      // Tiết ESL: ghi/xóa bản ghi gọn cho dashboard ESL (không chặn việc ghi sổ)
      if (updatedEntry.esl || current.esl) {
        const { syncEslPeriodRecord } = await import('./eslService');
        await syncEslPeriodRecord({ ...updatedEntry, dailyId }, !!current.esl);
      }

      // Check if daily logbook status should transition to completed (reusing mergedPeriods in RAM)
      await checkAndRefreshLogbookStatus(dailyId, mergedPeriods);
      // Bảng Vắng/muộn hôm nay: tóm tắt gọn trên sổ ngày (không chặn việc ghi sổ)
      await syncPeriodAttendanceSummarySafe(dailyId, updatedEntry);

      // Cache to localStorage on Firestore success
      const stored = getMockPeriodEntries(dailyId);
      const filtered = stored.filter((e) => e.periodIndex !== periodIndex);
      filtered.push(updatedEntry);
      filtered.sort((a, b) => a.periodIndex - b.periodIndex);
      saveMockPeriodEntries(dailyId, filtered);
      // Cổng phụ huynh: tách chuyên cần từng HS (truyền sẵn mergedPeriods để tránh gọi lại getDocs(periods))
      await syncStudentDailySafe(dailyId, null, mergedPeriods);
    } catch (e: any) {
      console.error('[logbookService] Firestore savePeriodEntry failed:', e);
      throw new Error(`Không thể lưu dữ liệu. Vui lòng kiểm tra kết nối: ${e.message || e}`);
    }
  } else {
    // Test env: localStorage only
    const stored = getMockPeriodEntries(dailyId);
    const filtered = stored.filter((e) => e.periodIndex !== periodIndex);
    filtered.push(updatedEntry);
    filtered.sort((a, b) => a.periodIndex - b.periodIndex);
    saveMockPeriodEntries(dailyId, filtered);
    await checkAndRefreshLogbookStatus(dailyId);
    await syncPeriodAttendanceSummarySafe(dailyId, updatedEntry);
  }

  notifyMockStorageUpdate(dailyId, periodIndex, 'period_saved');

  // AUDIT LOGGING HOOK:
  const isNew = !current || !current.subject;
  await logAuditEvent({
    action: isNew ? 'CREATE' : 'UPDATE',
    targetCollection: 'periods',
    targetId: `${dailyId}_p${periodIndex}`,
    beforeState: current as unknown as Record<string, unknown>,
    afterState: updatedEntry as unknown as Record<string, unknown>,
    details: `Lưu sổ đầu bài tiết ${periodIndex} môn ${updatedEntry.subject} (${updatedEntry.isSigned ? 'Đã ký: ' + updatedEntry.teacherSignature : 'Chưa ký'}) - Điểm: ${updatedEntry.scores.total}`,
  });

  return updatedEntry;
}

/**
 * Ghi `periodAttendance.{tiết}` lên sổ ngày khi tiết đã điểm danh.
 * Lỗi (VD rules cũ chưa cho GVBM ghi trường này) KHÔNG được làm hỏng việc ghi sổ.
 */
export async function syncPeriodAttendanceSummarySafe(dailyId: string, entry: PeriodEntry): Promise<void> {
  if (!isAttendanceTaken(entry)) return;
  const summary = summarizePeriodAttendance(entry);
  const key = String(entry.periodIndex);
  try {
    if (!isTestEnv) {
      await updateDoc(doc(db, 'daily_logbooks', dailyId), { [`periodAttendance.${key}`]: summary });
      return;
    }
    const list = getMockDailyLogbooks();
    const idx = list.findIndex((b) => b.id === dailyId);
    if (idx === -1) return;
    list[idx] = { ...list[idx], periodAttendance: { ...(list[idx].periodAttendance || {}), [key]: summary } };
    saveMockDailyLogbooks(list);
  } catch (e) {
    console.warn('[logbookService] periodAttendance sync failed (sổ đầu bài vẫn đã lưu):', e);
  }
}

/**
 * Checks if all 8 periods are signed, updating parent status.
 * Nếu sổ ngày chưa được tạo trên Firestore, tự động khởi tạo khi lưu tiết đầu tiên.
 */
export async function checkAndRefreshLogbookStatus(
  dailyId: string,
  preloadedPeriods?: PeriodEntry[]
): Promise<void> {
  const periods = preloadedPeriods ?? (await getPeriodEntries(dailyId));
  const signedCount = periods.filter((p) => p.isSigned).length;
  const isCompleted = signedCount === 8;
  const status: LogbookStatus = isCompleted ? 'completed' : signedCount > 0 ? 'in_progress' : 'draft';

  const update = { status, isCompleted, updatedAt: Date.now() };
  const parts = dailyId.split('_');
  const classId = parts[0] || '6A1';
  const date = parts.slice(1).join('_') || new Date().toISOString().split('T')[0];

  if (!isTestEnv) {
    try {
      await updateDoc(doc(db, 'daily_logbooks', dailyId), update);
      return;
    } catch {
      try {
        await setDoc(doc(db, 'daily_logbooks', dailyId), {
          ...createEmptyDailyLogbook(classId, date),
          ...update,
        });
        return;
      } catch {}
    }
  }

  const list = getMockDailyLogbooks();
  let idx = list.findIndex((b) => b.id === dailyId);
  if (idx === -1) {
    list.push(createEmptyDailyLogbook(classId, date));
    idx = list.length - 1;
  }
  list[idx] = { ...list[idx], ...update };
  saveMockDailyLogbooks(list);
}

/**
 * Real-time Subscription to Parent Daily Logbook Document
 */
export function subscribeDailyLogbook(
  dailyId: string,
  onUpdate: (logbook: DailyLogbook | null) => void
): Unsubscribe {
  if (!isTestEnv) {
    try {
      const docRef = doc(db, 'daily_logbooks', dailyId);
      return onSnapshot(docRef, (snapshot) => {
        recordFirestoreReads('daily_logbooks:listen', 1);
        if (snapshot.exists()) {
          const data = snapshot.data() as DailyLogbook;
          onUpdate({
            ...data,
            morningBaseline: data.morningBaseline || data.preSessionAttendance,
            afternoonBaseline: data.afternoonBaseline,
            preSessionAttendance: data.morningBaseline || data.preSessionAttendance,
          });
        } else {
          onUpdate(null);
        }
      });
    } catch {}
  }

  // LocalStorage / Mock Event Bus
  const handleUpdate = (e: any) => {
    if (e.detail?.dailyId === dailyId || !e.detail) {
      const list = getMockDailyLogbooks();
      const found = list.find((b) => b.id === dailyId) || null;
      onUpdate(found);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === MOCK_DAILY_LOGBOOKS_KEY) {
      const list = getMockDailyLogbooks();
      onUpdate(list.find((b) => b.id === dailyId) || null);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('ums_logbook_update', handleUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
  }

  // Initial call
  const list = getMockDailyLogbooks();
  onUpdate(list.find((b) => b.id === dailyId) || null);

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ums_logbook_update', handleUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    }
  };
}

/**
 * Real-time Subscription to Periods Subcollection
 */
export function subscribePeriodEntries(
  dailyId: string,
  onUpdate: (periods: PeriodEntry[]) => void
): Unsubscribe {
  if (!isTestEnv) {
    try {
      const colRef = collection(db, 'daily_logbooks', dailyId, 'periods');
      const q = query(colRef, orderBy('periodIndex', 'asc'), limit(8));
      return onSnapshot(q, (snapshot) => {
        recordFirestoreReads('daily_logbooks:periods_listen', Math.max(1, snapshot.docChanges().length));
        const map = new Map<number, PeriodEntry>();
        snapshot.forEach((d) => {
          const entry = d.data() as PeriodEntry;
          map.set(entry.periodIndex, entry);
        });
        const full: PeriodEntry[] = [];
        for (let i = 1; i <= 8; i++) {
          full.push(map.get(i) || createEmptyPeriodEntry(dailyId, i));
        }
        onUpdate(full);
      });
    } catch {}
  }

  // LocalStorage / Mock Event Bus
  const handleUpdate = (e: any) => {
    if (e.detail?.dailyId === dailyId || !e.detail) {
      getPeriodEntries(dailyId).then(onUpdate);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === getMockPeriodKey(dailyId)) {
      getPeriodEntries(dailyId).then(onUpdate);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('ums_logbook_update', handleUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
  }

  // Initial call
  const entries = getMockPeriodEntries(dailyId);
  const map = new Map<number, PeriodEntry>(entries.map((e) => [e.periodIndex, e]));
  const full: PeriodEntry[] = [];
  for (let i = 1; i <= 8; i++) {
    full.push(map.get(i) || createEmptyPeriodEntry(dailyId, i));
  }
  onUpdate(full);

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ums_logbook_update', handleUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    }
  };
}

/**
 * Calculates daily score and attendance summary
 */
export function calculateDailyScoreSummary(
  logbook: DailyLogbook,
  periods: PeriodEntry[]
): DailyScoreSummary {
  const signedPeriods = periods.filter((p) => p.isSigned);
  const signedCount = signedPeriods.length;

  let sumLearning = 0;
  let sumDiscipline = 0;
  let sumHygiene = 0;
  let sumCustom = 0;
  let sumTotal = 0;

  for (const p of signedPeriods) {
    sumLearning += p.scores.learning;
    sumDiscipline += p.scores.discipline;
    sumHygiene += p.scores.hygiene;
    sumCustom += p.scores.customCriterion;
    sumTotal += p.scores.total;
  }

  // Aggregate baseline absences + period absences
  const allAbsences = [
    ...(logbook.morningBaseline?.absences || []),
    ...(logbook.afternoonBaseline?.absences || []),
  ];

  const pCount = allAbsences.filter((a) => a.type === 'P').length;
  const kCount = allAbsences.filter((a) => a.type === 'K').length;
  const lateCount = allAbsences.filter((a) => a.type === 'Late').length;
  const earlyCount = (logbook.morningBaseline?.earlyDepartures?.length || 0) +
                     (logbook.afternoonBaseline?.earlyDepartures?.length || 0);

  return {
    dailyId: logbook.id,
    classId: logbook.classId,
    date: logbook.date,
    totalPeriodsSigned: signedCount,
    totalPeriodsCount: 8,
    averageLearning: signedCount ? Math.round((sumLearning / signedCount) * 10) / 10 : 0,
    averageDiscipline: signedCount ? Math.round((sumDiscipline / signedCount) * 10) / 10 : 0,
    averageHygiene: signedCount ? Math.round((sumHygiene / signedCount) * 10) / 10 : 0,
    averageCustom: signedCount ? Math.round((sumCustom / signedCount) * 10) / 10 : 0,
    totalDailyScore: signedCount ? Math.round(sumTotal * 10) / 10 : 0,
    totalAbsenceCount: pCount + kCount,
    excusedCountP: pCount,
    unexcusedCountK: kCount,
    lateCount,
    earlyDepartureCount: earlyCount,
  };
}
