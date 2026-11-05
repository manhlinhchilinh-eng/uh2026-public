import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import {
  PeriodEntry,
  DailyLogbook,
  StudentAbsenceRecord,
  EarlyDepartureRecord,
} from '../../types/logbook';
import { ScoringConfig, DEFAULT_SCORING_CONFIG } from '../../utils/scoring';
import { formatDateVi } from '../../utils/dateFormat';
import { UMS_BELL_SCHEDULE } from './PeriodCard';
import { TimetablePeriodCard } from './TimetablePeriodCard';
import { UMS_BREAKS } from '../../utils/schedule';
import { PeriodEntryModal } from './PeriodEntryModal';
import { Sun, Moon, Clock, AlertTriangle, FileCheck2 } from 'lucide-react';
import { reconcileDaily } from '../../utils/studentLeave';
import { Bi } from '../common/Bi';
import { PdfExportButton } from '../summary/PdfExportButton';
import { weekNumberOf } from '../../utils/academicCalendar';

export interface DailyLogbookGridProps {
  classId: string;
  date: string;
  periods: PeriodEntry[];
  logbook?: DailyLogbook | null;
  canEditPeriod?: (periodIndex: number) => boolean;
  onSavePeriod: (entry: PeriodEntry) => Promise<void>;
  scoringConfig?: ScoringConfig;
  isLoading?: boolean;
  initialPeriodIndex?: number | null;
  /** periodIndex → nhãn "Dạy thay: …" (kế hoạch đã duyệt) */
  substituteLabels?: Record<number, string>;
  /** periodIndex → tiết lớp trộn */
  mixedPeriods?: Record<number, { mode: 'auto10' | 'skip'; noteUrl?: string }>;
  /** periodIndex → lý do tiết không bắt buộc chấm điểm (theo TKB) */
  scoringOptional?: Record<number, string>;
  /** Mở hộp điểm danh đầu buổi (nút trong hộp "Cần đối chiếu") */
  onOpenBaseline?: () => void;
}

/**
 * Calculates currently ongoing period based on date and local time
 */
export function getCurrentPeriodIndex(targetDateStr: string, now: Date = new Date()): number | null {
  const todayStr = now.toISOString().split('T')[0];
  if (targetDateStr !== todayStr) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const slot of UMS_BELL_SCHEDULE) {
    const [sH, sM] = slot.startTime.split(':').map(Number);
    const [eH, eM] = slot.endTime.split(':').map(Number);
    const startM = sH * 60 + sM;
    const endM = eH * 60 + eM;

    if (currentMinutes >= startM && currentMinutes <= endM) {
      return slot.periodIndex;
    }
  }
  return null;
}

