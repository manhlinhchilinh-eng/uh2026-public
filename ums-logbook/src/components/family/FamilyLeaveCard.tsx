/**
 * Thẻ "Xin nghỉ cho con" — chỉ vai trò phụ huynh. Danh sách đơn chỉ tải khi mở thẻ.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Bi } from '../common/Bi';
import { useAuth } from '../../hooks/useAuth';
import { cancelLeave, listMyLeaves, submitLeave } from '../../services/studentLeaveService';
import {
  LEAVE_AHEAD_DAYS,
  LEAVE_MAX_DAYS,
  defaultMeal,
  isValidIso,
  schoolDates,
  validateLeaveInput,
  type LeaveKind,
  type LeaveReason,
  type LeaveStatus,
  type StudentLeave,
} from '../../utils/studentLeave';
import type { LinkedStudent } from '../../services/familyService';

// Lỗi quyền Firestore khi gửi (vd. rules chưa nhận liên kết PH–HS vừa tạo): báo thân thiện, không lộ thông báo kỹ thuật
const PERMISSION_ERR = '__permission__';
function isPermissionError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  const msg = e instanceof Error ? e.message : '';
  return code === 'permission-denied' || /permission/i.test(msg);
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const fmt = (s: string) => s.split('-').reverse().join('/');

const STATUS: Record<LeaveStatus, { vi: string; en: string; cls: string }> = {
  pending: { vi: 'Chờ duyệt', en: 'Pending', cls: 'bg-amber-100 text-amber-800' },
  approved: { vi: 'Đã duyệt', en: 'Approved', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { vi: 'Từ chối', en: 'Rejected', cls: 'bg-red-100 text-red-800' },
  cancelled: { vi: 'Đã hủy', en: 'Cancelled', cls: 'bg-slate-100 text-slate-600' },
};
const REASON: Record<LeaveReason, { vi: string; en: string }> = {
  sick: { vi: 'Ốm', en: 'Sick' },
  family: { vi: 'Việc gia đình', en: 'Family' },
  other: { vi: 'Khác', en: 'Other' },
};

export const FamilyLeaveCard: React.FC<{ students: LinkedStudent[] }> = ({ students }) => {
  const { activeRole, user, profile } = useAuth();
  const today = new Date();
  const todayIso = iso(today);
  const maxIso = iso(addDays(today, LEAVE_AHEAD_DAYS));

  const [open, setOpen] = useState(false);
  const [leaves, setLeaves] = useState<StudentLeave[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [childId, setChildId] = useState(students[0]?.docId ?? '');
  const [kind, setKind] = useState<LeaveKind>('day');
  const [start, setStart] = useState(todayIso);
  const [count, setCount] = useState(1);
  const [periods, setPeriods] = useState<number[]>([]);
  const [meal, setMeal] = useState(defaultMeal('day'));
  const [reason, setReason] = useState<LeaveReason>('sick');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (activeRole !== 'parent' || students.length === 0) return null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && leaves === null && user?.uid) {
      try {
        setLeaves(await listMyLeaves(user.uid));
      } catch (e) {
        console.error('[FamilyLeaveCard]', e);
        setLoadErr('Không tải được danh sách đơn.');
        setLeaves([]);
      }
    }
  };

  const changeKind = (k: LeaveKind) => {
    setKind(k);
    setMeal(defaultMeal(k));
  };

  const submit = async () => {
    setErr('');
    const child = students.find((s) => s.docId === childId) ?? students[0];
    const dates = !isValidIso(start) ? [] : kind === 'day' ? schoolDates(start, count) : [start];
    const input = { kind, dates, periods: kind === 'day' ? [] : [...periods].sort((a, b) => a - b), meal, reason, note: note.trim() };
    const v = validateLeaveInput(input, todayIso);
    if (v) return setErr(v);
    if (!user?.uid) return setErr('Chưa đăng nhập.');
    setBusy(true);
    try {
      const created = await submitLeave(
        { uid: user.uid, displayName: profile?.displayName ?? '' },
        { mhs: child.mhs, name: child.fullName, classId: child.className },
        input
      );
      setLeaves((cur) => [created, ...(cur ?? [])].slice(0, 10));
      setNote('');
      setPeriods([]);
    } catch (e) {
      setErr(isPermissionError(e) ? PERMISSION_ERR : e instanceof Error ? e.message : 'Không gửi được đơn.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await cancelLeave(id);
      setLeaves((cur) => (cur ?? []).map((l) => (l.id === id ? { ...l, status: 'cancelled' as const } : l)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không hủy được đơn.');
    }
  };

  const field = 'w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white';
  const kindBtn = (k: LeaveKind, vi: string, en: string) => (
    <button
      type="button"
      data-testid={`leave-kind-${k}`}
      onClick={() => changeKind(k)}
      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${kind === k ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'bg-white text-slate-700 border-slate-300'}`}
    >
      <Bi vi={vi} en={en} layout="inline" />
    </button>
  );

  return (
    <div data-testid="family-leave-card" className="border-2 border-[#8B1A4A]/30 bg-white rounded-2xl shadow-sm">
      <button type="button" data-testid="leave-toggle" onClick={toggle} className="w-full flex items-center justify-between gap-3 p-4 text-left">
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8B1A4A] text-white">
            <FileText className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-base font-bold text-[#8B1A4A]">
              <Bi vi="Xin nghỉ cho con" en="Request leave for my child" layout="inline" />
            </span>
            <span className="block text-xs text-slate-500">
              <Bi vi="Gửi đơn nghỉ cả ngày hoặc theo tiết tới GVCN" en="Send a full-day or per-period request to the homeroom teacher" layout="inline" />
            </span>
          </span>
        </span>
        {open ? <ChevronUp className="w-5 h-5 text-[#8B1A4A]" /> : <ChevronDown className="w-5 h-5 text-[#8B1A4A]" />}
      </button>
      {open && (
        <div className="p-3 pt-0 space-y-3 text-xs text-slate-700">
          {students.length > 1 && (
            <label className="block">
              <Bi vi="Chọn con" en="Child" layout="inline" />
              <select data-testid="leave-child" className={field} value={childId} onChange={(e) => setChildId(e.target.value)}>
                {students.map((s) => (
                  <option key={s.docId} value={s.docId}>{s.fullName} - {s.className}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            {kindBtn('day', 'Cả ngày', 'Full day')}
            {kindBtn('periods', 'Theo tiết', 'By period')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <Bi vi={kind === 'day' ? 'Từ ngày' : 'Ngày nghỉ'} en={kind === 'day' ? 'From' : 'Date'} layout="inline" />
              <input type="date" data-testid="leave-start" className={field} min={todayIso} max={maxIso} value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            {kind === 'day' && (
              <label className="block">
                <Bi vi="Số ngày" en="Days" layout="inline" />
                <select className={field} value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {Array.from({ length: LEAVE_MAX_DAYS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
          </div>
          {kind === 'periods' && (
            <div>
              <Bi vi="Các tiết nghỉ" en="Periods" layout="inline" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                  <label key={p} className={`px-2.5 py-1.5 rounded-lg border cursor-pointer ${periods.includes(p) ? 'bg-rose-50 border-[#8B1A4A] font-bold' : 'border-slate-300'}`}>
                    <input type="checkbox" className="sr-only" aria-label={`Tiết ${p}`} checked={periods.includes(p)} onChange={() => setPeriods((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]))} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="block">
            <Bi vi="Lý do" en="Reason" layout="inline" />
            <select className={field} value={reason} onChange={(e) => setReason(e.target.value as LeaveReason)}>
              {(Object.keys(REASON) as LeaveReason[]).map((r) => <option key={r} value={r}>{REASON[r].vi} / {REASON[r].en}</option>)}
            </select>
          </label>
          <label className="block">
            <Bi vi="Ghi chú" en="Note" layout="inline" />
            <textarea className={field} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={meal} onChange={(e) => setMeal(e.target.checked)} />
            <span>Đăng ký ăn bán trú <span className="opacity-60">· School lunch</span></span>
          </label>
          {err && (
            <p role="alert" className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              {err === PERMISSION_ERR ? (
                <Bi wrap vi="Chưa gửi được, vui lòng thử lại sau ít giây." en="Could not send, please try again in a few seconds." />
              ) : (
                err
              )}
            </p>
          )}
          <button type="button" data-testid="leave-submit" disabled={busy} onClick={submit} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#8B1A4A] text-white disabled:opacity-60">
            <Bi vi="Gửi đơn" en="Send request" layout="inline" />
          </button>

          <h5 className="font-bold pt-1"><Bi vi="Đơn đã gửi" en="My requests" layout="inline" /></h5>
          {loadErr && <p className="text-red-700">{loadErr}</p>}
          {leaves === null ? (
            <p className="text-slate-500">Đang tải…</p>
          ) : leaves.length === 0 ? (
            <p className="text-slate-500">Chưa có đơn nào.</p>
          ) : (
            <ul className="space-y-2" data-testid="leave-list">
              {leaves.map((l) => {
                const st = STATUS[l.status];
                return (
                  <li key={l.id} className="border border-slate-100 rounded-lg p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{l.studentName}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold ${st.cls}`}><Bi vi={st.vi} en={st.en} layout="inline" /></span>
                    </div>
                    <p className="mt-0.5">
                      {l.dates.map(fmt).join(', ')}
                      {l.kind === 'periods' ? ` • Tiết ${l.periods.join(',')}` : ''} • {REASON[l.reason].vi}
                    </p>
                    {l.status === 'rejected' && l.rejectReason && <p className="text-red-700 mt-0.5">Lý do từ chối: {l.rejectReason}</p>}
                    {l.status === 'pending' && (
                      <button type="button" onClick={() => cancel(l.id)} className="mt-1.5 px-3 py-1 rounded-lg border border-slate-300 font-semibold">
                        <Bi vi="Hủy đơn" en="Cancel" layout="inline" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
