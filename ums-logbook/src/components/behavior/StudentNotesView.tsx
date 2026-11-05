/**
 * UMS Digital Class Logbook - Student Notes View & Dashboard
 * Milestone 3: Dedicated GVCN workspace with KPI cards, timeline vs student views, & early warnings
 * Path: src/components/behavior/StudentNotesView.tsx
 */

import React, { useState, useMemo } from 'react';
import { useBehaviorNotes } from '../../hooks/useBehaviorNotes';
import { useAuth } from '../../hooks/useAuth';
import { useClassRoster } from '../../hooks/useClassRoster';
import { ALL_CLASSES } from '../../services/seedService';
import { useGvcnName } from '../../hooks/useGvcnName';
import { BehaviorNoteCard } from './BehaviorNoteCard';
import { BehaviorNotesFilter } from './BehaviorNotesFilter';
import { CreateBehaviorNoteModal } from './CreateBehaviorNoteModal';
import { ConferenceSummaryModal } from './ConferenceSummaryModal';
import { EarlyWarningBanner } from './EarlyWarningBanner';
import { StudentProfileDrawer } from './StudentProfileDrawer';
import { evaluateEarlyWarnings } from '../../utils/earlyWarning';
import { AbsenceEvent } from '../../types/earlyWarning';
import { Bi } from '../common/Bi';
import {
  Award,
  Plus,
  FileSpreadsheet,
  ThumbsUp,
  AlertTriangle,
  LayoutGrid,
  List,
  ShieldAlert,
} from 'lucide-react';

export interface StudentNotesViewProps {
  classId?: string;
  onClassChange?: (classId: string) => void;
  showClassSelector?: boolean;
}

