/**
 * Chế độ "Tiết dạy của tôi": các tiết tôi phải ghi/chấm trong ngày (theo TKB + dạy thay), ở mọi lớp.
 * Bấm 1 tiết → mở sổ đầu bài lớp đó, đúng tiết đó.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Repeat } from 'lucide-react';
import { getPeriodEntries, generateDailyId } from '../../services/logbookService';
import { UMS_BELL_SCHEDULE } from '../../utils/schedule';
import type { TeachingSlot } from '../../utils/teacherAssignment';
import { getSubjectColor } from '../schedule/TimetableGrid';
import { MIXED_MODE_TEXT, type MixedRule } from '../../utils/mixedPeriods';

export const MyTeachingDay: React.FC<{
  date: string;
  slots: TeachingSlot[];
  activeKey?: string | null;
  refreshKey?: number;
  onOpen: (slot: TeachingSlot) => void;
  mixedOf?: (slot: TeachingSlot) => MixedRule | null;
}> = ({ date, slots, activeKey, refreshKey = 0, onOpen, mixedOf = () => null }) => {
  // key → trạng thái bản ghi thật của tiết: đã ký / nháp (đã lưu chưa ký), kèm tổng điểm
  const [status, setStatus] = useState<Map<string, { signed: boolean; total: number }>>(new Map());

  useEffect(() => {
    let alive = true;
    const classes = [...new Set(slots.map((s) => s.classId))];
    Promise.all(
      classes.map(async (c) => {
        const ps = await getPeriodEntries(generateDailyId(c, date)).catch(() => []);
        return ps
          .filter((p) => p.isSigned || !!p.lessonTopic?.trim()) // đã lưu = có tên bài (bắt buộc khi lưu)
          .map((p) => [`${c}_${p.periodIndex}`, { signed: !!p.isSigned, total: p.scores?.total ?? 0 }] as const);
      })
    ).then((r) => alive && setStatus(new Map(r.flat())));
    return () => {
      alive = false;
    };
  }, [slots, date, refreshKey]);

  if (slots.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">
        Ngày này bạn không có tiết nào theo TKB (và không có tiết dạy thay đã duyệt).
      </p>
    );
  }

  const toSign = slots.filter((s) => !mixedOf(s));
  const done = toSign.filter((s) => status.get(`${s.classId}_${s.periodIndex}`)?.signed).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2" data-testid="my-teaching-day">
      <p className="text-xs text-slate-600">
        <b>{toSign.length}</b> tiết cần ghi sổ · đã ký <b className="text-emerald-700">{done}</b>/{toSign.length}
        {slots.length > toSign.length && ` · ${slots.length - toSign.length} tiết lớp trộn`}. Bấm vào tiết để ghi/chấm.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {slots.map((s) => {
          const key = `${s.classId}_${s.periodIndex}`;
          const st = status.get(key);
          const mixed = mixedOf(s);
          const bell = UMS_BELL_SCHEDULE.find((b) => b.periodIndex === s.periodIndex);
          const color = getSubjectColor(s.subject);
          return (
            <button
              key={key}
              type="button"
              data-testid={`my-period-${key}`}
              onClick={() => onOpen(s)}
              className={`text-left p-2.5 rounded-lg border ${color.bg} ${color.border} ${activeKey === key ? 'ring-2 ring-[#8B1A4A]' : ''} hover:shadow-sm`}
            >
              <span className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-900">
                  Tiết {s.periodIndex} · Lớp {s.classId}
                </span>
                {st?.signed ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã ký · {st.total}đ
                  </span>
                ) : st ? (
                  <span className="text-sky-700 font-semibold">Nháp · {st.total}đ (chưa ký)</span>
                ) : mixed ? (
                  <span className="text-amber-800 font-semibold">{mixed.mode === 'auto10' ? 'Mặc định 10đ' : 'Không chấm'}</span>
                ) : (
                  <span className="text-slate-500">Chưa ghi</span>
                )}
              </span>
              <span className={`block text-sm font-black mt-0.5 ${color.text}`}>{s.subject}</span>
              {mixed && <span className="block text-[10px] font-bold text-amber-900">{MIXED_MODE_TEXT[mixed.mode]}</span>}
              <span className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                <Clock className="w-3 h-3" /> {bell ? `${bell.startTime} - ${bell.endTime}` : ''}
                {s.substitute && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-sky-700 font-semibold">
                    <Repeat className="w-3 h-3" /> Dạy thay
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
