/**
 * Khung soạn Thông báo chung.
 * - Gửi nhân sự  → /office_notices (nhãn vai trò, GVCN theo khối, nhóm lưu sẵn, đích danh; tùy chọn "Cần thực hiện" + hạn chót + nhắc, ghim).
 * - Gửi PH / HS  → /announcements (toàn trường hoặc 1 lớp, mức khẩn, cho phép chuyển tiếp Zalo).
 * Chọn cả hai → tạo 2 bản ghi từ 1 lần soạn. Quyền theo composeTargets (khớp rules hiện có).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../common/Modal';
import { LEVEL_STYLE } from './AnnouncementDetail';
import type { AnnouncementLevel } from '../../types/announcement';
import { LEVEL_META, validateAnnouncement } from '../../utils/announcements';
import {
  NOTICE_ATTACHMENT_MAX,
  REMIND_OPTIONS,
  cleanAttachments,
  validateNotice,
  type DirectoryEntry,
  type NoticeGroup,
} from '../../utils/officeNotices';
import { EMPTY_SELECTION, StaffRecipientPicker, resolveSelection, type StaffRecipientSelection } from './StaffRecipientPicker';
import { fetchNoticeGroups } from '../../services/noticeGroupService';
import { NoticeGroupsModal } from './NoticeGroupsModal';
import type { composeTargets } from '../../utils/inbox';
import { createAnnouncement } from '../../services/announcementService';
import { createNotice, newNoticeId, uploadNoticeFile } from '../../services/officeNoticeService';
import { CONTENT_HINT_TEXT, needsContentHint } from '../../utils/assistant/contentHint';
import { NOTICE_FILE_EXTENSIONS, NOTICE_FILE_MAX_COUNT, formatBytes, validateNoticeFiles } from '../../utils/noticeFiles';

export const ComposeNoticeModal: React.FC<{
  targets: ReturnType<typeof composeTargets>;
  dir: DirectoryEntry[];
  onClose: () => void;
  onSent: (r: { announcementId?: string; officeId?: string }) => Promise<void> | void;
}> = ({ targets, dir, onClose, onSent }) => {
  const { profile, activeRole } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [level, setLevel] = useState<AnnouncementLevel>('normal');
  // Đối tượng
  const [toStaff, setToStaff] = useState(targets.staff);
  const [toParents, setToParents] = useState(!targets.staff && targets.families);
  const [toStudents, setToStudents] = useState(false);
  // Nhân sự
  const [sel, setSel] = useState<StaffRecipientSelection>(EMPTY_SELECTION);
  const tags = sel.tags;
  const [groups, setGroups] = useState<NoticeGroup[]>([]);
  const [managingGroups, setManagingGroups] = useState(false);
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);
  // Tệp kéo thả / chọn từ máy — tải lên Firestore (chia khối) trước khi tạo tin
  const [uploads, setUploads] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [requiresDone, setRequiresDone] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [remind, setRemind] = useState<number[]>([24 * 60]);
  const [pinned, setPinned] = useState(false);
  const [parentMessage, setParentMessage] = useState('');
  // PH / HS
  const [classId, setClassId] = useState(targets.fixedClassId || '');
  const [forwardable, setForwardable] = useState(true);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Nhóm lưu sẵn: 1 lượt đọc khi mở khung soạn cho nhân sự
  useEffect(() => {
    if (!targets.staff) return;
    fetchNoticeGroups().then(setGroups).catch((e) => console.warn('[Thông báo] nhóm', e));
  }, [targets.staff]);

  const { recipients, groupNames } = useMemo(() => resolveSelection(sel, dir, groups), [sel, dir, groups]);
  const toFamilies = toParents || toStudents;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const field = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm';

  /** Thêm tệp (kéo thả / chọn), báo lỗi ngay nếu sai loại, quá cỡ, quá số tệp. */
  const addUploads = (list: File[]) => {
    if (list.length === 0) return;
    const next = [...uploads, ...list.filter((f) => !uploads.some((u) => u.name === f.name && u.size === f.size))];
    const v = validateNoticeFiles(next);
    if (v) return setErr(v);
    setErr(null);
    setUploads(next);
  };

  const hasAnyAttachment = uploads.length > 0 || files.some((f) => f.url.trim().length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeRole) return;
    if (!toStaff && !toFamilies) return setErr('Chọn ít nhất một đối tượng nhận.');
    const audience = { toStaff: false, toParents, toStudents, classId: targets.fixedClassId || classId.trim().toUpperCase() || null };
    const deadlineAt = toStaff && requiresDone && deadline ? new Date(deadline).getTime() : null;
    const v =
      validateAnnouncement({ title, body, audience: toFamilies ? audience : { ...audience, toStaff: true } }) ||
      (toStaff ? validateNotice({ title, body, recipientUids: recipients, deadlineAt }, Date.now()) : null);
    if (v) return setErr(v);
    const att = cleanAttachments(toStaff ? files : []);
    if (att.error) return setErr(att.error);
    const fileErr = toStaff ? validateNoticeFiles(uploads) : null;
    if (fileErr) return setErr(fileErr);

    setBusy(true);
    setErr(null);
    const out: { announcementId?: string; officeId?: string } = {};
    try {
      if (toStaff) {
        // Tải tệp lên trước (dưới mã tin tạo sẵn), xong hết mới tạo tin → lỗi giữa chừng thì không có tin thiếu tệp
        const noticeId = newNoticeId();
        const uploaded = [];
        for (const [i, f] of uploads.entries()) {
          setProgress(`Đang tải tệp ${i + 1}/${uploads.length}: ${f.name}…`);
          uploaded.push(await uploadNoticeFile(noticeId, f, profile));
        }
        setProgress(null);
        const attachments = [...att.attachments, ...uploaded];
        out.officeId = await createNotice(
          {
            title,
            body,
            tags,
            recipientUids: recipients,
            ...(groupNames.length ? { groupNames } : {}),
            ...(attachments.length ? { attachments } : {}),
            parentMessage,
            pinned: pinned || level === 'urgent',
            requiresDone,
            deadlineAt,
            remindBefore: deadlineAt ? remind : [],
          },
          profile,
          noticeId
        );
      }
      if (toFamilies) {
        out.announcementId = await createAnnouncement({ title, body, level, audience, forwardableToParents: forwardable }, profile, activeRole);
      }
      await onSent(out);
    } catch (e2) {
      console.error('[Thông báo] gửi', e2);
      setProgress(null);
      setErr(out.officeId ? 'Đã gửi cho nhân sự, nhưng gửi PH/HS thất bại (kiểm tra quyền hoặc kết nối).' : 'Không gửi được thông báo (kiểm tra quyền hoặc kết nối). Chưa có tin nào được gửi.');
      setBusy(false);
    }
  };

  const check = (label: string, value: boolean, set: (v: boolean) => void, testId: string) => (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
      <input type="checkbox" aria-label={label} data-testid={testId} checked={value} onChange={(e) => set(e.target.checked)} /> {label}
    </label>
  );

  return (
    <Modal isOpen onClose={onClose} title="Soạn thông báo" maxWidth="2xl">
      <form onSubmit={submit} className="space-y-3 text-sm" data-testid="compose-notice"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ann-title">Tiêu đề</label>
          <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className={field} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ann-body">Nội dung</label>
          <textarea id="ann-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} className={field} />
          {needsContentHint(body, files.some((f) => f.url.trim() !== '') || uploads.length > 0) && (
            <p data-testid="assistant-content-hint" className="mt-1 text-[11px] text-amber-700">{CONTENT_HINT_TEXT}</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">Mức độ</p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(LEVEL_META) as AnnouncementLevel[]).map((l) => (
              <button key={l} type="button" onClick={() => setLevel(l)}
                className={`px-2.5 py-1 text-xs rounded-full border ${level === l ? LEVEL_STYLE[l] + ' font-bold' : 'border-slate-200 text-slate-500'}`}>
                {LEVEL_META[l].emoji} {LEVEL_META[l].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">Gửi tới</p>
          <div className="flex gap-4 flex-wrap">
            {targets.staff && check('Nhân sự trong trường', toStaff, setToStaff, 'aud-staff')}
            {targets.families && check('Phụ huynh', toParents, setToParents, 'aud-parents')}
            {targets.families && check('Học sinh', toStudents, setToStudents, 'aud-students')}
          </div>
        </div>

        {toStaff && (
          <fieldset className="rounded-xl border border-slate-200 p-3 space-y-3" data-testid="compose-staff">
            <legend className="px-1 text-xs font-bold text-slate-700">Nhân sự</legend>
            <StaffRecipientPicker
              dir={dir}
              groups={groups}
              value={sel}
              onChange={setSel}
              recipientCount={recipients.length}
              onManageGroups={() => setManagingGroups(true)}
            />

            <div
              data-testid="file-drop"
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
                  <input type="file" multiple className="sr-only" aria-label="Chọn tệp đính kèm"
                    accept={NOTICE_FILE_EXTENSIONS.map((x) => `.${x}`).join(',')}
                    onChange={(e) => {
                      addUploads(Array.from(e.target.files || []));
                      e.target.value = '';
                    }} />
                </label>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Tuỳ chọn · Tối đa {NOTICE_FILE_MAX_COUNT} tệp, mỗi tệp ≤ 5 MB (PDF, Word, Excel, PowerPoint, ảnh, zip). Chỉ người nhận tải được. Tệp lớn hơn: dán link Drive bên dưới.
              </p>
              {uploads.length > 0 && (
                <ul className="mt-2 space-y-1 text-left" data-testid="upload-list">
                  {uploads.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1">
                      <span className="flex-1 min-w-0 truncate">📄 {f.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(f.size)}</span>
                      <button type="button" onClick={() => setUploads(uploads.filter((_, j) => j !== i))} aria-label={`Bỏ tệp ${f.name}`}
                        className="px-1.5 text-slate-500">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5" data-testid="compose-attachments">
              <p className="text-[11px] font-semibold text-slate-600">
                Tệp đính kèm (link Google Drive / Docs, tối đa {NOTICE_ATTACHMENT_MAX} — tuỳ chọn) — chỉ người nhận thấy link
              </p>
              {files.map((f, i) => (
                <div key={i} className="flex gap-1.5">
                  <input value={f.name} onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    maxLength={120} placeholder="Tên tệp (tuỳ chọn)" aria-label={`Tên tệp ${i + 1}`} className={`${field} text-xs sm:w-1/3`} />
                  <input value={f.url} onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                    placeholder="https://drive.google.com/…" aria-label={`Link tệp ${i + 1}`} className={`${field} text-xs flex-1`} />
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Bỏ tệp ${i + 1}`}
                    className="px-2 rounded-lg border border-slate-200 text-slate-500 text-xs">✕</button>
                </div>
              ))}
              {files.length < NOTICE_ATTACHMENT_MAX && (
                <button type="button" onClick={() => setFiles([...files, { name: '', url: '' }])} data-testid="add-attachment"
                  className="px-2 py-1 rounded-full border border-dashed border-slate-300 text-[11px] text-slate-600 hover:bg-slate-50">
                  + Đính kèm link tệp
                </button>
              )}
              {files.length > 0 && (
                <p className="text-[10px] text-slate-500">
                  Trên Drive nên chia sẻ "Người xem" cho đúng người/nhóm nhận; nếu để "Bất kỳ ai có đường liên kết" thì ai được chuyển link cũng mở được.
                </p>
              )}
              {!hasAnyAttachment && (
                <p className="text-[10px] text-amber-700 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2 py-1" data-testid="notice-attachment-reminder">
                  Nhắc nhở: Chưa có tệp hoặc link đính kèm (không bắt buộc — có thể gửi ngay nếu chỉ thông báo bằng chữ).
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={requiresDone} onChange={(e) => setRequiresDone(e.target.checked)} aria-label="Cần thực hiện" data-testid="requires-done" />
                Cần thực hiện (người nhận bấm "Đã thực hiện")
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={pinned || level === 'urgent'} disabled={level === 'urgent'} onChange={(e) => setPinned(e.target.checked)} />
                Ghim lên đầu{level === 'urgent' ? ' (tự ghim khi khẩn)' : ''}
              </label>
            </div>

            {requiresDone && (
              <div className="grid sm:grid-cols-2 gap-3 items-start">
                <label className="text-xs space-y-1">
                  <span className="block font-bold text-slate-700">Hạn chót (tuỳ chọn)</span>
                  <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Hạn chót" className={field} />
                </label>
                {deadline && (
                  <div className="text-xs space-y-1">
                    <span className="block font-bold text-slate-700">Nhắc trước hạn</span>
                    <div className="flex flex-wrap gap-2">
                      {REMIND_OPTIONS.map((o) => (
                        <label key={o.minutes} className="inline-flex items-center gap-1">
                          <input type="checkbox" checked={remind.includes(o.minutes)} onChange={() => setRemind(toggle(remind, o.minutes))} />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!toFamilies && (
              <details>
                <summary className="text-xs text-slate-600 cursor-pointer">Tin gợi ý để GV chuyển phụ huynh / học sinh (tuỳ chọn)</summary>
                <textarea value={parentMessage} onChange={(e) => setParentMessage(e.target.value)} rows={3}
                  aria-label="Tin gợi ý gửi phụ huynh học sinh" className={`${field} mt-2`} />
              </details>
            )}
          </fieldset>
        )}

        {toFamilies && (
          <fieldset className="rounded-xl border border-slate-200 p-3 space-y-2" data-testid="compose-families">
            <legend className="px-1 text-xs font-bold text-slate-700">Phụ huynh / học sinh</legend>
            {targets.fixedClassId ? (
              <p className="text-[11px] text-slate-500">Phạm vi: lớp chủ nhiệm {targets.fixedClassId}</p>
            ) : (
              <input value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Để trống = toàn trường, hoặc nhập lớp (vd. 6A1)"
                aria-label="Lớp nhận" className={`${field} text-xs`} />
            )}
            {check('Cho phép GV chuyển tiếp nguyên văn vào nhóm Zalo phụ huynh', forwardable, setForwardable, 'aud-forward')}
          </fieldset>
        )}

        {managingGroups && (
          <NoticeGroupsModal
            groups={groups}
            dir={dir}
            onClose={() => setManagingGroups(false)}
            onSaved={(next) => {
              setGroups(next);
              setSel((cur) => ({ ...cur, selGroups: cur.selGroups.filter((id) => next.some((g) => g.id === id)) }));
            }}
          />
        )}

        {/* Lỗi đặt cạnh nút Gửi: khung soạn dài, cuộn xuống vẫn thấy */}
        {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2" role="alert">{err}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs rounded-lg border border-slate-200">Hủy</button>
          <button type="submit" disabled={busy} data-testid="send-notice"
            className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold disabled:opacity-50">
            {busy ? progress || 'Đang gửi…' : 'Gửi thông báo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
