import React from 'react';
import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import { useAuth } from '../../hooks/useAuth';
import {
  Clock,
  BookOpen,
  ArrowRight,
  Coffee,
  Calendar,
  MapPin,
} from 'lucide-react';
import { getPeriodTimeRange, getDayOfWeekVi, UMS_BELL_SCHEDULE } from '../../utils/schedule';

export const SmartNavigationCard: React.FC = () => {
  const { profile } = useAuth();
  const {
    currentTime,
    todayDateStr,
    todayDayOfWeek,
    bellStatus,
    isTeachingNow,
    currentTeachingSlot,
    minutesRemainingInClass,
    hasNextTeachingToday,
    nextTeachingSlot,
    minutesUntilNextTeaching,
    todaySlots,
    navigateToLogbook,
  } = useSmartNavigation();

  const formattedTime = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dayLabel = `${getDayOfWeekVi(todayDayOfWeek)}, ${todayDateStr.split('-').reverse().join('/')}`;

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 relative overflow-hidden shadow-xs ${
        isTeachingNow
          ? 'bg-gradient-to-br from-emerald-500/10 via-white to-white border-emerald-500 ring-4 ring-emerald-500/15'
          : hasNextTeachingToday
          ? 'bg-gradient-to-br from-amber-500/10 via-white to-white border-amber-400 ring-2 ring-amber-400/10'
          : 'bg-white border-slate-200'
      }`}
    >
      {/* Top Banner: Digital Clock & School Bell State */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white/60 backdrop-blur-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700 flex items-center space-x-1.5">
            <Clock className="w-4 h-4 text-[#8B1A4A]" />
            <span className="font-mono text-sm font-black tracking-tight">{formattedTime}</span>
          </div>
          <span className="text-xs font-semibold text-slate-500 hidden sm:inline">{dayLabel}</span>
        </div>

        {/* Bell schedule pill */}
        <div>
          {bellStatus.activePeriod ? (
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>
                Đang diễn ra: Tiết {bellStatus.activePeriod} ({getPeriodTimeRange(bellStatus.activePeriod)})
              </span>
            </div>
          ) : bellStatus.isBreak ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
              <Coffee className="w-3.5 h-3.5" />
              <span>{bellStatus.breakLabel || 'Giờ giải lao'}</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              <span>Ngoài giờ học chính khóa</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Focus Area: Live Teaching Callout */}
      <div className="p-6">
        {isTeachingNow && currentTeachingSlot ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>Tiết học trực tiếp đang diễn ra</span>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Tiết {currentTeachingSlot.periodIndex}: Môn{' '}
                <span className="text-[#8B1A4A]">{currentTeachingSlot.subject}</span> tại Lớp{' '}
                <span className="text-emerald-700">{currentTeachingSlot.classId}</span>
              </h3>
              <p className="text-xs md:text-sm text-slate-600 flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Phòng {currentTeachingSlot.room || `P.${currentTeachingSlot.classId}`}</span>
                </span>
                <span>•</span>
                <span>Khung giờ: {getPeriodTimeRange(currentTeachingSlot.periodIndex)}</span>
                {minutesRemainingInClass !== null && (
                  <span className="font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Còn {minutesRemainingInClass} phút
                  </span>
                )}
              </p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() =>
                  navigateToLogbook(currentTeachingSlot.classId, currentTeachingSlot.periodIndex)
                }
                className="w-full md:w-auto px-6 py-3.5 bg-[#8B1A4A] hover:bg-[#72153c] text-white rounded-xl font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2.5 group cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Vào sổ ngay</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ) : hasNextTeachingToday && nextTeachingSlot ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                <Clock className="w-3 h-3 text-blue-600" />
                <span>Tiết học tiếp theo hôm nay</span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-slate-900">
                Tiết {nextTeachingSlot.periodIndex}: Môn{' '}
                <span className="text-[#8B1A4A]">{nextTeachingSlot.subject}</span> tại Lớp{' '}
                <span className="text-blue-700">{nextTeachingSlot.classId}</span>
              </h3>
              <p className="text-xs text-slate-500">
                Bắt đầu lúc {getPeriodTimeRange(nextTeachingSlot.periodIndex).split(' - ')[0]} (sau{' '}
                <span className="font-bold text-amber-600">{minutesUntilNextTeaching} phút</span>) •
                Phòng {nextTeachingSlot.room || `P.${nextTeachingSlot.classId}`}
              </p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() =>
                  navigateToLogbook(nextTeachingSlot.classId, nextTeachingSlot.periodIndex)
                }
                className="w-full md:w-auto px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Vào sổ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-slate-100 text-slate-500 rounded-xl hidden sm:block">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  {todaySlots.length > 0
                    ? 'Bạn đã hoàn thành các tiết giảng dạy hôm nay'
                    : 'Hôm nay bạn không có lịch dạy trên thời khóa biểu'}
                </h4>
                <p className="text-xs text-slate-500">
                  {todaySlots.length > 0
                    ? `Đã lên lớp ${todaySlots.length} tiết. Hãy kiểm tra chữ ký và điểm số các tiết học.`
                    : 'Xem toàn bộ lịch dạy trong tuần hoặc sổ đầu bài lớp chủ nhiệm.'}
                </p>
              </div>
            </div>

            {profile?.assignedClassId && (
              <button
                type="button"
                onClick={() => navigateToLogbook(profile.assignedClassId!, 1)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Sổ lớp chủ nhiệm ({profile.assignedClassId})
              </button>
            )}
          </div>
        )}

        {/* 8-Period Daily Schedule Timeline Strip */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Lịch giảng dạy hôm nay ({todaySlots.length} tiết)
            </span>
            <span className="text-[11px] text-slate-400">Nhấp vào tiết để vào thẳng sổ bài</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {UMS_BELL_SCHEDULE.map((bell) => {
              const teachingSlot = todaySlots.find((s) => s.periodIndex === bell.periodIndex);
              const isCurrent = bellStatus.activePeriod === bell.periodIndex;

              return (
                <button
                  key={bell.periodIndex}
                  type="button"
                  disabled={!teachingSlot}
                  onClick={() => {
                    if (teachingSlot) {
                      navigateToLogbook(teachingSlot.classId, teachingSlot.periodIndex);
                    }
                  }}
                  className={`p-2 rounded-xl text-left transition-all relative border ${
                    teachingSlot
                      ? isCurrent
                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 shadow-sm cursor-pointer'
                        : 'bg-white hover:bg-pink-50 border-slate-200 hover:border-[#8B1A4A] cursor-pointer'
                      : 'bg-slate-50/70 border-dashed border-slate-200 text-slate-400 cursor-default'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span>T{bell.periodIndex}</span>
                    <span className="text-[9px] opacity-75">{bell.startTime}</span>
                  </div>
                  <div className="mt-1">
                    {teachingSlot ? (
                      <div>
                        <p
                          className={`text-xs font-black truncate ${
                            isCurrent ? 'text-white' : 'text-[#8B1A4A]'
                          }`}
                        >
                          {teachingSlot.subject}
                        </p>
                        <p
                          className={`text-[10px] font-bold truncate ${
                            isCurrent ? 'text-emerald-100' : 'text-slate-600'
                          }`}
                        >
                          Lớp {teachingSlot.classId}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-300 italic">Trống</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
