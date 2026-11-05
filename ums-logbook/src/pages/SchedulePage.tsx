import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Printer, Users, GraduationCap, Clock, Upload, History, CalendarOff, Eye } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { TimetableGrid, TimetableSlotView } from '../components/schedule/TimetableGrid';
import { scheduleService } from '../services/scheduleService';
import { ALL_CLASSES } from '../services/seedService';
import { resolveCurrentBellPeriod, getDayOfWeekFromDate, UMS_BELL_SCHEDULE, UMS_BREAKS } from '../utils/schedule';
import { TimetableUpdatePanel } from '../components/schedule/TimetableUpdatePanel';
import { ScheduleHistoryPanel } from '../components/schedule/ScheduleHistoryPanel';
import { SchoolCalendarPanel } from '../components/schedule/SchoolCalendarPanel';
import { TeacherAliasAdminPanel } from '../components/schedule/TeacherAliasAdminPanel';
import { MixedPeriodsPanel } from '../components/schedule/MixedPeriodsPanel';
import { useTeachingContext } from '../hooks/useTeachingContext';
import { listTimetableAliases, myTeachingSlots, uniqueAliasLabels } from '../utils/teacherAssignment';
import { PdfExportButton } from '../components/summary/PdfExportButton';
import { currentAcademic } from '../utils/academicCalendar';

type ScheduleTab = 'view' | 'update' | 'history' | 'calendar' | 'teachers' | 'mixed';

