/**
 * Đơn xin nghỉ học của PH (/student_leave/{uid_ngày_stt}).
 * PH gửi → GVCN duyệt → vắng P điền sẵn vào sổ ngày qua daily_logbooks.approvedLeaves.<id>.
 * Doc không lưu field `id`: id = snapshot.id.
 * Đọc: mọi truy vấn có where + limit, qua guard; đơn chờ của lớp cache 10 phút (bộ nhớ + sessionStorage).
 */
import { collection, doc, limit, orderBy, query, runTransaction, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { guardedGetDocs } from '../utils/firestoreGuard';
import {
  clearLeaveSessionKeys,
  LEAVE_MAX_DAYS,
  LEAVE_MAX_PER_DAY,
  isValidIso,
  leaveDay,
  leaveId,
  validateLeaveInput,
  type ApprovedLeaveEntry,
  type LeaveKind,
  type LeaveReason,
  type StudentLeave,
} from '../utils/studentLeave';
import { weekSchoolDates } from '../utils/leaveStats';
import { createEmptyDailyLogbook, generateDailyId } from './logbookService';
import { fetchClassRosterStrict } from './rosterService';

const COL = 'student_leave';
const PENDING_TTL_MS = 10 * 60_000;
const pendingKey = (classId: string) => `ums_leave_pending_${classId}`;

const pendingCache = new Map<string, { ts: number; data: StudentLeave[] }>();

const pad = (n: number) => String(n).padStart(2, '0');
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const toLeave = (d: { id: string; data: () => unknown }): StudentLeave => ({ ...(d.data() as Omit<StudentLeave, 'id'>), id: d.id });

export interface LeaveInput { kind: LeaveKind; dates: string[]; periods: number[]; meal: boolean; reason: LeaveReason; note: string }

export async function submitLeave(
  parent: { uid: string; displayName: string },
  child: { mhs: string; name: string; classId: string },
  input: LeaveInput
): Promise<StudentLeave> {
  const err = validateLeaveInput(input, localIso(new Date()));
  if (err) throw new Error(err);
  const now = Date.now();
  const day = leaveDay(now);
  const snap = await guardedGetDocs(
    'student_leave:mineToday',
    query(collection(db, COL), where('parentUid', '==', parent.uid), where('day', '==', day), limit(LEAVE_MAX_PER_DAY))
  );
  const seq = snap.size + 1;
  if (seq > LEAVE_MAX_PER_DAY) throw new Error(`Mỗi ngày chỉ gửi tối đa ${LEAVE_MAX_PER_DAY} đơn.`);
  const id = leaveId(parent.uid, day, seq);
  const data: Omit<StudentLeave, 'id'> = {
    mhs: child.mhs,
    studentName: child.name,
    classId: child.classId,
    parentUid: parent.uid,
    parentName: parent.displayName,
    kind: input.kind,
    dates: input.dates,
    periods: input.kind === 'day' ? [] : input.periods,
    meal: input.meal,
    reason: input.reason,
    note: input.note,
    status: 'pending',
    day,
    seq,
    createdAt: now,
  };
  await setDoc(doc(db, COL, id), data);
  return { ...data, id };
}

export async function listMyLeaves(parentUid: string): Promise<StudentLeave[]> {
  const snap = await guardedGetDocs(
    'student_leave:mine',
    query(collection(db, COL), where('parentUid', '==', parentUid), orderBy('createdAt', 'desc'), limit(10))
  );
  return snap.docs.map(toLeave);
}

export async function cancelLeave(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { status: 'cancelled', decidedAt: Date.now() });
}

function readSession(classId: string): { ts: number; data: StudentLeave[] } | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(pendingKey(classId));
    const p = raw ? JSON.parse(raw) : null;
    return p && Array.isArray(p.data) && typeof p.ts === 'number' ? p : null;
  } catch {
    return null;
  }
}

function writeSession(classId: string, v: { ts: number; data: StudentLeave[] }): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(pendingKey(classId), JSON.stringify(v));
  } catch {
    // chỉ giữ trong bộ nhớ
  }
}

export async function listPendingForClass(classId: string, force = false): Promise<StudentLeave[]> {
  if (!force) {
    const mem = pendingCache.get(classId);
    if (mem && Date.now() - mem.ts < PENDING_TTL_MS) return mem.data;
    const ses = readSession(classId);
    if (ses && Date.now() - ses.ts < PENDING_TTL_MS) {
      pendingCache.set(classId, ses);
      return ses.data;
    }
  }
  const snap = await guardedGetDocs(
    'student_leave:pending',
    query(collection(db, COL), where('classId', '==', classId), where('status', '==', 'pending'), limit(20))
  );
  // Không orderBy trên Firestore (tránh thêm index) → sắp ở client: đơn cũ nhất trước
  const data = snap.docs.map(toLeave).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const entry = { ts: Date.now(), data };
  pendingCache.set(classId, entry);
  writeSession(classId, entry);
  return entry.data;
}

