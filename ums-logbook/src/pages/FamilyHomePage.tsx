/**
 * UMS SmartConnect - Trang chủ Phụ huynh / Học sinh
 * Hiển thị hồ sơ HS được liên kết và nhận xét nề nếp gần đây.
 * (Cổng phụ huynh đầy đủ: điểm danh, tổng kết — ROADMAP P2.6)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, AlertTriangle, LayoutGrid, UserRound, CalendarCheck, ExternalLink } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { fetchStudentDaily } from '../services/studentDailyService';
import { describeDay, summarizeAttendance, type StudentDaily } from '../utils/studentDaily';
import { useAuth } from '../hooks/useAuth';
import { FamilyGradesCard } from '../components/gradebook/FamilyGradesCard';
import { FamilyTimetableCard } from '../components/family/FamilyTimetableCard';
import { FamilyLeaveCard } from '../components/family/FamilyLeaveCard';
import { currentAcademic } from '../utils/academicCalendar';
import {
  fetchLinkedStudents,
  fetchBehaviorNotesForStudent,
  summarizeBehavior,
  type LinkedStudent,
  type FamilyBehaviorNote,
} from '../services/familyService';

interface StudentView {
  student: LinkedStudent;
  notes: FamilyBehaviorNote[];
  days: StudentDaily[];
}

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const FamilyHomePage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const navigate = useNavigate();
  const [views, setViews] = useState<StudentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isParent = activeRole === 'parent';
  const academic = currentAcademic();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const students = await fetchLinkedStudents(profile?.studentDocIds);
        // Mỗi phần tải riêng: nhận xét / chuyên cần lỗi không được làm mất cả trang (TKB, điểm) — góp ý 05/11: HS không thấy TKB
        let partial = false;
        const soft = <T,>(p: Promise<T[]>, what: string): Promise<T[]> =>
          p.catch((e) => {
            console.warn(`[FamilyHomePage] ${what}`, e);
            partial = true;
            return [];
          });
        const result = await Promise.all(
          students.map(async (student) => ({
            student,
            notes: await soft(fetchBehaviorNotesForStudent(student.mhs), 'nhận xét'),
            days: await soft(fetchStudentDaily(student.mhs), 'chuyên cần'),
          }))
        );
        if (!cancelled) {
          setViews(result);
          if (partial) setError('Một phần dữ liệu (nhận xét/chuyên cần) chưa tải được. Vui lòng thử lại sau.');
        }
      } catch (e) {
        console.error('[FamilyHomePage]', e);
        if (!cancelled) setError('Không tải được dữ liệu. Vui lòng thử lại hoặc liên hệ GVCN.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.studentDocIds]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#8B1A4A] to-[#6B1338] text-white rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-white/75">
          <Bi
            vi={isParent ? 'Cổng phụ huynh' : 'Góc học sinh'}
            en={isParent ? 'Parent Portal' : 'Student Corner'}
            layout="inline"
            secondaryClassName="text-white/70 opacity-85"
          />
        </p>
        <h2 className="text-lg font-black mt-0.5">
          <Bi
            vi={`Xin chào, ${profile?.displayName}`}
            en={`Welcome, ${profile?.displayName}`}
            layout="inline"
            secondaryClassName="text-white/80 opacity-85"
          />
        </h2>
      </div>

      {/* Đặt ngay dưới lời chào để PH dễ thấy (góp ý 05/11). */}
      {isParent && views.length > 0 && <FamilyLeaveCard students={views.map((v) => v.student)} />}
      {loading && <p className="text-sm text-slate-500">Đang tải…</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
      {!loading && views.length === 0 && (
        <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-4">
          Tài khoản chưa được liên kết với hồ sơ học sinh. Vui lòng liên hệ GVCN.
        </p>
      )}
      {/* Chưa liên kết hồ sơ HS nhưng tài khoản đã gắn lớp → vẫn xem được TKB lớp */}
      {!loading && views.length === 0 && profile?.assignedClassId && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <FamilyTimetableCard classId={profile.assignedClassId} />
        </section>
      )}

      {views.map(({ student, notes, days }) => {
        const sum = summarizeBehavior(notes);
        const month = thisMonth();
        const att = summarizeAttendance(days.filter((d) => d.date.startsWith(month)));
        return (
          <section key={student.docId} data-testid={`family-student-${student.docId}`} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-ums-50 text-[#8B1A4A]">
                <UserRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{student.fullName}</h3>
                <p className="text-xs text-slate-500">
                  Lớp {student.className} • Mã HS {student.mhs}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" /> <Bi vi="Khen ngợi gần đây" en="Recent praise" layout="inline" />
                </p>
                <p className="text-2xl font-black text-emerald-900 mt-1">{sum.positive}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> <Bi vi="Cần nhắc nhở" en="Reminders" layout="inline" />
                </p>
                <p className="text-2xl font-black text-amber-900 mt-1">{sum.negative}</p>
              </div>
            </div>

            {student.className && <FamilyTimetableCard classId={student.className} />}

            <h4 className="text-xs font-bold text-slate-700 mt-5 mb-2 flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4" />
              <Bi vi={`Chuyên cần tháng ${month.slice(5)}/${month.slice(0, 4)}`} en={`Attendance (${month})`} layout="inline" />
            </h4>
            <div data-testid={`att-summary-${student.docId}`} className="grid grid-cols-4 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Vắng có phép</p><p className="font-black text-base">{att.sessionsP}</p></div>
              <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Vắng không phép</p><p className="font-black text-base">{att.sessionsK}</p></div>
              <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Đi muộn</p><p className="font-black text-base">{att.late}</p></div>
              <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Về sớm</p><p className="font-black text-base">{att.early}</p></div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Đơn vị: buổi (sáng/chiều). Không có ghi nhận nghĩa là con đi học đầy đủ theo sổ đầu bài.</p>
            {days.length > 0 && (
              <ul data-testid={`att-days-${student.docId}`} className="mt-2 space-y-1">
                {days.slice(0, 10).map((d) => (
                  <li key={d.date} className="text-xs text-slate-700">
                    <span className="font-semibold">{d.date.split('-').reverse().join('/')}</span>: {describeDay(d)}
                  </li>
                ))}
              </ul>
            )}
            {student.grade === 9 && (
              <a href="https://umshomeroom9.web.app/tra-cuu" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline">
                Tra cứu điểm khảo sát khối 9 <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <h4 className="text-xs font-bold text-slate-700 mt-5 mb-2">
              <Bi vi="Nhận xét nề nếp gần đây" en="Recent conduct notes" layout="inline" />
            </h4>
            {notes.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có nhận xét nào.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="text-xs border border-slate-100 rounded-lg p-2.5">
                    <span className={`font-bold ${n.type === 'positive' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {n.type === 'positive' ? 'Khen' : 'Nhắc nhở'}
                    </span>
                    <span className="text-slate-400"> • {n.date}{n.subject ? ` • ${n.subject}` : ''}</span>
                    <p className="text-slate-700 mt-0.5">{n.content}</p>
                    {n.authorName && <p className="text-[11px] text-slate-400 mt-0.5">GV: {n.authorName}</p>}
                  </li>
                ))}
              </ul>
            )}
            <FamilyGradesCard mhs={student.mhs} year={academic.academicYear} defaultTerm={academic.semester} />
          </section>
        );
      })}


      <button
        type="button"
        onClick={() => navigate('/apps')}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-[#8B1A4A] hover:bg-rose-50"
      >
        <LayoutGrid className="w-4 h-4" /> <Bi vi="Các ứng dụng khác của trường" en="Other school apps" layout="inline" />
      </button>
    </div>
  );
};
