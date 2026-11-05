import React from 'react';
import { CalendarOff } from 'lucide-react';
import { formatDateVi } from '../../utils/dateFormat';

/** Báo ngày nghỉ: không có thời khóa biểu, không ghi sổ / điểm danh. */
export const OffDayNotice: React.FC<{ date: string; reason: string | null; kind: 'weekend' | 'holiday' | null }> = ({ date, reason, kind }) => (
  <div data-testid="off-day-notice" className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
    <CalendarOff className="w-10 h-10 mx-auto text-[#8B1A4A]" />
    <p className="text-base font-bold text-slate-900">
      {formatDateVi(date)} là ngày nghỉ{reason ? ` — ${reason}` : ''}
    </p>
    <p className="text-sm text-slate-500">Không có thời khóa biểu, không cần ghi sổ đầu bài hay điểm danh ngày này.</p>
    {kind === 'holiday' && <p className="text-xs text-slate-400">Ngày nghỉ do BGH khai trong Thời khóa biểu → Ngày nghỉ.</p>}
  </div>
);
