/**
 * Thông báo Văn phòng (bảng tin nội bộ chống trôi tin Zalo): nhãn đối tượng, người nhận, hạn chót,
 * nhắc trước hạn, xác nhận "Đã đọc"/"Đã thực hiện". Hàm thuần — không gọi Firebase.
 */

import type { UserRole } from '../types/auth';
import { safeDocUrl } from './adminDocs';

export type NoticeTag = 'all' | 'gvcn' | 'gvbm' | 'tpt' | 'giamthi' | 'bgh';
/**
 * GVCN theo khối: tính từ lớp chủ nhiệm (assignedClassId '6A1' → khối 6).
 * KHÔNG lưu vào `tags` (bản app cũ chỉ hiểu 6 nhãn trên) — lưu tên hiển thị vào `groupNames`.
 */
export const HOMEROOM_GRADES = ['6', '7', '8', '9'] as const;
export type HomeroomGrade = (typeof HOMEROOM_GRADES)[number];
export const gradeGroupName = (g: HomeroomGrade) => `GVCN khối ${g}`;

export const NOTICE_TAGS: Record<NoticeTag, { label: string; className: string }> = {
  all: { label: 'Toàn thể GV', className: 'bg-slate-100 text-slate-800 border-slate-300' },
  gvcn: { label: 'GVCN', className: 'bg-rose-100 text-rose-900 border-rose-300' },
  gvbm: { label: 'GVBM', className: 'bg-sky-100 text-sky-900 border-sky-300' },
  tpt: { label: 'TPT', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  giamthi: { label: 'Giám thị', className: 'bg-orange-100 text-orange-900 border-orange-300' },
  bgh: { label: 'BGH', className: 'bg-purple-100 text-purple-900 border-purple-300' },
};

/** Nhãn để hiển thị (bỏ qua nhãn lạ từ dữ liệu cũ/mới hơn bản app). */
export function knownTags(tags: string[] | undefined): NoticeTag[] {
  return (tags || []).filter((t): t is NoticeTag => t in NOTICE_TAGS);
}

/** Vai trò → nhãn nhận tin. "Toàn thể GV" = mọi nhân sự trường (trừ Văn phòng, người gửi). */
const ROLE_TAG: Partial<Record<UserRole, NoticeTag>> = { gvcn: 'gvcn', gvbm: 'gvbm', tpt: 'tpt', giamthi: 'giamthi', admin: 'bgh' };
const STAFF_FOR_ALL: UserRole[] = ['admin', 'gvcn', 'gvbm', 'tpt', 'giamthi'];

export interface DirectoryEntry {
  uid: string;
  displayName: string;
  roles?: UserRole[];
  /** GVCN: lớp chủ nhiệm (vd. '6A1') — để chọn "GVCN khối 6" */
  assignedClassId?: string;
}

/** Người nhận = những ai khớp nhãn + những người chọn đích danh (không trùng). */
export function resolveRecipients(dir: DirectoryEntry[], tags: NoticeTag[], pickedUids: string[] = [], grades: HomeroomGrade[] = []): string[] {
  const out = new Set<string>(pickedUids);
  for (const p of dir) {
    const roles = p.roles || [];
    if (tags.includes('all') && roles.some((r) => STAFF_FOR_ALL.includes(r))) out.add(p.uid);
    if (roles.some((r) => ROLE_TAG[r] && tags.includes(ROLE_TAG[r]!))) out.add(p.uid);
    const grade = roles.includes('gvcn') && p.assignedClassId ? p.assignedClassId.charAt(0) : '';
    if (grade && (grades as string[]).includes(grade)) out.add(p.uid);
  }
  return [...out].sort();
}

// ---------------------------------------------------------------------------
// Nhóm người nhận lưu sẵn (tổ bộ môn, ban, danh sách GV cụ thể) — /directory/notice_groups
// Văn phòng / BGH tạo 1 lần, dùng lại khi soạn. Người nhận vẫn chốt khi gửi (recipientUids).
// ---------------------------------------------------------------------------
export interface NoticeGroup {
  id: string;
  name: string;
  uids: string[];
  updatedAt: number;
  updatedBy: string;
}

export const NOTICE_GROUP_MAX = 50;
export const NOTICE_GROUP_MEMBERS_MAX = 150;

/** Thành viên của các nhóm đã chọn (không trùng; bỏ người không còn trong danh bạ nếu có danh bạ). */
export function groupMembers(groups: NoticeGroup[], selectedIds: string[], dir?: DirectoryEntry[]): string[] {
  const known = dir && dir.length > 0 ? new Set(dir.map((d) => d.uid)) : null;
  const out = new Set<string>();
  for (const g of groups) {
    if (!selectedIds.includes(g.id)) continue;
    g.uids.forEach((u) => (!known || known.has(u)) && out.add(u));
  }
  return [...out].sort();
}

export function validateGroup(g: Pick<NoticeGroup, 'id' | 'name' | 'uids'>, all: NoticeGroup[]): string | null {
  const name = g.name.trim();
  if (!name) return 'Nhập tên nhóm.';
  if (name.length > 60) return 'Tên nhóm tối đa 60 ký tự.';
  if (g.uids.length === 0) return 'Chọn ít nhất một thành viên.';
  if (g.uids.length > NOTICE_GROUP_MEMBERS_MAX) return `Mỗi nhóm tối đa ${NOTICE_GROUP_MEMBERS_MAX} người.`;
  const fold = (x: string) => x.trim().toLocaleLowerCase('vi');
  if (all.some((o) => o.id !== g.id && fold(o.name) === fold(name))) return 'Đã có nhóm trùng tên.';
  if (!all.some((o) => o.id === g.id) && all.length >= NOTICE_GROUP_MAX) return `Tối đa ${NOTICE_GROUP_MAX} nhóm.`;
  return null;
}

/** Thêm mới hoặc thay nhóm cùng id; sắp theo tên. */
export function upsertGroup(all: NoticeGroup[], g: NoticeGroup): NoticeGroup[] {
  const next = [...all.filter((o) => o.id !== g.id), { ...g, name: g.name.trim(), uids: [...new Set(g.uids)].sort() }];
  return next.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export interface NoticeAck {
  uid: string;
  displayName: string;
  readAt?: number;
  doneAt?: number;
}

export interface OfficeNotice {
  id: string;
  title: string;
  body: string;
  tags: NoticeTag[];
  recipientUids: string[];
  /** Tên các nhóm lưu sẵn đã chọn khi gửi (chỉ để hiển thị) */
  groupNames?: string[];
  /** Tệp đính kèm = link Google Drive/Docs… (không lưu file trên Firebase). Chỉ người nhận đọc được tin nên chỉ họ thấy link. */
  attachments?: NoticeAttachment[];
  /** Tin gợi ý soạn sẵn để GV gửi PH/HS (sao chép một chạm) */
  parentMessage?: string;
  pinned: boolean;
  requiresDone: boolean;
  /** epoch ms; null = không hạn */
  deadlineAt: number | null;
  /** Nhắc trước hạn: số phút (vd. 1440 = 1 ngày, 120 = 2 giờ) */
  remindBefore: number[];
  authorId: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
}

/** Tệp đính kèm: link (url) HOẶC tệp tải lên lưu trong Firestore (fileId + size + type). */
export interface NoticeAttachment {
  name: string;
  url?: string;
  fileId?: string;
  size?: number;
  type?: string;
  /** Tệp chuyển tiếp từ Hành chính – Văn bản: tệp nằm ở /admin_docs/{srcDocId}/files/{fileId} (không chép lại). */
  srcDocId?: string;
}

/** Số link tối đa (tệp tải lên giới hạn riêng ở utils/noticeFiles.ts). */
export const NOTICE_ATTACHMENT_MAX = 5;

/** Tên hiển thị khi người gửi để trống: loại link (Google Docs, Google Drive…). */
function defaultAttachmentName(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'docs.google.com') {
      const kind = u.pathname.split('/')[1];
      return { document: 'Google Docs', spreadsheets: 'Google Sheets', presentation: 'Google Slides', forms: 'Google Forms' }[kind] || 'Google Drive';
    }
    if (u.hostname === 'drive.google.com') return 'Google Drive';
    return u.hostname;
  } catch {
    return 'Tệp đính kèm';
  }
}

