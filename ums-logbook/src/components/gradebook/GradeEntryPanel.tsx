/**
 * Nhập điểm môn học — bố cục theo màn "5.3.1 Nhập điểm môn học" của CSDL ngành, màu UMS.
 * Lọc Khối / Lớp / Môn / Học kỳ (chỉ lớp-môn được phân công; BGH thấy tất cả), lưới ĐĐGtx 1–n (n theo môn), GK, CK,
 * ĐTBmhk tự tính (TT22), nhận xét; Nhập/Xuất Excel; Ghi (kèm lịch sử); Công bố cho PH/HS; Khóa khi đã đưa lên CSDL.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, History, LockOpen, Save, Send, Upload } from 'lucide-react';
import { Bi } from '../common/Bi';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';
import type { UserProfile } from '../../types/auth';
import type { StudentDoc } from '../../types';
import { fetchClassRoster } from '../../services/rosterService';
import {
  GradebookConflictError,
  fetchAllAssignments,
  fetchHistory,
  fetchMyAssignments,
  getGradebook,
  publishReports,
  saveGradebook,
  saveStudentMoetIds,
  type HistoryEntry,
} from '../../services/gradebookService';
import { formatGrade, parseGradeInput, termResult, termResultText, type GradeValue } from '../../utils/gradeCalc';
import {
  STATUS_LABEL,
  diffRows,
  emptyRow,
  getField,
  gradeFields,
  gradebookId,
  needsReason,
  newGradebook,
  nextCell,
  normalizeRow,
  setField,
  txSpecOf,
  withinSlots,
  extraTxStudents,
  type GradeAssignment,
  type GradeField,
  type GradeRow,
  type Gradebook,
  type GradebookStatus,
  type JumpMode,
} from '../../utils/gradebook';
import { buildGradebookSheet, exportFileName, parseGradebookSheet, type ImportResult } from '../../utils/gradebookExcel';

type Raw = Record<string, Partial<Record<GradeField, string>>>;

const fieldLabel = (f: GradeField): string =>
  f === 'gk' ? 'ĐĐGgk' : f === 'ck' ? 'ĐĐGck' : f === 'comment' ? 'Nhận xét' : `ĐĐGtx ${f.slice(2)}`;
const gradeOfClass = (classId: string) => classId.match(/^\d+/)?.[0] || '';

/** Số cột ĐĐGtx trên lưới: theo môn; sổ cũ còn điểm ở cột thứ 5 → hiện thêm cột đó để GV thấy/xóa. */
export function gridTxSlots(gb: Pick<Gradebook, 'subjectKey' | 'txMin' | 'rows'>): number {
  const base = txSpecOf(gb).txSlots;
  let n = base;
  for (const r of Object.values(gb.rows || {})) n = Math.max(n, normalizeRow(r, base).tx.length);
  return n;
}

function rawFromRows(rows: Record<string, GradeRow>, slots: number): Raw {
  const out: Raw = {};
  for (const [mhs, r] of Object.entries(rows)) {
    const n = normalizeRow(r, slots);
    out[mhs] = Object.fromEntries(gradeFields(slots).map((f) => [f, f === 'comment' ? n.comment : formatGrade(getField(n, f) as GradeValue)]));
  }
  return out;
}

interface Props {
  profile: UserProfile;
  isAdmin: boolean;
  year: string;
  term: 1 | 2;
  onTermChange: (t: 1 | 2) => void;
}

