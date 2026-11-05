/**
 * Sổ điểm môn học (/so-diem): GVBM nhập điểm lớp-môn được phân công, GVCN xem (chỉ đọc) sổ điểm mọi môn của lớp mình,
 * BGH phân công + theo dõi tiến độ. PH/HS xem điểm đã công bố ở Cổng PH (FamilyGradesCard).
 */

import React, { useState } from 'react';
import { BookOpenCheck } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { useAuth } from '../hooks/useAuth';
import { currentAcademic } from '../utils/academicCalendar';
import { GradeEntryPanel } from '../components/gradebook/GradeEntryPanel';
import { ClassGradesView } from '../components/gradebook/ClassGradesView';
import { GradebookAdminPanel } from '../components/gradebook/GradebookAdminPanel';
import { ALL_CLASSES } from '../services/seedService';

type Tab = 'entry' | 'class' | 'admin';

export const GradebookPage: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { academicYear, semester } = currentAcademic();
  const [term, setTerm] = useState<1 | 2>(semester);
  const isAdmin = activeRole === 'admin';
  // Lớp chủ nhiệm của tài khoản (rules isGVCN xét mọi vai trò) — GVCN xem lớp mình kể cả khi đang dùng vai trò GVBM
  const ownClass = activeRole === 'gvcn' || profile?.roles?.includes('gvcn') ? profile?.assignedClassId || '' : '';
  const homeroom = isAdmin ? '' : ownClass;
  // BGH kiêm GVCN: chọn được mọi lớp, mặc định lớp mình (không phải 6A1)
  const overviewInitial = homeroom || ownClass || ALL_CLASSES[0];
  const [tab, setTab] = useState<Tab>(activeRole === 'gvcn' && homeroom ? 'class' : 'entry');

  if (!profile) return null;
  const tabs: Array<{ id: Tab; vi: string; en: string }> = [
    { id: 'entry', vi: 'Nhập điểm', en: 'Enter grades' },
    ...(homeroom || isAdmin ? [{ id: 'class' as Tab, vi: homeroom ? `Lớp chủ nhiệm ${homeroom}` : 'Tổng hợp theo lớp', en: 'Class overview' }] : []),
    ...(isAdmin ? [{ id: 'admin' as Tab, vi: 'Phân công & tiến độ', en: 'Assignments & progress' }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="p-2 rounded-xl bg-ums-50 text-[#8B1A4A]">
          <BookOpenCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">
            <Bi vi="Sổ điểm môn học" en="Subject Gradebook" />
          </h2>
          <p className="text-xs text-slate-500">
            <Bi
              vi={`Năm học ${academicYear} · bản của trường, sửa được, có lịch sử — xuất Excel đúng mẫu để đưa lên CSDL ngành`}
              en={`School year ${academicYear} · school copy with edit history — export to the MOET database template`}
            />
          </p>
        </div>
        {tab !== 'entry' && (
          <select value={term} onChange={(e) => setTerm(Number(e.target.value) as 1 | 2)} className="ml-auto border border-slate-300 rounded-lg px-2 py-1.5 text-xs" aria-label="Học kỳ tổng hợp">
            <option value={1}>Học kỳ 1</option>
            <option value={2}>Học kỳ 2</option>
          </select>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-slate-200 text-sm" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`gb-tab-${t.id}`}
              className={`px-3 py-2 -mb-px border-b-2 font-semibold ${tab === t.id ? 'border-[#8B1A4A] text-[#8B1A4A]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Bi vi={t.vi} en={t.en} layout="inline" />
            </button>
          ))}
        </div>
      )}

      {tab === 'entry' && <GradeEntryPanel profile={profile} isAdmin={isAdmin} year={academicYear} term={term} onTermChange={setTerm} />}
      {tab === 'class' && (
        // key: đổi vai trò (BGH ↔ GVCN) thì dựng lại, không giữ lớp đã chọn ở vai trò trước (lỗi 05/11: tab "Lớp chủ nhiệm 9A3" hiện HS/điểm 6A1)
        <ClassGradesView key={`${activeRole}-${overviewInitial}`} year={academicYear} term={term} classOptions={homeroom ? [homeroom] : ALL_CLASSES} initialClassId={overviewInitial} />
      )}
      {tab === 'admin' && <GradebookAdminPanel profile={profile} year={academicYear} term={term} />}
    </div>
  );
};

export default GradebookPage;
