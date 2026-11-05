/**
 * Vắng/muộn hôm nay — giám thị, BGH, TPT nắm sĩ số toàn trường theo từng tiết.
 * Dữ liệu từ điểm danh đầu tiết (GV lưu trước khi ký) + điểm danh đầu buổi của GVCN.
 * Đọc 1 lần khi mở / đổi ngày / bấm Làm mới (không giữ kết nối liên tục — xem firestoreGuard).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, UserX, Clock, LogOut, CheckCircle2 } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { ALL_CLASSES } from '../services/logbookService';
import { fetchSchoolAttendanceCached, type SchoolAttendanceData } from '../services/schoolAttendanceService';
import { getCurrentPeriodIndex } from '../components/logbook/DailyLogbookGrid';
import { boardTotals, buildAttendanceBoard, formatClock, periodCellLabel } from '../utils/periodAttendance';
import { describeDay } from '../utils/studentDaily';
import { formatDateVi } from '../utils/dateFormat';

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export const SchoolAttendancePage: React.FC = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<SchoolAttendanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSchoolAttendanceCached(date, { force });
      setData(res);
      setLoadedAt(res.loadedAt);
    } catch (e: any) {
      setError(e?.message || 'Không tải được dữ liệu điểm danh');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load(false);
  }, [load]);

  const currentPeriod = getCurrentPeriodIndex(date);
  const rows = useMemo(
    () => (data ? buildAttendanceBoard(ALL_CLASSES, data.logbooks, data.students) : []),
    [data]
  );
  const totals = useMemo(() => boardTotals(rows, currentPeriod), [rows, currentPeriod]);

  const openLogbook = (classId: string, period?: number) =>
    navigate(`/logbook?classId=${encodeURIComponent(classId)}&date=${date}${period ? `&period=${period}` : ''}`);

  return (
    <div className="space-y-4" data-testid="school-attendance-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            <Bi vi="Vắng/muộn hôm nay" en="Today's Absences" />
          </h1>
          <p className="text-xs text-slate-500">
            Điểm danh đầu tiết của GV bộ môn + điểm danh đầu buổi của GVCN • {formatDateVi(date)}
            {loadedAt ? ` • cập nhật ${formatClock(loadedAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Chọn ngày"
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
          />
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            data-testid="board-refresh"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#8B1A4A] hover:bg-[#72153c] disabled:bg-slate-300 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}
      {data?.truncated && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          Dữ liệu nhiều hơn giới hạn đọc một lần — có thể thiếu một số học sinh.
        </div>
      )}

      {/* Tổng hợp */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="board-totals">
        {currentPeriod && (
          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã điểm danh tiết {currentPeriod}
            </p>
            <p className="text-lg font-bold text-slate-900">
              {totals.checkedForPeriod}/{totals.classes} lớp
            </p>
          </div>
        )}
        <div className="p-3 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <UserX className="w-3.5 h-3.5 text-rose-600" /> HS vắng
          </p>
          <p className="text-lg font-bold text-rose-700">
            {totals.absentP + totals.absentK}{' '}
            <span className="text-xs font-semibold">({totals.absentP}P, {totals.absentK}K)</span>
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> HS đi muộn
          </p>
          <p className="text-lg font-bold text-amber-700">{totals.late}</p>
        </div>
        <div className="p-3 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5 text-sky-600" /> HS về sớm
          </p>
          <p className="text-lg font-bold text-sky-700">{totals.early}</p>
        </div>
      </div>

      {/* Màn hẹp: danh sách HS trước (cột tên trong bảng phải cuộn ngang mới thấy) */}
      {rows.some((r) => r.students.length > 0) && (
        <ul className="sm:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs" data-testid="board-mobile-list">
          {rows
            .filter((r) => r.students.length > 0)
            .flatMap((r) =>
              r.students.map((s) => (
                <li key={s.mhs} className="px-3 py-2">
                  <button type="button" onClick={() => openLogbook(r.classId)} className="font-bold text-[#8B1A4A] mr-1">
                    {r.classId}
                  </button>
                  <strong>{s.studentName}</strong>: {describeDay(s)}
                </li>
              ))
            )}
        </ul>
      )}

      {/* Bảng theo lớp × tiết */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs" data-testid="board-table">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-2 text-left font-bold sticky left-0 bg-slate-50">Lớp</th>
              <th className="px-1.5 py-2 font-semibold" title="GVCN điểm danh đầu buổi sáng / chiều">Đầu buổi</th>
              {PERIODS.map((p) => (
                <th key={p} className={`px-1.5 py-2 font-semibold ${currentPeriod === p ? 'bg-pink-100 text-[#8B1A4A]' : ''}`}>
                  T{p}
                </th>
              ))}
              <th className="px-2 py-2 text-left font-semibold min-w-[220px]">Học sinh vắng / muộn / về sớm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.classId} className="border-t border-slate-100 align-top" data-testid={`board-row-${r.classId}`}>
                <td className="px-2 py-1.5 font-bold sticky left-0 bg-white">
                  <button type="button" onClick={() => openLogbook(r.classId)} className="text-[#8B1A4A] hover:underline">
                    {r.classId}
                  </button>
                </td>
                <td className="px-1.5 py-1.5 text-center whitespace-nowrap text-[11px]">
                  <span title="Sáng" className={r.morningChecked ? 'text-emerald-700 font-bold' : 'text-slate-300'}>S{r.morningChecked ? '✓' : '–'}</span>{' '}
                  <span title="Chiều" className={r.afternoonChecked ? 'text-emerald-700 font-bold' : 'text-slate-300'}>C{r.afternoonChecked ? '✓' : '–'}</span>
                </td>
                {r.periods.map((s, i) => (
                  <td key={i} className={`px-1 py-1.5 text-center ${currentPeriod === i + 1 ? 'bg-pink-50/60' : ''}`}>
                    {s ? (
                      <button
                        type="button"
                        onClick={() => openLogbook(r.classId, i + 1)}
                        title={`${s.subject || 'Tiết ' + (i + 1)} • ${s.byName} • ${formatClock(s.at)}${s.signed ? ' • đã ký' : ' • chưa ký'}`}
                        data-testid={`board-cell-${r.classId}-${i + 1}`}
                        className={`px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap ${
                          s.absentP + s.absentK + s.late + s.early > 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {periodCellLabel(s)}
                        {s.signed ? '' : '*'}
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-[11px] text-slate-700">
                  {r.students.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {r.students.map((s) => (
                        <li key={s.mhs}>
                          <strong>{s.studentName}</strong>: {describeDay(s)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        Ô tiết: <strong>V</strong> vắng, <strong>M</strong> muộn, <strong>S</strong> về sớm, <strong>Đủ</strong> đủ sĩ số;{' '}
        <strong>*</strong> đã điểm danh, GV chưa ký sổ; <strong>—</strong> chưa điểm danh. Bấm ô để mở sổ tiết đó.
      </p>
    </div>
  );
};

export default SchoolAttendancePage;
