/**
 * Quy tắc xin nghỉ — hàm thuần, không gọi Firebase.
 *
 * Nguồn:
 *  [UMS]  "Hướng dẫn chế độ liên quan đến công tác tính lương" (PDF của trường).
 *  [LUẬT] Quy định pháp luật, PDF không nêu — chỉ để THAM KHẢO, Nhân sự xác nhận.
 *  [NỘI BỘ] Quy định do nhà trường đặt trên hệ thống (cấu hình được).
 */

import type { ChildInfo, LeavePolicy, LeaveRequest, LeaveType, NewLeaveInput, Treatment } from '../types/leave';

export const DEFAULT_LEAVE_POLICY: LeavePolicy = {
  annualBaseDays: 12, // [LUẬT] Đ.113 BLLĐ 2019 — CHỜ người dùng xác nhận số của trường
  annualBaseConfirmed: false,
  sickDocsDeadlineDays: 30, // [NỘI BỘ]
  holidays: [],
};

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: 'Nghỉ phép năm',
  unpaid: 'Nghỉ không hưởng lương',
  sick_self: 'Nghỉ ốm (bản thân)',
  sick_child: 'Nghỉ chăm con ốm',
  maternity: 'Nghỉ thai sản',
};

// ---------------------------------------------------------------------------
// Ngày tháng (dùng UTC để không lệch múi giờ)
// ---------------------------------------------------------------------------
const DAY = 86_400_000;
export const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const toISO = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number): string => toISO(new Date(parseISO(iso).getTime() + n * DAY));
export const isValidISO = (iso: string | undefined): iso is string =>
  !!iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) && toISO(parseISO(iso)) === iso;

/** Ngày làm việc: Thứ 2–Thứ 6, không phải ngày lễ. */
export function isWorkingDay(iso: string, holidays: string[] = []): boolean {
  const wd = parseISO(iso).getUTCDay();
  return wd !== 0 && wd !== 6 && !holidays.includes(iso);
}

/** Số ngày làm việc trong [start, end] (bao gồm 2 đầu). [UMS] tính ốm theo ngày làm việc. */
export function countWorkingDays(start: string, end: string, holidays: string[] = []): number {
  if (parseISO(end) < parseISO(start)) return 0;
  let n = 0;
  for (let d = start; parseISO(d) <= parseISO(end); d = addDays(d, 1)) if (isWorkingDay(d, holidays)) n++;
  return n;
}

/** Số ngày làm việc báo trước: các ngày làm việc từ hôm nay tới hết ngày trước ngày nghỉ. */
export function noticeWorkingDays(today: string, start: string, holidays: string[] = []): number {
  return countWorkingDays(today, addDays(start, -1), holidays);
}

/**
 * [UMS] Nghỉ 1 ngày: báo trước ≥1 ngày làm việc. Nghỉ ≥2 ngày: báo trước ≥2 ngày làm việc.
 * Đột xuất (ốm, tai nạn, sự cố): báo ngay khi có thể, bổ sung giấy tờ sau.
 */
export function checkNotice(p: { today: string; start: string; workingDays: number; isEmergency: boolean; holidays?: string[] }) {
  const required = p.workingDays >= 2 ? 2 : 1;
  const given = noticeWorkingDays(p.today, p.start, p.holidays);
  if (p.isEmergency) {
    return { ok: true, required, given, message: 'Nghỉ đột xuất: báo ngay khi có thể và bổ sung giấy tờ sau khi trở lại làm việc.' };
  }
  const ok = given >= required;
  return {
    ok,
    required,
    given,
    message: ok
      ? null
      : `Quy định: nghỉ ${p.workingDays >= 2 ? 'từ 2 ngày' : '1 ngày'} phải xin trước ít nhất ${required} ngày làm việc (hiện còn ${given}). Nếu là việc đột xuất, chọn "Nghỉ đột xuất".`,
  };
}

// ---------------------------------------------------------------------------
// Phép năm
// ---------------------------------------------------------------------------
export function fullYearsBetween(from: string, to: string): number {
  const a = parseISO(from);
  const b = parseISO(to);
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) y--;
  return Math.max(0, y);
}

