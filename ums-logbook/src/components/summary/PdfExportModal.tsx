/**
 * UMS Digital Class Logbook - MOET PDF Export & Print Modal Dialog
 * Milestone 5: Full-featured Print Preview, Zoom Controls & jsPDF Downloader
 * Path: src/components/summary/PdfExportModal.tsx
 */

import React, { useState, useMemo, useEffect } from 'react';
import { fetchClassWeekData } from '../../services/summaryService';
import { ALL_CLASSES, generateSeedDataset } from '../../services/seedService';
import { useWeeklySummary } from '../../hooks/useWeeklySummary';
import { useGvcnName } from '../../hooks/useGvcnName';
import {
  WeeklyLogbookPdfData,
  getWeekDates,
  triggerBrowserPrint,
  exportWeeklyLogbookPdf,
  applyDefault10ToPrint, mergePrintPeriods,
} from '../../utils/pdfGenerator';
import { LogbookPdfView } from './LogbookPdfView';
import { PeriodEntry } from '../../types/logbook';
import {
  Printer,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar,
  Layers,
} from 'lucide-react';

export interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClassId?: string;
  initialWeekNumber?: number;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  initialClassId = '6A1',
  initialWeekNumber = 5,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeekNumber);
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 75, 100, 125
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const { summary } = useWeeklySummary(selectedClassId, selectedWeek);
  const realGvcnName = useGvcnName(selectedClassId);

  // Metadata for class and GVCN
  const classMeta = useMemo(() => {
    const { classes } = generateSeedDataset();
    return classes.find((c) => c.id === selectedClassId);
  }, [selectedClassId]);

  // Tiết đã ký THẬT trên Firestore cho 5 ngày của tuần (đọc 1 lần khi đổi lớp/tuần, tối đa ~5 sổ + 40 tiết)
  const [remotePeriods, setRemotePeriods] = useState<Record<string, PeriodEntry[]>>({});
  const [remoteLoading, setRemoteLoading] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    const dates = getWeekDates(selectedWeek, '2026-09-07').days.map((d) => d.isoDate);
    setRemoteLoading(true);
    fetchClassWeekData(selectedClassId, dates)
      .then((r) => alive && setRemotePeriods(r?.periodsByDailyId || {}))
      .catch(() => alive && setRemotePeriods({}))
      .finally(() => alive && setRemoteLoading(false));
    return () => {
      alive = false;
    };
  }, [isOpen, selectedClassId, selectedWeek]);

  // Construct PDF Data
  const pdfData: WeeklyLogbookPdfData = useMemo(() => {
    const weekRange = getWeekDates(selectedWeek, '2026-09-07');

    // Gather periods from localStorage for each day
    const daysData = weekRange.days.map((d) => {
      const dailyId = `${selectedClassId}_${d.isoDate}`;
      let periods: PeriodEntry[] = [];
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(`ums_period_entries_${dailyId}`);
          if (raw) periods = JSON.parse(raw);
        } catch {}
      }
      return {
        dayOfWeek: d.dayOfWeek,
        dayNameVi: d.dayNameVi,
        date: d.date,
        isoDate: d.isoDate,
        periods: applyDefault10ToPrint(
          mergePrintPeriods(periods, remotePeriods[dailyId]),
          (summary?.defaultScoredPeriods || []).filter((x) => x.date === d.isoDate)
        ),
      };
    });

    const studentCount = classMeta?.studentCount || 26;
    const gvcnName = realGvcnName || `GVCN ${selectedClassId}`;

    return {
      schoolName: 'TRƯỜNG THCS NGOẠI NGỮ - ULIS',
      districtName: 'UBND QUẬN CẦU GIẤY',
      academicYear: '2026 - 2027',
      classId: selectedClassId,
      gvcnName,
      totalStudents: studentCount,
      weekNumber: selectedWeek,
      startDate: weekRange.startDate,
      endDate: weekRange.endDate,
      days: daysData,
      summary: summary
        ? {
            totalPeriodsExpected: summary.totalPeriodsExpected,
            totalPeriodsTaught: summary.totalPeriodsTaught,
            totalPeriodsSigned: summary.totalPeriodsSigned,
            unsignedPeriodsCount: summary.unsignedPeriods.length,
            default10Count: summary.defaultScoredPeriods?.length || 0,
            unsignedSubjects: summary.unsignedPeriods.map((p) => p.subject),
            attendanceStats: {
              totalAbsences:
                summary.attendanceStats.totalExcused + summary.attendanceStats.totalUnexcused,
              excusedP: summary.attendanceStats.totalExcused,
              unexcusedK: summary.attendanceStats.totalUnexcused,
              late: summary.attendanceStats.totalLate,
              earlyDepartures: summary.attendanceStats.totalEarlyDepartures,
            },
            criteriaAverage: {
              learningAvg: summary.criteriaAverages.learning,
              disciplineAvg: summary.criteriaAverages.discipline,
              hygieneAvg: summary.criteriaAverages.hygiene,
              customAvg: summary.criteriaAverages.customCriterion,
              totalWeeklyScore: summary.criteriaAverages.totalAverage,
            },
            emulationScore: summary.emulationScore,
            emulationStatus:
              (summary.emulationScore || 100) >= 90
                ? 'good'
                : (summary.emulationScore || 100) >= 80
                ? 'standard'
                : 'warning',
            emulationStatusLabel:
              (summary.emulationScore || 100) >= 95
                ? 'Xuất sắc'
                : (summary.emulationScore || 100) >= 90
                ? 'Tuần học tốt'
                : (summary.emulationScore || 100) >= 80
                ? 'Khá'
                : 'Cần cố gắng',
            rank: summary.rank,
            gvcnComments: summary.gvcnWeeklyNote || summary.gvcnComments,
            bghComments: summary.bghComments,
          }
        : undefined,
    };
  }, [selectedClassId, selectedWeek, classMeta, summary, realGvcnName, remotePeriods]);

  if (!isOpen) return null;

  const handlePrint = () => {
    triggerBrowserPrint();
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportWeeklyLogbookPdf(pdfData);
    } catch (err) {
      console.error('Error generating PDF', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const zoomScale = zoomLevel / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs pdf-modal-backdrop overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[95vh] flex flex-col pdf-modal-sheet overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 no-print">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-ums-700 rounded-xl text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Xem Trước & Xuất Sổ Đầu Bài A4 Ngang
              </h2>
              <p className="text-[11px] text-slate-300">
                Chuẩn Bộ Giáo dục và Đào tạo • Trường THCS Ngoại ngữ
              </p>
            </div>
          </div>

          {/* Selectors & Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Class Picker */}
            <div className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
              <Layers className="w-3.5 h-3.5 text-ums-300" />
              <select
                aria-label="Chọn lớp học"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                {ALL_CLASSES.map((c) => (
                  <option key={c} value={c} className="bg-slate-800 text-white">
                    Lớp {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Week Picker */}
            <div className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-ums-300" />
              <select
                aria-label="Chọn tuần học"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 35 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w} className="bg-slate-800 text-white">
                    Tuần {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[11px] font-mono text-slate-300 w-10 text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 25))}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition"
                title="Đặt lại 100%"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {remoteLoading && (
              <span data-testid="pdf-remote-loading" className="text-[11px] text-amber-300">Đang tải các tiết đã ký…</span>
            )}

            {/* Actions: In A4 & Download PDF */}
            <button
              type="button"
              onClick={handlePrint}
              aria-busy={remoteLoading}
              className="px-3.5 py-1.5 bg-ums-600 hover:bg-ums-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow transition"
            >
              <Printer className="w-4 h-4" />
              <span>In Sổ Đầu Bài (A4)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf || remoteLoading}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Đang xuất...' : 'Tải PDF'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-200/80 flex justify-center">
          <div
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="shadow-xl rounded-md bg-white w-full max-w-[1122px]"
          >
            <LogbookPdfView data={pdfData} />
          </div>
        </div>
      </div>
    </div>
  );
};
