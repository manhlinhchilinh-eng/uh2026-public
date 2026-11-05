/**
 * UMS Digital Class Logbook - Automated Summaries & Emulation Persistence Service
 * Milestone 5: Dual-Mode Firestore + LocalStorage Summary Service
 * Path: src/services/summaryService.ts
 */

import {
  doc,
  setDoc,
  collection,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  WeeklySummary,
  MonthlySummary,
  UnsignedPeriodInfo,
  StudentAbsenceSummaryItem,
  WeeklyAttendanceStats,
  WeeklyCriteriaAverages,
  MonthlyAttendanceTotals,
  MonthlyCriteriaAverages,
} from '../types/summary';
import { DailyLogbook, PeriodEntry } from '../types/logbook';
import { BehaviorNote } from '../types/behavior';
import { calculateEmulationScore, ClassMetadataInfo } from '../utils/emulation';
import { ALL_CLASSES } from './seedService';
import { currentAcademic, weekDates as academicWeekDates, weeksInMonth } from '../utils/academicCalendar';
import { fetchSharedSchoolRangeData } from './dashboardService';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';

export const MOCK_WEEKLY_SUMMARIES_KEY = 'ums_weekly_summaries';
export const MOCK_MONTHLY_SUMMARIES_KEY = 'ums_monthly_summaries';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/**
 * Returns canonical start (Monday) and end (Friday) dates for academic week
 * Standard baseline: Week 1 begins on Monday, September 7, 2026.
 */
export function getWeekDatesForAcademicYear(
  weekNumber: number,
  academicYear = currentAcademic().academicYear
): { startDate: string; endDate: string; weekDates: string[] } {
  // Tuần 1 = thứ Hai đầu tiên từ 01/09 (utils/academicCalendar)
  const days = academicWeekDates(weekNumber, academicYear);
  if (days.length) return { startDate: days[0], endDate: days[4], weekDates: days };
  const baseYear = parseInt(academicYear.split('-')[0], 10) || 2026;
  const startMonday = new Date(baseYear, 8, 7);
  const offsetDays = (weekNumber - 1) * 7;
  const monday = new Date(startMonday.getTime() + offsetDays * 86400000);

  const weekDates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday.getTime() + i * 86400000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    weekDates.push(`${y}-${m}-${day}`);
  }

  return {
    startDate: weekDates[0],
    endDate: weekDates[4],
    weekDates,
  };
}

/**
 * Generates canonical document IDs
 */
export function generateWeeklySummaryId(classId: string, weekNumber: number): string {
  return `${classId}_W${weekNumber}`;
}

export function generateMonthlySummaryId(
  classId: string,
  month: number,
  year: number
): string {
  return `${classId}_M${month}_${year}`;
}

/**
 * Event bus notifier for cross-component and cross-tab reactive updates
 */
export function notifySummaryUpdate(detail: {
  type: 'weekly' | 'monthly';
  classId: string;
  weekNumber?: number;
  month?: number;
  year?: number;
  id: string;
}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ums_summary_update', {
        detail: { ...detail, timestamp: Date.now() },
      })
    );
  }
}

/** Tiết đã có người ghi gì đó (môn, GV, tên bài, chữ ký) */
function entryTouched(entry: PeriodEntry): boolean {
  return Boolean(entry.isSigned || entry.subject || entry.teacherName || entry.teacherId || entry.lessonTopic);
}

/** Thứ theo quy ước app (2 = Thứ Hai … 8 = CN), tính theo lịch, không lệch múi giờ */
function dowOfIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 8 : wd + 1;
}

/**
 * Pure aggregation function: computes full WeeklySummary from raw daily logbooks & period records.
 */
