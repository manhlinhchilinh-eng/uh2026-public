/**
 * Lịch sử thay đổi TKB: mỗi lần BGH cập nhật từ file Excel được lưu vĩnh viễn (/schedule_updates).
 * Xem lại lớp nào đổi tiết nào, ai cập nhật, lúc nào, đã hoàn tác chưa. Lọc theo lớp.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { ScheduleChangeGrid } from './ScheduleChangeGrid';
import { fetchScheduleHistory, type ScheduleUpdateRecord } from '../../services/timetableUpdateService';

const fmt = (ms: number) =>
  new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export const ScheduleHistoryPanel: React.FC<{ classFilter?: string; refreshKey?: number }> = ({ classFilter = '', refreshKey = 0 }) => {
  const [items, setItems] = useState<ScheduleUpdateRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyClass, setOnlyClass] = useState(classFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openClass, setOpenClass] = useState<string | null>(null);

  useEffect(() => setOnlyClass(classFilter), [classFilter]);
  useEffect(() => {
    setItems(null);
    fetchScheduleHistory()
      .then(setItems)
      .catch((e) => {
        console.error('[TKB] lịch sử', e);
        setError('Không tải được lịch sử thay đổi TKB.');
      });
  }, [refreshKey]);

  const shown = useMemo(
    () => (items || []).filter((u) => !onlyClass || (u.changes[onlyClass]?.length ?? 0) > 0),
    [items, onlyClass]
  );

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!items) return <p className="text-sm text-slate-500">Đang tải lịch sử…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <History className="w-4 h-4 text-[#8B1A4A]" />
        <span>{items.length} lần cập nhật được lưu.</span>
        <label className="ml-auto flex items-center gap-1.5">
          Chỉ xem lớp
          <input
            value={onlyClass}
            onChange={(e) => setOnlyClass(e.target.value.toUpperCase().trim())}
            placeholder="vd. 9A3"
            className="w-20 px-2 py-1 border border-slate-300 rounded-lg"
            aria-label="Lọc theo lớp"
          />
        </label>
      </div>

      {shown.length === 0 && (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">
          {items.length === 0 ? 'Chưa có lần cập nhật TKB nào từ file Excel.' : `Lớp ${onlyClass} chưa có thay đổi nào.`}
        </p>
      )}

      {shown.map((u) => {
        const isOpen = openId === u.updateId;
        const classes = Object.keys(u.changes).sort();
        const cls = isOpen ? (onlyClass && u.changes[onlyClass] ? onlyClass : openClass && u.changes[openClass] ? openClass : classes[0]) : null;
        return (
          <div key={u.updateId} className="bg-white border border-slate-200 rounded-xl" data-testid="tkb-history-item">
            <button
              type="button"
              onClick={() => {
                setOpenId(isOpen ? null : u.updateId);
                setOpenClass(null);
              }}
              className="w-full text-left p-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              aria-expanded={isOpen}
            >
              <span className="font-bold text-slate-900">{fmt(u.createdAt)}</span>
              <span className="text-slate-600">
                {u.fileName}
                {u.effective && ` · áp dụng từ ${u.effective}`}
              </span>
              <span className="text-slate-600">
                {u.totalChanges} tiết / {u.classesChanged} lớp
              </span>
              <span className="text-slate-500">bởi {u.byName}</span>
              {u.undoneAt && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                  Đã hoàn tác {fmt(u.undoneAt)}
                </span>
              )}
              <span className="ml-auto text-[#8B1A4A] font-semibold">{isOpen ? 'Thu gọn' : 'Xem chi tiết'}</span>
            </button>
            {isOpen && cls && (
              <div className="border-t border-slate-100 p-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {classes.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setOpenClass(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        c === cls ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                    >
                      {c} ({u.changes[c].length})
                    </button>
                  ))}
                </div>
                <ScheduleChangeGrid changes={u.changes[cls]} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