/**
 * [UMS] Cứ đủ 5 năm làm việc +1 ngày phép.
 * [UMS] Làm chưa đủ 12 tháng: (phép cơ bản + phép thâm niên) / 12 × số tháng làm việc thực tế.
 * Thâm niên tính đến 31/12 của năm xét; số tháng làm trong năm đầu tính từ tháng bắt đầu làm.
 */
export function annualEntitlement(base: number, year: number, employmentStartDate?: string) {
  if (!isValidISO(employmentStartDate)) {
    return { days: base, seniorityBonus: 0, monthsWorked: 12, prorated: false, missingStartDate: true };
  }
  const start = parseISO(employmentStartDate);
  const seniorityBonus = Math.floor(fullYearsBetween(employmentStartDate, `${year}-12-31`) / 5);
  if (start.getUTCFullYear() > year) return { days: 0, seniorityBonus: 0, monthsWorked: 0, prorated: true, missingStartDate: false };
  const monthsWorked = start.getUTCFullYear() === year ? 12 - start.getUTCMonth() : 12;
  const full = base + seniorityBonus;
  const days = monthsWorked === 12 ? full : Math.round((full / 12) * monthsWorked * 10) / 10;
  return { days, seniorityBonus, monthsWorked, prorated: monthsWorked < 12, missingStartDate: false };
}

// ---------------------------------------------------------------------------
// Ốm đau
// ---------------------------------------------------------------------------
/** [UMS] <15 năm BHXH: 30 ngày/năm; 15–<30 năm: 40 ngày/năm. [LUẬT] ≥30 năm: 60 ngày/năm. */
export function sickSelfCap(bhxhYears?: number) {
  if (bhxhYears == null || Number.isNaN(bhxhYears)) return { days: 30, source: 'UMS' as const, assumed: true };
  if (bhxhYears < 15) return { days: 30, source: 'UMS' as const, assumed: false };
  if (bhxhYears < 30) return { days: 40, source: 'UMS' as const, assumed: false };
  return { days: 60, source: 'LUẬT' as const, assumed: false };
}

/** [UMS] Mỗi con: dưới 3 tuổi 20 ngày/năm; từ đủ 3 đến dưới 7 tuổi 15 ngày/năm; từ 7 tuổi không hưởng. */
export function sickChildCap(childDob: string, onDate: string): number {
  const age = fullYearsBetween(childDob, onDate);
  if (age < 3) return 20;
  if (age < 7) return 15;
  return 0;
}

// ---------------------------------------------------------------------------
// Thai sản (thông tin hướng dẫn, thời lượng tính theo tháng)
// ---------------------------------------------------------------------------
export function maternityGuide(p: { gender?: 'female' | 'male'; childOrder: number; babies?: number }): string {
  const babies = Math.max(1, p.babies ?? 1);
  if (p.gender === 'male') {
    if (p.childOrder >= 2) {
      const extra = babies >= 3 ? (babies - 2) * 3 : 0;
      return `[UMS] Lao động nam có vợ sinh con thứ hai: ${10 + extra} ngày làm việc${extra ? ' (gồm 3 ngày/con từ con thứ ba)' : ''}.`;
    }
    return '[LUẬT – tham khảo] Lao động nam có vợ sinh con: 5 ngày làm việc (sinh thường). Nhân sự xác nhận.';
  }
  const extra = babies - 1;
  if (p.childOrder >= 2) {
    return `[UMS] Sinh con thứ hai: tổng ${7 + extra} tháng, nghỉ trước sinh không quá 2 tháng${extra ? ` (gồm ${extra} tháng cho mỗi con từ con thứ hai)` : ''}.`;
  }
  return `[LUẬT – tham khảo] Sinh con: ${6 + extra} tháng, nghỉ trước sinh không quá 2 tháng. Nhân sự xác nhận.`;
}

