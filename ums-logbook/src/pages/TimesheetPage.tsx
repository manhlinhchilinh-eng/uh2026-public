/**
 * UMS SmartConnect - Bảng chấm công đối soát
 * [UMS] Bảng công gửi ngày 01–05; GV phản hồi trong 03 ngày làm việc; quá hạn → mặc nhiên xác nhận.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Download, Send, Lock, Timer } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';
import { Bi } from '../components/common/Bi';
import type { TimesheetPeriod, TimesheetRecord, TimesheetRecordStatus } from '../types/timesheet';
import {
  LEAVE_CODE,
  RECORD_STATUS_LABEL,
  effectiveStatus,
  finalWorkedDays,
  isValidPeriod,
  previousPeriod,
  timesheetCsv,
  timesheetDetail,
  type TimesheetDetail,
  workingDaysLeft,
} from '../utils/timesheet';
import {
  closePeriod,
  fetchMyRecord,
  fetchPeriods,
  fetchRecords,
  publishTimesheet,
  resolveDispute,
  respondToRecord,
} from '../services/timesheetService';
import { fetchMyLeaveRequests } from '../services/leaveService';
import { fetchPeriodsByTeacher } from '../services/teacherPortfolioService';
import { LEAVE_TYPE_LABEL } from '../utils/leavePolicy';
import type { LeaveRequest } from '../types/leave';
import type { SignedPeriodLite } from '../utils/teacherPortfolio';
import { fetchAllLeaveRequests, fetchLeavePolicy } from '../services/leaveService';
import { fetchStaffDirectory } from '../services/announcementService';
import { localToday } from './LeavePage';
import type { LeaveType } from '../types/leave';

const STATUS_CLS: Record<TimesheetRecordStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  disputed: 'bg-red-50 text-red-800 border-red-200',
  resolved: 'bg-sky-50 text-sky-800 border-sky-200',
  auto_confirmed: 'bg-slate-50 text-slate-600 border-slate-200',
};
const LEAVE_ORDER: LeaveType[] = ['annual', 'sick_self', 'sick_child', 'maternity', 'unpaid'];

const Badge: React.FC<{ s: TimesheetRecordStatus }> = ({ s }) => (
  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_CLS[s]}`}>{RECORD_STATUS_LABEL[s]}</span>
);

const Breakdown: React.FC<{ r: TimesheetRecord }> = ({ r }) => (
  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center text-[11px]">
    <div className="rounded-lg bg-slate-50 p-1.5"><p className="text-slate-500">Công chuẩn</p><p className="font-bold">{r.standardDays}</p></div>
    {LEAVE_ORDER.map((t) => (
      <div key={t} className="rounded-lg bg-slate-50 p-1.5"><p className="text-slate-500">{LEAVE_CODE[t]}</p><p className="font-bold">{r.leave[t]}</p></div>
    ))}
    <div className="rounded-lg bg-ums-50 p-1.5 col-span-2"><p className="text-[#8B1A4A]">Ngày làm thực tế</p><p className="font-black text-[#8B1A4A]">{finalWorkedDays(r)}</p></div>
  </div>
);

/** Chi tiết ngày nghỉ + số tiết đã ký trong kỳ — chỉ tải khi bấm (tránh đọc nặng khi mở trang). */
const DetailBox: React.FC<{ detail: TimesheetDetail; showPeriods: boolean }> = ({ detail, showPeriods }) => (
  <div data-testid="ts-detail" className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
    <p className="font-bold text-slate-700">Ngày nghỉ đã duyệt trong kỳ</p>
    {detail.leaves.length === 0 ? (
      <p className="text-slate-500">Không có.</p>
    ) : (
      <ul className="list-disc ml-4 text-slate-700">
        {detail.leaves.map((l) => (
          <li key={l.id}>
            {l.from === l.to ? l.from : `${l.from} → ${l.to}`} • {LEAVE_TYPE_LABEL[l.type]} ({LEAVE_CODE[l.type]}) • {l.days} ngày làm việc
          </li>
        ))}
      </ul>
    )}
    {showPeriods && (
      <p className="text-slate-700">
        <b>Số tiết đã ký sổ đầu bài:</b> {detail.signedPeriods}
        {detail.byClass.length > 0 && ` (${detail.byClass.map((c) => `${c.classId}: ${c.count}`).join(', ')})`}
      </p>
    )}
  </div>
);

