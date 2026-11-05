/**
 * UMS SmartConnect - Cập nhật TKB toàn trường từ file Excel của trường.
 * Ghi đè TKB từng lớp (lưu bản trước vào `previous` để hoàn tác) + gửi thông báo cho BGH và từng lớp.
 */

import { collection, doc, getDocs, limit, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import type { ClassSchedule, ScheduleSlot } from '../types/schedule';
import { buildAudienceKeys } from '../utils/announcements';
import {
  attachTeacherAccounts,
  buildAdminNotice,
  buildClassNotice,
  buildSlotMap,
  carryTeacherAccounts,
  listScheduleChanges,
  type ParsedTimetable,
  type ScheduleChange,
} from '../utils/timetableGrid';

import { fetchSchedulesStrict, notifyScheduleUpdate } from './scheduleService';
import { logAuditEvent } from './auditService';
import { currentAcademic } from '../utils/academicCalendar';

export interface PlannedClass {
  classId: string;
  slots: ScheduleSlot[];
  current: ClassSchedule | null;
  changes: ScheduleChange[];
}

export interface TimetablePlan {
  classes: PlannedClass[];
  academicYear: string;
  semester: number;
}

/** Tên trên TKB → username: GV tự chọn (teacher_aliases), bổ sung từ Hồ sơ phép (timetableName). */
async function loadTeacherAliases(): Promise<Map<string, string>> {
  const [profiles, users, chosen] = await Promise.all([
    getDocs(collection(db, 'leave_profiles')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'teacher_aliases')).catch(() => null),
  ]);
  const usernameOf = new Map(users.docs.map((d) => [d.id, String(d.data().username || '')]));
  const map = new Map<string, string>();
  profiles.docs.forEach((d) => {
    const alias = String(d.data().timetableName || '').trim();
    const username = usernameOf.get(d.id);
    if (alias && username) map.set(alias, username);
  });
  chosen?.docs.forEach((d) => {
    const { aliases = [], username = '' } = d.data() as { aliases?: string[]; username?: string };
    if (username) aliases.forEach((a) => map.set(a, username));
  });
  return map;
}

export async function planTimetableUpdate(parsed: ParsedTimetable): Promise<TimetablePlan> {
  const [current, aliases] = await Promise.all([
    fetchSchedulesStrict(),
    loadTeacherAliases().catch(() => new Map<string, string>()),
  ]);
  const classes = Object.entries(parsed.classes)
    .map(([classId, raw]) => {
      const cur = current[classId] ?? null;
      const slots = carryTeacherAccounts(attachTeacherAccounts(raw, aliases), cur?.slots);
      return { classId, slots, current: cur, changes: listScheduleChanges(cur?.slots, slots) };
    })
    .sort((a, b) => a.classId.localeCompare(b.classId));
  return { classes, academicYear: parsed.academicYear || currentAcademic().academicYear, semester: parsed.semester || currentAcademic().semester };
}

/** 1 lần cập nhật TKB — lưu vĩnh viễn ở /schedule_updates để xem lại. */
export interface ScheduleUpdateRecord {
  updateId: string;
  fileName: string;
  effective: string | null;
  createdAt: number;
  byUid: string;
  byName: string;
  classesChanged: number;
  totalChanges: number;
  changes: Record<string, ScheduleChange[]>;
  undoneAt?: number;
  undoneBy?: string;
}

