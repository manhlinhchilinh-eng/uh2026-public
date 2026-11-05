/**
 * Chuẩn hóa văn bản hành chính, thông báo văn phòng và thông báo trường về một dạng chung
 * để Trợ lý UMS+ tìm kiếm. Thuần hàm, không đọc Firestore.
 */
import type { AdminDoc } from '../adminDocs';
import type { OfficeNotice } from '../officeNotices';
import type { Announcement } from '../../types/announcement';

export type KnowledgeSource = 'admin_doc' | 'office_notice' | 'announcement';

export interface KnowledgeDoc {
  id: string;
  source: KnowledgeSource;
  title: string;
  text: string;
  docNumber?: string;
  /** epoch ms */
  date?: number;
  link: { path?: string; url?: string };
  /** Id văn bản hành chính gốc (nếu là bản chuyển tiếp) */
  srcDocId?: string;
}

function adminDate(d: AdminDoc): number {
  const t = d.issuedDate ? Date.parse(d.issuedDate) : NaN;
  return Number.isFinite(t) ? t : d.updatedAt;
}

export function toKnowledgeDocs(input: {
  adminDocs?: AdminDoc[];
  officeNotices?: OfficeNotice[];
  announcements?: Announcement[];
}): KnowledgeDoc[] {
  const adminDocs = input.adminDocs || [];
  const adminIds = new Set(adminDocs.map((d) => d.id));
  const out: KnowledgeDoc[] = [];

  for (const d of adminDocs) {
    out.push({
      id: d.id,
      source: 'admin_doc',
      title: d.title,
      text: d.description || '',
      ...(d.docNumber ? { docNumber: d.docNumber } : {}),
      date: adminDate(d),
      link: { path: `/hanh-chinh?open=${d.id}`, ...(d.url ? { url: d.url } : {}) },
    });
  }

  for (const n of input.officeNotices || []) {
    // Tin chỉ chuyển tiếp văn bản đã có trong danh sách → giữ bản admin_doc, bỏ bản trùng.
    const fwd = (n.attachments || []).find((a) => a.srcDocId && adminIds.has(a.srcDocId));
    if (fwd) continue;
    const src = (n.attachments || []).find((a) => a.srcDocId)?.srcDocId;
    out.push({
      id: n.id,
      source: 'office_notice',
      title: n.title,
      text: n.body || '',
      date: n.createdAt,
      link: { path: `/announcements?open=${n.id}` },
      ...(src ? { srcDocId: src } : {}),
    });
  }

  for (const a of input.announcements || []) {
    if (a.kind === 'schedule_change') continue;
    out.push({
      id: a.id,
      source: 'announcement',
      title: a.title,
      text: a.body || '',
      date: a.createdAt,
      link: { path: `/announcements?open=${a.id}` },
    });
  }

  return out.sort((x, y) => (y.date ?? 0) - (x.date ?? 0));
}
