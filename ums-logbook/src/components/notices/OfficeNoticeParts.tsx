/**
 * Thành phần cho tin Văn phòng (/office_notices): nhãn đối tượng, trạng thái, danh sách đã gửi, chi tiết + theo dõi.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Download, Paperclip, Pin, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { CollapsibleNames } from './CollapsibleNames';
import { deleteNotice, downloadNoticeFile, fetchAcks, setNoticePinned } from '../../services/officeNoticeService';
import { downloadAdminDocFile } from '../../services/adminDocService';
import { formatBytes } from '../../utils/noticeFiles';
import {
  NOTICE_TAGS,
  knownTags,
  visibleAttachments,
  uploadedFiles,
  formatRemaining,
  noticeStatus,
  trackNotice,
  type DirectoryEntry,
  type NoticeAck,
  type NoticeStatus,
  type NoticeTag,
  type OfficeNotice,
} from '../../utils/officeNotices';

export const STATUS_META: Record<NoticeStatus, { label: string; className: string }> = {
  overdue: { label: 'Quá hạn', className: 'bg-rose-600 text-white' },
  due_soon: { label: 'Sắp hạn', className: 'bg-amber-500 text-white' },
  open: { label: 'Chưa xong', className: 'bg-slate-200 text-slate-700' },
  read: { label: 'Đã đọc', className: 'bg-emerald-100 text-emerald-800' },
  done: { label: 'Đã thực hiện', className: 'bg-emerald-600 text-white' },
};

export const fmt = (ms: number) => new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export const TagChips: React.FC<{ tags: NoticeTag[]; groupNames?: string[]; extraPeople?: boolean }> = ({ tags, groupNames, extraPeople }) => (
  <span className="inline-flex flex-wrap gap-1">
    {knownTags(tags).map((t) => (
      <span key={t} className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${NOTICE_TAGS[t].className}`}>
        {NOTICE_TAGS[t].label}
      </span>
    ))}
    {(groupNames || []).map((g) => (
      <span key={`g-${g}`} className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-indigo-50 text-indigo-800 border-indigo-200">
        {g}
      </span>
    ))}
    {extraPeople && <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-white text-slate-600 border-slate-300">Đích danh</span>}
  </span>
);

export const SentList: React.FC<{ notices: OfficeNotice[] | null; dir: DirectoryEntry[]; onOpen: (id: string) => void; onChanged: () => void }> = ({ notices, dir, onOpen, onChanged }) => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const [counts, setCounts] = useState<Record<string, ReturnType<typeof trackNotice>>>({});

  useEffect(() => {
    if (!notices) return;
    Promise.all(notices.map(async (n) => [n.id, trackNotice(n.recipientUids, await fetchAcks(n.id).catch(() => []), dir)] as const)).then((r) =>
      setCounts(Object.fromEntries(r))
    );
  }, [notices, dir]);

  if (!notices) return <p className="text-sm text-slate-500">Đang tải…</p>;
  if (notices.length === 0) return <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">Chưa gửi thông báo nào cho nhân sự.</p>;

  return (
    <ul className="space-y-2" data-testid="sent-list">
      {notices.map((n) => {
        const c = counts[n.id];
        const mine = n.authorId === profile?.uid || activeRole === 'admin';
        return (
          <li key={n.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => onOpen(n.id)} className="flex-1 min-w-[220px] text-left">
              <span className="flex flex-wrap items-center gap-2">
                {n.pinned && <Pin className="w-3.5 h-3.5 text-[#8B1A4A]" />}
                <TagChips tags={n.tags} groupNames={n.groupNames} />
                {n.deadlineAt && <span className="text-[11px] text-slate-600">Hạn {fmt(n.deadlineAt)}</span>}
              </span>
              <span className="block text-sm font-bold text-slate-900 mt-1">{n.title}</span>
              <span className="block text-[11px] text-slate-500">
                {n.authorName} · {fmt(n.createdAt)}
              </span>
            </button>
            {c && (
              <span className="text-xs text-slate-700" data-testid="sent-counts">
                <Users className="w-3.5 h-3.5 inline mr-1" />
                Đã đọc <b>{c.read}</b>/{c.total}
                {n.requiresDone && (
                  <>
                    {' '}
                    · Đã làm <b className="text-emerald-700">{c.done}</b>/{c.total}
                  </>
                )}
              </span>
            )}
            {mine && (
              <span className="flex gap-1">
                <button type="button" title={n.pinned ? 'Bỏ ghim' : 'Ghim'} onClick={() => setNoticePinned(n.id, !n.pinned).then(onChanged)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <Pin className={`w-4 h-4 ${n.pinned ? 'text-[#8B1A4A]' : 'text-slate-400'}`} />
                </button>
                <button
                  type="button"
                  title="Xóa"
                  onClick={() => {
                    if (window.confirm(`Xóa thông báo "${n.title}"?`)) deleteNotice(n.id, n.attachments).then(() => (showToast('Đã xóa.', 'success'), onChanged()));
                  }}
                  className="p-1.5 rounded-lg hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4 text-slate-400" />
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export const NoticeDetail: React.FC<{
  notice: OfficeNotice;
  myAck?: NoticeAck;
  isRecipient: boolean;
  canTrack: boolean;
  dir: DirectoryEntry[];
  now: number;
  onAck: (kind: 'read' | 'done' | 'undone') => void;
  onClose: () => void;
}> = ({ notice: n, myAck, isRecipient, canTrack, dir, now, onAck, onClose }) => {
  const { showToast } = useToast();
  const [track, setTrack] = useState<ReturnType<typeof trackNotice> | null>(null);
  useEffect(() => {
    if (canTrack) fetchAcks(n.id).then((a) => setTrack(trackNotice(n.recipientUids, a, dir))).catch(() => setTrack(null));
  }, [canTrack, n, dir]);
  const copy = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg, 'success');
    } catch {
      showToast('Không sao chép được, hãy chọn và sao chép thủ công.', 'error');
    }
  };
  const s = noticeStatus(n, myAck, now);

  return (
    <Modal isOpen onClose={onClose} title={n.title} maxWidth="lg">
      <div className="space-y-4" data-testid="notice-detail">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <TagChips tags={n.tags} groupNames={n.groupNames} />
          <span>
            {n.authorName} · {fmt(n.createdAt)}
          </span>
          {n.deadlineAt && (
            <span className={`font-semibold ${s === 'overdue' ? 'text-rose-700' : 'text-slate-700'}`}>
              Hạn {fmt(n.deadlineAt)} ({formatRemaining(n.deadlineAt - now)})
            </span>
          )}
        </div>
        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{n.body}</p>

        <UploadedFiles noticeId={n.id} attachments={n.attachments} />

        {visibleAttachments(n.attachments).length > 0 && (
          <ul className="space-y-1" data-testid="notice-attachments">
            {visibleAttachments(n.attachments).map((a, i) => (
              <li key={i}>
                <a href={a.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 break-all">
                  <Paperclip className="w-3.5 h-3.5 shrink-0" /> {a.name}
                </a>
              </li>
            ))}
          </ul>
        )}

        {n.parentMessage && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
            <p className="text-xs font-bold text-sky-900">Tin gợi ý gửi phụ huynh / học sinh</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.parentMessage}</p>
            <button type="button" onClick={() => copy(n.parentMessage!, 'Đã sao chép — dán vào nhóm Zalo lớp.')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700">
              <Copy className="w-3.5 h-3.5" /> Sao chép tin gửi PH/HS
            </button>
          </div>
        )}

        {isRecipient && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_META[s].className}`}>{STATUS_META[s].label}</span>
            {n.requiresDone &&
              (myAck?.doneAt ? (
                <button type="button" onClick={() => onAck('undone')} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 hover:bg-slate-50">
                  Bỏ xác nhận đã thực hiện
                </button>
              ) : (
                <button type="button" onClick={() => onAck('done')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700" data-testid="ack-done">
                  <CheckCircle2 className="w-4 h-4" /> Tôi đã thực hiện
                </button>
              ))}
          </div>
        )}

        {canTrack && track && (
          <div className="border-t border-slate-100 pt-3 space-y-2 text-xs" data-testid="notice-tracking">
            <p className="font-bold text-slate-800">
              Đã đọc {track.read}/{track.total}
              {n.requiresDone && ` · Đã thực hiện ${track.done}/${track.total}`}
            </p>
            <CollapsibleNames label="Chưa đọc" names={track.notRead} tone="warn" testId="office-not-read" />
            {n.requiresDone && (
              <>
                <CollapsibleNames label="Chưa thực hiện" names={track.notDone} tone="warn" testId="office-not-done" />
                {track.notDone.length > 0 && (
                  <button
                    type="button"
                    onClick={() => copy(`Nhắc việc: "${n.title}"${n.deadlineAt ? ` — hạn ${fmt(n.deadlineAt)}` : ''}.\nThầy cô chưa xác nhận: ${track.notDone.join(', ')}.\nXem chi tiết trên UMS+ → Thông báo.`, 'Đã sao chép tin nhắc.')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border border-slate-300 hover:bg-slate-50"
                  >
                    <Copy className="w-3.5 h-3.5" /> Sao chép tin nhắc người chưa làm
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

/** Tệp tải lên (lưu trong Firestore): bấm để tải về — chỉ người nhận/người gửi/BGH/Văn phòng (rules). */
const UploadedFiles: React.FC<{ noticeId: string; attachments?: OfficeNotice['attachments'] }> = ({ noticeId, attachments }) => {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const files = uploadedFiles(attachments);
  if (files.length === 0) return null;
  const download = async (a: (typeof files)[number]) => {
    setBusy(a.fileId);
    try {
      // Tệp chuyển tiếp từ Hành chính – Văn bản: tải từ văn bản gốc
      const blob = a.srcDocId ? await downloadAdminDocFile(a.srcDocId, a) : await downloadNoticeFile(noticeId, a);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      console.error('[Thông báo] tải tệp', e);
      showToast('Không tải được tệp (kiểm tra quyền hoặc kết nối).', 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <ul className="space-y-1" data-testid="notice-files">
      {files.map((a) => (
        <li key={a.fileId}>
          <button type="button" onClick={() => download(a)} disabled={busy === a.fileId}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 text-left break-all">
            <Download className="w-3.5 h-3.5 shrink-0" /> {a.name}
            <span className="font-normal text-slate-500 shrink-0">({busy === a.fileId ? 'đang tải…' : formatBytes(a.size || 0)})</span>
          </button>
        </li>
      ))}
    </ul>
  );
};
