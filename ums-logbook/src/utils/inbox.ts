/**
 * Hộp thư Thông báo gộp: thông báo trường (/announcements) + thông báo Văn phòng (/office_notices)
 * hiện trong 1 danh sách. Dữ liệu vẫn ở 2 collection cũ (không đổi cấu trúc Firestore / rules).
 */

import type { Announcement } from '../types/announcement';
import type { UserRole } from '../types/auth';
import { noticeStatus, type NoticeAck, type NoticeStatus, type OfficeNotice } from './officeNotices';
import { foldText } from './navGroups';

interface InboxBase {
  id: string;
  title: string;
  createdAt: number;
  /** Tôi chưa mở tin này */
  unread: boolean;
  /** Khẩn cấp (thông báo mức khẩn) hoặc việc Văn phòng đã quá hạn */
  urgent: boolean;
  /** Việc Văn phòng yêu cầu "Đã thực hiện" mà tôi chưa xác nhận */
  needsAction: boolean;
  rank: number;
}
export type InboxItem =
  | (InboxBase & { kind: 'announcement'; announcement: Announcement })
  | (InboxBase & { kind: 'office'; notice: OfficeNotice; status: NoticeStatus });

export type InboxFilter = 'all' | 'unread' | 'action' | 'urgent';

/**
 * Thứ tự: việc quá hạn → khẩn chưa đọc / sắp hạn → tin ghim → chưa đọc → còn lại; cùng nhóm: mới hơn trước.
 */
export function buildInbox(
  announcements: Announcement[],
  readIds: Set<string>,
  notices: OfficeNotice[],
  acks: Map<string, NoticeAck>,
  now: number
): InboxItem[] {
  const items: InboxItem[] = [];
  for (const a of announcements) {
    const unread = !readIds.has(a.id);
    const urgent = a.level === 'urgent';
    items.push({
      kind: 'announcement', announcement: a, id: a.id, title: a.title, createdAt: a.createdAt,
      unread, urgent, needsAction: false, rank: urgent && unread ? 1 : unread ? 3 : 4,
    });
  }
  for (const n of notices) {
    const ack = acks.get(n.id);
    const status = noticeStatus(n, ack, now);
    const unread = !ack?.readAt;
    const rank = status === 'overdue' ? 0 : status === 'due_soon' ? 1 : n.pinned ? 2 : unread || status === 'open' ? 3 : 4;
    items.push({
      kind: 'office', notice: n, status, id: n.id, title: n.title, createdAt: n.createdAt,
      unread, urgent: status === 'overdue', needsAction: n.requiresDone && !ack?.doneAt, rank,
    });
  }
  return items.sort((a, b) => a.rank - b.rank || b.createdAt - a.createdAt);
}

export function filterInbox(items: InboxItem[], filter: InboxFilter, q: string): InboxItem[] {
  const needle = foldText(q);
  return items.filter((x) => {
    if (filter === 'unread' && !x.unread) return false;
    if (filter === 'action' && !x.needsAction) return false;
    if (filter === 'urgent' && !x.urgent) return false;
    if (needle) {
      const body = x.kind === 'announcement' ? x.announcement.body : x.notice.body;
      if (!foldText(`${x.title} ${body}`).includes(needle)) return false;
    }
    return true;
  });
}

/**
 * Ai soạn được gì (khớp rules hiện có): nhân sự → /office_notices (BGH, Văn phòng);
 * PH/HS → /announcements (BGH toàn trường, GVCN chỉ lớp chủ nhiệm).
 */
export function composeTargets(role: UserRole | null | undefined, assignedClassId?: string | null) {
  if (role === 'admin') return { staff: true, families: true, fixedClassId: null as string | null };
  if (role === 'vanphong') return { staff: true, families: false, fixedClassId: null as string | null };
  if (role === 'gvcn' && assignedClassId) return { staff: false, families: true, fixedClassId: assignedClassId as string | null };
  return { staff: false, families: false, fixedClassId: null as string | null };
}
