import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { StudentDoc } from '../../types';
import {
  PeriodEntry,
  StudentAbsenceRecord,
  EarlyDepartureRecord,
} from '../../types/logbook';
import {
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  calculatePeriodTotal,
  getPeriodRating,
} from '../../utils/scoring';
import { ScoreInput } from './ScoreInput';
import { validatePeriodEntry } from '../../utils/validators';
import { AbsencePicker } from './AbsencePicker';
import { fetchClassRoster } from '../../services/rosterService';
import { CreateBehaviorNoteModal } from '../behavior/CreateBehaviorNoteModal';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  UserCheck,
  Plus,
  Save,
} from 'lucide-react';
import { formatDateVi } from '../../utils/dateFormat';
import { formatClock } from '../../utils/periodAttendance';
import { EslPeriodFields } from '../esl/EslPeriodFields';
import { fetchEslConfig } from '../../services/eslService';
import { DEFAULT_ESL_CONFIG, isEnglishSubject, normalizeEslTag, validateEslTag, type EslConfig, type EslTag } from '../../utils/eslPeriods';
import { leaveAbsencesForPeriods, mergeLeaveAbsences, LEAVE_APPROVED_NOTE, type ApprovedLeaveEntry } from '../../utils/studentLeave';
import { Bi } from '../common/Bi';
import { missingScoreKeys, scoringOptionalReason, type ScoreKey } from '../../utils/periodScoringRequirement';

export interface PeriodEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodIndex: number;
  classId: string;
  date: string;
  initialEntry?: PeriodEntry | null;
  scoringConfig?: ScoringConfig;
  onSave: (entry: PeriodEntry) => Promise<void>;
  currentUserName: string;
  currentUserId: string;
  baselineAbsences?: StudentAbsenceRecord[];
  baselineEarlyDepartures?: EarlyDepartureRecord[];
  /** Đơn PH đã duyệt trên sổ ngày — điền sẵn vắng P khi tiết chưa điểm danh */
  approvedLeaves?: Record<string, ApprovedLeaveEntry>;
  /** Tiết không bắt buộc chấm (lớp trộn, NN2, HĐTN, mặc định 10đ…) theo TKB — lý do hiển thị */
  scoringOptionalReason?: string | null;
}

// Mặc định ổn định (mảng mới mỗi lần render sẽ làm effect khởi tạo form chạy lặp vô hạn)
const NO_ABSENCES: StudentAbsenceRecord[] = [];
const NO_EARLY: EarlyDepartureRecord[] = [];

