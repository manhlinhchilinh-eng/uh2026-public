/**
 * UMS SmartConnect - Xin nghỉ online
 * Nguồn quy định: "Hướng dẫn chế độ liên quan đến công tác tính lương" (UMS) + luật hiện hành (ghi chú rõ).
 * Collections: /leave_requests/{id}, /leave_profiles/{uid}, /system_settings/leave_policy
 */

export type LeaveType = 'annual' | 'unpaid' | 'sick_self' | 'sick_child' | 'maternity';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type Treatment = 'inpatient' | 'outpatient';

export interface ChildInfo {
  name: string;
  dob: string; // YYYY-MM-DD
}

/** Hồ sơ nhân sự phục vụ tính phép — BGH/Nhân sự nhập. */
export interface LeaveProfile {
  uid: string;
  displayName: string;
  /** Ngày bắt đầu làm việc tại trường (tính thâm niên phép năm) */
  employmentStartDate?: string;
  /** Số năm đã đóng BHXH bắt buộc (tính trần nghỉ ốm) */
  bhxhYears?: number;
  gender?: 'female' | 'male';
  children?: ChildInfo[];
  /** Tên GV như ghi trên thời khóa biểu (vd. "Ms P.Anh") — để gợi ý tiết cần dạy thay */
  timetableName?: string;
  updatedAt?: number;
}

export interface LeavePolicy {
  /** Số ngày phép năm cơ bản — CHƯA được người dùng xác nhận khi annualBaseConfirmed=false */
  annualBaseDays: number;
  annualBaseConfirmed: boolean;
  /** Hạn nộp giấy tờ nghỉ ốm (ngày lịch, tính từ ngày đi làm lại) — quy định nội bộ */
  sickDocsDeadlineDays: number;
  /** Ngày nghỉ lễ/Tết (YYYY-MM-DD), không tính vào ngày làm việc */
  holidays: string[];
}

export interface LeaveRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (bao gồm)
  workingDays: number;
  reason: string;
  isEmergency: boolean;
  treatment?: Treatment; // sick_self
  child?: ChildInfo; // sick_child
  /** Giấy tờ cần nộp (mô tả) */
  requiredDocs: string[];
  /** Hạn nộp giấy tờ (YYYY-MM-DD), null nếu không cần */
  docsDeadline: string | null;
  docsSubmittedAt: number | null;
  status: LeaveStatus;
  decisionBy?: string;
  decisionByName?: string;
  decisionAt?: number;
  decisionNote?: string;
  createdAt: number;
}

export type NewLeaveInput = Pick<
  LeaveRequest,
  'type' | 'startDate' | 'endDate' | 'reason' | 'isEmergency' | 'treatment' | 'child'
>;
