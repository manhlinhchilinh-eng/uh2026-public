/**
 * UMS SmartConnect - Dashboard Ban Giám hiệu
 * Toàn bộ số liệu tính từ dữ liệu THẬT (Sổ đầu bài, nề nếp, xin nghỉ). Chưa có dữ liệu → ghi "chưa có dữ liệu".
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Info, RefreshCw } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { resyncAllStudentDaily } from '../services/studentDailyService';
import type { LeaveRequest } from '../types/leave';
import { computeDashboard, dashboardCsv, pct, quickRanges, type DashboardStats } from '../utils/dashboard';
import { fetchDashboardInput } from '../services/dashboardService';
import { fetchAllLeaveRequests, fetchLeavePolicy } from '../services/leaveService';
import { localToday } from './LeavePage';

// Màu chuỗi duy nhất (đỏ mận UMS, bậc sáng hơn) — đã chạy validator dataviz: PASS độ sáng & tương phản trên nền sáng.
const SERIES = '#A8285F';

type RangeKey = 'week' | 'month' | 'custom';

const Tile: React.FC<{ label: string; labelEn?: string; value: string; sub?: string; testId?: string }> = ({ label, labelEn, value, sub, testId }) => (
  <div data-testid={testId} className="bg-white border border-slate-200 rounded-xl p-3.5">
    <p className="text-[11px] font-semibold text-slate-500">
      {labelEn ? <Bi vi={label} en={labelEn} /> : label}
    </p>
    <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

/** Cột ngang 1 chuỗi: tỉ lệ tiết đã ký theo khối. Có tooltip khi rê chuột/focus. */
const GradeBars: React.FC<{ data: DashboardStats['byGrade'] }> = ({ data }) => {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <figure className="bg-white border border-slate-200 rounded-xl p-4">
      <figcaption className="text-xs font-bold text-slate-800 mb-3">
        <Bi vi="Tỉ lệ tiết đã ký sổ theo khối" en="Signed period rate by grade" layout="inline" />
      </figcaption>
      <div className="space-y-2.5" role="list">
        {data.map((g) => {
          const r = g.signedRate ?? 0;
          return (
            <div
              key={g.grade}
              role="listitem"
              tabIndex={0}
              data-testid={`grade-bar-${g.grade}`}
              onMouseEnter={() => setHover(g.grade)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(g.grade)}
              onBlur={() => setHover(null)}
              className="relative grid grid-cols-[52px_1fr_56px] items-center gap-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[#A8285F]/40 rounded"
            >
              <span className="text-[11px] font-semibold text-slate-700">Khối {g.grade}</span>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-r" style={{ width: `${Math.min(100, r * 100)}%`, background: SERIES }} />
              </div>
              <span className="text-[11px] font-bold text-slate-700 text-right">{pct(g.signedRate)}</span>
              {hover === g.grade && (
                <div role="tooltip" className="absolute left-14 -top-8 z-10 bg-slate-900 text-white text-[11px] rounded-md px-2 py-1 shadow-lg whitespace-nowrap">
                  Khối {g.grade}: {g.signedPeriods}/{g.expectedPeriods} tiết đã ký
                </div>
              )}
            </div>
          );
        })}
      </div>
    </figure>
  );
};

