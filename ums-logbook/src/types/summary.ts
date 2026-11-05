/**
 * UMS Digital Class Logbook - Automated Summaries & Emulation Contracts
 * Milestone 5: Weekly/Monthly Summaries, Class Emulation & Attendance Rollups
 * Path: src/types/summary.ts
 */

export interface UnsignedPeriodInfo {
  date: string; // "YYYY-MM-DD"
  periodIndex: number; // 1 to 8
  subject: string; // e.g. "Toán học"
  teacherName: string; // e.g. "Nguyễn Mạnh Linh"
  teacherId?: string; // e.g. "mrlinh9a3ums"
  /** true = có trên TKB nhưng chưa ai mở/ghi tiết (không có bản ghi). Chỉ để cảnh báo, không trừ điểm thi đua. */
  notStarted?: boolean;
}

export interface StudentAbsenceSummaryItem {
  name: string; // Full name of student
  P: number; // Vắng có phép (Excused)
  K: number; // Vắng không phép (Unexcused)
  Late: number; // Đi muộn (Tardy)
  earlyDepartures?: number; // Về sớm
}

export interface WeeklyAttendanceStats {
  totalExcused: number; // Total P across week
  totalUnexcused: number; // Total K across week
  totalLate: number; // Total Late across week
  studentAbsenceSummary: Record<string, StudentAbsenceSummaryItem>; // Key: studentId (e.g. "269398")
  totalEarlyDepartures?: number; // Total early departure instances
}

export interface WeeklyCriteriaAverages {
  learning: number; // Max 4.0, rounded to 2 decimals
  discipline: number; // Max 3.0, rounded to 2 decimals
  hygiene: number; // Max 2.0, rounded to 2 decimals
  customCriterion: number; // Max 1.0, rounded to 2 decimals
  totalAverage: number; // Average of total period scores (<= 10.0)
}

export interface WeeklySummary {
  id: string; // Canonical format: `${classId}_W${weekNumber}` (e.g., "9A3_W5")
  classId: string; // e.g., "9A3"
  academicYear: string; // e.g., "2026-2027"
  weekNumber: number; // Academic week number (1..35)
  startDate: string; // "YYYY-MM-DD" (Monday)
  endDate: string; // "YYYY-MM-DD" (Friday)
  totalPeriodsExpected: number; // Standard 40 slots (5 days x 8 periods)
  totalPeriodsTaught: number; // Periods with subject/teacher assigned or filled
  totalPeriodsSigned: number; // Periods signed by GVBM (isSigned === true)
  unsignedPeriods: UnsignedPeriodInfo[]; // Detailed breakdown of unsigned slots
  /** Tiết mặc định 10đ chưa ký (NN2, Native, Eng 1 K9, test prep Văn/Toán K9) — tính 10đ, không phải "chưa ký" */
  defaultScoredPeriods?: Array<{ date: string; periodIndex: number; subject: string }>;
  attendanceStats: WeeklyAttendanceStats;
  criteriaAverages: WeeklyCriteriaAverages;
  teacherRemarksSummary: string[]; // Consolidated list of teacher comments
  gvcnWeeklyNote?: string; // Qualitative weekly review entered by GVCN
  bghComments?: string; // Feedback from School Administrators (BGH)
  emulationScore?: number; // 100-point calculated emulation score
  rank?: number; // Emulation rank among 26 classes (1..26)
  isLocked?: boolean; // Administrative lock preventing further edits
  updatedAt: number; // Epoch timestamp (ms)

  // Backwards-compatibility aliases with previous stubs and contract tests
  totalPeriods?: number;
  completedPeriods?: number;
  totalScore?: number;
  averageScore?: number;
  attendanceTotals?: {
    excused: number;
    unexcused: number;
    late: number;
    earlyLeave?: number;
    earlyDepartures?: number;
  };
  unsignedPeriodsCount?: number;
  criteriaAverage?: {
    learningAvg: number;
    disciplineAvg: number;
    hygieneAvg: number;
    customAvg: number;
    totalWeeklyScore: number;
  };
  gvcnComments?: string;
}

export interface MonthlyAttendanceTotals {
  totalExcused: number;
  totalUnexcused: number;
  totalLate: number;
  totalEarlyDepartures?: number;
  studentAbsenceSummary?: Record<string, StudentAbsenceSummaryItem>;
}

