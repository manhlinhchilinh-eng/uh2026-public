import type { EslTag } from '../utils/eslPeriods';
import type { ApprovedLeaveEntry } from '../utils/studentLeave';
import type { PeriodAttendanceSummary } from '../utils/periodAttendance';
/**
 * UMS Digital Class Logbook - Period Entry & Scoring Contracts (Milestone 2)
 */

export interface PeriodScore {
  learning: number; // max 4.0, step 0.5
  discipline: number; // max 3.0, step 0.5
  hygiene: number; // max 2.0, step 0.5
  customCriterion: number; // max 1.0 (configurable)
  total: number; // sum <= 10.0
}

export type PeriodRatingLevel = 'TOT' | 'KHA' | 'TRUNG_BINH' | 'YEU';

export type AbsenceType = 'P' | 'K' | 'Late';

export type AttendanceStatus = 'present' | AbsenceType;

export type AttendanceOrigin = 'baseline' | 'period';

export interface StudentAbsenceRecord {
  studentId: string; // Student ID / MHS (e.g. "269398")
  studentName: string; // Full name (e.g. "Lý Bảo Duy")
  studentNumber?: number; // STT in class roster (1..26)
  type: AbsenceType; // 'P': Vắng có phép, 'K': Vắng không phép, 'Late': Đi muộn
  note?: string; // Optional rationale
  reportedInTier?: AttendanceOrigin; // 'baseline' or 'period'
  updatedBy?: string; // Teacher username who recorded this
  updatedAt?: number; // Epoch timestamp
}

export interface EarlyDepartureRecord {
  studentId: string; // Student ID / MHS
  studentName: string; // Full name
  studentNumber?: number; // STT in class roster
  departedAt: string; // 24-hour time "HH:mm" (e.g., "09:30")
  reason: string; // Specific reason
  reportedBy?: string; // Teacher username who signed permission
  reportedByName?: string; // Teacher display name
  reportedPeriodIndex?: number; // Period in which the student left (1..8)
  timestamp?: number; // Epoch timestamp
}

export interface PeriodEntry {
  id?: string; // Document ID, e.g. "1" .. "8"
  dailyId?: string; // Parent Daily Logbook ID: `${classId}_${date}`
  classId?: string; // e.g. "6A1" (phục vụ kiểm tra rules TKB)
  dayOfWeek?: number; // 2..8 (Thứ Hai = 2 .. Chủ Nhật = 8)
  substitutionId?: string; // ID bản ghi /substitutions/{id} đã duyệt (nếu dạy thay)
  periodIndex: number; // 1 to 8 (1-4 morning, 5-8 afternoon)
  subject: string; // e.g. "Toán học", "Ngữ văn"
  ppctLessonIndex?: number; // Phân phối chương trình lesson number
  lessonTopic: string; // Topic / title of the lesson
  teacherId: string; // Username or UID of subject teacher
  teacherName: string; // Display name of subject teacher
  absentStudents: StudentAbsenceRecord[]; // Absences recorded for this specific period
  earlyDepartures?: EarlyDepartureRecord[]; // Early departures during this period
  scores: PeriodScore; // 4 criteria scores totaling <= 10.0
  teacherComment: string; // Teacher remarks / evaluation
  teacherSignature: string; // Electronic signature name
  isSigned: boolean; // True when period is signed
  /** Điểm danh đầu tiết đã lưu (trước khi ký) — xem utils/periodAttendance.ts */
  attendanceTakenAt?: number;
  attendanceTakenBy?: string;
  attendanceTakenByName?: string;
  /** Tiết có dạy bằng tiếng Anh (ESL) — null = đã bỏ đánh dấu. Xem utils/eslPeriods.ts */
  esl?: EslTag | null;
  signedAt?: number; // Timestamp of signature
  createdAt?: number;
  updatedAt: number;
}

export interface DailyAttendanceBaseline {
  reportedBy: string; // GVCN username or ID
  reportedByName?: string; // GVCN display name
  reportedAt: number; // Timestamp of report
  session?: 'morning' | 'afternoon';
  absences: StudentAbsenceRecord[];
  earlyDepartures: EarlyDepartureRecord[];
  notes?: string;
}

export type LogbookStatus = 'draft' | 'in_progress' | 'completed' | 'locked';

export interface DailyLogbook {
  id: string; // Format: `${classId}_${YYYY-MM-DD}` (e.g., "9A3_2026-10-15")
  classId: string; // e.g. "9A3"
  date: string; // "YYYY-MM-DD"
  dayOfWeek?: number; // 2..8 (Thứ Hai = 2 .. Chủ Nhật = 8)
  weekNumber: number; // Academic week number (1..35)
  academicYear?: string; // e.g. "2026-2027"
  semester?: number; // 1 | 2
  morningBaseline?: DailyAttendanceBaseline;
  afternoonBaseline?: DailyAttendanceBaseline;
  preSessionAttendance: DailyAttendanceBaseline; // Backwards-compatible alias for morningBaseline
  totalPeriods: number; // 8
  status?: LogbookStatus;
  isCompleted: boolean; // True when all 8 periods (or required periods) are signed
  /** Tóm tắt điểm danh từng tiết ("1".."8") cho bảng Vắng/muộn hôm nay */
  periodAttendance?: Record<string, PeriodAttendanceSummary>;
  /** Đơn nghỉ học PH đã được GVCN duyệt cho ngày này (khóa = id đơn) — điền sẵn vắng P khi điểm danh */
  approvedLeaves?: Record<string, ApprovedLeaveEntry>;
  createdAt?: number;
  updatedAt: number;
}


export interface DailyScoreSummary {
  dailyId: string;
  classId: string;
  date: string;
  totalPeriodsSigned: number;
  totalPeriodsCount: number;
  averageLearning: number;
  averageDiscipline: number;
  averageHygiene: number;
  averageCustom: number;
  totalDailyScore: number;
  totalAbsenceCount: number;
  excusedCountP: number;
  unexcusedCountK: number;
  lateCount: number;
  earlyDepartureCount: number;
}

export interface ScoringValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  total: number;
  normalizedScores: PeriodScore;
}