export function calculateWeeklySummary(
  classId: string,
  weekNumber: number,
  dailyLogbooks: DailyLogbook[],
  periods: Record<string, PeriodEntry[]> | PeriodEntry[],
  options?: {
    academicYear?: string;
    startDate?: string;
    endDate?: string;
    gvcnWeeklyNote?: string;
    expectedPeriods?: number;
    /** TKB của lớp: tiết có trên TKB mà chưa có bản ghi cũng bị liệt kê "chưa ký" (trước đây bị bỏ sót). */
    tkbSlots?: Array<{ dayOfWeek: number; periodIndex: number; subject: string; teacherName?: string }>;
    /** Chỉ xét các ngày <= hôm nay (yyyy-mm-dd) */
    today?: string;
    /** Ngày nghỉ (lễ/BGH khai) — không đòi ký */
    isOffDate?: (date: string) => boolean;
    /** Hôm nay: tiết đã kết thúc theo giờ chuông chưa (tiết chưa học không đòi ký). Mặc định: đã kết thúc. */
    isPeriodOver?: (date: string, periodIndex: number) => boolean;
    /** Tiết lớp trộn (không chấm/không ký) — không đòi ký */
    isMixedSlot?: (subject: string) => boolean;
    /** Tiết mặc định 10đ (danh sách chung DEFAULT_MIXED_RULES, kiểu 'auto10'): chưa ký vẫn tính 10đ */
    isDefault10Slot?: (subject: string) => boolean;
  }
): WeeklySummary {
  const academicYear = options?.academicYear || '2026-2027';
  const range = getWeekDatesForAcademicYear(weekNumber, academicYear);
  const startDate = options?.startDate || range.startDate;
  const endDate = options?.endDate || range.endDate;
  const totalPeriodsExpected = options?.expectedPeriods ?? 40;

  // Normalize periods into Map<dailyId, PeriodEntry[]>
  const periodsByDailyId = new Map<string, PeriodEntry[]>();
  if (Array.isArray(periods)) {
    for (const p of periods) {
      const dId = p.dailyId || `${classId}_${startDate}`;
      if (!periodsByDailyId.has(dId)) {
        periodsByDailyId.set(dId, []);
      }
      periodsByDailyId.get(dId)!.push(p);
    }
  } else {
    for (const [k, v] of Object.entries(periods)) {
      periodsByDailyId.set(k, v);
    }
  }

  let totalPeriodsTaught = 0;
  let totalPeriodsSigned = 0;
  let sumLearning = 0;
  let sumDiscipline = 0;
  let sumHygiene = 0;
  let sumCustom = 0;
  let sumTotal = 0;
  let totalExcused = 0;
  let totalUnexcused = 0;
  let totalLate = 0;
  let totalEarlyDepartures = 0;

  const unsignedPeriods: UnsignedPeriodInfo[] = [];
  let defaultScoredPeriods = 0;
  const defaultScored: Array<{ date: string; periodIndex: number; subject: string }> = [];
  const studentAbsenceSummary: Record<string, StudentAbsenceSummaryItem> = {};
  const teacherRemarksSummary: string[] = [];

  // Iterate across each day of the week (5 days, Mon to Fri)
  for (const date of range.weekDates) {
    const dailyId = `${classId}_${date}`;
    const logbook = dailyLogbooks.find((b) => b.id === dailyId || b.date === date);

    if (logbook) {
      if (logbook.preSessionAttendance?.earlyDepartures) {
        totalEarlyDepartures += logbook.preSessionAttendance.earlyDepartures.length;
      }
      if (logbook.afternoonBaseline?.earlyDepartures) {
        totalEarlyDepartures += logbook.afternoonBaseline.earlyDepartures.length;
      }
    }

    // Get period entries for this day
    let dayPeriods = periodsByDailyId.get(dailyId) || [];
    // Also check if logbook object itself has periods map
    if (dayPeriods.length === 0 && logbook && (logbook as any).periods) {
      const lbPeriods = (logbook as any).periods;
      dayPeriods = Array.isArray(lbPeriods) ? lbPeriods : Object.values(lbPeriods);
    }

    const dueDay =
      !!options?.tkbSlots && (!options.today || date <= options.today) && !options.isOffDate?.(date);
    const dow = dowOfIso(date);

    for (let pIdx = 1; pIdx <= 8; pIdx++) {
      const entry = dayPeriods.find((p) => p.periodIndex === pIdx);
      // Tiết mặc định 10đ (NN2, Native, Eng 1 K9, test prep Văn/Toán K9): đã học mà chưa ký → tính 10đ, không đòi ký.
      const tkbSlot = dueDay ? options!.tkbSlots!.find((s) => s.dayOfWeek === dow && s.periodIndex === pIdx) : undefined;
      const autoHere =
        !!tkbSlot?.subject && !!options?.isDefault10Slot?.(tkbSlot.subject) && (options?.isPeriodOver?.(date, pIdx) ?? true);
      if (autoHere && !entry?.isSigned) {
        defaultScoredPeriods++;
        defaultScored.push({ date, periodIndex: pIdx, subject: tkbSlot!.subject });
        if (!entry) continue;
      }
      if (!entry || !entryTouched(entry)) {
        const slot = tkbSlot;
        if (
          !autoHere &&
          slot &&
          slot.subject &&
          !options?.isMixedSlot?.(slot.subject) &&
          (options?.isPeriodOver?.(date, pIdx) ?? true)
        ) {
          unsignedPeriods.push({
            date,
            periodIndex: pIdx,
            subject: slot.subject,
            teacherName: slot.teacherName || 'Chưa phân công',
            notStarted: true,
          });
        }
        if (!entry) continue;
      }

      const isTaught = Boolean(
        entry.isSigned ||
          entry.subject ||
          entry.teacherName ||
          entry.teacherId ||
          entry.lessonTopic
      );

      if (isTaught) {
        totalPeriodsTaught++;
      }

      if (entry.isSigned) {
        totalPeriodsSigned++;
        sumLearning += entry.scores?.learning || 0;
        sumDiscipline += entry.scores?.discipline || 0;
        sumHygiene += entry.scores?.hygiene || 0;
        sumCustom += entry.scores?.customCriterion || 0;
        sumTotal += entry.scores?.total || 0;

        if (entry.teacherComment && entry.teacherComment.trim()) {
          teacherRemarksSummary.push(
            `[${date} T${pIdx} - ${entry.subject || 'Môn học'}]: ${entry.teacherComment.trim()}`
          );
        }
      } else if (isTaught && !autoHere) {
        unsignedPeriods.push({
          date,
          periodIndex: pIdx,
          subject: entry.subject || 'Chưa phân công',
          teacherName: entry.teacherName || entry.teacherId || 'Chưa ký',
          teacherId: entry.teacherId,
        });
      }

      // Tally absences recorded in this period
      if (entry.absentStudents && Array.isArray(entry.absentStudents)) {
        for (const abs of entry.absentStudents) {
          if (abs.type === 'P') totalExcused++;
          else if (abs.type === 'K') totalUnexcused++;
          else if (abs.type === 'Late') totalLate++;

          const sId = abs.studentId;
          if (!studentAbsenceSummary[sId]) {
            studentAbsenceSummary[sId] = {
              name: abs.studentName || `Học sinh ${sId}`,
              P: 0,
              K: 0,
              Late: 0,
              earlyDepartures: 0,
            };
          }
          if (abs.type === 'P') studentAbsenceSummary[sId].P++;
          else if (abs.type === 'K') studentAbsenceSummary[sId].K++;
          else if (abs.type === 'Late') studentAbsenceSummary[sId].Late++;
        }
      }

      // Early departures in period
      if (entry.earlyDepartures && Array.isArray(entry.earlyDepartures)) {
        totalEarlyDepartures += entry.earlyDepartures.length;
      }
    }
  }

  // Calculate averages (rounded to 2 decimal places)
  const completed = totalPeriodsSigned;
  const learning = completed > 0 ? Math.round((sumLearning / completed) * 100) / 100 : 0;
  const discipline = completed > 0 ? Math.round((sumDiscipline / completed) * 100) / 100 : 0;
  const hygiene = completed > 0 ? Math.round((sumHygiene / completed) * 100) / 100 : 0;
  const customCriterion = completed > 0 ? Math.round((sumCustom / completed) * 100) / 100 : 0;
  // Điểm TB tổng có cả tiết mặc định 10đ (như xếp hạng TPT, Dashboard BGH); 4 tiêu chí con chỉ tính tiết GV đã chấm.
  const scoredAll = completed + defaultScoredPeriods;
  const totalAverage = scoredAll > 0 ? Math.round(((sumTotal + 10 * defaultScoredPeriods) / scoredAll) * 100) / 100 : 0;

  const attendanceStats: WeeklyAttendanceStats = {
    totalExcused,
    totalUnexcused,
    totalLate,
    studentAbsenceSummary,
    totalEarlyDepartures,
  };

  const criteriaAverages: WeeklyCriteriaAverages = {
    learning,
    discipline,
    hygiene,
    customCriterion,
    totalAverage,
  };

  // Compute emulation score (tiết chưa mở theo TKB chỉ cảnh báo, không trừ điểm — giữ cách tính thi đua cũ)
  const penalizedUnsigned = unsignedPeriods.filter((p) => !p.notStarted).length;
  const scoreResult = calculateEmulationScore({
    periodAverage: totalAverage,
    periodsTaught: totalPeriodsSigned + defaultScoredPeriods,
    unexcusedK: totalUnexcused,
    excusedP: totalExcused,
    late: totalLate,
    unsignedCount: penalizedUnsigned,
  });

  const weeklySummary: WeeklySummary = {
    id: generateWeeklySummaryId(classId, weekNumber),
    classId,
    academicYear,
    weekNumber,
    startDate,
    endDate,
    totalPeriodsExpected,
    totalPeriodsTaught,
    totalPeriodsSigned,
    unsignedPeriods,
    defaultScoredPeriods: defaultScored,
    attendanceStats,
    criteriaAverages,
    teacherRemarksSummary,
    gvcnWeeklyNote: options?.gvcnWeeklyNote || '',
    emulationScore: scoreResult.totalScore,
    updatedAt: Date.now(),

    // Backwards-compatibility aliases
    totalPeriods: totalPeriodsExpected,
    completedPeriods: totalPeriodsSigned,
    totalScore: Math.round(sumTotal * 100) / 100,
    averageScore: totalAverage,
    attendanceTotals: {
      excused: totalExcused,
      unexcused: totalUnexcused,
      late: totalLate,
      earlyLeave: totalEarlyDepartures,
      earlyDepartures: totalEarlyDepartures,
    },
    unsignedPeriodsCount: unsignedPeriods.length,
    criteriaAverage: {
      learningAvg: learning,
      disciplineAvg: discipline,
      hygieneAvg: hygiene,
      customAvg: customCriterion,
      totalWeeklyScore: totalAverage,
    },
    gvcnComments: options?.gvcnWeeklyNote || '',
  };

  return weeklySummary;
}

