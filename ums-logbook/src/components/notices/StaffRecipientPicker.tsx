/**
 * Bộ chọn người nhận nhân sự (dùng chung: Soạn thông báo, Hành chính – Văn bản "Chuyển tiếp thành thông báo").
 * Nhãn vai trò, GVCN theo khối, nhóm lưu sẵn (directory/notice_groups), chọn từng người.
 * Thuần giao diện — danh bạ và nhóm do nơi gọi tải (không đọc Firestore ở đây).
 */

import React, { useState } from 'react';
import {
  HOMEROOM_GRADES,
  NOTICE_TAGS,
  gradeGroupName,
  groupMembers,
  resolveRecipients,
  type DirectoryEntry,
  type HomeroomGrade,
  type NoticeGroup,
  type NoticeTag,
} from '../../utils/officeNotices';

export interface StaffRecipientSelection {
  tags: NoticeTag[];
  grades: HomeroomGrade[];
  selGroups: string[];
  picked: string[];
}

export const EMPTY_SELECTION: StaffRecipientSelection = { tags: ['all'], grades: [], selGroups: [], picked: [] };

/** Danh sách uid người nhận + tên nhóm (để hiển thị trên tin) từ lựa chọn hiện tại. */
export function resolveSelection(sel: StaffRecipientSelection, dir: DirectoryEntry[], groups: NoticeGroup[]) {
  const recipients = resolveRecipients(dir, sel.tags, [...sel.picked, ...groupMembers(groups, sel.selGroups, dir)], sel.grades);
  const groupNames = [...sel.grades.map(gradeGroupName), ...groups.filter((g) => sel.selGroups.includes(g.id)).map((g) => g.name)];
  return { recipients, groupNames };
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const StaffRecipientPicker: React.FC<{
  dir: DirectoryEntry[];
  groups: NoticeGroup[];
  value: StaffRecipientSelection;
  onChange: (next: StaffRecipientSelection) => void;
  recipientCount: number;
  /** Có thì hiện nút "Quản lý nhóm…" */
  onManageGroups?: () => void;
}> = ({ dir, groups, value, onChange, recipientCount, onManageGroups }) => {
  const [pickQ, setPickQ] = useState('');
  const { tags, grades, selGroups, picked } = value;
  const set = (patch: Partial<StaffRecipientSelection>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(NOTICE_TAGS) as NoticeTag[]).map((t) => (
          <label key={t} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer ${NOTICE_TAGS[t].className} ${tags.includes(t) ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-70'}`}>
            <input type="checkbox" className="sr-only" checked={tags.includes(t)} onChange={() => set({ tags: toggle(tags, t) })} aria-label={`Nhãn ${NOTICE_TAGS[t].label}`} />
            {NOTICE_TAGS[t].label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" data-testid="grade-groups">
        <span className="text-[11px] font-semibold text-slate-600">GVCN theo khối:</span>
        {HOMEROOM_GRADES.map((g) => (
          <label key={g} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer bg-rose-50 text-rose-800 border-rose-200 ${grades.includes(g) ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-70'}`}>
            <input type="checkbox" className="sr-only" checked={grades.includes(g)} onChange={() => set({ grades: toggle(grades, g) })} aria-label={gradeGroupName(g)} />
            Khối {g}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" data-testid="saved-groups">
        <span className="text-[11px] font-semibold text-slate-600">Nhóm:</span>
        {groups.length === 0 && <span className="text-[11px] text-slate-400 italic">chưa có</span>}
        {groups.map((g) => (
          <label key={g.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer bg-indigo-50 text-indigo-800 border-indigo-200 ${selGroups.includes(g.id) ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-70'}`}>
            <input type="checkbox" className="sr-only" checked={selGroups.includes(g.id)} onChange={() => set({ selGroups: toggle(selGroups, g.id) })} aria-label={`Nhóm ${g.name}`} />
            {g.name} <span className="font-normal opacity-70">({g.uids.length})</span>
          </label>
        ))}
        {onManageGroups && (
          <button type="button" onClick={onManageGroups} data-testid="manage-groups"
            className="px-2 py-1 rounded-full border border-dashed border-slate-300 text-[11px] text-slate-600 hover:bg-slate-50">
            Quản lý nhóm…
          </button>
        )}
      </div>
      <details>
        <summary className="text-xs text-slate-600 cursor-pointer">Chọn thêm từng người ({picked.length})</summary>
        <input value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="Tìm tên…" aria-label="Tìm người nhận"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg mt-2 text-xs" />
        <div className="mt-1 max-h-40 overflow-y-auto grid sm:grid-cols-2 gap-1">
          {dir
            .filter((d) => !pickQ || d.displayName.toLowerCase().includes(pickQ.toLowerCase()))
            .map((d) => (
              <label key={d.uid} className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={picked.includes(d.uid)} onChange={() => set({ picked: toggle(picked, d.uid) })} />
                {d.displayName}
              </label>
            ))}
        </div>
      </details>
      <p className="text-[11px] text-slate-500" data-testid="recipient-count">
        Sẽ gửi tới <b>{recipientCount}</b> người.
      </p>
    </>
  );
};