export async function fetchScheduleHistory(max = 50): Promise<ScheduleUpdateRecord[]> {
  const snap = await getDocs(query(collection(db, 'schedule_updates'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => d.data() as ScheduleUpdateRecord);
}

export interface ApplyOptions {
  fileName: string;
  effective: string | null;
  notifyClasses: boolean;
}

/** Ghi TKB các lớp có thay đổi + thông báo trong 1 batch (tất cả hoặc không gì cả). */
export async function applyTimetableUpdate(plan: TimetablePlan, admin: UserProfile, opts: ApplyOptions) {
  const changed = plan.classes.filter((c) => c.changes.length > 0);
  if (changed.length === 0) return { updateId: null as string | null, classesUpdated: 0, notices: 0 };
  const now = Date.now();
  const updateId = `tkb_${now}`;
  const batch = writeBatch(db);
  const author = { authorId: admin.uid, authorName: admin.displayName || admin.username, authorRole: 'admin', createdAt: now };

  for (const c of changed) {
    const prev = c.current;
    const next: ClassSchedule = {
      classId: c.classId,
      academicYear: plan.academicYear,
      semester: plan.semester,
      slots: c.slots,
      slotMap: buildSlotMap(c.slots),
      updatedAt: now,
      updatedBy: admin.username,
      updateId,
      sourceFile: opts.fileName,
      previous: prev
        ? { slots: prev.slots, updatedAt: prev.updatedAt || 0, updatedBy: prev.updatedBy || '', academicYear: prev.academicYear, semester: prev.semester }
        : null,
    };
    batch.set(doc(db, 'schedules', c.classId), next);


    if (opts.notifyClasses) {
      const n = buildClassNotice(c.classId, c.changes, opts.effective);
      const audience = { toStaff: false, toParents: true, toStudents: true, classId: c.classId };
      batch.set(doc(collection(db, 'announcements')), {
        ...n,
        level: 'important',
        audience,
        audienceKeys: buildAudienceKeys(audience),
        classId: c.classId,
        forwardableToParents: false,
        kind: 'schedule_change',
        scheduleChanges: c.changes,
        ...author,
      });
    }
  }

  const summary = buildAdminNotice(
    Object.fromEntries(plan.classes.map((c) => [c.classId, c.changes])),
    plan.classes.length,
    opts.effective
  );
  const staffAudience = { toStaff: true, toParents: false, toStudents: false, classId: null };
  batch.set(doc(collection(db, 'announcements')), {
    ...summary,
    level: 'important',
    audience: staffAudience,
    audienceKeys: buildAudienceKeys(staffAudience),
    classId: null,
    forwardableToParents: false,
    kind: 'schedule_change',
    ...author,
  });

  const record: ScheduleUpdateRecord = {
    updateId,
    fileName: opts.fileName,
    effective: opts.effective,
    createdAt: now,
    byUid: admin.uid,
    byName: admin.displayName || admin.username,
    classesChanged: changed.length,
    totalChanges: changed.reduce((n, c) => n + c.changes.length, 0),
    changes: Object.fromEntries(changed.map((c) => [c.classId, c.changes])),
  };
  batch.set(doc(db, 'schedule_updates', updateId), record);

  await batch.commit();
  changed.forEach((c) => notifyScheduleUpdate(c.classId));
  await logAuditEvent({
    action: 'UPDATE',
    targetCollection: 'schedules',
    targetId: updateId,
    details: `Cập nhật TKB từ file "${opts.fileName}": ${changed.length} lớp, ${changed.reduce((n, c) => n + c.changes.length, 0)} tiết thay đổi.`,
  });
  return { updateId, classesUpdated: changed.length, notices: (opts.notifyClasses ? changed.length : 0) + 1 };
}

/** Lần cập nhật gần nhất còn hoàn tác được. */
export function latestUpdate(
  schedules: Record<string, ClassSchedule>
): { updateId: string; sourceFile: string; at: number; classes: number } | null {
  const withId = Object.values(schedules).filter((s) => s.updateId && s.previous);
  if (withId.length === 0) return null;
  const last = withId.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  return {
    updateId: last.updateId!,
    sourceFile: last.sourceFile || '',
    at: last.updatedAt,
    classes: withId.filter((s) => s.updateId === last.updateId).length,
  };
}

/** Hoàn tác: khôi phục `previous` của các lớp thuộc updateId đó. */
export async function undoTimetableUpdate(updateId: string, admin: UserProfile): Promise<number> {
  const all = await fetchSchedulesStrict();
  const targets = Object.values(all).filter((s) => s.updateId === updateId && s.previous);
  if (targets.length === 0) return 0;
  const batch = writeBatch(db);
  for (const s of targets) {
    const p = s.previous!;
    batch.set(doc(db, 'schedules', s.classId), {
      classId: s.classId,
      academicYear: p.academicYear,
      semester: p.semester,
      slots: p.slots,
      slotMap: buildSlotMap(p.slots),
      updatedAt: Date.now(),
      updatedBy: admin.username,
      previous: null,
    });
  }
  await batch.commit();
  targets.forEach((s) => notifyScheduleUpdate(s.classId));
  await updateDoc(doc(db, 'schedule_updates', updateId), { undoneAt: Date.now(), undoneBy: admin.displayName || admin.username }).catch((e) =>
    console.warn('[TKB] không đánh dấu được lịch sử hoàn tác', e)
  );
  await logAuditEvent({
    action: 'UPDATE',
    targetCollection: 'schedules',
    targetId: updateId,
    details: `Hoàn tác cập nhật TKB ${updateId} (${targets.length} lớp).`,
  });
  return targets.length;
}

/**
 * Đồng bộ lại `slotMap` và `teacherUsername` trong `/schedules/{classId}` theo bảng `teacher_aliases` hiện tại (chỉ BGH gọi).
 */
export async function syncScheduleSlotMaps(): Promise<number> {
  const [all, aliases] = await Promise.all([
    fetchSchedulesStrict(),
    loadTeacherAliases().catch(() => new Map<string, string>()),
  ]);
  const entries = Object.values(all);
  if (entries.length === 0) return 0;
  const batch = writeBatch(db);
  for (const s of entries) {
    const slots = attachTeacherAccounts(s.slots || [], aliases);
    batch.update(doc(db, 'schedules', s.classId), {
      slots,
      slotMap: buildSlotMap(slots),
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
  return entries.length;
}

