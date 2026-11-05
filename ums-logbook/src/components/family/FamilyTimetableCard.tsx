/**
 * Thẻ TKB của con (PH) / của em (HS) trên trang Gia đình — đọc TKB lớp mới nhất (`schedules/{lớp}`, 1 lượt đọc, cache 10 phút).
 * Kèm tên GVCN để liên hệ.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Bi } from '../common/Bi';
import { getClassSchedule } from '../../services/scheduleService';
import { useGvcnName } from '../../hooks/useGvcnName';
import { UMS_BELL_SCHEDULE } from '../../utils/schedule';
import type { ClassSchedule } from '../../types/schedule';
import { dayTimetable, defaultSchoolDay, hasTimetable } from '../../utils/familyTimetable';

const DAYS: Array<{ dow: number; vi: string }> = [
  { dow: 2, vi: 'T2' },
  { dow: 3, vi: 'T3' },
  { dow: 4, vi: 'T4' },
  { dow: 5, vi: 'T5' },
  { dow: 6, vi: 'T6' },
];

export const FamilyTimetableCard: React.FC<{ classId: string }> = ({ classId }) => {
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [dow, setDow] = useState(defaultSchoolDay());
  const gvcnName = useGvcnName(classId);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getClassSchedule(classId)
      .then((s) => alive && setSchedule(s))
      .catch(() => alive && setSchedule(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [classId]);

  const rows = useMemo(() => dayTimetable(schedule, dow), [schedule, dow]);
  const bell = (p: number) => UMS_BELL_SCHEDULE.find((b) => b.periodIndex === p);

  return (
    <div data-testid={`family-tkb-${classId}`} className="mt-5">
      <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
        <CalendarDays className="w-4 h-4" />
        <Bi vi={`Thời khóa biểu lớp ${classId}`} en={`Class ${classId} timetable`} layout="inline" />
      </h4>
      {gvcnName && (
        <p data-testid="family-gvcn" className="text-[11px] text-slate-600 mb-2">
          GVCN: <b>{gvcnName}</b>
        </p>
      )}
      <div role="tablist" aria-label="Chọn thứ" className="flex gap-1 mb-2">
        {DAYS.map((d) => (
          <button
            key={d.dow}
            type="button"
            role="tab"
            aria-selected={dow === d.dow}
            onClick={() => setDow(d.dow)}
            className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${dow === d.dow ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'border-slate-200 text-slate-600'}`}
          >
            {d.vi}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Đang tải thời khóa biểu…</p>
      ) : !hasTimetable(schedule) ? (
        <p className="text-xs text-slate-500">Chưa có thời khóa biểu của lớp. Vui lòng liên hệ GVCN.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
          {rows.map((r) => (
            <li key={r.periodIndex} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
              <span className="w-12 shrink-0 font-bold text-slate-700">Tiết {r.periodIndex}</span>
              <span className="w-24 shrink-0 text-[10px] text-slate-400">
                {bell(r.periodIndex) ? `${bell(r.periodIndex)!.startTime}–${bell(r.periodIndex)!.endTime}` : ''}
              </span>
              <span className="flex-1 min-w-0 truncate font-semibold text-slate-900">{r.subject || '—'}</span>
              {r.teacherName && <span className="shrink-0 text-[11px] text-slate-500 truncate max-w-[40%]">{r.teacherName}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
