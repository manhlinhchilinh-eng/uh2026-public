/**
 * BGH cấu hình tiết lớp trộn theo môn × khối: Bình thường | Mặc định 10đ | Không chấm.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { fetchSchedulesStrict } from '../../services/scheduleService';
import { fetchMixedRules, saveMixedRules } from '../../services/mixedPeriodService';
import { ENG9_HUB_URL, findMixedRule, setMixedMode, type MixedMode, type MixedRule } from '../../utils/mixedPeriods';
import type { ClassSchedule } from '../../types/schedule';

const GRADES = [6, 7, 8, 9];

export const MixedPeriodsPanel: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [rules, setRules] = useState<MixedRule[] | null>(null);
  const [schedules, setSchedules] = useState<Record<string, ClassSchedule>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMixedRules(true).then(setRules);
    fetchSchedulesStrict().then(setSchedules).catch(() => setSchedules({}));
  }, []);

  /** Môn xuất hiện ở khối nào (để chỉ hiện ô có thật) */
  const subjects = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const [classId, s] of Object.entries(schedules)) {
      const g = Number(classId[0]);
      for (const slot of s.slots || []) if (slot.subject?.trim()) (m.get(slot.subject) ?? m.set(slot.subject, new Set()).get(slot.subject)!).add(g);
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [schedules]);

  const change = async (subject: string, grade: number, value: string) => {
    if (!rules || !profile) return;
    const mode = value === 'normal' ? null : (value as MixedMode);
    const next = setMixedMode(rules, subject, grade, mode, mode === 'auto10' && grade === 9 ? ENG9_HUB_URL : undefined);
    setBusy(true);
    try {
      await saveMixedRules(next, profile.username);
      setRules(next);
      showToast(`Đã lưu: ${subject} khối ${grade} — ${value === 'normal' ? 'học bình thường' : value === 'auto10' ? 'mặc định 10đ' : 'không chấm'}.`, 'success');
    } catch (e) {
      console.error('[Lớp trộn] lưu', e);
      showToast('Lưu thất bại.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!rules) return <p className="text-sm text-slate-500">Đang tải…</p>;
  const mixedRows = subjects.filter(([s, grades]) => [...grades].some((g) => findMixedRule(`${g}A1`, s, rules)));

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 flex items-start gap-1.5">
        <Shuffle className="w-4 h-4 text-[#8B1A4A] shrink-0" />
        <span>
        Tiết lớp trộn (HS nhiều lớp học chung) không đánh giá theo lớp được. <b>Mặc định 10đ</b>: tự tính 10 điểm nếu chưa ai ghi, GV vẫn ghi đè được (vd. Eng 1 khối 9 — ghi chú ở Eng9 Hub). <b>Không chấm</b>: không tính vào số tiết phải ký (vd. Ngoại ngữ 2).
        </span>
      </p>
      {!canEdit && (
        <ul className="text-sm text-slate-700 list-disc pl-5">
          {mixedRows.length === 0 && <li>Chưa có tiết lớp trộn.</li>}
          {mixedRows.map(([s, grades]) => (
            <li key={s}>
              {s}: {[...grades].sort().filter((g) => findMixedRule(`${g}A1`, s, rules)).map((g) => `khối ${g} (${findMixedRule(`${g}A1`, s, rules)!.mode === 'auto10' ? 'mặc định 10đ' : 'không chấm'})`).join(', ')}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left">Môn trên TKB</th>
                {GRADES.map((g) => (
                  <th key={g} className="p-2 text-center">
                    Khối {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map(([s, grades]) => (
                <tr key={s} data-testid="mixed-row">
                  <td className="p-2 font-semibold text-slate-900">{s}</td>
                  {GRADES.map((g) => {
                    if (!grades.has(g)) return <td key={g} className="p-2 text-center text-slate-300">—</td>;
                    const r = findMixedRule(`${g}A1`, s, rules);
                    return (
                      <td key={g} className="p-1.5 text-center">
                        <select
                          disabled={busy}
                          value={r?.mode ?? 'normal'}
                          onChange={(e) => change(s, g, e.target.value)}
                          aria-label={`${s} khối ${g}`}
                          className={`px-1.5 py-1 border rounded-md ${r ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                        >
                          <option value="normal">Bình thường</option>
                          <option value="auto10">Mặc định 10đ</option>
                          <option value="skip">Không chấm</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
