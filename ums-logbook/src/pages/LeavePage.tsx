/**
 * UMS SmartConnect - Xin nghỉ online
 * GV: số dư phép/ốm, nộp 4 loại đơn, nhắc nộp giấy tờ (đếm ngược). BGH: duyệt đơn, theo dõi giấy tờ, hồ sơ phép, cấu hình.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarOff, Plus, FileWarning, Check, X, Settings2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { Bi } from '../components/common/Bi';
import { LeaveRequestForm } from '../components/leave/LeaveRequestForm';
import type { LeavePolicy, LeaveProfile, LeaveRequest, LeaveStatus } from '../types/leave';
import {
  DEFAULT_LEAVE_POLICY,
  LEAVE_TYPE_LABEL,
  decidedHistory,
  formatDecisionTime,
  annualEntitlement,
  daysUntil,
  sickChildCap,
  sickSelfCap,
  usedDays,
} from '../utils/leavePolicy';
import {
  cancelLeaveRequest,
  decideLeaveRequest,
  fetchAllLeaveRequests,
  fetchLeavePolicy,
  fetchLeaveProfile,
  fetchMyLeaveRequests,
  markDocsSubmitted,
  saveLeavePolicy,
  saveLeaveProfile,
  submitLeaveRequest,
} from '../services/leaveService';
import { fetchStaffDirectory } from '../services/announcementService';
import {
  createSubstitutions,
  fetchAllClassSchedules,
  fetchMySubstituteDuties,
  fetchStaffDirectoryPublic,
  fetchSubstitutionsForLeave,
  setSubstitutionStatus,
  syncStaffDirectory,
} from '../services/substitutionService';
import type { Substitution } from '../types/substitution';
import type { PlannerData } from '../components/leave/SubstitutionPlanner';

export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STATUS: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  rejected: { label: 'Từ chối', cls: 'bg-red-50 text-red-800 border-red-200' },
  cancelled: { label: 'Đã hủy', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const needsDocs = (r: LeaveRequest) => r.requiredDocs.length > 0 && !r.docsSubmittedAt && (r.status === 'approved' || r.status === 'pending');

export const DocsCountdown: React.FC<{ r: LeaveRequest; today: string }> = ({ r, today }) => {
  if (!r.docsDeadline) return <span className="text-[11px] text-sky-800">Hạn: 1 tháng sau ngày sinh</span>;
  const left = daysUntil(today, r.docsDeadline);
  const cls = left < 0 ? 'text-red-700 font-bold' : left <= 7 ? 'text-red-600 font-semibold' : 'text-amber-700';
  return (
    <span data-testid={`countdown-${r.id}`} className={`text-[11px] ${cls}`}>
      {left < 0 ? `Quá hạn ${-left} ngày (hạn ${r.docsDeadline})` : `Còn ${left} ngày (hạn ${r.docsDeadline})`}
    </span>
  );
};

export const LeavePage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const isAdmin = activeRole === 'admin';
  const today = localToday();
  const year = Number(today.slice(0, 4));

  const [policy, setPolicy] = useState<LeavePolicy>(DEFAULT_LEAVE_POLICY);
  const [leaveProfile, setLeaveProfile] = useState<LeaveProfile | null>(null);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [all, setAll] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'mine' | 'approve' | 'profiles'>('mine');
  const [duties, setDuties] = useState<Substitution[]>([]);
  const [subsByLeave, setSubsByLeave] = useState<Record<string, Substitution[]>>({});
  const [planner, setPlanner] = useState<PlannerData | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      const [p, lp, m] = await Promise.all([fetchLeavePolicy(), fetchLeaveProfile(profile.uid), fetchMyLeaveRequests(profile.uid)]);
      setPolicy(p);
      setLeaveProfile(lp);
      setMine(m);
      const allReqs = isAdmin ? await fetchAllLeaveRequests() : [];
      setAll(allReqs);
      if (isAdmin) {
        // BGH: đồng bộ danh bạ nhân sự (uid + họ tên) để GV chọn người dạy thay
        fetchStaffDirectory().then(syncStaffDirectory).catch((e) => console.warn('[Leave] sync directory', e));
      }
      setDuties(await fetchMySubstituteDuties(profile.uid));
      const ids = Array.from(new Set([...m, ...allReqs.filter((r) => r.status === 'pending')].map((r) => r.id)));
      const pairs = await Promise.all(ids.map(async (id) => [id, await fetchSubstitutionsForLeave(id)] as const));
      setSubsByLeave(Object.fromEntries(pairs));
    } catch (e) {
      console.error('[Leave] load', e);
      setError('Không tải được dữ liệu xin nghỉ.');
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const ctx = useMemo(() => ({ today, policy, profile: leaveProfile ?? undefined, existing: mine }), [today, policy, leaveProfile, mine]);
  const ent = annualEntitlement(policy.annualBaseDays, year, leaveProfile?.employmentStartDate);
  const annualUsed = usedDays(mine, year, (r) => r.type === 'annual');
  const sickCap = sickSelfCap(leaveProfile?.bhxhYears);
  const sickUsed = usedDays(mine, year, (r) => r.type === 'sick_self');
  const myDocs = mine.filter(needsDocs);
  const pending = all.filter((r) => r.status === 'pending');
  const allDocs = all.filter(needsDocs);
  const history = decidedHistory(all);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-ums-50 text-[#8B1A4A]"><CalendarOff className="w-5 h-5" /></div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi="Xin nghỉ online" en="Online Leave Requests" />
            </h2>
            <p className="text-xs text-slate-500">
              <Bi vi='Theo "Hướng dẫn chế độ liên quan đến công tác tính lương" của trường' en="Per school payroll & leave policy guidelines" />
            </p>
          </div>
        </div>
        <button type="button" onClick={async () => {
          setCreating(true);
          try {
            const [schedules, staff] = await Promise.all([fetchAllClassSchedules(), fetchStaffDirectoryPublic()]);
            setPlanner({ schedules, staff, timetableName: leaveProfile?.timetableName, holidays: policy.holidays });
          } catch (e) {
            console.error('[Leave] planner', e);
            setPlanner(null);
          }
        }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#8B1A4A] text-white hover:bg-[#6B1338]">
          <Plus className="w-4 h-4" /> <Bi vi="Tạo đơn xin nghỉ" en="New Leave Request" />
        </button>
      </div>

      {isAdmin && (
        <div className="flex gap-2 text-xs">
          {([
            ['mine', 'Đơn của tôi', 'My Requests'],
            ['approve', `Duyệt đơn (${pending.length})`, `Approve (${pending.length})`],
            ['profiles', 'Hồ sơ phép & cấu hình', 'Leave Profiles & Policy'],
          ] as const).map(([k, viLabel, enLabel]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full border ${tab === k ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'border-slate-200 text-slate-600'}`}>
              <Bi vi={viLabel} en={enLabel} />
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Đang tải…</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

      {!loading && tab === 'mine' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div data-testid="balance-annual" className="bg-white border border-slate-200 rounded-xl p-3.5">
              <p className="text-[11px] font-semibold text-slate-500">
                <Bi vi={`Phép năm ${year} còn lại`} en={`Remaining Annual Leave (${year})`} />
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1">{Math.round((ent.days - annualUsed.approved - annualUsed.pending) * 10) / 10}<span className="text-sm font-medium text-slate-400"> / {ent.days} ngày</span></p>
              <p className="text-[11px] text-slate-500 mt-1">
                {ent.seniorityBonus > 0 && `Gồm +${ent.seniorityBonus} ngày thâm niên. `}
                {ent.prorated && `Tính theo ${ent.monthsWorked} tháng làm việc. `}
                {annualUsed.pending > 0 && `${annualUsed.pending} ngày đang chờ duyệt. `}
                {ent.missingStartDate && 'Chưa có ngày vào làm trong hồ sơ. '}
                {!policy.annualBaseConfirmed && <span className="text-amber-700">Số phép cơ bản chưa được trường xác nhận.</span>}
              </p>
            </div>
            <div data-testid="balance-sick" className="bg-white border border-slate-200 rounded-xl p-3.5">
              <p className="text-[11px] font-semibold text-slate-500">
                <Bi vi={`Nghỉ ốm hưởng BHXH ${year}`} en={`Social Insurance Sick Leave (${year})`} />
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1">{sickUsed.approved + sickUsed.pending}<span className="text-sm font-medium text-slate-400"> / {sickCap.days} ngày</span></p>
              <p className="text-[11px] text-slate-500 mt-1">
                {sickCap.assumed ? 'Chưa có số năm BHXH — tạm tính 30 ngày.' : sickCap.source === 'LUẬT' ? 'Theo luật (tham khảo) — Nhân sự xác nhận.' : 'Theo quy định của trường.'}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <p className="text-[11px] font-semibold text-slate-500">
                <Bi vi={`Chăm con ốm ${year}`} en={`Child Sick Care Leave (${year})`} />
              </p>
              {(leaveProfile?.children || []).length === 0 ? (
                <p className="text-xs text-slate-500 mt-2">Chưa có thông tin con trong hồ sơ.</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {leaveProfile!.children!.map((c) => {
                    const used = usedDays(mine, year, (r) => r.type === 'sick_child' && r.child?.name === c.name && r.child?.dob === c.dob);
                    return (
                      <li key={c.name + c.dob} className="text-xs text-slate-700">
                        {c.name}: <b>{used.approved + used.pending}</b> / {sickChildCap(c.dob, today)} ngày
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {myDocs.length > 0 && (
            <div data-testid="docs-reminder" className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2">
              <p className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                <FileWarning className="w-4 h-4" /> Giấy tờ cần nộp — tránh bị tính nghỉ không lương và mất trợ cấp BHXH
              </p>
              {myDocs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 bg-white rounded-lg p-2.5 border border-red-100 flex-wrap">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">{LEAVE_TYPE_LABEL[r.type]} {r.startDate} → {r.endDate}</p>
                    <p className="text-slate-600">{r.requiredDocs.join('; ')}</p>
                    <DocsCountdown r={r} today={today} />
                  </div>
                  <button type="button" onClick={async () => { await markDocsSubmitted(r.id); showToast('Đã ghi nhận nộp giấy tờ.', 'success'); load(); }} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-600 text-white font-semibold">
                    Tôi đã nộp giấy tờ
                  </button>
                </div>
              ))}
            </div>
          )}

          {duties.filter((d) => d.status !== 'cancelled' && d.date >= today).length > 0 && (
            <div data-testid="my-duties" className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-sky-900">Lịch dạy thay của tôi</p>
              {duties.filter((d) => d.status !== 'cancelled' && d.date >= today).map((d) => (
                <p key={d.id} className="text-xs text-sky-900">
                  {d.date} • Lớp {d.classId} • Tiết {d.periodIndex}{d.subject ? ` • ${d.subject}` : ''} — thay {d.absentName}{' '}
                  <span className={d.status === 'approved' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                    ({d.status === 'approved' ? 'đã duyệt' : 'chờ BGH duyệt'})
                  </span>
                </p>
              ))}
            </div>
          )}

          <RequestList
            items={mine}
            today={today}
            subsByLeave={subsByLeave}
            actions={(r) =>
              r.status === 'pending' ? (
                <button type="button" onClick={async () => { await cancelLeaveRequest(r.id); await setSubstitutionStatus(r.id, 'cancelled'); showToast('Đã hủy đơn.', 'success'); load(); }} className="text-[11px] text-slate-500 hover:underline">
                  Hủy đơn
                </button>
              ) : null
            }
          />
        </>
      )}

      {!loading && isAdmin && tab === 'approve' && profile && (
        <>
          <RequestList
            items={pending}
            today={today}
            showRequester
            subsByLeave={subsByLeave}
            emptyText="Không có đơn chờ duyệt."
            actions={(r) => <DecisionButtons onDecide={async (ok, note) => { await decideLeaveRequest(r.id, ok, profile, note); await setSubstitutionStatus(r.id, ok ? 'approved' : 'cancelled'); showToast(ok ? 'Đã duyệt đơn.' : 'Đã từ chối đơn.', 'success'); load(); }} />}
          />
          <div>
            <h3 className="text-xs font-bold text-slate-700 mb-2">Giấy tờ chưa nộp ({allDocs.length})</h3>
            <RequestList items={allDocs} today={today} showRequester emptyText="Không có." />
          </div>
          <div data-testid="leave-history">
            <h3 className="text-xs font-bold text-slate-700 mb-2">Lịch sử đơn đã xử lý ({history.length})</h3>
            <RequestList items={history} today={today} showRequester emptyText="Chưa có đơn nào được duyệt/từ chối." />
          </div>
        </>
      )}

      {!loading && isAdmin && tab === 'profiles' && (
        <AdminProfiles policy={policy} onSaved={() => { showToast('Đã lưu.', 'success'); load(); }} />
      )}

      {creating && profile && (
        <Modal isOpen onClose={() => setCreating(false)} title="Tạo đơn xin nghỉ" maxWidth="lg">
          <LeaveRequestForm
            ctx={ctx}
            gender={leaveProfile?.gender}
            children={leaveProfile?.children || []}
            onCancel={() => setCreating(false)}
            planner={planner ?? undefined}
            selfUid={profile.uid}
            onSubmit={async (input, workingDays, plans) => {
              const leaveId = await submitLeaveRequest(input, workingDays, profile, policy);
              await createSubstitutions(leaveId, plans, profile);
              setCreating(false);
              showToast('Đã gửi đơn, chờ BGH duyệt.', 'success');
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const RequestList: React.FC<{
  items: LeaveRequest[];
  today: string;
  showRequester?: boolean;
  emptyText?: string;
  actions?: (r: LeaveRequest) => React.ReactNode;
  subsByLeave?: Record<string, Substitution[]>;
}> = ({ items, today, showRequester, emptyText = 'Chưa có đơn nào.', actions, subsByLeave = {} }) =>
  items.length === 0 ? (
    <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">{emptyText}</p>
  ) : (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id} data-testid={`leave-${r.id}`} className="bg-white border border-slate-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
            <span className="text-sm font-bold text-slate-900">{LEAVE_TYPE_LABEL[r.type]}</span>
            {r.isEmergency && <span className="text-[10px] font-bold text-red-700">ĐỘT XUẤT</span>}
            <span className="text-xs text-slate-500 ml-auto">{r.startDate} → {r.endDate}{r.type !== 'maternity' ? ` • ${r.workingDays} ngày làm việc` : ''}</span>
          </div>
          {showRequester && <p className="text-xs text-slate-700 mt-1 font-semibold">{r.requesterName}</p>}
          <p className="text-xs text-slate-600 mt-1">{r.reason}</p>
          {r.child && <p className="text-[11px] text-slate-500">Con: {r.child.name}</p>}
          {r.requiredDocs.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-1">
              Giấy tờ: {r.docsSubmittedAt ? <span className="text-emerald-700 font-semibold">đã nộp</span> : <DocsCountdown r={r} today={today} />}
            </p>
          )}
          {(subsByLeave[r.id] || []).length > 0 && (
            <div data-testid={`subs-${r.id}`} className="mt-1.5 text-[11px] text-slate-600 bg-slate-50 rounded-lg p-2">
              <p className="font-semibold text-slate-700">Dạy thay ({subsByLeave[r.id].length} tiết):</p>
              {subsByLeave[r.id].map((s) => (
                <p key={s.id}>{s.date} • {s.classId} • Tiết {s.periodIndex} → {s.substituteName}</p>
              ))}
            </div>
          )}
          {r.decisionByName && (
            <p className="text-[11px] text-slate-500 mt-1">
              {STATUS[r.status].label} bởi {r.decisionByName}
              {r.decisionAt ? ` lúc ${formatDecisionTime(r.decisionAt)}` : ''}
              {r.decisionNote ? `: ${r.decisionNote}` : ''}
            </p>
          )}
          {actions && <div className="mt-2">{actions(r)}</div>}
        </li>
      ))}
    </ul>
  );

const DecisionButtons: React.FC<{ onDecide: (approve: boolean, note: string) => Promise<void> }> = ({ onDecide }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (ok: boolean) => {
    setBusy(true);
    try { await onDecide(ok, note); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú duyệt" className="flex-1 min-w-40 text-xs border border-slate-300 rounded-lg p-1.5" />
      <button type="button" disabled={busy} onClick={() => go(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Duyệt</button>
      <button type="button" disabled={busy} onClick={() => go(false)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-red-600 text-white font-semibold disabled:opacity-50"><X className="w-3.5 h-3.5" /> Từ chối</button>
    </div>
  );
};

// ---------------------------------------------------------------------------

const AdminProfiles: React.FC<{ policy: LeavePolicy; onSaved: () => void }> = ({ policy, onSaved }) => {
  const [staff, setStaff] = useState<Array<{ uid: string; displayName: string }>>([]);
  const [uid, setUid] = useState('');
  const [p, setP] = useState<LeaveProfile | null>(null);
  const [childrenText, setChildrenText] = useState('');
  const [pol, setPol] = useState<LeavePolicy>(policy);
  const [holidaysText, setHolidaysText] = useState(policy.holidays.join(', '));

  useEffect(() => { fetchStaffDirectory().then(setStaff).catch(console.error); }, []);
  useEffect(() => {
    if (!uid) return;
    const name = staff.find((s) => s.uid === uid)?.displayName || '';
    fetchLeaveProfile(uid).then((lp) => {
      const v = lp || { uid, displayName: name };
      setP(v);
      setChildrenText((v.children || []).map((c) => `${c.name}; ${c.dob}`).join('\n'));
    });
  }, [uid, staff]);

  const parseChildren = () =>
    childrenText.split('\n').map((l) => l.split(';').map((x) => x.trim())).filter(([n, d]) => n && /^\d{4}-\d{2}-\d{2}$/.test(d || '')).map(([name, dob]) => ({ name, dob }));

  const field = 'w-full text-xs border border-slate-300 rounded-lg p-2';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
        <h3 className="text-xs font-bold text-slate-800">Hồ sơ phép giáo viên</h3>
        <select aria-label="Chọn giáo viên" value={uid} onChange={(e) => setUid(e.target.value)} className={field}>
          <option value="">-- Chọn giáo viên --</option>
          {staff.map((s) => <option key={s.uid} value={s.uid}>{s.displayName}</option>)}
        </select>
        {p && (
          <>
            <label className="block text-[11px] text-slate-600">Ngày bắt đầu làm việc tại trường
              <input type="date" value={p.employmentStartDate || ''} onChange={(e) => setP({ ...p, employmentStartDate: e.target.value })} className={field} />
            </label>
            <label className="block text-[11px] text-slate-600">Tên trên thời khóa biểu (vd. Ms P.Anh)
              <input value={p.timetableName || ''} onChange={(e) => setP({ ...p, timetableName: e.target.value })} className={field} />
            </label>
            <label className="block text-[11px] text-slate-600">Số năm đã đóng BHXH
              <input type="number" min={0} max={45} value={p.bhxhYears ?? ''} onChange={(e) => setP({ ...p, bhxhYears: e.target.value === '' ? undefined : Number(e.target.value) })} className={field} />
            </label>
            <label className="block text-[11px] text-slate-600">Giới tính (thai sản)
              <select value={p.gender || ''} onChange={(e) => setP({ ...p, gender: (e.target.value || undefined) as LeaveProfile['gender'] })} className={field}>
                <option value="">--</option><option value="female">Nữ</option><option value="male">Nam</option>
              </select>
            </label>
            <label className="block text-[11px] text-slate-600">Con (mỗi dòng: Họ tên; YYYY-MM-DD)
              <textarea rows={3} value={childrenText} onChange={(e) => setChildrenText(e.target.value)} className={field} />
            </label>
            <button type="button" onClick={async () => {
              const clean: LeaveProfile = JSON.parse(JSON.stringify({ ...p, children: parseChildren() }));
              await saveLeaveProfile(clean); onSaved();
            }} className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold">Lưu hồ sơ</button>
          </>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Settings2 className="w-4 h-4" /> Cấu hình chế độ nghỉ</h3>
        <label className="block text-[11px] text-slate-600">Số ngày phép năm cơ bản
          <input type="number" min={0} max={30} value={pol.annualBaseDays} onChange={(e) => setPol({ ...pol, annualBaseDays: Number(e.target.value) })} className={field} />
        </label>
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-700">
          <input type="checkbox" checked={pol.annualBaseConfirmed} onChange={(e) => setPol({ ...pol, annualBaseConfirmed: e.target.checked })} /> Nhà trường đã xác nhận số ngày phép này
        </label>
        <label className="block text-[11px] text-slate-600">Hạn nộp giấy tờ nghỉ ốm (ngày, quy định nội bộ)
          <input type="number" min={1} max={90} value={pol.sickDocsDeadlineDays} onChange={(e) => setPol({ ...pol, sickDocsDeadlineDays: Number(e.target.value) })} className={field} />
        </label>
        <label className="block text-[11px] text-slate-600">Ngày nghỉ lễ/Tết (YYYY-MM-DD, cách nhau dấu phẩy)
          <textarea rows={3} value={holidaysText} onChange={(e) => setHolidaysText(e.target.value)} className={field} />
        </label>
        <button type="button" onClick={async () => {
          const holidays = holidaysText.split(/[,\s]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
          await saveLeavePolicy({ ...pol, holidays }); onSaved();
        }} className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold">Lưu cấu hình</button>
      </div>
    </div>
  );
};
