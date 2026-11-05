/**
 * Dạy thay — hàm thuần.
 * Thời khóa biểu thật chỉ ghi tên rút gọn của GV (vd. "Ms P.Anh"), không gắn tài khoản,
 * nên gợi ý tiết dựa trên "tên trên TKB" do BGH khai trong hồ sơ phép.
 */

import type { ScheduleSlot } from '../types/schedule';
import type { SubstitutionPlan } from '../types/substitution';
import { addDays, isWorkingDay, parseISO } from './leavePolicy';

/** 'YYYY-MM-DD' → thứ theo quy ước TKB: 2 = Thứ Hai … 6 = Thứ Sáu. */
export function scheduleDayOf(iso: string): number {
  const wd = parseISO(iso).getUTCDay(); // 0 = CN
  return wd === 0 ? 8 : wd + 1;
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/** Tiết của GV (theo tên trên TKB) trong khoảng ngày nghỉ, bỏ cuối tuần/ngày lễ. */
export function suggestPeriods(
  schedules: Array<{ classId: string; slots: ScheduleSlot[] }>,
  timetableName: string | undefined,
  startDate: string,
  endDate: string,
  holidays: string[] = []
): Array<Omit<SubstitutionPlan, 'substituteUid' | 'substituteName'>> {
  if (!timetableName?.trim() || startDate > endDate) return [];
  const target = norm(timetableName);
  const out: Array<Omit<SubstitutionPlan, 'substituteUid' | 'substituteName'>> = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    if (!isWorkingDay(d, holidays)) continue;
    const dow = scheduleDayOf(d);
    for (const sch of schedules) {
      for (const s of sch.slots) {
        if (s.dayOfWeek === dow && norm(s.teacherName || '') === target) {
          out.push({ date: d, classId: sch.classId, periodIndex: s.periodIndex, subject: s.subject });
        }
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.periodIndex - b.periodIndex || a.classId.localeCompare(b.classId));
}

export const substitutionKey = (p: Pick<SubstitutionPlan, 'date' | 'classId' | 'periodIndex'>) => `${p.date}_${p.classId}_${p.periodIndex}`;

/** Kiểm tra kế hoạch dạy thay trước khi gửi đơn. */
export function validatePlans(plans: SubstitutionPlan[], range: { startDate: string; endDate: string }, absentUid: string): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const busy = new Map<string, number>(); // người dạy thay + ngày + tiết → dòng đầu tiên
  plans.forEach((p, i) => {
    const row = `Dòng dạy thay ${i + 1}`;
    if (p.date < range.startDate || p.date > range.endDate) errors.push(`${row}: ngày ${p.date} nằm ngoài thời gian nghỉ.`);
    if (!p.classId.trim()) errors.push(`${row}: chưa chọn lớp.`);
    if (!(p.periodIndex >= 1 && p.periodIndex <= 8)) errors.push(`${row}: tiết phải từ 1 đến 8.`);
    if (!p.substituteUid) errors.push(`${row}: chưa chọn GV dạy thay.`);
    if (p.substituteUid && p.substituteUid === absentUid) errors.push(`${row}: không thể tự dạy thay cho mình.`);
    const k = substitutionKey(p);
    if (seen.has(k)) errors.push(`${row}: trùng tiết ${p.periodIndex} lớp ${p.classId} ngày ${p.date}.`);
    seen.add(k);
    if (p.substituteUid) {
      const slot = `${p.substituteUid}_${p.date}_${p.periodIndex}`;
      if (busy.has(slot)) errors.push(`${row}: ${p.substituteName || 'GV dạy thay'} đã được xếp dạy thay tiết ${p.periodIndex} ngày ${p.date} ở dòng ${busy.get(slot)! + 1}.`);
      else busy.set(slot, i);
    }
  });
  return errors;
}

/** Nhãn hiển thị trên Sổ đầu bài cho từng tiết của 1 lớp trong 1 ngày (chỉ kế hoạch đã duyệt). */
export function substituteLabels(
  subs: Array<{ classId: string; date: string; periodIndex: number; substituteName: string; absentName: string; status: string }>,
  classId: string,
  date: string
): Record<number, string> {
  const map: Record<number, string> = {};
  for (const s of subs) {
    if (s.status === 'approved' && s.classId === classId && s.date === date) {
      map[s.periodIndex] = `Dạy thay: ${s.substituteName} (thay ${s.absentName})`;
    }
  }
  return map;
}
