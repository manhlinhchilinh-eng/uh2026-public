/**
 * UMS Digital Class Logbook - Student Behavior Notes Page
 * Milestone 3: Behavior Dashboard & Early Warning Overview
 * + Tổng hợp cho nhận xét học bạ (GVCN lớp mình; BGH/TPT/Giám thị mọi lớp).
 * Path: src/pages/BehaviorPage.tsx
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentNotesView } from '../components/behavior/StudentNotesView';
import { ConductSummaryPanel } from '../components/behavior/ConductSummaryPanel';
import { Bi } from '../components/common/Bi';
import { useAuth } from '../hooks/useAuth';

export const BehaviorPage: React.FC = () => {
  const { activeRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const canSummarize = activeRole === 'gvcn' || activeRole === 'admin' || activeRole === 'tpt' || activeRole === 'giamthi';
  const tab = canSummarize && params.get('tab') === 'hocba' ? 'hocba' : 'notes';

  return (
    <div className="space-y-4">
      {canSummarize && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Nề nếp">
          {[
            { id: 'notes', label: 'Ghi nhận nề nếp', en: 'Behavior Notes' },
            { id: 'hocba', label: 'Tổng hợp cho học bạ', en: 'Transcript Summary' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setParams(t.id === 'notes' ? {} : { tab: t.id }, { replace: true })}
              className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                tab === t.id ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#8B1A4A]/50'
              }`}
            >
              <Bi vi={t.label} en={t.en} />
            </button>
          ))}
        </div>
      )}
      {tab === 'notes' ? <StudentNotesView /> : <ConductSummaryPanel />}
    </div>
  );
};

export const BehaviorNotesPage = BehaviorPage;
export default BehaviorPage;