// ---------------------------------------------------------------------------
// Giấy tờ
// ---------------------------------------------------------------------------
/** [UMS] Hồ sơ cần nộp theo loại nghỉ. */
export function requiredDocs(type: LeaveType, treatment?: Treatment): string[] {
  switch (type) {
    case 'sick_self':
      return treatment === 'inpatient'
        ? ['Giấy ra viện (bản chính hoặc bản sao công chứng)']
        : ['Giấy chứng nhận nghỉ việc hưởng BHXH do cơ sở y tế cấp'];
    case 'sick_child':
      return ['Giấy chứng nhận nghỉ việc hưởng BHXH (chăm con ốm) do cơ sở y tế cấp'];
    case 'maternity':
      return ['Giấy khai sinh hoặc giấy chứng sinh (bản sao có dấu đỏ)', 'Giấy ra viện (nếu mổ đẻ, có dấu đỏ)'];
    default:
      return [];
  }
}

/**
 * Hạn nộp giấy tờ:
 *  - Ốm: [NỘI BỘ] N ngày (mặc định 30) kể từ ngày đi làm lại (ngày sau ngày nghỉ cuối).
 *  - Thai sản: [UMS] muộn nhất 1 tháng sau sinh — ngày sinh chưa biết lúc nộp đơn → null, hiển thị hướng dẫn.
 */
export function docsDeadline(type: LeaveType, endDate: string, policy: LeavePolicy): string | null {
  if (type === 'sick_self' || type === 'sick_child') return addDays(endDate, 1 + policy.sickDocsDeadlineDays);
  return null;
}

export function daysUntil(today: string, target: string): number {
  return Math.round((parseISO(target).getTime() - parseISO(today).getTime()) / DAY);
}

// ---------------------------------------------------------------------------
// Số dư
// ---------------------------------------------------------------------------
const counts = (r: LeaveRequest) => r.status === 'approved' || r.status === 'pending';

export function usedDays(requests: LeaveRequest[], year: number, match: (r: LeaveRequest) => boolean) {
  const inYear = requests.filter((r) => counts(r) && r.startDate.startsWith(String(year)) && match(r));
  return {
    approved: inYear.filter((r) => r.status === 'approved').reduce((s, r) => s + r.workingDays, 0),
    pending: inYear.filter((r) => r.status === 'pending').reduce((s, r) => s + r.workingDays, 0),
  };
}

const sameChild = (a?: ChildInfo, b?: ChildInfo) => !!a && !!b && a.name === b.name && a.dob === b.dob;

export interface LeaveContext {
  today: string;
  policy: LeavePolicy;
  profile?: { employmentStartDate?: string; bhxhYears?: number; children?: ChildInfo[] };
  existing: LeaveRequest[];
}

