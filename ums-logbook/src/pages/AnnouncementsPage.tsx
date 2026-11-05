/**
 * UMS SmartConnect - Thông báo (gộp Thông báo trường + Thông báo Văn phòng)
 * 1 hộp thư cho mọi tin gửi tới tôi • 1 khung soạn (nhân sự và/hoặc PH-HS) • theo dõi đã đọc / đã thực hiện.
 * Dữ liệu giữ ở 2 collection cũ: /announcements và /office_notices.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlarmClock, Megaphone, Pin, Plus, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';
import { Bi } from '../components/common/Bi';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { useOfficeNotices } from '../context/OfficeNoticesContext';
import { FAMILY_ROLES } from '../types/auth';
import { LEVEL_META, describeAudience } from '../utils/announcements';
import { formatRemaining, type DirectoryEntry, type OfficeNotice } from '../utils/officeNotices';
import { buildInbox, composeTargets, filterInbox, type InboxFilter, type InboxItem } from '../utils/inbox';
import { fetchStaffDirectory } from '../services/announcementService';
import { fetchStaffDirectoryPublic, syncStaffDirectory } from '../services/substitutionService';
import { fetchAllNotices } from '../services/officeNoticeService';
import { AnnouncementDetail, LEVEL_STYLE, fmtDateTime } from '../components/notices/AnnouncementDetail';
import { NoticeDetail, SentList, STATUS_META, TagChips, fmt } from '../components/notices/OfficeNoticeParts';
import { DesktopNotifyToggle } from '../components/notices/DesktopNotify';
import { ComposeNoticeModal } from '../components/notices/ComposeNoticeModal';

const FILTERS: Array<{ id: InboxFilter; vi: string; en: string }> = [
  { id: 'all', vi: 'Tất cả', en: 'All' },
  { id: 'unread', vi: 'Chưa đọc', en: 'Unread' },
  { id: 'action', vi: 'Cần thực hiện', en: 'To do' },
  { id: 'urgent', vi: 'Khẩn / quá hạn', en: 'Urgent' },
];

export const AnnouncementsPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const { items, readIds, loading, error, refresh, markRead } = useAnnouncements();
  const office = useOfficeNotices();
  const [params, setParams] = useSearchParams();
  const targets = composeTargets(activeRole, profile?.assignedClassId);
  const canCompose = targets.staff || targets.families;
  const isFamily = activeRole != null && FAMILY_ROLES.includes(activeRole);
  const tab = targets.staff && (params.get('tab') === 'sent' || activeRole === 'vanphong') ? 'sent' : 'inbox';

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(params.get('open'));
  const [composing, setComposing] = useState(false);
  const [dir, setDir] = useState<DirectoryEntry[]>([]);
  const [sent, setSent] = useState<OfficeNotice[] | null>(null);

  // Danh bạ nhân sự (chọn người nhận / biết ai chưa đọc) — chỉ khi được gửi cho nhân sự. BGH làm mới danh bạ.
  useEffect(() => {
    if (!targets.staff) return;
    (activeRole === 'admin'
      ? fetchStaffDirectory().then(async (d) => {
          await syncStaffDirectory(d).catch(() => {});
          return d;
        })
      : fetchStaffDirectoryPublic()
    )
      .then((d) => setDir(d as DirectoryEntry[]))
      .catch((e) => console.warn('[Thông báo] danh bạ', e));
  }, [targets.staff, activeRole]);

  const loadSent = () => fetchAllNotices().then(setSent).catch(() => setSent([]));
  useEffect(() => {
    if (tab === 'sent') loadSent();
  }, [tab]);

  const inbox = useMemo(
    () => buildInbox(items, readIds, office.notices, office.acks, office.now),
    [items, readIds, office.notices, office.acks, office.now]
  );
  const shown = useMemo(() => filterInbox(inbox, filter, q), [inbox, filter, q]);
  const counts = useMemo(
    () => ({ unread: filterInbox(inbox, 'unread', '').length, action: filterInbox(inbox, 'action', '').length, urgent: filterInbox(inbox, 'urgent', '').length }),
    [inbox]
  );

  const openAnn = items.find((a) => a.id === openId) || null;
  const openOffice = openAnn ? null : office.notices.find((n) => n.id === openId) || sent?.find((n) => n.id === openId) || null;

  // Mở tin = tự đánh dấu "đã đọc"
  useEffect(() => {
    if (openAnn && !readIds.has(openAnn.id)) markRead(openAnn.id).catch((e) => console.error(e));
  }, [openAnn, readIds, markRead]);
  useEffect(() => {
    if (openOffice && profile && openOffice.recipientUids.includes(profile.uid) && !office.acks.get(openOffice.id)?.readAt) {
      office.ack(openOffice, 'read').catch(() => {});
    }
  }, [openOffice, profile, office]);

  const closeDetail = () => {
    setOpenId(null);
    if (params.get('open')) {
      const next = new URLSearchParams(params);
      next.delete('open');
      setParams(next, { replace: true });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-ums-50 text-[#8B1A4A]">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi="Thông báo" en="Notices" />
            </h2>
            <p className="text-xs text-slate-500">
              <Bi
                vi="Một hộp thư cho mọi tin của nhà trường — mức khẩn, hạn chót, xác nhận đã đọc / đã thực hiện"
                en="One inbox for every school notice — urgency, deadlines, read & done receipts"
              />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {activeRole !== 'vanphong' && <DesktopNotifyToggle />}
        {canCompose && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#8B1A4A] text-white hover:bg-[#6B1338]"
          >
            <Plus className="w-4 h-4" /> <Bi vi="Soạn thông báo" en="Compose Notice" />
          </button>
        )}
        </div>
      </div>

      {targets.staff && activeRole !== 'vanphong' && (
        <div className="flex gap-1.5" role="tablist" aria-label="Thông báo">
          {[
            { id: 'inbox', label: 'Hộp thư', en: 'Inbox' },
            { id: 'sent', label: 'Đã gửi nhân sự – theo dõi', en: 'Sent to staff' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setParams(t.id === 'inbox' ? {} : { tab: t.id }, { replace: true })}
              className={`px-3 py-2 rounded-lg text-xs font-bold border ${tab === t.id ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              <Bi vi={t.label} en={t.en} />
            </button>
          ))}
        </div>
      )}

      {tab === 'inbox' && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {FILTERS.filter((f) => !isFamily || f.id !== 'action').map((f) => {
              const n = f.id === 'all' ? 0 : counts[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-full border font-semibold ${filter === f.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-300 text-slate-700'}`}
                >
                  <Bi vi={f.vi} en={f.en} />
                  {n > 0 && <span className="ml-1 opacity-80">({n})</span>}
                </button>
              );
            })}
            <label className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm…" aria-label="Tìm thông báo" className="pl-7 pr-2 py-1 border border-slate-300 rounded-lg w-40" />
            </label>
          </div>

          {loading && <p className="text-sm text-slate-500">Đang tải…</p>}
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
          {!loading && !error && shown.length === 0 && (
            <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">
              {inbox.length === 0 ? 'Chưa có thông báo nào.' : 'Không có thông báo nào khớp bộ lọc.'}
            </p>
          )}

          <ul className="space-y-2" data-testid="notice-list">
            {shown.map((x) => (
              <li key={`${x.kind}-${x.id}`}>
                <InboxRow item={x} now={office.now} onOpen={() => setOpenId(x.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'sent' && (
        <SentList
          notices={sent}
          dir={dir}
          onOpen={setOpenId}
          onChanged={() => {
            loadSent();
            office.refresh();
          }}
        />
      )}

      {openAnn && (
        <AnnouncementDetail
          announcement={openAnn}
          canManage={activeRole === 'admin' || openAnn.authorId === profile?.uid}
          isAdmin={activeRole === 'admin'}
          showForward={!isFamily && openAnn.forwardableToParents}
          onClose={closeDetail}
          onDeleted={async () => {
            closeDetail();
            await refresh();
            showToast('Đã xóa thông báo.', 'success');
          }}
        />
      )}

      {openOffice && profile && (
        <NoticeDetail
          notice={openOffice}
          myAck={office.acks.get(openOffice.id)}
          isRecipient={openOffice.recipientUids.includes(profile.uid)}
          canTrack={targets.staff || openOffice.authorId === profile.uid}
          dir={dir}
          now={office.now}
          onAck={(kind) => office.ack(openOffice, kind).then(() => showToast(kind === 'done' ? 'Đã xác nhận thực hiện.' : 'Đã cập nhật.', 'success'))}
          onClose={closeDetail}
        />
      )}

      {composing && profile && (
        <ComposeNoticeModal
          targets={targets}
          dir={dir}
          onClose={() => setComposing(false)}
          onSent={async ({ announcementId, officeId }) => {
            // Người gửi không cần tự nhận banner/badge cho thông báo của mình
            if (announcementId) await markRead(announcementId).catch((e) => console.error(e));
            setComposing(false);
            await Promise.all([refresh(), office.refresh(), officeId && tab === 'sent' ? loadSent() : null]);
            showToast('Đã gửi thông báo.', 'success');
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const InboxRow: React.FC<{ item: InboxItem; now: number; onOpen: () => void }> = ({ item: x, now, onOpen }) => {
  const border =
    x.kind === 'office' && x.status === 'overdue' ? 'border-rose-300' : x.kind === 'office' && x.status === 'due_soon' ? 'border-amber-300' : x.unread ? 'border-slate-300 shadow-xs' : 'border-slate-100 opacity-80';
  return (
    <button
      type="button"
      data-testid={x.kind === 'announcement' ? `ann-${x.id}` : 'notice-item'}
      onClick={onOpen}
      className={`w-full text-left bg-white border rounded-xl p-3.5 hover:border-[#8B1A4A]/40 transition-colors ${border}`}
    >
      <span className="flex items-center gap-2 flex-wrap">
        {x.kind === 'announcement' ? (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${LEVEL_STYLE[x.announcement.level]}`}>
            {LEVEL_META[x.announcement.level].emoji} {LEVEL_META[x.announcement.level].label}
          </span>
        ) : (
          <>
            {x.notice.pinned && <Pin className="w-3.5 h-3.5 text-[#8B1A4A]" aria-label="Đã ghim" />}
            <TagChips tags={x.notice.tags} groupNames={x.notice.groupNames} />
            {(x.notice.attachments?.length || 0) > 0 && (
              <span className="text-[10px] font-bold text-slate-600" title="Có tệp đính kèm">📎 {x.notice.attachments!.length}</span>
            )}
            {(x.notice.requiresDone || x.status === 'overdue' || x.status === 'due_soon') && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_META[x.status].className}`}>{STATUS_META[x.status].label}</span>
            )}
            {x.notice.deadlineAt && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${x.status === 'overdue' ? 'text-rose-700' : 'text-slate-600'}`}>
                <AlarmClock className="w-3.5 h-3.5" /> Hạn {fmt(x.notice.deadlineAt)} · {formatRemaining(x.notice.deadlineAt - now)}
              </span>
            )}
          </>
        )}
        {x.unread && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#8B1A4A] text-white">MỚI</span>}
        <span className="text-[11px] text-slate-400 ml-auto">{fmtDateTime(x.createdAt)}</span>
      </span>
      <span className={`block text-sm mt-1.5 ${x.unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{x.title}</span>
      <span className="block text-[11px] text-slate-500 mt-0.5">
        {x.kind === 'announcement' ? `${x.announcement.authorName} • ${describeAudience(x.announcement.audience)}` : `${x.notice.authorName} • Văn phòng / nhân sự`}
      </span>
    </button>
  );
};
