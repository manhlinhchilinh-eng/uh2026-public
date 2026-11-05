/**
 * TKB cho phụ huynh / học sinh (góp ý sau demo 05/11: PH/HS không xem được TKB của con).
 * Hàm thuần: lấy 8 tiết của 1 thứ từ TKB lớp; thứ mặc định = hôm nay (T7/CN → Thứ Hai).
 */
import type { ClassSchedule } from '../types/schedule';

export interface FamilyPeriodRow {
  periodIndex: number;
  subject: string;
  teacherName: string;
}

/** Thứ theo quy ước app (2 = Thứ Hai … 6 = Thứ Sáu); cuối tuần → Thứ Hai tuần sau */
export function defaultSchoolDay(now: Date = new Date()): number {
  const wd = now.getDay(); // 0 = CN
  return wd === 0 || wd === 6 ? 2 : wd + 1;
}

export function dayTimetable(schedule: Pick<ClassSchedule, 'slots'> | null | undefined, dayOfWeek: number): FamilyPeriodRow[] {
  const slots = (schedule?.slots || []).filter((s) => s.dayOfWeek === dayOfWeek);
  return [1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
    const s = slots.find((x) => x.periodIndex === p);
    return { periodIndex: p, subject: s?.subject?.trim() || '', teacherName: s?.teacherName?.trim() || '' };
  });
}

/** Có TKB thật không (bản rỗng = chưa tải được / chưa có TKB) */
export const hasTimetable = (schedule: Pick<ClassSchedule, 'slots'> | null | undefined) => (schedule?.slots?.length ?? 0) > 0;
