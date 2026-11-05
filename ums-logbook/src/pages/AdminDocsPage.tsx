/**
 * Hành chính – Văn bản – Quy trình: kho tài liệu dùng chung (văn bản, hướng dẫn, quy trình, biểu mẫu).
 * Văn phòng / BGH tải tệp trực tiếp từ máy (chia khối lưu trong Firestore) hoặc đăng link (Google Drive…),
 * nhân sự tìm, lọc, mở/tải. Không bắt buộc phải có link hoặc tệp (chỉ nhắc nhở tránh quên).
 * Tải 1 lần khi mở trang (không polling) — bài học chi phí 12/10.
 * Giao diện 05/11: danh sách quét nhanh (mô tả cắt 2 dòng + xem chi tiết), mở link bằng icon theo loại,
 * Sửa/Xóa gom vào menu "…" (chỉ BGH/Văn phòng), tab loại + tìm + sắp xếp cùng 1 hàng.
 */

import { CONTENT_HINT_TEXT, needsContentHint } from '../utils/assistant/contentHint';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  HardDrive,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';
import { Bi } from '../components/common/Bi';
import { Modal } from '../components/common/Modal';
import {
  ADMIN_DOC_CATEGORIES,
  LINK_KIND_LABEL,
  adminDocMeta,
  buildForwardNotice,
  buildSavedAdminDoc,
  canManageAdminDocs,
  countByCategory,
  filterAdminDocs,
  hasAdminDocAttachment,
  isLongDescription,
  isRecentDoc,
  linkKind,
  safeDocUrl,
  sortAdminDocsBy,
  validateAdminDoc,
  type AdminDoc,
  type AdminDocCategory,
  type AdminDocInput,
  type AdminDocSort,
  type LinkKind,
} from '../utils/adminDocs';
import {
  createAdminDoc,
  deleteAdminDoc,
  downloadAdminDocFile,
  newAdminDocId,
  updateAdminDoc,
  uploadAdminDocFile,
} from '../services/adminDocService';
import { getAdminDocsCached, removeCachedAdminDoc, upsertCachedAdminDoc } from '../services/adminDocCache';
import { NOTICE_FILE_EXTENSIONS, NOTICE_FILE_MAX_COUNT, formatBytes, validateNoticeFiles } from '../utils/noticeFiles';
import { uploadedFiles, type DirectoryEntry, type NoticeAttachment, type NoticeGroup } from '../utils/officeNotices';
import { createNotice } from '../services/officeNoticeService';
import { fetchNoticeGroups } from '../services/noticeGroupService';
import { fetchStaffDirectoryPublic } from '../services/substitutionService';
import { EMPTY_SELECTION, StaffRecipientPicker, resolveSelection, type StaffRecipientSelection } from '../components/notices/StaffRecipientPicker';
import type { UserProfile } from '../types/auth';

const EMPTY: AdminDocInput = {
  title: '',
  category: 'van_ban',
  url: '',
  attachments: [],
  description: '',
  docNumber: '',
  issuedDate: '',
  pinned: false,
};
const CATS = Object.keys(ADMIN_DOC_CATEGORIES) as AdminDocCategory[];

/** Biểu tượng theo loại link — thay cho nút "Mở (…)" chữ to. */
const LINK_ICON: Record<LinkKind, React.FC<{ className?: string }>> = {
  drive: HardDrive,
  docs: FileText,
  sheets: FileSpreadsheet,
  slides: Presentation,
  forms: ClipboardList,
  web: Globe,
};

/** Màu chấm theo loại tài liệu (badge gọn). */
const CAT_DOT: Record<AdminDocCategory, string> = {
  van_ban: 'bg-sky-500',
  huong_dan: 'bg-emerald-500',
  quy_trinh: 'bg-amber-500',
  bieu_mau: 'bg-purple-500',
};

const toInput = (d: AdminDoc): AdminDocInput => ({
  title: d.title,
  category: d.category,
  url: d.url || '',
  attachments: d.attachments || [],
  description: d.description,
  docNumber: d.docNumber,
  issuedDate: d.issuedDate,
  pinned: d.pinned,
});

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B1A4A]';

