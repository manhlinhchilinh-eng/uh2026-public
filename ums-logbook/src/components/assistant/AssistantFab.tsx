/**
 * Trợ lý UMS+ — nút nổi + khung hỏi đáp (đặc tả DAC_TA_TRO_LY mục 6).
 * Trả lời từ bộ câu hỏi nhà trường đã duyệt, chạy ngay trong trình duyệt (không AI ngoài).
 * Câu hỏi về thông báo/văn bản: tìm trong thông báo đã có trong RAM + văn bản Hành chính (cache, chỉ nhân sự)
 * qua utils/assistant/noticeAnswer. Số liệu điểm danh trong ngày: utils/assistant/statsAnswer (BGH/GT/TPT toàn trường,
 * GVCN chỉ lớp mình — đọc riêng 1 lớp). Mọi quyết định nằm ở utils/assistant (hàm thuần, có test).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, ThumbsDown, ThumbsUp, X, ExternalLink, Building2, Search, LogIn, Bug, UserRound, BookOpen, Lightbulb, Loader2 } from 'lucide-react';
import { FeedbackForm } from './FeedbackForm';
import { DocAnswerCard } from './DocAnswerCard';
import { StatsAnswerCard, type StatsReply } from './StatsAnswerCard';
import type { FeedbackKind } from '../../utils/feedback';
import faq from '../../data/assistantFaq.json';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import {
  buildIndex,
  escalateDepartments,
  match,
  quickSuggestions,
  type AssistantResult,
  type AssistantRole,
  type BiStr,
  type Department,
  type FaqData,
  type FaqItem,
} from '../../utils/assistant/assistantMatcher';
import { allowedPathsForRole } from '../../utils/assistant/assistantPaths';
import { findStudents, logbookLink, parseQuery, studentLookupClass, type MissingFeature } from '../../utils/assistant/entities';
import { answerFromDocs, looksLikeNewsQuestion, type DocAnswer } from '../../utils/assistant/noticeAnswer';
import { toKnowledgeDocs } from '../../utils/assistant/knowledgeDocs';
import {
  canSeeSchoolStats,
  computeAttendanceStats,
  detectStat,
  formatAttendance,
  hasSchoolScopeCue,
  hasStatScopeCue,
} from '../../utils/assistant/statsAnswer';
import { buildAttendanceBoard } from '../../utils/periodAttendance';
import { getOffDayInfo } from '../../utils/schoolCalendar';
import { fetchClassAttendance, fetchSchoolAttendanceCached } from '../../services/schoolAttendanceService';
import { getClassSize, getClassSizes } from '../../services/classSizeCache';
import { ALL_CLASSES } from '../../services/logbookService';
import { fetchSchoolCalendar } from '../../services/schoolCalendarService';
import type { AdminDoc } from '../../utils/adminDocs';
import { fetchClassRosterStrict } from '../../services/rosterService';
import { getAdminDocsCached } from '../../services/adminDocCache';
import { useAnnouncements } from '../../context/AnnouncementsContext';
import { useOfficeNotices } from '../../context/OfficeNoticesContext';
import type { StudentDoc } from '../../types';

const index = buildIndex(faq as unknown as FaqData);
const INCLUDE_DRAFTS = import.meta.env.DEV;
const UNMATCHED_KEY = 'ums_assistant_unmatched';
const HINT_KEY = 'ums_assistant_hint_seen';
const LANG_KEY = 'ums_assistant_lang';
type AssistantLang = 'dual' | 'vi' | 'en';
/** PH/HS/khách không được đọc admin_docs (rules: isStaff() || isOffice()). */
const NO_ADMIN_DOCS: AssistantRole[] = ['parent', 'student', 'guest'];
const isFamilyRole = (r: AssistantRole) => r === 'parent' || r === 'student';

/** Trả lời bằng dữ liệu thật (Trợ lý hành động) — không qua bộ câu hỏi. */
type DataReply =
  | { type: 'loading'; what?: 'docs' | 'stats' }
  | { type: 'students'; classId: string; students: StudentDoc[] }
  | { type: 'denied'; reason: 'role' | 'other_class' | 'need_class'; own?: string; what: 'student' | 'logbook' | 'stats' }
  | { type: 'nodata'; classId: string }
  | { type: 'logbook'; path: string; classId: string; date: string; period: number | null }
  | { type: 'missing'; f: MissingFeature }
  /** Trả lời theo văn bản/thông báo; kind 'none' = PH/HS hỏi tin chưa có thông báo. */
  | { type: 'doc'; a: DocAnswer }
  /** Số liệu điểm danh trong ngày, hoặc 1 câu ngày nghỉ / lỗi tải. */
  | StatsReply;
