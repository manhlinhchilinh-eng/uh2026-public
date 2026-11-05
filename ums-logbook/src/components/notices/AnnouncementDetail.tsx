/**
 * Chi tiết 1 thông báo trường (/announcements): nội dung, chuyển tiếp Zalo, người gửi/BGH theo dõi đã đọc.
 */

import React, { useEffect, useState } from 'react';
import { Copy, Eye, Trash2 } from 'lucide-react';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { ScheduleChangeGrid } from '../schedule/ScheduleChangeGrid';
import { CollapsibleNames } from './CollapsibleNames';
import type { Announcement, AnnouncementLevel, AnnouncementRead } from '../../types/announcement';
import { LEVEL_META, describeAudience, formatForZalo } from '../../utils/announcements';
import { deleteAnnouncement, fetchReaders, fetchStaffDirectory } from '../../services/announcementService';

export const LEVEL_STYLE: Record<AnnouncementLevel, string> = {
  urgent: 'bg-red-50 text-red-800 border-red-200',
  important: 'bg-amber-50 text-amber-800 border-amber-200',
  normal: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const AnnouncementDetail: React.FC<{
  announcement: Announcement;
  canManage: boolean;
  isAdmin: boolean;
  showForward: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}> = ({ announcement: a, canManage, isAdmin, showForward, onClose, onDeleted }) => {
  const { showToast } = useToast();
  const [readers, setReaders] = useState<AnnouncementRead[] | null>(null);
  const [notRead, setNotRead] = useState<string[] | null>(null);

  useEffect(() => {
    if (!canManage) return;
    (async () => {
      try {
        const r = await fetchReaders(a.id);
        setReaders(r);
        if (isAdmin && a.audience.toStaff) {
          const staff = await fetchStaffDirectory();
          const readSet = new Set(r.map((x) => x.uid));
          setNotRead(staff.filter((s) => !readSet.has(s.uid)).map((s) => s.displayName));
        }
      } catch (e) {
        console.error('[Announcement] readers', e);
      }
    })();
  }, [a.id, a.audience.toStaff, canManage, isAdmin]);

  const copyForZalo = async () => {
    try {
      await navigator.clipboard.writeText(formatForZalo(a));
      showToast('Đã sao chép — dán vào nhóm Zalo phụ huynh.', 'success');
    } catch {
      showToast('Không sao chép được, hãy chọn và sao chép thủ công.', 'error');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={a.title} maxWidth="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
          <span className={`px-2 py-0.5 font-bold rounded-full border ${LEVEL_STYLE[a.level]}`}>
            {LEVEL_META[a.level].emoji} {LEVEL_META[a.level].label}
          </span>
          <span>{a.authorName}</span>
          <span>• {fmtDateTime(a.createdAt)}</span>
          <span>• {describeAudience(a.audience)}</span>
        </div>
        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{a.body}</p>
        {a.scheduleChanges?.length ? <ScheduleChangeGrid changes={a.scheduleChanges} /> : null}

        {showForward && (
          <button
            type="button"
            onClick={copyForZalo}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700"
          >
            <Copy className="w-4 h-4" /> Chuyển tiếp cho phụ huynh (sao chép bản tin Zalo)
          </button>
        )}

        {canManage && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> Đã đọc: {readers ? readers.length : '…'}
              {notRead && <span className="text-slate-500 font-medium"> • GV chưa đọc: {notRead.length}</span>}
            </p>
            {notRead && <CollapsibleNames label="Chưa đọc" names={notRead} tone="warn" testId="not-read-list" />}
            {readers && <CollapsibleNames label="Đã đọc" names={readers.map((r) => r.displayName)} tone="ok" testId="read-list" />}
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Xóa thông báo này?')) return;
                await deleteAnnouncement(a.id);
                await onDeleted();
              }}
              className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa thông báo
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
