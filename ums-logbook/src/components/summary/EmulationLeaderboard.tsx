/**
 * UMS Digital Class Logbook - Emulation Leaderboard Component
 * Milestone 5: Top 3 Olympic Podium, Grade Filtering & 26-Class Standings Table
 * Path: src/components/summary/EmulationLeaderboard.tsx
 */

import React, { useState } from 'react';
import { useEmulationLeaderboard } from '../../hooks/useEmulationLeaderboard';
import { getAwardLevelMeta } from '../../utils/emulation';
import {
  Trophy,
  Medal,
  Award,
  Search,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export interface EmulationLeaderboardProps {
  initialWeekNumber?: number;
  onSelectClass?: (classId: string) => void;
}

export const EmulationLeaderboard: React.FC<EmulationLeaderboardProps> = ({
  initialWeekNumber = 5,
  onSelectClass,
}) => {
  const {
    weekNumber,
    setWeekNumber,
    gradeFilter,
    setGradeFilter,
    searchQuery,
    setSearchQuery,
    filteredRankings,
    podium,
    isLoading,
    refresh,
    stats,
  } = useEmulationLeaderboard(initialWeekNumber);

  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  const toggleExpand = (classId: string) => {
    setExpandedClassId((prev) => (prev === classId ? null : classId));
  };

  return (
    <div className="space-y-6">
      {/* Header Bar with Week Selector and Summary Stats */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
              <span>BẢNG XẾP HẠNG THI ĐUA NỀ NẾP & HỌC TẬP</span>
              <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full">
                Thang 100
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Toàn trường 26 lớp • Cập nhật tự động theo sổ đầu bài & chuyên cần
            </p>
          </div>
        </div>

        {/* Week Selector & Refresh Button */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <span className="text-slate-500">Tuần học:</span>
            <select
              aria-label="Chọn tuần xếp hạng"
              value={weekNumber}
              onChange={(e) => setWeekNumber(Number(e.target.value))}
              className="bg-transparent font-black text-slate-900 focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 35 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Tuần {w}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => refresh()}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Làm mới bảng xếp hạng"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Tổng số lớp
            </span>
            <span className="text-xl font-black text-slate-800">{stats.totalClasses}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            26
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Tuần học tốt
            </span>
            <span className="text-xl font-black text-emerald-600">{stats.goodStudyWeekCount} lớp</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Điểm trung bình
            </span>
            <span className="text-xl font-black text-indigo-600">{stats.averageSchoolScore}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
            /100
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Điểm dẫn đầu
            </span>
            <span className="text-xl font-black text-amber-600">{stats.topScore}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* TOP 3 OLYMPIC PODIUM */}
      {podium.length >= 3 && gradeFilter === 'all' && !searchQuery && (
        <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-700">
          <div className="text-center mb-6">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold border border-amber-500/30">
              <Medal className="w-3.5 h-3.5" />
              <span>BỤC DANH DỰ TOÀN TRƯỜNG • TOP 3 XUẤT SẮC</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-2xl mx-auto pt-4">
            {/* 2nd Place (Silver) */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center font-black text-base shadow-lg border-2 border-white mb-2">
                2
              </div>
              <span className="text-xs sm:text-sm font-black text-white">{podium[1].className}</span>
              <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{podium[1].gvcnName}</span>
              <span className="text-xs sm:text-base font-bold text-amber-300 mt-1">
                {podium[1].totalScore} đ
              </span>
              <div className="w-full h-24 sm:h-28 bg-gradient-to-t from-slate-700 to-slate-600 rounded-t-xl mt-3 flex items-center justify-center border-t-2 border-slate-400">
                <span className="text-xs font-bold text-slate-300">Hạng Nhì</span>
              </div>
            </div>

            {/* 1st Place (Gold - Center & Elevated) */}
            <div className="flex flex-col items-center -mt-6">
              <div className="relative mb-2">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black text-xl shadow-xl border-4 border-amber-200">
                  <Trophy className="w-8 h-8 text-amber-900" />
                </div>
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full animate-bounce">
                  #1
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-amber-200">{podium[0].className}</span>
              <span className="text-[11px] text-slate-300 truncate max-w-[120px] font-medium">
                {podium[0].gvcnName}
              </span>
              <span className="text-sm sm:text-lg font-black text-amber-400 mt-1">
                {podium[0].totalScore} đ
              </span>
              {podium[0].isGoodStudyWeek && (
                <span className="text-[9px] bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full mt-1 font-bold">
                  Tuần học tốt
                </span>
              )}
              <div className="w-full h-32 sm:h-36 bg-gradient-to-t from-amber-600 to-amber-500 rounded-t-xl mt-3 flex items-center justify-center border-t-4 border-amber-300 shadow-xl">
                <span className="text-sm font-black text-amber-950 uppercase tracking-wider">Quán quân</span>
              </div>
            </div>

            {/* 3rd Place (Bronze) */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-base shadow-lg border-2 border-amber-600 mb-2">
                3
              </div>
              <span className="text-xs sm:text-sm font-black text-white">{podium[2].className}</span>
              <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{podium[2].gvcnName}</span>
              <span className="text-xs sm:text-base font-bold text-amber-300 mt-1">
                {podium[2].totalScore} đ
              </span>
              <div className="w-full h-18 sm:h-20 bg-gradient-to-t from-amber-900 to-amber-800 rounded-t-xl mt-3 flex items-center justify-center border-t-2 border-amber-600">
                <span className="text-xs font-bold text-amber-200">Hạng Ba</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Grade Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setGradeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              gradeFilter === 'all'
                ? 'bg-ums-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả (26 lớp)
          </button>
          {[6, 7, 8, 9].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGradeFilter(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                gradeFilter === g
                  ? 'bg-ums-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Khối {g}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo lớp hoặc GVCN..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ums-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 text-center w-12">Hạng</th>
                <th className="py-3 px-4">Lớp</th>
                <th className="py-3 px-4">GVCN</th>
                <th className="py-3 px-3 text-center">Học tập (Δ)</th>
                <th className="py-3 px-3 text-center">Chuyên cần</th>
                <th className="py-3 px-3 text-center">Nề nếp</th>
                <th className="py-3 px-3 text-center">Ký sổ</th>
                <th className="py-3 px-4 text-center">Tổng điểm</th>
                <th className="py-3 px-4 text-center">Danh hiệu</th>
                <th className="py-3 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRankings.map((row) => {
                const awardMeta = getAwardLevelMeta(row.awardLevel);
                const isExpanded = expandedClassId === row.classId;

                const getRankBadge = (rank: number) => {
                  if (rank === 1) {
                    return (
                      <span className="w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-xs shadow-xs">
                        1
                      </span>
                    );
                  }
                  if (rank === 2) {
                    return (
                      <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-800 font-black flex items-center justify-center text-xs">
                        2
                      </span>
                    );
                  }
                  if (rank === 3) {
                    return (
                      <span className="w-6 h-6 rounded-full bg-amber-700 text-white font-black flex items-center justify-center text-xs">
                        3
                      </span>
                    );
                  }
                  return <span className="font-bold text-slate-600">{rank}</span>;
                };

                return (
                  <React.Fragment key={row.classId}>
                    <tr
                      onClick={() => toggleExpand(row.classId)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition ${
                        isExpanded ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3 px-3 text-center font-bold">
                        <div className="flex justify-center">{getRankBadge(row.rank)}</div>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectClass) onSelectClass(row.classId);
                          }}
                          className="font-bold text-slate-900 hover:text-ums-700 underline text-sm"
                        >
                          {row.className}
                        </button>
                        {gradeFilter === 'all' && (
                          <span className="text-[10px] text-slate-400 ml-1.5">
                            (Khối {row.grade})
                          </span>
                        )}
                      </td>

                      {/* GVCN */}
                      <td className="py-3 px-4 font-medium text-slate-700">{row.gvcnName}</td>

                      {/* Academic Delta */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-semibold ${
                            row.academicDelta > 0
                              ? 'text-emerald-600'
                              : row.academicDelta < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {row.academicDelta > 0 ? `+${row.academicDelta}` : row.academicDelta}
                        </span>
                      </td>

                      {/* Attendance Deductions */}
                      <td className="py-3 px-3 text-center">
                        {row.attendanceDeductions.total > 0 ? (
                          <span className="font-semibold text-rose-600">
                            -{row.attendanceDeductions.total}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">0</span>
                        )}
                      </td>

                      {/* Behavior Delta */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-semibold ${
                            row.behaviorDelta.net > 0
                              ? 'text-emerald-600'
                              : row.behaviorDelta.net < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {row.behaviorDelta.net > 0
                            ? `+${row.behaviorDelta.net}`
                            : row.behaviorDelta.net}
                        </span>
                      </td>

                      {/* Unsigned Penalty */}
                      <td className="py-3 px-3 text-center">
                        {row.unsignedPeriodDeductions > 0 ? (
                          <span className="font-semibold text-rose-600">
                            -{row.unsignedPeriodDeductions}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Total Score */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-sm text-slate-900">
                          {row.totalScore}
                        </span>
                        <span className="text-[10px] text-slate-400">/105</span>
                      </td>

                      {/* Award Level / Badge */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full border text-[11px] ${awardMeta.badgeBg} ${awardMeta.badgeText} ${awardMeta.badgeBorder}`}
                          >
                            {awardMeta.labelVi}
                          </span>
                          {row.isGoodStudyWeek && (
                            <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 font-bold">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Tuần học tốt</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Expand Chevron */}
                      <td className="py-3 px-2 text-center text-slate-400">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </td>
                    </tr>

                    {/* Drilldown Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={10} className="p-4 text-xs text-slate-700">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-3.5 rounded-xl border border-slate-200">
                            <div>
                              <h4 className="font-bold text-slate-900 mb-1 flex items-center space-x-1">
                                <Award className="w-3.5 h-3.5 text-ums-600" />
                                <span>Chi tiết chuyên cần & ký sổ</span>
                              </h4>
                              <p>• Nghỉ không phép (K): {row.attendanceDeductions.unexcusedK} lượt (-{row.attendanceDeductions.kDeduction ?? (row.attendanceDeductions.unexcusedK * 2)} đ)</p>
                              <p>• Nghỉ có phép (P): {row.attendanceDeductions.excusedP} lượt (-{row.attendanceDeductions.pDeduction ?? (row.attendanceDeductions.excusedP * 0.5)} đ)</p>
                              <p>• Đi muộn: {row.attendanceDeductions.late} lượt (-{row.attendanceDeductions.lateDeduction ?? (row.attendanceDeductions.late * 1)} đ)</p>
                              <p>• Tiết chưa ký: {row.unsignedPeriodDeductions / 2} tiết (-{row.unsignedPeriodDeductions} đ)</p>
                            </div>

                            <div>
                              <h4 className="font-bold text-slate-900 mb-1 flex items-center space-x-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>Khen ngợi & Nhắc nhở</span>
                              </h4>
                              <p>• Điểm cộng biểu dương (+0.5đ/lần): +{row.behaviorDelta.bonus} đ ({row.behaviorDelta.positiveCount} lượt)</p>
                              <p>• Điểm trừ vi phạm: -{row.behaviorDelta.deduction} đ ({row.behaviorDelta.negativeCount} lượt)</p>
                              <p>• Điểm điều chỉnh học tập: {row.academicDelta > 0 ? `+${row.academicDelta}` : row.academicDelta} đ</p>
                            </div>

                            <div>
                              <h4 className="font-bold text-slate-900 mb-1 flex items-center space-x-1">
                                {row.isGoodStudyWeek ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                )}
                                <span>Tiêu chí "Tuần học tốt"</span>
                              </h4>
                              {row.isGoodStudyWeek ? (
                                <p className="text-emerald-700 font-semibold">
                                  ✓ Đạt chuẩn: Điểm ≥ 90, 0 vắng K, không có tiết dưới 8.0.
                                </p>
                              ) : (
                                <ul className="text-amber-800 space-y-0.5">
                                  {(row.goodStudyWeekFailReasons || []).map((r, idx) => (
                                    <li key={idx}>• {r}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredRankings.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Không tìm thấy lớp phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
