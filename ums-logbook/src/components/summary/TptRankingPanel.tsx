/**
 * Xếp hạng thi đua theo quy chế TPT (05/11): (SĐB×2 + Cờ đỏ)/3, SĐB = trung bình ngày thang 80.
 * Dữ liệu SĐB thật (dùng chung cache với Dashboard). Cờ đỏ: sổ theo ngày nhập từ file "Sổ Sao Đỏ"
 * (/red_flag_daily, 100đ/tuần trừ theo lỗi) hoặc điểm tuần nhập tay (/red_flag_weekly). Không listener.
 * Kỳ: Ngày (hạng từng hôm) / Tuần / Tháng.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, Flag, Info, Trophy } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { Bi } from '../common/Bi';
import { periodOver } from '../../hooks/useWeeklySummary';
import { fetchRedFlagDaily, fetchRedFlags, fetchTptRankingInput, saveRedFlagDaily, saveRedFlags } from '../../services/tptRankingService';
import { parseSaoDoSheets, type SaoDoParseResult } from '../../utils/saoDoImport';
import { monthOf, weekOf } from '../../utils/logbookRanking';
import {
  DEFAULT10_RULES,
  RED_FLAG_WEEK_BASE,
  SDB_DAY_MAX,
  SDB_START_DATE,
  computeClassSdb,
  dailyRanks,
  forgottenByTeacher,
  parseRedFlagPaste,
  rankTpt,
  redFlagDeductions,
  redFlagForDay,
  redFlagForWeeks,
  weekStartsBetween,
  type DayRank,
  type RankedRow,
  type RedFlagDaily,
  type RedFlagWeekly,
  type SdbInput,
} from '../../utils/tptRanking';

// Ngày theo giờ máy (VN) — toISOString (UTC) lệch 1 ngày trước 7h sáng
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const viDate = (iso: string) => iso.split('-').reverse().join('/');
const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2).replace(/\.?0+$/, ''));
const DOW_VI: Record<number, string> = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6' };
const dowVi = (iso: string) => DOW_VI[((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7) + 2] || '';

export const TptRankingPanel: React.FC = () => {
  const { profile, activeRole } = useAuth();
  const { showToast } = useToast();
  const canEnterRedFlag = activeRole === 'admin' || activeRole === 'tpt';
  const [kind, setKind] = useState<'day' | 'week' | 'month'>('week');
  const [dayDate, setDayDate] = useState(today());
  const [weekDate, setWeekDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [grade, setGrade] = useState<number | 'all'>('all');
  const range = kind === 'day' ? { start: dayDate, end: dayDate } : kind === 'week' ? weekOf(weekDate) : monthOf(month);
  const weeks = useMemo(() => weekStartsBetween(range.start, range.end), [range.start, range.end]);

  const [input, setInput] = useState<Omit<SdbInput, 'isPeriodOver'> | null>(null);
  const [flags, setFlags] = useState<RedFlagWeekly[]>([]);
  const [daily, setDaily] = useState<RedFlagDaily[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  const loadFlags = useCallback(
    () =>
      Promise.all([
        fetchRedFlags(weeks).then(setFlags).catch(() => setFlags([])),
        fetchRedFlagDaily(weeks).then(setDaily).catch(() => setDaily([])),
      ]),
    [weeks]
  );

  useEffect(() => {
    let alive = true;
    setInput(null);
    setError(null);
    fetchTptRankingInput(range.start, range.end)
      .then((i) => alive && setInput(i))
      .catch((e) => {
        console.error('[Xếp hạng thi đua]', e);
        if (alive) setError('Không tải được dữ liệu sổ đầu bài.');
      });
    loadFlags();
    return () => {
      alive = false;
    };
  }, [range.start, range.end, loadFlags]);

  const sdbRows = useMemo(
    () => (input ? input.classIds.map((c) => computeClassSdb(c, { ...input, isPeriodOver: periodOver })) : null),
    [input]
  );
  const redFlag80 = useMemo(
    () => (kind === 'day' ? redFlagForDay(daily, dayDate) : redFlagForWeeks(flags, daily, weeks)),
    [kind, daily, dayDate, flags, weeks]
  );
  const ranked = useMemo(() => (sdbRows ? rankTpt(sdbRows, redFlag80) : null), [sdbRows, redFlag80]);
  // Điểm trừ cờ đỏ trong kỳ (chỉ các ngày thuộc kỳ — tháng có thể lấn sang tuần đầu/cuối)
  const deductions = useMemo(
    () => redFlagDeductions(daily.filter((d) => d.date >= range.start && d.date <= range.end)),
    [daily, range.start, range.end]
  );
  const ranksByDay = useMemo(() => (sdbRows ? dailyRanks(sdbRows, daily) : {}), [sdbRows, daily]);
  const shown = useMemo(() => (ranked || []).filter((r) => grade === 'all' || r.grade === grade), [ranked, grade]);
  const anyProvisional = shown.some((r) => r.provisional && r.score != null);
  const forgotten = useMemo(() => forgottenByTeacher(shown), [shown]);
  const label = kind === 'day' ? `${dowVi(dayDate)} ${viDate(dayDate)}` : kind === 'week' ? `Tuần ${viDate(range.start)} – ${viDate(range.end)}` : `Tháng ${month.split('-').reverse().join('/')}`;

  const exportExcel = () => {
    if (!ranked) return;
    const ws = XLSX.utils.json_to_sheet(
      shown.map((r) => ({
        Hạng: r.rank ?? '',
        Lớp: r.classId,
        'SĐB (TB ngày /80)': r.sdb ?? '',
        'SĐB tổng': `${r.total}/${r.totalMax}`,
        'Cờ đỏ (/80)': r.redFlag ?? 'chờ TPT nhập',
        'Cờ đỏ điểm trừ': deductions[r.classId]?.d ?? '',
        'Cờ đỏ số lỗi': deductions[r.classId]?.n ?? '',
        'Thi đua (SĐB×2+Cờ đỏ)/3': r.score ?? '',
        'Tạm (chưa có cờ đỏ)': r.provisional ? 'x' : '',
        'Tiết GV quên ký': r.forgotten.length,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Xếp hạng');
    XLSX.writeFile(wb, `xep-hang-thi-dua_${range.start}_${range.end}.xlsx`);
  };

  return (
    <div className="space-y-4" data-testid="tpt-ranking">
      {/* Tiêu đề + quy chế gọn */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 shrink-0">
            <Trophy className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              <Bi vi="Xếp hạng thi đua" en="Class Ranking" layout="inline" />
            </h2>
            <p className="text-xs text-slate-500">Thi đua = (Sổ đầu bài × 2 + Sổ cờ đỏ) / 3 • thang 80 điểm/ngày</p>
          </div>
        </div>
        <button type="button" onClick={exportExcel} disabled={!ranked} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <Download className="w-4 h-4" aria-hidden="true" /> Xuất Excel
        </button>
      </header>

      <details className="bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-3 text-xs text-slate-700">
        <summary className="cursor-pointer font-semibold text-amber-900 inline-flex items-center gap-1.5">
          <Info className="w-4 h-4" aria-hidden="true" /> Quy chế tính điểm (TPT)
        </summary>
        <ul className="mt-2 space-y-1 list-disc ml-5">
          <li>Sổ đầu bài tính theo ngày, tối đa <b>80 điểm/ngày</b> (8 tiết × 10). Chiều thứ 6 không chấm → tối đa <b>360 điểm/tuần</b>.</li>
          <li>Điểm ngày = <b>tổng điểm thực</b> các tiết đã học (tối đa 10đ/tiết). Điểm tuần/tháng = <b>trung bình theo ngày</b> (thứ 6 tính nửa ngày), tối đa 80. Ngày nghỉ theo lịch nghỉ không tính; hôm nay chỉ tính các tiết đã học.</li>
          <li>Tính từ ngày <b>{viDate(SDB_START_DATE)}</b> (bắt đầu ký sổ đầu bài thật).</li>
          <li>Tính mặc định 10đ: {DEFAULT10_RULES.map((r) => `${r.subject}${r.prefix ? ' …' : ''}${r.grade ? ` (khối ${r.grade})` : ''}`).join(', ')}.</li>
          <li>Tiết đã học mà GV chưa ký: lớp được <b>0 điểm</b> tiết đó (không trừ thêm −2đ); ghi nhận là trách nhiệm của GV bộ môn (bảng cuối trang).</li>
          <li>Sổ cờ đỏ: mỗi lớp <b>{RED_FLAG_WEEK_BASE} điểm/tuần</b>, trừ theo lỗi từng ngày (file Sổ Sao Đỏ của TPT). Điểm ngày = {RED_FLAG_WEEK_BASE} − điểm trừ trong ngày; điểm tuần = {RED_FLAG_WEEK_BASE} − tổng điểm trừ cả tuần; điểm tháng = trung bình các tuần. Quy về thang 80 khi tính thi đua.</li>
          <li>Xếp hạng <b>ngày</b> = (SĐB ngày × 2 + Cờ đỏ ngày) / 3 (SĐB ngày quy về thang 80 theo các tiết đã học). Chưa có điểm cờ đỏ → xếp hạng <b>tạm</b> theo sổ đầu bài.</li>
        </ul>
      </details>

      {/* Bộ lọc */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center gap-2 text-xs">
        <div role="tablist" aria-label="Kỳ xếp hạng" className="flex gap-1">
          {(['day', 'week', 'month'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
              className={`h-9 px-3 rounded-lg font-semibold ${kind === k ? 'bg-[#8B1A4A] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {k === 'day' ? 'Ngày' : k === 'week' ? 'Tuần' : 'Tháng'}
            </button>
          ))}
        </div>
        {kind === 'day' ? (
          <input type="date" aria-label="Chọn ngày" value={dayDate} onChange={(e) => e.target.value && setDayDate(e.target.value)} className="h-9 px-2 border border-slate-300 rounded-lg" />
        ) : kind === 'week' ? (
          <input type="date" aria-label="Chọn ngày trong tuần" value={weekDate} onChange={(e) => e.target.value && setWeekDate(e.target.value)} className="h-9 px-2 border border-slate-300 rounded-lg" />
        ) : (
          <input type="month" aria-label="Chọn tháng" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 px-2 border border-slate-300 rounded-lg" />
        )}
        <select aria-label="Lọc khối" value={grade} onChange={(e) => setGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="h-9 px-2 border border-slate-300 rounded-lg bg-white">
          <option value="all">Tất cả khối</option>
          {[6, 7, 8, 9].map((g) => <option key={g} value={g}>Khối {g}</option>)}
        </select>
        <span className="text-slate-500 sm:ml-auto">{label}</span>
        {canEnterRedFlag && (
          <button type="button" onClick={() => setImporting((v) => !v)} data-testid="sao-do-toggle"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-rose-200 text-rose-700 font-semibold hover:bg-rose-50">
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" /> {importing ? 'Đóng nhập file' : 'Nhập file Sổ Sao Đỏ'}
          </button>
        )}
        {canEnterRedFlag && kind === 'week' && (
          <button type="button" onClick={() => setEntering((v) => !v)} data-testid="red-flag-toggle"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50">
            <Flag className="w-4 h-4" aria-hidden="true" /> {entering ? 'Đóng nhập tay' : 'Nhập điểm tuần (tay)'}
          </button>
        )}
      </div>

      {anyProvisional && (
        <p data-testid="provisional-note" className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Chưa có điểm Sổ cờ đỏ (chờ TPT nhập) cho một số lớp → các lớp đó đang <b>xếp hạng tạm theo Sổ đầu bài</b>.
        </p>
      )}

      {importing && canEnterRedFlag && profile && input && (
        <SaoDoImport
          classIds={input.classIds}
          onSave={async (byDate) => {
            const n = await saveRedFlagDaily(byDate, profile);
            showToast(`Đã lưu sổ cờ đỏ ${n} ngày.`, 'success');
            await loadFlags();
          }}
        />
      )}

      {entering && canEnterRedFlag && profile && input && (
        <RedFlagEntry
          weekStart={weeks[0]}
          classIds={input.classIds.filter((c) => grade === 'all' || Number(c[0]) === grade)}
          existing={flags.filter((f) => f.weekStart === weeks[0])}
          onSave={async (rows, maxScore) => {
            await saveRedFlags(weeks[0], rows, maxScore, profile);
            showToast(`Đã lưu điểm cờ đỏ ${rows.length} lớp.`, 'success');
            await loadFlags();
          }}
        />
      )}

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
      {!error && !ranked && <p className="text-sm text-slate-500">Đang tính điểm từ sổ đầu bài…</p>}

      {ranked && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]" data-testid="tpt-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left w-14">Hạng</th>
                <th className="px-3 py-2 text-left">Lớp</th>
                <th className="px-3 py-2 text-right">Sổ đầu bài<span className="block normal-case font-normal">TB ngày /80</span></th>
                <th className="px-3 py-2 text-right">Cờ đỏ<span className="block normal-case font-normal">/80 • điểm trừ</span></th>
                <th className="px-3 py-2 text-right">Thi đua<span className="block normal-case font-normal">(SĐB×2+CĐ)/3</span></th>
                <th className="px-3 py-2 text-right">Tiết quên ký</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <ClassRow key={r.classId} r={r} ded={deductions[r.classId]} dayRanks={ranksByDay} open={open === r.classId} onToggle={() => setOpen((o) => (o === r.classId ? null : r.classId))} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ranked && (
        <details className="bg-white border border-slate-200 rounded-xl px-4 py-3" data-testid="forgotten-by-teacher">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Tiết GV bộ môn quên ký ({forgotten.reduce((a, t) => a + t.count, 0)}) — không trừ điểm lớp, ghi nhận để xét GV
          </summary>
          {forgotten.length === 0 ? (
            <p className="text-xs text-slate-500 mt-2">Không có tiết nào bị quên ký trong kỳ này.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 text-xs">
              {forgotten.map((t) => (
                <li key={t.teacherName} className="py-1.5">
                  <b className="text-slate-800">{t.teacherName}</b> — {t.count} tiết:{' '}
                  <span className="text-slate-500">{t.items.slice(0, 12).map((f) => `${f.classId} ${viDate(f.date).slice(0, 5)} T${f.periodIndex}`).join(', ')}{t.items.length > 12 ? '…' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </div>
  );
};

const ClassRow: React.FC<{
  r: RankedRow;
  ded?: { d: number; n: number };
  dayRanks: Record<string, Record<string, DayRank>>;
  open: boolean;
  onToggle: () => void;
}> = ({ r, ded, dayRanks, open, onToggle }) => (
  <>
    <tr className="hover:bg-slate-50/70 cursor-pointer" onClick={onToggle} data-testid={`tpt-row-${r.classId}`}>
      <td className="px-3 py-2 font-bold text-slate-700">{r.rank ?? '—'}</td>
      <td className="px-3 py-2">
        <button type="button" aria-expanded={open} aria-label={`Chi tiết theo ngày lớp ${r.classId}`} className="inline-flex items-center gap-1 font-semibold text-slate-900">
          {open ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
          {r.classId}
        </button>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className="font-semibold">{fmt(r.sdb)}</span>
        {r.totalMax > 0 && <span className="block text-[11px] text-slate-400">{fmt(r.total)}/{r.totalMax}</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {r.redFlag == null ? <span className="text-[11px] text-slate-400 italic">chờ TPT nhập</span> : fmt(r.redFlag)}
        {ded && ded.d > 0 && <span className="block text-[11px] text-rose-600" data-testid={`red-flag-ded-${r.classId}`}>−{fmt(ded.d)} ({ded.n} lỗi)</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className="font-bold text-[#8B1A4A]">{fmt(r.score)}</span>
        {r.provisional && r.score != null && <span className="block text-[10px] text-amber-700">tạm (SĐB)</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.forgotten.length || ''}</td>
    </tr>
    {open && (
      <tr className="bg-slate-50/60">
        <td colSpan={6} className="px-3 py-2">
          {r.days.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có ngày nào tính được điểm (chưa ký tiết nào / ngày nghỉ).</p>
          ) : (
            <table className="w-full text-xs" data-testid={`tpt-days-${r.classId}`}>
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left py-1">Ngày</th>
                  <th className="text-right py-1">Điểm</th>
                  <th className="text-right py-1">Đã ký</th>
                  <th className="text-right py-1">Mặc định 10đ</th>
                  <th className="text-right py-1">Quên ký</th>
                  <th className="text-right py-1">Cờ đỏ /80</th>
                  <th className="text-right py-1">Thi đua ngày</th>
                  <th className="text-right py-1">Hạng ngày</th>
                </tr>
              </thead>
              <tbody>
                {r.days.map((d) => (
                  <tr key={d.date}>
                    <td className="py-0.5">{dowVi(d.date)} {viDate(d.date)}</td>
                    <td className="py-0.5 text-right tabular-nums font-semibold">{fmt(d.score)}/{d.max}</td>
                    <td className="py-0.5 text-right tabular-nums">{d.signed}</td>
                    <td className="py-0.5 text-right tabular-nums">{d.default10}</td>
                    <td className="py-0.5 text-right tabular-nums text-rose-600">{d.unsigned || ''}</td>
                    <td className="py-0.5 text-right tabular-nums">{fmt(dayRanks[d.date]?.[r.classId]?.redFlag)}</td>
                    <td className="py-0.5 text-right tabular-nums">{fmt(dayRanks[d.date]?.[r.classId]?.score)}{dayRanks[d.date]?.[r.classId]?.provisional ? '*' : ''}</td>
                    <td className="py-0.5 text-right tabular-nums font-semibold text-[#8B1A4A]">{dayRanks[d.date]?.[r.classId]?.rank ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </td>
      </tr>
    )}
  </>
);

/** TPT/BGH nhập điểm cờ đỏ tuần: gõ từng lớp hoặc dán 2 cột (Lớp, Điểm) từ Excel. */
const RedFlagEntry: React.FC<{
  weekStart: string;
  classIds: string[];
  existing: RedFlagWeekly[];
  onSave: (rows: Array<{ classId: string; score: number }>, maxScore: number) => Promise<void>;
}> = ({ weekStart, classIds, existing, onSave }) => {
  const [maxScore, setMaxScore] = useState<number>(existing[0]?.maxScore || SDB_DAY_MAX);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(existing.map((f) => [f.classId, String(f.score)])));
  const [paste, setPaste] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const applyPaste = () => {
    const { rows, errors: errs } = parseRedFlagPaste(paste, classIds, maxScore);
    setValues((v) => ({ ...v, ...Object.fromEntries(rows.map((r) => [r.classId, String(r.score)])) }));
    setErrors(errs);
  };
  const save = async () => {
    const rows: Array<{ classId: string; score: number }> = [];
    const errs: string[] = [];
    for (const c of classIds) {
      const raw = (values[c] || '').trim();
      if (!raw) continue;
      const n = Number(raw.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > maxScore) errs.push(`${c}: "${raw}" không hợp lệ (0–${maxScore})`);
      else rows.push({ classId: c, score: n });
    }
    setErrors(errs);
    if (errs.length || rows.length === 0) return;
    setBusy(true);
    try {
      await onSave(rows, maxScore);
    } catch (e) {
      console.error('[Cờ đỏ] lưu', e);
      setErrors(['Không lưu được (kiểm tra quyền hoặc kết nối).']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="red-flag-entry" className="bg-white border border-rose-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <h3 className="font-bold text-rose-800 text-sm">Điểm Sổ cờ đỏ — tuần {viDate(weekStart)}</h3>
        <label className="inline-flex items-center gap-1.5 ml-auto">
          Thang điểm của TPT
          <input type="number" min={1} max={1000} value={maxScore} onChange={(e) => setMaxScore(Math.max(1, Number(e.target.value) || SDB_DAY_MAX))} aria-label="Thang điểm cờ đỏ" className="w-20 h-8 px-2 border border-slate-300 rounded-lg" />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">Điểm được quy về thang 80 khi tính thi đua. Để trống = chưa nhập (lớp đó xếp hạng tạm theo sổ đầu bài).</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2">
        {classIds.map((c) => (
          <label key={c} className="text-xs">
            <span className="block font-semibold text-slate-600">{c}</span>
            <input inputMode="decimal" aria-label={`Điểm cờ đỏ ${c}`} value={values[c] || ''} onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value }))} className="w-full h-9 px-2 border border-slate-300 rounded-lg tabular-nums" />
          </label>
        ))}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-600 font-semibold">Dán từ Excel (2 cột: Lớp, Điểm)</summary>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} aria-label="Dán bảng điểm cờ đỏ" placeholder={'6A1\t76\n6A2\t80'} className="mt-2 w-full p-2 border border-slate-300 rounded-lg font-mono" />
        <button type="button" onClick={applyPaste} className="mt-1 h-8 px-3 rounded-lg border border-slate-300 font-semibold">Điền vào bảng</button>
      </details>
      {errors.length > 0 && <ul className="text-xs text-red-700 list-disc ml-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} data-testid="red-flag-save" className="h-9 px-4 rounded-lg bg-[#8B1A4A] text-white text-sm font-semibold disabled:opacity-50">
          {busy ? 'Đang lưu…' : 'Lưu điểm cờ đỏ'}
        </button>
      </div>
    </section>
  );
};

/** TPT/BGH tải file "GUMS - Sổ Sao Đỏ" (Excel): đọc sheet từng lớp, gom điểm trừ theo ngày, xem trước rồi lưu. */
const SaoDoImport: React.FC<{
  classIds: string[];
  onSave: (byDate: SaoDoParseResult['byDate']) => Promise<void>;
}> = ({ classIds, onSave }) => {
  const [result, setResult] = useState<SaoDoParseResult | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    setResult(null);
    setFileErr(null);
    if (!f) return;
    try {
      // sheetRows: vài sheet có vùng dữ liệu tới 1.048.576 dòng — chỉ đọc 600 dòng đầu
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', sheetRows: 600 });
      const sheets = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null }) }));
      const r = parseSaoDoSheets(sheets, classIds, today());
      if (r.classIds.length === 0) {
        setFileErr('Không thấy sheet "LỚP 6A1"… trong file — kiểm tra đúng file Sổ Sao Đỏ chưa.');
        return;
      }
      setResult(r);
      setPicked(Object.fromEntries(Object.keys(r.byDate).map((d) => [d, true])));
    } catch (e) {
      console.error('[Sổ Sao Đỏ] đọc file', e);
      setFileErr('Không đọc được file Excel.');
    }
  };
  const dates = result ? Object.keys(result.byDate).sort() : [];
  const chosen = dates.filter((d) => picked[d]);
  const save = async () => {
    if (!result || chosen.length === 0) return;
    setBusy(true);
    try {
      await onSave(Object.fromEntries(chosen.map((d) => [d, result.byDate[d]])));
      setResult(null);
    } catch (e) {
      console.error('[Sổ Sao Đỏ] lưu', e);
      setFileErr('Không lưu được (kiểm tra quyền hoặc kết nối).');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="sao-do-import" className="bg-white border border-rose-200 rounded-xl p-4 space-y-3 text-xs">
      <h3 className="font-bold text-rose-800 text-sm">Nhập Sổ Sao Đỏ từ file Excel</h3>
      <p className="text-slate-500">
        Chọn file &quot;Sổ Sao Đỏ&quot; (mỗi lớp 1 sheet &quot;LỚP 6A1&quot;, cột NGÀY / THÁNG – LỖI VI PHẠM – ĐIỂM TRỪ). Hệ thống chỉ lưu điểm trừ và tên lỗi theo lớp,{' '}
        <b>không lưu tên học sinh</b>. Nhập lại file mới sẽ ghi đè các ngày đã chọn (file là bản gốc cộng dồn).
      </p>
      <input type="file" accept=".xlsx,.xls" aria-label="Chọn file Sổ Sao Đỏ" data-testid="sao-do-file" onChange={(e) => onFile(e.target.files?.[0])} className="block text-xs" />
      {fileErr && <p className="text-red-700">{fileErr}</p>}
      {result && (
        <>
          <p className="text-slate-600">Đọc được {result.classIds.length} lớp.</p>
          {dates.length === 0 ? (
            <p className="text-slate-500">File chưa có lỗi vi phạm nào (đến hôm nay).</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg" data-testid="sao-do-preview">
              {dates.map((d) => {
                const cls = Object.entries(result.byDate[d])
                  .filter(([, x]) => x.d > 0)
                  .sort(([a], [b]) => a.localeCompare(b, 'vi', { numeric: true }));
                const n = cls.reduce((a, [, x]) => a + x.n, 0);
                return (
                  <li key={d} className="px-3 py-2">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={!!picked[d]} onChange={(e) => setPicked((p) => ({ ...p, [d]: e.target.checked }))} className="mt-0.5" />
                      <span>
                        <b>
                          {dowVi(d)} {viDate(d)}
                        </b>{' '}
                        — {n} lượt vi phạm ở {cls.length} lớp
                        <span className="block text-slate-500">{cls.map(([c, x]) => `${c} −${fmt(x.d)}`).join(', ') || 'không lớp nào bị trừ'}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {result.future.length > 0 && (
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="sao-do-future">
              Bỏ qua {result.future.length} dòng ghi ngày sau hôm nay (có thể gõ nhầm ngày):{' '}
              {result.future.map((f) => `${f.classId} ${viDate(f.date)} ${f.violation} −${fmt(f.points)}`).join('; ')}. Sửa ngày trong file rồi nhập lại.
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="text-red-700 list-disc ml-5">
              {result.errors.slice(0, 20).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={save} disabled={busy || chosen.length === 0} data-testid="sao-do-save" className="h-9 px-4 rounded-lg bg-[#8B1A4A] text-white text-sm font-semibold disabled:opacity-50">
              {busy ? 'Đang lưu…' : `Lưu ${chosen.length} ngày`}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