/** Kiểm tra đơn: errors chặn gửi, warnings chỉ nhắc. */
export function validateLeave(input: NewLeaveInput, ctx: LeaveContext): { errors: string[]; warnings: string[]; workingDays: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isValidISO(input.startDate) || !isValidISO(input.endDate)) {
    return { errors: ['Ngày bắt đầu/kết thúc không hợp lệ.'], warnings, workingDays: 0 };
  }
  if (parseISO(input.endDate) < parseISO(input.startDate)) errors.push('Ngày kết thúc phải sau hoặc trùng ngày bắt đầu.');
  const workingDays = countWorkingDays(input.startDate, input.endDate, ctx.policy.holidays);
  if (input.type !== 'maternity' && workingDays === 0 && errors.length === 0) errors.push('Khoảng ngày đã chọn không có ngày làm việc nào.');
  if (!input.reason.trim()) errors.push('Vui lòng ghi lý do.');
  if (input.type === 'sick_self' && !input.treatment) errors.push('Chọn hình thức điều trị (nội trú / ngoại trú).');
  if (input.type === 'sick_child' && (!input.child?.name || !isValidISO(input.child?.dob))) errors.push('Chọn con bị ốm (họ tên, ngày sinh).');

  const overlap = ctx.existing.find(
    (r) => counts(r) && !(parseISO(r.endDate) < parseISO(input.startDate) || parseISO(r.startDate) > parseISO(input.endDate))
  );
  if (overlap) errors.push(`Trùng thời gian với đơn "${LEAVE_TYPE_LABEL[overlap.type]}" ${overlap.startDate} → ${overlap.endDate}.`);

  if (errors.length) return { errors, warnings, workingDays };

  const notice = checkNotice({ today: ctx.today, start: input.startDate, workingDays, isEmergency: input.isEmergency, holidays: ctx.policy.holidays });
  if (!notice.ok && notice.message) warnings.push(notice.message);
  if (input.isEmergency && notice.message) warnings.push(notice.message);

  const year = parseISO(input.startDate).getUTCFullYear();
  if (input.type === 'annual') {
    const ent = annualEntitlement(ctx.policy.annualBaseDays, year, ctx.profile?.employmentStartDate);
    const used = usedDays(ctx.existing, year, (r) => r.type === 'annual');
    const remaining = ent.days - used.approved - used.pending;
    if (workingDays > remaining) errors.push(`Vượt quỹ phép năm: còn ${remaining} ngày, xin ${workingDays} ngày. Phần vượt có thể làm đơn nghỉ không hưởng lương.`);
    if (!ctx.policy.annualBaseConfirmed) warnings.push('Số ngày phép năm cơ bản chưa được nhà trường xác nhận trên hệ thống.');
  }
  if (input.type === 'sick_self') {
    const cap = sickSelfCap(ctx.profile?.bhxhYears);
    const used = usedDays(ctx.existing, year, (r) => r.type === 'sick_self');
    if (used.approved + used.pending + workingDays > cap.days) {
      warnings.push(`Vượt trần hưởng BHXH ốm đau ${cap.days} ngày/năm — phần vượt không được BHXH chi trả.`);
    }
    if (cap.assumed) warnings.push('Chưa có số năm đóng BHXH trong hồ sơ — tạm tính trần 30 ngày.');
  }
  if (input.type === 'sick_child' && input.child) {
    const cap = sickChildCap(input.child.dob, input.startDate);
    const used = usedDays(ctx.existing, year, (r) => r.type === 'sick_child' && sameChild(r.child, input.child));
    if (cap === 0) warnings.push('Con từ đủ 7 tuổi không thuộc diện hưởng chế độ chăm con ốm.');
    else if (used.approved + used.pending + workingDays > cap) warnings.push(`Vượt trần chăm con ốm ${cap} ngày/năm cho con này — phần vượt không được BHXH chi trả.`);
  }
  return { errors, warnings, workingDays };
}

/** Đơn đã xử lý (duyệt/từ chối), mới nhất trước — "vết" để BGH tra lại sau khi duyệt. */
export function decidedHistory(requests: LeaveRequest[]): LeaveRequest[] {
  return requests
    .filter((r) => r.status === 'approved' || r.status === 'rejected')
    .sort((a, b) => (b.decisionAt ?? b.createdAt ?? 0) - (a.decisionAt ?? a.createdAt ?? 0));
}

export interface LeaveStats {
  approvedCount: number;
  approvedDays: number;
  pendingCount: number;
  rejectedCount: number;
  byType: Array<{ type: LeaveType; days: number; count: number }>;
}

/** Thống kê nghỉ trong khoảng ngày [start, end] (theo ngày bắt đầu nghỉ) cho hồ sơ năng lực / bảng công. */
export function leaveStatsInRange(requests: LeaveRequest[], start: string, end: string): LeaveStats {
  const inRange = requests.filter((r) => r.startDate >= start && r.startDate <= end);
  const approved = inRange.filter((r) => r.status === 'approved');
  const byTypeMap = new Map<LeaveType, { days: number; count: number }>();
  for (const r of approved) {
    const e = byTypeMap.get(r.type) ?? { days: 0, count: 0 };
    e.days += r.workingDays || 0;
    e.count++;
    byTypeMap.set(r.type, e);
  }
  return {
    approvedCount: approved.length,
    approvedDays: Math.round(approved.reduce((s, r) => s + (r.workingDays || 0), 0) * 10) / 10,
    pendingCount: inRange.filter((r) => r.status === 'pending').length,
    rejectedCount: inRange.filter((r) => r.status === 'rejected').length,
    byType: [...byTypeMap].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.days - a.days),
  };
}

/** Thời điểm hiển thị dd/mm/yyyy hh:mm (giờ máy) */
export function formatDecisionTime(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
