/**
 * Danh sách tên (chưa đọc / chưa thực hiện / đã đọc) mặc định thu gọn: chỉ hiện số + nút "Hiện".
 * Danh sách dài (cả trường ~70 người) không chiếm hết khung chi tiết.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const TONES = {
  warn: 'text-amber-800 bg-amber-50 border-amber-100',
  ok: 'text-emerald-800 bg-emerald-50 border-emerald-100',
  plain: 'text-slate-700 bg-slate-50 border-slate-100',
} as const;

export const CollapsibleNames: React.FC<{
  label: string;
  names: string[];
  tone?: keyof typeof TONES;
  /** Mở sẵn khi danh sách ngắn (mặc định ≤ 3 tên) */
  autoOpenMax?: number;
  testId?: string;
}> = ({ label, names, tone = 'plain', autoOpenMax = 3, testId }) => {
  const [open, setOpen] = useState(names.length <= autoOpenMax);
  if (names.length === 0) return null;
  return (
    <div className="text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#8B1A4A]"
      >
        {label}: {names.length}
        <span className="text-slate-500 font-normal">{open ? '· Ẩn' : '· Hiện danh sách'}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <p data-testid={testId} className={`mt-1 border rounded-lg p-2 leading-relaxed ${TONES[tone]}`}>
          {names.join(', ')}
        </p>
      )}
    </div>
  );
};
