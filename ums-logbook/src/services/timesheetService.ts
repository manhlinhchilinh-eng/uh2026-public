/**
 * UMS SmartConnect - Bảng chấm công đối soát (Firestore)
 */

import { collection, doc, getDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import type { TimesheetPeriod, TimesheetRecord } from '../types/timesheet';
import type { LeaveRequest } from '../types/leave';
import { STANDARD_DAYS, buildRecord, deadlineEndMs, reviewDeadline } from '../utils/timesheet';

const COL = 'timesheets';

export async function fetchPeriods(): Promise<TimesheetPeriod[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => d.data() as TimesheetPeriod).sort((a, b) => b.period.localeCompare(a.period));
}

export async function fetchMyRecord(period: string, uid: string): Promise<TimesheetRecord | null> {
  const snap = await getDoc(doc(db, COL, period, 'records', uid));
  return snap.exists() ? (snap.data() as TimesheetRecord) : null;
}

export async function fetchRecords(period: string): Promise<TimesheetRecord[]> {
  const snap = await getDocs(collection(db, COL, period, 'records'));
  return snap.docs.map((d) => d.data() as TimesheetRecord);
}

/** BGH phát hành bảng công tháng: tạo dòng cho mọi nhân sự từ đơn nghỉ đã duyệt. */
export async function publishTimesheet(p: {
  period: string;
  today: string;
  holidays: string[];
  staff: Array<{ uid: string; displayName: string }>;
  leaves: LeaveRequest[];
  admin: UserProfile;
}): Promise<{ count: number; deadline: string }> {
  if ((await getDoc(doc(db, COL, p.period))).exists()) throw new Error(`Kỳ công ${p.period} đã được phát hành.`);
  const deadline = reviewDeadline(p.today, p.holidays);
  const meta: TimesheetPeriod = {
    period: p.period,
    standardDays: STANDARD_DAYS,
    publishedAt: Date.now(),
    publishedBy: p.admin.uid,
    publishedByName: p.admin.displayName || p.admin.username,
    reviewDeadline: deadline,
    reviewDeadlineAt: deadlineEndMs(deadline),
    status: 'open',
  };
  const batch = writeBatch(db);
  batch.set(doc(db, COL, p.period), meta);
  for (const person of p.staff) {
    batch.set(doc(db, COL, p.period, 'records', person.uid), buildRecord(person, p.leaves, p.period, p.holidays));
  }
  await batch.commit();
  return { count: p.staff.length, deadline };
}

export async function respondToRecord(period: string, uid: string, confirm: boolean, reason = ''): Promise<void> {
  const patch: Record<string, unknown> = { status: confirm ? 'confirmed' : 'disputed', respondedAt: Date.now() };
  if (!confirm) patch.disputeReason = reason.trim();
  await updateDoc(doc(db, COL, period, 'records', uid), patch);
}

export async function resolveDispute(period: string, uid: string, note: string, adjustedWorkedDays: number | null, admin: UserProfile) {
  const patch: Record<string, unknown> = {
    status: 'resolved',
    resolutionNote: note.trim(),
    resolvedBy: admin.uid,
    resolvedByName: admin.displayName || admin.username,
    resolvedAt: Date.now(),
  };
  if (adjustedWorkedDays != null) patch.adjustedWorkedDays = adjustedWorkedDays;
  await updateDoc(doc(db, COL, period, 'records', uid), patch);
}

/** Chốt kỳ: dòng chưa phản hồi → mặc nhiên xác nhận. Khiếu nại chưa xử lý thì không cho chốt. */
export async function closePeriod(period: string, records: TimesheetRecord[]): Promise<number> {
  if (records.some((r) => r.status === 'disputed')) throw new Error('Còn khiếu nại chưa xử lý.');
  const batch = writeBatch(db);
  let n = 0;
  for (const r of records) {
    if (r.status === 'pending') {
      batch.update(doc(db, COL, period, 'records', r.uid), { status: 'auto_confirmed' });
      n++;
    }
  }
  batch.update(doc(db, COL, period), { status: 'closed', closedAt: Date.now() });
  await batch.commit();
  return n;
}
