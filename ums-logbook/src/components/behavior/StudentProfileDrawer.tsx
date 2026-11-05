/**
 * UMS Digital Class Logbook - Student Profile & Behavior History Drawer
 * Milestone 3: 360-degree slide-over timeline panel
 * Path: src/components/behavior/StudentProfileDrawer.tsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import { StudentDoc, BehaviorNote } from '../../types';
import {
  EarlyWarningAlert,
  AbsenceEvent,
} from '../../types/earlyWarning';
import { fetchClassRoster } from '../../services/rosterService';
import { getNotesByStudent } from '../../services/behaviorService';
import { buildStudentTimeline } from '../../utils/earlyWarning';
import {
  X,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Plus,
} from 'lucide-react';

export interface StudentProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  classId?: string;
  activeAlert?: EarlyWarningAlert;
  onAddNote?: (studentId: string, studentName: string, classId: string) => void;
}

export const StudentProfileDrawer: React.FC<StudentProfileDrawerProps> = ({
  isOpen,
  onClose,
  studentId,
  classId,
  activeAlert,
  onAddNote,
}) => {
  const [student, setStudent] = useState<StudentDoc | null>(null);
  const [notes, setNotes] = useState<BehaviorNote[]>([]);
  const [absences, setAbsences] = useState<AbsenceEvent[]>([]);
  const [timelineTab, setTimelineTab] = useState<'all' | 'attendance' | 'behavior' | 'positive'>('all');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load student info and historical notes/absences
  useEffect(() => {
    if (!isOpen || !studentId) {
      setStudent(null);
      setNotes([]);
      setAbsences([]);
      return;
    }

    // 1. Find student metadata from class roster or all_students
    let foundStudent: StudentDoc | null = null;
    if (!foundStudent && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('ums_students');
      if (stored) {
        try {
          const all = JSON.parse(stored) as StudentDoc[];
          foundStudent = all.find((s) => s.id === studentId || s.mhs === studentId) || null;
        } catch {}
      }
    }
    setStudent(foundStudent);
    // Bản LIVE không có dữ liệu mẫu → tra danh sách lớp trên Firestore (nhớ trong phiên)
    if (!foundStudent && classId) {
      fetchClassRoster(classId).then((list) => {
        const hit = list.find((s) => s.id === studentId || s.mhs === studentId);
        if (hit) setStudent((cur) => cur ?? hit);
      });
    }

    // 2. Load behavior notes for student
    getNotesByStudent(studentId)
      .then((data) => {
        setNotes(data);
      })
      .catch(() => setNotes([]));

    // 3. Load attendance records from mock daily logbooks or localStorage
    const loadedAbsences: AbsenceEvent[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const rawLogbooks = localStorage.getItem('ums_daily_logbooks');
        if (rawLogbooks) {
          const logbooks = JSON.parse(rawLogbooks);
          Object.values(logbooks).forEach((lb: any) => {
            if (lb.preSessionAttendance?.absences) {
              lb.preSessionAttendance.absences.forEach((a: any) => {
                if (a.studentId === studentId) {
                  loadedAbsences.push({
                    date: lb.date,
                    studentId,
                    studentName: a.studentName,
                    classId: lb.classId,
                    type: a.type,
                    note: a.note,
                  });
                }
              });
            }
            if (lb.periods) {
              Object.values(lb.periods).forEach((p: any) => {
                if (p.absentStudents) {
                  p.absentStudents.forEach((a: any) => {
                    if (a.studentId === studentId) {
                      loadedAbsences.push({
                        date: lb.date,
                        studentId,
                        studentName: a.studentName,
                        classId: lb.classId,
                        type: a.type,
                        periodIndex: p.periodIndex,
                        note: a.note,
                      });
                    }
                  });
                }
              });
            }
          });
        }
      } catch {}
    }
    setAbsences(loadedAbsences);
  }, [isOpen, studentId, classId]);

  // Unified chronological timeline
  const fullTimeline = useMemo(() => {
    if (!studentId) return [];
    return buildStudentTimeline(studentId, absences, notes);
  }, [studentId, absences, notes]);

  // Filtered timeline by tab
  const filteredTimeline = useMemo(() => {
    if (timelineTab === 'all') return fullTimeline;
    if (timelineTab === 'attendance') return fullTimeline.filter((t) => t.type === 'absence');
    if (timelineTab === 'behavior') return fullTimeline.filter((t) => t.type === 'negative_note');
    if (timelineTab === 'positive') return fullTimeline.filter((t) => t.type === 'positive_note');
    return fullTimeline;
  }, [fullTimeline, timelineTab]);

  // Metric KPI calculation
  const kpiStats = useMemo(() => {
    const kCount = absences.filter((a) => a.type === 'K').length;
    const pCount = absences.filter((a) => a.type === 'P').length;
    const lateCount = absences.filter((a) => a.type === 'Late').length;
    const posCount = notes.filter((n) => n.type === 'positive').length;
    const negCount = notes.filter((n) => n.type === 'negative').length;
    const totalNotes = posCount + negCount;
    const posPct = totalNotes > 0 ? Math.round((posCount / totalNotes) * 100) : 0;

    return { kCount, pCount, lateCount, posCount, negCount, posPct };
  }, [absences, notes]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Click-outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative z-10 w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="bg-[#8B1A4A] text-white px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {student?.stt || '#'}
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                {student?.name || 'Hồ sơ học sinh'}
              </h2>
              <p className="text-xs text-pink-200">
                Lớp {student?.classId || classId} • MHS: {student?.mhs || studentId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Section 1: Demographics Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Mã học sinh</span>
              <span className="font-bold font-mono text-slate-800">{student?.mhs || studentId}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Số thứ tự</span>
              <span className="font-bold text-slate-800">STT {student?.stt || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Giới tính</span>
              <span className="font-bold text-slate-800">{student?.gender || 'Chưa cập nhật'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Ngày sinh</span>
              <span className="font-bold text-slate-800">{student?.dob || 'Chưa cập nhật'}</span>
            </div>
          </div>

          {/* Section 2: Active Early Warning Status Card */}
          {activeAlert ? (
            <div
              className={`rounded-xl border p-4 shadow-2xs ${
                activeAlert.level === 'critical'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold text-sm mb-2">
                {activeAlert.level === 'critical' ? (
                  <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <span>
                  {activeAlert.level === 'critical'
                    ? 'Cảnh báo Nghiêm trọng: Học sinh cần can thiệp khẩn cấp'
                    : 'Cảnh báo: Học sinh có dấu hiệu cần theo dõi nề nếp'}
                </span>
              </div>

              <ul className="text-xs space-y-1 pl-7 list-disc">
                {activeAlert.reasons.map((r, i) => (
                  <li key={i} className="font-semibold">
                    {r.type === 'unexcused_absences'
                      ? `${r.count} buổi vắng không phép (K) trong 7 ngày gần nhất (ngưỡng: >= ${r.threshold})`
                      : `${r.count} lần bị ghi nhận vi phạm nề nếp (ngưỡng: >= ${r.threshold})`}
                  </li>
                ))}
              </ul>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-xs italic text-slate-700">
                Đề xuất GVCN trao đổi trực tiếp với học sinh và phối hợp thông báo đến phụ huynh trong tuần.
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center space-x-3 text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold block">Chuyên cần & nề nếp đạt chuẩn</span>
                <span className="text-emerald-700">Học sinh không có dấu hiệu vi phạm cần cảnh báo.</span>
              </div>
            </div>
          )}

          {/* Section 3: Metric KPI Bar */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Thống kê tổng hợp
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-2xs">
                <span className="text-[11px] text-slate-500 block">Vắng không phép</span>
                <span className="text-xl font-black text-rose-600">{kpiStats.kCount}</span>
                <span className="text-[10px] text-slate-400 block">buổi (K)</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-2xs">
                <span className="text-[11px] text-slate-500 block">Vắng có phép</span>
                <span className="text-xl font-black text-blue-600">{kpiStats.pCount}</span>
                <span className="text-[10px] text-slate-400 block">buổi (P)</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-2xs">
                <span className="text-[11px] text-slate-500 block">Đi muộn</span>
                <span className="text-xl font-black text-amber-600">{kpiStats.lateCount}</span>
                <span className="text-[10px] text-slate-400 block">lần</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-2xs">
                <span className="text-[11px] text-slate-500 block">Khen ngợi</span>
                <span className="text-xl font-black text-emerald-600">{kpiStats.posCount}</span>
                <span className="text-[10px] text-emerald-600 font-bold block">
                  {kpiStats.posPct}% tích cực
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Unified Chronological Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Lịch sử sự kiện & nề nếp ({fullTimeline.length})
              </h3>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setTimelineTab('all')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    timelineTab === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineTab('attendance')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    timelineTab === 'attendance' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Chuyên cần
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineTab('behavior')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    timelineTab === 'behavior' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Nhắc nhở
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineTab('positive')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    timelineTab === 'positive' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Khen ngợi
                </button>
              </div>
            </div>

            {/* Timeline Stream */}
            {filteredTimeline.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                Không có sự kiện nào trong danh mục này.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {filteredTimeline.map((item) => {
                  const isEmerald = item.badgeVariant === 'emerald';
                  const isRose = item.badgeVariant === 'rose';
                  const isAmber = item.badgeVariant === 'amber';
                  const isBlue = item.badgeVariant === 'blue';

                  return (
                    <div key={item.id} className="relative group">
                      {/* Timeline dot */}
                      <span
                        className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 ring-slate-100 ${
                          isEmerald
                            ? 'bg-emerald-500'
                            : isRose
                            ? 'bg-rose-500'
                            : isAmber
                            ? 'bg-amber-500'
                            : isBlue
                            ? 'bg-blue-500'
                            : 'bg-slate-400'
                        }`}
                      />

                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isEmerald
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isRose
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : isAmber
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {item.badgeLabel}
                            </span>
                            {item.title && (
                              <span className="font-bold text-slate-800 text-xs">
                                {item.title}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">{item.date}</span>
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {item.description}
                          </p>
                        )}

                        {item.authorName && (
                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span>Người ghi: <strong className="text-slate-600">{item.authorName}</strong></span>
                            {item.periodIndex && <span>Tiết {item.periodIndex}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Đóng
          </button>

          {onAddNote && student && (
            <button
              type="button"
              onClick={() => onAddNote(student.id || student.mhs, student.name, student.classId)}
              className="px-4 py-2 bg-[#8B1A4A] text-white hover:bg-[#72153c] rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm ghi nhận nề nếp</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