export const TimesheetPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const isAdmin = activeRole === 'admin';
  const today = localToday();
  const [periods, setPeriods] = useState<TimesheetPeriod[]>([]);
  const [mine, setMine] = useState<Record<string, TimesheetRecord | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Nguồn chi tiết: tải 1 lần khi người dùng bấm "Xem chi tiết"
  const [detailSrc, setDetailSrc] = useState<{ leaves: LeaveRequest[]; periods: SignedPeriodLite[]; holidays: string[] } | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const teaches = activeRole === 'gvcn' || activeRole === 'gvbm' || activeRole === 'admin';
  const toggleDetail = async (period: string) => {
    const next = !openDetail[period];
    setOpenDetail((o) => ({ ...o, [period]: next }));
    if (!next || detailSrc || !profile) return;
    setDetailLoading(true);
    try {
      const [leaves, periods, policy] = await Promise.all([
        fetchMyLeaveRequests(profile.uid),
        teaches ? fetchPeriodsByTeacher(profile.username) : Promise.resolve([] as SignedPeriodLite[]),
        fetchLeavePolicy(),
      ]);
      setDetailSrc({ leaves, periods, holidays: policy.holidays || [] });
    } catch (e) {
      console.error('[Timesheet] detail', e);
      showToast('Không tải được chi tiết.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      const ps = await fetchPeriods();
      setPeriods(ps);
      const entries = await Promise.all(ps.map(async (p) => [p.period, await fetchMyRecord(p.period, profile.uid)] as const));
      setMine(Object.fromEntries(entries));
    } catch (e) {
      console.error('[Timesheet] load', e);
      setError('Không tải được bảng công.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-ums-50 text-[#8B1A4A]"><ClipboardCheck className="w-5 h-5" /></div>
        <div>
          <h2 className="text-base font-bold text-slate-900">
            <Bi vi="Bảng chấm công đối soát" en="Monthly Timesheet Reconciliation" />
          </h2>
          <p className="text-xs text-slate-500">
            <Bi vi="Kiểm tra và phản hồi trong 03 ngày làm việc — quá hạn sẽ mặc nhiên xác nhận" en="Review within 03 business days — auto-confirmed after deadline" />
          </p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Đang tải…</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
      {!loading && periods.length === 0 && <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">Chưa có kỳ công nào được phát hành.</p>}

      {periods.map((p) => {
        const r = mine[p.period];
        if (!r) return null;
        const s = effectiveStatus(r, today, p.reviewDeadline);
        const left = workingDaysLeft(today, p.reviewDeadline);
        const canRespond = s === 'pending' && p.status === 'open';
        return (
          <section key={p.period} data-testid={`my-ts-${p.period}`} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">Kỳ công {p.period}</h3>
              <Badge s={s} />
              {canRespond && (
                <span data-testid={`ts-countdown-${p.period}`} className={`ml-auto inline-flex items-center gap-1 text-[11px] font-semibold ${left <= 1 ? 'text-red-600' : 'text-amber-700'}`}>
                  <Timer className="w-3.5 h-3.5" /> Còn {left} ngày làm việc (hạn {p.reviewDeadline})
                </span>
              )}
            </div>
            <Breakdown r={r} />
            <button
              type="button"
              onClick={() => toggleDetail(p.period)}
              className="text-[11px] font-semibold text-[#8B1A4A] hover:underline"
            >
              {openDetail[p.period] ? 'Ẩn chi tiết' : 'Xem chi tiết ngày nghỉ & số tiết dạy'}
            </button>
            {openDetail[p.period] &&
              (detailLoading || !detailSrc ? (
                <p className="text-[11px] text-slate-500">Đang tải chi tiết…</p>
              ) : (
                <DetailBox detail={timesheetDetail(p.period, detailSrc.leaves, detailSrc.periods, detailSrc.holidays)} showPeriods={teaches} />
              ))}
            {r.disputeReason && <p className="text-xs text-red-700">Khiếu nại: {r.disputeReason}</p>}
            {r.resolutionNote && <p className="text-xs text-sky-800">Xử lý ({r.resolvedByName}): {r.resolutionNote}</p>}
            {canRespond && profile && (
              <RespondBox
                onConfirm={async () => { await respondToRecord(p.period, profile.uid, true); showToast('Đã xác nhận bảng công.', 'success'); load(); }}
                onDispute={async (reason) => { await respondToRecord(p.period, profile.uid, false, reason); showToast('Đã gửi khiếu nại.', 'success'); load(); }}
              />
            )}
          </section>
        );
      })}

      {isAdmin && profile && <AdminTimesheet periods={periods} today={today} onChanged={load} />}
    </div>
  );
};

const RespondBox: React.FC<{ onConfirm: () => Promise<void>; onDispute: (reason: string) => Promise<void> }> = ({ onConfirm, onDispute }) => {
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return disputing ? (
    <div className="space-y-2">
      <textarea aria-label="Nội dung khiếu nại" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Ví dụ: Ngày 12/9 tôi đi dạy nhưng bị ghi nghỉ phép…" className="w-full text-xs border border-slate-300 rounded-lg p-2" />
      <div className="flex gap-2">
        <button type="button" disabled={busy || !reason.trim()} onClick={() => run(() => onDispute(reason))} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white font-semibold disabled:opacity-40">Gửi khiếu nại</button>
        <button type="button" onClick={() => setDisputing(false)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200">Quay lại</button>
      </div>
    </div>
  ) : (
    <div className="flex gap-2">
      <button type="button" disabled={busy} onClick={() => run(onConfirm)} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-40">Xác nhận đúng</button>
      <button type="button" onClick={() => setDisputing(true)} className="px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-700 font-semibold">Khiếu nại</button>
    </div>
  );
};

// ---------------------------------------------------------------------------

const AdminTimesheet: React.FC<{ periods: TimesheetPeriod[]; today: string; onChanged: () => void }> = ({ periods, today, onChanged }) => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [newPeriod, setNewPeriod] = useState(previousPeriod(today));
  const [selected, setSelected] = useState<string>(periods[0]?.period || '');
  const [records, setRecords] = useState<TimesheetRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const meta = periods.find((p) => p.period === selected);

  useEffect(() => { if (!selected && periods[0]) setSelected(periods[0].period); }, [periods, selected]);
  const loadRecords = useCallback(async () => {
    if (!selected) return;
    setRecords((await fetchRecords(selected)).sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi')));
  }, [selected]);
  // Tải lại khi trang làm mới (periods đổi) — ví dụ sau khi chính BGH tự xác nhận công
  useEffect(() => { loadRecords().catch(console.error); }, [loadRecords, periods]);

  const publish = async () => {
    if (!profile || !isValidPeriod(newPeriod)) return;
    setBusy(true);
    try {
      const [policy, staff, leaves] = await Promise.all([fetchLeavePolicy(), fetchStaffDirectory(), fetchAllLeaveRequests()]);
      const res = await publishTimesheet({ period: newPeriod, today, holidays: policy.holidays, staff, leaves, admin: profile });
      showToast(`Đã phát hành kỳ ${newPeriod} cho ${res.count} người, hạn đối soát ${res.deadline}.`, 'success');
      setSelected(newPeriod);
      onChanged();
    } catch (e: any) {
      showToast(e?.message || 'Không phát hành được.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!meta) return;
    const blob = new Blob([timesheetCsv(meta.period, records, today, meta.reviewDeadline)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bang-cong-${meta.period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    const s = meta ? effectiveStatus(r, today, meta.reviewDeadline) : r.status;
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <section data-testid="admin-timesheet" className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
      <h3 className="text-sm font-bold text-slate-900">
        <Bi vi="Quản lý bảng công (BGH / Nhân sự)" en="Timesheet Administration (Leadership / HR)" />
      </h3>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="text-[11px] text-slate-600">Kỳ công
          <input type="month" aria-label="Kỳ công phát hành" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} className="block text-xs border border-slate-300 rounded-lg p-1.5" />
        </label>
        <button type="button" disabled={busy} onClick={publish} className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold disabled:opacity-50">
          <Send className="w-3.5 h-3.5" /> <Bi vi="Phát hành bảng công" en="Publish Timesheet" />
        </button>
        <p className="text-[11px] text-slate-500">Lấy từ đơn nghỉ đã duyệt; hạn đối soát = 3 ngày làm việc từ hôm nay.</p>
      </div>

      {periods.length > 0 && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <select aria-label="Chọn kỳ công" value={selected} onChange={(e) => setSelected(e.target.value)} className="text-xs border border-slate-300 rounded-lg p-1.5">
              {periods.map((p) => <option key={p.period} value={p.period}>{p.period} ({p.status === 'open' ? 'đang mở' : 'đã chốt'})</option>)}
            </select>
            {meta && <span className="text-[11px] text-slate-500">Hạn đối soát {meta.reviewDeadline}</span>}
            <span data-testid="ts-counts" className="text-[11px] text-slate-600">
              {(Object.keys(RECORD_STATUS_LABEL) as TimesheetRecordStatus[]).filter((k) => counts[k]).map((k) => `${RECORD_STATUS_LABEL[k]}: ${counts[k]}`).join(' • ')}
            </span>
            <button type="button" onClick={exportCsv} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg border border-slate-300"><Download className="w-3.5 h-3.5" /> <Bi vi="Xuất Excel (CSV)" en="Export CSV" /></button>
            {meta?.status === 'open' && (
              <button type="button" onClick={async () => {
                try { const n = await closePeriod(meta.period, records); showToast(`Đã chốt kỳ, ${n} dòng mặc nhiên xác nhận.`, 'success'); onChanged(); loadRecords(); }
                catch (e: any) { showToast(e?.message || 'Không chốt được.', 'error'); }
              }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-800 text-white"><Lock className="w-3.5 h-3.5" /> <Bi vi="Chốt kỳ" en="Lock Period" /></button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1.5 pr-2">Họ tên</th>
                  {LEAVE_ORDER.map((t) => <th key={t} className="px-1 text-center">{LEAVE_CODE[t]}</th>)}
                  <th className="px-1 text-center">Thực tế</th>
                  <th className="px-2">Trạng thái</th>
                  <th className="px-2">Khiếu nại / xử lý</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.uid} data-testid={`ts-row-${r.uid}`} className="border-b border-slate-100 align-top">
                    <td className="py-1.5 pr-2 font-semibold text-slate-800">{r.displayName}</td>
                    {LEAVE_ORDER.map((t) => <td key={t} className="px-1 text-center">{r.leave[t] || ''}</td>)}
                    <td className="px-1 text-center font-bold">{finalWorkedDays(r)}</td>
                    <td className="px-2"><Badge s={meta ? effectiveStatus(r, today, meta.reviewDeadline) : r.status} /></td>
                    <td className="px-2">
                      {r.disputeReason && <p className="text-red-700">{r.disputeReason}</p>}
                      {r.resolutionNote && <p className="text-sky-800">{r.resolutionNote}</p>}
                      {r.status === 'disputed' && profile && meta && (
                        <ResolveBox defaultDays={r.workedDays} onResolve={async (note, days) => {
                          await resolveDispute(meta.period, r.uid, note, days, profile);
                          showToast('Đã xử lý khiếu nại.', 'success');
                          loadRecords();
                        }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

const ResolveBox: React.FC<{ defaultDays: number; onResolve: (note: string, days: number | null) => Promise<void> }> = ({ defaultDays, onResolve }) => {
  const [note, setNote] = useState('');
  const [days, setDays] = useState<string>(String(defaultDays));
  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      <input aria-label="Ghi chú xử lý" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kết quả xử lý" className="border border-slate-300 rounded p-1 text-[11px] min-w-32" />
      <input aria-label="Số công sau điều chỉnh" type="number" min={0} max={31} value={days} onChange={(e) => setDays(e.target.value)} className="w-14 border border-slate-300 rounded p-1 text-[11px]" />
      <button type="button" disabled={!note.trim()} onClick={() => onResolve(note, days === '' ? null : Number(days))} className="px-2 py-1 rounded bg-sky-600 text-white disabled:opacity-40">Xử lý</button>
    </div>
  );
};