export const DailyLogbookGrid: React.FC<DailyLogbookGridProps> = ({
  classId,
  date,
  periods = [],
  logbook,
  canEditPeriod,
  onSavePeriod,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  isLoading = false,
  initialPeriodIndex,
  substituteLabels = {},
  mixedPeriods = {},
  scoringOptional = {},
  onOpenBaseline,
}) => {
  const { profile, activeRole } = useAuth();
  const { t, language } = useLanguage();
  const isEn = language === 'en';

  const [activeModalPeriod, setActiveModalPeriod] = useState<number | null>(
    initialPeriodIndex && initialPeriodIndex >= 1 && initialPeriodIndex <= 8 ? initialPeriodIndex : null
  );

  React.useEffect(() => {
    if (initialPeriodIndex && initialPeriodIndex >= 1 && initialPeriodIndex <= 8) {
      setActiveModalPeriod(initialPeriodIndex);
    }
  }, [initialPeriodIndex]);

  // Map periods by periodIndex
  const periodMap = useMemo(() => {
    const map = new Map<number, PeriodEntry>();
    periods.forEach((p) => map.set(p.periodIndex, p));
    return map;
  }, [periods]);

  const currentPeriodIndex = useMemo(() => {
    return getCurrentPeriodIndex(date);
  }, [date]);

  const morningBaseline = logbook?.morningBaseline || logbook?.preSessionAttendance;
  const afternoonBaseline = logbook?.afternoonBaseline;

  // Đơn PH đã duyệt + đối chiếu: chỉ dùng sổ ngày đã tải, không đọc thêm Firestore
  const approvedLeaves = logbook?.approvedLeaves;
  const leaveList = useMemo(
    () => Object.values(approvedLeaves || {}).sort((a, b) => (a.stt ?? 999) - (b.stt ?? 999)),
    [approvedLeaves]
  );
  const canReconcile = activeRole === 'admin' || (activeRole === 'gvcn' && profile?.assignedClassId === classId);
  const reconcileWarnings = useMemo(
    () => (canReconcile && logbook ? reconcileDaily(logbook) : []),
    [canReconcile, logbook]
  );

  const handleEditClick = (periodIndex: number) => {
    setActiveModalPeriod(periodIndex);
  };

  const activeEntry = activeModalPeriod ? periodMap.get(activeModalPeriod) : null;

  // Baseline data to supply to modal
  const modalBaselineAbsences: StudentAbsenceRecord[] = useMemo(() => {
    if (!activeModalPeriod) return [];
    if (activeModalPeriod <= 4) {
      return morningBaseline?.absences || [];
    }
    return afternoonBaseline?.absences || [];
  }, [activeModalPeriod, morningBaseline, afternoonBaseline]);

  const modalBaselineEarlyDepartures: EarlyDepartureRecord[] = useMemo(() => {
    if (!activeModalPeriod) return [];
    if (activeModalPeriod <= 4) {
      return morningBaseline?.earlyDepartures || [];
    }
    return afternoonBaseline?.earlyDepartures || [];
  }, [activeModalPeriod, morningBaseline, afternoonBaseline]);

  const isEditable = (pIndex: number): boolean => {
    if (canEditPeriod) return canEditPeriod(pIndex);
    // By default, any logged in teacher or admin can record
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Top Session Actions Bar */}
      <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-xs">
        <span className="text-xs font-bold text-slate-700">
          Sổ đầu bài Lớp {classId} • Ngày {formatDateVi(date)}
        </span>
        <PdfExportButton
          classId={classId}
          weekNumber={logbook?.weekNumber || weekNumberOf(date)}
          variant="secondary"
          label="In Sổ đầu bài"
        />
      </div>

      {!isLoading && leaveList.length > 0 && (
        <div data-testid="leave-today" className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-sky-50 border border-sky-200 rounded-xl px-4 py-2 text-xs text-sky-900">
          <FileCheck2 className="w-4 h-4 shrink-0 text-sky-600" />
          <Bi layout="inline" vi="Nghỉ có đơn hôm nay:" en="Approved leave today:" className="font-bold" />
          {leaveList.map((e, i) => (
            <span key={e.mhs}>
              {`${e.name} (${
                e.periods.length
                  ? `${isEn ? 'periods' : 'tiết'} ${e.periods.join(',')}`
                  : isEn ? 'all day' : 'cả ngày'
              })${i < leaveList.length - 1 ? ';' : ''}`}
            </span>
          ))}
        </div>
      )}

      {!isLoading && reconcileWarnings.length > 0 && (
        <div data-testid="reconcile-box" className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <Bi layout="inline" vi="Cần đối chiếu" en="Needs check" />
            </h4>
            {onOpenBaseline && (
              <button
                type="button"
                data-testid="reconcile-open-baseline"
                onClick={onOpenBaseline}
                className="px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700"
              >
                <Bi layout="inline" vi="Mở điểm danh đầu buổi" en="Open session check-in" />
              </button>
            )}
          </div>
          <ul className="text-xs text-amber-900 space-y-1 list-disc pl-5">
            {reconcileWarnings.map((w) => (
              <li key={w.mhs}>
                {w.name} — <Bi
                  layout="inline"
                  vi={`vắng tiết ${w.periods.join(', ')} (${w.types.join(', ')}) — không có đơn, chưa có trong điểm danh đầu buổi`}
                  en={`absent period ${w.periods.join(', ')} (${w.types.join(', ')}) — no leave request, not in session check-in`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <Clock className="w-8 h-8 mx-auto animate-spin mb-3 text-[#8B1A4A]" />
          <p className="font-semibold text-slate-700">Đang đồng bộ sổ đầu bài...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="logbook-timetable">
          {([
            { key: 'morning', periods: [1, 2, 3, 4], baseline: morningBaseline, icon: Sun, label: `${t.logbook.morningSession} (Tiết 1 - 4)`, tone: 'bg-amber-50/70 text-amber-900' },
            { key: 'afternoon', periods: [5, 6, 7, 8], baseline: afternoonBaseline, icon: Moon, label: `${t.logbook.afternoonSession} (Tiết 5 - 8)`, tone: 'bg-sky-50/70 text-sky-900' },
          ] as const).map((sess) => {
            const first = UMS_BELL_SCHEDULE.find((b) => b.periodIndex === sess.periods[0]);
            const last = UMS_BELL_SCHEDULE.find((b) => b.periodIndex === sess.periods[3]);
            const Icon = sess.icon;
            return (
              <React.Fragment key={sess.key}>
                <div className={`flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 ${sess.tone}`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {sess.label}
                    {first && last && <span className="normal-case font-semibold opacity-75">• {first.startTime} - {last.endTime}</span>}
                  </h3>
                  {sess.baseline?.reportedBy && (
                    <span className="text-[11px] font-medium opacity-80">GVCN: {sess.baseline.reportedByName || sess.baseline.reportedBy}</span>
                  )}
                </div>
                {sess.periods.map((p) => {
                  const bell = UMS_BELL_SCHEDULE.find((b) => b.periodIndex === p);
                  const brk = UMS_BREAKS.find((b) => b.precedingPeriod === p && b.type !== 'lunch');
                  const entry =
                    periodMap.get(p) ||
                    ({
                      periodIndex: p,
                      subject: '',
                      lessonTopic: '',
                      teacherId: '',
                      teacherName: '',
                      absentStudents: [],
                      scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
                      teacherComment: '',
                      teacherSignature: '',
                      isSigned: false,
                      updatedAt: 0,
                    } as PeriodEntry);
                  return (
                    <React.Fragment key={p}>
                      <div className="grid grid-cols-[76px_1fr] sm:grid-cols-[100px_1fr] border-b border-slate-100">
                        <div className={`flex flex-col items-center justify-center p-2 border-r border-slate-100 ${currentPeriodIndex === p ? 'bg-pink-50' : 'bg-slate-50/50'}`}>
                          <span className="text-sm font-bold text-slate-900">Tiết {p}</span>
                          {bell && <span className="text-[10px] font-mono text-slate-500">{bell.startTime} - {bell.endTime}</span>}
                        </div>
                        <div className="p-2">
                          <TimetablePeriodCard
                            period={entry}
                            periodIndex={p}
                            isCurrentPeriod={currentPeriodIndex === p}
                            canEdit={isEditable(p)}
                            onOpenEdit={() => handleEditClick(p)}
                            substituteLabel={substituteLabels[p]}
                            mixed={mixedPeriods[p] ?? null}
                          />
                        </div>
                      </div>
                      {brk && (
                        <div className="grid grid-cols-[76px_1fr] sm:grid-cols-[100px_1fr] border-b border-slate-100 bg-slate-50 text-[11px] italic text-slate-500">
                          <span className="p-1.5 text-center border-r border-slate-100">{brk.labelVi.replace(/ \(.*\)$/, '')}</span>
                          <span className="p-1.5 text-center">{brk.startTime} - {brk.endTime} ({brk.durationMinutes} phút{brk.type === 'changeover' ? '' : ' giải lao'})</span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                {sess.key === 'morning' && (() => {
                  const lunch = UMS_BREAKS.find((b) => b.type === 'lunch');
                  return lunch ? (
                    <div className="grid grid-cols-[76px_1fr] sm:grid-cols-[100px_1fr] border-b border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
                      <span className="p-2 text-center border-r border-slate-200">Nghỉ trưa</span>
                      <span className="p-2 text-center">{lunch.startTime} - {lunch.endTime} (Ăn trưa &amp; nghỉ ngơi bán trú)</span>
                    </div>
                  ) : null;
                })()}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Period Entry & Sign-off Modal */}
      {activeModalPeriod !== null && (
        <PeriodEntryModal
          isOpen={true}
          onClose={() => setActiveModalPeriod(null)}
          periodIndex={activeModalPeriod}
          classId={classId}
          date={date}
          initialEntry={activeEntry}
          scoringConfig={scoringConfig}
          onSave={async (entry) => {
            await onSavePeriod(entry);
          }}
          currentUserName={profile?.displayName || 'Giáo viên'}
          currentUserId={profile?.username || 'teacher'}
          baselineAbsences={modalBaselineAbsences}
          baselineEarlyDepartures={modalBaselineEarlyDepartures}
          approvedLeaves={approvedLeaves}
          scoringOptionalReason={scoringOptional[activeModalPeriod] ?? null}
        />
      )}
    </div>
  );
};
