/**
 * Đơn xin nghỉ học của phụ huynh — hàm thuần, có test.
 * PH gửi đơn → GVCN duyệt → vắng P được điền sẵn vào sổ đầu bài lớp.
 * Mỗi PH tối đa LEAVE_MAX_PER_DAY đơn/ngày: id = `${uid}_${ngày}_${stt}` nên rules chặn được đơn thứ 6.
 */
import type { DailyLogbook, StudentAbsenceRecord } from '../types/logbook';

export type LeaveKind = 'day' | 'periods';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveReason = 'sick' | 'family' | 'other';

export interface StudentLeave {
  id: string; mhs: string; studentName: string; classId: string; parentUid: string; parentName: string;
  kind: LeaveKind; dates: string[]; periods: number[]; meal: boolean; reason: LeaveReason; note: string; status: LeaveStatus;
  day: number; seq: number; createdAt: number;
  decidedAt?: number; decidedBy?: string; decidedByName?: string; rejectReason?: string;
}

/** Bản tóm tắt đơn đã duyệt lưu trên sổ ngày; periods rỗng = cả ngày */
export interface ApprovedLeaveEntry { mhs: string; name: string; stt?: number; periods: number[]; meal: boolean }

export const LEAVE_MAX_PER_DAY = 5;
export const LEAVE_MAX_DAYS = 5;
export const LEAVE_AHEAD_DAYS = 14;
const NOTE_MAX = 300;
export const LEAVE_APPROVED_NOTE = 'Đơn PH đã duyệt';

export function leaveDay(ms: number): number {
  return Math.floor(ms / 86400000);
}

