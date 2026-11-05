import React from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import type { ScheduleSlot } from '../../types/schedule';
import type { SubstitutionPlan } from '../../types/substitution';
import { suggestPeriods, substitutionKey } from '../../utils/substitution';

export interface PlannerData {
  schedules: Array<{ classId: string; slots: ScheduleSlot[] }>;
  staff: Array<{ uid: string; displayName: string }>;
  timetableName?: string;
  holidays: string[];
}

interface Props {
  data: PlannerData;
  selfUid: string;
  startDate: string;
  endDate: string;
  plans: SubstitutionPlan[];
  onChange: (plans: SubstitutionPlan[]) => void;
}

/** GV xin nghỉ tự sắp xếp người dạy thay cho từng tiết. */
export const SubstitutionPlanner: React.FC<Props> = ({ data, selfUid, startDate, endDate, plans, onChange }) => {
  const others = data.staff.filter((s) => s.uid !== selfUid);
  const classIds = Array.from(new Set(data.schedules.map((s) => s.classId))).sort();

  const update = (i: number, patch: Partial<SubstitutionPlan>) => onChange(plans.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const suggest = () => {
    const existing = new Set(plans.map(substitutionKey));
    const add = suggestPeriods(data.schedules, data.timetableName, startDate, endDate, data.holidays)
      .filter((s) => !existing.has(substitutionKey(s)))
      .map((s) => ({ ...s, substituteUid: '', substituteName: '' }));
    onChange([...plans, ...add]);
  };

  const cell = 'text-[11px] border border-slate-300 rounded p-1';
  return (
    <div data-testid="sub-planner" className="border border-slate-200 rounded-lg p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-slate-700">Sắp xếp dạy thay (GV xin nghỉ tự liên hệ người dạy thay)</p>
        <div className="flex gap-1.5">
          {data.timetableName ? (
            <button type="button" onClick={suggest} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-sky-300 text-sky-800">
              <Wand2 className="w-3.5 h-3.5" /> Lấy tiết từ TKB
            </button>
          ) : (
            <span className="text-[10px] text-slate-400">Chưa khai "tên trên TKB" — nhập tay</span>
          )}
          <button type="button" onClick={() => onChange([...plans, { date: startDate, classId: '', periodIndex: 1, subject: '', substituteUid: '', substituteName: '' }])}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-slate-300">
            <Plus className="w-3.5 h-3.5" /> Thêm tiết
          </button>
        </div>
      </div>
      {plans.length === 0 && <p className="text-[11px] text-slate-500">Không có tiết nào cần dạy thay.</p>}
      {plans.map((p, i) => (
        <div key={i} data-testid={`sub-row-${i}`} className="flex items-center gap-1.5 flex-wrap">
          <input type="date" aria-label={`Ngày dạy thay ${i + 1}`} value={p.date} min={startDate} max={endDate} onChange={(e) => update(i, { date: e.target.value })} className={cell} />
          <select aria-label={`Lớp ${i + 1}`} value={p.classId} onChange={(e) => update(i, { classId: e.target.value })} className={cell}>
            <option value="">Lớp</option>
            {classIds.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label={`Tiết ${i + 1}`} value={p.periodIndex} onChange={(e) => update(i, { periodIndex: Number(e.target.value) })} className={cell}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Tiết {n}</option>)}
          </select>
          <input aria-label={`Môn ${i + 1}`} placeholder="Môn" value={p.subject} onChange={(e) => update(i, { subject: e.target.value })} className={`${cell} w-24`} />
          <select aria-label={`GV dạy thay ${i + 1}`} value={p.substituteUid} onChange={(e) => {
            const s = others.find((o) => o.uid === e.target.value);
            update(i, { substituteUid: e.target.value, substituteName: s?.displayName || '' });
          }} className={`${cell} min-w-36`}>
            <option value="">-- GV dạy thay --</option>
            {others.map((s) => <option key={s.uid} value={s.uid}>{s.displayName}</option>)}
          </select>
          <button type="button" aria-label={`Xóa dòng ${i + 1}`} onClick={() => onChange(plans.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
