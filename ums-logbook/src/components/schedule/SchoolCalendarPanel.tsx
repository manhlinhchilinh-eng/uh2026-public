/**
 * Ngày nghỉ của trường: Thứ Bảy, Chủ nhật tự nghỉ; BGH thêm/xóa ngày hoặc khoảng nghỉ (lễ, Tết…).
 * Ngày nghỉ → Sổ đầu bài báo "không có TKB" và không cho ghi sổ, tránh điền nhầm.
 */

import React, { useEffect, useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { fetchSchoolCalendar, saveSchoolCalendar } from '../../services/schoolCalendarService';
import {
  addOffPeriod,
  countSchoolDaysOff,
  formatOffPeriod,
  validateOffPeriod,
  type OffPeriod,
  type SchoolCalendar,
} from '../../utils/schoolCalendar';

export const SchoolCalendarPanel: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [cal, setCal] = useState<SchoolCalendar | null>(null);
  const [draft, setDraft] = useState<OffPeriod>({ from: '', to: '', reason: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSchoolCalendar(true).then(setCal);
  }, []);

  const persist = async (next: OffPeriod[], okMsg: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      await saveSchoolCalendar({ offPeriods: next }, profile.username);
      setCal({ offPeriods: next });
      showToast(okMsg, 'success');
      return true;
    } catch (e) {
      console.error('[Lịch nghỉ] lưu', e);
      showToast('Lưu ngày nghỉ thất bại.', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const err = validateOffPeriod(draft);
    if (err) return showToast(err, 'error');
    if (await persist(addOffPeriod(cal?.offPeriods || [], draft), `Đã thêm ngày nghỉ: ${draft.reason.trim()}.`)) {
      setDraft({ from: '', to: '', reason: '' });
    }
  };

  const remove = (p: OffPeriod) => {
    if (!window.confirm(`Xóa ngày nghỉ "${p.reason}" (${formatOffPeriod(p)})?`)) return;
    persist((cal?.offPeriods || []).filter((x) => !(x.from === p.from && x.to === p.to)), 'Đã xóa ngày nghỉ.');
  };

  const field = 'px-2 py-1.5 border border-slate-300 rounded-lg text-sm';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Thứ Bảy và Chủ nhật tự động là ngày nghỉ. Các ngày dưới đây cũng được coi là nghỉ: Sổ đầu bài sẽ báo “không có thời khóa biểu” và không cho ghi sổ.
      </p>

      {canEdit && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600 space-y-1">
            <span className="block font-semibold">Từ ngày</span>
            <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={field} aria-label="Nghỉ từ ngày" />
          </label>
          <label className="text-xs text-slate-600 space-y-1">
            <span className="block font-semibold">Đến ngày (bỏ trống nếu 1 ngày)</span>
            <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={field} aria-label="Nghỉ đến ngày" />
          </label>
          <label className="text-xs text-slate-600 space-y-1 flex-1 min-w-[200px]">
            <span className="block font-semibold">Lý do</span>
            <input
              value={draft.reason}
              maxLength={100}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              placeholder="vd. Nghỉ Tết Nguyên đán"
              className={`${field} w-full`}
              aria-label="Lý do nghỉ"
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[#8B1A4A] text-white hover:bg-[#6B1338] disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Thêm ngày nghỉ
          </button>
        </div>
      )}

      {!cal ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : cal.offPeriods.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">Chưa khai ngày nghỉ lễ nào (ngoài Thứ Bảy, Chủ nhật).</p>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {cal.offPeriods.map((p) => {
            const past = (p.to || p.from) < today;
            return (
              <li key={`${p.from}_${p.to}`} className={`flex items-center gap-3 p-3 text-sm ${past ? 'opacity-60' : ''}`} data-testid="off-period">
                <CalendarOff className="w-4 h-4 text-[#8B1A4A] shrink-0" />
                <span className="font-semibold text-slate-900 w-48 shrink-0">{formatOffPeriod(p)}</span>
                <span className="flex-1 text-slate-700">{p.reason}</span>
                <span className="text-xs text-slate-500">{countSchoolDaysOff(p)} ngày học</span>
                {canEdit && (
                  <button type="button" onClick={() => remove(p)} disabled={busy} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Xóa ngày nghỉ ${p.reason}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
