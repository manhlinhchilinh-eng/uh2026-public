/**
 * Mục menu "Thời khóa biểu" cho PH/HS (/thoi-khoa-bieu) — góp ý 05/11: HS không tìm thấy TKB lớp mình.
 * Lớp lấy từ tài khoản (`assignedClassId`) + lớp của các HS được liên kết (PH có nhiều con). Mỗi lớp 1 lượt đọc TKB (cache 10 phút).
 */
import React, { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { FamilyTimetableCard } from '../components/family/FamilyTimetableCard';
import { useAuth } from '../hooks/useAuth';
import { fetchLinkedStudents, type LinkedStudent } from '../services/familyService';

export function familyClassIds(assignedClassId: string | null | undefined, students: Pick<LinkedStudent, 'className'>[]): string[] {
  const out: string[] = [];
  for (const c of [...students.map((s) => s.className), assignedClassId]) {
    const v = String(c || '').trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export const FamilyTimetablePage: React.FC = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<LinkedStudent[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLinkedStudents(profile?.studentDocIds)
      .then((s) => alive && setStudents(s))
      .catch(() => alive && setStudents([]));
    return () => {
      alive = false;
    };
  }, [profile?.studentDocIds]);

  const classes = familyClassIds(profile?.assignedClassId, students || []);
  const nameOf = (c: string) => (students || []).filter((s) => s.className === c).map((s) => s.fullName).join(', ');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-ums-50 text-[#8B1A4A]">
          <CalendarDays className="w-5 h-5" />
        </div>
        <h2 className="text-base font-bold text-slate-900">
          <Bi vi="Thời khóa biểu" en="Timetable" layout="inline" />
        </h2>
      </div>
      {students === null && <p className="text-sm text-slate-500">Đang tải…</p>}
      {students !== null && classes.length === 0 && (
        <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-4">
          Tài khoản chưa được gắn lớp. Vui lòng liên hệ GVCN.
        </p>
      )}
      {classes.map((c) => (
        <section key={c} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          {nameOf(c) && <p className="text-xs text-slate-500">{nameOf(c)}</p>}
          <FamilyTimetableCard classId={c} />
        </section>
      ))}
    </div>
  );
};

export default FamilyTimetablePage;
