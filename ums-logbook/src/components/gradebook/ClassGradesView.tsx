/**
 * Tổng hợp điểm lớp cho GVCN (lớp mình) / BGH (chọn lớp): HS × môn → ĐTBmhk hoặc Đ/CĐ.
 * Bấm tên HS → bảng điểm mọi môn của HS đó theo mẫu học bạ (ĐĐGtx n cột, GK, CK, ĐTBmhk).
 * Chỉ đọc (sửa điểm là việc của GV bộ môn). 1 truy vấn sổ của lớp + 1 truy vấn phân công; xem từng HS không đọc thêm.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Bi } from '../common/Bi';
import { Modal } from '../common/Modal';
import { StudentGradeSheet, type SheetSubject } from './StudentGradeSheet';
import type { StudentDoc } from '../../types';
import { fetchClassRoster } from '../../services/rosterService';
import { fetchClassAssignments, fetchClassGradebooks } from '../../services/gradebookService';
import { formatGrade, termResultText } from '../../utils/gradeCalc';
import {
  STATUS_LABEL,
  classMatrix,
  compareSubjects,
  gradebookProgress,
  normalizeRow,
  partialSummary,
  rowResult,
  txSpecOf,
  withinSlots,
  type GradeAssignment,
  type Gradebook,
} from '../../utils/gradebook';

/** Bảng điểm 1 HS từ các sổ của lớp (gồm cả sổ nháp — GVCN thấy trạng thái từng môn). */
export function studentSheetFromBooks(books: Gradebook[], assigns: Pick<GradeAssignment, 'subjectKey' | 'subjectName'>[], mhs: string): SheetSubject[] {
  const out = new Map<string, SheetSubject>();
  for (const a of assigns) out.set(a.subjectKey, { key: a.subjectKey, name: a.subjectName, tx: [], gk: null, ck: null, result: '', note: 'chưa nhập' });
  for (const gb of books) {
    const r = normalizeRow(gb.rows[mhs], txSpecOf(gb).txSlots);
    const res = rowResult(gb, r);
    out.set(gb.subjectKey, {
      key: gb.subjectKey, name: gb.subjectName, tx: r.tx, gk: r.gk, ck: r.ck, comment: r.comment,
      result: res.status === 'ok' ? termResultText(res) : '',
      note: SHORT_STATUS[gb.status],
    });
  }
  return [...out.values()];
}

const SHORT_STATUS = { draft: 'Nháp', published: 'Đã công bố', locked: 'Đã khóa' } as const;

/** Cách xem bảng tổng hợp: gộp (ĐTBmhk, chưa đủ thì tóm tắt) hoặc tách từng loại điểm. */
export type MatrixView = 'all' | 'tx' | 'gk' | 'ck' | 'avg';
export const MATRIX_VIEWS: { key: MatrixView; vi: string; en: string }[] = [
  { key: 'all', vi: 'Tổng quát', en: 'Overview' },
  { key: 'tx', vi: 'Hệ số 1 (ĐĐGtx)', en: 'Regular (×1)' },
  { key: 'gk', vi: 'Giữa kỳ (×2)', en: 'Midterm (×2)' },
  { key: 'ck', vi: 'Cuối kỳ (×3)', en: 'Final (×3)' },
  { key: 'avg', vi: 'ĐTBmhk', en: 'Term average' },
];

const isLowValue = (v: number | string | null | undefined) => (typeof v === 'number' ? v < 5 : v === 'CĐ');


interface Props {
  year: string;
  term: 1 | 2;
  classOptions: string[];
  initialClassId: string;
}

