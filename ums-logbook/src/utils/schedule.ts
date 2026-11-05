/**
 * UMS Digital Class Logbook - Bell Schedule & Real-Time Resolution Utilities
 * Official UMS Middle School Timing (4 morning + 4 afternoon periods)
 */

export interface BellSlot {
  periodIndex: number; // 1 to 8
  session: 'morning' | 'afternoon';
  startTime: string; // 'HH:mm'
  endTime: string;   // 'HH:mm'
  startMinutes: number; // Minutes from 00:00
  endMinutes: number;   // Minutes from 00:00
  labelVi: string;
}

export type BreakType = 'morning_recess' | 'afternoon_recess' | 'lunch' | 'changeover';

export interface BreakSlot {
  type: BreakType;
  labelVi: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  session: 'morning' | 'afternoon' | 'off';
  precedingPeriod: number;
  succeedingPeriod: number;
}

export interface BellPeriodResolution {
  activePeriod: number | null;
  nextPeriod: number | null;
  isBreak: boolean;
  isSchoolHours: boolean;
  session: 'morning' | 'afternoon' | 'off';
  breakType?: BreakType | null;
  breakLabel?: string | null;
  timeRemainingInPeriodMs?: number;
  timeUntilNextPeriodMs?: number;
  currentMinutes?: number;
}

export const UMS_BELL_SCHEDULE: readonly BellSlot[] = [
  { periodIndex: 1, session: 'morning', startTime: '07:30', endTime: '08:15', startMinutes: 450, endMinutes: 495, labelVi: 'Tiết 1' },
  { periodIndex: 2, session: 'morning', startTime: '08:25', endTime: '09:10', startMinutes: 505, endMinutes: 550, labelVi: 'Tiết 2' },
  { periodIndex: 3, session: 'morning', startTime: '09:20', endTime: '10:05', startMinutes: 560, endMinutes: 605, labelVi: 'Tiết 3' },
  { periodIndex: 4, session: 'morning', startTime: '10:15', endTime: '11:00', startMinutes: 615, endMinutes: 660, labelVi: 'Tiết 4' },
  { periodIndex: 5, session: 'afternoon', startTime: '13:00', endTime: '13:45', startMinutes: 780, endMinutes: 825, labelVi: 'Tiết 5' },
  { periodIndex: 6, session: 'afternoon', startTime: '13:50', endTime: '14:35', startMinutes: 830, endMinutes: 875, labelVi: 'Tiết 6' },
  { periodIndex: 7, session: 'afternoon', startTime: '14:45', endTime: '15:30', startMinutes: 885, endMinutes: 930, labelVi: 'Tiết 7' },
  { periodIndex: 8, session: 'afternoon', startTime: '15:35', endTime: '16:20', startMinutes: 935, endMinutes: 980, labelVi: 'Tiết 8' },
];

export const UMS_BREAKS: readonly BreakSlot[] = [
  { type: 'changeover', labelVi: 'Chuyển tiết (10 phút)', startTime: '08:15', endTime: '08:25', startMinutes: 495, endMinutes: 505, durationMinutes: 10, session: 'morning', precedingPeriod: 1, succeedingPeriod: 2 },
  { type: 'morning_recess', labelVi: 'Ra chơi sáng (10 phút)', startTime: '09:10', endTime: '09:20', startMinutes: 550, endMinutes: 560, durationMinutes: 10, session: 'morning', precedingPeriod: 2, succeedingPeriod: 3 },
  { type: 'changeover', labelVi: 'Chuyển tiết (10 phút)', startTime: '10:05', endTime: '10:15', startMinutes: 605, endMinutes: 615, durationMinutes: 10, session: 'morning', precedingPeriod: 3, succeedingPeriod: 4 },
  { type: 'lunch', labelVi: 'Nghỉ trưa (120 phút)', startTime: '11:00', endTime: '13:00', startMinutes: 660, endMinutes: 780, durationMinutes: 120, session: 'off', precedingPeriod: 4, succeedingPeriod: 5 },
  { type: 'changeover', labelVi: 'Chuyển tiết (5 phút)', startTime: '13:45', endTime: '13:50', startMinutes: 825, endMinutes: 830, durationMinutes: 5, session: 'afternoon', precedingPeriod: 5, succeedingPeriod: 6 },
  { type: 'afternoon_recess', labelVi: 'Ra chơi chiều (10 phút)', startTime: '14:35', endTime: '14:45', startMinutes: 875, endMinutes: 885, durationMinutes: 10, session: 'afternoon', precedingPeriod: 6, succeedingPeriod: 7 },
  { type: 'changeover', labelVi: 'Chuyển tiết (5 phút)', startTime: '15:30', endTime: '15:35', startMinutes: 930, endMinutes: 935, durationMinutes: 5, session: 'afternoon', precedingPeriod: 7, succeedingPeriod: 8 },
];

/**
 * Parses "HH:mm" time string into total minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Formats minutes from midnight into "HH:mm"
 */
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Gets Vietnamese Day of Week index (Thứ 2 = 2, ..., Thứ 7 = 7, Chủ nhật = 8)
 */