export const StudentNotesView: React.FC<StudentNotesViewProps> = ({
  classId: initialClassId,
  onClassChange,
  showClassSelector = true,
}) => {
  const { profile, activeRole } = useAuth();

  const [activeClass, setActiveClass] = useState<string>(
    initialClassId || profile?.assignedClassId || '6A1'
  );
  const [viewMode, setViewMode] = useState<'timeline' | 'student'>('timeline');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isConferenceModalOpen, setIsConferenceModalOpen] = useState<boolean>(false);

  // Selected student for Profile Drawer
  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<string | null>(null);

  // Hook subscription
  const {
    notes,
    filteredNotes,
    filters,
    analytics,
    setFilters,
    resetFilters,
    deleteNote,
  } = useBehaviorNotes(activeClass);

  const { roster } = useClassRoster(activeClass);
  const gvcnName = useGvcnName(activeClass);

  // Attendance events for early warning evaluation
  const absences: AbsenceEvent[] = useMemo(() => {
    const list: AbsenceEvent[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const rawLogbooks = localStorage.getItem('ums_daily_logbooks');
        if (rawLogbooks) {
          const logbooks = JSON.parse(rawLogbooks);
          Object.values(logbooks).forEach((lb: any) => {
            if (lb.classId !== activeClass) return;
            if (lb.preSessionAttendance?.absences) {
              lb.preSessionAttendance.absences.forEach((a: any) => {
                list.push({
                  date: lb.date,
                  studentId: a.studentId,
                  studentName: a.studentName,
                  classId: lb.classId,
                  type: a.type,
                  note: a.note,
                });
              });
            }
            if (lb.periods) {
              Object.values(lb.periods).forEach((p: any) => {
                if (p.absentStudents) {
                  p.absentStudents.forEach((a: any) => {
                    list.push({
                      date: lb.date,
                      studentId: a.studentId,
                      studentName: a.studentName,
                      classId: lb.classId,
                      type: a.type,
                      periodIndex: p.periodIndex,
                      note: a.note,
                    });
                  });
                }
              });
            }
          });
        }
      } catch {}
    }
    return list;
  }, [activeClass]);

  // Evaluate Early Warning alerts for the class
  const classAlerts = useMemo(() => {
    return evaluateEarlyWarnings(roster, absences, notes, { classId: activeClass });
  }, [roster, absences, notes, activeClass]);

  const activeAlertForSelectedStudent = useMemo(() => {
    if (!selectedStudentForDrawer) return undefined;
    return classAlerts.find(
      (a) => a.studentId === selectedStudentForDrawer || a.studentName === selectedStudentForDrawer
    );
  }, [selectedStudentForDrawer, classAlerts]);

  const handleClassSelect = (newClass: string) => {
    setActiveClass(newClass);
    if (onClassChange) onClassChange(newClass);
  };

  const canDeleteNote = (authorId: string) => {
    return activeRole === 'admin' || profile?.uid === authorId || profile?.username === authorId;
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-pink-50 text-[#8B1A4A] rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black text-slate-900">
                <Bi vi="Sổ theo dõi nề nếp & hành vi học sinh" en="Student Conduct & Behavior Log" />
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#8B1A4A] text-white">
                Lớp {activeClass}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              GVCN: <span className="font-semibold text-slate-700">{gvcnName || 'Chưa phân công'}</span> • Sĩ số: <span className="font-semibold text-slate-700">{roster.length} học sinh</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {showClassSelector && (activeRole === 'admin' || activeRole === 'tpt' || activeRole === 'giamthi') && (
            <select
              value={activeClass}
              onChange={(e) => handleClassSelect(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-[#8B1A4A]"
            >
              {ALL_CLASSES.map((cls: string) => (
                <option key={cls} value={cls}>
                  Lớp {cls}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsConferenceModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <Bi vi="Họp phụ huynh" en="Parent Conference" />
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#8B1A4A] hover:bg-[#72153c] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <Bi vi="Tạo ghi nhận" en="Add Note" />
          </button>
        </div>
      </div>

      {/* 2. Early Warning Alert Banner */}
      <EarlyWarningBanner
        alerts={classAlerts}
        onSelectStudent={(studentId) => setSelectedStudentForDrawer(studentId)}
        onCreateNote={(studentId) => {
          setSelectedStudentForDrawer(studentId);
          setIsCreateModalOpen(true);
        }}
      />

      {/* 3. KPI Summary Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Notes */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            <Bi vi="Tổng lượt ghi nhận" en="Total Notes" />
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{analytics.totalNotes}</span>
            <span className="text-xs text-slate-400 font-medium">phiếu</span>
          </div>
        </div>

        {/* Positive Count */}
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
            <Bi vi="Khen ngợi" en="Praises" />
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700">{analytics.positiveCount}</span>
            <span className="text-xs text-emerald-600 font-bold">
              {analytics.totalNotes > 0 ? `${analytics.positivePercentage}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Negative Count */}
        <div className="bg-white rounded-xl border border-rose-100 p-4 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-xs text-rose-800 font-semibold mb-1">
            <Bi vi="Nhắc nhở vi phạm" en="Reminders" />
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-700">{analytics.negativeCount}</span>
            <span className="text-xs text-rose-600 font-bold">
              {analytics.totalNotes > 0
                ? `${Math.round(((analytics.negativeCount / analytics.totalNotes) * 100) * 10) / 10}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Early Warning Students Count */}
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-xs text-amber-800 font-semibold mb-1">
            <Bi vi="Cần can thiệp" en="Early Warnings" />
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700">{classAlerts.length}</span>
            <span className="text-xs text-amber-600 font-bold">học sinh</span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <BehaviorNotesFilter
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        roster={roster}
      />

      {/* 5. View Mode Switcher */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">
          Danh sách ghi nhận ({filteredNotes.length})
        </span>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors ${
              viewMode === 'timeline'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <Bi vi="Dòng thời gian" en="Timeline" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('student')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors ${
              viewMode === 'student'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <Bi vi="Theo học sinh" en="By Student" />
          </button>
        </div>
      </div>

      {/* 6. Main Notes Feed */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Không có ghi nhận nề nếp nào</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Chưa có phiếu khen ngợi hoặc vi phạm phù hợp với bộ lọc hiện tại. Nhấn "Tạo ghi nhận" để thêm mới.
          </p>
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline Feed */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => (
            <BehaviorNoteCard
              key={note.id}
              note={note}
              canDelete={canDeleteNote(note.authorId)}
              onDelete={deleteNote}
              onStudentClick={(studentId) => setSelectedStudentForDrawer(studentId)}
            />
          ))}
        </div>
      ) : (
        /* Grouped by Student */
        <div className="space-y-4">
          {roster.map((student) => {
            const studentNotes = filteredNotes.filter(
              (n) => n.studentId === student.id || n.studentId === student.mhs
            );
            if (studentNotes.length === 0) return null;

            return (
              <div
                key={student.id || student.mhs}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentForDrawer(student.id || student.mhs)}
                    className="flex items-center space-x-2 text-left hover:text-[#8B1A4A] transition-colors"
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                      {student.stt}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{student.name}</span>
                    <span className="text-xs text-slate-400">({student.mhs})</span>
                  </button>

                  <span className="text-xs font-semibold text-slate-500">
                    {studentNotes.length} phiếu ghi nhận
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {studentNotes.map((note) => (
                    <BehaviorNoteCard
                      key={note.id}
                      note={note}
                      canDelete={canDeleteNote(note.authorId)}
                      onDelete={deleteNote}
                      onStudentClick={(studentId) => setSelectedStudentForDrawer(studentId)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals and Drawers */}
      <CreateBehaviorNoteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        classId={activeClass}
        roster={roster}
      />

      <ConferenceSummaryModal
        isOpen={isConferenceModalOpen}
        onClose={() => setIsConferenceModalOpen(false)}
        classId={activeClass}
        notes={notes}
        roster={roster}
        gvcnName={gvcnName || undefined}
      />

      <StudentProfileDrawer
        isOpen={!!selectedStudentForDrawer}
        onClose={() => setSelectedStudentForDrawer(null)}
        studentId={selectedStudentForDrawer}
        classId={activeClass}
        activeAlert={activeAlertForSelectedStudent}
        onAddNote={() => {
          setIsCreateModalOpen(true);
        }}
      />
    </div>
  );
};
