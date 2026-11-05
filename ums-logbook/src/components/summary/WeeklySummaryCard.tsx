/**
 * UMS Digital Class Logbook - WeeklySummaryCard Component
 * Milestone 5: Compact Class Standing & Emulation Card for GVCN Dashboard
 * Path: src/components/summary/WeeklySummaryCard.tsx
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useWeeklySummary } from '../../hooks/useWeeklySummary';
import { Trophy, CheckCircle, AlertTriangle, ArrowRight, AlertCircle } from 'lucide-react';
import { getAwardLevelMeta, determineAwardLevel } from '../../utils/emulation';

export interface WeeklySummaryCardProps {
  classId: string;
  weekNumber?: number;
  className?: string;
}

export const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({
  classId,
  weekNumber = 5,
  className = '',
}) => {
  const { summary, isLoading } = useWeeklySummary(classId, weekNumber);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-xs animate-pulse ${className}`}>
        <div className="h-5 bg-slate-200 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-slate-100 rounded w-2/3 mb-4"></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-10 bg-slate-100 rounded"></div>
          <div className="h-10 bg-slate-100 rounded"></div>
          <div className="h-10 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  const score = summary?.emulationScore ?? 100;
  const rank = summary?.rank;
  const isGoodWeek =
    score >= 90 &&
    (summary?.attendanceStats.totalUnexcused || 0) === 0 &&
    (summary?.unsignedPeriods.filter((p) => !p.notStarted).length || 0) === 0;

  const awardLevel = determineAwardLevel(score, isGoodWeek);
  const awardMeta = getAwardLevelMeta(awardLevel);

  const totalP = summary?.attendanceStats.totalExcused || 0;
  const totalK = summary?.attendanceStats.totalUnexcused || 0;
  const totalLate = summary?.attendanceStats.totalLate || 0;
  const unsignedCount = summary?.unsignedPeriods.length || 0;
  const penalizedCount = summary?.unsignedPeriods.filter((p) => !p.notStarted).length || 0;

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:shadow-md transition flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Thi Đua Lớp {classId} • Tuần {weekNumber}
              </h3>
              <p className="text-[11px] text-slate-500">
                Xếp hạng và điểm nề nếp của lớp bạn chủ nhiệm
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${awardMeta.badgeBg} ${awardMeta.badgeText} ${awardMeta.badgeBorder}`}
          >
            {awardMeta.labelVi}
          </span>
        </div>

        {/* Big Score & Rank Highlight */}
        <div className="flex items-baseline space-x-3 mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <div>
            <span className="text-2xl font-black text-slate-900">{score}</span>
            <span className="text-xs text-slate-500 font-semibold ml-1">/105 đ</span>
          </div>

          {rank && (
            <div className="pl-3 border-l border-slate-200">
              <span className="text-xs text-slate-500 block leading-tight">Xếp hạng:</span>
              <span className="text-base font-black text-amber-600">
                Hạng {rank}/26
              </span>
            </div>
          )}

          {isGoodWeek ? (
            <div className="ml-auto flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 text-[11px] font-bold">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tuần học tốt</span>
            </div>
          ) : (
            <div className="ml-auto flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Cần duy trì</span>
            </div>
          )}
        </div>

        {/* Attendance Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3.5">
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold">Vắng P</span>
            <span className="font-bold text-slate-800">{totalP}</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold">Vắng K</span>
            <span className={`font-bold ${totalK > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {totalK}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold">Đi muộn</span>
            <span className={`font-bold ${totalLate > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {totalLate}
            </span>
          </div>
        </div>

        {/* Unsigned Warning if any */}
        {unsignedCount > 0 && (
          <div className="mb-3.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Có <strong>{unsignedCount} tiết</strong> chưa ký sổ đầu bài{penalizedCount > 0 ? ` (bị trừ ${penalizedCount * 2}đ thi đua)` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Footer Navigation Links */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <Link
          to={`/summary?classId=${classId}&week=${weekNumber}`}
          className="font-bold text-ums-700 hover:text-ums-900 flex items-center space-x-1"
        >
          <span>Xem tổng kết tuần</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        <Link
          to="/emulation"
          className="text-slate-500 hover:text-slate-800 font-medium"
        >
          Bảng xếp hạng 26 lớp →
        </Link>
      </div>
    </div>
  );
};