export function getDayOfWeekFromDate(dateInput: Date | string = new Date()): number {
  if (typeof dateInput === 'string') {
    const cleanDate = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
    const parts = cleanDate.trim().split('-');
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const jsDay = d.getDay();
      if (jsDay === 0) return 8;
      return jsDay + 1;
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const jsDay = d.getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
  if (jsDay === 0) return 8; // Chủ Nhật
  return jsDay + 1; // 1 (Mon) -> 2 (Thứ 2), 5 (Fri) -> 6 (Thứ 6)
}

export function getDayOfWeekVi(day: number): string {
  switch (day) {
    case 2: return 'Thứ Hai';
    case 3: return 'Thứ Ba';
    case 4: return 'Thứ Tư';
    case 5: return 'Thứ Năm';
    case 6: return 'Thứ Sáu';
    case 7: return 'Thứ Bảy';
    case 8:
    case 1:
    case 0:
      return 'Chủ Nhật';
    default: return `Thứ ${day}`;
  }
}

/**
 * Resolves current bell schedule period and state based on local time
 */
export function resolveCurrentBellPeriod(date: Date = new Date()): BellPeriodResolution {
  const jsDay = date.getDay();
  // Saturday (6) and Sunday (0) are outside standard timetable operations
  const isWeekend = jsDay === 0 || jsDay === 6;

  if (isWeekend) {
    return {
      activePeriod: null,
      nextPeriod: null,
      isBreak: false,
      isSchoolHours: false,
      session: 'off',
      breakType: null,
      breakLabel: null,
      timeRemainingInPeriodMs: 0,
      timeUntilNextPeriodMs: 0,
    };
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const currentMinutes = hours * 60 + minutes;
  const currentMsFromMidnight = (hours * 3600 + minutes * 60 + seconds) * 1000;

  // 1. Check if inside an active period
  for (const slot of UMS_BELL_SCHEDULE) {
    if (currentMinutes >= slot.startMinutes && currentMinutes < slot.endMinutes) {
      const endMs = slot.endMinutes * 60 * 1000;
      const timeRemaining = Math.max(0, endMs - currentMsFromMidnight);
      return {
        activePeriod: slot.periodIndex,
        nextPeriod: slot.periodIndex < 8 ? slot.periodIndex + 1 : null,
        isBreak: false,
        isSchoolHours: true,
        session: slot.session,
        breakType: null,
        breakLabel: null,
        timeRemainingInPeriodMs: timeRemaining,
        currentMinutes,
      };
    }
  }

  // 2. Check if during a break / recess
  for (const b of UMS_BREAKS) {
    if (currentMinutes >= b.startMinutes && currentMinutes < b.endMinutes) {
      const nextSlot = UMS_BELL_SCHEDULE.find((s) => s.periodIndex === b.succeedingPeriod);
      const nextStartMs = (nextSlot ? nextSlot.startMinutes : b.endMinutes) * 60 * 1000;
      const timeUntilNext = Math.max(0, nextStartMs - currentMsFromMidnight);

      return {
        activePeriod: null,
        nextPeriod: b.succeedingPeriod,
        isBreak: true,
        isSchoolHours: b.type !== 'lunch', // Lunch break is midday off-hours
        session: b.session,
        breakType: b.type,
        breakLabel: b.labelVi,
        timeUntilNextPeriodMs: timeUntilNext,
        currentMinutes,
      };
    }
  }

  // 3. Before Period 1 (Early Morning)
  if (currentMinutes < 450) {
    const period1StartMs = 450 * 60 * 1000;
    return {
      activePeriod: null,
      nextPeriod: 1,
      isBreak: false,
      isSchoolHours: false,
      session: 'off',
      breakType: null,
      breakLabel: null,
      timeUntilNextPeriodMs: Math.max(0, period1StartMs - currentMsFromMidnight),
      currentMinutes,
    };
  }

  // 4. After Period 8 (Evening / Night)
  return {
    activePeriod: null,
    nextPeriod: null,
    isBreak: false,
    isSchoolHours: false,
    session: 'off',
    breakType: null,
    breakLabel: null,
    timeRemainingInPeriodMs: 0,
    timeUntilNextPeriodMs: 0,
    currentMinutes,
  };
}

/**
 * Returns formatted time string: "07:15 - 08:00"
 */
export function getPeriodTimeRange(periodIndex: number): string {
  const slot = UMS_BELL_SCHEDULE.find((s) => s.periodIndex === periodIndex);
  if (!slot) return '';
  return `${slot.startTime} - ${slot.endTime}`;
}

export function isWithinPeriod(timeStr: string, periodIndex: number): boolean {
  const minutes = parseTimeToMinutes(timeStr);
  const slot = UMS_BELL_SCHEDULE.find((s) => s.periodIndex === periodIndex);
  if (!slot) return false;
  return minutes >= slot.startMinutes && minutes < slot.endMinutes;
}