type Msg = { id: number; q: string; r: AssistantResult; vote?: 'up' | 'down'; data?: DataReply };

function localIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const dmy = (iso?: string) =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso || '—';

/**
 * Số liệu điểm danh 1 ngày → thẻ trả lời. `school`: BGH/GT/TPT (bản toàn trường, cache dùng chung Vắng/muộn);
 * không thì GVCN đọc riêng lớp `classId` (~2 + số HS có ghi nhận). Ngày nghỉ BGH khai → không đọc điểm danh.
 * Lỗi đọc sĩ số không chặn câu trả lời (lớp hiện "Chưa có sĩ số"); lỗi đọc điểm danh → reject.
 */
async function loadAttendanceAnswer(opts: {
  school: boolean;
  classId: string | null;
  date: string;
  today: string;
}): Promise<StatsReply> {
  const { school, classId, date, today } = opts;
  const calendar = await fetchSchoolCalendar();
  if (getOffDayInfo(date, calendar).off) return { type: 'stats_note', note: 'offday', date };
  const [data, sizes] = school
    ? await Promise.all([fetchSchoolAttendanceCached(date), getClassSizes()])
    : await Promise.all([
        fetchClassAttendance(classId!, date),
        getClassSize(classId!)
          .catch(() => null)
          .then((n): Record<string, number> => (n ? { [classId!]: n } : {})),
      ]);
  const logbooks = classId ? data.logbooks.filter((b) => b.classId === classId) : data.logbooks;
  const students = classId ? data.students.filter((s) => s.classId === classId) : data.students;
  const rows = buildAttendanceBoard(classId ? [classId] : ALL_CLASSES, logbooks, students);
  const f = formatAttendance(computeAttendanceStats(rows, sizes, date, data.loadedAt, data.truncated), classId);
  const path = school ? '/vang-muon' : `/logbook?${new URLSearchParams({ classId: classId!, date }).toString()}`;
  return { type: 'stats', ...f, date, path, scope: school ? 'school' : 'class', today: date === today };
}

/** Ghi tối đa 50 câu chưa khớp trên máy (không gửi đi) để nhóm bổ sung bộ câu hỏi. */
function rememberUnmatched(q: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(UNMATCHED_KEY) || '[]');
    list.unshift(q.slice(0, 200));
    localStorage.setItem(UNMATCHED_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua */
  }
}

