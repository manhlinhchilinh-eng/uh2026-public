/**
 * Báo lỗi / Góp ý (P1) — mở từ chân khung Trợ lý hoặc sau khi bấm 👎.
 * Ảnh chụp màn hình được nén trên máy (≤ 200 KB/ảnh, tối đa 2 ảnh) rồi mới gửi.
 */
import React, { useEffect, useState } from 'react';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { compressImage, submitFeedback } from '../../services/feedbackService';
import { FEEDBACK_KINDS, FEEDBACK_MAX_IMAGES, currentAppVersion, validateFeedback, type FeedbackKind } from '../../utils/feedback';

interface Props {
  vi: boolean;
  initialKind: FeedbackKind;
  question?: string;
  page: string;
  onBack: () => void;
}

export const FeedbackForm: React.FC<Props> = ({ vi, initialKind, question, page, onBack }) => {
  const { user, profile, activeRole } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>(initialKind);
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Array<{ blob: Blob; url: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => () => images.forEach((i) => URL.revokeObjectURL(i.url)), [images]);

  if (!user || !activeRole) {
    return (
      <div className="space-y-2 p-4 text-sm text-slate-700" data-testid="feedback-guest">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-3.5 h-3.5" /> {vi ? 'Quay lại' : 'Back'}
        </button>
        <p>
          {vi
            ? 'Đăng nhập để gửi báo lỗi hoặc góp ý. Không đăng nhập được (quên mật khẩu, tài khoản bị khóa): liên hệ bộ phận Quản trị hệ thống UMS+ qua Văn phòng nhà trường.'
            : 'Sign in to send a bug report or feedback. Cannot sign in? Contact the UMS+ system administrator via the school office.'}
        </p>
      </div>
    );
  }

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError('');
    const room = FEEDBACK_MAX_IMAGES - images.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (!picked.length) {
      setError(vi ? `Chỉ nhận ảnh, tối đa ${FEEDBACK_MAX_IMAGES} ảnh.` : `Images only, up to ${FEEDBACK_MAX_IMAGES}.`);
      return;
    }
    setBusy(true);
    try {
      const out: Array<{ blob: Blob; url: string }> = [];
      for (const f of picked) {
        const blob = await compressImage(f);
        out.push({ blob, url: URL.createObjectURL(blob) });
      }
      setImages((prev) => [...prev, ...out]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đọc được ảnh.');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const err = validateFeedback(message, images.map((i) => ({ size: i.blob.size, type: i.blob.type })));
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitFeedback({ uid: user.uid, displayName: profile?.displayName, username: profile?.username }, activeRole, {
        kind,
        message,
        question,
        page,
        appVersion: currentAppVersion(),
        images: images.map((i) => i.blob),
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : vi ? 'Chưa gửi được, thử lại.' : 'Could not send, try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-3 p-4 text-sm text-slate-700" data-testid="feedback-sent">
        <p className="font-semibold text-emerald-700">{vi ? 'Đã gửi. Cảm ơn bạn!' : 'Sent. Thank you!'}</p>
        <p className="text-xs text-slate-500">
          {vi ? 'Quản trị UMS+ sẽ xem và xử lý. Góp ý của bạn giúp UMS+ tốt hơn mỗi ngày.' : 'The UMS+ admins will review it.'}
        </p>
        <button type="button" onClick={onBack} className="rounded-lg bg-[#8B1A4A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6B1338]">
          {vi ? 'Quay lại Trợ lý' : 'Back to assistant'}
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 p-4 text-sm"
      data-testid="feedback-form"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-3.5 h-3.5" /> {vi ? 'Quay lại Trợ lý' : 'Back to assistant'}
      </button>
      <div className="flex gap-1.5" role="radiogroup" aria-label={vi ? 'Loại góp ý' : 'Feedback type'}>
        {(['bug', 'idea', 'question'] as FeedbackKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-full px-2.5 py-1 text-xs ring-1 ${kind === k ? 'bg-[#8B1A4A] text-white ring-[#8B1A4A]' : 'bg-white text-slate-600 ring-slate-200'}`}
          >
            {vi ? FEEDBACK_KINDS[k].vi : FEEDBACK_KINDS[k].en}
          </button>
        ))}
      </div>
      {question && (
        <p className="text-xs text-slate-500">
          {vi ? 'Câu vừa hỏi: ' : 'Question asked: '}“{question}”
        </p>
      )}
      <label htmlFor="feedback-message" className="sr-only">{vi ? 'Mô tả' : 'Description'}</label>
      <textarea
        id="feedback-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder={
          kind === 'idea'
            ? vi ? 'Bạn muốn UMS+ có thêm chức năng gì?' : 'What would you like UMS+ to do?'
            : vi ? 'Bạn đang làm gì thì gặp lỗi? Lỗi hiện ra thế nào?' : 'What were you doing? What went wrong?'
        }
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-ums-300 focus:bg-white focus:ring-2 focus:ring-ums-100"
      />
      <div className="flex flex-wrap items-center gap-2">
        {images.map((img, i) => (
          <div key={img.url} className="relative">
            <img src={img.url} alt={`Ảnh ${i + 1}`} className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
            <button
              type="button"
              aria-label={vi ? 'Bỏ ảnh' : 'Remove image'}
              onClick={() => setImages((prev) => prev.filter((x) => x.url !== img.url))}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 p-0.5 text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < FEEDBACK_MAX_IMAGES && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            <ImagePlus className="w-4 h-4" /> {vi ? 'Thêm ảnh chụp màn hình' : 'Add screenshot'}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void addFiles(e.target.files)} data-testid="feedback-file" />
          </label>
        )}
      </div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6B1338] disabled:opacity-50"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {vi ? 'Gửi' : 'Send'}
      </button>
    </form>
  );
};
