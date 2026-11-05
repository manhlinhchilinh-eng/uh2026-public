/**
 * Bảng điểm học kỳ của 1 HS theo mẫu học bạ: TT | Môn học | ĐĐGtx (n cột theo môn) | ĐĐGgk | ĐĐGck | ĐTBmhk.
 * Dùng chung: GVCN xem từng HS lớp mình (từ sổ các môn), PH/HS xem bản đã công bố (grade_reports). Chỉ hiển thị.
 */

import React from 'react';
import { formatGrade, isLowResult, type GradeValue } from '../../utils/gradeCalc';
import { compareSubjects, txSpecOf } from '../../utils/gradebook';

export interface SheetSubject {
  key: string;
  name: string;
  tx: GradeValue[];
  gk: GradeValue;
  ck: GradeValue;
  /** ĐTBmhk: "9.8" / "9,8" · "Đ" / "CĐ" · "" */
  result: string;
  comment?: string;
  /** Ghi chú nhỏ dưới tên môn (vd. "Nháp" cho GVCN) */
  note?: string;
}

const showResult = (r: string) => {
  if (!r) return '';
  if (r === 'Đạt') return 'Đ';
  if (r === 'Chưa đạt') return 'CĐ';
  const n = Number(r.replace(',', '.'));
  return Number.isFinite(n) ? formatGrade(n) : r;
};

export const StudentGradeSheet: React.FC<{ subjects: SheetSubject[]; testId?: string }> = ({ subjects, testId }) => {
  const rows = [...subjects].sort(compareSubjects).map((s) => {
    const own = txSpecOf({ subjectKey: s.key, txMin: s.tx.length }).txSlots;
    const slots = Math.max(own, s.tx.reduce<number>((n, v, i) => (v != null ? i + 1 : n), 0));
    return { ...s, slots, own };
  });
  const width = Math.max(4, ...rows.map((r) => r.slots));
  const cell = 'px-2 py-1.5 border border-slate-300 text-center';
  const comments = rows.filter((r) => r.comment);

  return (
    <div data-testid={testId}>
      <div className="overflow-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th rowSpan={2} className={`${cell} w-8`}>TT</th>
              <th rowSpan={2} className={`${cell} text-left min-w-36`}>Môn học</th>
              <th colSpan={width} className={cell}>ĐĐGtx</th>
              <th rowSpan={2} className={`${cell} w-14`}>ĐĐGgk</th>
              <th rowSpan={2} className={`${cell} w-14`}>ĐĐGck</th>
              <th rowSpan={2} className={`${cell} w-16 bg-slate-200`}>ĐTBmhk</th>
            </tr>
            <tr>
              {Array.from({ length: width }, (_, i) => (
                <th key={i} className={`${cell} w-10 font-normal text-slate-500`}>{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.key} className="bg-white" data-testid={`sheet-row-${s.key}`}>
                <td className={cell}>{i + 1}</td>
                <td className="px-2 py-1.5 border border-slate-300 text-left font-semibold text-slate-800">
                  {s.name}
                  {s.note && <span className="ml-1 font-normal text-[10px] text-slate-500">({s.note})</span>}
                </td>
                {Array.from({ length: width }, (_, k) => (
                  <td key={k} title={k >= s.own && s.tx[k] != null ? 'Cột thừa so với số cột của môn — không tính vào ĐTBmhk' : undefined} className={`${cell} ${k >= s.own ? (s.tx[k] != null ? 'bg-amber-50 text-amber-800 line-through' : 'bg-slate-50') : ''}`}>{formatGrade(s.tx[k] ?? null)}</td>
                ))}
                <td className={cell}>{formatGrade(s.gk)}</td>
                <td className={cell}>{formatGrade(s.ck)}</td>
                <td className={`${cell} font-bold ${isLowResult(s.result) ? 'text-red-700 bg-red-50' : 'text-slate-900'}`}>{showResult(s.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comments.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
          {comments.map((s) => (
            <li key={s.key}><b>{s.name}:</b> <i>{s.comment}</i></li>
          ))}
        </ul>
      )}
    </div>
  );
};