/** Bỏ dòng trống, chuẩn hoá link, đặt tên mặc định. Trả về lỗi nếu có link không hợp lệ hoặc quá nhiều tệp. */
export function cleanAttachments(input: Array<{ name: string; url: string }>): { attachments: NoticeAttachment[]; error: string | null } {
  const filled = input.filter((r) => r.name.trim() || r.url.trim());
  if (filled.length > NOTICE_ATTACHMENT_MAX) return { attachments: [], error: `Tối đa ${NOTICE_ATTACHMENT_MAX} tệp đính kèm.` };
  const out: NoticeAttachment[] = [];
  for (const r of filled) {
    const url = safeDocUrl(r.url);
    if (!url || r.url.trim().length > 1000) return { attachments: [], error: `Link tệp "${r.name.trim() || r.url.trim()}" phải bắt đầu bằng https:// (vd. link chia sẻ Google Drive).` };
    out.push({ name: (r.name.trim() || defaultAttachmentName(url)).slice(0, 120), url });
  }
  return { attachments: out, error: null };
}

/** Chỉ hiển thị link https hợp lệ (phòng dữ liệu lạ). */
export function visibleAttachments(list: NoticeAttachment[] | undefined): Array<NoticeAttachment & { url: string }> {
  return (list || []).flatMap((a) => {
    const url = a && typeof a.url === 'string' ? safeDocUrl(a.url) : null;
    return url ? [{ name: String(a.name || 'Tệp đính kèm'), url }] : [];
  });
}

