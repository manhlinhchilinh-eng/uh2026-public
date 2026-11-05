import React from 'react';
import { PeriodEntry } from '../../types/logbook';
import { getPeriodRating } from '../../utils/scoring';
import { AttendanceSummaryBadge } from './AttendanceSummaryBadge';
import {
  Clock,
  CheckCircle2,
  Edit3,
  Award,
  BookOpen,
} from 'lucide-react';

export { UMS_BELL_SCHEDULE, type BellSlot } from '../../utils/schedule';
import { UMS_BELL_SCHEDULE } from '../../utils/schedule';

export interface PeriodCardProps {
  period: PeriodEntry;
  periodIndex: number;
  isCurrentPeriod?: boolean;
  canEdit?: boolean;
  onOpenEdit?: () => void;
}

export const PeriodCard: React.FC<PeriodCardProps> = ({
  period,
  periodIndex,
  isCurrentPeriod = false,
  canEdit = true,
  onOpenEdit,
}) => {
  const bell = UMS_BELL_SCHEDULE.find((s) => s.periodIndex === periodIndex);
  const ratingInfo = period.isSigned ? getPeriodRating(period.scores.total) : null;

  return (
    <div
      onClick={() => canEdit && onOpenEdit?.()}
      className={`rounded-xl border transition-all cursor-pointer relative overflow-hidden bg-white ${
        isCurrentPeriod
          ? 'border-2 border-[#8B1A4A] ring-4 ring-[#8B1A4A]/10 shadow-md'
          : period.isSigned
          ? 'border-slate-200 shadow-xs hover:border-[#8B1A4A]/40'
          : 'border-slate-200 border-dashed hover:border-[#8B1A4A]/50 bg-slate-50/40'
      }`}
    >
      {/* Top Banner / Header */}
      <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-extrabold text-[#8B1A4A] bg-pink-50 px-2.5 py-0.5 rounded-lg border border-pink-100">
            Tiết {periodIndex}
          </span>
          {bell && (
            <span className="text-[11px] font-medium text-slate-400 flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>
                {bell.startTime} - {bell.endTime}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {isCurrentPeriod && (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B1A4A] text-white animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <span>Đang diễn ra</span>
            </span>
          )}

          {period.isSigned ? (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Đã ký</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
              Chưa ghi sổ
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3.5 space-y-2.5 text-xs">
        {period.isSigned ? (
          <>
            {/* Subject and Teacher */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-[#8B1A4A]" />
                  <span>{period.subject}</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  GV: <strong className="text-slate-700">{period.teacherName || period.teacherId}</strong>
                </p>
              </div>

              {/* Score & Rating Badge */}
              {ratingInfo && (
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${ratingInfo.badgeClass}`}
                  >
                    {period.scores.total}đ • {ratingInfo.labelVi}
                  </span>
                </div>
              )}
            </div>

            {/* Lesson topic and PPCT */}
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-slate-800 font-medium line-clamp-2">
                {period.ppctLessonIndex ? `(Tiết ${period.ppctLessonIndex}) ` : ''}
                {period.lessonTopic}
              </p>
            </div>

            {/* Attendance breakdown badge */}
            <div className="pt-1 flex items-center justify-between">
              <AttendanceSummaryBadge
                absences={period.absentStudents || []}
                earlyDepartures={period.earlyDepartures || []}
                compact={true}
                showPopover={false}
              />

              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEdit?.();
                  }}
                  className="text-slate-400 hover:text-[#8B1A4A] p-1 rounded-md transition-colors"
                  title="Chỉnh sửa tiết học"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Qualitative comment if exists */}
            {period.teacherComment && (
              <p className="text-[11px] text-slate-500 italic line-clamp-1 border-t border-slate-100 pt-1.5">
                "{period.teacherComment}"
              </p>
            )}
          </>
        ) : (
          /* Empty / Unfilled State */
          <div className="py-4 text-center space-y-2">
            <div className="w-8 h-8 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-600">
                {period.subject ? period.subject : 'Chưa có thông tin tiết'}
              </p>
              <p className="text-[11px] text-slate-400">
                {canEdit ? 'Nhấn để ghi sổ đầu bài tiết này' : 'Chưa ghi sổ'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
