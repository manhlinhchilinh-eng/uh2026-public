/**
 * Cập nhật TKB toàn trường (mục trong tab Thời khóa biểu, chỉ BGH): tải lên đúng file Excel TKB trường gửi (sheet TKB_Lop),
 * xem trước tiết nào thay đổi ở lớp nào, rồi cập nhật 1 lần cho tất cả các lớp + gửi thông báo.
 */

import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { ScheduleChangeGrid } from './ScheduleChangeGrid';
import { effectiveDateFromFileName, parseSchoolTimetable, type ParsedTimetable } from '../../utils/timetableGrid';
import {
  applyTimetableUpdate,
  latestUpdate,
  planTimetableUpdate,
  undoTimetableUpdate,
  type TimetablePlan,
} from '../../services/timetableUpdateService';
import { fetchSchedulesStrict } from '../../services/scheduleService';

/** Đọc sheet TKB theo lớp (TKB_Lop); không có thì thử sheet đầu tiên. */
export function readTimetableWorkbook(buffer: ArrayBuffer): ParsedTimetable {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const name = wb.SheetNames.find((n) => n.trim().toLowerCase() === 'tkb_lop') ?? wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null });
  return parseSchoolTimetable(rows);
}

const fmt = (ms: number) => new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export const TimetableUpdatePanel: React.FC<{ onUpdated?: () => void }> = ({ onUpdated }) => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedTimetable | null>(null);
  const [plan, setPlan] = useState<TimetablePlan | null>(null);
  const [effective, setEffective] = useState('');
  const [notify, setNotify] = useState(true);
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ReturnType<typeof latestUpdate>>(null);
  const [dragOver, setDragOver] = useState(false);

  const refreshLast = () => fetchSchedulesStrict().then((s) => setLast(latestUpdate(s))).catch(() => setLast(null));
  useEffect(() => {
    refreshLast();
  }, []);

  const onFile = async (file: File) => {
    if (!/\.(xlsx?|xlsm)$/i.test(file.name)) {
      showToast('Chỉ nhận file Excel (.xls, .xlsx).', 'error');
      return;
    }
    setBusy(true);
    setPlan(null);
    try {
      const p = readTimetableWorkbook(await file.arrayBuffer());
      if (Object.keys(p.classes).length === 0) throw new Error('Không tìm thấy lớp nào. File cần có sheet "TKB_Lop" theo mẫu TKB của trường.');
      setFileName(file.name);
      setParsed(p);
      setEffective(effectiveDateFromFileName(file.name) || '');
      const pl = await planTimetableUpdate(p);
      setPlan(pl);
      setOpenClass(pl.classes.find((c) => c.changes.length > 0)?.classId ?? null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Không đọc được file.', 'error');
      setParsed(null);
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    if (!plan) return null;
    const changed = plan.classes.filter((c) => c.changes.length > 0);
    return { changed: changed.length, slots: changed.reduce((n, c) => n + c.changes.length, 0), noAccount: plan.classes.reduce((n, c) => n + c.slots.filter((s) => s.teacherName && !s.teacherUsername).length, 0) };
  }, [plan]);

  const apply = async () => {
    if (!plan || !profile || !stats) return;
    const msg = `Cập nhật TKB cho ${stats.changed} lớp (${stats.slots} tiết thay đổi)${notify ? ` và gửi ${stats.changed + 1} thông báo` : ''}?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const r = await applyTimetableUpdate(plan, profile, { fileName, effective: effective.trim() || null, notifyClasses: notify });
      showToast(`Đã cập nhật ${r.classesUpdated} lớp, gửi ${r.notices} thông báo.`, 'success');
      setPlan(null);
      setParsed(null);
      refreshLast();
      onUpdated?.();
    } catch (e) {
      console.error('[TKB] apply', e);
      showToast('Cập nhật thất bại — chưa có gì thay đổi.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!last || !profile) return;
    if (!window.confirm(`Hoàn tác lần cập nhật "${last.sourceFile}" (${last.classes} lớp) về TKB trước đó? Thông báo đã gửi sẽ không bị thu hồi.`)) return;
    setBusy(true);
    try {
      const n = await undoTimetableUpdate(last.updateId, profile);
      showToast(`Đã khôi phục TKB cũ cho ${n} lớp.`, 'success');
      refreshLast();
      onUpdated?.();
    } catch (e) {
      console.error('[TKB] undo', e);
      showToast('Hoàn tác thất bại.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const open = plan?.classes.find((c) => c.classId === openClass) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Tải lên đúng file Excel TKB trường gửi (sheet TKB_Lop) — cập nhật một lần cho tất cả các lớp, tự gửi thông báo và lưu vào Lịch sử thay đổi.</p>
      {last && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Lần cập nhật gần nhất: <b>{last.sourceFile || '—'}</b> lúc {fmt(last.at)} ({last.classes} lớp).
          </span>
          <button type="button" onClick={undo} disabled={busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-semibold disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác lần này
          </button>
        </div>
      )}

      <label
        data-testid="tkb-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) onFile(f);
        }}
        className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-[#8B1A4A] bg-pink-50' : 'bg-white border-slate-300 hover:border-[#8B1A4A]'
        }`}
      >
        <Upload className="w-6 h-6 mx-auto text-slate-400" />
        <span className="block mt-2 text-sm font-semibold text-slate-700">{dragOver ? 'Thả file vào đây' : fileName ? `Đã chọn: ${fileName} — kéo thả hoặc bấm để chọn file khác` : 'Kéo thả file TKB vào đây hoặc bấm để chọn (.xls, .xlsx)'}</span>
        <span className="block text-xs text-slate-500">Ví dụ: “TKB 12_10 VER2.xls”. File chỉ được đọc trên máy này để xem trước.</span>
        <input
          type="file"
          accept=".xls,.xlsx"
          className="sr-only"
          aria-label="Chọn file TKB"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </label>

      {busy && !plan && <p className="text-sm text-slate-500">Đang đọc file và so sánh với TKB hiện tại…</p>}

      {parsed && plan && stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Lớp trong file', plan.classes.length],
              ['Lớp có thay đổi', stats.changed],
              ['Tiết thay đổi', stats.slots],
              ['Năm học / HK', `${plan.academicYear} · HK${plan.semester}`],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-[11px] text-slate-500">{k}</div>
                <div className="text-lg font-bold text-slate-900">{v}</div>
              </div>
            ))}
          </div>

          {parsed.warnings.length > 0 && (
            <details className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              <summary className="font-semibold cursor-pointer">{parsed.warnings.length} cảnh báo khi đọc file</summary>
              <ul className="mt-2 list-disc pl-5 space-y-0.5">{parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </details>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Chọn lớp">
              {plan.classes.map((c) => (
                <button
                  key={c.classId}
                  type="button"
                  role="tab"
                  aria-selected={openClass === c.classId}
                  onClick={() => setOpenClass(c.classId)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    openClass === c.classId
                      ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]'
                      : c.changes.length
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {c.classId}
                  {c.changes.length > 0 && <span className="ml-1 opacity-80">({c.changes.length})</span>}
                </button>
              ))}
            </div>
            {open && (
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">
                  Lớp {open.classId}: {open.changes.length ? `${open.changes.length} tiết thay đổi` : 'không thay đổi'}
                  {!open.current && ' (chưa có TKB cũ)'}
                </h3>
                <ScheduleChangeGrid changes={open.changes} slots={open.slots} />
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                Áp dụng từ ngày
                <input value={effective} onChange={(e) => setEffective(e.target.value)} placeholder="vd. 12/10" className="w-24 px-2 py-1 border border-slate-300 rounded-lg text-sm" />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                Gửi thông báo cho PH/HS từng lớp có thay đổi
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Luôn gửi 1 bản tổng hợp cho giáo viên & BGH. TKB cũ được lưu lại để hoàn tác.
              {stats.noAccount > 0 && ` ${stats.noAccount} tiết có tên GV chưa gắn tài khoản (khai "Tên trên TKB" trong Hồ sơ phép để gắn).`}
            </p>
            <button
              type="button"
              onClick={apply}
              disabled={busy || stats.changed === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#8B1A4A] text-white hover:bg-[#6B1338] disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {stats.changed === 0 ? 'TKB không có gì thay đổi' : `Cập nhật TKB ${stats.changed} lớp`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
