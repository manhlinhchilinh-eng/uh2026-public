/**
 * Sổ điểm môn học trên Firestore — xem utils/gradebook.ts (cấu trúc) và firestore.rules (quyền).
 * Mọi đọc qua guardedGet*, có limit, tải khi mở trang/bấm nút (không listener, không polling — bài học 12/10).
 */

import { collection, doc, limit, orderBy, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import type { StudentDoc } from '../types';
import {
  assignmentId,
  compactRows,
  diffRows,
  reportId,
  reportSubjectOf,
  type GradeAssignment,
  type GradeChange,
  type GradeRow,
  type Gradebook,
  type GradebookStatus,
  type ReportSubject,
} from '../utils/gradebook';
import { guardedGetDoc, guardedGetDocs } from '../utils/firestoreGuard';
import { withoutUndefined } from './logbookService';

const ASSIGN = 'grade_assignments';
const BOOKS = 'gradebooks';
const REPORTS = 'grade_reports';

export const GRADEBOOK_LIMITS = {
  myAssignments: 100,
  classAssignments: 30,
  allAssignments: 800,
  classBooks: 30,
  termBooks: 800,
  history: 50,
} as const;

/** Batch Firestore tối đa 500 thao tác — chia nhỏ. */
const BATCH_SIZE = 400;

export async function fetchMyAssignments(uid: string, year: string): Promise<GradeAssignment[]> {
  const snap = await guardedGetDocs(
    'grade_assignments:mine',
    query(collection(db, ASSIGN), where('teacherUids', 'array-contains', uid), limit(GRADEBOOK_LIMITS.myAssignments))
  );
  return snap.docs.map((d) => ({ ...(d.data() as GradeAssignment), id: d.id })).filter((a) => a.year === year);
}

export async function fetchClassAssignments(year: string, classId: string): Promise<GradeAssignment[]> {
  const snap = await guardedGetDocs(
    'grade_assignments:class',
    query(collection(db, ASSIGN), where('classId', '==', classId), where('year', '==', year), limit(GRADEBOOK_LIMITS.classAssignments))
  );
  return snap.docs.map((d) => ({ ...(d.data() as GradeAssignment), id: d.id }));
}

export async function fetchAllAssignments(year: string): Promise<GradeAssignment[]> {
  const snap = await guardedGetDocs(
    'grade_assignments:all',
    query(collection(db, ASSIGN), where('year', '==', year), limit(GRADEBOOK_LIMITS.allAssignments))
  );
  return snap.docs.map((d) => ({ ...(d.data() as GradeAssignment), id: d.id }));
}

export async function saveAssignments(list: GradeAssignment[], by: UserProfile): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const a of list.slice(i, i + BATCH_SIZE)) {
      const id = assignmentId(a.year, a.classId, a.subjectKey);
      batch.set(doc(db, ASSIGN, id), withoutUndefined({ ...a, id, updatedAt: now, updatedBy: by.uid }));
    }
    await batch.commit();
  }
}

export async function getGradebook(id: string): Promise<Gradebook | null> {
  const snap = await guardedGetDoc('gradebooks:get', doc(db, BOOKS, id));
  return snap.exists() ? ({ ...(snap.data() as Gradebook), id: snap.id }) : null;
}

export async function fetchClassGradebooks(year: string, term: number, classId: string): Promise<Gradebook[]> {
  const snap = await guardedGetDocs(
    'gradebooks:class',
    query(
      collection(db, BOOKS),
      where('classId', '==', classId),
      where('year', '==', year),
      where('term', '==', term),
      limit(GRADEBOOK_LIMITS.classBooks)
    )
  );
  return snap.docs.map((d) => ({ ...(d.data() as Gradebook), id: d.id }));
}

export async function fetchTermGradebooks(year: string, term: number): Promise<Gradebook[]> {
  const snap = await guardedGetDocs(
    'gradebooks:term',
    query(collection(db, BOOKS), where('year', '==', year), where('term', '==', term), limit(GRADEBOOK_LIMITS.termBooks))
  );
  return snap.docs.map((d) => ({ ...(d.data() as Gradebook), id: d.id }));
}

export interface HistoryEntry {
  id: string;
  byUid: string;
  byName: string;
  at: number;
  version: number;
  action: 'edit' | 'publish' | 'lock' | 'unlock' | 'import';
  reason?: string;
  changes: GradeChange[];
}

export async function fetchHistory(gbId: string): Promise<HistoryEntry[]> {
  const snap = await guardedGetDocs(
    'gradebooks:history',
    query(collection(db, BOOKS, gbId, 'history'), orderBy('at', 'desc'), limit(GRADEBOOK_LIMITS.history))
  );
  return snap.docs.map((d) => ({ ...(d.data() as HistoryEntry), id: d.id }));
}

