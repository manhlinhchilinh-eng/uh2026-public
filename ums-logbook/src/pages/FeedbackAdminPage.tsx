/**
 * Góp ý & lỗi (P1) — admin xem góp ý / lỗi người dùng gửi qua Trợ lý UMS+, đổi trạng thái, xem ảnh.
 * Đọc 30 bản mỗi lần khi mở trang / bấm Làm mới / Tải thêm. Không polling, không listener.
 * Ảnh chỉ tải khi bấm "Xem ảnh".
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { MessageSquareWarning, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { useAuth } from '../hooks/useAuth';
import { listFeedback, loadFeedbackImages, setFeedbackStatus } from '../services/feedbackService';
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackDoc, type FeedbackStatus } from '../utils/feedback';

const fmt = (ms: number) =>
  new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export const FeedbackAdminPage: React.FC = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<FeedbackDoc[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');
  const [images, setImages] = useState<Record<string, string[]>>({});

  const load = useCallback(async (more = false) => {
    setLoading(true);
    setError('');
    try {
      const page = await listFeedback(more ? cursor : null);
      setItems((prev) => (more ? [...prev, ...page.items] : page.items));
      setCursor(page.cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được góp ý.');
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => Object.values(images).flat().forEach((u) => URL.revokeObjectURL(u)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    items.forEach((i) => (c[i.status] = (c[i.status] || 0) + 1));
    return c;
  }, [items]);
  const shown = filter === 'all' ? items : items.filter((i) => i.status === filter);

  const changeStatus = async (fb: FeedbackDoc, status: FeedbackStatus) => {
    try {
      await setFeedbackStatus(fb.id, status, profile?.username || profile?.displayName || 'admin');
      setItems((prev) => prev.map((x) => (x.id === fb.id ? { ...x, status, updatedAt: Date.now() } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được trạng thái.');
    }
  };

  const showImages = async (fb: FeedbackDoc) => {
    try {
      const urls = await loadFeedbackImages(fb);
      setImages((m) => ({ ...m, [fb.id]: urls }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được ảnh.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4" data-testid="feedback-admin">
      <div className="flex flex-wrap items-center gap-3">
        <div className="p-2 rounded-xl bg-ums-50 text-[#8B1A4A]"><MessageSquareWarning className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800"><Bi vi="Góp ý & lỗi" en="Feedback & bugs" layout="inline" /></h1>
          <p className="text-xs text-slate-500">
            Người dùng gửi qua nút "Báo lỗi / Góp ý" trong Trợ lý UMS+. Dùng để sửa lỗi và lên kế hoạch tính năng mới.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(['all', 'new', 'doing', 'done', 'idea'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 ring-1 ${filter === s ? 'bg-[#8B1A4A] text-white ring-[#8B1A4A]' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
          >
            {s === 'all' ? 'Tất cả' : FEEDBACK_STATUSES[s].vi} ({counts[s] || 0})
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Chưa có góp ý nào. Người dùng gửi bằng nút "Báo lỗi / Góp ý" ở chân khung Trợ lý UMS+.
        </div>
      )}

      <ul className="space-y-3">
        {shown.map((fb) => (
          <li key={fb.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100" data-testid="feedback-item">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${FEEDBACK_STATUSES[fb.status]?.cls || ''}`}>
                {FEEDBACK_STATUSES[fb.status]?.vi || fb.status}
              </span>
              <span className="font-semibold text-slate-700">{FEEDBACK_KINDS[fb.kind]?.vi || fb.kind}</span>
              <span>· {fb.authorName || 'Người dùng'} ({fb.role})</span>
              <span>· {fmt(fb.createdAt)}</span>
              {fb.page && <span>· trang {fb.page}</span>}
            </div>
            {fb.question && <p className="mt-2 text-xs text-slate-500">Câu đã hỏi Trợ lý: “{fb.question}”</p>}
            <p className="mt-1.5 whitespace-pre-line text-sm text-slate-800">{fb.message}</p>
            {fb.imageCount > 0 && !images[fb.id] && (
              <button type="button" onClick={() => void showImages(fb)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#8B1A4A] hover:underline">
                <ImageIcon className="w-3.5 h-3.5" /> Xem {fb.imageCount} ảnh
              </button>
            )}
            {images[fb.id] && (
              <div className="mt-2 flex flex-wrap gap-2">
                {images[fb.id].map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                    <img src={u} alt="Ảnh chụp màn hình người dùng gửi" className="max-h-48 rounded-lg ring-1 ring-slate-200" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <label htmlFor={`st-${fb.id}`} className="text-slate-500">Trạng thái</label>
              <select
                id={`st-${fb.id}`}
                value={fb.status}
                onChange={(e) => void changeStatus(fb, e.target.value as FeedbackStatus)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1"
              >
                {(Object.keys(FEEDBACK_STATUSES) as FeedbackStatus[]).map((s) => (
                  <option key={s} value={s}>{FEEDBACK_STATUSES[s].vi}</option>
                ))}
              </select>
              <span className="text-slate-400">· bản {fb.appVersion}</span>
            </div>
          </li>
        ))}
      </ul>

      {cursor && (
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Tải thêm 30 bản
        </button>
      )}
    </div>
  );
};