export const AssistantFab: React.FC = () => {
  const { activeRole, profile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  // Ngoài AppLayout (trang đăng nhập) 2 context trả giá trị rỗng mặc định, không lỗi.
  const { items: announcements } = useAnnouncements();
  const { notices: officeNotices } = useOfficeNotices();
  const [fb, setFb] = useState<{ kind: FeedbackKind; question?: string } | null>(null);
  const role: AssistantRole = activeRole || 'guest';
  // Song ngữ trong khung Trợ lý: mặc định Tiếng Việt chính + tiếng Anh nhỏ bên dưới; đổi được VI+EN / VI / EN.
  const [lang, setLangState] = useState<AssistantLang>(() => {
    try {
      const v = localStorage.getItem(LANG_KEY);
      if (v === 'dual' || v === 'vi' || v === 'en') return v;
    } catch {
      /* bỏ qua */
    }
    return language === 'en' ? 'en' : 'dual';
  });
  const setLang = (v: AssistantLang) => {
    setLangState(v);
    try {
      localStorage.setItem(LANG_KEY, v);
    } catch {
      /* bỏ qua */
    }
  };
  const vi = lang !== 'en';
  const t = (b?: BiStr | null) => (b ? (vi ? b.vi : b.en || b.vi) : '');
  /** 1 cặp VI/EN theo chế độ: VI+EN = Việt chính, Anh nhỏ bên dưới. */
  const L = (v: string, e: string): React.ReactNode =>
    lang === 'dual' && e && e !== v ? (
      <>
        {v}
        <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">{e}</span>
      </>
    ) : vi ? (
      v
    ) : (
      e || v
    );
  const T = (b?: BiStr | null): React.ReactNode => (b ? L(b.vi, b.en) : null);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hint, setHint] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  const allowedPaths = useMemo(
    () => allowedPathsForRole(activeRole, profile?.assignedClassId),
    [activeRole, profile?.assignedClassId]
  );
  const chips = useMemo(() => quickSuggestions(index, role, INCLUDE_DRAFTS), [role]);
  const roleLabel = t(index.data.role_labels[role]);

  // Đổi vai trò / đăng xuất → xóa hội thoại cũ (tránh hiện hướng dẫn của vai trò trước).
  useEffect(() => {
    setMsgs([]);
    setFb(null);
  }, [role]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_KEY)) setHint(true);
    } catch {
      /* bỏ qua */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const openPanel = () => {
    setOpen(true);
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* bỏ qua */
    }
  };

  const ask = (q: string) => {
    const query = q.trim();
    if (!query) return;
    setInput('');
    const r = match(index, query, { role, includeDrafts: INCLUDE_DRAFTS, allowedPaths });
    const id = nextId.current++;
    const push = (data?: DataReply) => setMsgs((m) => [...m, { id, q: query, r, data }]);
    const update = (patch: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const today = localIso();
    const p = parseQuery(query, today);
    if (p.missing) return push({ type: 'missing', f: p.missing });
    if (p.wantsLogbook) {
      const l = logbookLink(role, profile?.assignedClassId, p, today);
      return push('path' in l ? { type: 'logbook', ...l } : { type: 'denied', reason: l.denied, what: 'logbook' });
    }
    const stat = detectStat(p);
    // "bao nhiêu HS nghỉ" có chữ "hs" nhưng là câu hỏi số liệu → bỏ qua bước tra cứu 1 HS.
    if (p.wantsStudent && !stat && (role === 'gvcn' || role === 'admin')) {
      const c = studentLookupClass(role, profile?.assignedClassId, p.classId);
      if (!('classId' in c)) {
        // BGH hỏi chung không nêu lớp: để bộ câu hỏi trả lời nếu có.
        if (c.denied === 'need_class' && r.kind !== 'none') return push();
        return push({ type: 'denied', reason: c.denied, own: c.own, what: 'student' });
      }
      push({ type: 'loading' });
      fetchClassRosterStrict(c.classId)
        .then((roster) => {
          const found = roster ? findStudents(roster, p.norm) : [];
          if (found.length) return update({ data: { type: 'students', classId: c.classId, students: found.slice(0, 6) } });
          // Không thấy tên trong lớp → không đoán; trả kết quả bộ câu hỏi như thường.
          if (!roster && r.kind === 'none') return update({ data: { type: 'nodata', classId: c.classId } });
          if (r.kind === 'none' || r.kind === 'suggest') rememberUnmatched(query);
          update({ data: undefined });
        })
        .catch(() => update({ data: { type: 'nodata', classId: c.classId } }));
      return;
    }
    const school = canSeeSchoolStats(role);
    const own = role === 'gvcn' ? profile?.assignedClassId || null : null;
    // Ngày trong tương lai ("Nghỉ lễ 20/11 mấy ngày") chưa có điểm danh → bỏ hẳn nhánh số liệu (không đọc), sang văn bản/FAQ.
    const statNow = stat && !(stat.date && stat.date > today) ? stat : null;
    // Không có quyền xem: chỉ báo khi hỏi rõ phạm vi trường mà bộ câu hỏi không có câu trả lời; còn lại đi tiếp.
    if (statNow && !school && !own && r.kind === 'none' && hasSchoolScopeCue(p, null))
      return push({ type: 'denied', reason: 'role', what: 'stats' });
    // Câu trả lời FAQ đã duyệt thắng, trừ khi câu hỏi nêu rõ ngày/lớp/toàn trường.
    if (statNow && (school || own) && (r.kind !== 'answer' || hasStatScopeCue(p))) {
      const date = statNow.date || today;
      if (!school && statNow.classId && statNow.classId !== own)
        return push({ type: 'denied', reason: 'other_class', own: own!, what: 'stats' });
      const classId = school ? statNow.classId : own;
      // Cuối tuần biết ngay, không đọc gì.
      if (getOffDayInfo(date).off) return push({ type: 'stats_note', note: 'offday', date });
      push({ type: 'loading', what: 'stats' });
      loadAttendanceAnswer({ school, classId, date, today })
        .then((data) => update({ data }))
        .catch(() => update({ data: { type: 'stats_note', note: 'error', date } }));
      return;
    }
    const news = looksLikeNewsQuestion(p.norm);
    if (r.kind === 'answer' && !news) return push();
    // Bộ câu hỏi chưa chắc, hoặc câu hỏi về tin/văn bản → tìm trong thông báo + văn bản Hành chính.
    const fromDocsUnsafe = (adminDocs: AdminDoc[]): DataReply | undefined => {
      const docs = toKnowledgeDocs({ adminDocs, officeNotices, announcements });
      const a = answerFromDocs(query, docs, { ownClassId: profile?.assignedClassId, askedClassId: p.classId });
      if (a.kind !== 'none') return { type: 'doc', a };
      // Bộ câu hỏi đã trả lời chắc → giữ nguyên câu trả lời đó, không thay bằng "Chưa có thông báo".
      if (r.kind === 'answer') return undefined;
      if (isFamilyRole(role) && news) return { type: 'doc', a };
      if (r.kind === 'none' || r.kind === 'suggest') rememberUnmatched(query);
      return undefined;
    };
    // Văn bản hỏng dữ liệu làm hàm trả lời lỗi → quay về luồng bộ câu hỏi, không kẹt "Đang tìm…".
    const fromDocs = (adminDocs: AdminDoc[]): DataReply | undefined => {
      try {
        return fromDocsUnsafe(adminDocs);
      } catch {
        return undefined;
      }
    };
    const uid = profile?.uid;
    // Không có uid (chưa tải hồ sơ) → không có văn bản để đọc, trả lời ngay.
    if (NO_ADMIN_DOCS.includes(role) || !uid) return push(fromDocs([]));
    push({ type: 'loading', what: 'docs' });
    getAdminDocsCached(uid)
      .catch(() => [] as AdminDoc[]) // chưa có cache + mất mạng → coi như không có văn bản
      .then((adminDocs) => update({ data: fromDocs(adminDocs) }));
  };

  const vote = (id: number, v: 'up' | 'down') => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, vote: v } : x)));

  const go = (path: string) => {
    navigate(path);
    if (window.matchMedia('(max-width: 767px)').matches) setOpen(false);
  };

  const DeptCard: React.FC<{ d: Department; reason?: React.ReactNode; title?: React.ReactNode }> = ({ d, reason, title }) => (
    <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-900" data-testid="assistant-dept">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
        <Building2 className="w-3.5 h-3.5" /> {title || L('Liên hệ bộ phận', 'Contact')}
      </div>
      <div className="mt-1 font-semibold text-sm">{T(d.name)}</div>
      {vi && d.scope_vi && <div className="mt-0.5 text-xs text-sky-800/80">{d.scope_vi}</div>}
      {reason && <div className="mt-1.5 text-xs text-sky-800">{reason}</div>}
    </div>
  );

  const ActionButton: React.FC<{ item: FaqItem }> = ({ item }) => {
    const a = item.action;
    if (!a) return null;
    if (a.url)
      return (
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A4A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6B1338]"
        >
          {T(a.label)} <ExternalLink className="w-3.5 h-3.5" />
        </a>
      );
    return (
      <button
        type="button"
        onClick={() => go(a.path!)}
        data-testid="assistant-action"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A4A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6B1338]"
      >
        {T(a.label)} →
      </button>
    );
  };

  const FeedbackLink: React.FC<{ kind: FeedbackKind; question?: string; label?: React.ReactNode }> = ({ kind, question, label }) => (
    <button
      type="button"
      onClick={() => setFb({ kind, question })}
      data-testid="assistant-feedback-link"
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B1A4A] hover:underline"
    >
      <Bug className="w-3.5 h-3.5" /> {label || L('Báo lỗi / Góp ý', 'Report a bug / feedback')}
    </button>
  );

  const NavButton: React.FC<{ path: string; children: React.ReactNode; testId?: string }> = ({ path, children, testId }) => (
    <button
      type="button"
      onClick={() => go(path)}
      data-testid={testId}
      className="mt-2 mr-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A4A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6B1338]"
    >
      {children} →
    </button>
  );

  const StudentCard: React.FC<{ s: StudentDoc }> = ({ s }) => (
    <div className="mt-2 rounded-xl border border-ums-100 bg-white p-3" data-testid="assistant-student">
      <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-800">
        <UserRound className="w-4 h-4 text-[#8B1A4A]" /> {s.name}
      </div>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-600">
        <dt className="text-slate-400">{vi ? 'Lớp · STT' : 'Class · No.'}</dt>
        <dd>
          {s.classId} · {s.stt || '—'}
        </dd>
        <dt className="text-slate-400">{vi ? 'Mã HS' : 'Student ID'}</dt>
        <dd>{s.mhs || '—'}</dd>
        <dt className="text-slate-400">{vi ? 'Ngày sinh' : 'Date of birth'}</dt>
        <dd>{dmy(s.dob)}</dd>
        <dt className="text-slate-400">{vi ? 'Giới tính' : 'Gender'}</dt>
        <dd>{vi ? s.gender || '—' : s.gender === 'Nữ' ? 'Female' : s.gender === 'Nam' ? 'Male' : '—'}</dd>
      </dl>
      {allowedPaths.has('/behavior') && <NavButton path="/behavior">{L('Nề nếp & ghi chú', 'Conduct & notes')}</NavButton>}
      {allowedPaths.has('/attendance') && <NavButton path="/attendance">{L('Điểm danh', 'Attendance')}</NavButton>}
    </div>
  );

  const DataAnswer: React.FC<{ m: Msg; d: DataReply }> = ({ m, d }) => {
    switch (d.type) {
      case 'loading':
        return (
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />{' '}
            {d.what === 'docs'
              ? L('Đang tìm trong văn bản, thông báo…', 'Searching documents and notices…')
              : d.what === 'stats'
                ? L('Đang tải số liệu điểm danh…', 'Loading attendance figures…')
                : L('Đang tìm trong danh sách lớp…', 'Searching the class list…')}
          </p>
        );
      case 'students':
        return (
          <div data-testid="assistant-students">
            <p className="text-sm text-slate-700">
              {d.students.length > 1
                ? L(`Lớp ${d.classId} có ${d.students.length} bạn trùng tên:`, `${d.students.length} students in ${d.classId} share this name:`)
                : L(`Thông tin học sinh lớp ${d.classId}:`, `Student in ${d.classId}:`)}
            </p>
            {d.students.map((s) => (
              <StudentCard key={s.mhs || s.name} s={s} />
            ))}
            <p className="mt-2 text-[11px] text-slate-400">{L('Dữ liệu từ danh sách lớp trên UMS+.', 'From the UMS+ class list.')}</p>
          </div>
        );
      case 'logbook':
        return (
          <div data-testid="assistant-logbook">
            <p className="flex items-center gap-1.5 text-sm text-slate-700">
              <BookOpen className="w-4 h-4 shrink-0 text-[#8B1A4A]" />
              <span>
                {L(
                  `Sổ đầu bài lớp ${d.classId}, ngày ${dmy(d.date)}${d.period ? `, tiết ${d.period}` : ''}.`,
                  `Class ${d.classId} logbook, ${dmy(d.date)}${d.period ? `, period ${d.period}` : ''}.`
                )}
              </span>
            </p>
            <NavButton path={d.path} testId="assistant-open-logbook">
              {L('Mở sổ đầu bài', 'Open logbook')}
            </NavButton>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {L('Quyền xem/ký do trang sổ đầu bài kiểm tra.', 'View/sign rights are checked by the logbook page.')}
            </p>
          </div>
        );
      case 'missing':
        return (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" data-testid="assistant-missing">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
              <Lightbulb className="w-4 h-4 shrink-0" /> <span>{L(d.f.vi, d.f.en)}</span>
            </div>
            {d.f.altVi && <p className="mt-1 text-xs text-amber-900/80">{L(d.f.altVi, d.f.altEn || '')}</p>}
            {d.f.altPath && allowedPaths.has(d.f.altPath) && <NavButton path={d.f.altPath}>{L('Mở Sổ điểm', 'Open Gradebook')}</NavButton>}
            <FeedbackLink kind="idea" question={m.q} label={L('Gửi thành ý tưởng cho UMS+', 'Suggest this to UMS+')} />
          </div>
        );
      case 'nodata':
        return (
          <p className="text-sm text-slate-700" data-testid="assistant-nodata">
            {L(
              `Chưa tải được danh sách lớp ${d.classId} trên UMS+, nên Trợ lý không trả lời (không đoán). Thử lại sau ít phút.`,
              `Could not load the ${d.classId} class list, so the assistant will not guess. Try again in a few minutes.`
            )}
          </p>
        );
      case 'doc':
        if (d.a.kind === 'none') {
          const gvcn = index.departments.get('gvcn');
          return (
            <div data-testid="assistant-doc-none">
              <p className="text-sm text-slate-700">
                {L(
                  'Chưa có thông báo gửi phụ huynh/học sinh về nội dung này. Vui lòng liên hệ GVCN.',
                  'There is no notice for parents/students about this yet. Please contact the homeroom teacher.'
                )}
              </p>
              {gvcn && <DeptCard d={gvcn} />}
            </div>
          );
        }
        return <DocAnswerCard a={d.a} L={L} go={go} />;
      case 'stats':
      case 'stats_note':
        return <StatsAnswerCard d={d} L={L} go={go} />;
      case 'denied': {
        const msg =
          d.what === 'stats'
            ? d.reason === 'other_class'
              ? L(`Bạn chỉ xem được số liệu lớp chủ nhiệm (${d.own}).`, `You can only see figures for your homeroom (${d.own}).`)
              : L('Bạn không có quyền xem số liệu toàn trường.', 'You do not have access to school-wide figures.')
            : d.reason === 'other_class'
            ? L(`Bạn chỉ tra được học sinh lớp chủ nhiệm (${d.own}).`, `You can only look up students in your homeroom (${d.own}).`)
            : d.reason === 'need_class'
              ? d.what === 'logbook'
                ? L('Bạn muốn xem lớp nào? Ví dụ: "sổ đầu bài 9A2 tiết 3 hôm qua".', 'Which class? E.g. "logbook 9A2 period 3 yesterday".')
                : L('Bạn muốn tra học sinh lớp nào? Ví dụ: "thông tin bạn Minh Anh lớp 9A2".', 'Which class? E.g. "student Minh Anh 9A2".')
              : L('Tài khoản của bạn không tra cứu được dữ liệu này.', 'Your account cannot look up this data.');
        return (
          <p className="text-sm text-slate-700" data-testid="assistant-denied">
            {msg}
          </p>
        );
      }
    }
  };

  const Answer: React.FC<{ m: Msg }> = ({ m }) => {
    const d = m.data;
    // Văn bản không chắc (links) → hiện link, kèm kết quả bộ câu hỏi nếu có.
    if (d?.type === 'doc' && d.a.kind === 'links' && m.r.kind !== 'none')
      return (
        <>
          <DocAnswerCard a={d.a} L={L} go={go} />
          <FaqAnswer m={m} />
        </>
      );
    if (d) return <DataAnswer m={m} d={d} />;
    return <FaqAnswer m={m} />;
  };

  const FaqAnswer: React.FC<{ m: Msg }> = ({ m }) => {
    const { r } = m;
    const item = r.item;
    const draft = item?.status === 'cho_duyet';
    switch (r.kind) {
      case 'answer':
      case 'contact':
        return (
          <div>
            <div className="font-semibold text-sm text-slate-800">
              {T(item!.question)}
              {draft && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Nháp</span>}
            </div>
            {item!.answer && <p className="mt-1.5 text-sm text-slate-700 whitespace-pre-line">{T(item!.answer)}</p>}
            {!!item!.steps?.length && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {item!.steps.map((s, i) => (
                  <li key={i}>{T(s)}</li>
                ))}
              </ol>
            )}
            {item!.tip && <p className="mt-2 text-xs text-slate-500">💡 {T(item!.tip)}</p>}
            {r.actionAllowed && <ActionButton item={item!} />}
            {r.kind === 'contact' && r.department && (
              <DeptCard d={r.department} reason={L('Việc này không làm trên UMS+.', 'This is not done in UMS+.')} />
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              {m.vote ? (
                <span>{m.vote === 'up' ? L('Cảm ơn bạn!', 'Thanks!') : L('Vẫn cần hỗ trợ?', 'Still need help?')}</span>
              ) : (
                <>
                  <span>{L('Câu trả lời có đúng không?', 'Was this helpful?')}</span>
                  <button type="button" aria-label="Đúng" onClick={() => vote(m.id, 'up')} className="rounded p-1 hover:bg-slate-100">
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" aria-label="Chưa đúng" onClick={() => vote(m.id, 'down')} className="rounded p-1 hover:bg-slate-100" data-testid="assistant-down">
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            {m.vote === 'down' &&
              escalateDepartments(index, item).map((d) => <DeptCard key={d.id} d={d} title={L('Có thể hỏi', 'You can ask')} />)}
            {m.vote === 'down' && <FeedbackLink kind="bug" question={m.q} />}
          </div>
        );
      case 'suggest':
        return (
          <div>
            <div className="text-sm text-slate-700">{L('Có phải bạn muốn hỏi:', 'Did you mean:')}</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {r.suggestions!.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => ask(t(s.question))}
                  className="rounded-lg border border-ums-200 bg-white px-3 py-1.5 text-left text-xs text-[#8B1A4A] hover:bg-ums-50"
                >
                  {T(s.question)}
                </button>
              ))}
            </div>
          </div>
        );
      case 'other_role': {
        const labels = (r.ownerRoles || []).map((x) => index.data.role_labels[x]).filter(Boolean);
        const uniqVi = [...new Set(labels.map((x) => x.vi))].join(' / ');
        const uniqEn = [...new Set(labels.map((x) => x.en || x.vi))].join(' / ');
        return (
          <p className="text-sm text-slate-700">
            {L(
              `Việc này do ${uniqVi} làm trên UMS+. Tài khoản của bạn không có chức năng này.`,
              `This is done by ${uniqEn} in UMS+. Your account does not have this feature.`
            )}
          </p>
        );
      }
      case 'login_required':
        return (
          <p className="flex items-center gap-1.5 text-sm text-slate-700">
            <LogIn className="w-4 h-4 text-[#8B1A4A]" />
            <span>{L('Đăng nhập để xem hướng dẫn cho việc này.', 'Sign in to see how to do this.')}</span>
          </p>
        );
      default:
        return (
          <div className="rounded-xl border border-dashed border-slate-300 p-3" data-testid="assistant-none">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Search className="w-4 h-4" /> <span>{L('Chưa có câu trả lời', 'No answer yet')}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {vi
                ? 'Trợ lý chỉ trả lời từ bộ câu hỏi nhà trường đã duyệt, không đoán. Thử hỏi ngắn hơn, hoặc liên hệ:'
                : 'The assistant only answers from the school-approved list and never guesses. Try a shorter question, or contact:'}
            </p>
            {r.department && (
              <DeptCard
                d={r.department}
                title={L('Có thể hỏi', 'You can ask')}
                reason={L('Gợi ý theo từ khóa, không chắc chắn.', 'Suggested by keyword, not certain.')}
              />
            )}
            <FeedbackLink kind="question" question={m.q} label={L('Gửi câu hỏi này cho quản trị UMS+', 'Send this question to UMS+ admins')} />
          </div>
        );
    }
  };

  return (
    <>
      {!open && (
        <div className="fixed right-4 bottom-20 md:right-5 md:bottom-5 z-40 flex items-center gap-2 print:hidden">
          {hint && (
            <span className="hidden sm:block rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#8B1A4A] shadow-md ring-1 ring-ums-100">
              {vi ? 'Hỏi Trợ lý UMS+' : 'Ask UMS+ Assistant'}
            </span>
          )}
          <button
            type="button"
            onClick={openPanel}
            aria-label="Mở Trợ lý UMS+"
            data-testid="assistant-fab"
            className="h-14 w-14 rounded-full shadow-lg ring-2 ring-white transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DF3B7E] motion-reduce:transition-none"
          >
            <img src="/brand/logos/assistant/fab.svg" alt="" className="h-14 w-14 rounded-full" />
          </button>
        </div>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Trợ lý UMS+"
          data-testid="assistant-panel"
          className="fixed inset-0 z-[45] flex flex-col bg-white md:inset-auto md:right-5 md:bottom-5 md:h-[520px] md:w-[380px] md:rounded-2xl md:shadow-2xl md:ring-1 md:ring-slate-200 print:hidden"
        >
          <header className="flex items-center gap-2.5 border-b border-slate-100 bg-[#8B1A4A] px-4 py-3 text-white md:rounded-t-2xl">
            <img src="/brand/logos/assistant/logo.svg" alt="" className="h-8 w-8 rounded-full bg-white p-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight">{vi ? 'Trợ lý UMS+' : 'UMS+ Assistant'}</div>
              <div className="truncate text-[11px] text-white/80">
                {vi ? 'Đang hỏi với vai trò: ' : 'Asking as: '}
                {roleLabel}
              </div>
            </div>
            <div className="flex overflow-hidden rounded-md ring-1 ring-white/40 text-[10px] font-semibold" role="group" aria-label="Ngôn ngữ Trợ lý">
              {(['dual', 'vi', 'en'] as AssistantLang[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLang(k)}
                  aria-pressed={lang === k}
                  data-testid={`assistant-lang-${k}`}
                  className={`px-1.5 py-1 ${lang === k ? 'bg-white text-[#8B1A4A]' : 'text-white/85 hover:bg-white/15'}`}
                >
                  {k === 'dual' ? 'VI+EN' : k.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng Trợ lý" className="rounded-lg p-1.5 hover:bg-white/15">
              <X className="w-5 h-5" />
            </button>
          </header>

          {fb ? (
            <div className="flex-1 overflow-y-auto bg-white">
              <FeedbackForm vi={vi} initialKind={fb.kind} question={fb.question} page={location.pathname} onBack={() => setFb(null)} />
            </div>
          ) : (
          <>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            <div className="rounded-xl bg-white p-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-100">
              {L(
                'Xin chào! Mình là trợ lý UMS+. Hỏi mình cách làm việc trên UMS+ hoặc cần liên hệ bộ phận nào nhé. Ví dụ:',
                "Hi! I'm the UMS+ assistant. Ask me how to do things in UMS+ or which office to contact. For example:"
              )}
              {chips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => ask(t(c.question))}
                      className="rounded-full border border-ums-200 bg-ums-50 px-2.5 py-1 text-left text-xs text-[#8B1A4A] hover:bg-ums-100"
                    >
                      {T(c.question)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msgs.map((m) => (
              <div key={m.id} className="space-y-2">
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[#8B1A4A] px-3 py-2 text-sm text-white">{m.q}</div>
                <div className="max-w-[95%] rounded-2xl rounded-bl-sm bg-white p-3 shadow-sm ring-1 ring-slate-100" data-testid="assistant-reply">
                  <Answer m={m} />
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5"
          >
            <input
              ref={inputRef}
              id="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={200}
              placeholder={vi ? 'Nhập câu hỏi, vd: xin nghỉ ốm' : 'Type a question, e.g. request leave'}
              aria-label={vi ? 'Câu hỏi cho Trợ lý' : 'Question for the assistant'}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-ums-300 focus:bg-white focus:ring-2 focus:ring-ums-100"
            />
            <button
              type="submit"
              aria-label={vi ? 'Gửi' : 'Send'}
              className="rounded-lg bg-[#8B1A4A] p-2 text-white hover:bg-[#6B1338] disabled:opacity-40"
              disabled={!input.trim()}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between gap-2 px-3 pb-2 text-[10px] text-slate-400 md:rounded-b-2xl">
            <span>{L('Trả lời từ bộ câu hỏi nhà trường đã duyệt · không dùng AI bên ngoài', 'Answers from the school-approved list · no external AI')}</span>
            <button
              type="button"
              onClick={() => setFb({ kind: 'bug' })}
              data-testid="assistant-feedback-open"
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#8B1A4A] hover:underline"
            >
              <Bug className="w-3 h-3" /> {vi ? 'Báo lỗi / Góp ý' : 'Feedback'}
            </button>
          </div>
          </>
          )}
        </section>
      )}
    </>
  );
};
