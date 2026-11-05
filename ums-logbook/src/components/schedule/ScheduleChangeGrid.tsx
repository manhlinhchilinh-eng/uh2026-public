/**
 * Lưới TKB 8 tiết × 5 ngày, tô vàng các tiết thay đổi (môn/GV cũ gạch ngang → mới).
 * Dùng cho trang Cập nhật TKB (có đủ TKB mới) và thông báo cho lớp (chỉ có các tiết đổi).
 */

import React from 'react';
import type { ScheduleSlot } from '../../types/schedule';
import type { ScheduleChange, SlotCell } from '../../utils/timetableGrid';

const DAYS = [2, 3, 4, 5, 6];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const Cell: React.FC<{ c: SlotCell | null; className?: string }> = ({ c, className = '' }) =>
  c ? (
    <span className={className}>
      <span className="font-semibold">{c.subject}</span>
      {c.teacherName && <span className="block opacity-75">{c.teacherName}</span>}
    </span>
  ) : (
    <span className={`italic opacity-60 ${className}`}>trống</span>
  );

export const ScheduleChangeGrid: React.FC<{ changes: ScheduleChange[]; slots?: ScheduleSlot[] }> = ({ changes, slots }) => {
  const changeAt = new Map(changes.map((c) => [`${c.dayOfWeek}_${c.periodIndex}`, c]));
  const slotAt = new Map((slots || []).map((s) => [`${s.dayOfWeek}_${s.periodIndex}`, s]));

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[560px] border-collapse text-[10.5px] leading-tight table-fixed">
        <thead>
          <tr>
            <th className="w-10 p-1 text-slate-500 font-semibold">Tiết</th>
            {DAYS.map((d) => (
              <th key={d} className="p-1 text-slate-600 font-semibold">Thứ {d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <tr key={p} className={p === 5 ? 'border-t-2 border-slate-300' : ''}>
              <td className="p-1 text-center text-slate-500 font-semibold">{p}</td>
              {DAYS.map((d) => {
                const ch = changeAt.get(`${d}_${p}`);
                const s = slotAt.get(`${d}_${p}`);
                if (ch) {
                  return (
                    <td key={d} className="p-1 align-top border border-amber-300 bg-amber-50" data-changed="1">
                      {ch.before && <Cell c={ch.before} className="block line-through text-slate-400 mb-0.5" />}
                      <Cell c={ch.after} className="block text-amber-900" />
                    </td>
                  );
                }
                return (
                  <td key={d} className="p-1 align-top border border-slate-100 text-slate-500">
                    {s ? <Cell c={s} /> : <span className="text-slate-300">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[10.5px] text-slate-500">
        <span className="inline-block w-3 h-3 align-middle mr-1 bg-amber-50 border border-amber-300" />
        Tiết thay đổi (dòng gạch ngang = TKB cũ). Đường kẻ đậm ngăn buổi sáng / chiều.
      </p>
    </div>
  );
};
