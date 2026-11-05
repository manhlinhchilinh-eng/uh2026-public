/**
 * Bảng công đối soát — hàm thuần.
 * [UMS] Bảng công gửi ngày 01–05 hằng tháng; GV kiểm tra, phản hồi trong 03 ngày làm việc kể từ khi nhận;
 *       quá hạn không phản hồi → mặc nhiên xác nhận. Ngày công chuẩn: 22 ngày/tháng.
 */

import type { LeaveRequest, LeaveType } from '../types/leave';
import type { LeaveBreakdown, TimesheetRecord, TimesheetRecordStatus } from '../types/timesheet';
import { addDays, countWorkingDays, isWorkingDay, parseISO, toISO } from './leavePolicy';

export const STANDARD_DAYS = 22; // [UMS]
export const REVIEW_WORKING_DAYS = 3; // [UMS]

export const LEAVE_CODE: Record<LeaveType, string> = {
  annual: 'P',
  sick_self: 'Ô',
  sick_child: 'CÔ',
  maternity: 'TS',
  unpaid: 'KL',
};

export const RECORD_STATUS_LABEL: Record<TimesheetRecordStatus, string> = {
  pending: 'Chờ đối soát',
  confirmed: 'Đã xác nhận',
  disputed: 'Khiếu nại',
  resolved: 'Đã xử lý khiếu nại',
  auto_confirmed: 'Mặc nhiên xác nhận',
};

export function monthRange(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map(Number);
  const start = `${period}-01`;
  const end = toISO(new Date(Date.UTC(y, m, 0)));
  return { start, end };
}

export const isValidPeriod = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

/** Kỳ công mặc định khi phát hành đầu tháng: tháng trước. */
export function previousPeriod(today: string): string {
  const d = parseISO(today);
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return toISO(prev).slice(0, 7);
}

/** Số ngày làm việc của 1 đơn nằm trong tháng. */
export function leaveDaysInPeriod(r: Pick<LeaveRequest, 'startDate' | 'endDate'>, period: string, holidays: string[] = []): number {
  const { start, end } = monthRange(period);
  const s = r.startDate > start ? r.startDate : start;
  const e = r.endDate < end ? r.endDate : end;
  return s > e ? 0 : countWorkingDays(s, e, holidays);
}

const emptyBreakdown = (): LeaveBreakdown => ({ annual: 0, unpaid: 0, sick_self: 0, sick_child: 0, maternity: 0 });

/** Dòng bảng công của 1 nhân sự từ các đơn ĐÃ DUYỆT. */
export function buildRecord(
  person: { uid: string; displayName: string },
  approvedLeaves: LeaveRequest[],
  period: string,
  holidays: string[] = [],
  standardDays = STANDARD_DAYS
): TimesheetRecord {
  const leave = emptyBreakdown();
  for (const r of approvedLeaves) {
    if (r.requesterId !== person.uid || r.status !== 'approved') continue;
    leave[r.type] += leaveDaysInPeriod(r, period, holidays);
  }
  const total = Object.values(leave).reduce((a, b) => a + b, 0);
  return {
    uid: person.uid,
    displayName: person.displayName,
    standardDays,
    leave,
    workedDays: Math.max(0, standardDays - total),
    status: 'pending',
  };
}

/** Hạn đối soát: ngày làm việc thứ 3 sau ngày phát hành (không tính ngày phát hành). */
export function reviewDeadline(publishDate: string, holidays: string[] = [], workingDays = REVIEW_WORKING_DAYS): string {
  let d = publishDate;
  let n = 0;
  while (n < workingDays) {
    d = addDays(d, 1);
    if (isWorkingDay(d, holidays)) n++;
  }
  return d;
}

/** Mốc ms cuối ngày hạn theo giờ Việt Nam (UTC+7) — dùng cho rules. */
export function deadlineEndMs(deadline: string): number {
  return parseISO(deadline).getTime() + 24 * 3600_000 - 7 * 3600_000 - 1;
}

