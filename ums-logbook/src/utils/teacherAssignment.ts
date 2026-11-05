/**
 * Gắn "tên trên TKB" (vd. "Mr.Linh", "Ms P.Anh(Eng)") với tài khoản GV, và quyết định ai được ghi/chấm tiết nào.
 * GV tự chọn tên của mình (có thể nhiều tên); BGH xem & sửa. Hàm thuần — không gọi Firebase.
 */

import type { UserRole } from '../types/auth';
import type { ClassSchedule } from '../types/schedule';

export interface TeacherAliasDoc {
  uid: string;
  username: string;
  displayName: string;
  aliases: string[];
  updatedAt?: number;
  updatedBy?: string;
}

export const normAlias = (s: string) => (s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

export interface AliasOwner {
  uid: string;
  username: string;
  displayName: string;
}

/** Tên TKB (chuẩn hóa) → các tài khoản đã nhận tên đó. >1 người = xung đột cần BGH xử lý. */
export function buildAliasIndex(docs: TeacherAliasDoc[]) {
  const byAlias = new Map<string, AliasOwner[]>();
  for (const d of docs) {
    for (const a of new Set((d.aliases || []).map(normAlias).filter(Boolean))) {
      const list = byAlias.get(a) ?? [];
      list.push({ uid: d.uid, username: d.username, displayName: d.displayName });
      byAlias.set(a, list);
    }
  }
  const conflicts = [...byAlias].filter(([, v]) => v.length > 1).map(([k]) => k);
  return { byAlias, conflicts };
}

export interface TimetableAlias {
  alias: string;
  periods: number;
  classes: string[];
  subjects: string[];
}

/** Mọi tên GV xuất hiện trên TKB toàn trường, kèm số tiết/lớp/môn để GV nhận ra mình. */
export function listTimetableAliases(schedules: Record<string, ClassSchedule | undefined>): TimetableAlias[] {
  const m = new Map<string, { alias: string; periods: number; classes: Set<string>; subjects: Set<string> }>();
  for (const [classId, sch] of Object.entries(schedules)) {
    for (const s of sch?.slots || []) {
      const name = (s.teacherName || '').trim();
      if (!name) continue;
      const k = normAlias(name);
      const e = m.get(k) ?? { alias: name, periods: 0, classes: new Set<string>(), subjects: new Set<string>() };
      e.periods++;
      e.classes.add(classId);
      e.subjects.add(s.subject);
      m.set(k, e);
    }
  }
  return [...m.values()]
    .map((e) => ({ alias: e.alias, periods: e.periods, classes: [...e.classes].sort(), subjects: [...e.subjects] }))
    .sort((a, b) => a.alias.localeCompare(b.alias, 'vi'));
}

export interface TeachingSlot {
  classId: string;
  dayOfWeek: number;
  periodIndex: number;
  subject: string;
  teacherName: string;
  /** true = tiết dạy thay đã được duyệt */
  substitute?: boolean;
}

/** Các tiết của tôi theo TKB (lọc theo thứ trong tuần nếu có). */
export function myTeachingSlots(
  schedules: Record<string, ClassSchedule | undefined>,
  myAliases: string[],
  dayOfWeek?: number
): TeachingSlot[] {
  const mine = new Set(myAliases.map(normAlias).filter(Boolean));
  if (mine.size === 0) return [];
  const out: TeachingSlot[] = [];
  for (const [classId, sch] of Object.entries(schedules)) {
    for (const s of sch?.slots || []) {
      if (dayOfWeek != null && s.dayOfWeek !== dayOfWeek) continue;
      if (mine.has(normAlias(s.teacherName))) {
        out.push({ classId, dayOfWeek: s.dayOfWeek, periodIndex: s.periodIndex, subject: s.subject, teacherName: s.teacherName });
      }
    }
  }
  return out.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.periodIndex - b.periodIndex || a.classId.localeCompare(b.classId));
}

