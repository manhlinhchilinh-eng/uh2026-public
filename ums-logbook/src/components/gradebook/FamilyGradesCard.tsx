/**
 * Cổng PH / Góc HS: điểm các môn đã được GV công bố (grade_reports — chỉ điểm của con/của mình).
 * Bảng theo mẫu học bạ (StudentGradeSheet). 1 lượt đọc mỗi học kỳ, tải khi mở trang/đổi học kỳ.
 */

import React, { useEffect, useState } from 'react';
import { BookOpenCheck } from 'lucide-react';
import { Bi } from '../common/Bi';
import { fetchGradeReport, type GradeReport } from '../../services/gradebookService';
import { StudentGradeSheet, type SheetSubject } from './StudentGradeSheet';

interface Props {
  mhs: string;
  year: string;
  defaultTerm: 1 | 2;
}

export const FamilyGradesCard: React.FC<Props> = ({ mhs, year, defaultTerm }) => {
  const [term, setTerm] = useState<1 | 2>(defaultTerm);
  const [report, setReport] = useState<GradeReport | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setReport(undefined);
    fetchGradeReport(year, term, mhs)
      .then((r) => !cancelled && setReport(r))
      .catch((e) => {
        console.warn('[Điểm các môn]', e);
        if (!cancelled) setReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mhs, year, term]);

  const subjects: SheetSubject[] = Object.entries(report?.subjects || {}).map(([key, x]) => ({
    key, name: x.name, tx: x.tx || [], gk: x.gk ?? null, ck: x.ck ?? null, result: x.result || '', comment: x.comment,
  }));

  return (
    <div className="mt-4" data-testid={`family-grades-${mhs}`}>
      <div className="flex items-center gap-2 mb-2">
        <BookOpenCheck className="w-4 h-4 text-[#8B1A4A]" />
        <h4 className="text-sm font-bold text-slate-800"><Bi vi="Điểm các môn" en="Subject grades" layout="inline" /></h4>
        <div className="ml-auto flex gap-1 text-xs">
          {([1, 2] as const).map((t) => (
            <button key={t} type="button" aria-pressed={term === t} onClick={() => setTerm(t)}
              className={`px-2 py-0.5 rounded-full border font-semibold ${term === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-300'}`}>
              HK{t}
            </button>
          ))}
        </div>
      </div>
      {report === undefined && <p className="text-xs text-slate-500">Đang tải…</p>}
      {report !== undefined && subjects.length === 0 && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">Chưa có môn nào được công bố điểm học kỳ {term}.</p>
      )}
      {subjects.length > 0 && (
        <>
          <StudentGradeSheet subjects={subjects} testId={`family-grade-sheet-${mhs}`} />
          <p className="text-[11px] text-slate-500 mt-1.5">
            Điểm do GV bộ môn công bố trên UMS+ — bản của nhà trường, có thể được GV điều chỉnh trước khi chốt lên CSDL ngành (enetViet).
          </p>
        </>
      )}
    </div>
  );
};