export const GradeEntryPanel: React.FC<Props> = ({ profile, isAdmin, year, term, onTermChange }) => {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState<GradeAssignment[] | null>(null);
  const [grade, setGrade] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectKey, setSubjectKey] = useState('');
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [gb, setGb] = useState<Gradebook | null>(null);
  const [raw, setRaw] = useState<Raw>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jump, setJump] = useState<JumpMode>('row');
  const [showDob, setShowDob] = useState(false);
  const [importRes, setImportRes] = useState<ImportResult | null>(null);
  const [importSheet, setImportSheet] = useState<{ rows: (string | number)[][]; pick: Partial<Record<'gk' | 'ck', number>> } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    (isAdmin ? fetchAllAssignments(year) : fetchMyAssignments(profile.uid, year))
      .then((list) => setAssignments(list.sort((a, b) => a.classId.localeCompare(b.classId, 'vi', { numeric: true }))))
      .catch((e) => {
        console.warn('[Sổ điểm] tải phân công', e);
        setAssignments([]);
      });
  }, [isAdmin, profile.uid, year]);

  const grades = useMemo(() => [...new Set((assignments || []).map((a) => gradeOfClass(a.classId)))].sort(), [assignments]);
  const classes = useMemo(
    () => [...new Set((assignments || []).filter((a) => !grade || gradeOfClass(a.classId) === grade).map((a) => a.classId))],
    [assignments, grade]
  );
  const subjects = useMemo(() => (assignments || []).filter((a) => a.classId === classId), [assignments, classId]);
  const assignment = subjects.find((a) => a.subjectKey === subjectKey) || null;

  // Chọn sẵn mục đầu tiên
  useEffect(() => {
    if (!grade && grades.length) setGrade(grades[0]);
  }, [grades, grade]);
  useEffect(() => {
    if (classes.length && !classes.includes(classId)) setClassId(classes[0]);
  }, [classes, classId]);
  useEffect(() => {
    if (subjects.length && !subjects.some((s) => s.subjectKey === subjectKey)) setSubjectKey(subjects[0].subjectKey);
  }, [subjects, subjectKey]);

  const id = assignment ? gradebookId(year, term, assignment.classId, assignment.subjectKey) : '';
  useEffect(() => {
    if (!assignment) return;
    let cancelled = false;
    setLoading(true);
    setHistory(null);
    Promise.all([fetchClassRoster(assignment.classId), getGradebook(id)])
      .then(([roster, book]) => {
        if (cancelled) return;
        const g = book ?? newGradebook(assignment, term);
        setStudents(roster);
        setGb(g);
        setRaw(rawFromRows(g.rows, gridTxSlots(g)));
      })
      .catch((e) => {
        console.warn('[Sổ điểm] tải sổ', e);
        if (!cancelled) showToast('Không tải được sổ điểm (kiểm tra quyền hoặc mạng).', 'error');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const mode = gb?.mode ?? 'score';
  const spec = gb ? txSpecOf(gb) : { txSlots: 4, txMin: 4 };
  const slots = useMemo(() => (gb ? gridTxSlots(gb) : 4), [gb]);
  const fields = useMemo(() => gradeFields(slots), [slots]);
  const parsed = useMemo(() => {
    const rows: Record<string, GradeRow> = {};
    const invalid = new Set<string>();
    for (const s of students) {
      let r = emptyRow(slots);
      for (const f of fields) {
        const v = raw[s.mhs]?.[f] ?? '';
        if (f === 'comment') {
          r = setField(r, f, v);
          continue;
        }
        const p = parseGradeInput(v, mode, { shorthand: true });
        if (p === undefined) invalid.add(`${s.mhs}:${f}`);
        else r = setField(r, f, p);
      }
      rows[s.mhs] = r;
    }
    return { rows, invalid };
  }, [raw, students, mode, slots, fields]);

  const changes = useMemo(() => (gb ? diffRows(gb.rows, parsed.rows) : []), [gb, parsed.rows]);
  // HS còn điểm ở cột ĐĐGtx vượt số cột của môn — báo, không tự xóa
  const extraTx = useMemo(() => (gb ? extraTxStudents({ ...gb, rows: parsed.rows }) : []), [gb, parsed.rows]);
  const dirty = changes.length > 0;
  const locked = gb?.status === 'locked';
  const readOnly = !gb || (locked && !isAdmin);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const cols: GradeField[] = fields;
  const focusCell = (r: number, c: number) => {
    const el = gridRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${r}-${c}"]`);
    el?.focus();
    el?.select();
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const [nr, nc] = nextCell(r, c, students.length, cols.length, jump === 'row' ? 'row' : 'column', e.shiftKey);
      focusCell(nr, nc);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(Math.min(students.length - 1, Math.max(0, r + (e.key === 'ArrowDown' ? 1 : -1))), c);
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && cols[c] !== 'comment') {
      const el = e.currentTarget;
      const atEnd = el.selectionStart === el.value.length;
      const atStart = el.selectionEnd === 0;
      if ((e.key === 'ArrowRight' && atEnd) || (e.key === 'ArrowLeft' && atStart)) {
        e.preventDefault();
        focusCell(r, Math.min(cols.length - 1, Math.max(0, c + (e.key === 'ArrowRight' ? 1 : -1))));
      }
    }
  };
  // Rời ô: hiện lại điểm theo dạng chuẩn ("95" → "9,5"); ô sai giữ nguyên để GV thấy
  const normalizeCell = (mhs: string, f: GradeField) => {
    if (f === 'comment') return;
    const v = raw[mhs]?.[f] ?? '';
    const p = parseGradeInput(v, mode, { shorthand: true });
    if (p === undefined) return;
    const shown = formatGrade(p);
    if (shown !== v) setCell(mhs, f, shown);
  };
  const setCell = (mhs: string, f: GradeField, v: string) => setRaw((prev) => ({ ...prev, [mhs]: { ...prev[mhs], [f]: v } }));

  const commit = async (status: GradebookStatus | undefined, action: HistoryEntry['action'], askReason: boolean) => {
    if (!gb) return;
    if (parsed.invalid.size) {
      showToast(`Còn ${parsed.invalid.size} ô không hợp lệ (tô đỏ). Điểm 0–10, 1 chữ số thập phân${mode === 'comment' ? '; môn nhận xét gõ Đ/CĐ' : ''}.`, 'error');
      return;
    }
    let reason: string | undefined;
    if (askReason && needsReason(gb.status) && changes.some((c) => c.field !== 'comment')) {
      reason = window.prompt('Sổ đã công bố cho PH/HS — nhập lý do sửa điểm (lưu vào lịch sử):', '')?.trim();
      if (!reason) return;
    }
    setSaving(true);
    try {
      const next = await saveGradebook(gb, parsed.rows, profile, { status, action, reason });
      if (next.status === 'published' && (action === 'publish' || changes.length > 0)) {
        await publishReports(next, students, profile);
      }
      setGb(next);
      setRaw(rawFromRows(next.rows, gridTxSlots(next)));
      setHistory(null);
      showToast(
        action === 'publish' ? 'Đã công bố cho PH/HS.' : action === 'lock' ? 'Đã khóa sổ.' : action === 'unlock' ? 'Đã mở khóa.' : next.status === 'published' ? 'Đã ghi và cập nhật bản PH/HS xem.' : 'Đã ghi.',
        'success'
      );
    } catch (e) {
      console.warn('[Sổ điểm] ghi', e);
      showToast(e instanceof GradebookConflictError ? e.message + ' Tải lại trang rồi thử lại.' : 'Không ghi được (mạng?). Điểm vẫn còn trên màn hình.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const excelStudents = students.map((s) => ({ mhs: s.mhs, name: s.name, stt: s.stt, moetId: s.moetId, dob: s.dob }));
  const onImport = async (file: File) => {
    if (!gb) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', blankrows: true });
      setImportSheet({ rows, pick: {} });
      setImportRes(parseGradebookSheet(rows, { mode, rows: parsed.rows, subjectKey: gb.subjectKey, txMin: gb.txMin }, excelStudents));
    } catch (e) {
      console.warn('[Sổ điểm] đọc Excel', e);
      showToast('Không đọc được file Excel.', 'error');
    }
  };
  // GV chọn lại cột ĐĐGgk/ĐĐGck (file có cột phụ, vd. "Chốt")
  const repick = (field: 'gk' | 'ck', col: number) => {
    if (!importSheet || !gb) return;
    const pick = { ...importSheet.pick, [field]: col };
    setImportSheet({ ...importSheet, pick });
    setImportRes(parseGradebookSheet(importSheet.rows, { mode, rows: parsed.rows, subjectKey: gb.subjectKey, txMin: gb.txMin }, excelStudents, pick));
  };
  const applyImport = () => {
    if (!importRes) return;
    setRaw(rawFromRows(importRes.rows, slots));
    setImportRes(null);
    setImportSheet(null);
    showToast('Đã đưa điểm vào lưới — kiểm tra rồi bấm "Ghi".', 'success');
  };
  const saveMoet = async () => {
    if (!importRes) return;
    try {
      const n = await saveStudentMoetIds(students, importRes.moetIds);
      showToast(n ? `Đã lưu mã định danh cho ${n} HS.` : 'Mã định danh đã có sẵn.', 'success');
      setStudents((prev) => prev.map((s) => (importRes.moetIds[s.mhs] ? { ...s, moetId: importRes.moetIds[s.mhs] } : s)));
    } catch {
      showToast('Không lưu được mã định danh (chỉ BGH).', 'error');
    }
  };

  const onExport = () => {
    if (!gb) return;
    const { aoa, merges } = buildGradebookSheet({ ...gb, rows: parsed.rows }, excelStudents);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = [{ wch: 5 }, { wch: 8 }, { wch: 16 }, { wch: 26 }, { wch: 11 }, ...Array(txSpecOf(gb).txSlots + 3).fill({ wch: 7 }), { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${gb.classId}`);
    XLSX.writeFile(wb, exportFileName(gb));
  };

  const openHistory = async () => {
    if (!gb || gb.version === 0) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await fetchHistory(gb.id));
    } catch {
      showToast('Không tải được lịch sử.', 'error');
    }
  };

  if (assignments == null) return <p className="text-xs text-slate-500">Đang tải phân công…</p>;
  if (assignments.length === 0) {
    return (
      <p className="text-sm text-slate-600 bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center">
        {isAdmin
          ? 'Chưa có phân công nhập điểm năm học này. Vào tab "Phân công & tiến độ" → "Dựng phân công từ TKB".'
          : 'Bạn chưa được phân công nhập điểm lớp nào. Nhờ BGH dựng phân công từ TKB (hoặc gắn tên TKB của bạn ở trang Thời khóa biểu).'}
      </p>
    );
  }

  const nameOf = new Map(students.map((s) => [s.mhs, s.name]));
  const status = gb ? STATUS_LABEL[gb.status] : null;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50';

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1 font-semibold text-slate-700">
          <Bi vi="Khối" en="Grade" layout="inline" />
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 min-w-20" aria-label="Khối">
            {grades.map((g) => <option key={g} value={g}>Khối {g}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-semibold text-slate-700">
          <Bi vi="Lớp" en="Class" layout="inline" />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 min-w-20" aria-label="Lớp">
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-semibold text-slate-700">
          <Bi vi="Môn học" en="Subject" layout="inline" />
          <select value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 min-w-44" aria-label="Môn học">
            {subjects.map((s) => <option key={s.subjectKey} value={s.subjectKey}>{s.subjectName}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-semibold text-slate-700">
          <Bi vi="Học kỳ" en="Term" layout="inline" />
          <select value={term} onChange={(e) => onTermChange(Number(e.target.value) as 1 | 2)} className="border border-slate-300 rounded-lg px-2 py-1.5" aria-label="Học kỳ">
            <option value={1}>Học kỳ 1</option>
            <option value={2}>Học kỳ 2</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-slate-700 pb-1.5">
          <input type="checkbox" checked={showDob} onChange={(e) => setShowDob(e.target.checked)} /> Hiện ngày sinh, giới tính
        </label>
        <fieldset className="flex items-center gap-3 pb-1.5 text-slate-700">
          <legend className="sr-only">Cấu hình nhập trên lưới</legend>
          <span className="font-semibold">Enter:</span>
          <label className="flex items-center gap-1"><input type="radio" name="jump" checked={jump === 'column'} onChange={() => setJump('column')} /> Nhảy cột (xuống)</label>
          <label className="flex items-center gap-1"><input type="radio" name="jump" checked={jump === 'row'} onChange={() => setJump('row')} /> Nhảy dòng (sang phải)</label>
        </fieldset>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
          <button type="button" disabled={readOnly} onClick={() => fileRef.current?.click()} className={`${btn} bg-[#8B1A4A] text-white hover:bg-[#6B1338]`} data-testid="gb-import">
            <Upload className="w-3.5 h-3.5" /> Nhập từ Excel
          </button>
          <button type="button" disabled={!gb} onClick={onExport} className={`${btn} bg-[#8B1A4A] text-white hover:bg-[#6B1338]`} data-testid="gb-export">
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
          <button type="button" disabled={readOnly || saving || !dirty} onClick={() => commit(undefined, 'edit', true)} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800 px-5`} data-testid="gb-save">
            <Save className="w-3.5 h-3.5" /> Ghi
          </button>
        </div>
      </div>

      {gb && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full border font-bold ${status!.className}`} data-testid="gb-status">
            <Bi vi={status!.vi} en={status!.en} layout="inline" />
          </span>
          <span className="text-slate-500">
            GV bộ môn: <b className="text-slate-700">{assignment?.teacherNames.join(', ') || '—'}</b>
            {gb.updatedAt ? ` · Ghi lần cuối ${new Date(gb.updatedAt).toLocaleString('vi-VN')} (${gb.updatedByName || ''})` : ' · Chưa ghi lần nào'}
            {` · ${spec.txSlots} cột ĐĐGtx, bắt buộc đủ ${spec.txMin} lần · ĐTBmhk = (ΣĐĐGtx + 2·GK + 3·CK) / (số ĐĐGtx + 5)`}
          </span>
          {dirty && <span className="text-amber-700 font-semibold">● {changes.length} ô chưa ghi</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={openHistory} className={`${btn} border border-slate-300 bg-white text-slate-700`}><History className="w-3.5 h-3.5" /> Lịch sử sửa</button>
            {gb.status === 'draft' && (
              <button type="button" disabled={saving || readOnly} data-testid="gb-publish"
                onClick={() => window.confirm('Công bố điểm môn này cho PH/HS xem trên UMS+? (Vẫn sửa được, mỗi lần sửa cần ghi lý do.)') && commit('published', 'publish', false)}
                className={`${btn} bg-sky-700 text-white hover:bg-sky-800`}>
                <Send className="w-3.5 h-3.5" /> Công bố cho PH/HS
              </button>
            )}
            {/* Nút "Khóa (đã lên CSDL)" bỏ 05/11 theo yêu cầu: chưa liên thông CSDL ngành. Sổ đã khóa từ trước vẫn mở được (BGH). */}
            {gb.status === 'locked' && isAdmin && (
              <button type="button" disabled={saving} onClick={() => commit('published', 'unlock', false)} className={`${btn} border border-amber-500 text-amber-800 bg-white`}>
                <LockOpen className="w-3.5 h-3.5" /> Mở khóa (BGH)
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-slate-500">Đang tải sổ điểm…</p>}
      {gb && !loading && extraTx.length > 0 && (
        <p data-testid="gb-extra-tx" className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg p-2">
          Môn này chỉ có {spec.txSlots} cột ĐĐGtx, nhưng {extraTx.length} HS còn điểm ở cột {spec.txSlots + 1}–{slots} (nhập theo mẫu 5 cột cũ).
          Điểm đó <b>vẫn được giữ</b> nhưng <b>không tính</b> vào ĐTBmhk. Nếu đó là điểm thật, chuyển sang cột 1–{spec.txSlots}; nếu nhập thừa, xóa ô rồi Ghi.
        </p>
      )}

      {gb && !loading && (
        <div className="overflow-auto border border-slate-200 rounded-xl bg-white max-h-[70vh]">
          <table className="min-w-full text-xs border-collapse" data-testid="gb-grid">
            <thead className="sticky top-0 z-10 bg-[#8B1A4A] text-white">
              <tr>
                <th rowSpan={2} className="px-2 py-2 border border-white/20 w-10">STT</th>
                <th rowSpan={2} className="px-2 py-2 border border-white/20 w-28">Mã định danh Bộ GD&ĐT</th>
                <th rowSpan={2} className="px-2 py-2 border border-white/20 text-left min-w-44">Họ tên</th>
                {showDob && <th rowSpan={2} className="px-2 py-2 border border-white/20">Ngày sinh</th>}
                {showDob && <th rowSpan={2} className="px-2 py-2 border border-white/20">GT</th>}
                <th colSpan={slots} className="px-2 py-1 border border-white/20">ĐĐGtx</th>
                <th rowSpan={2} className="px-2 py-2 border border-white/20 w-16">ĐĐGgk</th>
                <th rowSpan={2} className="px-2 py-2 border border-white/20 w-16">ĐĐGck</th>
                <th rowSpan={2} className="px-2 py-2 border border-white/20 w-16 bg-[#6B1338]">{`ĐTBmhk${term}`}</th>
                <th rowSpan={2} className="px-2 py-2 border border-white/20 min-w-64">Nhận xét sự tiến bộ, ưu điểm nổi bật, hạn chế chủ yếu (HK{term})</th>
              </tr>
              <tr>
                {Array.from({ length: slots }, (_, i) => (
                  <th key={i} className={`px-2 py-1 border border-white/20 w-14 ${i >= spec.txSlots ? 'bg-amber-600' : ''}`} title={i >= spec.txSlots ? 'Cột thừa — không tính ĐTBmhk' : undefined}>
                    {i + 1}{i >= spec.txSlots ? ' (thừa)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={gridRef}>
              {students.map((s, r) => {
                const row = parsed.rows[s.mhs];
                const res = termResult(withinSlots(row, spec.txSlots), mode, spec.txMin);
                const avg = 'avg' in res ? res.avg : null;
                return (
                  <tr key={s.mhs} className="odd:bg-white even:bg-slate-50 hover:bg-ums-50/60">
                    <td className="px-2 py-1 border border-slate-200 text-center text-slate-500">{r + 1}</td>
                    <td className="px-2 py-1 border border-slate-200 text-slate-600 font-mono">{s.moetId || ''}</td>
                    <td className="px-2 py-1 border border-slate-200 font-semibold text-slate-800 whitespace-nowrap">{s.name}</td>
                    {showDob && <td className="px-2 py-1 border border-slate-200 text-slate-600">{s.dob ? s.dob.split('-').reverse().join('/') : ''}</td>}
                    {showDob && <td className="px-2 py-1 border border-slate-200 text-slate-600">{s.gender}</td>}
                    {cols.map((f, c) => {
                      const bad = parsed.invalid.has(`${s.mhs}:${f}`);
                      const changed = changes.some((ch) => ch.mhs === s.mhs && ch.field === f);
                      const cell = (
                        <input
                          data-cell={`${r}-${c}`}
                          aria-label={`${fieldLabel(f)} – ${s.name}`}
                          value={raw[s.mhs]?.[f] ?? ''}
                          readOnly={readOnly}
                          maxLength={f === 'comment' ? 300 : 4}
                          onChange={(e) => setCell(s.mhs, f, e.target.value)}
                          onKeyDown={(e) => onKey(e, r, c)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => normalizeCell(s.mhs, f)}
                          className={`w-full px-1.5 py-1 outline-none focus:ring-2 focus:ring-[#8B1A4A] rounded ${f === 'comment' ? 'text-left' : 'text-center'} ${bad ? 'bg-red-50 text-red-700 ring-1 ring-red-400' : changed ? 'bg-amber-50' : 'bg-transparent'}`}
                        />
                      );
                      const td = (
                        <td key={f} className="p-0.5 border border-slate-200">{cell}</td>
                      );
                      if (f !== 'comment') return td;
                      return (
                        <React.Fragment key={f}>
                          <td className={`px-2 py-1 border border-slate-200 text-center font-bold bg-slate-100 ${avg != null && avg < 5 ? 'text-red-700' : 'text-slate-800'}`} title={res.status === 'missing' ? `Thiếu: ${res.missing.join(', ')}` : undefined}>
                            {termResultText(res)}
                          </td>
                          {td}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {gb && (
        <p className="text-[11px] text-slate-500">
          ĐTBmhk = (ΣĐĐGtx + 2×ĐĐGgk + 3×ĐĐGck) / (số ĐĐGtx + 5), làm tròn 1 chữ số (Thông tư 22/2021). Enter = ô kế tiếp, Shift+Enter = ô trước, ↑↓ = đổi dòng.
          Điểm trên UMS+ là bản của trường — PH/HS chỉ thấy sau khi bấm "Công bố".
        </p>
      )}

      <Modal isOpen={!!importRes} onClose={() => { setImportRes(null); setImportSheet(null); }} title="Nhập điểm từ Excel" maxWidth="lg">
        {importRes && (
          <div className="space-y-3 text-sm">
            {importRes.error ? (
              <p className="text-red-700">{importRes.error}</p>
            ) : (
              <>
                <p>Khớp <b>{importRes.matched}</b> HS. Ô trống trong file giữ nguyên điểm đang có.</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {(['gk', 'ck'] as const).map((f) => (
                    <label key={f} className="flex items-center gap-1.5 font-semibold text-slate-700">
                      Lấy {f === 'gk' ? 'ĐĐGgk' : 'ĐĐGck'} từ cột:
                      <select value={importRes.used[f]} onChange={(e) => repick(f, Number(e.target.value))} className="border border-slate-300 rounded px-1.5 py-1 font-normal" data-testid={`gb-import-col-${f}`}>
                        <option value={-1}>(không nhập)</option>
                        {importRes.columns.filter((c) => c.kind === f || c.kind === 'other').map((c) => (
                          <option key={c.index} value={c.index}>{c.label} ({c.filled} ô có dữ liệu)</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {importRes.unmatched.length > 0 && (
                  <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <b>{importRes.unmatched.length} dòng không khớp HS trong lớp:</b>{' '}
                    {importRes.unmatched.slice(0, 15).map((u) => `dòng ${u.line} (${u.name})`).join(', ')}
                  </div>
                )}
                {importRes.invalid.length > 0 && (
                  <div className="text-xs bg-red-50 border border-red-200 rounded-lg p-2">
                    <b>{importRes.invalid.length} ô không hợp lệ (bỏ qua):</b>{' '}
                    {importRes.invalid.slice(0, 15).map((u) => `dòng ${u.line} ${fieldLabel(u.field)} "${u.value}"`).join(', ')}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  {isAdmin && Object.keys(importRes.moetIds).length > 0 && (
                    <button type="button" onClick={saveMoet} className={`${btn} border border-slate-300`}>Lưu mã định danh vào hồ sơ HS</button>
                  )}
                  <button type="button" onClick={applyImport} className={`${btn} bg-[#8B1A4A] text-white`} data-testid="gb-import-apply">Đưa vào lưới</button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={history != null} onClose={() => setHistory(null)} title="Lịch sử sửa điểm" maxWidth="xl">
        {history && history.length === 0 && <p className="text-sm text-slate-500">Chưa có lần ghi nào.</p>}
        <ul className="space-y-2 max-h-[60vh] overflow-auto text-xs">
          {history?.map((h) => (
            <li key={h.id} className="border border-slate-200 rounded-lg p-2">
              <p className="font-semibold text-slate-800">
                {new Date(h.at).toLocaleString('vi-VN')} · {h.byName} ·{' '}
                {{ edit: 'Sửa điểm', publish: 'Công bố', lock: 'Khóa', unlock: 'Mở khóa', import: 'Nhập Excel' }[h.action]} (bản {h.version})
              </p>
              {h.reason && <p className="text-amber-800">Lý do: {h.reason}</p>}
              {h.changes.length > 0 && (
                <p className="text-slate-600">
                  {h.changes.slice(0, 30).map((c) => `${nameOf.get(c.mhs) || c.mhs} – ${fieldLabel(c.field)}: ${formatGrade(c.from as GradeValue) || '∅'} → ${formatGrade(c.to as GradeValue) || '∅'}`).join(' · ')}
                  {h.changes.length > 30 && ` … (+${h.changes.length - 30})`}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};
