/**
 * Hành chính – Văn bản – Quy trình: Văn phòng / BGH đăng tài liệu dưới dạng tệp tải trực tiếp (chia khối lưu trong Firestore)
 * hoặc LINK (Google Drive/Docs/Sheets/Forms…), hoặc chỉ nội dung văn bản (có nhắc nhở nếu chưa đính kèm tệp/link).
 * Hàm thuần — không gọi Firebase.
 */

import { foldText } from './navGroups';
import type { NoticeAttachment } from './officeNotices';

export type AdminDocCategory = 'van_ban' | 'huong_dan' | 'quy_trinh' | 'bieu_mau';

export const ADMIN_DOC_CATEGORIES: Record<AdminDocCategory, { vi: string; en: string; className: string }> = {
  van_ban: { vi: 'Văn bản', en: 'Official documents', className: 'bg-sky-100 text-sky-900 border-sky-300' },
  huong_dan: { vi: 'Hướng dẫn', en: 'Guides', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  quy_trinh: { vi: 'Quy trình', en: 'Procedures', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  bieu_mau: { vi: 'Biểu mẫu', en: 'Forms & templates', className: 'bg-purple-100 text-purple-900 border-purple-300' },
};

export interface AdminDoc {
  id: string;
  title: string;
  category: AdminDocCategory;
  /** Link https (Drive/Docs/Sheets/Forms hoặc trang chính thức) — tuỳ chọn */
  url: string;
  /** Tệp đính kèm trực tiếp từ máy (lưu chia khối trong Firestore) — tuỳ chọn */
  attachments?: NoticeAttachment[];
  description: string;
  /** Số/ký hiệu văn bản (tuỳ chọn), vd. "125/QĐ-THCSNN" */
  docNumber: string;
  /** Ngày ban hành / hiệu lực 'YYYY-MM-DD' ('' = không ghi) */
  issuedDate: string;
  pinned: boolean;
  authorId: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
}

export type AdminDocInput = Pick<AdminDoc, 'title' | 'category' | 'url' | 'attachments' | 'description' | 'docNumber' | 'issuedDate' | 'pinned'>;

/** Dựng bản AdminDoc vừa lưu (khớp phép làm sạch của service) để cập nhật cache mà không đọc lại. */
export function buildSavedAdminDoc(
  id: string,
  d: AdminDocInput,
  base: Pick<AdminDoc, 'authorId' | 'authorName' | 'createdAt'>,
  now: number = Date.now()
): AdminDoc {
  return {
    id,
    title: d.title.trim(),
    category: d.category,
    url: safeDocUrl(d.url) || '',
    ...(d.attachments ? { attachments: d.attachments } : {}),
    description: d.description.trim(),
    docNumber: d.docNumber.trim(),
    issuedDate: d.issuedDate,
    pinned: d.pinned,
    authorId: base.authorId,
    authorName: base.authorName,
    createdAt: base.createdAt,
    updatedAt: now,
  };
}

/** Tải tối đa bao nhiêu tài liệu mỗi lần mở trang (1 truy vấn, không polling). */
export const ADMIN_DOC_LIMIT = 300;

/** Chỉ nhận https (chặn javascript:, http:, data:…). Trả về URL đã chuẩn hoá hoặc null. */
export function safeDocUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type LinkKind = 'drive' | 'docs' | 'sheets' | 'slides' | 'forms' | 'web';

/** Loại link để hiện biểu tượng/nhãn ("Google Docs", "Google Drive"…). */
export function linkKind(url: string): LinkKind {
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    return 'web';
  }
  if (host === 'docs.google.com') {
    if (path.startsWith('/document')) return 'docs';
    if (path.startsWith('/spreadsheets')) return 'sheets';
    if (path.startsWith('/presentation')) return 'slides';
    if (path.startsWith('/forms')) return 'forms';
    return 'drive';
  }
  if (host === 'forms.gle') return 'forms';
  if (host === 'drive.google.com') return 'drive';
  return 'web';
}

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  drive: 'Google Drive',
  docs: 'Google Docs',
  sheets: 'Google Sheets',
  slides: 'Google Slides',
  forms: 'Google Forms',
  web: 'Trang web',
};

export function validateAdminDoc(d: AdminDocInput): string | null {
  if (!d.title.trim()) return 'Nhập tên tài liệu.';
  if (d.title.trim().length > 200) return 'Tên tài liệu tối đa 200 ký tự.';
  if (!(d.category in ADMIN_DOC_CATEGORIES)) return 'Chọn loại tài liệu.';
  if (d.url.trim()) {
    if (!safeDocUrl(d.url)) return 'Link phải bắt đầu bằng https:// (vd. link chia sẻ Google Drive).';
    if (d.url.trim().length > 1000) return 'Link quá dài.';
  }
  if (d.description.length > 2000) return 'Mô tả tối đa 2000 ký tự.';
  if (d.docNumber.length > 60) return 'Số hiệu tối đa 60 ký tự.';
  if (d.issuedDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.issuedDate)) return 'Ngày ban hành không hợp lệ.';
  return null;
}

/** Kiểm tra tài liệu đã có link hoặc tệp đính kèm chưa (dùng cho chế độ nhắc nhở tránh quên, không bắt buộc). */
export function hasAdminDocAttachment(
  d: Pick<AdminDocInput, 'url' | 'attachments'>,
  newUploadCount = 0
): boolean {
  return Boolean(d.url.trim()) || (d.attachments?.length || 0) > 0 || newUploadCount > 0;
}

