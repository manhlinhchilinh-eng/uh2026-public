/**
 * Logic thuần cho Thông báo thông minh (không gọi Firebase) — dễ test.
 */

import type { UserRole } from '../types/auth';
import type { Announcement, AnnouncementAudience, AnnouncementLevel } from '../types/announcement';

export const LEVEL_META: Record<AnnouncementLevel, { label: string; emoji: string; rank: number }> = {
  urgent: { label: 'Khẩn cấp', emoji: '🔴', rank: 0 },
  important: { label: 'Quan trọng', emoji: '🟡', rank: 1 },
  normal: { label: 'Thông thường', emoji: '🟢', rank: 2 },
};

export function buildAudienceKeys(a: AnnouncementAudience): string[] {
  const scope = a.classId ? a.classId : 'all';
  const keys: string[] = [];
  if (a.toStaff) keys.push('staff');
  if (a.toParents) keys.push(`parent:${scope}`);
  if (a.toStudents) keys.push(`student:${scope}`);
  return keys;
}

/** Khóa mà 1 PH/HS được nhận (dùng cho truy vấn array-contains-any). */
export function familyAudienceKeys(role: 'parent' | 'student', classId?: string | null): string[] {
  return classId ? [`${role}:all`, `${role}:${classId}`] : [`${role}:all`];
}

/** Ai được soạn thông báo, phạm vi nào. BGH: mọi đối tượng. GVCN: chỉ lớp mình. */
export function composePolicy(role: UserRole | null, assignedClassId?: string | null) {
  if (role === 'admin') return { canCompose: true, fixedClassId: null as string | null };
  if (role === 'gvcn' && assignedClassId) return { canCompose: true, fixedClassId: assignedClassId };
  return { canCompose: false, fixedClassId: null as string | null };
}

export function validateAnnouncement(input: { title: string; body: string; audience: AnnouncementAudience }): string | null {
  if (!input.title.trim()) return 'Vui lòng nhập tiêu đề.';
  if (input.title.trim().length > 150) return 'Tiêu đề tối đa 150 ký tự.';
  if (!input.body.trim()) return 'Vui lòng nhập nội dung.';
  if (input.body.length > 5000) return 'Nội dung tối đa 5000 ký tự.';
  if (buildAudienceKeys(input.audience).length === 0) return 'Chọn ít nhất một đối tượng nhận.';
  return null;
}

/** Chưa đọc lên trước, rồi theo mức khẩn, rồi mới nhất. */
export function sortForInbox(items: Announcement[], readIds: Set<string>): Announcement[] {
  return [...items].sort((a, b) => {
    const ra = readIds.has(a.id) ? 1 : 0;
    const rb = readIds.has(b.id) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    const la = LEVEL_META[a.level].rank;
    const lb = LEVEL_META[b.level].rank;
    if (la !== lb) return la - lb;
    return b.createdAt - a.createdAt;
  });
}

export function unreadUrgent(items: Announcement[], readIds: Set<string>): Announcement[] {
  return items.filter((a) => a.level === 'urgent' && !readIds.has(a.id));
}

export function describeAudience(a: AnnouncementAudience): string {
  const who: string[] = [];
  if (a.toStaff) who.push('Giáo viên');
  if (a.toParents) who.push('Phụ huynh');
  if (a.toStudents) who.push('Học sinh');
  return `${who.join(', ')} • ${a.classId ? `Lớp ${a.classId}` : 'Toàn trường'}`;
}

/** Bản tin gọn để GVCN dán vào nhóm Zalo phụ huynh. */
export function formatForZalo(a: Pick<Announcement, 'title' | 'body' | 'level' | 'authorName' | 'createdAt' | 'classId'>): string {
  const d = new Date(a.createdAt);
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const meta = LEVEL_META[a.level];
  return [
    `${meta.emoji} [${meta.label.toUpperCase()}] ${a.title.trim()}`,
    `📅 ${date}${a.classId ? ` • Lớp ${a.classId}` : ''}`,
    '',
    a.body.trim(),
    '',
    `— ${a.authorName}, Trường THCS Ngoại ngữ (UMS)`,
  ].join('\n');
}

/**
 * Thông báo TKB gửi riêng từng lớp (PH/HS) không làm ngập hộp thư nhân sự:
 * nhân sự chỉ thấy bản của lớp mình chủ nhiệm (BGH xem bản tổng hợp).
 */
export function filterInboxForRole(items: Announcement[], role: UserRole, assignedClassId?: string | null): Announcement[] {
  if (role === 'parent' || role === 'student') return items;
  return items.filter((a) => !(a.kind === 'schedule_change' && a.classId && !a.audience.toStaff && a.classId !== assignedClassId));
}
