import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useSearchParams } from 'react-router-dom';
import { UserCheck, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { BrandMark } from '../components/common/BrandMark';
import { ClassDoc } from '../types';
import { loadClassOptions, withSelectedClass } from '../services/seedService';
import { useDailyLogbook } from '../hooks/useDailyLogbook';
import { DailyLogbookGrid } from '../components/logbook/DailyLogbookGrid';
import { PreSessionAttendanceModal } from '../components/logbook/PreSessionAttendanceModal';
import { PdfExportButton } from '../components/summary/PdfExportButton';
import { formatDateVi } from '../utils/dateFormat';
import { useToast } from '../components/common/Toast';
import { fetchSubstitutionsForClassDate } from '../services/substitutionService';
import { substituteLabels } from '../utils/substitution';
import { useOffDay } from '../hooks/useOffDay';
import { OffDayNotice } from '../components/common/OffDayNotice';
import { useTeachingContext } from '../hooks/useTeachingContext';
import { MyTeachingDay } from '../components/logbook/MyTeachingDay';
import { TeacherAliasPicker } from '../components/logbook/TeacherAliasPicker';
import { saveTeacherAliases } from '../services/teacherAliasService';
import type { Substitution } from '../types/substitution';
import { fetchMixedRules } from '../services/mixedPeriodService';
import { DEFAULT_MIXED_RULES, findMixedRule, type MixedRule } from '../utils/mixedPeriods';
import { scoringOptionalReason } from '../utils/periodScoringRequirement';
import {
  describeEditScope,
  dayOfWeekOf,
  listTimetableAliases,
  myPeriodsOnDate,
  periodEditPolicy,
  type TeachingSlot,
  visibleLogbookClassIds,
  expandAliasVariants,
  missingAliasVariants,
  uniqueAliasLabels,
  pickDefaultTeachingSlot,
} from '../utils/teacherAssignment';
import { UMS_BELL_SCHEDULE } from '../utils/schedule';
import { weekNumberOf } from '../utils/academicCalendar';

type LogbookMode = 'homeroom' | 'teaching';

export const LogbookPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const paramClass = searchParams.get('classId');
  const paramDate = searchParams.get('date');
  const paramPeriod = searchParams.get('period');

  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>(
    paramClass || profile?.assignedClassId || '6A1'
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    paramDate || new Date().toISOString().split('T')[0]
  );

  // Dạy thay đã được BGH duyệt cho lớp/ngày đang xem
  const [subLabels, setSubLabels] = useState<Record<number, string>>({});
  const [classSubs, setClassSubs] = useState<Substitution[]>([]);
  useEffect(() => {
    let alive = true;
    fetchSubstitutionsForClassDate(selectedClass, selectedDate)
      .then((subs) => { if (alive) { setSubLabels(substituteLabels(subs, selectedClass, selectedDate)); setClassSubs(subs); } })
      .catch(() => { if (alive) { setSubLabels({}); setClassSubs([]); } });
    return () => { alive = false; };
  }, [selectedClass, selectedDate]);
  const [isPreSessionModalOpen, setIsPreSessionModalOpen] = useState(false);
  const offDay = useOffDay(selectedDate);

  // ---- 2 chế độ: Sổ lớp chủ nhiệm / Chấm tiết dạy của tôi ----
  const teach = useTeachingContext();
  const [mixedRules, setMixedRules] = useState<MixedRule[]>(DEFAULT_MIXED_RULES);
  useEffect(() => {
    fetchMixedRules().then(setMixedRules);
  }, []);
  const isViewOnlyRole = activeRole === 'tpt' || activeRole === 'giamthi';
  const homeroomClass = activeRole === 'gvcn' ? profile?.assignedClassId || null : null;
  const modes: Array<{ id: LogbookMode; label: string; labelEn: string }> = [
    ...(homeroomClass ? [{ id: 'homeroom' as const, label: `Sổ lớp chủ nhiệm (${homeroomClass})`, labelEn: `Homeroom (${homeroomClass})` }] : []),
    ...(activeRole === 'admin' || isViewOnlyRole ? [{ id: 'homeroom' as const, label: 'Sổ các lớp', labelEn: 'All Classes' }] : []),
    ...(!isViewOnlyRole ? [{ id: 'teaching' as const, label: 'Chấm tiết dạy của tôi', labelEn: 'My Teaching Periods' }] : []),
  ];
  const requestedMode = searchParams.get('mode') as LogbookMode | null;
  const defaultMode: LogbookMode =
    activeRole === 'gvbm' || (homeroomClass && paramClass && paramClass !== homeroomClass) ? 'teaching' : 'homeroom';
  const mode: LogbookMode = modes.some((m) => m.id === requestedMode) ? (requestedMode as LogbookMode) : modes.some((m) => m.id === defaultMode) ? defaultMode : modes[0]?.id ?? 'homeroom';
  const setMode = (m: LogbookMode) => {
    const next = new URLSearchParams(searchParams);
    next.set('mode', m);
    next.delete('classId');
    next.delete('period');
    setSearchParams(next, { replace: true });
    if (m === 'homeroom' && homeroomClass) setSelectedClass(homeroomClass);
  };
  // Sổ lớp chủ nhiệm của GVCN luôn là lớp mình
  useEffect(() => {
    if (mode === 'homeroom' && homeroomClass && selectedClass !== homeroomClass) setSelectedClass(homeroomClass);
  }, [mode, homeroomClass, selectedClass]);

  const myDaySlots = useMemo(
    () => myPeriodsOnDate(teach.schedules, teach.myAliases, teach.duties, selectedDate),
    [teach.schedules, teach.myAliases, teach.duties, selectedDate]
  );
  const [openRequest, setOpenRequest] = useState<{ period: number; seq: number } | null>(
    paramPeriod ? { period: parseInt(paramPeriod, 10), seq: 0 } : null
  );
  // Chế độ tiết dạy: lưới bám theo TIẾT đang chọn trong "lịch dạy hôm nay" (không mặc định lớp chủ nhiệm).
  // Chưa chọn → tiết đang dạy / sắp tới theo giờ chuông (ngày khác: tiết đầu tiên).
  const [teachFocus, setTeachFocus] = useState<{ classId: string; period: number } | null>(
    paramClass && paramPeriod ? { classId: paramClass, period: parseInt(paramPeriod, 10) } : null
  );
  useEffect(() => {
    if (mode !== 'teaching' || myDaySlots.length === 0) return;
    if (teachFocus && myDaySlots.some((x) => x.classId === teachFocus.classId && x.periodIndex === teachFocus.period)) {
      if (selectedClass !== teachFocus.classId) setSelectedClass(teachFocus.classId);
      return;
    }
    const ends = Object.fromEntries(UMS_BELL_SCHEDULE.map((b) => [b.periodIndex, b.endTime]));
    const pick = pickDefaultTeachingSlot(myDaySlots, selectedDate, ends);
    if (pick) {
      setTeachFocus({ classId: pick.classId, period: pick.periodIndex });
      setSelectedClass(pick.classId);
    }
  }, [mode, myDaySlots, selectedClass, teachFocus, selectedDate]);
  const openMyPeriod = (slot: TeachingSlot) => {
    setTeachFocus({ classId: slot.classId, period: slot.periodIndex });
    setSelectedClass(slot.classId);
    setOpenRequest((r) => ({ period: slot.periodIndex, seq: (r?.seq ?? 0) + 1 }));
  };
  const [aliasSaving, setAliasSaving] = useState(false);
  // Tự bổ sung cách viết tên TKB còn thiếu cho GV đã chọn tên trước bản sửa 05/11 (1 lần/phiên, chỉ ghi doc của chính mình)
  useEffect(() => {
    if (!teach.ready || !profile || (activeRole !== 'gvcn' && activeRole !== 'gvbm') || teach.myAliases.length === 0) return;
    const missing = missingAliasVariants(teach.myAliases, teach.schedules);
    if (missing.length === 0) return;
    const key = `ums_alias_variants_${profile.uid}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* không có sessionStorage → vẫn thử 1 lần trong lần render này */
    }
    saveTeacherAliases(profile, expandAliasVariants(teach.myAliases, teach.schedules), profile)
      .then(() => teach.reload())
      .catch((e) => console.warn('[Sổ đầu bài] bổ sung cách viết tên TKB', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teach.ready, teach.myAliases, teach.schedules, profile?.uid, activeRole]);
  const [aliasEditing, setAliasEditing] = useState(false);
  const allAliases = useMemo(() => listTimetableAliases(teach.schedules), [teach.schedules]);

  // Tiết lớp trộn của lớp/ngày đang xem
  const slotOf = (p: number) => {
    const dow = dayOfWeekOf(selectedDate);
    return teach.schedules[selectedClass]?.slots.find((x) => x.dayOfWeek === dow && x.periodIndex === p);
  };
  const mixedPeriods = useMemo(() => {
    const out: Record<number, { mode: 'auto10' | 'skip'; noteUrl?: string }> = {};
    for (let p = 1; p <= 8; p++) {
      const r = findMixedRule(selectedClass, slotOf(p)?.subject || '', mixedRules);
      if (r) out[p] = { mode: r.mode, noteUrl: r.noteUrl };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teach.schedules, selectedClass, selectedDate, mixedRules]);

  // Tiết không bắt buộc chấm điểm khi ký (lớp trộn, NN2, HĐTN, mặc định 10đ) — theo TKB
  const scoringOptional = useMemo(() => {
    const out: Record<number, string> = {};
    for (let p = 1; p <= 8; p++) {
      const r = scoringOptionalReason(selectedClass, [slotOf(p)?.subject], mixedPeriods[p] ?? null);
      if (r) out[p] = r;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teach.schedules, selectedClass, selectedDate, mixedPeriods]);

  // Ai được ghi/chấm tiết nào của lớp đang xem
  const editPolicyFor = (p: number) => {
    const slot = slotOf(p);
    return periodEditPolicy({
      activeRole,
      assignedClassId: profile?.assignedClassId,
      myAliases: teach.myAliases,
      claimedAliases: teach.claimedAliases,
      classId: selectedClass,
      slotTeacherName: slot?.teacherName || '',
      isMySubstitution: classSubs.some((x) => x.status === 'approved' && x.periodIndex === p && x.substituteUid === profile?.uid),
      isMixed: mixedPeriods[p]?.mode === 'skip',
    });
  };

  useEffect(() => {
    setClasses(loadClassOptions());
  }, []);

  useEffect(() => {
    if (paramClass) {
      setSelectedClass(paramClass);
    } else if (profile?.assignedClassId && activeRole === 'gvcn' && mode === 'homeroom') {
      // Chỉ vai trò GVCN (sổ lớp chủ nhiệm) mới mặc định lớp chủ nhiệm
      setSelectedClass(profile.assignedClassId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramClass, profile, activeRole]);

  useEffect(() => {
    if (paramDate) {
      setSelectedDate(paramDate);
    }
  }, [paramDate]);

  // Reactive daily logbook hook
  const {
    logbook,
    periods,
    loading,
    summary,
    savePeriod,
    refresh,
  } = useDailyLogbook(selectedClass, selectedDate, offDay.ready && !offDay.off, false);

  // Lớp được chọn xem: BGH/TPT/Giám thị mọi lớp; GV: lớp chủ nhiệm + lớp có tiết mình dạy (tên TKB đã nhận) + lớp dạy thay
  const filteredClasses = useMemo(() => {
    if (classes.length === 0) return [];
    const ids = visibleLogbookClassIds({
      activeRole,
      allClassIds: classes.map((c) => c.id),
      assignedClassId: profile?.assignedClassId,
      schedules: teach.schedules,
      myAliases: teach.myAliases,
      substituteClassIds: teach.duties.filter((d) => d.status === 'approved').map((d) => d.classId),
    });
    const byId = new Map(classes.map((c) => [c.id, c]));
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  }, [classes, activeRole, profile?.assignedClassId, teach.schedules, teach.myAliases, teach.duties]);

  const canTakePreSession =
    activeRole === 'admin' ||
    (activeRole === 'gvcn' && profile?.assignedClassId === selectedClass);

  return (
    <div className="space-y-6">
      {/* Header filter & action bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-1 bg-slate-50 rounded-xl border border-slate-100 shrink-0">
            <BrandMark app="logbook" size={36} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi="Sổ đầu bài" en="Class Logbook" layout="inline" />
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'teaching' && teachFocus && teachFocus.classId === selectedClass
                ? `Tiết dạy của tôi • Lớp ${selectedClass} • Tiết ${teachFocus.period} • ${formatDateVi(selectedDate)}`
                : `Sổ đầu bài 8 tiết học • Lớp ${selectedClass} • ${formatDateVi(selectedDate)}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Class Selector */}
          {mode === 'homeroom' && (
          <div className="flex items-center space-x-2">
            <label htmlFor="logbook-class-select" className="text-xs font-semibold text-slate-600">
              {t.common.class}:
            </label>
            <select
              id="logbook-class-select"
              value={selectedClass}
              disabled={!!homeroomClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#8B1A4A]"
            >
              {filteredClasses.length > 0 ? (
                withSelectedClass(filteredClasses, selectedClass).map((c) => (
                  <option key={c.id} value={c.id}>
                    Lớp {c.name}
                  </option>
                ))
              ) : (
                <option value="6A1">Lớp 6A1</option>
              )}
            </select>
          </div>
          )}

          {/* Date Picker */}
          <div className="flex items-center space-x-2">
            <label htmlFor="logbook-date-input" className="text-xs font-semibold text-slate-600">
              {t.common.date}:
            </label>
            <input
              id="logbook-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-[#8B1A4A]"
            />
          </div>

          {/* Pre-Session Attendance Button */}
          {/* Quick PDF Export */}
          <PdfExportButton
            classId={selectedClass}
            weekNumber={logbook?.weekNumber || weekNumberOf(selectedDate)}
            variant="outline"
            label="In Sổ A4"
          />

          {canTakePreSession && !offDay.off && (
            <button
              type="button"
              onClick={() => setIsPreSessionModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#8B1A4A] hover:bg-[#72153c] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <Bi vi="Điểm danh đầu giờ" en="Pre-session Attendance" layout="inline" secondaryClassName="text-white/80 opacity-85" />
            </button>
          )}
        </div>
      </div>

      {modes.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Chế độ sổ đầu bài">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                mode === m.id ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#8B1A4A]/50'
              }`}
            >
              <Bi vi={m.label} en={m.labelEn} layout="inline" />
            </button>
          ))}
        </div>
      )}

      {mode === 'teaching' && teach.ready && (teach.myAliases.length === 0 || aliasEditing) && (
        <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3" data-testid="alias-picker">
          <p className="text-sm text-slate-800">
            <b>Chọn tên của bạn trên thời khóa biểu</b> (có thể chọn nhiều tên nếu TKB ghi bạn theo nhiều cách). App dựa vào đây để biết tiết nào là của bạn. BGH xem và sửa lại được.
          </p>
          <TeacherAliasPicker
            allAliases={allAliases}
            selected={teach.myAliases}
            owners={teach.byAlias}
            forUid={profile?.uid || ''}
            saving={aliasSaving}
            onSave={async (aliases) => {
              if (!profile) return;
              setAliasSaving(true);
              try {
                // Lưu kèm mọi cách viết thật trên TKB để Firestore rules (so nguyên văn) khớp ở mọi lớp
                await saveTeacherAliases(profile, expandAliasVariants(aliases, teach.schedules), profile);
                await teach.reload();
                setAliasEditing(false);
                showToast(aliases.length ? `Đã lưu: ${aliases.join(', ')}` : 'Đã bỏ chọn tên trên TKB.', 'success');
              } catch (e) {
                console.error('[Sổ đầu bài] lưu tên TKB', e);
                showToast('Lưu thất bại.', 'error');
              } finally {
                setAliasSaving(false);
              }
            }}
          />
        </div>
      )}

      {mode === 'teaching' && !offDay.off && teach.myAliases.length > 0 && !aliasEditing && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Tên của bạn trên TKB: <b className="text-slate-700">{uniqueAliasLabels(teach.myAliases).join(', ')}</b></span>
            <button type="button" onClick={() => setAliasEditing(true)} className="font-semibold text-[#8B1A4A] hover:underline">
              Đổi tên trên TKB
            </button>
          </div>
          <MyTeachingDay
            date={selectedDate}
            slots={myDaySlots}
            activeKey={teachFocus ? `${teachFocus.classId}_${teachFocus.period}` : null}
            refreshKey={periods.filter((x) => x.isSigned).length}
            onOpen={openMyPeriod}
            mixedOf={(s) => findMixedRule(s.classId, s.subject, mixedRules)}
          />
        </div>
      )}

      {offDay.off && <OffDayNotice date={selectedDate} reason={offDay.reason} kind={offDay.kind} />}

      {!offDay.off && teach.ready && (
        <p className="text-[11px] text-slate-500" data-testid="edit-scope">
          Lớp {selectedClass}: {describeEditScope([1, 2, 3, 4, 5, 6, 7, 8].map((p) => ({ period: p, reason: editPolicyFor(p).reason })))}
        </p>
      )}

      {/* Daily Score & Attendance Summary KPI Bar */}
      {summary && !offDay.off && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold">
                <Bi vi="Tiết đã ký" en="Signed periods" />
              </span>
              <p className="text-sm font-bold text-slate-800">
                {summary.totalPeriodsSigned} / 8 tiết
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-pink-50 text-[#8B1A4A]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold">
                <Bi vi="Điểm TB ngày" en="Daily average" />
              </span>
              <p className="text-sm font-bold text-[#8B1A4A]">
                {summary.totalPeriodsSigned > 0
                  ? `${Math.round((summary.totalDailyScore / summary.totalPeriodsSigned) * 10) / 10} / 10đ`
                  : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold">
                <Bi vi="Tổng số vắng" en="Total absent" />
              </span>
              <p className="text-sm font-bold text-rose-700">
                {summary.totalAbsenceCount} học sinh
                {summary.totalAbsenceCount > 0 && (
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    ({summary.excusedCountP}P, {summary.unexcusedCountK}K)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold">
                <Bi vi="Muộn / Về sớm" en="Late / Early leave" />
              </span>
              <p className="text-sm font-bold text-amber-700">
                {summary.lateCount} muộn • {summary.earlyDepartureCount} về sớm
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 8-Periods 2-Session Interactive Matrix */}
      {!offDay.off && (
      <DailyLogbookGrid
        key={`${selectedClass}_${openRequest?.seq ?? 0}`}
        canEditPeriod={(p) => editPolicyFor(p).canEdit}
        mixedPeriods={mixedPeriods}
        scoringOptional={scoringOptional}
        onOpenBaseline={canTakePreSession ? () => setIsPreSessionModalOpen(true) : undefined}
        substituteLabels={subLabels}
        classId={selectedClass}
        date={selectedDate}
        periods={periods}
        logbook={logbook}
        isLoading={loading}
        initialPeriodIndex={!loading && openRequest && editPolicyFor(openRequest.period).canEdit ? openRequest.period : undefined}
        onSavePeriod={async (entry) => {
          try {
            const matchedSub = classSubs.find(
              (x) => x.status === 'approved' && x.periodIndex === entry.periodIndex && x.substituteUid === profile?.uid
            );
            const payload = matchedSub?.id ? { ...entry, substitutionId: matchedSub.id } : entry;
            // Đầu tiết: chỉ lưu điểm danh (isSigned=false); cuối tiết: ký sổ
            const attendanceOnly = entry.isSigned === false;
            await savePeriod(entry.periodIndex, payload, !attendanceOnly);
            await refresh();
            showToast(
              attendanceOnly
                ? `✅ Đã lưu điểm danh tiết ${entry.periodIndex} — giám thị, GVCN đã xem được`
                : `✅ Đã lưu sổ tiết ${entry.periodIndex} — ${entry.subject || 'Tiết học'}`,
              'success'
            );
          } catch (err: any) {
            showToast(`❌ Lỗi lưu tiết ${entry.periodIndex}: ${err.message}`, 'error');
            throw err;
          }
        }}
      />
      )}

      {/* Pre-session modal */}
      {isPreSessionModalOpen && (
        <PreSessionAttendanceModal
          isOpen={true}
          onClose={() => setIsPreSessionModalOpen(false)}
          classId={selectedClass}
          date={selectedDate}
          approvedLeaves={logbook?.approvedLeaves}
          onSaved={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
};