export interface MonthlyCriteriaAverages {
  learning: number;
  discipline: number;
  hygiene: number;
  customCriterion: number;
  totalAverage: number;
}

export interface MonthlySummary {
  id: string; // Canonical format: `${classId}_M${month}_${year}` (e.g., "9A3_M10_2026")
  classId: string; // e.g., "9A3"
  month: number; // 1 to 12
  year: number; // e.g., 2026
  academicYear?: string; // e.g., "2026-2027"
  weekNumbers: number[]; // e.g., [5, 6, 7, 8]
  weeksIncluded?: number[]; // Alias for weekNumbers
  totalPeriodsExpected?: number; // e.g. 160 or 200
  totalPeriodsTaught: number;
  totalPeriodsSigned: number;
  unsignedPeriodsCount?: number;
  criteriaAverages: MonthlyCriteriaAverages;
  attendanceTotals: MonthlyAttendanceTotals;
  emulationScoreAvg: number; // Average emulation score across weeks
  topStudents?: Array<{ studentId: string; studentName: string; points: number }>;
  noteSummary?: {
    positiveCount: number;
    negativeCount: number;
    severeCount: number;
  };
  weeklySummaries?: string[] | WeeklySummary[]; // IDs or objects of weekly summaries
  monthlyRank?: number; // Emulation ranking for the month
  gvcnMonthlyNote?: string; // GVCN monthly synthesis
  bghMonthlyNote?: string; // School administration assessment
  updatedAt: number;

  // Backwards compatibility
  monthlyAverageScore?: number;
  totalAbsences?: number;
  rank?: number;
}

export type AwardLevel = 'xuat_sac' | 'tuan_hoc_tot' | 'kha' | 'trung_binh' | 'can_co_gang';

export interface AttendanceDeductionsBreakdown {
  unexcusedK: number;
  excusedP: number;
  late: number;
  total: number;
  kDeduction?: number; // magnitude: unexcusedK * 2.0
  pDeduction?: number; // magnitude: excusedP * 0.5
  lateDeduction?: number; // magnitude: late * 1.0
}

export interface BehaviorDeltaBreakdown {
  negativeCount: number;
  positiveCount: number;
  bonus: number; // min(positiveCount * 0.5, 5.0)
  deduction: number; // negativeCount * 1.0
  net: number; // bonus - deduction
}

export interface ClassEmulationRank {
  rank: number; // 1 to 26
  gradeRank?: number; // 1 to 8 (for Grade 6) or 1 to 6 (for Grades 7, 8, 9)
  classId: string; // e.g. "6A1", "9A3"
  grade: number; // 6, 7, 8, 9
  className: string; // "6A1"
  gvcnName: string; // e.g. "Đinh Hoài Long"
  baseScore: number; // 100
  academicDelta: number; // delta = (periodAverage - 9.5) * 10
  attendanceDeductions: AttendanceDeductionsBreakdown;
  behaviorDelta: BehaviorDeltaBreakdown;
  unsignedPeriodDeductions: number; // unsignedCount * 2.0
  totalScore: number; // Clamped in range [0, 105], rounded to 1 decimal place
  awardLevel: AwardLevel;
  isGoodStudyWeek: boolean;
  goodStudyWeekFailReasons?: string[];

  // Backwards compatibility aliases
  weeklyScore?: number;
  penaltyPoints?: number;
  bonusPoints?: number;
  finalScore?: number;
  status?: 'good' | 'standard' | 'warning';
}

export interface EmulationConfig {
  baseScore: number; // 100.0
  academicBenchmark: number; // 9.5
  academicScale: number; // 10.0
  kDeduction: number; // 2.0
  pDeduction: number; // 0.5
  lateDeduction: number; // 1.0
  negativeNoteDeduction: number; // 1.0
  severeNoteDeduction: number; // 2.0
  positiveNoteBonus: number; // 0.5
  maxBonus: number; // 5.0
  unsignedPeriodDeduction: number; // 2.0
  minScore: number; // 0.0
  maxScore: number; // 105.0
  goodWeekMinScore: number; // 90.0
  goodWeekMaxUnexcused: number; // 0
  goodWeekMinPeriodScore: number; // 8.0
}
