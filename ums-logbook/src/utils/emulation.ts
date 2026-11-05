/**
 * UMS Digital Class Logbook - 100-Point Emulation Scoring Engine
 * Milestone 5: Official UMS Emulation Calculation, Certification & Standings
 * Path: src/utils/emulation.ts
 */

import {
  WeeklySummary,
  ClassEmulationRank,
  AwardLevel,
  EmulationConfig,
  AttendanceDeductionsBreakdown,
  BehaviorDeltaBreakdown,
} from '../types/summary';
import { BehaviorNote } from '../types/behavior';

export const DEFAULT_EMULATION_CONFIG: EmulationConfig = {
  baseScore: 100.0,
  academicBenchmark: 9.5,
  academicScale: 10.0,
  kDeduction: 2.0,
  pDeduction: 0.5,
  lateDeduction: 1.0,
  negativeNoteDeduction: 1.0,
  severeNoteDeduction: 2.0,
  positiveNoteBonus: 0.5,
  maxBonus: 5.0,
  unsignedPeriodDeduction: 2.0,
  minScore: 0.0,
  maxScore: 105.0,
  goodWeekMinScore: 90.0,
  goodWeekMaxUnexcused: 0,
  goodWeekMinPeriodScore: 8.0,
};

export interface CalculateEmulationScoreParams {
  periodAverage?: number;
  averagePeriodScore?: number;
  periodsTaught?: number;
  totalPeriodsSigned?: number;
  unexcusedK?: number;
  excusedP?: number;
  late?: number;
  negativeNotes?: number;
  severeNegativeNotes?: number;
  positiveNotes?: number;
  unsignedCount?: number;
  minPeriodScore?: number;
  baseScore?: number;
  config?: Partial<EmulationConfig>;
}

export interface EmulationScoreResult {
  totalScore: number;
  baseScore: number;
  academicDelta: number;
  attendanceDeductions: AttendanceDeductionsBreakdown;
  behaviorDelta: BehaviorDeltaBreakdown;
  unsignedPeriodDeductions: number;
  isGoodStudyWeek: boolean;
  goodStudyWeekFailReasons: string[];
  awardLevel: AwardLevel;
  finalScore: number;
  status: 'good' | 'standard' | 'warning';
}

/**
 * Evaluates whether a class qualifies for the prestigious "Tuần học tốt" certification.
 * Strict triple-conjunction:
 * score >= 90.0 AND unexcusedCount === 0 AND minPeriodScore >= 8.0 AND periodsTaught > 0
 */
export function evaluateGoodStudyWeek(
  score: number,
  unexcusedCount: number,
  minPeriodScore: number,
  periodsTaught: number,
  config: EmulationConfig = DEFAULT_EMULATION_CONFIG
): { isGoodStudyWeek: boolean; failReasons: string[] } {
  const failReasons: string[] = [];

  if (periodsTaught <= 0) {
    failReasons.push('Chưa có tiết học nào được ghi nhận hoàn thành (No periods recorded)');
  }
  if (score < config.goodWeekMinScore) {
    failReasons.push(
      `Điểm thi đua (${score}) chưa đạt mốc tối thiểu ${config.goodWeekMinScore} (Score below benchmark)`
    );
  }
  if (unexcusedCount > config.goodWeekMaxUnexcused) {
    failReasons.push(
      `Có ${unexcusedCount} lượt học sinh vắng không phép K (Zero-tolerance policy on unexcused absences)`
    );
  }
  if (periodsTaught > 0 && minPeriodScore < config.goodWeekMinPeriodScore) {
    failReasons.push(
      `Có tiết học đạt ${minPeriodScore} điểm, dưới ngưỡng tối thiểu ${config.goodWeekMinPeriodScore} (Period score below minimum standard)`
    );
  }

  return {
    isGoodStudyWeek: failReasons.length === 0,
    failReasons,
  };
}

/**
 * Determines 5-tier MOET emulation award level
 */
export function determineAwardLevel(score: number, isGoodStudyWeek: boolean): AwardLevel {
  if (score >= 95.0) return 'xuat_sac';
  if (score >= 90.0 || isGoodStudyWeek) return 'tuan_hoc_tot';
  if (score >= 80.0) return 'kha';
  if (score >= 70.0) return 'trung_binh';
  return 'can_co_gang';
}