/** Lỗi khi người khác vừa ghi (phiên bản lệch) — rules từ chối. */
export class GradebookConflictError extends Error {}

/**
 * Ghi sổ (1 lượt atomic): doc sổ phiên bản +1 và 1 dòng lịch sử. `prev.version` = phiên bản đã tải về.
 * Trả về sổ mới.
 */
export async function saveGradebook(
  prev: Gradebook,
  rows: Record<string, GradeRow>,
  by: UserProfile,
  opts: { status?: GradebookStatus; action?: HistoryEntry['action']; reason?: string } = {}
): Promise<Gradebook> {
  const now = Date.now();
  const nextRows = compactRows(rows);
  const status = opts.status ?? prev.status;
  const next: Gradebook = {
    ...prev,
    rows: nextRows,
    status,
    version: prev.version + 1,
    updatedBy: by.uid,
    updatedByName: by.displayName || by.username,
    updatedAt: now,
    ...(status === 'published' && prev.status !== 'published' ? { publishedAt: now } : {}),
    ...(status === 'locked' && prev.status !== 'locked' ? { lockedAt: now } : {}),
  };
  const changes = diffRows(prev.rows, nextRows);
  const batch = writeBatch(db);
  batch.set(doc(db, BOOKS, prev.id), withoutUndefined({ ...next }));
  batch.set(
    doc(collection(db, BOOKS, prev.id, 'history')),
    withoutUndefined({
      byUid: by.uid,
      byName: by.displayName || by.username,
      at: now,
      version: next.version,
      action: opts.action ?? 'edit',
      reason: opts.reason?.trim() || undefined,
      changes: changes.slice(0, 600),
    })
  );
  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') {
      throw new GradebookConflictError('Không ghi được: sổ vừa được người khác cập nhật, đã khóa, hoặc bạn không được phân công.');
    }
    throw e;
  }
  return next;
}

/** Công bố điểm môn này cho PH/HS: ghi phần môn vào grade_reports của từng HS trong lớp. */
export async function publishReports(gb: Gradebook, students: Pick<StudentDoc, 'mhs'>[], by: UserProfile): Promise<number> {
  const now = Date.now();
  let n = 0;
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const s of students.slice(i, i + BATCH_SIZE)) {
      batch.set(
        doc(db, REPORTS, reportId(gb.year, gb.term, s.mhs)),
        {
          mhs: s.mhs,
          classId: gb.classId,
          year: gb.year,
          term: gb.term,
          lastSubjectKey: gb.subjectKey,
          subjects: { [gb.subjectKey]: withoutUndefined({ ...reportSubjectOf(gb, s.mhs, now), teacherName: by.displayName || by.username }) },
          updatedAt: now,
          updatedBy: by.uid,
        },
        { merge: true }
      );
      n++;
    }
    await batch.commit();
  }
  return n;
}

export interface GradeReport {
  mhs: string;
  classId: string;
  year: string;
  term: number;
  subjects: Record<string, ReportSubject & { teacherName?: string }>;
  updatedAt: number;
}

/** PH/HS: bản công bố của 1 HS (1 lượt đọc). */
export async function fetchGradeReport(year: string, term: number, mhs: string): Promise<GradeReport | null> {
  const snap = await guardedGetDoc('grade_reports:get', doc(db, REPORTS, reportId(year, term, mhs)));
  return snap.exists() ? (snap.data() as GradeReport) : null;
}

/** BGH: lưu mã định danh Bộ GD&ĐT vào hồ sơ HS (đọc từ file Excel CSDL). */
export async function saveStudentMoetIds(roster: StudentDoc[], moetIds: Record<string, string>): Promise<number> {
  const batch = writeBatch(db);
  let n = 0;
  for (const s of roster) {
    const id = moetIds[s.mhs];
    if (!id || !s.docId || s.moetId === id) continue;
    batch.update(doc(db, 'students', s.docId), { moetId: id });
    n++;
  }
  if (n) await batch.commit();
  return n;
}

/** BGH: tài khoản nhân sự (uid, username, tên) để gắn ô TKB có `teacherUsername` và chọn GV khi sửa phân công. */
export async function fetchStaffAccounts(): Promise<Array<{ uid: string; username: string; displayName: string; assignedClassId?: string }>> {
  const snap = await guardedGetDocs(
    'users:gradebook_staff',
    query(collection(db, 'users'), where('roles', 'array-contains-any', ['admin', 'gvcn', 'gvbm', 'tpt']), limit(250))
  );
  return snap.docs
    .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
    .map((u) => ({ uid: u.uid, username: u.username || '', displayName: u.displayName || u.username || '', assignedClassId: u.assignedClassId || '' }))
    .filter((u) => u.uid)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
}
