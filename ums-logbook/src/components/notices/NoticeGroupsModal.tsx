/**
 * Quản lý nhóm người nhận lưu sẵn (tổ bộ môn, ban, danh sách GV cụ thể) — BGH / Văn phòng.
 * Lưu cả danh sách vào /directory/notice_groups (1 lần ghi).
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../common/Modal';
import { saveNoticeGroups } from '../../services/noticeGroupService';
import { upsertGroup, validateGroup, type DirectoryEntry, type NoticeGroup } from '../../utils/officeNotices';
import { foldText } from '../../utils/navGroups';

const newId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const NoticeGroupsModal: React.FC<{
  groups: NoticeGroup[];
  dir: DirectoryEntry[];
  onClose: () => void;
  onSaved: (groups: NoticeGroup[]) => void;
}> = ({ groups, dir, onClose, onSaved }) => {
  const { profile } = useAuth();
  const [editing, setEditing] = useState<{ id: string; name: string; uids: string[] } | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = (uid: string) => dir.find((d) => d.uid === uid)?.displayName || '(không còn trong danh bạ)';
  const field = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm';

  const persist = async (next: NoticeGroup[]) => {
    if (!profile) return;
    setBusy(true);
    setErr(null);
    try {
      await saveNoticeGroups(next, profile);
      onSaved(next);
      setEditing(null);
    } catch (e) {
      console.error('[Thông báo] lưu nhóm', e);
      setErr('Không lưu được nhóm (kiểm tra quyền hoặc kết nối).');
    } finally {
      setBusy(false);
    }
  };

  const saveEditing = () => {
    if (!editing || !profile) return;
    const v = validateGroup(editing, groups);
    if (v) return setErr(v);
    persist(upsertGroup(groups, { ...editing, updatedAt: Date.now(), updatedBy: profile.uid }));
  };

  const remove = (g: NoticeGroup) => {
    if (!window.confirm(`Xóa nhóm "${g.name}"? Thông báo đã gửi không bị ảnh hưởng.`)) return;
    persist(groups.filter((o) => o.id !== g.id));
  };

  const toggle = (uid: string) =>
    editing && setEditing({ ...editing, uids: editing.uids.includes(uid) ? editing.uids.filter((u) => u !== uid) : [...editing.uids, uid] });

  // Portal ra body: mở từ trong khung soạn (đang cuộn/transform) mà không bị cắt
  return createPortal(
    <Modal isOpen onClose={onClose} title="Nhóm người nhận" maxWidth="2xl">
      <div className="space-y-3 text-sm" data-testid="notice-groups">
        {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{err}</p>}
        {!editing && (
          <>
            <p className="text-xs text-slate-500">Tạo nhóm 1 lần (vd. Tổ Tiếng Anh, Tổ KHTN, Ban nề nếp), lần sau chỉ cần chọn nhóm khi soạn thông báo.</p>
            {groups.length === 0 && <p className="text-xs text-slate-500 italic">Chưa có nhóm nào.</p>}
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {groups.map((g) => (
                <li key={g.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{g.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{g.uids.length} người · {g.uids.slice(0, 4).map(name).join(', ')}{g.uids.length > 4 ? '…' : ''}</p>
                  </div>
                  <button type="button" aria-label={`Sửa nhóm ${g.name}`} onClick={() => { setErr(null); setEditing({ id: g.id, name: g.name, uids: g.uids }); }}
                    className="p-1.5 rounded border border-slate-200 text-slate-600"><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label={`Xóa nhóm ${g.name}`} disabled={busy} onClick={() => remove(g)}
                    className="p-1.5 rounded border border-rose-200 text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="flex justify-between gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setErr(null); setEditing({ id: newId(), name: '', uids: [] }); }} data-testid="group-new"
                className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold">+ Tạo nhóm</button>
              <button type="button" onClick={onClose} className="px-3 py-2 text-xs rounded-lg border border-slate-200">Đóng</button>
            </div>
          </>
        )}
        {editing && (
          <>
            <label className="block text-xs font-semibold text-slate-700">
              Tên nhóm
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={60}
                placeholder="vd. Tổ Tiếng Anh" aria-label="Tên nhóm" className={`${field} mt-1`} />
            </label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên…" aria-label="Tìm thành viên" className={`${field} text-xs`} />
            <div className="max-h-64 overflow-y-auto grid sm:grid-cols-2 gap-1 border border-slate-200 rounded-lg p-2">
              {dir
                .filter((d) => !q || foldText(d.displayName).includes(foldText(q)))
                .map((d) => (
                  <label key={d.uid} className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={editing.uids.includes(d.uid)} onChange={() => toggle(d.uid)} />
                    {d.displayName}
                  </label>
                ))}
            </div>
            <p className="text-[11px] text-slate-500">Đã chọn <b>{editing.uids.length}</b> người.</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-2 text-xs rounded-lg border border-slate-200">Quay lại</button>
              <button type="button" onClick={saveEditing} disabled={busy} data-testid="group-save"
                className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu nhóm'}</button>
            </div>
          </>
        )}
      </div>
    </Modal>,
    document.body
  );
};
