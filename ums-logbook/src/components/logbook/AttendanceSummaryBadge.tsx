import React, { useState } from 'react';
import { StudentAbsenceRecord, EarlyDepartureRecord } from '../../types/logbook';
import { CheckCircle2, UserX, Clock, ArrowRightCircle } from 'lucide-react';

export interface AttendanceSummaryBadgeProps {
  absences: StudentAbsenceRecord[];
  earlyDepartures?: EarlyDepartureRecord[];
  totalStudents?: number;
  compact?: boolean;
  showPopover?: boolean;
}

export const AttendanceSummaryBadge: React.FC<AttendanceSummaryBadgeProps> = ({
  absences = [],
  earlyDepartures = [],
  totalStudents,
  compact = false,
  showPopover = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const pList = absences.filter((a) => a.type === 'P');
  const kList = absences.filter((a) => a.type === 'K');
  const lateList = absences.filter((a) => a.type === 'Late');
  const totalAbsent = pList.length + kList.length;
  const hasIssues = totalAbsent > 0 || lateList.length > 0 || earlyDepartures.length > 0;

  if (!hasIssues) {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>{totalStudents ? `Đủ sĩ số (${totalStudents}/${totalStudents})` : 'Đủ sĩ số'}</span>
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => showPopover && setIsOpen(!isOpen)}
        className={`inline-flex flex-wrap items-center gap-1.5 text-xs text-left cursor-pointer transition-opacity ${
          showPopover ? 'hover:opacity-80' : ''
        }`}
      >
        {totalAbsent > 0 && (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <UserX className="w-3 h-3 text-rose-600" />
            <span>
              Vắng: {totalAbsent}
              {!compact && (pList.length > 0 || kList.length > 0) && (
                <span className="font-medium text-[11px] ml-1">
                  ({[
                    pList.length > 0 ? `${pList.length}P` : '',
                    kList.length > 0 ? `${kList.length}K` : '',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  )
                </span>
              )}
            </span>
          </span>
        )}

        {lateList.length > 0 && (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>{lateList.length} Muộn</span>
          </span>
        )}

        {earlyDepartures.length > 0 && (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <ArrowRightCircle className="w-3 h-3 text-blue-600" />
            <span>{earlyDepartures.length} Về sớm</span>
          </span>
        )}
      </button>

      {/* Popover detailed breakdown */}
      {showPopover && isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 space-y-2 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="font-bold text-slate-800">Chi tiết chuyên cần</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {absences.map((a, idx) => (
                <div key={idx} className="flex items-start justify-between py-1 border-b border-slate-50">
                  <div>
                    <span className="font-semibold text-slate-800">{a.studentName}</span>
                    {a.note && <p className="text-[11px] text-slate-500 italic">{a.note}</p>}
                    {a.reportedInTier === 'baseline' && (
                      <span className="inline-block mt-0.5 text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                        GVCN báo đầu giờ
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      a.type === 'P'
                        ? 'bg-blue-50 text-blue-700'
                        : a.type === 'K'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {a.type === 'P' ? 'Có phép' : a.type === 'K' ? 'Không phép' : 'Đi muộn'}
                  </span>
                </div>
              ))}

              {earlyDepartures.map((e, idx) => (
                <div key={`early-${idx}`} className="flex items-start justify-between py-1 border-b border-slate-50">
                  <div>
                    <span className="font-semibold text-slate-800">{e.studentName}</span>
                    <p className="text-[11px] text-slate-500 italic">
                      {e.reason} ({e.departedAt})
                    </p>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700">
                    Về sớm
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