/**
 * Calculates official 100-point emulation score:
 * Base 100 + Academic Delta - Attendance Deductions - Behavior Deductions + Behavior Bonuses - Unsigned Penalties
 * Clamped in range [0, 105], rounded to 1 decimal place.
 */
export function calculateEmulationScore(
  params: CalculateEmulationScoreParams
): EmulationScoreResult {
  const cfg = { ...DEFAULT_EMULATION_CONFIG, ...params.config };
  if (params.baseScore !== undefined) {
    cfg.baseScore = params.baseScore;
  }

  const periodAvg = params.periodAverage ?? params.averagePeriodScore ?? 0;
  const taught = params.periodsTaught ?? params.totalPeriodsSigned ?? 0;

  // Academic adjustment: delta = (periodAverage - 9.5) * 10 (when periods > 0)
  const academicDelta =
    taught > 0
      ? Math.round((periodAvg - cfg.academicBenchmark) * cfg.academicScale * 10) / 10
      : 0;

  // Attendance deductions
  const unexcusedK = params.unexcusedK ?? 0;
  const excusedP = params.excusedP ?? 0;
  const late = params.late ?? 0;

  const kDeduction = Math.round(unexcusedK * cfg.kDeduction * 10) / 10;
  const pDeduction = Math.round(excusedP * cfg.pDeduction * 10) / 10;
  const lateDeduction = Math.round(late * cfg.lateDeduction * 10) / 10;
  const totalAttendanceDeduction =
    Math.round((kDeduction + pDeduction + lateDeduction) * 10) / 10;

  const attendanceDeductions: AttendanceDeductionsBreakdown = {
    unexcusedK,
    excusedP,
    late,
    total: totalAttendanceDeduction,
    kDeduction,
    pDeduction,
    lateDeduction,
  };

  // Behavior notes deductions & bonuses
  const negativeCount = params.negativeNotes ?? 0;
  const severeCount = params.severeNegativeNotes ?? 0;
  const positiveCount = params.positiveNotes ?? 0;

  const behaviorDeduction =
    Math.round(
      (negativeCount * cfg.negativeNoteDeduction + severeCount * cfg.severeNoteDeduction) * 10
    ) / 10;
  const rawBonus = positiveCount * cfg.positiveNoteBonus;
  const cappedBonus = Math.round(Math.min(rawBonus, cfg.maxBonus) * 10) / 10;
  const netBehavior = Math.round((cappedBonus - behaviorDeduction) * 10) / 10;

  const behaviorDelta: BehaviorDeltaBreakdown = {
    negativeCount: negativeCount + severeCount,
    positiveCount,
    bonus: cappedBonus,
    deduction: behaviorDeduction,
    net: netBehavior,
  };

  // Unsigned periods penalty: unsignedCount * (-2.0)
  const unsignedCount = params.unsignedCount ?? 0;
  const unsignedPeriodDeductions =
    Math.round(unsignedCount * cfg.unsignedPeriodDeduction * 10) / 10;

  // Master score sum
  const rawTotal =
    cfg.baseScore +
    academicDelta -
    totalAttendanceDeduction -
    behaviorDeduction +
    cappedBonus -
    unsignedPeriodDeductions;

  // Clamp within [minScore, maxScore] and round to 1 decimal place
  const clampedTotal = Math.max(cfg.minScore, Math.min(cfg.maxScore, rawTotal));
  const totalScore = Math.round(clampedTotal * 10) / 10;

  // Minimum period score evaluation
  const minPeriodScore = params.minPeriodScore ?? (taught > 0 ? periodAvg : 0);
  const goodWeekEval = evaluateGoodStudyWeek(totalScore, unexcusedK, minPeriodScore, taught, cfg);
  const awardLevel = determineAwardLevel(totalScore, goodWeekEval.isGoodStudyWeek);

  const status: 'good' | 'standard' | 'warning' =
    totalScore >= 90 ? 'good' : totalScore >= 80 ? 'standard' : 'warning';

  return {
    totalScore,
    baseScore: cfg.baseScore,
    academicDelta,
    attendanceDeductions,
    behaviorDelta,
    unsignedPeriodDeductions,
    isGoodStudyWeek: goodWeekEval.isGoodStudyWeek,
    goodStudyWeekFailReasons: goodWeekEval.failReasons,
    awardLevel,
    finalScore: totalScore,
    status,
  };
}