/**
 * Pure aggregation function: computes full MonthlySummary from constituent weekly summaries.
 */
export function calculateMonthlySummary(
  classId: string,
  month: number,
  year: number,
  weeklySummaries: WeeklySummary[],
  options?: {
    academicYear?: string;
    gvcnMonthlyNote?: string;
  }
): MonthlySummary {
  const academicYear = options?.academicYear || '2026-2027';
  const weekNumbers = weeklySummaries.map((w) => w.weekNumber).sort((a, b) => a - b);

  let totalPeriodsTaught = 0;
  let totalPeriodsSigned = 0;
  let unsignedPeriodsCount = 0;
  let sumLearning = 0;
  let sumDiscipline = 0;
  let sumHygiene = 0;
  let sumCustom = 0;
  let sumTotalAvg = 0;
  let totalExcused = 0;
  let totalUnexcused = 0;
  let totalLate = 0;
  let totalEarlyDepartures = 0;
  let sumEmulation = 0;

  const studentAbsenceSummary: Record<string, StudentAbsenceSummaryItem> = {};

  for (const w of weeklySummaries) {
    totalPeriodsTaught += w.totalPeriodsTaught;
    totalPeriodsSigned += w.totalPeriodsSigned;
    unsignedPeriodsCount += w.unsignedPeriods.length;

    sumLearning += w.criteriaAverages.learning * w.totalPeriodsSigned;
    sumDiscipline += w.criteriaAverages.discipline * w.totalPeriodsSigned;
    sumHygiene += w.criteriaAverages.hygiene * w.totalPeriodsSigned;
    sumCustom += w.criteriaAverages.customCriterion * w.totalPeriodsSigned;
    sumTotalAvg += w.criteriaAverages.totalAverage * w.totalPeriodsSigned;

    totalExcused += w.attendanceStats.totalExcused;
    totalUnexcused += w.attendanceStats.totalUnexcused;
    totalLate += w.attendanceStats.totalLate;
    totalEarlyDepartures += w.attendanceStats.totalEarlyDepartures || 0;
    sumEmulation += w.emulationScore || 100;

    for (const [sId, item] of Object.entries(w.attendanceStats.studentAbsenceSummary || {})) {
      if (!studentAbsenceSummary[sId]) {
        studentAbsenceSummary[sId] = { ...item };
      } else {
        studentAbsenceSummary[sId].P += item.P;
        studentAbsenceSummary[sId].K += item.K;
        studentAbsenceSummary[sId].Late += item.Late;
        if (item.earlyDepartures) {
          studentAbsenceSummary[sId].earlyDepartures =
            (studentAbsenceSummary[sId].earlyDepartures || 0) + item.earlyDepartures;
        }
      }
    }
  }

  const completed = totalPeriodsSigned;
  const learning = completed > 0 ? Math.round((sumLearning / completed) * 100) / 100 : 0;
  const discipline = completed > 0 ? Math.round((sumDiscipline / completed) * 100) / 100 : 0;
  const hygiene = completed > 0 ? Math.round((sumHygiene / completed) * 100) / 100 : 0;
  const customCriterion = completed > 0 ? Math.round((sumCustom / completed) * 100) / 100 : 0;
  const totalAverage = completed > 0 ? Math.round((sumTotalAvg / completed) * 100) / 100 : 0;
  const emulationScoreAvg =
    weeklySummaries.length > 0
      ? Math.round((sumEmulation / weeklySummaries.length) * 10) / 10
      : 100;

  const criteriaAverages: MonthlyCriteriaAverages = {
    learning,
    discipline,
    hygiene,
    customCriterion,
    totalAverage,
  };

  const attendanceTotals: MonthlyAttendanceTotals = {
    totalExcused,
    totalUnexcused,
    totalLate,
    totalEarlyDepartures,
    studentAbsenceSummary,
  };

  const monthlySummary: MonthlySummary = {
    id: generateMonthlySummaryId(classId, month, year),
    classId,
    month,
    year,
    academicYear,
    weekNumbers,
    weeksIncluded: weekNumbers,
    totalPeriodsExpected: weeklySummaries.length * 40,
    totalPeriodsTaught,
    totalPeriodsSigned,
    unsignedPeriodsCount,
    criteriaAverages,
    attendanceTotals,
    emulationScoreAvg,
    weeklySummaries,
    gvcnMonthlyNote: options?.gvcnMonthlyNote || '',
    updatedAt: Date.now(),

    // Backwards compatibility
    monthlyAverageScore: totalAverage,
    totalAbsences: totalExcused + totalUnexcused,
  };

  return monthlySummary;
}

