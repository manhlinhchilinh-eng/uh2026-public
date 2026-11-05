/**
 * Báo lỗi / Góp ý qua Trợ lý (P1) — hàm thuần, có test.
 * Mỗi người tối đa FEEDBACK_MAX_PER_DAY bản/ngày: id = `${uid}_${ngày}_${stt}` nên rules chặn được bản thứ 11.
 */
export const FEEDBACK_MAX_PER_DAY = 10;
export const FEEDBACK_MAX_IMAGES = 2;
export const FEEDBACK_IMAGE_MAX_BYTES = 200_000;
export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_PAGE_SIZE = 30;

export type FeedbackKind = 'bug' | 'idea' | 'question';
export type FeedbackStatus = 'new' | 'doing' | 'done' | 'idea';

export const FEEDBACK_KINDS: Record<FeedbackKind, { vi: string; en: string }> = {
  bug: { vi: 'Báo lỗi', en: 'Bug report' },
  idea: { vi: 'Ý tưởng tính năng', en: 'Feature idea' },
  question: { vi: 'Câu hỏi Trợ lý chưa trả lời được', en: 'Unanswered question' },
};

export const FEEDBACK_STATUSES: Record<FeedbackStatus, { vi: string; en: string; cls: string }> = {
  new: { vi: 'Mới', en: 'New', cls: 'bg-red-50 text-red-700 ring-red-200' },
  doing: { vi: 'Đang xử lý', en: 'In progress', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  done: { vi: 'Đã xong', en: 'Done', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  idea: { vi: 'Ý tưởng tính năng', en: 'Feature idea', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

export interface FeedbackDoc {
  id: string;
  authorId: string;
  authorName: string;
  role: string;
  kind: FeedbackKind;
  message: string;
  question: string;
  page: string;
  appVersion: string;
  imageCount: number;
  day: number;
  seq: number;
  status: FeedbackStatus;
  createdAt: number;
  updatedAt?: number;
  updatedBy?: string;
  adminNote?: string;
}

/** Số ngày kể từ 1970 theo UTC — khớp `int(request.time.toMillis() / 86400000)` trong rules. */
export const dayIndex = (ms: number) => Math.floor(ms / 86_400_000);

export const feedbackId = (uid: string, day: number, seq: number) => `${uid}_${day}_${seq}`;

/** Số thứ tự kế tiếp trong ngày, hoặc null nếu đã đủ 10. */
export function nextSeq(usedSeqs: number[]): number | null {
  const used = new Set(usedSeqs);
  for (let s = 1; s <= FEEDBACK_MAX_PER_DAY; s++) if (!used.has(s)) return s;
  return null;
}

export function validateFeedback(message: string, images: Array<{ size: number; type: string }>): string | null {
  const m = message.trim();
  if (!m) return 'Nhập mô tả lỗi hoặc góp ý.';
  if (m.length > FEEDBACK_MESSAGE_MAX) return `Mô tả tối đa ${FEEDBACK_MESSAGE_MAX} ký tự.`;
  if (images.length > FEEDBACK_MAX_IMAGES) return `Tối đa ${FEEDBACK_MAX_IMAGES} ảnh.`;
  if (images.some((i) => !/^image\/(jpeg|webp|png)$/.test(i.type))) return 'Chỉ nhận ảnh JPG, PNG, WebP.';
  if (images.some((i) => i.size > FEEDBACK_IMAGE_MAX_BYTES)) return 'Ảnh quá lớn sau khi nén, thử ảnh khác.';
  return null;
}

/** Kích thước vẽ lại ảnh: cạnh dài ≤ maxSide, giữ tỉ lệ. */
export function fitSize(w: number, h: number, maxSide: number): { w: number; h: number } {
  const k = Math.min(1, maxSide / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Tên bundle đang chạy (vd. index-Cs8pj9MY.js) để biết người dùng gặp lỗi ở bản nào. */
export function currentAppVersion(doc: Document = document): string {
  const src = doc.querySelector('script[src*="/assets/index-"]')?.getAttribute('src') || '';
  return src.split('/').pop()?.slice(0, 60) || 'dev';
}