export interface ClassMetadataInfo {
  classId: string;
  className: string;
  grade: number;
  gvcnName: string;
}

/**
 * Ranks all classes for emulation, sorting descending by total score and breaking ties gracefully.
 */
export function rankClassesForEmulation(
  classSummaries: WeeklySummary[],
  classBehaviorNotes: Record<string, BehaviorNote[]> | BehaviorNote[] = {},
  classesMetadata: Record<string, ClassMetadataInfo> = {}
): ClassEmulationRank[] {
  // Normalize behavior notes into Map<classId, BehaviorNote[]>
  const notesByClass = new Map<string, BehaviorNote[]>();
  if (Array.isArray(classBehaviorNotes)) {
    for (const note of classBehaviorNotes) {
      if (!notesByClass.has(note.classId)) {
        notesByClass.set(note.classId, []);
      }
      notesByClass.get(note.classId)!.push(note);
    }
  } else {
    for (const [cId, notes] of Object.entries(classBehaviorNotes)) {
      notesByClass.set(cId, notes);
    }
  }

  // Map each weekly summary into an intermediate evaluated object
  const evaluatedList: ClassEmulationRank[] = classSummaries.map((summary) => {
    const classId = summary.classId;
    const grade = parseInt(classId[0], 10) || 6;
    const meta = classesMetadata[classId];
    const className = meta?.className || classId;
    const gvcnName = meta?.gvcnName || `GVCN ${classId}`;

    // Get behavior notes for this class
    const notes = notesByClass.get(classId) || [];
    let positiveNotes = 0;
    let standardNegative = 0;
    let severeNegative = 0;

    for (const n of notes) {
      if (n.type === 'positive') {
        positiveNotes++;
      } else {
        const cat = (n.category || '').toLowerCase();
        if (cat.includes('phone') || cat.includes('disruption') || cat.includes('severe')) {
          severeNegative++;
        } else {
          standardNegative++;
        }
      }
    }

    const periodAvg =
      summary.criteriaAverages?.totalAverage ??
      summary.criteriaAverage?.totalWeeklyScore ??
      summary.averageScore ??
      0;
    const taught =
      summary.totalPeriodsTaught ?? summary.totalPeriodsSigned ?? summary.completedPeriods ?? 0;
    const unexcusedK =
      summary.attendanceStats?.totalUnexcused ?? summary.attendanceTotals?.unexcused ?? 0;
    const excusedP =
      summary.attendanceStats?.totalExcused ?? summary.attendanceTotals?.excused ?? 0;
    const late = summary.attendanceStats?.totalLate ?? summary.attendanceTotals?.late ?? 0;
    // Tiết "chưa mở" theo TKB (notStarted) chỉ để cảnh báo, không trừ điểm
    const unsignedCount =
      summary.unsignedPeriods?.filter((p: { notStarted?: boolean }) => !p?.notStarted).length ??
      summary.unsignedPeriodsCount ??
      0;

    const evalResult = calculateEmulationScore({
      periodAverage: periodAvg,
      periodsTaught: taught,
      unexcusedK,
      excusedP,
      late,
      negativeNotes: standardNegative,
      severeNegativeNotes: severeNegative,
      positiveNotes,
      unsignedCount,
    });

    const rankObj: ClassEmulationRank = {
      rank: 1, // Will be set after sorting
      classId,
      grade,
      className,
      gvcnName,
      baseScore: evalResult.baseScore,
      academicDelta: evalResult.academicDelta,
      attendanceDeductions: evalResult.attendanceDeductions,
      behaviorDelta: evalResult.behaviorDelta,
      unsignedPeriodDeductions: evalResult.unsignedPeriodDeductions,
      totalScore: evalResult.totalScore,
      awardLevel: evalResult.awardLevel,
      isGoodStudyWeek: evalResult.isGoodStudyWeek,
      goodStudyWeekFailReasons: evalResult.goodStudyWeekFailReasons,

      // Aliases
      weeklyScore: periodAvg,
      penaltyPoints:
        evalResult.attendanceDeductions.total +
        evalResult.behaviorDelta.deduction +
        evalResult.unsignedPeriodDeductions,
      bonusPoints: evalResult.behaviorDelta.bonus,
      finalScore: evalResult.totalScore,
      status: evalResult.status,
    };

    return rankObj;
  });

  // Sort descending according to official tie-breaking rules:
  // 1. Total score descending
  // 2. Fewer conduct deductions (attendance + behavior + unsigned)
  // 3. Higher academic average
  // 4. Fewer unexcused absences
  // 5. Alphabetical class name
  evaluatedList.sort((a, b) => {
    // 1. Total score descending
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }

    // 2. Total deductions ascending (fewer violations wins)
    const aDeductions =
      a.attendanceDeductions.total +
      a.behaviorDelta.deduction +
      a.unsignedPeriodDeductions;
    const bDeductions =
      b.attendanceDeductions.total +
      b.behaviorDelta.deduction +
      b.unsignedPeriodDeductions;
    if (aDeductions !== bDeductions) {
      return aDeductions - bDeductions;
    }

    // 3. Academic average descending
    if (b.academicDelta !== a.academicDelta) {
      return b.academicDelta - a.academicDelta;
    }

    // 4. Unexcused absences ascending
    if (a.attendanceDeductions.unexcusedK !== b.attendanceDeductions.unexcusedK) {
      return a.attendanceDeductions.unexcusedK - b.attendanceDeductions.unexcusedK;
    }

    // 5. Alphabetical class name
    return a.className.localeCompare(b.className);
  });

  // Assign overall rank 1 to N
  evaluatedList.forEach((item, index) => {
    item.rank = index + 1;
  });

  // Assign grade-level rank
  const gradeCounters: Record<number, number> = {};
  evaluatedList.forEach((item) => {
    const g = item.grade;
    gradeCounters[g] = (gradeCounters[g] || 0) + 1;
    item.gradeRank = gradeCounters[g];
  });

  return evaluatedList;
}

