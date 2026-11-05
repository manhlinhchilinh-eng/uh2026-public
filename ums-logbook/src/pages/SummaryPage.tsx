/**
 * UMS Digital Class Logbook - Summary & Emulation Page
 * Milestone 5: Full-Featured Weekly & Monthly Summary Workspace
 * Path: src/pages/SummaryPage.tsx
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { Bi } from '../components/common/Bi';
import { ALL_CLASSES } from '../services/seedService';
import { useWeeklySummary } from '../hooks/useWeeklySummary';
import { getMonthlySummary, recalculateMonthlySummaryFromRealData } from '../services/summaryService';
import { MonthlySummary } from '../types/summary';
import { PdfExportButton } from '../components/summary/PdfExportButton';
import { getAwardLevelMeta, determineAwardLevel } from '../utils/emulation';
import { currentAcademic, localToday } from '../utils/academicCalendar';
import {
  FileText,
  Calendar,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Save,
  Layers,
  Sparkles,
} from 'lucide-react';

export const SummaryPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode: 'weekly' or 'monthly'
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');

  // Selected Class & Week/Month (mặc định theo ngày hiện tại, không ghi cứng)
  const todayIso = localToday();
  const [todayY, todayM] = todayIso.split('-').map(Number);
  const initialClass =
    searchParams.get('classId') || profile?.assignedClassId || '6A1';
  const initialWeek = Number(searchParams.get('week')) || currentAcademic(todayIso).weekNumber;
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClass);
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek);
  const [selectedMonth, setSelectedMonth] = useState<number>(todayM || 10);
  const [selectedYear, setSelectedYear] = useState<number>(todayY || 2026);

  // Hook for Weekly Summary
  const {
    summary,
    isLoading,
    isSaving,
    recalculate,
    saveGvcnNote,
  } = useWeeklySummary(selectedClassId, selectedWeek);

  // GVCN Note draft state
  const [gvcnNoteDraft, setGvcnNoteDraft] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Monthly summary state
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState<boolean>(false);

  useEffect(() => {
    if (summary) {
      setGvcnNoteDraft(summary.gvcnWeeklyNote || summary.gvcnComments || '');
    }
  }, [summary]);

  // Keep URL parameters in sync
  useEffect(() => {
    setSearchParams({ classId: selectedClassId, week: String(selectedWeek) }, { replace: true });
  }, [selectedClassId, selectedWeek, setSearchParams]);

  const loadAndRecalculateMonthly = React.useCallback(async () => {
    setIsLoadingMonthly(true);
    try {
      const stored = await getMonthlySummary(selectedClassId, selectedMonth, selectedYear);
      if (stored) setMonthlySummary(stored);
      const fresh = await recalculateMonthlySummaryFromRealData(
        selectedClassId,
        selectedMonth,
        selectedYear,
        currentAcademic().academicYear
      );
      setMonthlySummary(fresh);
    } catch {
      // Fallback
    } finally {
      setIsLoadingMonthly(false);
    }
  }, [selectedClassId, selectedMonth, selectedYear]);

  // Fetch & recalculate monthly summary from real logbooks when monthly tab is active
  useEffect(() => {
    if (activeTab === 'monthly') {
      loadAndRecalculateMonthly();
    }
  }, [activeTab, loadAndRecalculateMonthly]);


  const handleSaveNote = async () => {
    const success = await saveGvcnNote(gvcnNoteDraft);
    if (success) {
      setSaveSuccessMsg('Đã lưu nhận xét GVCN thành công!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  const isGvcn = activeRole === 'gvcn' || (profile?.assignedClassId === selectedClassId);
  const isAdminOrBgh = activeRole === 'admin' || activeRole === 'tpt';
  const canEditGvcnNote = isGvcn || isAdminOrBgh;

  // Emulation & Award metadata
  const emulationScore = summary?.emulationScore ?? 100;
  const isGoodWeek =
    emulationScore >= 90 &&
    (summary?.attendanceStats.totalUnexcused || 0) === 0 &&
    (summary?.unsignedPeriods.filter((p) => !p.notStarted).length || 0) === 0;
  const awardLevel = determineAwardLevel(emulationScore, isGoodWeek);
  const awardMeta = getAwardLevelMeta(awardLevel);

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-wide flex items-center space-x-2">
              <Bi vi="Tổng Kết & Thi Đua Tuần" en="Weekly Summary & Class Ranking" layout="inline" />
              <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-100 text-indigo-800 rounded-full">
                Lớp {selectedClassId}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tổng hợp nề nếp, chuyên cần, xếp hạng thi đua và xuất sổ đầu bài A4
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Picker */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Chọn lớp"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              {ALL_CLASSES.map((c) => (
                <option key={c} value={c}>
                  Lớp {c}
                </option>
              ))}
            </select>
          </div>

          {/* Week Picker */}
          {activeTab === 'weekly' && (
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Chọn tuần"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 35 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Tuần {w}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recalculate Button */}
          <button
            type="button"
            onClick={() => (activeTab === 'weekly' ? recalculate() : loadAndRecalculateMonthly())}
            disabled={activeTab === 'weekly' ? isLoading : isLoadingMonthly}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Tính toán lại từ sổ đầu bài thật"
          >
            <RotateCcw className={`w-4 h-4 ${(activeTab === 'weekly' ? isLoading : isLoadingMonthly) ? 'animate-spin' : ''}`} />
          </button>


          {/* Embedded PDF Export Button */}
          <PdfExportButton
            classId={selectedClassId}
            weekNumber={selectedWeek}
            label={t.common.exportPdf || 'In Sổ Đầu Bài (A4)'}
          />
        </div>
      </div>

      {/* Tabs: Weekly vs Monthly */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          type="button"
          data-testid="tab-weekly"
          onClick={() => setActiveTab('weekly')}
          className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'weekly'
              ? 'border-ums-700 text-ums-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bi vi={`Tổng Kết Tuần ${selectedWeek}`} en={`Week ${selectedWeek} Summary`} layout="inline" />
        </button>
        <button
          type="button"
          data-testid="tab-monthly"
          onClick={() => setActiveTab('monthly')}
          className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'monthly'
              ? 'border-ums-700 text-ums-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bi vi={`Tổng Kết Tháng (${selectedMonth}/${selectedYear})`} en={`Monthly Summary (${selectedMonth}/${selectedYear})`} layout="inline" />
        </button>
      </div>

      {/* ================= WEEKLY SUMMARY CONTENT ================= */}
      {activeTab === 'weekly' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Emulation & Rank */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Bi vi="Thi đua & Xếp hạng" en="Ranking Score & Rank" />
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${awardMeta.badgeBg} ${awardMeta.badgeText} ${awardMeta.badgeBorder}`}
                >
                  {awardMeta.labelVi}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-black text-slate-900">{emulationScore}</span>
                  <span className="text-xs text-slate-400 font-semibold">/105 đ</span>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-amber-700 font-bold">
                    {summary?.rank ? `Hạng ${summary.rank}/26 toàn trường` : 'Chưa xếp hạng'}
                  </span>
                  {isGoodWeek && (
                    <span className="inline-flex items-center space-x-0.5 text-[10px] text-emerald-600 font-bold">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Tuần học tốt</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Attendance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Bi vi="Chuyên cần cả tuần" en="Weekly Attendance" />
              </span>
              <div className="grid grid-cols-3 gap-2 text-center mt-3">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold">Vắng P</span>
                  <span className="text-base font-bold text-slate-800">
                    {summary?.attendanceStats.totalExcused ?? 0}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold">Vắng K</span>
                  <span
                    className={`text-base font-bold ${
                      (summary?.attendanceStats.totalUnexcused || 0) > 0
                        ? 'text-rose-600'
                        : 'text-slate-800'
                    }`}
                  >
                    {summary?.attendanceStats.totalUnexcused ?? 0}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold">Đi muộn</span>
                  <span className="text-base font-bold text-amber-600">
                    {summary?.attendanceStats.totalLate ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Signing Progress */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Bi vi="Ký duyệt sổ đầu bài" en="Logbook Signing" />
              </span>
              <div className="mt-3">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-2xl font-black text-slate-900">
                    {summary?.totalPeriodsSigned ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    / {summary?.totalPeriodsExpected ?? 40} tiết
                  </span>
                </div>
                <div className="mt-1 text-xs">
                  {(summary?.unsignedPeriods.length || 0) > 0 ? (
                    <span className="text-rose-600 font-bold flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{summary?.unsignedPeriods.length} tiết chưa ký</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Đầy đủ 100% chữ ký</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Criteria Averages */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Bi vi="Điểm trung bình tiết" en="Period Score Average" />
              </span>
              <div className="mt-3">
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-indigo-700">
                    {summary?.criteriaAverages.totalAverage?.toFixed(2) ?? '0.00'}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">/10 đ</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  HT: {summary?.criteriaAverages.learning.toFixed(1)} • KL:{' '}
                  {summary?.criteriaAverages.discipline.toFixed(1)} • VS:{' '}
                  {summary?.criteriaAverages.hygiene.toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          {/* Unsigned Periods Alert List (if any) */}
          {(summary?.unsignedPeriods.length || 0) > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-rose-900 shadow-xs">
              <div className="flex items-center space-x-2 font-bold text-sm mb-2 text-rose-800">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>Cảnh báo: Danh sách tiết dạy chưa ký sổ đầu bài ({summary?.unsignedPeriods.length} tiết)</span>
              </div>
              <p className="text-xs text-rose-700 mb-3">
                Mỗi tiết đã mở nhưng chưa ký bị trừ 2.0 điểm thi đua của lớp theo quy chế. Tiết "Chưa mở" (có trên TKB, GV chưa ghi gì) chỉ cảnh báo.
                {(() => {
                  const n = summary?.unsignedPeriods.filter((p) => p.notStarted).length || 0;
                  return n > 0 ? ` (${n} tiết chưa mở)` : '';
                })()}
              </p>
              <div className="overflow-x-auto bg-white rounded-xl border border-rose-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-100/50 text-rose-900 font-bold border-b border-rose-200">
                    <tr>
                      <th className="py-2.5 px-3">Ngày</th>
                      <th className="py-2.5 px-3 text-center">Tiết</th>
                      <th className="py-2.5 px-3">Môn học</th>
                      <th className="py-2.5 px-3">Giáo viên phụ trách</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 text-slate-700">
                    {summary?.unsignedPeriods.map((up, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/50">
                        <td className="py-2 px-3 font-medium">{up.date}</td>
                        <td className="py-2 px-3 text-center font-bold">Tiết {up.periodIndex}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{up.subject}</td>
                        <td className="py-2 px-3 text-rose-700 font-medium">
                          {up.teacherName}
                          {up.notStarted && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">Chưa mở</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Teacher Remarks Summary */}
          {summary?.teacherRemarksSummary && summary.teacherRemarksSummary.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Tổng hợp nhận xét của giáo viên bộ môn trong tuần</span>
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {summary.teacherRemarksSummary.map((remark, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 italic"
                  >
                    {remark}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GVCN Weekly Note Editor */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-ums-700" />
                <span>Ý kiến & Nhận xét của Giáo viên chủ nhiệm tuần {selectedWeek}</span>
              </h3>
              {saveSuccessMsg && (
                <span className="text-xs text-emerald-600 font-bold animate-fade-in">
                  ✓ {saveSuccessMsg}
                </span>
              )}
            </div>

            <textarea
              aria-label="Nhận xét của GVCN"
              value={gvcnNoteDraft}
              onChange={(e) => setGvcnNoteDraft(e.target.value)}
              disabled={!canEditGvcnNote || isSaving}
              placeholder={
                canEditGvcnNote
                  ? 'Nhập đánh giá nề nếp, biểu dương học sinh hoặc các lưu ý trong tuần...'
                  : 'Chỉ GVCN lớp hoặc Ban Giám Hiệu mới có quyền chỉnh sửa nhận xét tuần.'
              }
              rows={4}
              className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ums-500 focus:bg-white resize-none"
            />

            {canEditGvcnNote && (
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={isSaving}
                  className="px-4 py-2 bg-ums-700 hover:bg-ums-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow transition"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? (
                    <span>Đang lưu...</span>
                  ) : (
                    <Bi vi="Lưu nhận xét GVCN" en="Save Homeroom Note" layout="inline" secondaryClassName="text-white/80 opacity-85" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MONTHLY SUMMARY CONTENT ================= */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tổng Kết Tháng {selectedMonth} / {selectedYear} • Lớp {selectedClassId}
              </h3>
              <p className="text-xs text-slate-500">
                Tổng hợp các tuần học trong tháng ({monthlySummary?.weekNumbers.map((w) => `Tuần ${w}`).join(', ') || 'Đang tính toán'})
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500">Tháng:</span>
              <select
                aria-label="Chọn tháng"
                value={selectedMonth}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setSelectedMonth(m);
                  const [y1, y2] = currentAcademic().academicYear.split('-').map(Number);
                  if (y1 && y2) setSelectedYear(m >= 8 ? y1 : y2);
                }}
                className="bg-slate-100 font-bold text-slate-800 p-1.5 rounded-lg border border-slate-200"
              >
                {[9, 10, 11, 12, 1, 2, 3, 4, 5].map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {isLoadingMonthly ? (
            <div className="p-8 text-center text-xs text-slate-400">Đang tổng hợp dữ liệu tháng...</div>
          ) : monthlySummary ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  <Bi vi="Điểm thi đua TB tháng" en="Monthly Avg Ranking Score" />
                </span>
                <p className="text-3xl font-black text-slate-900 mt-2">
                  {monthlySummary.emulationScoreAvg} <span className="text-xs text-slate-400">/105</span>
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  <Bi vi="Tổng số tiết đã dạy & ký" en="Total Signed Periods" />
                </span>
                <p className="text-3xl font-black text-indigo-700 mt-2">
                  {monthlySummary.totalPeriodsSigned} <span className="text-xs text-slate-400">tiết</span>
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  <Bi vi="Tổng lượt vắng (P + K)" en="Total Absences (P + K)" />
                </span>
                <p className="text-3xl font-black text-amber-600 mt-2">
                  {monthlySummary.attendanceTotals.totalExcused + monthlySummary.attendanceTotals.totalUnexcused} <span className="text-xs text-slate-400">lượt</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">Chưa có dữ liệu tổng kết tháng.</div>
          )}
        </div>
      )}
    </div>
  );
};
