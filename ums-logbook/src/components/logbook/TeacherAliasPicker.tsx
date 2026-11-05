/**
 * Chọn "tên của tôi trên TKB" (có thể nhiều tên, vd. "Ms P.Anh" và "Ms P.Anh(Eng)").
 * Hiện số tiết, lớp, môn để GV nhận ra mình; cảnh báo nếu tên đã có người khác nhận.
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Search } from 'lucide-react';
import { normAlias, type AliasOwner, type TimetableAlias } from '../../utils/teacherAssignment';

export interface TeacherAliasPickerProps {
  allAliases: TimetableAlias[];
  selected: string[];
  /** Tên (chuẩn hóa) → người đã nhận */
  owners: Map<string, AliasOwner[]>;
  /** uid của GV đang được gắn tên (để không tự cảnh báo chính mình) */
  forUid: string;
  saving?: boolean;
  onSave: (aliases: string[]) => void;
  saveLabel?: string;
}

export const TeacherAliasPicker: React.FC<TeacherAliasPickerProps> = ({ allAliases, selected, owners, forUid, saving, onSave, saveLabel = 'Lưu tên của tôi' }) => {
  const [picked, setPicked] = useState<string[]>(selected);
  const [q, setQ] = useState('');
  const pickedSet = new Set(picked.map(normAlias));
  const shown = useMemo(() => {
    const k = normAlias(q);
    return allAliases.filter((a) => !k || normAlias(a.alias).includes(k) || a.subjects.some((s) => normAlias(s).includes(k)));
  }, [allAliases, q]);

  const toggle = (alias: string) =>
    setPicked((p) => (p.some((x) => normAlias(x) === normAlias(alias)) ? p.filter((x) => normAlias(x) !== normAlias(alias)) : [...p, alias]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên hoặc môn (vd. Linh, Maths)"
            aria-label="Tìm tên trên TKB"
            className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(picked)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[#8B1A4A] text-white hover:bg-[#6B1338] disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {saveLabel} {pickedSet.size > 0 && `(${pickedSet.size})`}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
        {shown.map((a) => {
          const on = pickedSet.has(normAlias(a.alias));
          const others = (owners.get(normAlias(a.alias)) || []).filter((o) => o.uid !== forUid);
          return (
            <button
              key={a.alias}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(a.alias)}
              className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${
                on ? 'border-[#8B1A4A] bg-pink-50 ring-1 ring-[#8B1A4A]' : 'border-slate-200 bg-white hover:border-[#8B1A4A]/50'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-sm">{a.alias}</span>
                {on && <Check className="w-4 h-4 text-[#8B1A4A]" />}
              </span>
              <span className="block text-slate-500 mt-0.5">
                {a.periods} tiết/tuần · {a.classes.length} lớp · {a.subjects.slice(0, 3).join(', ')}
              </span>
              {others.length > 0 && (
                <span className="mt-1 flex items-center gap-1 text-amber-700 font-semibold">
                  <AlertTriangle className="w-3 h-3" /> Đã có: {others.map((o) => o.displayName).join(', ')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