export const ClassGradesView: React.FC<Props> = ({ year, term, classOptions, initialClassId }) => {
  const [picked, setClassId] = useState(initialClassId);
  // Lớp đang xem luôn nằm trong danh sách được chọn (ô chọn và dữ liệu không được lệch nhau)
  const classId = classOptions.includes(picked) ? picked : classOptions.includes(initialClassId) ? initialClassId : classOptions[0] || '';
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [books, setBooks] = useState<Gradebook[] | null>(null);
  const [assigns, setAssigns] = useState<GradeAssignment[]>([]);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<StudentDoc | null>(null);
  const [view, setView] = useState<MatrixView>('all');

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    setBooks(null);
    setError('');
    Promise.all([fetchClassRoster(classId), fetchClassGradebooks(year, term, classId), fetchClassAssignments(year, classId)])
      .then(([r, b, a]) => {
        if (cancelled) return;
        setStudents(r);
        setBooks(b);
        setAssigns(a);
      })
      .catch((e) => {
        console.warn('[Sổ điểm] tổng hợp lớp', e);
        if (!cancelled) {
          setBooks([]);
          setError('Không tải được điểm của lớp (kiểm tra quyền hoặc mạng).');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [classId, year, term]);

  // Cột: mọi môn đã phân công + môn có sổ nhưng không còn trong phân công
  const subjects = useMemo(() => {
    const m = new Map<string, { key: string; name: string; book?: Gradebook }>();
    for (const a of assigns) m.set(a.subjectKey, { key: a.subjectKey, name: a.subjectName });
    for (const b of books || []) m.set(b.subjectKey, { key: b.subjectKey, name: b.subjectName, book: b });
    return [...m.values()].sort(compareSubjects).map((x) => ({ ...x, slots: txSpecOf(x.book || { subjectKey: x.key }).txSlots }));
  }, [assigns, books]);
  const ids = students.map((s) => s.mhs);
  const matrix = useMemo(() => classMatrix(books || [], ids), [books, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2 font-semibold text-slate-700">
          <Bi vi="Lớp" en="Class" layout="inline" />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={classOptions.length <= 1} className="border border-slate-300 rounded-lg px-2 py-1.5" aria-label="Lớp tổng hợp">
            {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <span className="text-slate-500">Chỉ xem — GV bộ môn nhập/sửa điểm. Bấm tên HS để xem bảng điểm đủ các môn. Chọn loại điểm ở hàng nút: Tổng quát = ĐTBmhk, chưa đủ thì chữ xám nhỏ tóm tắt điểm đã nhập; Hệ số 1 = từng cột ĐĐGtx; Giữa kỳ / Cuối kỳ = 1 cột mỗi môn. Đỏ = dưới 5,0 hoặc CĐ. Gồm cả điểm nháp chưa công bố.</span>
      </div>
      <div role="tablist" aria-label="Loại điểm" className="flex flex-wrap gap-1.5">
        {MATRIX_VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            data-testid={`gb-view-${v.key}`}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${view === v.key ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'bg-white text-slate-700 border-slate-300 hover:border-[#8B1A4A]'}`}
          >
            <Bi vi={v.vi} en={v.en} layout="inline" />
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      {books == null && <p className="text-xs text-slate-500">Đang tải…</p>}
      {books != null && subjects.length === 0 && !error && (
        <p className="text-sm text-slate-600 bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center">Lớp chưa có phân công hoặc sổ điểm nào cho học kỳ này.</p>
      )}
      {books != null && subjects.length > 0 && (
        <div className="overflow-auto border border-slate-200 rounded-xl bg-white max-h-[70vh]">
          <table className="min-w-full text-xs border-collapse" data-testid="gb-class-matrix">
            <thead className="sticky top-0 z-10 bg-[#8B1A4A] text-white">
              <tr>
                <th rowSpan={view === 'tx' ? 2 : 1} className="px-2 py-2 border border-white/20 w-10">STT</th>
                <th rowSpan={view === 'tx' ? 2 : 1} className="px-2 py-2 border border-white/20 text-left min-w-44">Họ tên</th>
                {subjects.map((s) => {
                  const st = s.book ? STATUS_LABEL[s.book.status] : null;
                  const p = s.book ? gradebookProgress(s.book, ids) : null;
                  return (
                    <th key={s.key} colSpan={view === 'tx' ? s.slots : 1} className="px-2 py-1 border border-white/20 min-w-20 align-bottom">
                      <div>{s.name}</div>
                      <div className="font-normal text-[10px] text-white/80">
                        {st ? `${SHORT_STATUS[s.book!.status]} · đủ ${p!.complete}/${ids.length}` : 'Chưa nhập'}
                      </div>
                    </th>
                  );
                })}
              </tr>
              {view === 'tx' && (
                <tr>
                  {subjects.flatMap((s) =>
                    Array.from({ length: s.slots }, (_, k) => (
                      <th key={`${s.key}-${k}`} className="px-1 py-0.5 border border-white/20 font-normal text-[10px] min-w-8">{k + 1}</th>
                    )),
                  )}
                </tr>
              )}
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.mhs} className="odd:bg-white even:bg-slate-50">
                  <td className="px-2 py-1 border border-slate-200 text-center text-slate-500">{i + 1}</td>
                  <td className="px-2 py-1 border border-slate-200 font-semibold text-slate-800 whitespace-nowrap">
                    <button type="button" onClick={() => setViewing(s)} data-testid={`gb-student-${s.mhs}`} className="text-left hover:underline text-[#8B1A4A]">
                      {s.name}
                    </button>
                  </td>
                  {subjects.map((sub) => {
                    const raw = sub.book?.rows[s.mhs];
                    const row = raw ? withinSlots(normalizeRow(raw, sub.slots), sub.slots) : null;
                    if (view === 'tx') {
                      return Array.from({ length: sub.slots }, (_, k) => {
                        const v = row?.tx[k] ?? null;
                        return (
                          <td key={`${sub.key}-${k}`} data-testid={`gb-cell-${s.mhs}-${sub.key}-tx${k + 1}`} className={`px-1 py-1 border border-slate-200 text-center ${isLowValue(v) ? 'text-red-700 font-bold bg-red-50' : 'text-slate-800'}`}>
                            {v == null ? '' : formatGrade(v)}
                          </td>
                        );
                      });
                    }
                    if (view === 'gk' || view === 'ck') {
                      const v = row?.[view] ?? null;
                      return (
                        <td key={sub.key} data-testid={`gb-cell-${s.mhs}-${sub.key}`} className={`px-2 py-1 border border-slate-200 text-center ${isLowValue(v) ? 'text-red-700 font-bold bg-red-50' : 'text-slate-800'}`}>
                          {v == null ? '' : formatGrade(v)}
                        </td>
                      );
                    }
                    const r = matrix[s.mhs]?.[sub.key];
                    const txt = r ? termResultText(r) : '';
                    const low = r?.status === 'ok' && (('avg' in r && r.avg < 5) || ('result' in r && r.result === 'Chưa đạt'));
                    // Chưa đủ điểm để tính ĐTBmhk → vẫn hiện điểm đã nhập (vd. mới có GK), chữ nhỏ màu xám
                    const partial = view === 'all' && !txt && sub.book ? partialSummary(sub.book, raw) : '';
                    return (
                      <td key={sub.key} data-testid={`gb-cell-${s.mhs}-${sub.key}`} className={`px-2 py-1 border border-slate-200 text-center ${low ? 'text-red-700 font-bold bg-red-50' : 'text-slate-800'}`}>
                        {txt ? txt.replace('.', ',') : <span className="text-[10px] text-slate-500 whitespace-nowrap">{partial}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        maxWidth="2xl"
        title={viewing ? `Bảng điểm HK${term} — ${viewing.name} (${classId})` : ''}
      >
        {viewing && (
          <div className="space-y-2">
            <StudentGradeSheet subjects={studentSheetFromBooks(books || [], assigns, viewing.mhs)} testId="gb-student-sheet" />
            <p className="text-[11px] text-slate-500">
              ĐTBmhk = (ΣĐĐGtx + 2×ĐĐGgk + 3×ĐĐGck) / (số ĐĐGtx + 5). Môn đánh giá bằng nhận xét: Đ/CĐ. Chỉ xem — sửa điểm do GV bộ môn.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