// --------------------------------------------------------------------------
// MOCK LOCAL STORAGE LAYER (Primary Fallback)
// --------------------------------------------------------------------------

export function getMockWeeklySummaries(): Record<string, WeeklySummary> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MOCK_WEEKLY_SUMMARIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveMockWeeklySummaries(map: Record<string, WeeklySummary>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MOCK_WEEKLY_SUMMARIES_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save mock weekly summaries', err);
  }
}

export function getMockMonthlySummaries(): Record<string, MonthlySummary> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MOCK_MONTHLY_SUMMARIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveMockMonthlySummaries(map: Record<string, MonthlySummary>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MOCK_MONTHLY_SUMMARIES_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save mock monthly summaries', err);
  }
}

// --------------------------------------------------------------------------
// ASYNC DUAL-MODE SERVICE API
// --------------------------------------------------------------------------

/**
 * Retrieves a single WeeklySummary by classId and weekNumber
 */
export async function getWeeklySummary(
  classId: string,
  weekNumber: number,
  _academicYear = '2026-2027'
): Promise<WeeklySummary | null> {
  const docId = generateWeeklySummaryId(classId, weekNumber);

  // 1. Try Firestore if not test env and db is available
  if (!isTestEnv && db) {
    try {
      const snap = await guardedGetDoc('weekly_summaries:get', doc(db, 'weekly_summaries', docId));
      if (snap.exists()) {
        return snap.data() as WeeklySummary;
      }
    } catch {
      // Fallback to local storage
    }
  }

  // 2. LocalStorage mock fallback
  const mockMap = getMockWeeklySummaries();
  if (mockMap[docId]) {
    return mockMap[docId];
  }

  return null;
}

