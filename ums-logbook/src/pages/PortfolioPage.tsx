/**
 * UMS SmartConnect - Hồ sơ năng lực số (ePortfolio)
 * HS: nộp minh chứng (AI nhận xét offline). PH: xem. GV: duyệt / trả lại, kiểm lại điểm AI. In "Hộ chiếu năng lực".
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Printer, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { Bi } from '../components/common/Bi';
import { BrandMark } from '../components/common/BrandMark';
import { FAMILY_ROLES } from '../types/auth';
import type { PortfolioItem } from '../types/portfolio';
import { fetchLinkedStudents, type LinkedStudent } from '../services/familyService';
import {
  createPortfolioItem,
  deletePortfolioItem,
  fetchPendingPortfolio,
  fetchPortfolioForStudent,
  resubmitPortfolioItem,
  reviewPortfolioItem,
} from '../services/portfolioService';
import { gradeFromClass, runAi } from '../utils/portfolio';
import { AiResultView, CompetencyBars, PortfolioForm, PortfolioItemCard } from '../components/portfolio/PortfolioParts';

/** Kiểm lại điểm AI đã lưu bằng cách chấm lại (bộ chấm xác định) — phát hiện dữ liệu bị sửa. */
export function aiMismatch(item: PortfolioItem): boolean {
  if (!item.ai) return false;
  try {
    const again = runAi(item, gradeFromClass(item.classId));
    return again.total_score !== item.ai.total_score || again.content_depth !== item.ai.content_depth;
  } catch {
    return true;
  }
}

export const PortfolioPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const isFamily = activeRole != null && FAMILY_ROLES.includes(activeRole);
  return isFamily ? <FamilyPortfolio key={profile?.uid} /> : <StaffPortfolio />;
};

// ---------------------------------------------------------------------------

