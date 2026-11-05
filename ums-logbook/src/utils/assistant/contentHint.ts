/** Nhắc người đăng ghi nội dung chính bằng chữ để Trợ lý UMS+ trả lời được (không chặn gửi). */
export const CONTENT_HINT_MIN = 80;
export const CONTENT_HINT_TEXT = 'Ghi nội dung chính (danh sách, ngày giờ…) để Trợ lý UMS+ trả lời được.';

export function needsContentHint(text: string, hasLinkOrFile: boolean): boolean {
  return hasLinkOrFile && text.trim().length < CONTENT_HINT_MIN;
}