/**
 * Persists a WeeklySummary to Firestore and LocalStorage
 */
export async function saveWeeklySummary(summary: WeeklySummary): Promise<void> {
  const docId = summary.id || generateWeeklySummaryId(summary.classId, summary.weekNumber);
  const normalizedSummary: WeeklySummary = {
    ...summary,
    id: docId,
    updatedAt: Date.now(),
  };

  // 1. Save to LocalStorage mock storage
  const mockMap = getMockWeeklySummaries();
  mockMap[docId] = normalizedSummary;
  saveMockWeeklySummaries(mockMap);

  // 2. Save to Firestore if available
  if (!isTestEnv && db) {
    try {
      await setDoc(doc(db, 'weekly_summaries', docId), normalizedSummary);
    } catch (err) {
      console.warn('Firestore save failed for weekly summary, retained in LocalStorage', err);
    }
  }

  // 3. Notify reactive listeners
  notifySummaryUpdate({
    type: 'weekly',
    classId: summary.classId,
    weekNumber: summary.weekNumber,
    id: docId,
  });
}

/**
 * Retrieves a single MonthlySummary
 */
export async function getMonthlySummary(
  classId: string,
  month: number,
  year: number,
  _academicYear = '2026-2027'
): Promise<MonthlySummary | null> {
  const docId = generateMonthlySummaryId(classId, month, year);

  if (!isTestEnv && db) {
    try {
      const snap = await guardedGetDoc('monthly_summaries:get', doc(db, 'monthly_summaries', docId));
      if (snap.exists()) {
        return snap.data() as MonthlySummary;
      }
    } catch {
      // Fallback
    }
  }

  const mockMap = getMockMonthlySummaries();
  return mockMap[docId] || null;
}