export const PeriodEntryModal: React.FC<PeriodEntryModalProps> = ({
  isOpen,
  onClose,
  periodIndex,
  classId,
  date,
  initialEntry,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  onSave,
  currentUserName,
  currentUserId,
  baselineAbsences = NO_ABSENCES,
  baselineEarlyDepartures = NO_EARLY,
  approvedLeaves,
  scoringOptionalReason: optionalFromTimetable = null,
}) => {
  const { t } = useLanguage();

  const [subject, setSubject] = useState('');
  const [ppctIndex, setPpctIndex] = useState<number | undefined>(undefined);
  const [lessonTopic, setLessonTopic] = useState('');
  const [comment, setComment] = useState('');
  const [signature, setSignature] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Điểm 4 tiêu chí — null = GV chưa chọn. Tiết chưa ký mở ra với ô TRỐNG (góp ý 05/11: trước đây điền sẵn 10đ
  // nên GV không chấm vẫn ký được). Tiết đã ký giữ nguyên điểm đã lưu.
  const [learning, setLearning] = useState<number | null>(null);
  const [discipline, setDiscipline] = useState<number | null>(null);
  const [hygiene, setHygiene] = useState<number | null>(null);
  const [customCriterion, setCustomCriterion] = useState<number | null>(null);

  // Attendance
  const [roster, setRoster] = useState<StudentDoc[]>([]);
  const [absents, setAbsents] = useState<StudentAbsenceRecord[]>([]);
  const [earlyDepartures, setEarlyDepartures] = useState<EarlyDepartureRecord[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isBehaviorModalOpen, setIsBehaviorModalOpen] = useState(false);
  // Tiết ESL — chỉ hiện khi BGH bật (system_settings/esl)
  const [eslConfig, setEslConfig] = useState<EslConfig>(DEFAULT_ESL_CONFIG);
  const [eslTag, setEslTag] = useState<EslTag | null>(null);

  // Esc để đóng (trừ khi đang mở hộp ghi nề nếp bên trong)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBehaviorModalOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isBehaviorModalOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    fetchEslConfig().then((c) => alive && setEslConfig(c));
    return () => {
      alive = false;
    };
  }, [isOpen]);

  // Load roster
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    fetchClassRoster(classId).then((r) => alive && setRoster(r));
    return () => {
      alive = false;
    };
  }, [classId, isOpen]);

  // Initialize or reset form state
  useEffect(() => {
    if (!isOpen) return;

    if (initialEntry && (initialEntry.subject || initialEntry.isSigned || initialEntry.attendanceTakenAt)) {
      // Existing entry
      setSubject(initialEntry.subject || '');
      setPpctIndex(initialEntry.ppctLessonIndex);
      setLessonTopic(initialEntry.lessonTopic || '');
      setComment(initialEntry.teacherComment || '');
      setSignature(initialEntry.teacherSignature || currentUserName);
      setIsConfirmed(initialEntry.isSigned || false);

      // Đã ký → giữ điểm đã lưu. Chưa ký (mới lưu điểm danh) → điểm trong doc chỉ là giá trị mặc định → để trống
      const signedBefore = initialEntry.isSigned === true;
      setLearning(signedBefore ? initialEntry.scores?.learning ?? scoringConfig.learningMax : null);
      setDiscipline(signedBefore ? initialEntry.scores?.discipline ?? scoringConfig.disciplineMax : null);
      setHygiene(signedBefore ? initialEntry.scores?.hygiene ?? scoringConfig.hygieneMax : null);
      setCustomCriterion(signedBefore ? initialEntry.scores?.customCriterion ?? scoringConfig.customMax : null);

      // Tiết chưa điểm danh, chưa ký → điền thêm HS có đơn; đã điểm danh/ký → giữ nguyên
      const saved = initialEntry.absentStudents || [];
      const notTaken = !initialEntry.attendanceTakenAt && !initialEntry.isSigned;
      setAbsents(notTaken ? mergeLeaveAbsences(saved, leaveAbsencesForPeriods(approvedLeaves, [periodIndex])) : saved);
      setEarlyDepartures(initialEntry.earlyDepartures || []);
      setEslTag(initialEntry.esl ?? null);
    } else {
      // Draft new entry: pre-populate with baseline if available!
      setSubject('');
      setPpctIndex(undefined);
      setLessonTopic('');
      setComment('');
      setSignature(currentUserName);
      setIsConfirmed(false);

      setLearning(null);
      setDiscipline(null);
      setHygiene(null);
      setCustomCriterion(null);
      setEslTag(null);

      // Pre-populate with baseline absences with 'baseline' tier flag
      const inherited = baselineAbsences.map((a) => ({
        ...a,
        reportedInTier: 'baseline' as const,
      }));
      setAbsents(mergeLeaveAbsences(inherited, leaveAbsencesForPeriods(approvedLeaves, [periodIndex])));
      setEarlyDepartures(baselineEarlyDepartures || []);
    }
  }, [
    isOpen,
    initialEntry,
    currentUserName,
    scoringConfig,
    baselineAbsences,
    baselineEarlyDepartures,
    approvedLeaves,
    periodIndex,
  ]);

  // Tiết không bắt buộc chấm: theo TKB (prop) hoặc theo tên môn GV gõ
  const optionalReason = useMemo(
    () => optionalFromTimetable || scoringOptionalReason(classId, [subject]),
    [optionalFromTimetable, classId, subject]
  );
  // Ô còn trống mà tiết này bắt buộc chấm
  const missingScores: ScoreKey[] = optionalReason ? [] : missingScoreKeys({ learning, discipline, hygiene, customCriterion });
  // Giá trị lưu: ô trống ở tiết không bắt buộc chấm → điểm tối đa (như trước, tổng 10đ)
  const L = learning ?? scoringConfig.learningMax;
  const D = discipline ?? scoringConfig.disciplineMax;
  const H = hygiene ?? scoringConfig.hygieneMax;
  const C = customCriterion ?? scoringConfig.customMax;

  // Computed live total & rating
  const liveTotal = useMemo(
    () => calculatePeriodTotal(L, D, H, C),
    [L, D, H, C]
  );

  const ratingInfo = useMemo(() => getPeriodRating(liveTotal), [liveTotal]);

  const validationResult = useMemo(() => {
    return validatePeriodEntry(
      {
        periodIndex,
        subject,
        ppctLessonIndex: ppctIndex,
        lessonTopic,
        scores: { learning: L, discipline: D, hygiene: H, customCriterion: C, total: liveTotal },
        teacherSignature: signature,
        absentStudents: absents,
        isSigned: isConfirmed,
      },
      scoringConfig
    );
  }, [
    periodIndex,
    subject,
    ppctIndex,
    lessonTopic,
    L,
    D,
    H,
    C,
    liveTotal,
    signature,
    absents,
    isConfirmed,
    scoringConfig,
  ]);

  if (!isOpen) return null;

  const alreadySigned = initialEntry?.isSigned === true;
  const attendanceTakenAt = initialEntry?.attendanceTakenAt;
  // "Lớp đủ (trừ N bạn có đơn)": chỉ hiện khi có ≥ 1 HS có đơn và danh sách vắng hiện tại toàn là HS có đơn
  // (nhãn luôn đúng sự thật; sổ không có đơn giữ nguyên giao diện cũ)
  const leaveOnly = absents.every((a) => a.type === 'P' && a.note === LEAVE_APPROVED_NOTE);
  const leaveCount = absents.length;

  /** Đầu tiết: lưu điểm danh ngay (chưa ký) để giám thị, GVCN thấy. */
  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      setErrorBanner(null);
      const now = Date.now();
      const entry: PeriodEntry = {
        id: `${periodIndex}`,
        dailyId: `${classId}_${date}`,
        periodIndex,
        subject: subject.trim(),
        ppctLessonIndex: ppctIndex,
        lessonTopic: lessonTopic.trim(),
        teacherId: currentUserId,
        teacherName: currentUserName,
        absentStudents: absents,
        earlyDepartures,
        scores: { learning: L, discipline: D, hygiene: H, customCriterion: C, total: liveTotal },
        teacherComment: comment.trim(),
        teacherSignature: signature.trim() || currentUserName,
        isSigned: false,
        attendanceTakenAt: now,
        attendanceTakenBy: currentUserId,
        attendanceTakenByName: currentUserName,
        updatedAt: now,
      };
      await onSave(entry);
      onClose();
    } catch (err: any) {
      setErrorBanner(err.message || 'Lỗi khi lưu điểm danh');
    } finally {
      setSaving(false);
    }
  };

  const SCORE_LABEL: Record<ScoreKey, string> = {
    learning: 'Học tập',
    discipline: 'Kỷ luật',
    hygiene: 'Vệ sinh',
    customCriterion: scoringConfig.customLabel,
  };
  const missingText = missingScores.map((k) => SCORE_LABEL[k]).join(', ');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingScores.length > 0) {
      setErrorBanner(`Chưa chấm điểm: ${missingText}. Chọn đủ 4 tiêu chí trước khi ký sổ.`);
      const el = document.getElementById(`score-${missingScores[0]}`);
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
      return;
    }
    if (!validationResult.isValid) {
      setErrorBanner(validationResult.errors[0]?.messageVi || 'Dữ liệu không hợp lệ');
      return;
    }
    const eslError = eslConfig.enabled ? validateEslTag(eslTag, eslConfig.option) : null;
    if (eslError) {
      setErrorBanner(eslError);
      return;
    }

    try {
      setSaving(true);
      setErrorBanner(null);
      const entry: PeriodEntry = {
        id: `${periodIndex}`,
        dailyId: `${classId}_${date}`,
        periodIndex,
        subject: subject.trim(),
        ppctLessonIndex: ppctIndex,
        lessonTopic: lessonTopic.trim(),
        teacherId: currentUserId,
        teacherName: currentUserName,
        absentStudents: absents,
        earlyDepartures,
        scores: { learning: L, discipline: D, hygiene: H, customCriterion: C, total: liveTotal },
        teacherComment: comment.trim(),
        teacherSignature: signature.trim() || currentUserName,
        isSigned: true,
        signedAt: Date.now(),
        attendanceTakenAt: attendanceTakenAt ?? Date.now(),
        attendanceTakenBy: initialEntry?.attendanceTakenBy || currentUserId,
        attendanceTakenByName: initialEntry?.attendanceTakenByName || currentUserName,
        updatedAt: Date.now(),
        // ESL đang tắt → không gửi trường esl (giữ nguyên dữ liệu cũ nếu có)
        ...(eslConfig.enabled ? { esl: normalizeEslTag(eslTag, eslConfig.option) } : {}),
      };
      await onSave(entry);
      onClose();
    } catch (err: any) {
      setErrorBanner(err.message || 'Lỗi khi lưu sổ tiết học');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ghi sổ đầu bài tiết ${periodIndex} lớp ${classId}`}
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-[#8B1A4A] text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-pink-200">
              Lớp {classId} • Ngày {formatDateVi(date)}
            </span>
            <h2 className="text-base sm:text-lg font-bold">
              Ghi Sổ Đầu Bài: Tiết {periodIndex}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng (Esc)"
            title="Đóng (Esc)"
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
          {/* Bước 2 — Cuối tiết: bài học, điểm, nhận xét, về sớm, nề nếp → ký sổ */}
          <div className="space-y-3" data-testid="step-sign">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#8B1A4A]" /> ② Cuối tiết — Ghi bài dạy &amp; ký sổ
          </h3>
          {errorBanner && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Academic Info */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label htmlFor="period-subject-input" className="block text-xs font-bold text-slate-700 mb-1">
                {t.logbook.subject} <span className="text-rose-500">*</span>
              </label>
              <input
                id="period-subject-input"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="VD: Toán học, Ngữ văn, Tiếng Anh..."
                className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#8B1A4A]"
              />
            </div>
            <div>
              <label htmlFor="period-ppct-input" className="block text-xs font-bold text-slate-700 mb-1">
                {t.logbook.ppctLesson}
              </label>
              <input
                id="period-ppct-input"
                type="number"
                min="1"
                value={ppctIndex !== undefined ? ppctIndex : ''}
                onChange={(e) =>
                  setPpctIndex(e.target.value ? parseInt(e.target.value, 10) : undefined)
                }
                placeholder="VD: 14"
                className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#8B1A4A]"
              />
            </div>
            <div className="col-span-3">
              <label htmlFor="period-lesson-topic-input" className="block text-xs font-bold text-slate-700 mb-1">
                {t.logbook.lessonTopic} <span className="text-rose-500">*</span>
              </label>
              <input
                id="period-lesson-topic-input"
                type="text"
                required
                value={lessonTopic}
                onChange={(e) => setLessonTopic(e.target.value)}
                placeholder="VD: Luyện tập giải phương trình bậc nhất một ẩn"
                className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#8B1A4A]"
              />
            </div>
          </div>

          {eslConfig.enabled && (
            <div className="space-y-1">
              <EslPeriodFields mode={eslConfig.option} value={eslTag} onChange={setEslTag} />
              {eslTag && isEnglishSubject(subject) && (
                <p className="text-[10.5px] text-amber-700">
                  Môn tiếng Anh/ngoại ngữ không tính vào chỉ tiêu "môn dạy bằng tiếng Anh" (chuẩn tính môn ngoài tiếng Anh).
                </p>
              )}
            </div>
          )}

          {/* Teacher Comment */}
          <div>
            <label htmlFor="period-comment-textarea" className="block text-xs font-bold text-slate-700 mb-1">
              {t.logbook.comment}
            </label>
            <textarea
              id="period-comment-textarea"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhận xét tình hình học tập và nề nếp của lớp trong tiết..."
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-[#8B1A4A]"
            />
          </div>

          {/* 4-Criteria Scoring Box with Live Rating Display */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2" data-testid="score-box">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-[#8B1A4A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {t.scoring.totalScore}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setLearning(scoringConfig.learningMax);
                    setDiscipline(scoringConfig.disciplineMax);
                    setHygiene(scoringConfig.hygieneMax);
                    setCustomCriterion(scoringConfig.customMax);
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-full font-bold border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  title="Chấm nhanh 10 điểm — tất cả tiêu chí đạt tối đa"
                >
                  ⚡ 10đ
                </button>
                {missingScores.length > 0 ? (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold border border-rose-300 bg-rose-50 text-rose-700" data-testid="score-incomplete">
                    Chưa chấm đủ ({4 - missingScores.length}/4)
                  </span>
                ) : (
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold border ${ratingInfo.badgeClass}`}
                  >
                    {ratingInfo.labelVi} ({liveTotal}/10đ)
                  </span>
                )}
              </div>
            </div>

            {optionalReason ? (
              <p className="text-[11px] text-slate-500" data-testid="score-optional">
                {optionalReason}: không bắt buộc chấm — để trống sẽ tính 10đ.
              </p>
            ) : (
              <p className={`text-[11px] ${missingScores.length ? 'text-rose-700 font-semibold' : 'text-slate-500'}`} data-testid="score-required">
                {missingScores.length ? `Bắt buộc chấm đủ 4 tiêu chí trước khi ký — còn thiếu: ${missingText}.` : 'Đã chấm đủ 4 tiêu chí.'}
              </p>
            )}
            {/* 4 Inputs */}
            <div className="grid grid-cols-4 gap-1.5" data-testid="score-row">
              {/* Learning */}
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 min-w-0">
                <div className="flex justify-between items-baseline gap-1 mb-1">
                  <span className="text-[11px] font-semibold text-slate-600 truncate">Học tập</span>
                  <span className="text-[10px] text-slate-400 shrink-0" title="Tối đa">/{scoringConfig.learningMax}</span>
                </div>
                <ScoreInput id="score-learning" invalid={missingScores.includes('learning')} value={learning} max={scoringConfig.learningMax} onChange={setLearning} label="Học tập" />
              </div>

              {/* Discipline */}
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 min-w-0">
                <div className="flex justify-between items-baseline gap-1 mb-1">
                  <span className="text-[11px] font-semibold text-slate-600 truncate">Kỷ luật</span>
                  <span className="text-[10px] text-slate-400 shrink-0" title="Tối đa">/{scoringConfig.disciplineMax}</span>
                </div>
                <ScoreInput id="score-discipline" invalid={missingScores.includes('discipline')} value={discipline} max={scoringConfig.disciplineMax} onChange={setDiscipline} label="Kỷ luật" />
              </div>

              {/* Hygiene */}
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 min-w-0">
                <div className="flex justify-between items-baseline gap-1 mb-1">
                  <span className="text-[11px] font-semibold text-slate-600 truncate">Vệ sinh</span>
                  <span className="text-[10px] text-slate-400 shrink-0" title="Tối đa">/{scoringConfig.hygieneMax}</span>
                </div>
                <ScoreInput id="score-hygiene" invalid={missingScores.includes('hygiene')} value={hygiene} max={scoringConfig.hygieneMax} onChange={setHygiene} label="Vệ sinh" />
              </div>

              {/* Configurable 4th */}
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 min-w-0">
                <div className="flex justify-between items-baseline gap-1 mb-1">
                  <span
                    className="text-[11px] font-semibold text-slate-600 truncate"
                    title={scoringConfig.customLabel}
                  >
                    {scoringConfig.customLabel}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0" title="Tối đa">/{scoringConfig.customMax}</span>
                </div>
                <ScoreInput id="score-customCriterion" invalid={missingScores.includes('customCriterion')} value={customCriterion} max={scoringConfig.customMax} onChange={setCustomCriterion} label={scoringConfig.customLabel} />
              </div>
            </div>

            {liveTotal > 10.0 && (
              <p className="text-[11px] font-bold text-rose-600 text-center">
                Tổng điểm {liveTotal} vượt quá mức trần 10.0 điểm! Vui lòng điều chỉnh lại.
              </p>
            )}
          </div>

          {/* HS về sớm: GVCN ghi ở "Điểm danh đầu giờ" (góp ý 05/11). Dữ liệu cũ ghi trong tiết vẫn giữ nguyên & chỉ đọc. */}
          {earlyDepartures.length > 0 && (
            <p data-testid="legacy-early-departures" className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              Về sớm (ghi trước đây trong tiết): {earlyDepartures.map((e) => `${e.studentName}${e.departedAt ? ` ${e.departedAt}` : ''}`).join(', ')}
            </p>
          )}
          {/* Quick In-Period Behavior Note Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-pink-50/70 border border-pink-200 gap-2">
            <div className="flex items-center space-x-2 text-xs text-[#8B1A4A]">
              <Award className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Ghi nhận hành vi, nề nếp hoặc biểu dương học sinh trong tiết</span>
            </div>
            <button
              type="button"
              onClick={() => setIsBehaviorModalOpen(true)}
              className="px-3 py-1.5 bg-[#8B1A4A] text-white hover:bg-[#72153c] rounded-lg text-xs font-bold flex items-center justify-center space-x-1 shadow-2xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi nhận nề nếp tiết {periodIndex}</span>
            </button>
          </div>

          </div>
          {/* Bước 1 — Đầu tiết: điểm danh (lưu ngay, chưa cần ký) */}
          <div className="space-y-3 order-first lg:sticky lg:top-0" data-testid="step-attendance">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <label className="text-xs font-bold text-slate-800">
                  ① Đầu tiết — Điểm danh tiết {periodIndex}
                </label>
              </div>
              {attendanceTakenAt && (
                <span className="text-[11px] font-semibold text-emerald-700" data-testid="attendance-taken-at">
                  Đã lưu lúc {formatClock(attendanceTakenAt)}
                </span>
              )}
            </div>
            <AbsencePicker
              roster={roster}
              absences={absents}
              onChange={setAbsents}
              readOnly={saving}
              showBaselineOrigin={true}
            />
            {!alreadySigned && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <p className="text-[11px] text-emerald-800">
                  Lưu ngay đầu giờ để giám thị và GVCN nắm sĩ số. Chưa cần nhập bài dạy hay chấm điểm — ký sổ ở cuối tiết.
                </p>
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={saving}
                  data-testid="save-attendance"
                  className="w-full px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Đang lưu...' : attendanceTakenAt ? 'Cập nhật điểm danh' : 'Lưu điểm danh'}</span>
                </button>
                {!attendanceTakenAt && leaveOnly && leaveCount > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={saving}
                    data-testid="quick-attendance"
                    className="w-full px-4 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <Bi layout="inline" vi={`Lớp đủ (trừ ${leaveCount} bạn có đơn)`} en={`All present (except ${leaveCount} with leave)`} />
                  </button>
                )}
              </div>
            )}
          </div>
          </div>
          {/* Chân form luôn hiện: ký + lưu */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
          {/* Digital Signature Confirmation */}
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <input
                id="sign-confirm"
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="w-4 h-4 text-[#8B1A4A] rounded border-slate-300 focus:ring-[#8B1A4A]"
              />
              <label
                htmlFor="sign-confirm"
                className="text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Xác nhận chữ ký điện tử giáo viên bộ môn
              </label>
            </div>
            <div className="text-xs font-bold text-[#8B1A4A] flex items-center space-x-1">
              <ShieldCheck className="w-4 h-4" />
              <span>{signature || currentUserName}</span>
            </div>
          </div>

            </div>
          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3">
            {missingScores.length > 0 && (
              <span className="text-[11px] font-semibold text-rose-700 max-w-[14rem]" data-testid="sign-blocked-hint">
                Chấm đủ điểm để ký (thiếu: {missingText})
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              data-testid="sign-submit"
              // Thiếu điểm: nút khóa (xám, aria-disabled) nhưng vẫn bấm được để báo + cuộn tới ô còn thiếu
              disabled={saving || (!validationResult.isValid && missingScores.length === 0)}
              aria-disabled={saving || !validationResult.isValid || missingScores.length > 0}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center space-x-2 transition-all ${
                validationResult.isValid && missingScores.length === 0 && !saving
                  ? 'bg-[#8B1A4A] hover:bg-[#72153c]'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Ký & Lưu Sổ'}</span>
            </button>
          </div>
          </div>
        </form>
      </div>

      {/* In-Period Create Behavior Note Modal */}
      <CreateBehaviorNoteModal
        isOpen={isBehaviorModalOpen}
        onClose={() => setIsBehaviorModalOpen(false)}
        classId={classId}
        periodIndex={periodIndex}
        subject={subject}
        roster={roster}
      />
    </div>
  );
};