export const BghDashboardPage: React.FC = () => {
  const today = localToday();
  const ranges = useMemo(() => quickRanges(today), [today]);
  const [rangeKey, setRangeKey] = useState<RangeKey>('month');
  const [custom, setCustom] = useState(ranges.month);
  const range = rangeKey === 'custom' ? custom : ranges[rangeKey];

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (range.start > range.end) return;
    setLoading(true);
    setError(null);
    try {
      const policy = await fetchLeavePolicy();
      const [input, lv] = await Promise.all([fetchDashboardInput(range.start, range.end, policy.holidays), fetchAllLeaveRequests()]);
      setStats(computeDashboard(input));
      setLeaves(lv);
    } catch (e) {
      console.error('[BGH Dashboard]', e);
      setError('Không tải được số liệu.');
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  const overlaps = (r: LeaveRequest) => r.status === 'approved' && r.startDate <= range.end && r.endDate >= range.start;
  const teachersOff = new Set(leaves.filter(overlaps).map((r) => r.requesterId)).size;
  const pendingLeaves = leaves.filter((r) => r.status === 'pending').length;
  const missingDocs = leaves.filter((r) => r.requiredDocs?.length > 0 && !r.docsSubmittedAt && r.status === 'approved').length;

  const exportCsv = () => {
    if (!stats) return;
    const blob = new Blob([dashboardCsv(stats, range.start, range.end)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dashboard-bgh-${range.start}_${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const t = stats?.totals;
  const noSigned = stats != null && stats.totals.signedPeriods === 0;
  const sortedClasses = stats ? [...stats.byClass].sort((a, b) => (a.signedRate ?? 0) - (b.signedRate ?? 0) || a.classId.localeCompare(b.classId)) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="p-2 rounded-xl bg-ums-50 text-[#8B1A4A]"><BarChart3 className="w-5 h-5" /></div>
        <div>
          <h2 className="text-base font-bold text-slate-900">
            <Bi vi="Dashboard Ban Giám hiệu" en="Principal Dashboard" layout="inline" />
          </h2>
          <p className="text-xs text-slate-500">Số liệu thật từ Sổ đầu bài, nề nếp và xin nghỉ • {range.start} → {range.end}</p>
        </div>
      </div>

      {/* Bộ lọc: một hàng phía trên số liệu */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {(['week', 'month', 'custom'] as RangeKey[]).map((k) => (
          <button key={k} type="button" onClick={() => setRangeKey(k)} className={`px-3 py-1.5 rounded-full border ${rangeKey === k ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'border-slate-200 text-slate-600'}`}>
            {k === 'week' ? (
              <Bi vi="Tuần này" en="This week" layout="inline" />
            ) : k === 'month' ? (
              <Bi vi="Tháng này" en="This month" layout="inline" />
            ) : (
              <Bi vi="Tùy chọn" en="Custom" layout="inline" />
            )}
          </button>
        ))}
        {rangeKey === 'custom' && (
          <>
            <input type="date" aria-label="Từ ngày" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} className="border border-slate-300 rounded-lg p-1" />
            <input type="date" aria-label="Đến ngày" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} className="border border-slate-300 rounded-lg p-1" />
          </>
        )}
        <button
          type="button"
          onClick={async () => {
            setSyncMsg('Đang đồng bộ…');
            try {
              const r = await resyncAllStudentDaily((d, n) => setSyncMsg(`Đang đồng bộ ${d}/${n} sổ…`), { startDate: range.start, endDate: range.end });
              setSyncMsg(`Đã đồng bộ ${r.logbooks} sổ ngày → ${r.records} bản tin chuyên cần cho Cổng phụ huynh.`);
            } catch (e) {
              console.error(e);
              setSyncMsg('Đồng bộ thất bại.');
            }
          }}
          title="Tạo bản tin chuyên cần cho Cổng phụ huynh từ các sổ đã ghi trước đây"
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300"
        >
          <RefreshCw className="w-3.5 h-3.5" /> <Bi vi="Đồng bộ Cổng PH" en="Sync Parent Portal" layout="inline" />
        </button>
        <button type="button" onClick={exportCsv} disabled={!stats} className=" inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">
          <Download className="w-3.5 h-3.5" /> <Bi vi="Xuất Excel (CSV)" en="Export CSV" layout="inline" />
        </button>
      </div>

      {syncMsg && <p data-testid="sync-msg" className="text-xs text-slate-600">{syncMsg}</p>}
      {loading && <p className="text-sm text-slate-500">Đang tổng hợp số liệu…</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

      {!loading && stats && t && (
        <>
          {noSigned && (
            <p data-testid="no-data-note" className="text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0" /> Chưa có tiết nào được ký sổ trong khoảng này. Số liệu sẽ tự cập nhật khi giáo viên ghi Sổ đầu bài.
            </p>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile testId="tile-signed" label="Tiết đã ký sổ" labelEn="Signed periods" value={pct(t.signedRate)} sub={`${t.signedPeriods}/${t.expectedPeriods} tiết • ${stats.schoolDays} ngày học`} />
            <Tile testId="tile-score" label="Điểm tiết trung bình" labelEn="Avg period score" value={t.avgScore == null ? '—' : `${t.avgScore}/10`} sub={t.avgScore == null ? 'Chưa có dữ liệu' : 'Trên các tiết đã ký'} />
            <Tile testId="tile-attendance" label="Chuyên cần (lượt HS/ngày)" labelEn="Attendance (absences)" value={`${t.absP + t.absK}`} sub={`Vắng P ${t.absP} • Vắng K ${t.absK} • Muộn ${t.late}`} />
            <Tile testId="tile-behavior" label="Nề nếp" labelEn="Conduct" value={`${t.positive} / ${t.negative}`} sub="Khen / Nhắc nhở" />
            <Tile testId="tile-leave-pending" label="Đơn nghỉ chờ duyệt" labelEn="Pending leave" value={String(pendingLeaves)} />
            <Tile testId="tile-teachers-off" label="GV nghỉ trong khoảng" labelEn="Teachers on leave" value={String(teachersOff)} sub="Theo đơn đã duyệt" />
            <Tile testId="tile-docs" label="Giấy tờ nghỉ chưa nộp" labelEn="Missing leave docs" value={String(missingDocs)} sub="Đơn đã duyệt cần chứng từ" />
            <Tile label="Số lớp" labelEn="Total classes" value={String(stats.byClass.length)} />
          </div>

          <GradeBars data={stats.byGrade} />

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-2">
              <Bi vi="Chi tiết theo lớp (lớp ghi sổ ít nhất lên đầu)" en="Class breakdown (lowest signed rate first)" layout="inline" />
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-1.5 pr-2">Lớp</th>
                    <th className="px-1 text-right">Tiết đã ký</th>
                    <th className="px-1 text-right">Tỉ lệ</th>
                    <th className="px-1 text-right">Điểm TB</th>
                    <th className="px-1 text-right">Vắng P</th>
                    <th className="px-1 text-right">Vắng K</th>
                    <th className="px-1 text-right">Muộn</th>
                    <th className="px-1 text-right">Khen</th>
                    <th className="px-1 text-right">Nhắc nhở</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClasses.map((c) => (
                    <tr key={c.classId} data-testid={`class-row-${c.classId}`} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 font-semibold text-slate-800">{c.classId}</td>
                      <td className="px-1 text-right">{c.signedPeriods}/{c.expectedPeriods}</td>
                      <td className="px-1 text-right font-semibold">{pct(c.signedRate)}</td>
                      <td className="px-1 text-right">{c.avgScore ?? '—'}</td>
                      <td className="px-1 text-right">{c.absP}</td>
                      <td className="px-1 text-right">{c.absK}</td>
                      <td className="px-1 text-right">{c.late}</td>
                      <td className="px-1 text-right">{c.positive}</td>
                      <td className="px-1 text-right">{c.negative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
