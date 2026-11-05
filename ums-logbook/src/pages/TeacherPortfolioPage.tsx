/**
 * UMS SmartConnect - Hồ sơ năng lực số giáo viên (ePortfolio GV)
 * Tự gom minh chứng từ Sổ đầu bài (tiết đã ký), dạy thay, ghi nhận nề nếp + minh chứng tự nộp (BGH xác nhận).
 * In "Hồ sơ thi đua" bằng trình duyệt (giữ dấu tiếng Việt).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Plus, Printer, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { Bi } from '../components/common/Bi';
import { BrandMark } from '../components/common/BrandMark';
import { BRAND_CONFIG } from '../config/brand';
import { localToday } from './LeavePage';
import {
  EVIDENCE_LEVEL_LABEL,
  EVIDENCE_TYPE_LABEL,
  evidenceStats,
  schoolYearRange,
  summarizeTeaching,
  validateEvidence,
  type EvidenceLevel,
  type EvidenceType,
  type TeacherEvidence,
} from '../utils/teacherPortfolio';
import {
  countApprovedSubstitutions,
  countBehaviorNotesByAuthor,
  createEvidence,
  deleteEvidence,
  fetchEvidence,
  fetchPeriodsByTeacher,
  fetchUsername,
  setEvidenceVerified,
} from '../services/teacherPortfolioService';
import { fetchStaffDirectoryPublic, type StaffEntry } from '../services/substitutionService';
import { fetchMyLeaveRequests } from '../services/leaveService';
import { LEAVE_TYPE_LABEL, leaveStatsInRange, type LeaveStats } from '../utils/leavePolicy';

const SERIES = '#A8285F'; // đã qua validator dataviz

interface Data {
  teaching: ReturnType<typeof summarizeTeaching>;
  substitutions: number;
  notes: { positive: number; negative: number };
  evidence: TeacherEvidence[];
  leave: LeaveStats | null;
}

export const TeacherPortfolioPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const isAdmin = activeRole === 'admin';
  const year = schoolYearRange(localToday());
  const [staff, setStaff] = useState<StaffEntry[]>([]);
  const [target, setTarget] = useState<StaffEntry | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (profile) setTarget({ uid: profile.uid, displayName: profile.displayName || profile.username });
    if (isAdmin) fetchStaffDirectoryPublic().then(setStaff).catch(console.error);
  }, [profile, isAdmin]);

  const isSelf = target?.uid === profile?.uid;

  const load = useCallback(async () => {
    if (!target || !profile) return;
    setLoading(true);
    setError(null);
    try {
      const username = isSelf ? profile.username : await fetchUsername(target.uid);
      const [periods, substitutions, notes, evidence, leave] = await Promise.all([
        username ? fetchPeriodsByTeacher(username) : Promise.resolve([]),
        countApprovedSubstitutions(target.uid, year.start, year.end),
        countBehaviorNotesByAuthor(target.uid, year.start, year.end),
        fetchEvidence(target.uid),
        // Đơn nghỉ: BGH xem được mọi GV, GV xem của mình (rules leave_requests). Tải song song; lỗi đọc → không chặn cả hồ sơ.
        fetchMyLeaveRequests(target.uid)
          .then((rs) => leaveStatsInRange(rs, year.start, year.end))
          .catch(() => null),
      ]);
      setData({ teaching: summarizeTeaching(periods, year.start, year.end), substitutions, notes, evidence, leave });
    } catch (e) {
      console.error('[TeacherPortfolio]', e);
      setError('Không tải được hồ sơ.');
    } finally {
      setLoading(false);
    }
  }, [target, profile, isSelf, year.start, year.end]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.teaching;
  const maxMonth = Math.max(1, ...(t?.byMonth.map((m) => m.count) || [1]));
  const stats = data ? evidenceStats(data.evidence) : null;

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        <div className="p-1 rounded-xl bg-slate-50 border border-slate-100 shrink-0"><BrandMark app="eportfolio" size={36} /></div>
        <div>
          <h2 className="text-base font-bold text-slate-900">
            <Bi vi="Hồ sơ năng lực giáo viên" en="Teacher Professional ePortfolio" />
          </h2>
          <p className="text-xs text-slate-500">
            <Bi
              vi={`Năm học ${year.label} • minh chứng tự động từ Sổ đầu bài + minh chứng tự nộp`}
              en={`AY ${year.label} • Auto-collected logbook evidence + self-submitted items`}
            />
          </p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          {isAdmin && (
            <select aria-label="Chọn giáo viên" value={target?.uid || ''} onChange={(e) => setTarget(staff.find((s) => s.uid === e.target.value) || null)} className="text-xs border border-slate-300 rounded-lg p-1.5">
              {profile && <option value={profile.uid}>{profile.displayName} (tôi)</option>}
              {staff.filter((s) => s.uid !== profile?.uid).map((s) => <option key={s.uid} value={s.uid}>{s.displayName}</option>)}
            </select>
          )}
          {isSelf && (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#8B1A4A] text-white">
              <Plus className="w-4 h-4" /> <Bi vi="Thêm minh chứng" en="Add Evidence" />
            </button>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300">
            <Printer className="w-4 h-4" /> <Bi vi="In hồ sơ thi đua" en="Print Portfolio" />
          </button>
        </div>
      </div>

      {/* Tiêu đề khi in */}
      <div className="hidden print:block text-center border-b border-slate-300 pb-2">
        <p className="text-xs">{BRAND_CONFIG.schoolNameVi} — {BRAND_CONFIG.subTitleVi}</p>
        <h1 className="text-lg font-black">HỒ SƠ NĂNG LỰC GIÁO VIÊN — NĂM HỌC {year.label}</h1>
        <p className="text-sm">{target?.displayName}</p>
      </div>

      {loading && <p className="text-sm text-slate-500">Đang tổng hợp minh chứng…</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

      {!loading && data && t && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Tile testId="tp-periods" label="Tiết đã ký sổ" labelEn="Signed Periods" value={String(t.signedCount)} sub={`${t.byClass.length} lớp • ${t.bySubject.length} môn`} />
            <Tile testId="tp-subs" label="Tiết dạy thay (đã duyệt)" labelEn="Approved Substitutions" value={String(data.substitutions)} />
            <Tile testId="tp-notes" label="Ghi nhận nề nếp HS" labelEn="Behavior Notes" value={`${data.notes.positive} / ${data.notes.negative}`} sub="Khen / Nhắc nhở" />
            <Tile testId="tp-evidence" label="Minh chứng tự nộp" labelEn="Submitted Evidence" value={String(stats.total)} sub={`${stats.verified} đã được BGH xác nhận`} />
            <Tile
              testId="tp-leave"
              label="Ngày nghỉ (đã duyệt)"
              labelEn="Approved Leave Days"
              value={data.leave ? String(data.leave.approvedDays) : '—'}
              sub={
                data.leave
                  ? `${data.leave.approvedCount} đơn${data.leave.pendingCount ? ` • ${data.leave.pendingCount} chờ duyệt` : ''}${
                      data.leave.byType.length ? ` • ${data.leave.byType.map((b) => `${LEAVE_TYPE_LABEL[b.type]} ${b.days}`).join(', ')}` : ''
                    }`
                  : 'Không tải được'
              }
            />
          </div>

          {t.signedCount === 0 && (
            <p className="text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded-xl p-3">Chưa có tiết nào được ký sổ trong năm học — minh chứng sẽ tự cập nhật khi ghi Sổ đầu bài.</p>
          )}

          {t.byMonth.length > 0 && (
            <figure className="bg-white border border-slate-200 rounded-xl p-4 break-inside-avoid">
              <figcaption className="text-xs font-bold text-slate-800 mb-3">
                <Bi vi="Số tiết đã ký theo tháng" en="Signed Periods by Month" />
              </figcaption>
              <div className="space-y-1.5">
                {t.byMonth.map((m) => (
                  <div key={m.key} className="grid grid-cols-[64px_1fr_32px] items-center gap-2" title={`${m.key}: ${m.count} tiết`}>
                    <span className="text-[11px] text-slate-600">{m.key.slice(5)}/{m.key.slice(0, 4)}</span>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-r" style={{ width: `${(m.count / maxMonth) * 100}%`, background: SERIES }} /></div>
                    <span className="text-[11px] font-bold text-slate-700 text-right">{m.count}</span>
                  </div>
                ))}
              </div>
            </figure>
          )}

          {t.byClass.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 break-inside-avoid">
              <h3 className="text-xs font-bold text-slate-800 mb-2">
                <Bi vi="Lớp & môn giảng dạy" en="Classes & Subjects Taught" />
              </h3>
              <p className="text-[11px] text-slate-700">{t.byClass.map((c) => `${c.key} (${c.count} tiết)`).join(' • ')}</p>
              <p className="text-[11px] text-slate-700 mt-1">{t.bySubject.map((s) => `${s.key} (${s.count})`).join(' • ')}</p>
              {t.recentTopics.length > 0 && (
                <ul className="mt-2 text-[11px] text-slate-600 list-disc ml-4">
                  {t.recentTopics.map((x, i) => <li key={i}>{x.date} • {x.classId} • {x.subject}: {x.topic}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-2">
              <Bi vi="Minh chứng chuyên môn" en="Professional Evidence" />
            </h3>
            {data.evidence.length === 0 && <p className="text-xs text-slate-500">Chưa có minh chứng tự nộp.</p>}
            <ul className="space-y-2">
              {data.evidence.map((e) => (
                <li key={e.id} data-testid={`ev-${e.id}`} className="text-xs border-l-2 border-[#A8285F] pl-3 break-inside-avoid">
                  <p className="font-bold text-slate-900">
                    {e.title}{' '}
                    {e.verifiedAt ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-700 text-[10px] font-semibold"><BadgeCheck className="w-3.5 h-3.5" /> BGH xác nhận ({e.verifiedByName})</span>
                    ) : (
                      <span className="text-amber-700 text-[10px]">Chờ xác nhận</span>
                    )}
                  </p>
                  <p className="text-slate-500">{EVIDENCE_TYPE_LABEL[e.type]} • {EVIDENCE_LEVEL_LABEL[e.level]} • {e.date.split('-').reverse().join('/')}</p>
                  {e.description && <p className="text-slate-700 whitespace-pre-wrap">{e.description}</p>}
                  {e.links.map((l) => <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline mr-2 print:hidden">Liên kết</a>)}
                  <div className="flex gap-3 mt-1 print:hidden">
                    {isAdmin && profile && (
                      <button type="button" onClick={async () => { await setEvidenceVerified(e.id, !e.verifiedAt, profile); showToast(e.verifiedAt ? 'Đã bỏ xác nhận.' : 'Đã xác nhận minh chứng.', 'success'); load(); }} className="text-[11px] text-emerald-700 hover:underline">
                        {e.verifiedAt ? 'Bỏ xác nhận' : 'Xác nhận'}
                      </button>
                    )}
                    {isSelf && !e.verifiedAt && (
                      <button type="button" aria-label="Xóa minh chứng" onClick={async () => { await deleteEvidence(e.id); load(); }} className="text-[11px] text-slate-500 hover:underline inline-flex items-center gap-0.5">
                        <Trash2 className="w-3 h-3" /> Xóa
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {adding && profile && (
        <Modal isOpen onClose={() => setAdding(false)} title="Thêm minh chứng chuyên môn" maxWidth="lg">
          <EvidenceForm
            onCancel={() => setAdding(false)}
            onSubmit={async (e) => {
              await createEvidence(e, profile);
              setAdding(false);
              showToast('Đã thêm, chờ BGH xác nhận.', 'success');
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
};

const Tile: React.FC<{ label: string; labelEn?: string; value: string; sub?: string; testId: string }> = ({ label, labelEn, value, sub, testId }) => (
  <div data-testid={testId} className="bg-white border border-slate-200 rounded-xl p-3.5 break-inside-avoid">
    <p className="text-[11px] font-semibold text-slate-500">
      {labelEn ? <Bi vi={label} en={labelEn} /> : label}
    </p>
    <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const EvidenceForm: React.FC<{
  onSubmit: (e: Omit<TeacherEvidence, 'id' | 'uid' | 'teacherName' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EvidenceType>('sang_kien');
  const [level, setLevel] = useState<EvidenceLevel>('truong');
  const [date, setDate] = useState(localToday());
  const [description, setDescription] = useState('');
  const [linksText, setLinksText] = useState('');
  const [busy, setBusy] = useState(false);
  const links = linksText.split(/\s+/).filter(Boolean);
  const errors = validateEvidence({ title, date, description, links });
  const field = 'w-full text-sm border border-slate-300 rounded-lg p-2';
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (errors.length) return; setBusy(true); try { await onSubmit({ title, type, level, date, description, links }); } finally { setBusy(false); } }}>
      <div><label htmlFor="ev-title" className="block text-xs font-semibold text-slate-700 mb-1">Tên minh chứng</label><input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field} /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><label htmlFor="ev-type" className="block text-xs font-semibold text-slate-700 mb-1">Loại</label>
          <select id="ev-type" value={type} onChange={(e) => setType(e.target.value as EvidenceType)} className={field}>{Object.entries(EVIDENCE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label htmlFor="ev-level" className="block text-xs font-semibold text-slate-700 mb-1">Cấp</label>
          <select id="ev-level" value={level} onChange={(e) => setLevel(e.target.value as EvidenceLevel)} className={field}>{Object.entries(EVIDENCE_LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label htmlFor="ev-date" className="block text-xs font-semibold text-slate-700 mb-1">Ngày</label><input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></div>
      </div>
      <div><label htmlFor="ev-desc" className="block text-xs font-semibold text-slate-700 mb-1">Mô tả</label><textarea id="ev-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={field} /></div>
      <div><label htmlFor="ev-links" className="block text-xs font-semibold text-slate-700 mb-1">Liên kết (mỗi dòng 1 link https://)</label><textarea id="ev-links" rows={2} value={linksText} onChange={(e) => setLinksText(e.target.value)} className={field} /></div>
      {errors.length > 0 && <ul data-testid="ev-errors" className="text-xs text-red-700">{errors.map((m) => <li key={m}>• {m}</li>)}</ul>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-xs rounded-lg border border-slate-200">Hủy</button>
        <button type="submit" disabled={busy || errors.length > 0} className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold disabled:opacity-40">Lưu minh chứng</button>
      </div>
    </form>
  );
};
