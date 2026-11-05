import React from 'react';
import { Globe2 } from 'lucide-react';
import { Bi } from '../common/Bi';
import { ESL_LEVELS, ESL_STRATEGIES, effectiveOption, type EslLevel, type EslMode, type EslOption, type EslTag } from '../../utils/eslPeriods';

interface Props {
  /** 'choice' = GV chọn báo cáo nhanh/chi tiết; 'quick'/'clil' = BGH đã khóa */
  mode: EslMode;
  value: EslTag | null;
  onChange: (next: EslTag | null) => void;
  disabled?: boolean;
}

/**
 * Khối "Tiết có dạy bằng tiếng Anh" trong form ghi tiết.
 * Phương án A (quick): công tắc + mức độ. Phương án B (clil): thêm mục tiêu ngôn ngữ, chiến lược, link minh chứng.
 * Chế độ 'choice': GV chọn "Báo cáo nhanh" (A) hoặc "Chi tiết" (B) cho từng tiết.
 */
export const EslPeriodFields: React.FC<Props> = ({ mode, value, onChange, disabled = false }) => {
  const on = !!value;
  const option: EslOption = effectiveOption(mode, value);
  const set = (patch: Partial<EslTag>) => onChange({ level: 'elements', ...(value || {}), option, ...patch });

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-3 transition-colors ${on ? 'border-sky-300 bg-sky-50/60' : 'border-slate-200 bg-white'}`}
      data-testid="esl-fields"
    >
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={on}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? { level: 'elements', option: mode === 'choice' ? 'quick' : mode } : null)}
          className="w-4 h-4 accent-sky-600"
          data-testid="esl-toggle"
        />
        <Globe2 className={`w-4 h-4 ${on ? 'text-sky-600' : 'text-slate-400'}`} />
        <span className="text-xs font-bold text-slate-800">
          <Bi vi="Tiết có dạy bằng tiếng Anh (ESL)" en="Taught (partly) in English" layout="inline" />
        </span>
      </label>

      {on && (
        <div className="space-y-3 animate-fade-in">
          {mode === 'choice' && (
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="radiogroup" aria-label="Kiểu báo cáo">
              {(['quick', 'clil'] as EslOption[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={option === o}
                  disabled={disabled}
                  onClick={() => set({ option: o })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    option === o ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  data-testid={`esl-report-${o}`}
                >
                  {o === 'quick' ? <Bi vi="Báo cáo nhanh" en="Quick" layout="inline" /> : <Bi vi="Chi tiết (CLIL)" en="Detailed" layout="inline" />}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Mức độ dạy bằng tiếng Anh">
            {(Object.keys(ESL_LEVELS) as EslLevel[]).map((lv) => {
              const active = value?.level === lv;
              return (
                <button
                  key={lv}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  title={ESL_LEVELS[lv].hint}
                  onClick={() => set({ level: lv })}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                    active ? 'bg-sky-600 border-sky-600 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-700 hover:border-sky-400'
                  }`}
                  data-testid={`esl-level-${lv}`}
                >
                  <Bi vi={ESL_LEVELS[lv].vi} en={ESL_LEVELS[lv].en} />
                </button>
              );
            })}
          </div>

          {option === 'clil' && (
            <>
              <div>
                <label htmlFor="esl-objective" className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mục tiêu ngôn ngữ <span className="font-normal text-slate-400">· Language objective</span> <span className="text-rose-500">*</span>
                </label>
                <input
                  id="esl-objective"
                  value={value?.objective || ''}
                  disabled={disabled}
                  maxLength={300}
                  onChange={(e) => set({ objective: e.target.value })}
                  placeholder="VD: Students can use 'If…, then…' to explain a result"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
                  data-testid="esl-objective"
                />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-700 mb-1">
                  Chiến lược hỗ trợ <span className="font-normal text-slate-400">· Scaffolding</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ESL_STRATEGIES.map((s) => {
                    const active = (value?.strategies || []).includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => {
                          const cur = value?.strategies || [];
                          set({ strategies: active ? cur.filter((x) => x !== s.id) : [...cur, s.id] });
                        }}
                        className={`px-2 py-1 rounded-full border text-[10.5px] transition-all ${
                          active ? 'bg-sky-100 border-sky-400 text-sky-900 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'
                        }`}
                      >
                        <Bi vi={s.vi} en={s.en} layout="inline" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="esl-evidence" className="block text-[11px] font-bold text-slate-700 mb-1">
                  Link minh chứng <span className="font-normal text-slate-400">· Evidence (không bắt buộc)</span>
                </label>
                <input
                  id="esl-evidence"
                  type="url"
                  value={value?.evidenceUrl || ''}
                  disabled={disabled}
                  onChange={(e) => set({ evidenceUrl: e.target.value })}
                  placeholder="https://… (ảnh, slide, phiếu học tập)"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