/**
 * Persists a MonthlySummary
 */
export async function saveMonthlySummary(summary: MonthlySummary): Promise<void> {
  const docId =
    summary.id || generateMonthlySummaryId(summary.classId, summary.month, summary.year);
  const normalized: MonthlySummary = {
    ...summary,
    id: docId,
    updatedAt: Date.now(),
  };

  const mockMap = getMockMonthlySummaries();
  mockMap[docId] = normalized;
  saveMockMonthlySummaries(mockMap);

  if (!isTestEnv && db) {
    try {
      await setDoc(doc(db, 'monthly_summaries', docId), normalized);
    } catch (err) {
      console.warn('Firestore save failed for monthly summary', err);
    }
  }

  notifySummaryUpdate({
    type: 'monthly',
    classId: summary.classId,
    month: summary.month,
    year: summary.year,
    id: docId,
  });
}

/**
 * Retrieves all weekly summaries across all 26 classes for a given week.
 * If any class does not have a saved summary yet, lazily aggregates or generates a baseline.
 */
export async function getAllClassSummariesForWeek(
  weekNumber: number,
  academicYear = '2026-2027'
): Promise<WeeklySummary[]> {
  const summariesMap = new Map<string, WeeklySummary>();

  // 1. Fetch from Firestore if available
  if (!isTestEnv && db) {
    try {
      const q = query(
        collection(db, 'weekly_summaries'),
        where('weekNumber', '==', weekNumber),
        limit(40)
      );
      const snap = await guardedGetDocs('weekly_summaries:by_week', q);
      snap.forEach((d) => {
        const item = d.data() as WeeklySummary;
        summariesMap.set(item.classId, item);
      });
    } catch {
      // Fallback
    }
  }

  // 2. Merge with LocalStorage mock entries
  const localMap = getMockWeeklySummaries();
  for (const item of Object.values(localMap)) {
    if (item.weekNumber === weekNumber) {
      if (!summariesMap.has(item.classId)) {
        summariesMap.set(item.classId, item);
      }
    }
  }

  // 3. Ensure all 26 classes are represented (auto-synthesizes if missing)
  const range = getWeekDatesForAcademicYear(weekNumber, academicYear);
  for (const classId of ALL_CLASSES) {
    if (!summariesMap.has(classId)) {
      // Lazily calculate from stored daily logbooks if available
      let dailyLogbooks: DailyLogbook[] = [];
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem('ums_daily_logbooks');
          if (raw) {
            const parsed = JSON.parse(raw);
            const allLb: DailyLogbook[] = Array.isArray(parsed)
              ? parsed
              : Object.values(parsed);
            dailyLogbooks = allLb.filter(
              (lb) => lb.classId === classId && range.weekDates.includes(lb.date)
            );
          }
        } catch {}
      }

      const generated = calculateWeeklySummary(classId, weekNumber, dailyLogbooks, [], {
        academicYear,
        startDate: range.startDate,
        endDate: range.endDate,
      });

      // Save into mock storage for consistency
      const mockKey = generated.id;
      localMap[mockKey] = generated;
      saveMockWeeklySummaries(localMap);

      summariesMap.set(classId, generated);
    }
  }

  return Array.from(summariesMap.values());
}

