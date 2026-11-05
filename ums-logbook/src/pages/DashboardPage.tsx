import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Bi } from '../components/common/Bi';
import {
  BookOpen,
  UserCheck,
  Award,
  Trophy,
  Shield,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { EarlyWarningBanner } from '../components/behavior/EarlyWarningBanner';
import { StudentProfileDrawer } from '../components/behavior/StudentProfileDrawer';
import { getMockBehaviorNotes } from '../services/behaviorService';
import { evaluateEarlyWarnings } from '../utils/earlyWarning';
import { StudentDoc } from '../types';
import { AbsenceEvent, EarlyWarningAlert } from '../types/earlyWarning';
import { getClassRoster } from '../components/logbook/PreSessionAttendanceModal';
import { ALL_CLASSES } from '../services/logbookService';
import { SmartNavigationCard } from '../components/schedule/SmartNavigationCard';
import { WeeklySummaryCard } from '../components/summary/WeeklySummaryCard';
import { currentAcademic } from '../utils/academicCalendar';

export const DashboardPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const navigate = useNavigate();

  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<string | null>(null);
  const [selectedClassForDrawer, setSelectedClassForDrawer] = useState<string | undefined>(undefined);
  const [alerts, setAlerts] = useState<EarlyWarningAlert[]>([]);

  useEffect(() => {
    // 1. Gather relevant students
    let studentsToEvaluate: StudentDoc[] = [];
    const assignedClassId = profile?.assignedClassId;
    const isGvcn = activeRole === 'gvcn' && Boolean(assignedClassId);

    if (isGvcn && assignedClassId) {
      studentsToEvaluate = getClassRoster(assignedClassId);
    } else {
      // Admin / TPT: gather students across all classes
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('ums_students');
        if (stored) {
          try {
            studentsToEvaluate = JSON.parse(stored) as StudentDoc[];
          } catch {}
        }
      }
      if (studentsToEvaluate.length === 0) {
        ALL_CLASSES.forEach((cls: string) => {
          studentsToEvaluate.push(...getClassRoster(cls));
        });
      }
    }

    // 2. Gather absences
    const loadedAbsences: AbsenceEvent[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const rawLogbooks = localStorage.getItem('ums_daily_logbooks');
        if (rawLogbooks) {
          const logbooks = JSON.parse(rawLogbooks);
          Object.values(logbooks).forEach((lb: any) => {
            if (isGvcn && assignedClassId && lb.classId !== assignedClassId) return;

            if (lb.preSessionAttendance?.absences) {
              lb.preSessionAttendance.absences.forEach((a: any) => {
                loadedAbsences.push({
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
                    loadedAbsences.push({
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

    // 3. Gather notes
    const allNotes = getMockBehaviorNotes();
    const targetNotes = isGvcn && assignedClassId
      ? allNotes.filter((n) => n.classId === assignedClassId)
      : allNotes;

    // 4. Evaluate early warnings
    const evAlerts = evaluateEarlyWarnings(studentsToEvaluate, loadedAbsences, targetNotes, {
      classId: isGvcn && assignedClassId ? assignedClassId : undefined,
    });
    setAlerts(evAlerts);
  }, [profile, activeRole]);

  const activeAlertForSelectedStudent = useMemo(() => {
    if (!selectedStudentForDrawer) return undefined;
    return alerts.find(
      (a) => a.studentId === selectedStudentForDrawer || a.studentName === selectedStudentForDrawer
    );
  }, [selectedStudentForDrawer, alerts]);

  return (
    <div className="space-y-6">
      {/* Hero Welcome Card */}
      <div className="bg-gradient-to-r from-[#8B1A4A] to-[#611736] rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{currentAcademic().academicYear} • Học kỳ {currentAcademic().semester}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black">
              <Bi
                vi={`Xin chào, ${profile?.displayName || profile?.username}!`}
                en={`Welcome, ${profile?.displayName || profile?.username}!`}
                layout="inline"
                secondaryClassName="text-white/80 opacity-85"
              />
            </h2>
            <p className="mt-1 text-xs md:text-sm text-white/80 max-w-xl">
              Chào mừng bạn đến với Hệ thống Sổ đầu bài điện tử Trường THCS Ngoại ngữ (UMS).
              Vai trò hiện tại: <span className="font-bold underline">{activeRole}</span>
              {profile?.assignedClassId && activeRole === 'gvcn' && (
                <span> (Chủ nhiệm Lớp {profile.assignedClassId})</span>
              )}
            </p>
          </div>

          <div className="shrink-0 flex items-center space-x-2">
            <Link
              to="/logbook"
              className="px-4 py-2 bg-white text-[#8B1A4A] rounded-xl text-xs font-bold shadow hover:bg-slate-50 transition-colors"
            >
              <Bi vi="Vào Sổ Đầu Bài" en="Open Logbook" layout="inline" />
            </Link>
          </div>
        </div>
      </div>

      {/* Smart GVBM Teaching & Timetable Navigation Card */}
      <SmartNavigationCard />

      {/* Early Warning Banner (Immediately visible to GVCN and Admins) */}
      <EarlyWarningBanner
        alerts={alerts}
        onSelectStudent={(studentId) => {
          const found = alerts.find((a) => a.studentId === studentId);
          setSelectedClassForDrawer(found?.classId);
          setSelectedStudentForDrawer(studentId);
        }}
        onCreateNote={() => {
          navigate('/behavior');
        }}
      />

      {/* GVCN Weekly Summary & Emulation Standing Widget */}
      {profile?.assignedClassId && (activeRole === 'gvcn' || activeRole === 'admin') && (
        <WeeklySummaryCard
          classId={profile.assignedClassId}
          weekNumber={currentAcademic().weekNumber}
        />
      )}

      {/* Quick Action Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Link
          to="/logbook"
          data-testid="dash-card-logbook"
          className="p-5 bg-white rounded-xl shadow-xs border border-slate-200 hover:border-ums-300 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-ums-50 text-[#8B1A4A] flex items-center justify-center group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-slate-800 group-hover:text-[#8B1A4A] transition-colors">
              <Bi vi="Sổ đầu bài" en="Class Logbook" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">Ký sổ và chấm điểm 8 tiết</p>
          </div>
        </Link>

        <Link
          to="/attendance"
          data-testid="dash-card-attendance"
          className="p-5 bg-white rounded-xl shadow-xs border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
              <Bi vi="Điểm danh đầu giờ" en="Pre-session Attendance" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">Báo cáo vắng P/K, đi muộn</p>
          </div>
        </Link>

        <Link
          to="/behavior"
          data-testid="dash-card-behavior"
          className="p-5 bg-white rounded-xl shadow-xs border border-slate-200 hover:border-rose-300 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Award className="w-5 h-5" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-slate-800 group-hover:text-rose-700 transition-colors">
              <Bi vi="Sổ nề nếp & hành vi" en="Behavior & Conduct" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">Khen ngợi & ghi nhận vi phạm</p>
          </div>
        </Link>

        <Link
          to="/emulation"
          data-testid="dash-card-emulation"
          className="p-5 bg-white rounded-xl shadow-xs border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-slate-800 group-hover:text-amber-700 transition-colors">
              <Bi vi="Xếp hạng thi đua" en="Class Ranking" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">Bảng xếp hạng thi đua 26 lớp</p>
          </div>
        </Link>
      </div>

      {/* Overview Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Class Overview */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-[#8B1A4A]" />
            <Bi vi="Quy mô trường học" en="School Scale" layout="inline" />
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="block text-2xl font-black text-ums-900">26</span>
              <span className="text-xs text-slate-500 font-medium">
                <Bi vi="Lớp học" en="Classes" />
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="block text-2xl font-black text-ums-900">674</span>
              <span className="text-xs text-slate-500 font-medium">
                <Bi vi="Học sinh" en="Students" />
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="block text-2xl font-black text-ums-900">29</span>
              <span className="text-xs text-slate-500 font-medium">
                <Bi vi="Tài khoản GV" en="Teachers" />
              </span>
            </div>
          </div>
        </div>

        {/* Roles & System Status */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
            <Shield className="w-4 h-4 text-purple-600" />
            <Bi vi="Thông tin phiên làm việc" en="Session Info" layout="inline" />
          </h3>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400">Tài khoản:</span>
              <span className="font-mono font-semibold">{profile?.username}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400">Các vai trò:</span>
              <span className="font-semibold text-purple-700">{profile?.roles.join(', ')}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Thời gian tự ngắt phiên:</span>
              <span className="font-semibold text-emerald-600">30 phút không hoạt động</span>
            </div>
          </div>
        </div>
      </div>

      {/* Student Profile Drawer */}
      <StudentProfileDrawer
        isOpen={!!selectedStudentForDrawer}
        onClose={() => setSelectedStudentForDrawer(null)}
        studentId={selectedStudentForDrawer}
        classId={selectedClassForDrawer}
        activeAlert={activeAlertForSelectedStudent}
        onAddNote={() => {
          navigate('/behavior');
        }}
      />
    </div>
  );
};

export default DashboardPage;
