import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { StudentDoc } from '../../types';
import {
  DailyAttendanceBaseline,
  StudentAbsenceRecord,
  EarlyDepartureRecord,
} from '../../types/logbook';
import { fetchClassRoster, getLocalRoster } from '../../services/rosterService';
import {
  generateDailyId,
  getOrCreateDailyLogbook,
  updateAttendanceBaseline,
} from '../../services/logbookService';
import { AbsencePicker } from './AbsencePicker';
import { EarlyDepartureSection } from './EarlyDepartureSection';
import { calculateAttendanceStats } from '../../utils/attendance';
import { isUnreportedBaseline, leaveAbsencesForSession, mergeLeaveAbsences, type ApprovedLeaveEntry } from '../../utils/studentLeave';
import {
  UserCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Users,
} from 'lucide-react';

export interface PreSessionAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  date: string;
  initialSession?: 'morning' | 'afternoon';
  onSaved?: (baseline: DailyAttendanceBaseline) => void;
  /** Đơn PH đã duyệt — HS nghỉ cả buổi được điền sẵn vắng P khi buổi chưa báo */
  approvedLeaves?: Record<string, ApprovedLeaveEntry>;
}

/**
 * Danh sách HS từ dữ liệu mẫu (đồng bộ) — bản build không có dữ liệu này.
 * Màn hình thật dùng fetchClassRoster / useClassRoster (services/rosterService.ts, đọc Firestore).
 */
export function getClassRoster(classId: string): StudentDoc[] {
  return getLocalRoster(classId);
}

export const PreSessionAttendanceModal: React.FC<PreSessionAttendanceModalProps> = ({
  isOpen,
  onClose,
  classId,
  date,
  initialSession,
  onSaved,
  approvedLeaves,
}) => {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const currentHour = new Date().getHours();
  const defaultSession: 'morning' | 'afternoon' =
    initialSession || (currentHour >= 12 ? 'afternoon' : 'morning');

  const [session, setSession] = useState<'morning' | 'afternoon'>(defaultSession);
  const [roster, setRoster] = useState<StudentDoc[]>([]);
  const [absences, setAbsences] = useState<StudentAbsenceRecord[]>([]);
  const [earlyDepartures, setEarlyDepartures] = useState<EarlyDepartureRecord[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  // Ref, không đưa vào deps: sổ ngày làm mới sau khi lưu không được kích hoạt tải lại (thêm lượt đọc)
  const leavesRef = useRef(approvedLeaves);
  leavesRef.current = approvedLeaves;

  // Load roster
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    fetchClassRoster(classId).then((list) => alive && setRoster(list));
    return () => {
      alive = false;
    };
  }, [classId, isOpen]);

  // Load existing baseline
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);

    getOrCreateDailyLogbook(classId, date, profile?.username || '')
      .then((logbook) => {
        const baseline =
          session === 'morning'
            ? logbook.morningBaseline || logbook.preSessionAttendance
            : logbook.afternoonBaseline;

        if (isUnreportedBaseline(baseline)) {
          // Chưa báo buổi này (sổ ngày luôn có baseline trống): điền sẵn HS có đơn nghỉ cả buổi
          // (đơn đọc từ chính sổ ngày vừa tải, không đọc thêm)
          setAbsences(
            mergeLeaveAbsences(baseline?.absences || [], leaveAbsencesForSession(logbook.approvedLeaves || leavesRef.current, session))
          );
        } else {
          // Đã báo: giữ nguyên, không điền thêm
          setAbsences(baseline?.absences || []);
        }
        setEarlyDepartures(baseline?.earlyDepartures || []);
        setNotes(baseline?.notes || '');
      })
      .catch((err) => {
        setError(err.message || 'Lỗi khi tải dữ liệu điểm danh');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [classId, date, session, isOpen, profile?.username]);

  // KPI stats
  const stats = useMemo(() => {
    return calculateAttendanceStats(roster.length, absences, earlyDepartures);
  }, [roster.length, absences, earlyDepartures]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const dailyId = generateDailyId(classId, date);
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
      if (onSaved) {
        onSaved(baseline);
      }
      setSuccessToast(true);
      setTimeout(() => {
        setSuccessToast(false);
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu điểm danh đầu ngày');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#8B1A4A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-pink-200">
                Lớp {classId} • Ngày {date}
              </span>
              <h2 className="text-base font-bold">
                {session === 'morning'
                  ? t.attendance.morningBaselineTitle
                  : t.attendance.afternoonBaselineTitle}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Session Switcher Tab Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setSession('morning')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                session === 'morning'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>{t.attendance.morningTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setSession('afternoon')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                session === 'afternoon'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>{t.attendance.afternoonTab}</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-1 text-xs text-slate-500">
            <Users className="w-4 h-4 text-slate-400" />
            <span>Sĩ số: <strong className="text-slate-800">{roster.length}</strong></span>
          </div>
        </div>

        {/* Live Attendance KPI Strip */}
        <div className="bg-white border-b border-slate-100 px-6 py-2.5 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-semibold">
            <span>Có mặt:</span>
            <strong className="text-emerald-900">{stats.presentCount}</strong>
          </div>
          <div className="flex items-center space-x-1 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 font-semibold">
            <span>Vắng (P):</span>
            <strong className="text-rose-900">{stats.pCount}</strong>
          </div>
          <div className="flex items-center space-x-1 text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 font-semibold">
            <span>Vắng (K):</span>
            <strong className="text-red-900">{stats.kCount}</strong>
          </div>
          <div className="flex items-center space-x-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-semibold">
            <span>Muộn:</span>
            <strong className="text-amber-900">{stats.lateCount}</strong>
          </div>
          <div className="flex items-center space-x-1 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 font-semibold">
            <span>Về sớm:</span>
            <strong className="text-blue-900">{stats.earlyCount}</strong>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
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
              Ghi chú chung cho buổi học (nếu có)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm của GVCN về tình hình sĩ số hôm nay..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#8B1A4A]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-5 py-2 bg-[#8B1A4A] hover:bg-[#72153c] text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu điểm danh'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
