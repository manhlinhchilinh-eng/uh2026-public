import React, { useEffect, useState } from 'react';
import { roundScoreInput, SCORE_STEP } from '../../utils/scoring';

export interface ScoreInputProps {
  /** null = GV chưa chọn (ô trống) */
  value: number | null;
  max: number;
  onChange: (value: number) => void;
  label: string;
  /** Ô đang thiếu (viền đỏ) */
  invalid?: boolean;
  id?: string;
}

/** Hiển thị điểm kiểu Việt Nam: 3,5 */
const fmt = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));

/**
 * Ô nhập điểm tiết theo bậc 0,5. Giữ nguyên chữ khi đang gõ ("3," / "3.") để không bị đặt lại về 0;
 * nhận giá trị ngay khi đã là bậc 0,5 hợp lệ, làm tròn + kẹp [0, max] khi rời ô. Nút −/+ đổi 0,5.
 */
export const ScoreInput: React.FC<ScoreInputProps> = ({ value, max, onChange, label, invalid, id }) => {
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    // Rời ô khi vẫn trống → giữ trống (chưa chọn), không tự thành 0
    if (value == null && !raw.trim()) return;
    const n = roundScoreInput(raw, max);
    onChange(n);
    setText(fmt(n));
  };

  // Ô trống: bấm + chọn điểm tối đa, bấm − chọn tối đa − 0,5
  const step = (delta: number) => commit(String(value == null ? (delta > 0 ? max : max + delta) : value + delta));

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <button
        type="button"
        onClick={() => step(-SCORE_STEP)}
        disabled={value != null && value <= 0}
        aria-label={`Giảm 0,5 điểm ${label}`}
        className="w-5 sm:w-6 h-7 shrink-0 rounded-md border border-slate-300 text-slate-600 font-bold disabled:opacity-40"
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        id={id}
        aria-label={`Điểm ${label}`}
        aria-invalid={invalid || undefined}
        placeholder="—"
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const n = parseFloat(raw.replace(',', '.'));
          if (Number.isFinite(n) && n >= 0 && n <= max && Number.isInteger(n / SCORE_STEP)) onChange(n);
        }}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
        className={`w-full min-w-0 text-sm font-bold text-center border rounded-md py-1 px-0 focus:ring-2 focus:ring-[#8B1A4A] ${invalid ? 'border-rose-400 bg-rose-50' : 'border-slate-300'}`}
      />
      <button
        type="button"
        onClick={() => step(SCORE_STEP)}
        disabled={value != null && value >= max}
        aria-label={`Tăng 0,5 điểm ${label}`}
        className="w-5 sm:w-6 h-7 shrink-0 rounded-md border border-slate-300 text-slate-600 font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
};