export const SchedulePage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = activeRole === 'admin';
  const tabs: Array<{ id: ScheduleTab; label: string; labelEn: string; icon: typeof Eye }> = [
    { id: 'view', label: 'Xem TKB', labelEn: 'View', icon: Eye },
    ...(isAdmin ? [{ id: 'update' as const, label: 'Cập nhật TKB', labelEn: 'Update', icon: Upload }] : []),
    { id: 'history', label: 'Lịch sử thay đổi', labelEn: 'History', icon: History },
    { id: 'calendar', label: 'Ngày nghỉ', labelEn: 'Holidays', icon: CalendarOff },
    ...(isAdmin ? [{ id: 'teachers' as const, label: 'Gắn GV', labelEn: 'Teachers', icon: Users }] : []),
    { id: 'mixed', label: 'Lớp trộn', labelEn: 'Mixed Classes', icon: Users },
  ];
  const requested = searchParams.get('tab') as ScheduleTab | null;
  const tab: ScheduleTab = tabs.some((x) => x.id === requested) ? (requested as ScheduleTab) : 'view';
  const setTab = (id: ScheduleTab) => setSearchParams(id === 'view' ? {} : { tab: id }, { replace: true });
  const [reloadKey, setReloadKey] = useState(0);

  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');
  const [selectedClass, setSelectedClass] = useState<string>(profile?.assignedClassId || '6A1');
  // Xem theo GV: 'uid:<uid>' (tài khoản đã gắn tên TKB) hoặc 'alias:<tên trên TKB>'
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const teach = useTeachingContext();
  useEffect(() => {
    if (selectedTeacher || !teach.ready) return;
    const mine = teach.aliasDocs.find((d) => d.uid === profile?.uid && d.aliases.length);
    const first = teach.aliasDocs.find((d) => d.aliases.length);
    const pick = mine || first;
    if (pick) setSelectedTeacher(`uid:${pick.uid}`);
  }, [teach.ready, teach.aliasDocs, profile?.uid, selectedTeacher]);
  const [slots, setSlots] = useState<TimetableSlotView[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const bell = resolveCurrentBellPeriod();
  const todayDay = getDayOfWeekFromDate();

  useEffect(() => {
    async function fetchTimetable() {
      setIsLoading(true);
      try {
        if (viewMode === 'class') {
          const schedule = await scheduleService.getClassSchedule(selectedClass);
          if (schedule && schedule.slots) {
            setSlots(
              schedule.slots.map((s) => ({
                periodIndex: s.periodIndex,
                dayOfWeek: s.dayOfWeek as any,
                subject: s.subject,
                teacherName: s.teacherName,
                teacherUsername: s.teacherUsername,
                classId: selectedClass,
                room: s.room,
              }))
            );
          }
        } else {
          // Tiết của GV theo tên trên TKB (teacher_aliases) — TKB không còn phụ thuộc username gắn sẵn
          const aliases = selectedTeacher.startsWith('uid:')
            ? teach.aliasDocs.find((d) => d.uid === selectedTeacher.slice(4))?.aliases || []
            : selectedTeacher.startsWith('alias:')
              ? [selectedTeacher.slice(6)]
              : [];
          const teacherSlots = myTeachingSlots(teach.schedules, aliases);
          setSlots(
            teacherSlots.map((s) => ({
              periodIndex: s.periodIndex,
              dayOfWeek: s.dayOfWeek as any,
              subject: s.subject,
              teacherName: s.teacherName,
              classId: s.classId,
            }))
          );
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchTimetable();
  }, [viewMode, selectedClass, selectedTeacher, reloadKey, teach.schedules, teach.aliasDocs]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Header & Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-pink-50 text-[#8B1A4A] rounded-xl border border-pink-100">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi="Thời khóa biểu" en="Timetable" layout="inline" />
            </h2>
            <p className="text-xs text-slate-500">
              Ma trận 40 tiết (Thứ Hai - Thứ Sáu) • Năm học {currentAcademic().academicYear} • Học kỳ {currentAcademic().semester}
            </p>
          </div>
        </div>

        {tab === 'view' && (
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('class')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'class'
                  ? 'bg-white text-[#8B1A4A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
              <Bi vi="Theo Lớp học" en="By Class" layout="inline" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('teacher')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'teacher'
                  ? 'bg-white text-[#8B1A4A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 inline mr-1" />
              <Bi vi="Theo Giáo viên" en="By Teacher" layout="inline" />
            </button>
          </div>

          {/* Class or Teacher Selector */}
          {viewMode === 'class' ? (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-[#8B1A4A]"
            >
              {ALL_CLASSES.map((c) => (
                <option key={c} value={c}>
                  Lớp {c}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              aria-label="Chọn giáo viên"
              className="text-xs font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-[#8B1A4A] max-w-[260px]"
            >
              <option value="">— Chọn giáo viên —</option>
              <optgroup label="Giáo viên (đã gắn tên TKB)">
                {teach.aliasDocs
                  .filter((d) => d.aliases.length)
                  .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'))
                  .map((d) => (
                    <option key={d.uid} value={`uid:${d.uid}`}>
                      {d.displayName} ({uniqueAliasLabels(d.aliases).join(', ')})
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Theo tên trên TKB">
                {listTimetableAliases(teach.schedules).map((a) => (
                  <option key={a.alias} value={`alias:${a.alias}`}>
                    {a.alias}
                  </option>
                ))}
              </optgroup>
            </select>
          )}

          {/* Print Schedule Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <Bi vi="In TKB" en="Print" layout="inline" />
          </button>

          {/* Quick Logbook PDF Export */}
          {viewMode === 'class' && (
            <PdfExportButton
              classId={selectedClass}
              weekNumber={currentAcademic().weekNumber}
              variant="outline"
              label="In Sổ Đầu Bài"
            />
          )}
        </div>
        )}
      </div>

      {/* Các mục của tab Thời khóa biểu */}
      <div className="flex flex-wrap gap-1.5 print:hidden" role="tablist" aria-label="Mục thời khóa biểu">
        {tabs.map(({ id, label, labelEn, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
              tab === id ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#8B1A4A]/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <Bi vi={label} en={labelEn} layout="inline" />
          </button>
        ))}
      </div>

      {tab === 'update' && isAdmin && <TimetableUpdatePanel onUpdated={() => setReloadKey((k) => k + 1)} />}
      {tab === 'history' && <ScheduleHistoryPanel classFilter={profile?.assignedClassId || ''} refreshKey={reloadKey} />}
      {tab === 'calendar' && <SchoolCalendarPanel canEdit={isAdmin} />}
      {tab === 'teachers' && isAdmin && <TeacherAliasAdminPanel />}
      {tab === 'mixed' && <MixedPeriodsPanel canEdit={isAdmin} />}

      {tab === 'view' && (
      <>

      {/* Bell Schedule Summary Legend */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-[#8B1A4A]" />
          <span className="font-bold text-slate-800">Khung giờ UMS:</span>
          <span>
            Sáng (Tiết 1-4: {UMS_BELL_SCHEDULE[0].startTime} - {UMS_BELL_SCHEDULE[3].endTime}) • Nghỉ trưa ({UMS_BELL_SCHEDULE[3].endTime} - {UMS_BELL_SCHEDULE[4].startTime}) • Chiều (Tiết 5-8: {UMS_BELL_SCHEDULE[4].startTime} - {UMS_BELL_SCHEDULE[7].endTime})
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          {UMS_BREAKS.filter((b) => b.type !== 'lunch').map((b) => `${b.labelVi.replace(/ \(.*\)$/, '')}: ${b.startTime} - ${b.endTime} (${b.durationMinutes}p)`).join(' • ')}
        </div>
      </div>

      {/* Timetable Matrix */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          Đang tải dữ liệu thời khóa biểu...
        </div>
      ) : (
        <TimetableGrid
          viewMode={viewMode}
          slots={slots}
          activePeriodIndex={bell.activePeriod}
          activeDayOfWeek={todayDay}
          onSlotClick={(slot) => {
            if (slot.classId && slot.periodIndex) {
              const todayStr = new Date().toISOString().split('T')[0];
              navigate(`/logbook?classId=${encodeURIComponent(slot.classId)}&period=${slot.periodIndex}&date=${todayStr}`);
            }
          }}
        />
      )}
      </>
      )}
    </div>
  );
};
