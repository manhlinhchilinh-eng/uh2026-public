/**
 * UMS SmartConnect - Bảng chấm công đối soát
 * /timesheets/{period}  (period = 'YYYY-MM')
 * /timesheets/{period}/records/{uid}
 */

import type { LeaveType } from './leave';

export type TimesheetRecordStatus = 'pending' | 'confirmed' | 'disputed' | 'resolved' | 'auto_confirmed';

export interface TimesheetPeriod {
  period: string; // 'YYYY-MM'
  standardDays: number; // [UMS] 22 ngày/tháng
  publishedAt: number;
  publishedBy: string;
  publishedByName: string;
  /** Hạn đối soát (ngày cuối cùng GV còn được phản hồi, YYYY-MM-DD) */
  reviewDeadline: string;
  /** Mốc thời gian hết hạn (ms) — dùng trong Firestore rules */
  reviewDeadlineAt: number;
  status: 'open' | 'closed';
  closedAt?: number;
}

export type LeaveBreakdown = Record<LeaveType, number>;

export interface TimesheetRecord {
  uid: string;
  displayName: string;
  standardDays: number;
  leave: LeaveBreakdown;
  /** Ngày làm việc thực tế = công chuẩn − tổng ngày nghỉ */
  workedDays: number;
  status: TimesheetRecordStatus;
  respondedAt?: number;
  disputeReason?: string;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: number;
  /** Số công điều chỉnh sau khi xử lý khiếu nại (nếu có) */
  adjustedWorkedDays?: number;
}
