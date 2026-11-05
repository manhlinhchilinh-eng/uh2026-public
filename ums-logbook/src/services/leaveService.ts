/**
 * UMS SmartConnect - Xin nghỉ online (Firestore)
 */

import { addDoc, collection, doc, limit, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import type { LeavePolicy, LeaveProfile, LeaveRequest, NewLeaveInput } from '../types/leave';
import { DEFAULT_LEAVE_POLICY, docsDeadline, requiredDocs } from '../utils/leavePolicy';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';

const REQ = 'leave_requests';

let leavePolicyCache: { ts: number; data: LeavePolicy } | null = null;
const LEAVE_POLICY_TTL_MS = 10 * 60_000;

export async function fetchLeavePolicy(): Promise<LeavePolicy> {
  if (leavePolicyCache && Date.now() - leavePolicyCache.ts < LEAVE_POLICY_TTL_MS) {
    return leavePolicyCache.data;
  }
  const snap = await guardedGetDoc('system_settings:leave_policy', doc(db, 'system_settings', 'leave_policy'));
  const data = { ...DEFAULT_LEAVE_POLICY, ...(snap.exists() ? (snap.data() as Partial<LeavePolicy>) : {}) };
  leavePolicyCache = { ts: Date.now(), data };
  return data;
}

export async function saveLeavePolicy(policy: LeavePolicy): Promise<void> {
  await setDoc(doc(db, 'system_settings', 'leave_policy'), policy);
  leavePolicyCache = { ts: Date.now(), data: policy };
}

export async function fetchLeaveProfile(uid: string): Promise<LeaveProfile | null> {
  const snap = await guardedGetDoc('leave_profiles:get', doc(db, 'leave_profiles', uid));
  return snap.exists() ? (snap.data() as LeaveProfile) : null;
}

export async function saveLeaveProfile(profile: LeaveProfile): Promise<void> {
  await setDoc(doc(db, 'leave_profiles', profile.uid), { ...profile, updatedAt: Date.now() });
}

const toRequest = (id: string, d: Record<string, any>): LeaveRequest => ({ id, ...(d as Omit<LeaveRequest, 'id'>) });

export async function fetchMyLeaveRequests(uid: string, max = 100): Promise<LeaveRequest[]> {
  const snap = await guardedGetDocs(
    'leave_requests:mine',
    query(collection(db, REQ), where('requesterId', '==', uid), limit(max))
  );
  return snap.docs.map((d) => toRequest(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

/** BGH: toàn bộ đơn (đối soát, duyệt) — giới hạn tối đa `max` đơn mới nhất. */
export async function fetchAllLeaveRequests(max = 200): Promise<LeaveRequest[]> {
  const snap = await guardedGetDocs(
    'leave_requests:all',
    query(collection(db, REQ), orderBy('createdAt', 'desc'), limit(max))
  );
  return snap.docs.map((d) => toRequest(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

export async function submitLeaveRequest(
  input: NewLeaveInput,
  workingDays: number,
  requester: UserProfile,
  policy: LeavePolicy
): Promise<string> {
  const data: Omit<LeaveRequest, 'id'> = {
    requesterId: requester.uid,
    requesterName: requester.displayName || requester.username,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    workingDays,
    reason: input.reason.trim(),
    isEmergency: input.isEmergency,
    requiredDocs: requiredDocs(input.type, input.treatment),
    docsDeadline: docsDeadline(input.type, input.endDate, policy),
    docsSubmittedAt: null,
    status: 'pending',
    createdAt: Date.now(),
  };
  if (input.treatment) data.treatment = input.treatment;
  if (input.child) data.child = input.child;
  const ref = await addDoc(collection(db, REQ), data);
  return ref.id;
}

export async function decideLeaveRequest(id: string, approve: boolean, admin: UserProfile, note: string): Promise<void> {
  await updateDoc(doc(db, REQ, id), {
    status: approve ? 'approved' : 'rejected',
    decisionBy: admin.uid,
    decisionByName: admin.displayName || admin.username,
    decisionAt: Date.now(),
    decisionNote: note.trim(),
  });
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  await updateDoc(doc(db, REQ, id), { status: 'cancelled' });
}

export async function markDocsSubmitted(id: string): Promise<void> {
  await updateDoc(doc(db, REQ, id), { docsSubmittedAt: Date.now() });
}
