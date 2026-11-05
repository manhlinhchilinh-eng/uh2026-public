/**
 * Đơn nghỉ học của PH (GVCN): duyệt / từ chối. Admin (BGH) chọn lớp để xem.
 * Đọc: 1 truy vấn đơn chờ của lớp (≤20, cache 10 phút trong service). Tab "Đã duyệt tuần này": 1 truy vấn đơn đã duyệt của lớp (≤50, cache 10 phút), tải 1 lần khi mở trang; đơn vừa xử lý gộp tại chỗ.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { useAuth } from '../hooks/useAuth';
import { decideLeave, listApprovedForClassWeek, listPendingForClass } from '../services/studentLeaveService';
import { ALL_CLASSES } from '../services/seedService';
import { useLanguage } from '../hooks/useLanguage';
import { flatBilingual } from '../utils/bilingual';
import { weekSchoolDates } from '../utils/leaveStats';
import type { LeaveReason, StudentLeave } from '../utils/studentLeave';

const REASON_LABEL: Record<LeaveReason, { vi: string; en: string }> = {
  sick: { vi: 'Ốm', en: 'Sick' },
  family: { vi: 'Việc gia đình', en: 'Family matter' },
  other: { vi: 'Khác', en: 'Other' },
};
const pad2 = (n: number) => String(n).padStart(2, '0');
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const fmtDate = (iso: string) => iso.split('-').reverse().join('/');

interface Decided { leave: StudentLeave; approved: boolean; rejectReason?: string }

export const StudentLeavePage: React.FC = () => {
  const { user, profile, activeRole } = useAuth();
  const lang = useLanguage();
  const flat = (vi: string, en: string) => flatBilingual(lang?.language || 'vi', lang?.mode || 'dual', { vi, en });
  const isAdmin = activeRole === 'admin';
  const [classId, setClassId] = useState<string>(isAdmin ? '' : profile?.assignedClassId || '');
  // Hồ sơ tải sau lần render đầu / đổi vai trò (BGH ↔ GVCN) mà trang không remount → đồng bộ lại lớp.
  // BGH có lớp chủ nhiệm thì chọn sẵn lớp đó; GVCN luôn là lớp chủ nhiệm.
  useEffect(() => {
    const own = profile?.assignedClassId || '';
    setClassId((cur) => (isAdmin ? cur || own : own));
  }, [isAdmin, profile?.assignedClassId]);
  const [pending, setPending] = useState<StudentLeave[]>([]);
  const [decided, setDecided] = useState<Decided[]>([]);
  const [approvedWeek, setApprovedWeek] = useState<StudentLeave[]>([]);
  const [approvedError, setApprovedError] = useState(false);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [itemError, setItemError] = useState<Record<string, string>>({});

  const load = useCallback(
    async (force = false) => {
      if (!classId) {
        setPending([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        setPending(await listPendingForClass(classId, force));
        if (force) window.dispatchEvent(new Event('ums-leave-changed'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải được danh sách đơn.');
      } finally {
        setLoading(false);
      }
    },
    [classId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Đơn đã duyệt tuần này của lớp: tải 1 lần khi mở trang / đổi lớp (≤50 lượt đọc, cache 10 phút)
  useEffect(() => {
    let alive = true;
    setApprovedWeek([]);
    setApprovedError(false);
    if (!classId) return;
    listApprovedForClassWeek(classId)
      .then((rows) => alive && setApprovedWeek(rows))
      .catch(() => alive && setApprovedError(true));
    return () => {
      alive = false;
    };
  }, [classId]);

  // Đơn vừa duyệt trong phiên gộp vào danh sách (khử trùng theo id); đơn bị từ chối không tính
  const approvedList = React.useMemo(() => {
    const week = new Set(weekSchoolDates(todayIso()));
    const justNow = decided.filter((d) => d.approved && d.leave.dates.some((x) => week.has(x))).map((d) => d.leave);
    const seen = new Set(approvedWeek.map((l) => l.id));
    return [...justNow.filter((l) => !seen.has(l.id)), ...approvedWeek];
  }, [approvedWeek, decided]);
  const approvedToday = approvedList.filter((l) => l.dates.includes(todayIso())).length;

  const by = { uid: user?.uid || '', displayName: profile?.displayName || user?.displayName || '' };

  const decide = async (leave: StudentLeave, approve: boolean) => {
    const rr = reason.trim();
    if (!approve && !rr) {
      setItemError((m) => ({ ...m, [leave.id]: flat('Vui lòng nhập lý do từ chối.', 'Please enter a rejection reason.') }));
      return;
    }
    setBusy(leave.id);
    setItemError((m) => ({ ...m, [leave.id]: '' }));
    try {
      if (approve) await decideLeave(leave, true, by);
      else await decideLeave(leave, false, by, rr);
      setPending((p) => p.filter((l) => l.id !== leave.id));
      setDecided((d) => [{ leave, approved: approve, rejectReason: approve ? undefined : rr }, ...d]);
      setRejecting(null);
      setReason('');
      window.dispatchEvent(new Event('ums-leave-changed'));
    } catch (e) {
      setItemError((m) => ({ ...m, [leave.id]: e instanceof Error ? e.message : 'Không xử lý được đơn.' }));
    } finally {
      setBusy(null);
    }
  };

  const when = (l: StudentLeave) => {
    const days = l.dates.map(fmtDate).join(', ');
    return (
      <>
        {days} ·{' '}
        {l.periods.length === 0 ? (
          <Bi vi="cả ngày" en="full day" layout="inline" wrap />
        ) : (
          <>
            <Bi vi="tiết" en="period" layout="inline" wrap /> {l.periods.join(', ')}
          </>
        )}
      </>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" data-testid="student-leave-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">
          <Bi vi="Đơn nghỉ học của phụ huynh" en="Parent leave requests" />
          {classId ? (
            <span className="ml-2 text-sm font-semibold text-amber-700" data-testid="pending-count">
              ({pending.length})
            </span>
          ) : null}
        </h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <select
              aria-label="Chọn lớp / Choose class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">Chọn lớp… / Choose class…</option>
              {ALL_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading || !classId}
            className="inline-flex items-center gap-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <Bi vi="Làm mới" en="Refresh" />
          </button>
        </div>
      </div>

      {!classId && (
        <p className="text-sm text-slate-500">
          {isAdmin ? (
            <Bi vi="Chọn một lớp để xem đơn chờ duyệt." en="Choose a class to see pending requests." layout="inline" wrap />
          ) : (
            <Bi vi="Tài khoản chưa được gán lớp chủ nhiệm." en="No homeroom class assigned to this account." layout="inline" wrap />
          )}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {classId && approvedError && (
        <p className="text-sm text-red-600" role="alert" data-testid="approved-error">
          <Bi vi="Chưa tải được danh sách đã duyệt" en="Could not load approved list" layout="inline" wrap />
        </p>
      )}
      {classId && (
        <p className="text-sm text-slate-700" data-testid="week-summary">
          <Bi
            vi={`Tuần này lớp có ${approvedList.length} lượt nghỉ đã duyệt (hôm nay: ${approvedToday})`}
            en={`This week the class has ${approvedList.length} approved leave requests (today: ${approvedToday})`}
            layout="inline"
            wrap
          />
        </p>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {(['pending', 'done'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            {t === 'pending' ? (
              <Bi vi={`Chờ duyệt (${pending.length})`} en={`Pending (${pending.length})`} layout="inline" wrap />
            ) : (
              <Bi vi={`Đã duyệt tuần này (${approvedList.length})`} en={`Approved this week (${approvedList.length})`} layout="inline" wrap />
            )}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <ul className="space-y-3">
          {classId && !loading && pending.length === 0 && <li className="text-sm text-slate-500"><Bi vi="Không có đơn chờ duyệt." en="No pending requests." layout="inline" wrap /></li>}
          {pending.map((l) => (
            <li key={l.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2" data-testid="leave-item">
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">{l.studentName}</span>
                <span className="text-xs text-slate-500">PH: {l.parentName}</span>
              </div>
              <div className="text-sm text-slate-700">{when(l)}</div>
              <div className="text-sm text-slate-600">
                <Bi vi="Lý do" en="Reason" layout="inline" wrap />: <Bi {...REASON_LABEL[l.reason]} layout="inline" wrap />
                {l.note ? ` — ${l.note}` : ''} · <Bi vi="Bán trú" en="School lunch" layout="inline" wrap />:{' '}
                {l.meal ? <Bi vi="ăn trưa" en="eats lunch" layout="inline" wrap /> : <Bi vi="không ăn" en="no lunch" layout="inline" wrap />}
              </div>
              {rejecting === l.id ? (
                <div className="space-y-2">
                  <textarea
                    aria-label={flat('Lý do từ chối', 'Rejection reason')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => void decide(l, false)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      <Bi vi="Xác nhận từ chối" en="Confirm reject" layout="inline" wrap />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejecting(null);
                        setReason('');
                      }}
                      className="px-3 py-1.5 rounded-lg border text-sm"
                    >
                      <Bi vi="Hủy" en="Cancel" layout="inline" wrap />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === l.id}
                    onClick={() => void decide(l, true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" /> <Bi vi="Duyệt" en="Approve" layout="inline" wrap />
                  </button>
                  <button
                    type="button"
                    disabled={busy === l.id}
                    onClick={() => {
                      setRejecting(l.id);
                      setReason('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm font-semibold"
                  >
                    <XCircle className="w-4 h-4" /> <Bi vi="Từ chối" en="Reject" layout="inline" wrap />
                  </button>
                </div>
              )}
              {itemError[l.id] && (
                <p className="text-sm text-red-600" role="alert">
                  {itemError[l.id]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === 'done' && (
        <ul className="space-y-2">
          {approvedList.length === 0 && <li className="text-sm text-slate-500"><Bi vi="Tuần này chưa có đơn nào được duyệt." en="No approved requests this week." layout="inline" wrap /></li>}
          {approvedList.map((l) => (
            <li key={l.id} className="bg-white border border-slate-200 rounded-xl p-3 text-sm" data-testid="decided-item">
              <span className="font-semibold">{l.studentName}</span> · {when(l)} ·{' '}
              <span className="text-emerald-700"><Bi vi="Đã duyệt" en="Approved" layout="inline" wrap /></span>
            </li>
          ))}
          {decided.some((d) => !d.approved) && (
            <li className="text-xs text-slate-500">
              <Bi vi={`Đã từ chối trong phiên này: ${decided.filter((d) => !d.approved).length}`} en={`Rejected this session: ${decided.filter((d) => !d.approved).length}`} layout="inline" wrap />
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
