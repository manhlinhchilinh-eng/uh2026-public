/**
 * UMS Digital Class Logbook - Schedule & Timetable Contracts (Milestone 4)
 * Defines 40-slot weekly timetable matrix, teacher schedule views,
 * and Vietnamese calendar helpers.
 */

export type DayOfWeek = 2 | 3 | 4 | 5 | 6 | 7 | 8;
// 2 = Thứ Hai, 3 = Thứ Ba, 4 = Thứ Tư, 5 = Thứ Năm, 6 = Thứ Sáu, 7 = Thứ Bảy, 8 = Chủ Nhật

export const SCHOOL_DAYS: number[] = [2, 3, 4, 5, 6];
export const PERIODS_PER_DAY = 8;
export const TOTAL_WEEKLY_SLOTS = 40;
export const MORNING_PERIODS = [1, 2, 3, 4];
export const AFTERNOON_PERIODS = [5, 6, 7, 8];

/**
 * Individual period slot in a class timetable
 */
export interface ScheduleSlot {
  dayOfWeek: number; // 2..6 (Monday to Friday, optionally 7 for Saturday)
  periodIndex: number; // 1 to 8 (1-4 morning, 5-8 afternoon)
  subject: string; // e.g. "Toán học", "Ngữ văn", "Tiếng Anh", "Khoa học tự nhiên"
  teacherUsername: string; // e.g. "mrlinhums", "msphuonganhums"
  teacherName: string; // e.g. "Nguyễn Mạnh Linh", "Đinh Hoài Long"
  room?: string; // e.g. "P.9A3", "Sân thể thao", "Phòng Tin học"
}

/**
 * Ô tiết dạng map ("${dayOfWeek}_${periodIndex}") để Firestore Security Rules tra cứu quyền ghi tiết trực tiếp.
 */
export interface ScheduleSlotMapItem {
  subject: string;
  teacherName: string;
  teacherUsername: string;
}

/**
 * Full weekly timetable document for a class
 * Stored in Firestore `/schedules/{classId}` or LocalStorage `ums_schedules`
 */
export interface ClassSchedule {
  classId: string; // e.g. "9A3", "6A1"
  academicYear: string; // e.g. "2026-2027"
  semester: number; // 1 | 2
  slots: ScheduleSlot[]; // 40 slots for 5 school days x 8 periods
  /** Map "${dayOfWeek}_${periodIndex}" → môn/GV phục vụ tra cứu O(1) trong Firestore rules */
  slotMap?: Record<string, ScheduleSlotMapItem>;
  updatedAt: number; // Epoch timestamp (ms)
  updatedBy?: string; // Teacher or Admin username
  /** Lần cập nhật TKB từ file Excel gần nhất (để hoàn tác) */
  updateId?: string;
  sourceFile?: string;
  /** Bản TKB ngay trước lần cập nhật này */
  previous?: { slots: ScheduleSlot[]; updatedAt: number; updatedBy?: string; academicYear: string; semester: number } | null;
}


/**
 * Schedule slot augmented with classId for teacher schedule queries & smart navigation
 */
export interface TeacherScheduleSlot extends ScheduleSlot {
  classId: string; // e.g. "9A3"
}

/**
 * Returns Vietnamese day of week label
 * 2 -> "Thứ 2", 3 -> "Thứ 3", ..., 6 -> "Thứ 6", 7 -> "Thứ 7", 8 / 1 / 0 -> "Chủ nhật"
 */
export function getDayOfWeekVi(day: number): string {
  switch (day) {
    case 2:
      return 'Thứ 2';
    case 3:
      return 'Thứ 3';
    case 4:
      return 'Thứ 4';
    case 5:
      return 'Thứ 5';
    case 6:
      return 'Thứ 6';
    case 7:
      return 'Thứ 7';
    case 8:
    case 1:
    case 0:
      return 'Chủ nhật';
    default:
      return `Thứ ${day}`;
  }
}

/**
 * Converts date string ("YYYY-MM-DD" or ISO) to Vietnamese day of week index:
 * Mon = 2, Tue = 3, Wed = 4, Thu = 5, Fri = 6, Sat = 7, Sun = 8
 * Robustly parses local date parts to prevent UTC midnight shifts.
 */
export function getDayOfWeekFromDate(dateInput: Date | string = new Date()): number {
  if (!dateInput) return 2;
  if (typeof dateInput === 'string') {
    const cleanDate = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
    const parts = cleanDate.trim().split('-');
    if (parts.length < 3) return 2;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const date = new Date(year, month, day);
    const jsDay = date.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday

    if (jsDay === 0) return 8; // Chủ nhật
    return jsDay + 1; // 1 -> 2 (Thứ 2), 2 -> 3 (Thứ 3), ..., 6 -> 7 (Thứ 7)
  }

  const jsDay = dateInput.getDay();
  if (jsDay === 0) return 8;
  return jsDay + 1;
}

// Backward-compatibility aliases for legacy code
export interface TimetableSlot {
  periodIndex: number;
  subject: string;
  teacherId?: string;
  teacherName?: string;
  room?: string;
}

export interface TimetableDay {
  dayOfWeek: DayOfWeek;
  slots: TimetableSlot[];
}

export interface ClassTimetable {
  classId: string;
  academicYear: string;
  semester: number;
  days?: TimetableDay[];
  slots?: ScheduleSlot[];
  updatedAt: number;
  updatedBy: string;
}
