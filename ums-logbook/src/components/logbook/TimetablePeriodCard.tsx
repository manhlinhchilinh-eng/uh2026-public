/**
 * Thẻ 1 tiết trong Sổ đầu bài, trình bày giống ô Thời khóa biểu (màu theo môn, tên GV),
 * kèm trạng thái ghi sổ: chưa ghi / đã ký + điểm, tên bài, sĩ số vắng.
 */

import React from 'react';
import { CheckCircle2, Edit3, User } from 'lucide-react';
import type { PeriodEntry } from '../../types/logbook';
import { getPeriodRating } from '../../utils/scoring';
import { getSubjectColor } from '../schedule/TimetableGrid';
import { AttendanceSummaryBadge } from './AttendanceSummaryBadge';
import { MIXED_MODE_TEXT, type MixedRule } from '../../utils/mixedPeriods';
import { formatClock } from '../../utils/periodAttendance';

/** "Vắng: A, B • Muộn: C" — để giám thị/GVCN biết ngay ai vắng, ai muộn. */
function attendanceNames(period: PeriodEntry): string {
  const abs = period.absentStudents || [];
  const names = (type: 'P' | 'K' | 'Late') => abs.filter((a) => a.type === type).map((a) => a.studentName);
  const absent = [...names('P').map((n) => `${n} (P)`), ...names('K').map((n) => `${n} (K)`)];
  const late = names('Late');
  const early = (period.earlyDepartures || []).map((e) => `${e.studentName} (${e.departedAt})`);
  return [
    absent.length ? `Vắng: ${absent.join(', ')}` : '',
    late.length ? `Muộn: ${late.join(', ')}` : '',
    early.length ? `Về sớm: ${early.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
}

export interface TimetablePeriodCardProps {
  period: PeriodEntry;
  periodIndex: number;
  isCurrentPeriod?: boolean;
  canEdit?: boolean;
  onOpenEdit?: () => void;
  substituteLabel?: string;
  /** Tiết lớp trộn (nếu có) */
  mixed?: Pick<MixedRule, 'mode' | 'noteUrl'> | null;
}

export const TimetablePeriodCard: React.FC<TimetablePeriodCardProps> = ({
  period,
  periodIndex,
  isCurrentPeriod = false,
  canEdit = true,
  onOpenEdit,
  substituteLabel,
  mixed,
}) => {
  const color = getSubjectColor(period.subject || '');
  const rating = period.isSigned ? getPeriodRating(period.scores.total) : null;
  const teacher = period.teacherName || period.teacherId;

  return (
    <div
      data-testid={`period-card-${periodIndex}`}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={() => canEdit && onOpenEdit?.()}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpenEdit?.();
        }
      }}
      className={`rounded-lg border p-2.5 transition-all ${color.bg} ${color.border} ${canEdit ? 'cursor-pointer hover:shadow-sm' : ''} ${
        isCurrentPeriod ? 'ring-2 ring-[#8B1A4A] ring-offset-1' : ''
      } ${period.isSigned ? '' : 'border-dashed'}`}
    >
      {substituteLabel && (
        <p data-testid={`sub-label-${periodIndex}`} className="mb-1.5 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded-md px-2 py-0.5">
          {substituteLabel}
        </p>
      )}
      {mixed && (
        <p data-testid={`mixed-label-${periodIndex}`} className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
          {MIXED_MODE_TEXT[mixed.mode]}
          {mixed.noteUrl && (
            <a href={mixed.noteUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline text-sky-800">
              Ghi chú tình hình HS ở Eng9 Hub ↗
            </a>
          )}
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-black ${color.text} truncate`}>{period.subject || 'Chưa có thông tin tiết'}</p>
          {teacher && (
            <p className="mt-0.5 text-xs text-slate-600 flex items-center gap-1 truncate">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{teacher}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isCurrentPeriod && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B1A4A] text-white">Đang diễn ra</span>
          )}
          {period.esl && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300"
              title="Tiết có dạy bằng tiếng Anh · Taught in English"
              data-testid="esl-badge"
            >
              ESL
            </span>
          )}
          {period.isSigned ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> Đã ký
            </span>
          ) : period.attendanceTakenAt ? (
            <span
              data-testid={`attendance-taken-${periodIndex}`}
              className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              Đã điểm danh {formatClock(period.attendanceTakenAt)}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/70 text-slate-500 border border-slate-200">Chưa ghi sổ</span>
          )}
        </div>
      </div>

      {period.isSigned ? (
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="text-slate-800 font-medium line-clamp-2 bg-white/70 rounded-md px-2 py-1">
            {period.ppctLessonIndex ? `(Tiết ${period.ppctLessonIndex}) ` : ''}
            {period.lessonTopic}
          </p>
          <div className="flex items-center justify-between gap-2">
            <AttendanceSummaryBadge absences={period.absentStudents || []} earlyDepartures={period.earlyDepartures || []} compact showPopover={false} />
            <div className="flex items-center gap-1.5">
              {rating && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${rating.badgeClass}`}>
                  {period.scores.total}đ • {rating.labelVi}
                </span>
              )}
              {canEdit && <Edit3 className="w-3.5 h-3.5 text-slate-400" aria-label="Chỉnh sửa tiết học" />}
            </div>
          </div>
          {period.teacherComment && <p className="text-[11px] text-slate-500 italic line-clamp-1">"{period.teacherComment}"</p>}
        </div>
      ) : period.attendanceTakenAt ? (
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <AttendanceSummaryBadge absences={period.absentStudents || []} earlyDepartures={period.earlyDepartures || []} compact showPopover={false} />
            <span className="text-[11px] text-slate-500">
              {period.attendanceTakenByName ? `${period.attendanceTakenByName} • ` : ''}chưa ký{canEdit ? ', nhấn để ký cuối tiết' : ''}
            </span>
          </div>
          {attendanceNames(period) && (
            <p data-testid={`attendance-names-${periodIndex}`} className="text-[11px] text-slate-700 bg-white/70 rounded-md px-2 py-1">
              {attendanceNames(period)}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-500">
          {period.lessonTopic?.trim()
            ? `Bản nháp ${period.scores?.total ?? 0}đ — chưa ký${canEdit ? ', nhấn để ký' : ''}`
            : mixed?.mode === 'auto10'
            ? 'Mặc định 10đ' + (canEdit ? ' — nhấn nếu cần ghi khác' : '')
            : mixed?.mode === 'skip'
              ? 'Không chấm điểm tiết này'
              : canEdit
                ? 'Nhấn để ghi sổ đầu bài tiết này'
                : 'Chưa ghi sổ'}
        </p>
      )}
    </div>
  );
};