/**
 * Dữ liệu THẬT của 1 lớp trong các ngày cho trước (Firestore): sổ ngày + các tiết.
 * Đọc theo mã sổ `${lớp}_${ngày}` (không cần index). Môi trường test → trả rỗng để hook dùng dữ liệu thử.
 */
export async function fetchClassWeekData(
  classId: string,
  dates: string[]
): Promise<{ dailyLogbooks: DailyLogbook[]; periodsByDailyId: Record<string, PeriodEntry[]> } | null> {
  if (isTestEnv || !db) return null;
  const dailyLogbooks: DailyLogbook[] = [];
  const periodsByDailyId: Record<string, PeriodEntry[]> = {};
  await Promise.all(
    dates.map(async (date) => {
      const id = `${classId}_${date}`;
      const snap = await guardedGetDoc('daily_logbooks:class_week', doc(db, 'daily_logbooks', id));
      if (!snap.exists()) return;
      dailyLogbooks.push({ ...(snap.data() as DailyLogbook), id });
      const ps = await guardedGetDocs(
        'daily_logbooks:class_week_periods',
        query(collection(db, 'daily_logbooks', id, 'periods'), limit(8))
      );
      periodsByDailyId[id] = ps.docs.map((d) => d.data() as PeriodEntry);
    })
  );
  return { dailyLogbooks: dailyLogbooks.sort((a, b) => a.date.localeCompare(b.date)), periodsByDailyId };
}

/**
 * Tổng hợp THÁNG trực tiếp từ sổ đầu bài thật trên Firestore (qua tất cả các tuần học thuộc tháng),
 * không phụ thuộc việc từng tuần đã được bấm lưu vào weekly_summaries hay chưa.
 */