/** Tệp tải lên (có fileId hợp lệ). */
export function uploadedFiles(list: NoticeAttachment[] | undefined): Array<NoticeAttachment & { fileId: string }> {
  return (list || []).flatMap((a) =>
    a && typeof a.fileId === 'string' && /^[A-Za-z0-9]{1,40}$/.test(a.fileId)
      ? [
          {
            name: String(a.name || 'tep'),
            fileId: a.fileId,
            size: Number(a.size) || 0,
            type: String(a.type || ''),
            ...(typeof a.srcDocId === 'string' && /^[A-Za-z0-9]{1,40}$/.test(a.srcDocId) ? { srcDocId: a.srcDocId } : {}),
          },
        ]
      : []
  );
}

export type NoticeStatus = 'done' | 'overdue' | 'due_soon' | 'open' | 'read';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "còn 2 ngày 3 giờ" / "còn 45 phút" / "quá hạn 1 ngày" */
export function formatRemaining(ms: number): string {
  const late = ms < 0;
  let v = Math.abs(ms);
  const d = Math.floor(v / DAY);
  v -= d * DAY;
  const h = Math.floor(v / HOUR);
  v -= h * HOUR;
  const m = Math.floor(v / MIN);
  const text = d > 0 ? `${d} ngày${h ? ` ${h} giờ` : ''}` : h > 0 ? `${h} giờ${m ? ` ${m} phút` : ''}` : m > 0 ? `${m} phút` : 'dưới 1 phút';
  return late ? `quá hạn ${text}` : `còn ${text}`;
}