export const AdminDocsPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const canManage = canManageAdminDocs(activeRole);
  const [docs, setDocs] = useState<AdminDoc[] | null>(null);
  const [cat, setCat] = useState<AdminDocCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<AdminDocSort>('newest');
  const [editing, setEditing] = useState<{ id: string | null; input: AdminDocInput } | null>(null);
  const [viewing, setViewing] = useState<AdminDoc | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('open');
  const [missingOpen, setMissingOpen] = useState(false);
  const uid = profile?.uid || '';

  // Tải khi mở trang qua cache dùng chung (lần đầu đọc đủ, sau đó chỉ phần đổi); không polling
  const load = (force = false) =>
    !uid
      ? Promise.resolve()
      : getAdminDocsCached(uid, { force })
      .then((d) => setDocs(d))
      .catch((e) => {
        console.warn('[Hành chính] tải tài liệu', e);
        setDocs([]);
      });
  useEffect(() => {
    load();
  }, [uid]);

  // ?open=<id>: mở chi tiết + cuộn tới dòng; id lạ → ghi chú nhẹ không chặn
  useEffect(() => {
    if (!openId || docs == null) return;
    const target = docs.find((x) => x.id === openId);
    if (!target) {
      setMissingOpen(true);
    } else {
      setMissingOpen(false);
      setViewing(target);
      window.setTimeout(() => {
        document.querySelector(`[data-testid="admin-doc-${openId}"]`)?.scrollIntoView?.({ block: 'center' });
      }, 0);
    }
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete('open');
        return n;
      },
      { replace: true }
    );
  }, [openId, docs]);

  const counts = useMemo(() => countByCategory(docs || []), [docs]);
  const shown = useMemo(() => sortAdminDocsBy(filterAdminDocs(docs || [], cat, q), sort), [docs, cat, q, sort]);

  const remove = async (d: AdminDoc) => {
    if (!window.confirm(`Xóa "${d.title}" khỏi danh sách? (Tệp đã tải lên bị xóa theo; file trên Drive không bị xóa.)`)) return;
    try {
      await deleteAdminDoc(d.id, d.attachments);
      showToast('Đã xóa.', 'success');
      setViewing(null);
      removeCachedAdminDoc(uid, d.id);
      setDocs((cur) => (cur ? cur.filter((x) => x.id !== d.id) : cur));
    } catch {
      showToast('Không xóa được (kiểm tra quyền).', 'error');
    }
  };
  const edit = (d: AdminDoc) => {
    setViewing(null);
    setEditing({ id: d.id, input: toInput(d) });
  };

  const downloadFile = async (docId: string, a: UploadedFile) => {
    const key = `${docId}_${a.fileId}`;
    setDownloadingId(key);
    try {
      const url = URL.createObjectURL(await downloadAdminDocFile(docId, a));
      const link = document.createElement('a');
      link.href = url;
      link.download = a.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      console.error('[Hành chính] tải tệp', e);
      showToast('Không tải được tệp (kiểm tra quyền hoặc kết nối).', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header gọn: 1 tiêu đề + 1 dòng mô tả */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:flex p-2.5 rounded-xl bg-ums-50 text-[#8B1A4A] shrink-0">
            <FolderOpen className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              <Bi vi="Hành chính – Văn bản" en="Admin Documents" layout="inline" />
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              <Bi
                vi="Văn bản, hướng dẫn, quy trình, biểu mẫu — luôn bản mới nhất"
                en="Documents, guides, procedures & forms — always the latest"
                layout="inline"
              />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
        <span className="hidden md:block max-w-[16rem] text-[11px] leading-tight text-slate-500 text-right">Thiếu văn bản mới hoặc còn văn bản đã gỡ? Bấm Làm mới.</span>
        <button
          type="button"
          onClick={() => load(true)}
          data-testid="admin-doc-refresh"
          aria-label="Làm mới"
          title="Làm mới"
          className={`inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 ${focusRing}`}
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing({ id: null, input: EMPTY })}
            data-testid="admin-doc-new"
            className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold bg-[#8B1A4A] text-white hover:bg-[#6B1338] shrink-0 ${focusRing}`}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              <Bi vi="Thêm tài liệu" en="Add document" layout="inline" />
            </span>
            <span className="sm:hidden">
              <Bi vi="Thêm" en="Add" layout="inline" />
            </span>
          </button>
        )}
        </div>
      </header>

      {missingOpen && (
        <p role="status" data-testid="admin-doc-open-missing" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Văn bản không còn hoặc bạn không có quyền xem.
        </p>
      )}

      {/* Thanh công cụ: tab loại (segmented) + tìm + sắp xếp cùng 1 hàng */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Lọc theo loại tài liệu" className="flex gap-1 overflow-x-auto sm:overflow-visible sm:flex-wrap w-full sm:w-auto -mx-1 px-1 sm:mx-0 sm:px-0">
          {(['all', ...CATS] as const).map((c) => {
            const active = cat === c;
            const n = c === 'all' ? docs?.length || 0 : counts[c];
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCat(c)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${focusRing} ${
                  active ? 'bg-[#8B1A4A] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {c !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : CAT_DOT[c]}`} aria-hidden="true" />}
                {c === 'all' ? (
                  <Bi vi="Tất cả" en="All" layout="inline" />
                ) : (
                  <Bi vi={ADMIN_DOC_CATEGORIES[c].vi} en={ADMIN_DOC_CATEGORIES[c].en} layout="inline" />
                )}
                <span className={`tabular-nums text-[11px] ${active ? 'text-white/80' : 'text-slate-400'}`}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <label className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên, số hiệu…"
              aria-label="Tìm tài liệu"
              type="search"
              className="w-full sm:w-52 h-9 pl-8 pr-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A4A]/40 focus:border-[#8B1A4A]"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as AdminDocSort)}
            aria-label="Sắp xếp"
            className="h-9 px-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="newest">Mới nhất</option>
            <option value="issued">Ngày ban hành</option>
            <option value="title">Tên A→Z</option>
          </select>
        </div>
      </div>

      {docs == null && (
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100" aria-busy="true" aria-label="Đang tải">
          {[0, 1, 2].map((i) => (
            <li key={i} className="p-4 space-y-2 animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-20" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </li>
          ))}
        </ul>
      )}
      {docs != null && shown.length === 0 && (
        <p className="text-sm text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
          {docs.length === 0
            ? canManage
              ? 'Chưa có tài liệu. Bấm "Thêm tài liệu" để tải tệp từ máy hoặc dán link Google Drive.'
              : 'Văn phòng chưa đăng tài liệu nào.'
            : 'Không có tài liệu khớp.'}
        </p>
      )}

      {/* Danh sách quét nhanh: mỗi tài liệu 1 dòng, mô tả cắt 2 dòng */}
      {shown.length > 0 && (
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100" data-testid="admin-doc-list">
          {shown.map((d) => (
            <DocRow
              key={d.id}
              d={d}
              canManage={canManage}
              downloadingId={downloadingId}
              onDownload={(a) => downloadFile(d.id, a)}
              onView={() => setViewing(d)}
              onEdit={() => edit(d)}
              onDelete={() => remove(d)}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <p className="text-[11px] text-slate-500">
          Mẹo: kéo thả tệp trực tiếp từ máy (≤ 5 MB/tệp) hoặc dán link Google Drive (Chia sẻ → "Bất kỳ ai có đường liên kết", quyền Người
          xem). Không bắt buộc đính kèm nếu chỉ đăng văn bản dạng chữ.
        </p>
      )}

      {viewing && (
        <DocDetail
          d={viewing}
          canManage={canManage}
          downloadingId={downloadingId}
          onDownload={(a) => downloadFile(viewing.id, a)}
          onClose={() => setViewing(null)} onEdit={() => edit(viewing)} onDelete={() => remove(viewing)} />
      )}

      {editing && profile && (
        <AdminDocForm
          initial={editing.input}
          docId={editing.id}
          profile={profile}
          onClose={() => setEditing(null)}
          onSaved={async (isUpdate, notice, saved) => {
            if (saved) {
              const prev = docs?.find((x) => x.id === saved.id);
              const full = buildSavedAdminDoc(
                saved.id,
                saved.input,
                prev ?? { authorId: profile.uid, authorName: profile.displayName || profile.username, createdAt: Date.now() }
              );
              upsertCachedAdminDoc(uid, full);
              setDocs((cur) => (cur ? [full, ...cur.filter((x) => x.id !== full.id)] : cur));
            }
            showToast(
              isUpdate
                ? 'Đã cập nhật.'
                : notice === 'sent'
                  ? 'Đã thêm tài liệu và gửi thông báo cho nhân sự.'
                  : notice === 'failed'
                    ? 'Đã thêm tài liệu, nhưng CHƯA gửi được thông báo — hãy gửi lại ở mục Thông báo.'
                    : 'Đã thêm tài liệu.',
              notice === 'failed' ? 'error' : 'success'
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

/** Nút mở link: icon theo loại link, viền mảnh (nhẹ hơn nút đậm cũ), có nhãn cho trình đọc màn hình. */
const OpenLink: React.FC<{ rawUrl: string; withLabel?: boolean }> = ({ rawUrl, withLabel }) => {
  // Link không bắt buộc (05/11): trống → không hiện nút; có nhưng sai → báo "Link không hợp lệ"
  if (!rawUrl || !rawUrl.trim()) return null;
  const url = safeDocUrl(rawUrl);
  if (!url) return <span className="text-[11px] text-rose-600 shrink-0">Link không hợp lệ</span>;
  const kind = linkKind(url);
  const Icon = LINK_ICON[kind];
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Mở trong ${LINK_KIND_LABEL[kind]}`}
      title={`Mở trong ${LINK_KIND_LABEL[kind]}`}
      className={`inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 rounded-lg border border-slate-200 text-slate-600 hover:border-[#8B1A4A] hover:text-[#8B1A4A] hover:bg-ums-50 shrink-0 ${focusRing} ${
        withLabel ? 'px-3 text-sm font-semibold' : 'w-10 sm:w-9'
      }`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {withLabel && <span>Mở {LINK_KIND_LABEL[kind]}</span>}
      {withLabel && <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />}
    </a>
  );
};

/** Menu "…" cho Sửa/Xóa — chỉ hiện với BGH/Văn phòng. Xóa vẫn hỏi xác nhận như cũ. */
const RowMenu: React.FC<{ title: string; onEdit: () => void; onDelete: () => void }> = ({ title, onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const item = 'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none';
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label={`Thao tác cho ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-lg text-slate-500 hover:bg-slate-100 ${focusRing}`}
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          <button
            type="button"
            role="menuitem"
            aria-label={`Sửa ${title}`}
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className={`${item} text-slate-700`}
          >
            <Pencil className="w-4 h-4" aria-hidden="true" /> Sửa
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label={`Xóa ${title}`}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className={`${item} text-rose-600`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" /> Xóa
          </button>
        </div>
      )}
    </div>
  );
};

type UploadedFile = NoticeAttachment & { fileId: string };

/** Nút tải tệp đã tải lên trực tiếp (chia khối trong Firestore) — số lượt đọc = số khối của tệp. */
const FileButtons: React.FC<{
  docId: string;
  files: UploadedFile[];
  downloadingId: string | null;
  onDownload: (a: UploadedFile) => void;
}> = ({ docId, files, downloadingId, onDownload }) =>
  files.length === 0 ? null : (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" data-testid={`admin-doc-files-${docId}`}>
      {files.map((a) => {
        const isBusy = downloadingId === `${docId}_${a.fileId}`;
        return (
          <li key={a.fileId} className="min-w-0">
            <button
              type="button"
              onClick={() => onDownload(a)}
              disabled={isBusy}
              aria-label={`Tải tệp ${a.name}`}
              className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 text-left ${focusRing}`}
            >
              <Download className="w-3.5 h-3.5 shrink-0 text-[#8B1A4A]" aria-hidden="true" />
              <span className="truncate">{a.name}</span>
              <span className="font-normal text-slate-500 shrink-0">({isBusy ? 'đang tải…' : formatBytes(a.size || 0)})</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

const CategoryChip: React.FC<{ c: AdminDocCategory }> = ({ c }) => {
  const meta = ADMIN_DOC_CATEGORIES[c] || ADMIN_DOC_CATEGORIES.van_ban;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
      <span className={`w-1.5 h-1.5 rounded-full ${CAT_DOT[c] || CAT_DOT.van_ban}`} aria-hidden="true" />
      <Bi vi={meta.vi} en={meta.en} layout="inline" />
    </span>
  );
};

const DocRow: React.FC<{
  d: AdminDoc;
  canManage: boolean;
  downloadingId: string | null;
  onDownload: (a: UploadedFile) => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ d, canManage, downloadingId, onDownload, onView, onEdit, onDelete }) => {
  const meta = adminDocMeta(d);
  const isNew = isRecentDoc(d.updatedAt);
  return (
    <li data-testid={`admin-doc-${d.id}`} className="group flex items-start gap-3 p-3 sm:px-4 sm:py-3.5 hover:bg-slate-50/70 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryChip c={d.category} />
          {d.pinned && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#8B1A4A]">
              <Pin className="w-3 h-3" aria-hidden="true" /> Ghim
            </span>
          )}
          {isNew && (
            <span className="px-1.5 py-px rounded bg-[#8B1A4A]/10 text-[#8B1A4A] text-[10px] font-bold uppercase tracking-wide">Mới</span>
          )}
        </div>
        <button type="button" onClick={onView} className={`mt-1 block w-full text-left rounded ${focusRing}`}>
          <span className="text-sm sm:text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2 break-words group-hover:text-[#8B1A4A]">
            {d.title}
          </span>
        </button>
        {d.description && (
          <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2 whitespace-pre-line break-words">{d.description}</p>
        )}
        <FileButtons docId={d.id} files={uploadedFiles(d.attachments)} downloadingId={downloadingId} onDownload={onDownload} />
        <div className="mt-1.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[11px] text-slate-400">
          {meta.map((m) => (
            <span key={m} className="text-slate-500">
              {m}
            </span>
          ))}
          {meta.length > 0 && <span aria-hidden="true">·</span>}
          <span>
            {d.authorName} · {new Date(d.updatedAt).toLocaleDateString('vi-VN')}
          </span>
          {isLongDescription(d.description) && (
            <button type="button" onClick={onView} aria-label={`Xem chi tiết ${d.title}`} className="ml-1 font-semibold text-[#8B1A4A] hover:underline">
              Xem chi tiết
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <OpenLink rawUrl={d.url} />
        {canManage && <RowMenu title={d.title} onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </li>
  );
};

/** Chi tiết tài liệu: toàn bộ mô tả, meta, nút mở rõ ràng; Sửa/Xóa cho người có quyền. */
const DocDetail: React.FC<{
  d: AdminDoc;
  canManage: boolean;
  downloadingId: string | null;
  onDownload: (a: UploadedFile) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ d, canManage, downloadingId, onDownload, onClose, onEdit, onDelete }) => {
  const meta = adminDocMeta(d);
  return (
    <Modal isOpen onClose={onClose} title="Chi tiết tài liệu" maxWidth="2xl">
      <div className="space-y-3" data-testid="admin-doc-detail">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryChip c={d.category} />
          {d.pinned && <span className="text-[11px] font-semibold text-[#8B1A4A]">Ghim</span>}
        </div>
        <h3 className="text-base font-bold text-slate-900 leading-snug break-words">{d.title}</h3>
        <p className="text-xs text-slate-500">
          {[...meta, `${d.authorName} · cập nhật ${new Date(d.updatedAt).toLocaleDateString('vi-VN')}`].join(' · ')}
        </p>
        {d.description && (
          <div className="max-h-[50vh] overflow-y-auto rounded-lg bg-slate-50 border border-slate-100 p-3">
            <p className="text-sm text-slate-700 whitespace-pre-line break-words leading-relaxed">{d.description}</p>
          </div>
        )}
        <FileButtons docId={d.id} files={uploadedFiles(d.attachments)} downloadingId={downloadingId} onDownload={onDownload} />
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <OpenLink rawUrl={d.url} withLabel />
          {canManage && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" /> Sửa
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-rose-200 text-sm text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" /> Xóa
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

const AdminDocForm: React.FC<{
  initial: AdminDocInput;
  docId: string | null;
  profile: UserProfile;
  onClose: () => void;
  onSaved: (isUpdate: boolean, notice?: 'sent' | 'failed', saved?: { id: string; input: AdminDocInput }) => Promise<void> | void;
}> = ({ initial, docId, profile, onClose, onSaved }) => {
  const isNew = docId == null;
  const [d, setD] = useState<AdminDocInput>({ ...initial, attachments: initial.attachments || [] });
  const [uploads, setUploads] = useState<File[]>([]);
  const [removedAttachments, setRemovedAttachments] = useState<NoticeAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [remindedNoAttachment, setRemindedNoAttachment] = useState(false);
  const [busy, setBusy] = useState(false);
  // Chuyển tiếp thành thông báo nhân sự (chỉ khi tạo mới). Danh bạ + nhóm chỉ tải khi tick (2 lượt đọc).
  const [forward, setForward] = useState(false);
  const [dir, setDir] = useState<DirectoryEntry[] | null>(null);
  const [groups, setGroups] = useState<NoticeGroup[]>([]);
  const [sel, setSel] = useState<StaffRecipientSelection>(EMPTY_SELECTION);
  useEffect(() => {
    if (!forward || dir != null) return;
    let alive = true;
    Promise.all([
      fetchStaffDirectoryPublic().catch(() => []),
      fetchNoticeGroups().catch(() => [] as NoticeGroup[]),
    ]).then(([d, g]) => {
      if (!alive) return;
      setDir(d as DirectoryEntry[]);
      setGroups(g);
    });
    return () => {
      alive = false;
    };
  }, [forward, dir]);
  const { recipients, groupNames } = useMemo(() => resolveSelection(sel, dir || [], groups), [sel, dir, groups]);
  const field = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm';
  const set = <K extends keyof AdminDocInput>(k: K, v: AdminDocInput[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    if (k === 'url' && typeof v === 'string' && v.trim()) {
      setRemindedNoAttachment(false);
    }
  };

  const existingFiles = uploadedFiles(d.attachments);

  const addUploads = (list: File[]) => {
    if (list.length === 0) return;
    const next = [...uploads, ...list.filter((f) => !uploads.some((u) => u.name === f.name && u.size === f.size))];
    const totalCount = existingFiles.length + next.length;
    if (totalCount > NOTICE_FILE_MAX_COUNT) {
      return setErr(`Tối đa ${NOTICE_FILE_MAX_COUNT} tệp tải lên mỗi tài liệu (tệp lớn hơn hãy dán link Google Drive).`);
    }
    const v = validateNoticeFiles(next);
    if (v) return setErr(v);
    setErr(null);
    setRemindedNoAttachment(false);
    setUploads(next);
  };

  const removeExistingAttachment = (fileId: string) => {
    const found = (d.attachments || []).find((a) => a.fileId === fileId);
    if (found) setRemovedAttachments((prev) => [...prev, found]);
    setD((x) => ({ ...x, attachments: (x.attachments || []).filter((a) => a.fileId !== fileId) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateAdminDoc(d);
    if (v) return setErr(v);
    if (existingFiles.length + uploads.length > NOTICE_FILE_MAX_COUNT) {
      return setErr(`Tối đa ${NOTICE_FILE_MAX_COUNT} tệp tải lên mỗi tài liệu (tệp lớn hơn hãy dán link Google Drive).`);
    }
    const fileErr = validateNoticeFiles(uploads);
    if (fileErr) return setErr(fileErr);
    const sendNotice = isNew && forward;
    if (sendNotice && dir == null) return setErr('Đang tải danh bạ nhân sự, thử lại sau giây lát.');
    if (sendNotice && recipients.length === 0) return setErr('Chuyển tiếp thành thông báo: chọn ít nhất một nhãn, nhóm hoặc người nhận.');

    // Chế độ nhắc nhở tránh quên: không bắt buộc có link hoặc tệp, chỉ hỏi xác nhận 1 lần nếu cả hai đều trống
    if (!hasAdminDocAttachment(d, uploads.length) && !remindedNoAttachment) {
      setErr(null);
      setRemindedNoAttachment(true);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const targetDocId = docId || newAdminDocId();
      const uploaded: NoticeAttachment[] = [];
      for (const [i, f] of uploads.entries()) {
        setProgress(`Đang tải tệp ${i + 1}/${uploads.length}: ${f.name}…`);
        uploaded.push(await uploadAdminDocFile(targetDocId, f, profile));
      }
      setProgress(null);
      const nextInput: AdminDocInput = {
        ...d,
        attachments: [...(d.attachments || []), ...uploaded],
      };
      if (docId) {
        await updateAdminDoc(docId, nextInput, removedAttachments);
        await onSaved(true, undefined, { id: docId, input: nextInput });
        return;
      }
      await createAdminDoc(nextInput, profile, targetDocId);
      if (!sendNotice) {
        await onSaved(false, undefined, { id: targetDocId, input: nextInput });
        return;
      }
      // Văn bản đã lưu; thông báo lỗi thì báo riêng (không mất văn bản)
      let notice: 'sent' | 'failed' = 'sent';
      try {
        setProgress('Đang gửi thông báo…');
        const fwd = buildForwardNotice(nextInput, targetDocId, nextInput.attachments);
        await createNotice(
          {
            title: fwd.title,
            body: fwd.body,
            tags: sel.tags,
            recipientUids: recipients,
            ...(groupNames.length ? { groupNames } : {}),
            ...(fwd.attachments.length ? { attachments: fwd.attachments } : {}),
            parentMessage: '',
            pinned: false,
            requiresDone: false,
            deadlineAt: null,
            remindBefore: [],
          },
          profile
        );
      } catch (e3) {
        console.error('[Hành chính] chuyển tiếp thông báo', e3);
        notice = 'failed';
      }
      await onSaved(false, notice, { id: targetDocId, input: nextInput });
    } catch (e2) {
      console.error('[Hành chính] lưu', e2);
      setProgress(null);
      setErr('Không lưu được (kiểm tra quyền hoặc kết nối).');
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Thêm tài liệu' : 'Sửa tài liệu'} maxWidth="2xl">
      <form
        onSubmit={submit}
        className="space-y-3 text-sm"
        data-testid="admin-doc-form"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2" role="alert">{err}</p>}
        {remindedNoAttachment && !err && (
          <div
            data-testid="admin-doc-no-file-reminder"
            role="status"
            className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg p-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Nhắc nhở: Bạn chưa đính kèm tệp hoặc dán link tài liệu.</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Không bắt buộc phải có tệp/link — nếu bạn chỉ đăng nội dung chữ, hãy bấm <b>«Vẫn lưu (không đính kèm)»</b> bên dưới để hoàn tất.
              </p>
            </div>
          </div>
        )}
        <label className="block text-xs font-semibold text-slate-700">
          Tên tài liệu
          <input value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={200} aria-label="Tên tài liệu" className={`${field} mt-1`} />
        </label>
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">Loại</p>
          <div className="flex flex-wrap gap-1.5">
            {CATS.map((c) => (
              <button key={c} type="button" onClick={() => set('category', c)} aria-pressed={d.category === c}
                className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${ADMIN_DOC_CATEGORIES[c].className} ${d.category === c ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-60'}`}>
                {ADMIN_DOC_CATEGORIES[c].vi}
              </button>
            ))}
          </div>
        </div>

        <div
          data-testid="admin-doc-file-drop"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addUploads(Array.from(e.dataTransfer.files));
          }}
          className={`rounded-xl border-2 border-dashed p-3 text-center text-xs transition-colors ${dragOver ? 'border-[#8B1A4A] bg-rose-50' : 'border-slate-300 bg-slate-50'}`}
        >
          <p className="text-slate-700">
            <b>Kéo thả tệp vào đây</b> hoặc{' '}
            <label className="text-[#8B1A4A] font-semibold underline cursor-pointer">
              chọn từ máy
              <input
                type="file"
                multiple
                className="sr-only"
                aria-label="Chọn tệp đính kèm"
                accept={NOTICE_FILE_EXTENSIONS.map((x) => `.${x}`).join(',')}
                onChange={(e) => {
                  addUploads(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
            </label>
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Tuỳ chọn · Tối đa {NOTICE_FILE_MAX_COUNT} tệp, mỗi tệp ≤ 5 MB (PDF, Word, Excel, PowerPoint, ảnh, zip). Tệp lớn hơn: dán link Drive bên dưới.
          </p>
          {(existingFiles.length > 0 || uploads.length > 0) && (
            <ul className="mt-2 space-y-1 text-left" data-testid="admin-doc-upload-list">
              {existingFiles.map((f) => (
                <li key={f.fileId} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1">
                  <span className="flex-1 min-w-0 truncate">📎 {f.name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(f.size || 0)}</span>
                  <button
                    type="button"
                    onClick={() => removeExistingAttachment(f.fileId)}
                    aria-label={`Bỏ tệp ${f.name}`}
                    className="px-1.5 text-slate-500"
                  >
                    ✕
                  </button>
                </li>
              ))}
              {uploads.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1">
                  <span className="flex-1 min-w-0 truncate">📄 {f.name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setUploads(uploads.filter((_, j) => j !== i))}
                    aria-label={`Bỏ tệp ${f.name}`}
                    className="px-1.5 text-slate-500"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Link (Google Drive / Docs / Sheets / Forms… — tuỳ chọn)
          <input value={d.url} onChange={(e) => set('url', e.target.value)} placeholder="https://drive.google.com/… (để trống nếu đã tải tệp hoặc chỉ đăng chữ)" aria-label="Link tài liệu" className={`${field} mt-1`} />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-slate-700">
            Số / ký hiệu (tuỳ chọn)
            <input value={d.docNumber} onChange={(e) => set('docNumber', e.target.value)} maxLength={60} placeholder="vd. 125/QĐ-THCSNN" aria-label="Số hiệu" className={`${field} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Ngày ban hành (tuỳ chọn)
            <input type="date" value={d.issuedDate} onChange={(e) => set('issuedDate', e.target.value)} aria-label="Ngày ban hành" className={`${field} mt-1`} />
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          Mô tả / hướng dẫn ngắn (tuỳ chọn)
          <textarea value={d.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={2000} aria-label="Mô tả" className={`${field} mt-1`} />
          {needsContentHint(d.description, !!d.url.trim() || existingFiles.length > 0 || uploads.length > 0) && (
            <span data-testid="assistant-content-hint" className="mt-1 block text-[11px] font-normal text-amber-700">{CONTENT_HINT_TEXT}</span>
          )}
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={d.pinned} onChange={(e) => set('pinned', e.target.checked)} /> Ghim lên đầu
        </label>
        {isNew && (
          <div className="rounded-xl border border-slate-200 p-3 space-y-3" data-testid="admin-doc-forward">
            <label className="flex items-start gap-2 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={forward}
                onChange={(e) => setForward(e.target.checked)}
                aria-label="Chuyển tiếp thành thông báo"
                data-testid="admin-doc-forward-toggle"
                className="mt-0.5"
              />
              <span>
                Chuyển tiếp thành thông báo
                <span className="block font-normal text-[11px] text-slate-500">
                  Gửi luôn 1 thông báo cho nhân sự được chọn (tiêu đề, tóm tắt, tệp/link của văn bản). Người nhận thấy ở mục Thông báo.
                </span>
              </span>
            </label>
            {forward &&
              (dir == null ? (
                <p className="text-[11px] text-slate-500">Đang tải danh bạ nhân sự…</p>
              ) : (
                <StaffRecipientPicker dir={dir} groups={groups} value={sel} onChange={setSel} recipientCount={recipients.length} />
              ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs rounded-lg border border-slate-200">Hủy</button>
          <button type="submit" disabled={busy} data-testid="admin-doc-save"
            className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold disabled:opacity-50">
            {busy ? progress || 'Đang lưu…' : remindedNoAttachment ? 'Vẫn lưu (không đính kèm)' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminDocsPage;