export async function recalculateMonthlySummaryFromRealData(
  classId: string,
  month: number,
  year: number,
  academicYear = currentAcademic().academicYear
): Promise<MonthlySummary> {
  const weeks = weeksInMonth(month, year, academicYear);
  const weekRanges = weeks.map((w) => ({
    weekNumber: w,
    ...getWeekDatesForAcademicYear(w, academicYear),
  }));
  const allDates = weekRanges.flatMap((r) => r.weekDates);

  const real = await fetchClassWeekData(classId, allDates);
  const weeklySummaries: WeeklySummary[] = [];

  for (const r of weekRanges) {
    let weekLogbooks: DailyLogbook[] = [];
    const weekPeriods: Record<string, PeriodEntry[]> = {};

    if (real) {
      weekLogbooks = real.dailyLogbooks.filter((b) => r.weekDates.includes(b.date));
      for (const d of r.weekDates) {
        const id = `${classId}_${d}`;
        if (real.periodsByDailyId[id]) {
          weekPeriods[id] = real.periodsByDailyId[id];
        }
      }
    } else {
      // Môi trường test hoặc offline fallback: lấy từ bản đã lưu / localStorage
      const savedWeek = await getWeeklySummary(classId, r.weekNumber, academicYear);
      if (savedWeek) {
        weeklySummaries.push(savedWeek);
        continue;
      }
      if (typeof localStorage !== 'undefined') {
        try {
          const rawLb = localStorage.getItem('ums_daily_logbooks');
          if (rawLb) {
            const parsed = JSON.parse(rawLb);
            const allLb: DailyLogbook[] = Array.isArray(parsed) ? parsed : Object.values(parsed);
            weekLogbooks = allLb.filter((b) => b.classId === classId && r.weekDates.includes(b.date));
          }
          for (const d of r.weekDates) {
            const id = `${classId}_${d}`;
            const rawP = localStorage.getItem(`ums_period_entries_${id}`);
            if (rawP) weekPeriods[id] = JSON.parse(rawP);
          }
        } catch {}
      }
    }

    const ws = calculateWeeklySummary(classId, r.weekNumber, weekLogbooks, weekPeriods, {
      academicYear,
      startDate: r.startDate,
      endDate: r.endDate,
    });
    weeklySummaries.push(ws);
  }

  const existingMonthly = await getMonthlySummary(classId, month, year, academicYear);
  const freshMonthly = calculateMonthlySummary(classId, month, year, weeklySummaries, {
    academicYear,
    gvcnMonthlyNote: existingMonthly?.gvcnMonthlyNote || '',
  });

  await saveMonthlySummary(freshMonthly).catch(() => {});
  return freshMonthly;
}

/**
 * Đọc dữ liệu THẬT toàn trường (26 lớp) trong 1 tuần học để tính Bảng thi đua 100 điểm.
 * Dùng chung bộ nhớ đệm `fetchSharedSchoolRangeData` với `LogbookRankingPanel` / `BghDashboardPage`
 * để tránh nhân đôi hàng nghìn lượt đọc N+1 khi mở trang `/emulation`.
 */
export async function fetchRealEmulationWeekData(
  weekNumber: number,
  academicYear = currentAcademic().academicYear
): Promise<{
  summaries: WeeklySummary[];
  notes: BehaviorNote[];
  classesMetadata: Record<string, ClassMetadataInfo>;
} | null> {
  if (isTestEnv || !db) return null;

  const range = getWeekDatesForAcademicYear(weekNumber, academicYear);
  const shared = await fetchSharedSchoolRangeData(range.startDate, range.endDate);

  const classesMetadata: Record<string, ClassMetadataInfo> = {};
  const classIds: string[] = [];
  shared.classDocs.forEach((d) => {
    const data = d.data;
    if (data.active === false) return;
    const cId = d.id;
    classIds.push(cId);
    classesMetadata[cId] = {
      classId: cId,
      className: data.name || cId,
      grade: Number(data.grade) || parseInt(cId[0], 10) || 6,
      gvcnName: data.gvcnName || data.homeroomTeacherName || `GVCN ${cId}`,
    };
  });
  const targetClasses =
    classIds.length > 0 ? classIds.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })) : ALL_CLASSES;

  const summaries: WeeklySummary[] = targetClasses.map((classId) => {
    const classBooks = shared.logbooks.filter((b) => b.classId === classId);
    const classPeriods: Record<string, PeriodEntry[]> = {};
    for (const d of range.weekDates) {
      const id = `${classId}_${d}`;
      if (shared.periodsByDaily[id]) classPeriods[id] = shared.periodsByDaily[id];
    }
    return calculateWeeklySummary(classId, weekNumber, classBooks, classPeriods, {
      academicYear,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  });

  const notes: BehaviorNote[] = shared.noteDocs.map((d) => ({
    ...(d.data as BehaviorNote),
    id: d.id,
  }));

  return { summaries, notes, classesMetadata };
}