export function leaveId(uid: string, day: number, seq: number): string {
  return `${uid}_${day}_${seq}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Giờ địa phương, không dùng UTC để tránh lệch ngày
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** `count` ngày học liên tiếp từ startIso (gồm cả startIso nếu không phải CN); bỏ Chủ nhật, thứ Bảy vẫn học. */
export function schoolDates(startIso: string, count: number): string[] {
  const out: string[] = [];
  const d = fromIso(startIso);
  while (out.length < count) {
    if (d.getDay() !== 0) out.push(toIso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Nghỉ cả ngày → mặc định không ăn trưa; nghỉ vài tiết → mặc định vẫn ăn. */
export function defaultMeal(kind: LeaveKind): boolean {
  return kind === 'periods';
}

/** YYYY-MM-DD đúng định dạng và là ngày có thật (không tràn tháng) */
export function isValidIso(x: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = fromIso(x);
  return !Number.isNaN(d.getTime()) && toIso(d) === x;
}

/** Trả về thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ. */
export function validateLeaveInput(
  i: { kind: LeaveKind; dates: string[]; periods: number[]; note: string },
  todayIso: string
): string | null {
  if (!i.dates.length) return 'Vui lòng chọn ngày nghỉ.';
  if (i.dates.length > LEAVE_MAX_DAYS) return `Mỗi đơn tối đa ${LEAVE_MAX_DAYS} ngày.`;
  if (i.dates.some((x) => !isValidIso(x))) return 'Ngày nghỉ không hợp lệ.';
  const today = fromIso(todayIso);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + LEAVE_AHEAD_DAYS);
  for (const iso of i.dates) {
    const d = fromIso(iso);
    if (d < today) return 'Không thể xin nghỉ cho ngày đã qua.';
    if (d > limit) return `Chỉ được xin nghỉ trước tối đa ${LEAVE_AHEAD_DAYS} ngày.`;
  }
  if (i.kind === 'periods') {
    if (!i.periods.length) return 'Vui lòng chọn các tiết nghỉ.';
    if (i.dates.length !== 1) return 'Nghỉ theo tiết chỉ áp dụng cho 1 ngày.';
    if (i.periods.some((p) => !Number.isInteger(p) || p < 1 || p > 8)) return 'Tiết nghỉ phải từ 1 đến 8.';
  }
  if ((i.note || '').length > NOTE_MAX) return `Ghi chú tối đa ${NOTE_MAX} ký tự.`;
  return null;
}

/** periods rỗng = nghỉ cả ngày */
export function leaveCoversPeriod(e: ApprovedLeaveEntry, period: number): boolean {
  return e.periods.length === 0 || e.periods.includes(period);
}

/** HS có đơn phủ BẤT KỲ tiết nào trong danh sách → bản ghi vắng có phép (P). */
export function leaveAbsencesForPeriods(
  map: Record<string, ApprovedLeaveEntry> | undefined,
  periods: number[]
): StudentAbsenceRecord[] {
  const out: StudentAbsenceRecord[] = [];
  const seen = new Set<string>();
  for (const e of Object.values(map || {})) {
    if (seen.has(e.mhs)) continue;
    if (!periods.some((p) => leaveCoversPeriod(e, p))) continue;
    seen.add(e.mhs);
    out.push({
      studentId: e.mhs,
      studentName: e.name,
      ...(e.stt != null ? { studentNumber: e.stt } : {}),
      type: 'P',
      note: LEAVE_APPROVED_NOTE,
    });
  }
  return out;
}

export const SESSION_PERIODS = { morning: [1, 2, 3, 4], afternoon: [5, 6, 7, 8] } as const;

/** Điểm danh đầu buổi: chỉ HS có đơn phủ CẢ buổi (đơn cả ngày, hoặc đủ 4 tiết của buổi) → vắng P. */
export function leaveAbsencesForSession(
  map: Record<string, ApprovedLeaveEntry> | undefined,
  session: 'morning' | 'afternoon'
): StudentAbsenceRecord[] {
  const periods = SESSION_PERIODS[session];
  const whole: Record<string, ApprovedLeaveEntry> = {};
  for (const [k, e] of Object.entries(map || {})) {
    if (periods.every((p) => leaveCoversPeriod(e, p))) whole[k] = e;
  }
  return leaveAbsencesForPeriods(whole, [...periods]);
}

/**
 * Baseline buổi chưa được GVCN báo. Sổ ngày luôn có baseline trống (createEmptyBaseline, có reportedAt),
 * nên dấu hiệu tin cậy là thiếu reportedByName — mọi lần lưu điểm danh đầu buổi đều ghi field này
 * (cùng tiêu chí với isBlankBaseline trong firestore.rules).
 */
export function isUnreportedBaseline(b: { reportedByName?: string } | null | undefined): boolean {
  return !b || !b.reportedByName;
}

/** Giữ bản ghi đã có (GV đã chọn), chỉ thêm HS chưa có. */
export function mergeLeaveAbsences(existing: StudentAbsenceRecord[], fromLeave: StudentAbsenceRecord[]): StudentAbsenceRecord[] {
  const have = new Set(existing.map((a) => a.studentId));
  return [...existing, ...fromLeave.filter((a) => !have.has(a.studentId))];
}

export interface ReconcileWarning { mhs: string; name: string; periods: number[]; types: string[] }

/**
 * Cảnh báo HS vắng không phép (K) ở tiết nhưng không có trong điểm danh đầu buổi và không có đơn phủ tiết đó.
 * Tiết thiếu `absentees` (doc cũ) bị bỏ qua.
 */
export function reconcileDaily(
  d: Pick<DailyLogbook, 'morningBaseline' | 'afternoonBaseline' | 'periodAttendance'> & { approvedLeaves?: Record<string, ApprovedLeaveEntry> }
): ReconcileWarning[] {
  const inBaseline = new Set<string>();
  for (const b of [d.morningBaseline, d.afternoonBaseline]) for (const a of b?.absences || []) inBaseline.add(a.studentId);
  const leaves = Object.values(d.approvedLeaves || {});
  const byMhs = new Map<string, ReconcileWarning>();
  for (const [key, s] of Object.entries(d.periodAttendance || {})) {
    const period = Number(key);
    for (const a of s?.absentees || []) {
      if (a.type !== 'K' || inBaseline.has(a.mhs)) continue;
      if (leaves.some((e) => e.mhs === a.mhs && leaveCoversPeriod(e, period))) continue;
      const w = byMhs.get(a.mhs) ?? { mhs: a.mhs, name: a.name, periods: [], types: [] };
      w.periods.push(period);
      if (!w.types.includes(a.type)) w.types.push(a.type);
      byMhs.set(a.mhs, w);
    }
  }
  return [...byMhs.values()].map((w) => ({ ...w, periods: w.periods.sort((x, y) => x - y) }));
}

/** Đơn đã duyệt, ngày dateIso, HS không ăn trưa (meal === false) — danh sách cho bếp, nhóm theo lớp. */
export function mealSummary(leaves: StudentLeave[], dateIso: string): { total: number; byClass: Array<{ classId: string; students: string[] }> } {
  const map = new Map<string, string[]>();
  let total = 0;
  for (const l of leaves) {
    if (l.status !== 'approved' || l.meal !== false || !l.dates.includes(dateIso)) continue;
    total++;
    map.set(l.classId, [...(map.get(l.classId) || []), l.studentName]);
  }
  const byClass = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'vi', { numeric: true }))
    .map(([classId, students]) => ({ classId, students }));
  return { total, byClass };
}

/** Xoá mọi key sessionStorage `ums_leave_*` (cache đơn nghỉ) — dùng khi đăng xuất. */
export function clearLeaveSessionKeys(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('ums_leave_')) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // bỏ qua
  }
}
