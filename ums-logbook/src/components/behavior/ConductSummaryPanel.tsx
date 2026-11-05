/**
 * Tổng hợp cho nhận xét học bạ: theo từng HS — số lần khen / nhắc nhở (từ sổ đầu bài & nề nếp),
 * nghỉ có phép / không phép, gợi ý câu nhận xét (bản nháp). GVCN: lớp mình. BGH/TPT/Giám thị: mọi lớp.
 */

import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ALL_CLASSES } from '../../services/seedService';
import { fetchConductData } from '../../services/conductService';
import { buildConductSummary, termRanges, type StudentConduct } from '../../utils/conductSummary';
import { currentAcademic } from '../../utils/academicCalendar';

const todayIso = () => new Date().toISOString().slice(0, 10);

export const ConductSummaryPanel: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const fixedClass = activeRole === 'gvcn' ? profile?.assignedClassId || null : null;
  const [classId, setClassId] = useState(fixedClass || profile?.assignedClassId || '6A1');
  const terms = useMemo(() => termRanges(currentAcademic().academicYear, todayIso()), []);
  const [termId, setTermId] = useState('hk1');
  const [range, setRange] = useState(() => terms.find((t) => t.id === 'hk1')!);
  const [rows, setRows] = useState<StudentConduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fixedClass) setClassId(fixedClass);
  }, [fixedClass]);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    fetchConductData(classId, range.from, range.to)
      .then(({ students, notes, attendance }) => alive && setRows(buildConductSummary(students, notes, attendance, range)))
      .catch((e) => {
        console.error('[Học bạ] tổng hợp', e);
        if (alive) setError('Không tải được dữ liệu tổng hợp.');
      });
    return () => {
      alive = false;
    };
  }, [classId, range]);

  const exportExcel = () => {
    if (!rows) return;
    const data = rows.map((r) => ({
      STT: r.stt,
      'Mã HS': r.mhs,
      'Họ và tên': r.fullName,
      'Số lần khen': r.positive,
      'Số lần nhắc nhở/vi phạm': r.negative,
      'Nổi bật': r.topPositive.join('; '),
      'Cần khắc phục': r.topNegative.join('; '),
      'Nghỉ có phép (buổi)': r.excused,
      'Nghỉ không phép (buổi)': r.unexcused,
      'Gợi ý nhận xét (bản nháp)': r.suggestion,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 5 }, { wch: 9 }, { wch: 26 }, { wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 30 }, { wch: 9 }, { wch: 9 }, { wch: 70 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Lop ${classId}`);
    XLSX.writeFile(wb, `TongHop_HocBa_${classId}_${range.from}_${range.to}.xlsx`);
  };

  const field = 'px-2 py-1.5 border border-slate-300 rounded-lg text-xs';

  return (
    <div className="space-y-3" data-testid="conduct-summary">
      <p className="text-xs text-slate-500">
        Số liệu lấy từ ghi nhận khen/nhắc nhở trong sổ đầu bài, nề nếp (GV, TPT, Giám thị) và điểm danh. Câu gợi ý chỉ là bản nháp để GVCN chỉnh sửa khi viết học bạ.
      </p>
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-end gap-3 text-xs">
        <label className="space-y-1">
          <span className="block font-semibold text-slate-600">Lớp</span>
          <select value={classId} disabled={!!fixedClass} onChange={(e) => setClassId(e.target.value)} className={field} aria-label="Lớp">
            {ALL_CLASSES.map((c) => (
              <option key={c} value={c}>
                Lớp {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block font-semibold text-slate-600">Kỳ</span>
          <select
            value={termId}
            onChange={(e) => {
              setTermId(e.target.value);
              const t = terms.find((x) => x.id === e.target.value);
              if (t) setRange(t);
            }}
            className={field}
            aria-label="Kỳ tổng hợp"
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block font-semibold text-slate-600">Từ ngày</span>
          <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className={field} />
        </label>
        <label className="space-y-1">
          <span className="block font-semibold text-slate-600">Đến ngày</span>
          <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className={field} />
        </label>
        <button
          type="button"
          onClick={exportExcel}
          disabled={!rows?.length}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold bg-[#8B1A4A] text-white hover:bg-[#6B1338] disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!rows && !error && <p className="text-sm text-slate-500">Đang tổng hợp…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate-500">Lớp {classId} chưa có danh sách học sinh.</p>}
      {rows && rows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left w-10">STT</th>
                <th className="p-2 text-left">Họ và tên</th>
                <th className="p-2 text-center">Khen</th>
                <th className="p-2 text-center">Nhắc nhở</th>
                <th className="p-2 text-center">Nghỉ P/K</th>
                <th className="p-2 text-left w-[45%]">
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  Gợi ý nhận xét (bản nháp)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.mhs} data-testid="conduct-row">
                  <td className="p-2 text-slate-500">{r.stt}</td>
                  <td className="p-2 font-semibold text-slate-900">{r.fullName}</td>
                  <td className="p-2 text-center font-bold text-emerald-700" title={r.topPositive.join(', ')}>
                    {r.positive}
                  </td>
                  <td className="p-2 text-center font-bold text-amber-700" title={r.topNegative.join(', ')}>
                    {r.negative}
                  </td>
                  <td className="p-2 text-center text-slate-600">
                    {r.excused}/{r.unexcused}
                  </td>
                  <td className="p-2 text-slate-700">{r.suggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