/** Trạng thái của 1 tin với 1 người nhận (để nhắc trong app). */
export function noticeStatus(n: Pick<OfficeNotice, 'deadlineAt' | 'remindBefore' | 'requiresDone'>, ack: NoticeAck | undefined, now: number): NoticeStatus {
  const finished = n.requiresDone ? !!ack?.doneAt : !!ack?.readAt;
  if (finished) return n.requiresDone ? 'done' : 'read';
  if (n.deadlineAt != null) {
    if (now > n.deadlineAt) return 'overdue';
    const earliest = Math.max(0, ...(n.remindBefore || []));
    if (earliest > 0 && now >= n.deadlineAt - earliest * MIN) return 'due_soon';
  }
  return 'open';
}

/** Bảng tin: ghim lên đầu → quá hạn/sắp hạn chưa xong → hạn gần hơn → mới hơn. */
export function sortNotices<T extends OfficeNotice>(list: T[], acks: Map<string, NoticeAck>, now: number): T[] {
  const rank = (n: T) => {
    const s = noticeStatus(n, acks.get(n.id), now);
    return s === 'overdue' ? 0 : s === 'due_soon' ? 1 : s === 'open' ? 2 : 3;
  };
  return [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      rank(a) - rank(b) ||
      (a.deadlineAt ?? Infinity) - (b.deadlineAt ?? Infinity) ||
      b.createdAt - a.createdAt
  );
}

/** Theo dõi cho người gửi: ai đã đọc / đã thực hiện / chưa. */
export function trackNotice(recipientUids: string[], acks: NoticeAck[], dir: DirectoryEntry[]) {
  const name = (uid: string) => dir.find((d) => d.uid === uid)?.displayName || acks.find((a) => a.uid === uid)?.displayName || uid;
  const byUid = new Map(acks.map((a) => [a.uid, a]));
  const read = recipientUids.filter((u) => byUid.get(u)?.readAt);
  const done = recipientUids.filter((u) => byUid.get(u)?.doneAt);
  return {
    total: recipientUids.length,
    read: read.length,
    done: done.length,
    notRead: recipientUids.filter((u) => !byUid.get(u)?.readAt).map(name).sort((a, b) => a.localeCompare(b, 'vi')),
    notDone: recipientUids.filter((u) => !byUid.get(u)?.doneAt).map(name).sort((a, b) => a.localeCompare(b, 'vi')),
  };
}

/** Các mốc nhắc dựng sẵn cho người đăng. */
export const REMIND_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 2 * 24 * 60, label: 'Trước 2 ngày' },
  { minutes: 24 * 60, label: 'Trước 1 ngày' },
  { minutes: 3 * 60, label: 'Trước 3 giờ' },
  { minutes: 60, label: 'Trước 1 giờ' },
];

export function validateNotice(n: Pick<OfficeNotice, 'title' | 'body' | 'recipientUids' | 'deadlineAt'>, now: number): string | null {
  if (!n.title.trim()) return 'Nhập tiêu đề.';
  if (n.title.length > 150) return 'Tiêu đề tối đa 150 ký tự.';
  if (!n.body.trim()) return 'Nhập nội dung.';
  if (n.body.length > 5000) return 'Nội dung tối đa 5000 ký tự.';
  if (n.recipientUids.length === 0) return 'Chọn ít nhất một nhãn hoặc một người nhận.';
  if (n.deadlineAt != null && n.deadlineAt < now) return 'Hạn chót phải ở tương lai.';
  return null;
}

/** Hộp thư Văn phòng: số tin mới nhất tải mỗi lần, khoảng cách tối thiểu giữa 2 lần tải (bài học chi phí 12/10). */
export const OFFICE_NOTICE_LIMIT = 50;
export const OFFICE_REFRESH_MS = 15 * 60_000;

/** Có nên tải lại hộp thư không: không bao giờ khi tab ẩn; lần đầu luôn tải; sau đó tối thiểu 15 phút/lần. */
export function shouldRefreshNotices(s: { hidden: boolean; lastAt: number | null; now: number }, minMs = OFFICE_REFRESH_MS): boolean {
  if (s.hidden) return false;
  if (s.lastAt == null) return true;
  return s.now - s.lastAt >= minMs;
}