export interface PeriodEditContext {
  activeRole: UserRole | null;
  assignedClassId?: string | null;
  myAliases: string[];
  /** Tên trên TKB đã có người nhận (chuẩn hóa) */
  claimedAliases: Set<string>;
  classId: string;
  /** Tên GV trên TKB của tiết này ('' nếu TKB trống) */
  slotTeacherName: string;
  /** Tôi là người dạy thay tiết này (kế hoạch đã duyệt) */
  isMySubstitution: boolean;
  /** Tiết lớp trộn — không chấm điểm sổ đầu bài */
  isMixed?: boolean;
}

export type PeriodEditReason =
  | 'admin'
  | 'mixed'
  | 'my_period'
  | 'substitute'
  | 'homeroom'
  | 'view_only_role'
  | 'no_alias'
  | 'not_mine';

/** Ai được ghi/chấm 1 tiết. BGH: mọi tiết. GVCN: mọi tiết lớp mình. GV: tiết của mình theo TKB hoặc dạy thay. */
export function periodEditPolicy(c: PeriodEditContext): { canEdit: boolean; reason: PeriodEditReason } {
  if (c.activeRole === 'admin') return { canEdit: true, reason: 'admin' };
  if (c.isMixed) return { canEdit: false, reason: 'mixed' };
  if (c.activeRole === 'tpt' || c.activeRole === 'giamthi') return { canEdit: false, reason: 'view_only_role' };
  if (c.activeRole !== 'gvcn' && c.activeRole !== 'gvbm') return { canEdit: false, reason: 'view_only_role' };
  if (c.isMySubstitution) return { canEdit: true, reason: 'substitute' };
  const slot = normAlias(c.slotTeacherName);
  const mine = new Set(c.myAliases.map(normAlias));
  if (slot && mine.has(slot)) return { canEdit: true, reason: 'my_period' };
  // GVCN ghi/ký được mọi tiết của lớp mình chủ nhiệm (kể cả tiết GV bộ môn đã nhận tên trên TKB, GV bản ngữ, NN2, TKB trống).
  if (c.activeRole === 'gvcn' && !!c.assignedClassId && c.assignedClassId === c.classId) {
    return { canEdit: true, reason: 'homeroom' };
  }
  if (mine.size === 0) return { canEdit: false, reason: 'no_alias' };
  return { canEdit: false, reason: 'not_mine' };
}

export const EDIT_REASON_TEXT: Record<PeriodEditReason, string> = {
  admin: 'BGH được sửa mọi tiết.',
  mixed: 'Tiết lớp trộn — không chấm điểm sổ đầu bài.',
  my_period: 'Tiết của bạn theo TKB.',
  substitute: 'Tiết bạn dạy thay (đã duyệt).',
  homeroom: 'GVCN được ghi/ký mọi tiết của lớp mình.',
  view_only_role: 'Vai trò này chỉ xem sổ đầu bài.',
  no_alias: 'Bạn chưa chọn tên của mình trên TKB.',
  not_mine: 'Không phải tiết của bạn — chỉ xem.',
};

/** Thứ (2..8) của ngày yyyy-mm-dd, tính theo lịch, không lệch múi giờ. */
export function dayOfWeekOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = CN
  return wd === 0 ? 8 : wd + 1;
}

/** Tiết tôi phải ghi sổ trong 1 ngày: tiết của tôi theo TKB + tiết dạy thay đã duyệt. */
export function myPeriodsOnDate(
  schedules: Record<string, ClassSchedule | undefined>,
  myAliases: string[],
  duties: Array<{ date: string; classId: string; periodIndex: number; subject: string; status: string; absentName?: string }>,
  date: string
): TeachingSlot[] {
  const dow = dayOfWeekOf(date);
  const out = myTeachingSlots(schedules, myAliases, dow);
  const seen = new Set(out.map((s) => `${s.classId}_${s.periodIndex}`));
  for (const d of duties) {
    if (d.date !== date || d.status !== 'approved' || seen.has(`${d.classId}_${d.periodIndex}`)) continue;
    out.push({ classId: d.classId, dayOfWeek: dow, periodIndex: d.periodIndex, subject: d.subject, teacherName: d.absentName || '', substitute: true });
  }
  return out.sort((a, b) => a.periodIndex - b.periodIndex || a.classId.localeCompare(b.classId));
}