/** Số ngày làm việc còn lại tới hạn (tính cả hôm nay nếu là ngày làm việc). */
export function workingDaysLeft(today: string, deadline: string, holidays: string[] = []): number {
  if (today > deadline) return 0;
  return countWorkingDays(today, deadline, holidays);
}

/** Trạng thái hiển thị: quá hạn mà chưa phản hồi → mặc nhiên xác nhận. */
export function effectiveStatus(r: Pick<TimesheetRecord, 'status'>, today: string, deadline: string): TimesheetRecordStatus {
  if (r.status === 'pending' && today > deadline) return 'auto_confirmed';
  return r.status;
}

export function finalWorkedDays(r: TimesheetRecord): number {
  return r.adjustedWorkedDays ?? r.workedDays;
}

/** CSV cho Tổ Tài chính (UTF-8 BOM để Excel đọc đúng tiếng Việt). */
export function timesheetCsv(period: string, records: TimesheetRecord[], today: string, deadline: string): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Kỳ công', 'Họ tên', 'Công chuẩn', 'P', 'Ô', 'CÔ', 'TS', 'KL', 'Ngày làm thực tế', 'Trạng thái', 'Khiếu nại', 'Xử lý'];
  const rows = [...records]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'))
    .map((r) =>
      [
        period, r.displayName, r.standardDays, r.leave.annual, r.leave.sick_self, r.leave.sick_child, r.leave.maternity, r.leave.unpaid,
        finalWorkedDays(r), RECORD_STATUS_LABEL[effectiveStatus(r, today, deadline)], r.disputeReason || '', r.resolutionNote || '',
      ].map(esc).join(',')
    );
  return '﻿' + [head.map(esc).join(','), ...rows].join('\r\n') + '\r\n';
}

export interface TimesheetDetail {
  /** Các đơn nghỉ ĐÃ DUYỆT có ngày rơi vào kỳ công */
  leaves: Array<{ id: string; type: LeaveType; from: string; to: string; days: number }>;
  /** Số tiết đã ký sổ đầu bài trong kỳ */
  signedPeriods: number;
  /** Tiết đã ký theo lớp, vd. [{ classId: '9A2', count: 12 }] */
  byClass: Array<{ classId: string; count: number }>;
}

/**
 * Chi tiết 1 dòng bảng công (lỗi: bảng công chỉ có tổng, không rõ nghỉ ngày nào, dạy bao nhiêu tiết).
 * Tính trên máy từ đơn nghỉ đã duyệt + tiết đã ký (mã sổ `<lớp>_<yyyy-mm-dd>`), không ghi gì lên Firestore.
 */
export function timesheetDetail(
  period: string,
  leaves: LeaveRequest[],
  periods: Array<{ dailyId?: string; isSigned: boolean }>,
  holidays: string[] = []
): TimesheetDetail {
  const { start, end } = monthRange(period);
  const leaveRows = leaves
    .filter((r) => r.status === 'approved' && r.startDate <= end && r.endDate >= start)
    .map((r) => ({
      id: r.id,
      type: r.type,
      from: r.startDate < start ? start : r.startDate,
      to: r.endDate > end ? end : r.endDate,
      days: leaveDaysInPeriod(r, period, holidays),
    }))
    .sort((a, b) => a.from.localeCompare(b.from));
  const byClass = new Map<string, number>();
  let signed = 0;
  for (const p of periods) {
    if (!p.isSigned || !p.dailyId) continue;
    const [classId, ...rest] = p.dailyId.split('_');
    const date = rest.join('_');
    if (date < start || date > end) continue;
    signed++;
    byClass.set(classId, (byClass.get(classId) ?? 0) + 1);
  }
  return {
    leaves: leaveRows,
    signedPeriods: signed,
    byClass: [...byClass].map(([classId, count]) => ({ classId, count })).sort((a, b) => a.classId.localeCompare(b.classId, 'vi', { numeric: true })),
  };
}
