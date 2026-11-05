import React from 'react';
import { DayOfWeek } from '../../types/schedule';
import { UMS_BELL_SCHEDULE, UMS_BREAKS, getDayOfWeekVi } from '../../utils/schedule';
import { MapPin, User, BookOpen } from 'lucide-react';

export interface TimetableSlotView {
  periodIndex: number;
  dayOfWeek: DayOfWeek;
  subject: string;
  teacherName?: string;
  teacherUsername?: string;
  classId?: string;
  room?: string;
}

export interface TimetableGridProps {
  viewMode: 'class' | 'teacher';
  slots: TimetableSlotView[];
  activePeriodIndex?: number | null;
  activeDayOfWeek?: number | null;
  onSlotClick?: (slot: TimetableSlotView) => void;
}

export const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Toán học': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Toán': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Maths': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Maths test prep': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Ngữ văn': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Literature': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Literature test prep': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Tiếng Anh': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Eng 1': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Eng 2': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Eng Test prep': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  'Native 1': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  'Khoa học tự nhiên': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'KHTN': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'N.Scie Phy': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'N.Sci Bio': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'N.Sci Chem': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Lịch sử và Địa lí': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  'Lịch sử & Địa lý': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  'S.Sci His': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  'S.Sci Geo': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'Tin học': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Computer Sci': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Công nghệ': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Giáo dục công dân': { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  'GDCD': { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  'Civics': { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  'Giáo dục thể chất': { bg: 'bg-lime-50', text: 'text-lime-800', border: 'border-lime-300' },
  'GDTC': { bg: 'bg-lime-50', text: 'text-lime-800', border: 'border-lime-300' },
  'Physical Edu': { bg: 'bg-lime-50', text: 'text-lime-800', border: 'border-lime-300' },
  'Nghệ thuật': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  'Art': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  'Hoạt động trải nghiệm': { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  'HĐTN-HN': { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  'Homeroom': { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  'Bổ trợ Tiếng Anh': { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  'Foreign language 2': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  'CRC': { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
};

export function getSubjectColor(subject: string) {
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject];
  for (const [key, val] of Object.entries(SUBJECT_COLORS)) {
    if (subject.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(subject.toLowerCase())) {
      return val;
    }
  }
  return { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200' };
}

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  viewMode,
  slots,
  activePeriodIndex,
  activeDayOfWeek,
  onSlotClick,
}) => {
  const days: DayOfWeek[] = [2, 3, 4, 5, 6];

  // Lookup map: `${day}_${period}` -> slot
  const slotMap = new Map<string, TimetableSlotView>();
  slots.forEach((s) => {
    slotMap.set(`${s.dayOfWeek}_${s.periodIndex}`, s);
  });

  const renderSlotCell = (day: DayOfWeek, periodIndex: number) => {
    const slot = slotMap.get(`${day}_${periodIndex}`);
    const isNow = activeDayOfWeek === day && activePeriodIndex === periodIndex;
    const color = slot ? getSubjectColor(slot.subject) : {
      bg: 'bg-slate-50',
      text: 'text-slate-800',
      border: 'border-slate-200',
    };

    if (!slot) {
      return (
        <td
          key={day}
          className="p-2 border border-slate-200 bg-slate-50/30 text-center text-slate-300 text-xs italic"
        >
          —
        </td>
      );
    }

    return (
      <td
        key={day}
        onClick={() => onSlotClick?.(slot)}
        className={`p-2 border border-slate-200 transition-all cursor-pointer relative group ${
          isNow
            ? 'ring-2 ring-emerald-500 bg-emerald-50/70 shadow-xs z-10'
            : 'hover:bg-slate-100/60'
        }`}
      >
        <div
          className={`p-2 rounded-lg border ${color.bg} ${color.border} flex flex-col justify-between h-full min-h-[64px]`}
        >
          <div className="flex items-start justify-between">
            <span className={`text-xs font-black ${color.text}`}>{slot.subject}</span>
            {isNow && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            )}
          </div>

          <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
            {viewMode === 'class' ? (
              <div className="flex items-center space-x-1 truncate font-medium">
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{slot.teacherName || slot.teacherUsername}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 truncate font-bold text-slate-800">
                <BookOpen className="w-3 h-3 text-[#8B1A4A] shrink-0" />
                <span>Lớp {slot.classId}</span>
              </div>
            )}

            {slot.room && (
              <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                <span>{slot.room}</span>
              </div>
            )}
          </div>
        </div>
      </td>
    );
  };

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
      <table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider">
            <th className="p-3 border border-slate-200 text-center w-28">Tiết / Buổi</th>
            {days.map((day) => {
              const isToday = activeDayOfWeek === day;
              return (
                <th
                  key={day}
                  className={`p-3 border border-slate-200 text-center ${
                    isToday ? 'bg-pink-50 text-[#8B1A4A] font-extrabold' : ''
                  }`}
                >
                  <span>{getDayOfWeekVi(day)}</span>
                  {isToday && (
                    <span className="block text-[10px] text-emerald-600 font-semibold normal-case">
                      (Hôm nay)
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Morning Header */}
          <tr className="bg-amber-50/60 text-amber-900 font-bold text-xs">
            <td colSpan={6} className="px-4 py-1.5 border border-slate-200">
              BUỔI SÁNG (Tiết 1 - 4 • 07:30 - 11:00)
            </td>
          </tr>

          {[1, 2].map((periodIndex) => {
            const bell = UMS_BELL_SCHEDULE[periodIndex - 1];
            return (
              <tr key={periodIndex}>
                <td className="p-2 border border-slate-200 text-center bg-slate-50">
                  <div className="font-extrabold text-xs text-slate-900">Tiết {periodIndex}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {bell.startTime} - {bell.endTime}
                  </div>
                </td>
                {days.map((day) => renderSlotCell(day, periodIndex))}
              </tr>
            );
          })}

          {/* Morning Recess Row */}
          <tr className="bg-slate-100/70 text-slate-500 text-[11px] font-semibold text-center italic">
            <td className="p-1.5 border border-slate-200">Ra chơi sáng</td>
            <td colSpan={5} className="p-1.5 border border-slate-200">
              {(() => {
                const r = UMS_BREAKS.find((b) => b.type === 'morning_recess');
                return r ? `${r.startTime} - ${r.endTime} (${r.durationMinutes} phút giải lao)` : null;
              })()}
            </td>
          </tr>

          {[3, 4].map((periodIndex) => {
            const bell = UMS_BELL_SCHEDULE[periodIndex - 1];
            return (
              <tr key={periodIndex}>
                <td className="p-2 border border-slate-200 text-center bg-slate-50">
                  <div className="font-extrabold text-xs text-slate-900">Tiết {periodIndex}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {bell.startTime} - {bell.endTime}
                  </div>
                </td>
                {days.map((day) => renderSlotCell(day, periodIndex))}
              </tr>
            );
          })}

          {/* Midday Lunch Break Divider */}
          <tr className="bg-slate-200/80 text-slate-700 text-xs font-bold text-center">
            <td className="p-2 border border-slate-200">Nghỉ trưa</td>
            <td colSpan={5} className="p-2 border border-slate-200">
              11:00 - 13:00 (Ăn trưa & Nghỉ ngơi bán trú)
            </td>
          </tr>

          {/* Afternoon Header */}
          <tr className="bg-blue-50/60 text-blue-900 font-bold text-xs">
            <td colSpan={6} className="px-4 py-1.5 border border-slate-200">
              BUỔI CHIỀU (Tiết 5 - 8 • 13:00 - 16:20)
            </td>
          </tr>

          {[5, 6].map((periodIndex) => {
            const bell = UMS_BELL_SCHEDULE[periodIndex - 1];
            return (
              <tr key={periodIndex}>
                <td className="p-2 border border-slate-200 text-center bg-slate-50">
                  <div className="font-extrabold text-xs text-slate-900">Tiết {periodIndex}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {bell.startTime} - {bell.endTime}
                  </div>
                </td>
                {days.map((day) => renderSlotCell(day, periodIndex))}
              </tr>
            );
          })}

          {/* Afternoon Recess Row */}
          <tr className="bg-slate-100/70 text-slate-500 text-[11px] font-semibold text-center italic">
            <td className="p-1.5 border border-slate-200">Ra chơi chiều</td>
            <td colSpan={5} className="p-1.5 border border-slate-200">
              14:35 - 14:45 (10 phút giải lao)
            </td>
          </tr>

          {[7, 8].map((periodIndex) => {
            const bell = UMS_BELL_SCHEDULE[periodIndex - 1];
            return (
              <tr key={periodIndex}>
                <td className="p-2 border border-slate-200 text-center bg-slate-50">
                  <div className="font-extrabold text-xs text-slate-900">Tiết {periodIndex}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {bell.startTime} - {bell.endTime}
                  </div>
                </td>
                {days.map((day) => renderSlotCell(day, periodIndex))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