function dropFromPendingCache(classId: string, id: string): void {
  const cur = pendingCache.get(classId) ?? readSession(classId);
  if (!cur) return;
  const next = { ts: cur.ts, data: cur.data.filter((l) => l.id !== id) };
  pendingCache.set(classId, next);
  writeSession(classId, next);
}

function isApprovableLeave(leave: StudentLeave): boolean {
  const dates = Array.isArray(leave.dates) ? leave.dates : [];
  if (dates.length < 1 || dates.length > LEAVE_MAX_DAYS) return false;
  if (!dates.every((d) => typeof d === 'string' && isValidIso(d))) return false;
  if (leave.kind === 'periods') {
    const periods = Array.isArray(leave.periods) ? leave.periods : [];
    if (!periods.length || !periods.every((p) => Number.isInteger(p) && p >= 1 && p <= 8)) return false;
  }
  return true;
}

const classWeekKeyOf = (classId: string) => `ums_leave_cls_${classId}`;

/** Duyệt xong: chỉ thêm đơn vừa duyệt vào cache đơn đã duyệt của lớp (nếu cache đang có), không đọc lại. */
function addToClassWeekCache(leave: StudentLeave): void {
  let cur = classWeekCache.get(leave.classId);
  if (!cur) {
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(classWeekKeyOf(leave.classId)) : null;
      const p = raw ? JSON.parse(raw) : null;
      if (p && Array.isArray(p.data) && typeof p.ts === 'number') cur = p;
    } catch {
      // bỏ qua
    }
  }
  if (!cur) return;
  const next = { ts: cur.ts, data: [leave, ...cur.data.filter((l) => l.id !== leave.id)] };
  classWeekCache.set(leave.classId, next);
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(classWeekKeyOf(leave.classId), JSON.stringify(next));
  } catch {
    // chỉ giữ trong bộ nhớ
  }
}

export async function decideLeave(
  leave: StudentLeave,
  approve: boolean,
  by: { uid: string; displayName: string },
  rejectReason?: string
): Promise<void> {
  if (approve) {
    // Đơn do PH ghi: kiểm lại ngày/tiết trước khi đọc/ghi sổ ngày (id sổ = lớp_ngày)
    if (!isApprovableLeave(leave)) throw new Error('Đơn có ngày/tiết không hợp lệ, không thể duyệt.');
    // Rules không kiểm tra HS thuộc lớp → kiểm ở app: phải có trong danh sách lớp thật.
    const roster = await fetchClassRosterStrict(leave.classId);
    const student = roster?.find((s) => s.mhs === leave.mhs);
    if (!student) throw new Error('Học sinh không thuộc lớp này hoặc chưa tải được danh sách lớp.');
    const entry: ApprovedLeaveEntry = {
      mhs: leave.mhs,
      // Tên theo danh sách lớp, không dùng tên PH tự nhập
      name: student.name,
      stt: student.stt,
      periods: leave.kind === 'day' ? [] : leave.periods,
      meal: leave.meal,
    };
    const leaveRef = doc(db, COL, leave.id);
    const decision = { status: 'approved', decidedAt: Date.now(), decidedBy: by.uid, decidedByName: by.displayName };
    try {
      // Cả luồng duyệt trong 1 transaction: sổ ngày tạo giữa chừng không bị ghi đè, đơn đã huỷ không để lại approvedLeaves mồ côi.
      // Đọc điểm trong transaction (≤ 1 đơn + ≤ 5 sổ ngày) không đi qua guardedGetDoc vì transaction cần tx.get.
      await runTransaction(db, async (tx) => {
        const cur = await tx.get(leaveRef);
        if (!cur.exists() || (cur.data() as { status?: string }).status !== 'pending') {
          throw new Error('Đơn không còn ở trạng thái chờ duyệt (PH có thể đã huỷ).');
        }
        const refs = leave.dates.map((date) => ({ date, ref: doc(db, 'daily_logbooks', generateDailyId(leave.classId, date)) }));
        const snaps = await Promise.all(refs.map((r) => tx.get(r.ref)));
        refs.forEach((r, i) => {
          if (snaps[i].exists()) {
            // Field path: không đụng baseline/tiết đã có
            tx.update(r.ref, { ['approvedLeaves.' + leave.id]: entry, updatedAt: Date.now() });
          } else {
            tx.set(r.ref, { ...createEmptyDailyLogbook(leave.classId, r.date, by.uid), approvedLeaves: { [leave.id]: entry } });
          }
        });
        tx.update(leaveRef, decision);
      });
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Đơn không còn')) dropFromPendingCache(leave.classId, leave.id);
      throw e;
    }
    dropFromPendingCache(leave.classId, leave.id);
    addToClassWeekCache({ ...leave, status: 'approved', decidedAt: Date.now(), decidedBy: by.uid, decidedByName: by.displayName });
    return;
  }
  await updateDoc(doc(db, COL, leave.id), {
    status: 'rejected',
    decidedAt: Date.now(),
    decidedBy: by.uid,
    decidedByName: by.displayName,
    ...(rejectReason ? { rejectReason } : {}),
  });
  dropFromPendingCache(leave.classId, leave.id);
}