/**
 * Returns UI metadata (labels, badge styling, color) for an AwardLevel
 */
export function getAwardLevelMeta(awardLevel: AwardLevel): {
  labelVi: string;
  labelEn: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  colorName: string;
} {
  switch (awardLevel) {
    case 'xuat_sac':
      return {
        labelVi: 'Xuất sắc',
        labelEn: 'Excellent',
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        badgeText: 'text-emerald-700 dark:text-emerald-300 font-bold',
        badgeBorder: 'border-emerald-300 dark:border-emerald-700',
        colorName: 'emerald',
      };
    case 'tuan_hoc_tot':
      return {
        labelVi: 'Tuần học tốt',
        labelEn: 'Good Study Week',
        badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
        badgeText: 'text-blue-700 dark:text-blue-300 font-bold',
        badgeBorder: 'border-blue-300 dark:border-blue-700',
        colorName: 'blue',
      };
    case 'kha':
      return {
        labelVi: 'Khá',
        labelEn: 'Fair',
        badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
        badgeText: 'text-amber-700 dark:text-amber-300 font-bold',
        badgeBorder: 'border-amber-300 dark:border-amber-700',
        colorName: 'amber',
      };
    case 'trung_binh':
      return {
        labelVi: 'Trung bình',
        labelEn: 'Average',
        badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
        badgeText: 'text-orange-700 dark:text-orange-300 font-semibold',
        badgeBorder: 'border-orange-300 dark:border-orange-700',
        colorName: 'orange',
      };
    case 'can_co_gang':
    default:
      return {
        labelVi: 'Cần cố gắng',
        labelEn: 'Needs Improvement',
        badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
        badgeText: 'text-rose-700 dark:text-rose-300 font-semibold',
        badgeBorder: 'border-rose-300 dark:border-rose-700',
        colorName: 'rose',
      };
  }
}