/** Câu giải thích ngắn: tôi được ghi/chấm những tiết nào của lớp đang xem, vì sao. */
export function describeEditScope(items: Array<{ period: number; reason: PeriodEditReason }>): string {
  const by = (r: PeriodEditReason) => items.filter((x) => x.reason === r).map((x) => x.period);
  if (items.length && items.every((x) => x.reason === 'admin')) return EDIT_REASON_TEXT.admin;
  if (items.length && items.every((x) => x.reason === 'view_only_role')) return EDIT_REASON_TEXT.view_only_role;
  const parts: string[] = [];
  const mine = by('my_period');
  const sub = by('substitute');
  const homeroom = by('homeroom');
  if (mine.length) parts.push(`tiết ${mine.join(', ')} (của bạn)`);
  if (sub.length) parts.push(`tiết ${sub.join(', ')} (dạy thay)`);
  if (homeroom.length) parts.push(`tiết ${homeroom.join(', ')} (lớp chủ nhiệm)`);
  const mixed = by('mixed');
  const mixedNote = mixed.length ? `tiết ${mixed.join(', ')} là lớp trộn (không chấm điểm)` : '';
  if (parts.length === 0 && mixedNote && !items.some((x) => x.reason === 'not_mine' || x.reason === 'no_alias')) return `${mixedNote[0].toUpperCase()}${mixedNote.slice(1)}.`;
  if (parts.length === 0) return items.some((x) => x.reason === 'no_alias') ? EDIT_REASON_TEXT.no_alias : 'Không có tiết nào của bạn — chỉ xem.';
  return `Bạn được ghi/chấm ${parts.join('; ')}${mixedNote ? `; ${mixedNote}` : ''}${items.some((x) => x.reason === 'not_mine' || x.reason === 'no_alias') ? '; các tiết khác chỉ xem' : ''}.`;
}

/**
 * Các lớp GV được chọn xem trong ô "Lớp" của Sổ đầu bài.
 * BGH/TPT/Giám thị: mọi lớp. GV: lớp chủ nhiệm + lớp có tiết mình dạy theo TKB (tên đã nhận) + lớp dạy thay đã duyệt.
 * Không còn "trả về mọi lớp" khi không khớp gì — trước đây GV chưa nhận tên TKB thấy cả 26 lớp.
 */
export function visibleLogbookClassIds(opts: {
  activeRole: UserRole | null;
  allClassIds: string[];
  assignedClassId?: string | null;
  schedules: Record<string, ClassSchedule | undefined>;
  myAliases: string[];
  substituteClassIds?: string[];
}): string[] {
  const { activeRole, allClassIds } = opts;
  if (activeRole === 'admin' || activeRole === 'tpt' || activeRole === 'giamthi') return allClassIds;
  const allowed = new Set<string>();
  if (opts.assignedClassId && activeRole === 'gvcn') allowed.add(opts.assignedClassId);
  for (const s of myTeachingSlots(opts.schedules, opts.myAliases)) allowed.add(s.classId);
  for (const id of opts.substituteClassIds || []) allowed.add(id);
  const first = activeRole === 'gvcn' ? opts.assignedClassId : null;
  return allClassIds
    .filter((id) => allowed.has(id))
    .sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b, 'vi', { numeric: true })));
}

/** Lớp được chọn ở trang Điểm danh đầu giờ: BGH/TPT/Giám thị mọi lớp; GVCN chỉ lớp chủ nhiệm; vai trò khác không lớp nào. */
export function attendanceClassIds(activeRole: UserRole | null, assignedClassId: string | null | undefined, allClassIds: string[]): string[] {
  if (activeRole === 'admin' || activeRole === 'tpt' || activeRole === 'giamthi') return allClassIds;
  if (activeRole === 'gvcn' && assignedClassId) return [assignedClassId];
  return [];
}

