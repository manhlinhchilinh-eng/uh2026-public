/**
 * Trợ lý UMS+ — thẻ số liệu điểm danh trong ngày (kết quả formatAttendance) + nút mở trang nguồn.
 * Ngày nghỉ / lỗi tải chỉ hiện 1 câu, không có nút.
 */
import React from 'react';
import { ClipboardCheck } from 'lucide-react';

type L = (vi: string, en: string) => React.ReactNode;

export type StatsReply =
  | { type: 'stats'; vi: string; en: string; date: string; path: string; scope: 'school' | 'class'; today: boolean }
  | { type: 'stats_note'; note: 'offday' | 'error'; date: string };

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export const StatsAnswerCard: React.FC<{ d: StatsReply; L: L; go: (path: string) => void }> = ({ d, L, go }) => {
  if (d.type === 'stats_note') {
    return d.note === 'offday' ? (
      <p className="text-sm text-slate-700" data-testid="assistant-stats-offday">
        {L(`Ngày ${dm(d.date)} không có lịch học.`, `There are no classes on ${dm(d.date)}.`)}
      </p>
    ) : (
      <p className="text-sm text-slate-700" data-testid="assistant-stats-error">
        {L('Chưa tải được số liệu điểm danh, thử lại sau.', 'Could not load attendance data. Please try again later.')}
      </p>
    );
  }
  const label =
    d.scope === 'class'
      ? L('Mở sổ đầu bài', 'Open logbook')
      : d.today
        ? L('Mở Vắng/muộn hôm nay', "Open today's absences")
        : L('Mở Vắng/muộn', 'Open absences');
  return (
    <div data-testid="assistant-stats">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8B1A4A]">
        <ClipboardCheck className="w-3.5 h-3.5" /> {L('Số liệu điểm danh', 'Attendance figures')}
      </div>
      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{L(d.vi, d.en)}</p>
      <button
        type="button"
        onClick={() => go(d.path)}
        data-testid="assistant-stats-open"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A4A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6B1338]"
      >
        {label} →
      </button>
      <p className="mt-1.5 text-[11px] text-slate-400">
        {L('Lớp chưa điểm danh không tính vào "có mặt".', 'Classes not yet checked are not counted as present.')}
      </p>
    </div>
  );
};
