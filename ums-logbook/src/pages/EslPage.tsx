/**
 * Trang ESL (BGH): chọn phương án ghi tiết ESL để đề xuất & áp dụng, xem nhanh số tiết ESL theo lớp (TC2).
 * ESL mới ở trường → mặc định TẮT; BGH xem thử 2 phương án ngay trên trang rồi mới bật.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Power, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';
import { Bi } from '../components/common/Bi';
import { BrandMark } from '../components/common/BrandMark';
import { EslPeriodFields } from '../components/esl/EslPeriodFields';
import { fetchEslConfig, fetchEslPeriods, saveEslConfig } from '../services/eslService';
import { logAuditEvent } from '../services/auditService';
import { currentAcademic } from '../utils/academicCalendar';
import {
  DEFAULT_ESL_CONFIG,
  ESL_CLASS_THRESHOLD,
  ESL_LEVEL2_PERIODS,
  ESL_MODE_CHOICE,
  ESL_OPTIONS,
  summarizeEslByClass,
  type EslConfig,
  type EslMode,
  type EslOption,
  type EslPeriodRecord,
  type EslTag,
} from '../utils/eslPeriods';

const OPTION_IDS: EslOption[] = ['quick', 'clil'];

export const EslPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [config, setConfig] = useState<EslConfig>(DEFAULT_ESL_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Xem thử: mỗi phương án có 1 form mẫu riêng (không lưu)
  const [demo, setDemo] = useState<Record<EslMode, EslTag | null>>({
    choice: { level: 'elements', option: 'quick' },
    quick: { level: 'partial', option: 'quick' },
    clil: { level: 'partial', option: 'clil', objective: 'Students can describe the water cycle using sequence words', strategies: ['terms', 'frames'] },
  });
  const [records, setRecords] = useState<EslPeriodRecord[] | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const { academicYear } = currentAcademic();
  const yearStart = `${academicYear.split('-')[0]}-08-01`;
  const yearEnd = `${academicYear.split('-')[1]}-07-31`;

  useEffect(() => {
    fetchEslConfig(true).then((c) => {
      setConfig(c);
      setLoaded(true);
    });
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      setRecords(await fetchEslPeriods(yearStart, yearEnd));
    } catch (e) {
      console.error('[ESL] tải tiết ESL', e);
      showToast('Không tải được số liệu tiết ESL.', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const summary = useMemo(() => (records ? summarizeEslByClass(records) : []), [records]);
  const reached = summary.filter((s) => s.reached).length;

  const modeLabel = (m: EslMode) => (m === 'choice' ? ESL_MODE_CHOICE.vi : ESL_OPTIONS[m].vi);

  const save = async (next: Pick<EslConfig, 'enabled' | 'option'>) => {
    if (!profile) return;
    setBusy(true);
    try {
      const saved = await saveEslConfig(next, profile.username);
      setConfig(saved);
      await logAuditEvent({
        action: 'UPDATE',
        targetCollection: 'system_settings',
        targetId: 'esl',
        details: `ESL: ${saved.enabled ? 'BẬT' : 'TẮT'} — ${modeLabel(saved.option)}`,
      }).catch(() => {});
      showToast(saved.enabled ? `Đã bật ghi tiết ESL (${modeLabel(saved.option)}).` : 'Đã tắt ghi tiết ESL.', 'success');
    } catch (e) {
      console.error('[ESL] lưu cấu hình', e);
      showToast('Lưu thất bại.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ums-900 flex items-center gap-2">
            <BrandMark app="esl" size={32} className="shrink-0" />
            <Bi vi="Tiết dạy bằng tiếng Anh (ESL)" en="ESL lessons" />
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Tiêu chuẩn 2 (Dạy & học) của chuẩn trường ESL: lớp ESL = có ít nhất 1 môn ngoài tiếng Anh dạy bằng tiếng Anh ≥ {ESL_CLASS_THRESHOLD} tiết/năm;
            Mức 2 cần ≥ 50% số lớp và {ESL_LEVEL2_PERIODS} tiết. GV đánh dấu ngay khi ghi Sổ đầu bài → số liệu tự cộng, không phải báo cáo tay.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
            config.enabled ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}
          data-testid="esl-status"
        >
          <Power className="w-3.5 h-3.5" />
          {!loaded ? 'Đang tải…' : config.enabled ? `Đang bật — ${modeLabel(config.option)}` : 'Đang tắt (chờ BGH duyệt)'}
        </div>
      </div>

      {/* Mặc định: GV tự chọn báo cáo nhanh/chi tiết từng tiết */}
      <section
        className={`rounded-2xl border bg-white p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 ${
          config.enabled && config.option === 'choice' ? 'border-emerald-400 shadow-md ring-2 ring-emerald-100' : 'border-slate-200'
        }`}
        data-testid="esl-option-choice"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              <Bi vi={ESL_MODE_CHOICE.vi} en={ESL_MODE_CHOICE.en} />
            </h2>
            {config.enabled && config.option === 'choice' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" /> Đang áp dụng
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">{ESL_MODE_CHOICE.summary}</p>
          <button
            type="button"
            disabled={busy || (config.enabled && config.option === 'choice')}
            onClick={() => save({ enabled: true, option: 'choice' })}
            className="w-full py-2 rounded-lg text-xs font-bold bg-[#8B1A4A] text-white hover:bg-[#741540] disabled:opacity-40"
            data-testid="esl-apply-choice"
          >
            {config.enabled && config.option === 'choice' ? 'Đang áp dụng' : 'Bật — GV tự chọn'}
          </button>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Xem thử (không lưu) · Live preview</p>
          <EslPeriodFields mode="choice" value={demo.choice} onChange={(v) => setDemo((d) => ({ ...d, choice: v }))} />
        </div>
      </section>

      {/* Hoặc BGH khóa 1 phương án (sau khi thống nhất) */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hoặc BGH khóa 1 phương án cho toàn trường</p>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {OPTION_IDS.map((opt) => {
          const o = ESL_OPTIONS[opt];
          const active = config.enabled && config.option === opt;
          return (
            <div
              key={opt}
              className={`rounded-2xl border bg-white p-4 space-y-3 transition-shadow ${active ? 'border-emerald-400 shadow-md ring-2 ring-emerald-100' : 'border-slate-200'}`}
              data-testid={`esl-option-${opt}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  <Bi vi={o.vi} en={o.en} />
                </h2>
                {active && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" /> Đang áp dụng
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">{o.summary}</p>
              <ul className="text-[11px] text-slate-500 list-disc pl-4">
                {o.fields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Xem thử (không lưu) · Live preview</p>
                <EslPeriodFields mode={opt} value={demo[opt]} onChange={(v) => setDemo((d) => ({ ...d, [opt]: v }))} />
              </div>
              <button
                type="button"
                disabled={busy || active}
                onClick={() => save({ enabled: true, option: opt })}
                className="w-full py-2 rounded-lg text-xs font-bold bg-[#8B1A4A] text-white hover:bg-[#741540] disabled:opacity-40"
                data-testid={`esl-apply-${opt}`}
              >
                {active ? 'Đang áp dụng phương án này' : 'Khóa phương án này'}
              </button>
            </div>
          );
        })}
      </section>
      {config.enabled && (
        <button
          type="button"
          disabled={busy}
          onClick={() => save({ enabled: false, option: config.option })}
          className="text-xs font-semibold text-slate-500 underline hover:text-slate-800"
          data-testid="esl-disable"
        >
          Tắt ghi tiết ESL (dữ liệu đã ghi vẫn giữ)
        </button>
      )}

      {/* Số liệu TC2 — chỉ tải khi bấm (đọc tối đa 2000 bản ghi gọn) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            <Bi vi={`Tiết ESL theo lớp — năm học ${academicYear}`} en="ESL periods by class" />
          </h2>
          <button
            type="button"
            onClick={loadStats}
            disabled={loadingStats}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            data-testid="esl-load-stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} /> {records ? 'Tải lại' : 'Xem số liệu'}
          </button>
        </div>
        {records && (
          <>
            <p className="text-xs text-slate-600" data-testid="esl-stats-line">
              {records.length} tiết ESL đã ghi · {summary.length} lớp có tiết ESL · <b>{reached}</b> lớp đạt ≥ {ESL_CLASS_THRESHOLD} tiết (môn ngoài tiếng Anh)
            </p>
            {summary.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có tiết ESL nào được ghi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-1.5 pr-3">Lớp</th>
                      <th className="py-1.5 pr-3">Tiết ESL</th>
                      <th className="py-1.5 pr-3 w-1/3">Tiến độ tới {ESL_CLASS_THRESHOLD} tiết</th>
                      <th className="py-1.5 pr-3">Môn</th>
                      <th className="py-1.5">GV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s) => (
                      <tr key={s.classId} className="border-b border-slate-100">
                        <td className="py-1.5 pr-3 font-bold">{s.classId}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{s.periods}</td>
                        <td className="py-1.5 pr-3">
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden" title={`${s.periods}/${ESL_CLASS_THRESHOLD}`}>
                            <div
                              className={`h-full rounded-full ${s.reached ? 'bg-emerald-500' : 'bg-sky-500'}`}
                              style={{ width: `${Math.min(100, (s.periods / ESL_CLASS_THRESHOLD) * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-1.5 pr-3 text-slate-600">{s.subjects.join(', ')}</td>
                        <td className="py-1.5 tabular-nums">{s.teachers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
