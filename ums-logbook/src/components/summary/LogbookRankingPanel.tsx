/**
 * Tổng kết điểm sổ đầu bài toàn trường theo tuần / tháng — DỮ LIỆU THẬT từ sổ đầu bài.
 * Cho TPT, BGH, Giám thị xếp hạng thi đua; xuất Excel để gộp với sổ cờ đỏ (chưa có trong hệ thống).
 */

import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Trophy } from 'lucide-react';
import { fetchDashboardInput } from '../../services/dashboardService';
import { fetchSchoolCalendar } from '../../services/schoolCalendarService';
import { computeDashboard, pct } from '../../utils/dashboard';
import { monthOf, rankClasses, weekOf, type RankedClass } from '../../utils/logbookRanking';
import { offDatesBetween } from '../../utils/schoolCalendar';

const today = () => new Date().toISOString().slice(0, 10);
const viDate = (iso: string) => iso.split('-').reverse().join('/');

export const LogbookRankingPanel: React.FC = () => {
  const [kind, setKind] = useState<'week' | 'month'>('week');
  const [weekDate, setWeekDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const range = kind === 'week' ? weekOf(weekDate) : monthOf(month);
  const [rows, setRows] = useState<RankedClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    (async () => {
      const cal = await fetchSchoolCalendar();
      const input = await fetchDashboardInput(range.start, range.end, offDatesBetween(cal, range.start, range.end));
      if (alive) setRows(rankClasses(computeDashboard(input).byClass));
    })().catch((e) => {
      console.error('[Tổng kết sổ đầu bài]', e);
      if (alive) setError('Không tải được dữ liệu sổ đầu bài.');
    });
    return () => {
      alive = false;
    };
  }, [range.start, range.end]);

  const label = kind === 'week' ? `Tuần ${viDate(range.start)} – ${viDate(range.end)}` : `Tháng ${month.split('-').reverse().join('/')}`;

  const exportExcel = () => {
    if (!rows) return;
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        'Hạng (sổ đầu bài)': r.rank ?? '',
        Lớp: r.classId,
        'Tiết đã ký': r.signedPeriods,
        'Tiết dự kiến': r.expectedPeriods,
        'Tỉ lệ ký sổ': pct(r.signedRate),
        'Điểm TB tiết (/10)': r.avgScore ?? '',
        'Vắng P': r.absP,
        'Vắng K': r.absK,
        'Đi muộn': r.late,
        Khen: r.positive,
        'Nhắc nhở': r.negative,
        'Điểm sổ cờ đỏ (TPT nhập)': '',
        'Xếp loại (TPT)': '',
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tong ket');
    XLSX.writeFile(wb, `TongKet_SoDauBai_${range.start}_${range.end}.xlsx`);
  };

  const field = 'px-2 py-1.5 border border-slate-300 rounded-lg text-xs';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3" data-testid="logbook-ranking">
      <div className="flex flex-wrap items-center gap-2">
        <Trophy className="w-5 h-5 text-[#8B1A4A]" />
        <h3 className="text-sm font-bold text-slate-900">Tổng kết điểm sổ đầu bài toàn trường — {label}</h3>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Dữ liệu thật</span>
      </div>
      <p className="text-xs text-slate-500">
        Xếp hạng theo điểm tiết trung bình của các tiết đã ký. Chưa gộp <b>sổ cờ đỏ</b> (chưa có trong hệ thống) — xuất Excel để TPT nhập điểm cờ đỏ và xếp loại.
      </p>
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'week' | 'month')} className={field} aria-label="Theo tuần hoặc tháng">
          <option value="week">Theo tuần</option>
          <option value="month">Theo tháng</option>
        </select>
        {kind === 'week' ? (
          <label className="flex items-center gap-1.5">
            Ngày bất kỳ trong tuần
            <input type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} className={field} />
          </label>
        ) : (
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} aria-label="Tháng" />
        )}
        <button
          type="button"
          onClick={exportExcel}
          disabled={!rows?.length}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold bg-[#8B1A4A] text-white hover:bg-[#6B1338] disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!rows && !error && <p className="text-sm text-slate-500">Đang tổng hợp sổ đầu bài 26 lớp…</p>}
      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[680px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left">Hạng</th>
                <th className="p-2 text-left">Lớp</th>
                <th className="p-2 text-center">Tiết đã ký</th>
                <th className="p-2 text-center">Điểm TB tiết</th>
                <th className="p-2 text-center">Vắng P/K</th>
                <th className="p-2 text-center">Muộn</th>
                <th className="p-2 text-center">Khen/Nhắc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.classId} data-testid="ranking-row">
                  <td className="p-2 font-bold text-slate-900">{r.rank ?? '—'}</td>
                  <td className="p-2 font-semibold">{r.classId}</td>
                  <td className="p-2 text-center">
                    {r.signedPeriods}/{r.expectedPeriods} <span className="text-slate-400">({pct(r.signedRate)})</span>
                  </td>
                  <td className="p-2 text-center font-bold text-[#8B1A4A]">{r.avgScore ?? 'chưa có'}</td>
                  <td className="p-2 text-center">
                    {r.absP}/{r.absK}
                  </td>
                  <td className="p-2 text-center">{r.late}</td>
                  <td className="p-2 text-center">
                    <span className="text-emerald-700">{r.positive}</span>/<span className="text-amber-700">{r.negative}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