/** Ghim lên đầu → mới cập nhật trước. */
export function sortAdminDocs<T extends Pick<AdminDoc, 'pinned' | 'updatedAt'>>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

/** Lọc theo loại + tìm không dấu trong tên, số hiệu, mô tả. */
export function filterAdminDocs<T extends Pick<AdminDoc, 'category' | 'title' | 'docNumber' | 'description'>>(
  list: T[],
  category: AdminDocCategory | 'all',
  q: string
): T[] {
  const needle = foldText(q.trim());
  return list.filter(
    (d) => (category === 'all' || d.category === category) && (!needle || foldText(`${d.title} ${d.docNumber} ${d.description}`).includes(needle))
  );
}

export function countByCategory(list: Array<Pick<AdminDoc, 'category'>>): Record<AdminDocCategory, number> {
  const out: Record<AdminDocCategory, number> = { van_ban: 0, huong_dan: 0, quy_trinh: 0, bieu_mau: 0 };
  list.forEach((d) => d.category in out && out[d.category]++);
  return out;
}

/** BGH + Văn phòng quản lý; nhân sự khác chỉ xem. */
export function canManageAdminDocs(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'vanphong';
}

/** Tài liệu mới đăng/cập nhật trong `days` ngày gần đây → gắn nhãn "Mới". */
export const ADMIN_DOC_NEW_DAYS = 7;
export function isRecentDoc(updatedAt: number, now: number = Date.now(), days = ADMIN_DOC_NEW_DAYS): boolean {
  return updatedAt > 0 && now - updatedAt >= 0 && now - updatedAt < days * 86_400_000;
}

export type AdminDocSort = 'newest' | 'issued' | 'title';

/** Sắp xếp danh sách: mới nhất (ghim lên đầu) • ngày ban hành mới trước • tên A→Z. */
export function sortAdminDocsBy<T extends Pick<AdminDoc, 'pinned' | 'updatedAt' | 'issuedDate' | 'title'>>(list: T[], mode: AdminDocSort): T[] {
  if (mode === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' }));
  if (mode === 'issued')
    return [...list].sort((a, b) => (b.issuedDate || '').localeCompare(a.issuedDate || '') || b.updatedAt - a.updatedAt);
  return sortAdminDocs(list);
}

/** Dòng meta gọn: số hiệu · ngày ban hành (dd/mm/yyyy) — bỏ phần trống. */
export function adminDocMeta(d: Pick<AdminDoc, 'docNumber' | 'issuedDate'>): string[] {
  const out: string[] = [];
  if (d.docNumber?.trim()) out.push(`Số ${d.docNumber.trim()}`);
  if (d.issuedDate) out.push(d.issuedDate.split('-').reverse().join('/'));
  return out;
}

/** Mô tả có dài hơn mức hiển thị gọn không (để hiện "Xem chi tiết"). */
export function isLongDescription(text: string, maxChars = 160, maxLines = 2): boolean {
  const t = (text || '').trim();
  return t.length > maxChars || t.split('\n').length > maxLines;
}

/**
 * "Chuyển tiếp thành thông báo" (05/11): nội dung thông báo nhân sự (office_notices) tạo kèm khi đăng văn bản.
 * Tệp KHÔNG chép lại: đính kèm trỏ về tệp gốc của văn bản (srcDocId) — người nhận tải từ /admin_docs/{id}/files
 * (rules: nhân sự/Văn phòng đọc được). Link Drive (nếu có) đính kèm dạng link.
 */
export const FORWARD_NOTICE_TITLE_MAX = 150;
export const FORWARD_NOTICE_BODY_MAX = 5000;

export function buildForwardNotice(
  d: Pick<AdminDocInput, 'title' | 'category' | 'url' | 'description' | 'docNumber' | 'issuedDate'>,
  docId: string,
  attachments: NoticeAttachment[] = []
): { title: string; body: string; attachments: NoticeAttachment[] } {
  const cat = ADMIN_DOC_CATEGORIES[d.category] || ADMIN_DOC_CATEGORIES.van_ban;
  const title = d.title.trim().slice(0, FORWARD_NOTICE_TITLE_MAX);
  const meta = adminDocMeta(d);
  const head = `${cat.vi} mới${meta.length ? ` (${meta.join(', ')})` : ''}: ${d.title.trim()}`;
  const foot = 'Xem đầy đủ tại mục Hành chính – Văn bản.';
  const summary = d.description.trim();
  const room = FORWARD_NOTICE_BODY_MAX - head.length - foot.length - 4;
  const clipped = summary.length > room ? `${summary.slice(0, Math.max(0, room - 1))}…` : summary;
  const body = [head, clipped, foot].filter(Boolean).join('\n\n');
  const files = attachments
    .filter((a) => a && typeof a.fileId === 'string' && a.fileId)
    .map((a) => ({ name: a.name, fileId: a.fileId!, size: a.size || 0, type: a.type || '', srcDocId: docId }));
  const url = safeDocUrl(d.url || '');
  const links = url ? [{ name: `${cat.vi}: ${d.title.trim()}`.slice(0, 120), url }] : [];
  return { title, body, attachments: [...links, ...files] };
}