const approvedCache = new Map<string, { ts: number; data: StudentLeave[] }>();
const approvedKey = (dateIso: string) => `ums_leave_approved_${dateIso}`;

/** Đơn đã duyệt có nghỉ ngày này (báo cơm). Cache 10 phút theo ngày (bộ nhớ + sessionStorage). */
export async function listApprovedForDate(dateIso: string, force = false): Promise<StudentLeave[]> {
  if (!force) {
    const mem = approvedCache.get(dateIso);
    if (mem && Date.now() - mem.ts < PENDING_TTL_MS) return mem.data;
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(approvedKey(dateIso)) : null;
      const p = raw ? JSON.parse(raw) : null;
      if (p && Array.isArray(p.data) && typeof p.ts === 'number' && Date.now() - p.ts < PENDING_TTL_MS) {
        approvedCache.set(dateIso, p);
        return p.data;
      }
    } catch {
      // bỏ qua, đọc mới
    }
  }
  const snap = await guardedGetDocs(
    'student_leave:approvedDate',
    query(collection(db, COL), where('dates', 'array-contains', dateIso), where('status', '==', 'approved'), limit(200))
  );
  const entry = { ts: Date.now(), data: snap.docs.map(toLeave) };
  approvedCache.set(dateIso, entry);
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(approvedKey(dateIso), JSON.stringify(entry));
  } catch {
    // chỉ giữ trong bộ nhớ
  }
  return entry.data;
}

/** Nhiều ngày (chế độ tuần): gộp listApprovedForDate (dùng chung cache), khử trùng theo id. */
export async function listApprovedForDates(dates: string[], force = false): Promise<StudentLeave[]> {
  const lists = await Promise.all(dates.map((d) => listApprovedForDate(d, force)));
  const seen = new Map<string, StudentLeave>();
  for (const l of lists.flat()) if (!seen.has(l.id)) seen.set(l.id, l);
  return [...seen.values()];
}

const classWeekCache = new Map<string, { ts: number; data: StudentLeave[] }>();
const classWeekKey = (classId: string) => `ums_leave_cls_${classId}`;

/** Đơn đã duyệt của lớp (1 truy vấn ≤50), lọc ở client theo tuần hiện tại. Cache 10 phút. */
export async function listApprovedForClassWeek(classId: string, force = false, todayIso = localIso(new Date())): Promise<StudentLeave[]> {
  const week = new Set(weekSchoolDates(todayIso));
  const inWeek = (rows: StudentLeave[]) => rows.filter((l) => l.dates.some((d) => week.has(d)));
  if (!force) {
    const mem = classWeekCache.get(classId);
    if (mem && Date.now() - mem.ts < PENDING_TTL_MS) return inWeek(mem.data);
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(classWeekKey(classId)) : null;
      const p = raw ? JSON.parse(raw) : null;
      if (p && Array.isArray(p.data) && typeof p.ts === 'number' && Date.now() - p.ts < PENDING_TTL_MS) {
        classWeekCache.set(classId, p);
        return inWeek(p.data);
      }
    } catch {
      // đọc mới
    }
  }
  const snap = await guardedGetDocs(
    'student_leave:approvedClass',
    query(collection(db, COL), where('classId', '==', classId), where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(50))
  );
  const entry = { ts: Date.now(), data: snap.docs.map(toLeave) };
  classWeekCache.set(classId, entry);
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(classWeekKey(classId), JSON.stringify(entry));
  } catch {
    // chỉ giữ trong bộ nhớ
  }
  return inWeek(entry.data);
}

/** Đăng xuất: xoá cache đơn nghỉ trong bộ nhớ và mọi key sessionStorage `ums_leave_*` (người dùng sau không thấy dữ liệu cũ). */
export function clearLeaveCaches(): void {
  pendingCache.clear();
  approvedCache.clear();
  classWeekCache.clear();
  clearLeaveSessionKeys();
}

/** Chỉ dùng trong test */
export function _resetLeaveCacheForTest(): void {
  pendingCache.clear();
  approvedCache.clear();
  classWeekCache.clear();
}
