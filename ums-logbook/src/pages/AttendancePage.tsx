import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { UserCheck, Sun, Moon, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { ClassDoc, StudentDoc } from '../types';
import {
  DailyAttendanceBaseline,
  StudentAbsenceRecord,
  EarlyDepartureRecord,
} from '../types/logbook';
import { loadClassOptions } from '../services/seedService';
import {
  generateDailyId,
  getOrCreateDailyLogbook,
  updateAttendanceBaseline,
} from '../services/logbookService';
import { AbsencePicker } from '../components/logbook/AbsencePicker';
import { EarlyDepartureSection } from '../components/logbook/EarlyDepartureSection';
import { fetchClassRoster } from '../services/rosterService';
import { calculateAttendanceStats } from '../utils/attendance';
import { useOffDay } from '../hooks/useOffDay';
import { OffDayNotice } from '../components/common/OffDayNotice';
import { attendanceClassIds, canSaveAttendance } from '../utils/teacherAssignment';

export const AttendancePage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { t } = useLanguage();

  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>(
    profile?.assignedClassId || '6A1'
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const offDay = useOffDay(selectedDate);
  const skipLoad = !offDay.ready || offDay.off;

  const currentHour = new Date().getHours();
  const [session, setSession] = useState<'morning' | 'afternoon'>(
    currentHour >= 12 ? 'afternoon' : 'morning'
  );

  const [roster, setRoster] = useState<StudentDoc[]>([]);
  const [absences, setAbsences] = useState<StudentAbsenceRecord[]>([]);
  const [earlyDepartures, setEarlyDepartures] = useState<EarlyDepartureRecord[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Lớp được chọn: GVCN chỉ lớp chủ nhiệm; BGH/TPT/Giám thị mọi lớp
  useEffect(() => {
    const all = loadClassOptions();
    const allowed = new Set(attendanceClassIds(activeRole, profile?.assignedClassId, all.map((c) => c.id)));
    setClasses(all.filter((c) => allowed.has(c.id)));
  }, [activeRole, profile?.assignedClassId]);

  // Lớp đang chọn không thuộc phạm vi (vd. GVCN đổi URL/còn trạng thái cũ) → về lớp hợp lệ đầu tiên
  useEffect(() => {
    if (classes.length > 0 && !classes.some((c) => c.id === selectedClass)) setSelectedClass(classes[0].id);
  }, [classes, selectedClass]);

  const inScope = classes.some((c) => c.id === selectedClass);
  const canSave = canSaveAttendance(activeRole, profile?.assignedClassId, selectedClass);
  const noClassAccess = !!activeRole && classes.length === 0;

  useEffect(() => {
    if (profile?.assignedClassId && activeRole === 'gvcn') {
      setSelectedClass(profile.assignedClassId);
    }
  }, [profile, activeRole]);

  // Load roster
  useEffect(() => {
    if (!inScope) return;
    let alive = true;
    fetchClassRoster(selectedClass).then((list) => alive && setRoster(list));
    return () => {
      alive = false;
    };
  }, [selectedClass, inScope]);

  // Load existing baseline for class + date + session
  useEffect(() => {
    // Ngày nghỉ: không tạo sổ rỗng
    if (skipLoad || !inScope) return;
    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    getOrCreateDailyLogbook(selectedClass, selectedDate, profile?.username || '')
      .then((logbook) => {
        const baseline =
          session === 'morning'
            ? logbook.morningBaseline || logbook.preSessionAttendance
            : logbook.afternoonBaseline;

        if (baseline) {
          setAbsences(baseline.absences || []);
          setEarlyDepartures(baseline.earlyDepartures || []);
          setNotes(baseline.notes || '');
        } else {
          setAbsences([]);
          setEarlyDepartures([]);
          setNotes('');
        }
      })
      .catch((err) => {
        setError(err.message || 'Lỗi khi tải dữ liệu điểm danh');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedClass, selectedDate, session, profile?.username, skipLoad, inScope]);

  // KPI stats
  const stats = useMemo(() => {
    return calculateAttendanceStats(roster.length, absences, earlyDepartures);
  }, [roster.length, absences, earlyDepartures]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      setError('Bạn chỉ được điểm danh lớp mình chủ nhiệm.');
      return;
    }
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const dailyId = generateDailyId(selectedClass, selectedDate);
      const baseline: DailyAttendanceBaseline = {
        reportedBy: profile?.username || 'gvcn',
        reportedByName: profile?.displayName || 'Giáo viên chủ nhiệm',
        reportedAt: Date.now(),
        session,
        absences: absences.map((a) => ({
          ...a,
          reportedInTier: 'baseline' as const,
        })),
        earlyDepartures,
        notes: notes.trim(),
      };

      await updateAttendanceBaseline(dailyId, session, baseline);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu điểm danh');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top filter bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi="Điểm danh đầu giờ" en="Pre-session Attendance" layout="inline" />
            </h2>
            <p className="text-xs text-slate-500">
              Điểm danh đầu giờ cho Lớp {selectedClass} • Ngày {selectedDate}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Class Selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="attendance-class-select" className="text-xs font-semibold text-slate-600">
              {t.common.class}:
            </label>
            <select
              id="attendance-class-select"
              value={selectedClass}
              disabled={classes.length <= 1}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#8B1A4A]"
            >
              {classes.length > 0 ? (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Lớp {c.name}
                  </option>
                ))
              ) : (
                <option value="">—</option>
              )}
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex items-center space-x-2">
            <label htmlFor="attendance-date-input" className="text-xs font-semibold text-slate-600">
              {t.common.date}:
            </label>
            <input
              id="attendance-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-[#8B1A4A]"
            />
          </div>
        </div>
      </div>

      {offDay.off && <OffDayNotice date={selectedDate} reason={offDay.reason} kind={offDay.kind} />}

      {/* Main Container */}
      {noClassAccess && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          Điểm danh đầu giờ do GVCN thực hiện cho lớp mình chủ nhiệm. Tài khoản của bạn chưa được gán lớp chủ nhiệm.
        </div>
      )}
      {!offDay.off && !noClassAccess && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Session Switcher Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setSession('morning')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                session === 'morning'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Sun className="w-4 h-4" />
              <Bi vi="Buổi sáng" en="Morning" layout="inline" />
            </button>
            <button
              type="button"
              onClick={() => setSession('afternoon')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                session === 'afternoon'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Moon className="w-4 h-4" />
              <Bi vi="Buổi chiều" en="Afternoon" layout="inline" />
            </button>
          </div>

          <div className="flex items-center space-x-1 text-xs text-slate-500">
            <Users className="w-4 h-4 text-slate-400" />
            <span>Sĩ số: <strong className="text-slate-800">{roster.length} học sinh</strong></span>
          </div>
        </div>

        {/* Live Attendance KPI Strip */}
        <div className="bg-white border-b border-slate-100 px-6 py-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold">
            <span>Có mặt:</span>
            <strong className="text-emerald-900">{stats.presentCount}</strong>
          </div>
          <div className="flex items-center space-x-1 text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 font-semibold">
            <span>Vắng (P):</span>
            <strong className="text-rose-900">{stats.pCount}</strong>
          </div>
          <div className="flex items-center space-x-1 text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 font-semibold">
            <span>Vắng (K):</span>
            <strong className="text-red-900">{stats.kCount}</strong>
          </div>
          <div className="flex items-center space-x-1 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-semibold">
            <span>Muộn:</span>
            <strong className="text-amber-900">{stats.lateCount}</strong>
          </div>
          <div className="flex items-center space-x-1 text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 font-semibold">
            <span>Về sớm:</span>
            <strong className="text-blue-900">{stats.earlyCount}</strong>
          </div>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{t.attendance.saveBaselineSuccess}</span>
            </div>
          )}

          {/* Absence Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800">
                Danh sách học sinh điểm danh
              </label>
              <span className="text-[11px] text-slate-500">
                Mặc định cả lớp có mặt. Chỉ cần bấm chuyển trạng thái học sinh vắng / muộn.
              </span>
            </div>
            <AbsencePicker
              roster={roster}
              absences={absences}
              onChange={setAbsences}
              readOnly={loading || saving}
              showBaselineOrigin={false}
            />
          </div>

          {/* Early Departure Section */}
          <div className="pt-2 border-t border-slate-100">
            <EarlyDepartureSection
              roster={roster}
              earlyDepartures={earlyDepartures}
              onChange={setEarlyDepartures}
              readOnly={loading || saving}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú buổi học
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm về nề nếp hoặc tình hình buổi học..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#8B1A4A]"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving || loading || !canSave}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? (
                <span>Đang lưu...</span>
              ) : (
                <Bi vi="Lưu kết quả điểm danh" en="Save Attendance" layout="inline" secondaryClassName="text-white/80 opacity-85" />
              )}
            </button>
          </div>
        </form>
      </div>
      )}
    </div>
  );
};