const FamilyPortfolio: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const isStudent = activeRole === 'student';
  const [student, setStudent] = useState<LinkedStudent | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);

  const load = useCallback(async () => {
    const [s] = await fetchLinkedStudents(profile?.studentDocIds);
    setStudent(s ?? null);
    if (s) setItems(await fetchPortfolioForStudent(s.mhs));
    setLoading(false);
  }, [profile?.studentDocIds]);

  useEffect(() => {
    load().catch((e) => {
      console.error(e);
      setLoading(false);
    });
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Đang tải…</p>;
  if (!student) return <p className="text-sm text-slate-600">Tài khoản chưa liên kết hồ sơ học sinh.</p>;

  return (
    <div className="space-y-5">
      <Header
        title={`Hồ sơ năng lực số — ${student.fullName}`}
        titleEn={`Student ePortfolio — ${student.fullName}`}
        sub={`Lớp ${student.className}`}
        subEn={`Class ${student.className}`}
      >
        <Link to="/portfolio/passport" state={{ mhs: student.mhs }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700">
          <Printer className="w-4 h-4" /> <Bi vi="Hộ chiếu năng lực" en="Competency Passport" />
        </Link>
        {isStudent && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#8B1A4A] text-white">
            <Plus className="w-4 h-4" /> <Bi vi="Nộp minh chứng" en="Submit Evidence" />
          </button>
        )}
      </Header>
      <CompetencyBars items={items} />
      {items.length === 0 && <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">Chưa có minh chứng nào.</p>}
      <ul className="space-y-2">
        {items.map((it) => (
          <PortfolioItemCard key={it.id} item={it}>
            {isStudent && it.status !== 'approved' && (
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(it)} className="text-[11px] text-sky-700 hover:underline">Sửa & nộp lại</button>
                {it.status === 'submitted' && (
                  <button type="button" onClick={async () => { await deletePortfolioItem(it.id); showToast('Đã xóa.', 'success'); load(); }} className="text-[11px] text-slate-500 hover:underline">Xóa</button>
                )}
              </div>
            )}
          </PortfolioItemCard>
        ))}
      </ul>

      {(creating || editing) && profile && activeRole && (
        <Modal isOpen onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Sửa minh chứng' : 'Nộp minh chứng mới'} maxWidth="xl">
          <PortfolioForm
            gradeLevel={student.grade ?? gradeFromClass(student.className)}
            initial={editing ?? undefined}
            onCancel={() => { setCreating(false); setEditing(null); }}
            onSubmit={async (input, ai) => {
              if (editing) await resubmitPortfolioItem(editing.id, input, ai);
              else await createPortfolioItem({ input, ai, student: { mhs: student.mhs, docId: student.docId, name: student.fullName, classId: student.className }, author: profile, authorRole: activeRole });
              setCreating(false);
              setEditing(null);
              showToast('Đã nộp, chờ giáo viên duyệt.', 'success');
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const StaffPortfolio: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const onlyClass = activeRole === 'gvcn' ? profile?.assignedClassId : undefined;
  const [queue, setQueue] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setQueue(await fetchPendingPortfolio(onlyClass));
    setLoading(false);
  }, [onlyClass]);

  useEffect(() => {
    load().catch((e) => {
      console.error(e);
      setLoading(false);
    });
  }, [load]);

  return (
    <div className="space-y-5">
      <Header
        title="Duyệt hồ sơ năng lực học sinh"
        titleEn="Student ePortfolio Review"
        sub={onlyClass ? `Lớp chủ nhiệm ${onlyClass}` : 'Toàn trường'}
        subEn={onlyClass ? `Homeroom Class ${onlyClass}` : 'School-wide'}
      />
      {loading && <p className="text-sm text-slate-500">Đang tải…</p>}
      {!loading && queue.length === 0 && <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">Không có minh chứng chờ duyệt.</p>}
      <ul className="space-y-2">
        {queue.map((it) => (
          <PortfolioItemCard key={it.id} item={it}>
            <p className="text-[11px] text-slate-600">
              <b>{it.studentName}</b> • Lớp {it.classId} •{' '}
              <Link to="/portfolio/passport" state={{ mhs: it.mhs }} className="text-sky-700 hover:underline">Xem hộ chiếu năng lực</Link>
            </p>
            {it.reflection && <p className="text-[11px] text-slate-600"><b>Phản tư:</b> {it.reflection}</p>}
            {aiMismatch(it) && (
              <p data-testid={`ai-mismatch-${it.id}`} className="text-[11px] text-red-700 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Điểm AI đã lưu không khớp khi chấm lại — có thể đã bị chỉnh sửa. Hãy dựa vào nhận xét của GV.</p>
            )}
            {it.ai && <AiResultView ai={it.ai} />}
            {profile && <ReviewBox onReview={async (ok, comment, score) => { await reviewPortfolioItem(it.id, ok, comment, score, profile); showToast(ok ? 'Đã duyệt vào hồ sơ.' : 'Đã trả lại cho HS.', 'success'); load(); }} />}
          </PortfolioItemCard>
        ))}
      </ul>
    </div>
  );
};

const ReviewBox: React.FC<{ onReview: (approve: boolean, comment: string, score: number | null) => Promise<void> }> = ({ onReview }) => {
  const [comment, setComment] = useState('');
  const [score, setScore] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (ok: boolean) => { setBusy(true); try { await onReview(ok, comment, score === '' ? null : Number(score)); } finally { setBusy(false); } };
  return (
    <div className="flex items-center gap-2 flex-wrap pt-1">
      <input aria-label="Nhận xét của GV" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nhận xét của giáo viên" className="flex-1 min-w-48 text-xs border border-slate-300 rounded-lg p-1.5" />
      <input aria-label="Điểm GV" type="number" min={0} max={10} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} placeholder="Điểm" className="w-16 text-xs border border-slate-300 rounded-lg p-1.5" />
      <button type="button" disabled={busy} onClick={() => go(true)} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50">Duyệt vào hồ sơ</button>
      <button type="button" disabled={busy || !comment.trim()} onClick={() => go(false)} className="px-2.5 py-1.5 text-[11px] rounded-lg border border-red-300 text-red-700 font-semibold disabled:opacity-40">Trả lại</button>
    </div>
  );
};

const Header: React.FC<{ title: string; titleEn?: string; sub: string; subEn?: string; children?: React.ReactNode }> = ({ title, titleEn, sub, subEn, children }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <div className="p-1 rounded-xl bg-slate-50 border border-slate-100 shrink-0"><BrandMark app="eportfolio" size={36} /></div>
    <div>
      <h2 className="text-base font-bold text-slate-900">
        {titleEn ? <Bi vi={title} en={titleEn} /> : title}
      </h2>
      <p className="text-xs text-slate-500">
        {subEn ? <Bi vi={sub} en={subEn} /> : sub}
      </p>
    </div>
    <div className="ml-auto flex gap-2">{children}</div>
  </div>
);

// Dùng cho trang in hộ chiếu
export { AiResultView };