/** Ai được LƯU điểm danh đầu giờ (khớp Firestore rules: BGH hoặc GVCN đúng lớp). */
export function canSaveAttendance(activeRole: UserRole | null, assignedClassId: string | null | undefined, classId: string): boolean {
  return activeRole === 'admin' || (activeRole === 'gvcn' && !!assignedClassId && assignedClassId === classId);
}

/** Giới hạn số tên trong teacher_aliases (Firestore rules: aliases.size() <= 10). */
export const MAX_ALIASES = 10;

/**
 * Bổ sung mọi CÁCH VIẾT THẬT trên TKB (slots + slotMap) của các tên đã chọn.
 * Lý do (lỗi 05/11, GV ký tiết lớp khác bị "Missing or insufficient permissions"): UI so tên đã chuẩn hóa
 * (hoa/thường, khoảng trắng, dấu NFC/NFD) nên cho mở form, còn Firestore rules so NGUYÊN VĂN
 * `slotMap[..].teacherName in aliases` → lớp ghi tên khác cách viết bị chặn. Lưu đủ các cách viết thì rules khớp.
 */
export function expandAliasVariants(
  aliases: string[],
  schedules: Record<string, (ClassSchedule & { slotMap?: Record<string, { teacherName?: string }> }) | undefined>,
  max = MAX_ALIASES
): string[] {
  const chosen = [...new Set(aliases.map((a) => (a || '').trim()).filter(Boolean))];
  const keys = new Set(chosen.map(normAlias));
  const out = [...chosen];
  const seen = new Set(out);
  const add = (raw: string | undefined) => {
    const t = (raw || '').trim();
    if (!t || seen.has(t) || !keys.has(normAlias(t))) return;
    seen.add(t);
    out.push(t);
  };
  for (const sch of Object.values(schedules)) {
    for (const s of sch?.slots || []) add(s.teacherName);
    for (const v of Object.values(sch?.slotMap || {})) add(v?.teacherName);
  }
  return out.slice(0, Math.max(max, chosen.length));
}

/** Tên đã lưu còn thiếu cách viết nào có trên TKB không (để tự bổ sung 1 lần). */
export function missingAliasVariants(
  aliases: string[],
  schedules: Parameters<typeof expandAliasVariants>[1]
): string[] {
  const have = new Set(aliases.map((a) => (a || '').trim()));
  return expandAliasVariants(aliases, schedules).filter((a) => !have.has(a));
}

/** Hiển thị tên TKB: mỗi tên 1 lần (ẩn các cách viết phụ đã lưu kèm). */
export function uniqueAliasLabels(aliases: string[]): string[] {
  const seen = new Set<string>();
  return aliases.filter((a) => {
    const k = normAlias(a);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Tiết mặc định khi mở "Chấm tiết dạy của tôi" (lỗi 05/11: GV ở vai trò GVBM lại thấy sổ lớp chủ nhiệm):
 * hôm nay → tiết đang dạy hoặc tiết sắp tới (theo giờ kết thúc tiết), hết giờ → tiết cuối; ngày khác → tiết đầu tiên.
 * `endTimes`: giờ kết thúc từng tiết 'HH:mm' (theo chuông).
 */
export function pickDefaultTeachingSlot<T extends { periodIndex: number }>(
  slots: T[],
  date: string,
  endTimes: Record<number, string>,
  now: Date = new Date()
): T | null {
  if (slots.length === 0) return null;
  const sorted = [...slots].sort((a, b) => a.periodIndex - b.periodIndex);
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (date !== today) return sorted[0];
  const minutes = now.getHours() * 60 + now.getMinutes();
  const notOver = sorted.find((s) => {
    const [h, m] = (endTimes[s.periodIndex] || '23:59').split(':').map(Number);
    return h * 60 + m >= minutes;
  });
  return notOver ?? sorted[sorted.length - 1];
}
