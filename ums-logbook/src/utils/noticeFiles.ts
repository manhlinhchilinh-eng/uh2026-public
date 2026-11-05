/**
 * Tệp tải lên trong thông báo nhân sự — lưu ngay trong Firestore (không cần Blaze/Storage):
 * /office_notices/{id}/files/{fileId} (thông tin) + /chunks/{i} (khối byte ≤ 750 KB).
 * Rules: chỉ người nhận / người gửi / BGH / Văn phòng tải được. Hàm thuần — không gọi Firebase.
 * Chi phí: mỗi lượt tải = 1 + số khối lượt đọc + băng thông bằng cỡ tệp → giới hạn cỡ & số tệp.
 */

export const NOTICE_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const NOTICE_FILE_MAX_COUNT = 3;
/** Khối byte mỗi doc (Firestore tối đa ~1 MiB/doc, chừa chỗ cho tên trường). */
export const NOTICE_FILE_CHUNK_BYTES = 750_000;

/** Chỉ tài liệu văn phòng thường dùng — chặn tệp chạy được (.exe, .js, .html…). */
export const NOTICE_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'zip'] as const;

export interface NoticeFileMeta {
  name: string;
  size: number;
  type: string;
  chunkCount: number;
  authorId: string;
  createdAt: number;
}

export const fileExt = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export const chunkCountFor = (size: number) => Math.max(1, Math.ceil(size / NOTICE_FILE_CHUNK_BYTES));

/** Cắt mảng byte thành các khối ≤ NOTICE_FILE_CHUNK_BYTES. */
export function splitChunks(bytes: Uint8Array, chunk = NOTICE_FILE_CHUNK_BYTES): Uint8Array[] {
  if (bytes.length === 0) return [new Uint8Array(0)];
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunk) out.push(bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  return out;
}

/** Ghép các khối (theo thứ tự) lại thành 1 mảng byte. */
export function joinChunks(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Kiểm danh sách tệp định gửi (cả tệp đã chọn trước đó). Trả về lỗi đầu tiên hoặc null. */
export function validateNoticeFiles(files: Array<{ name: string; size: number }>): string | null {
  if (files.length > NOTICE_FILE_MAX_COUNT) return `Tối đa ${NOTICE_FILE_MAX_COUNT} tệp tải lên mỗi thông báo (tệp lớn hơn hãy dán link Google Drive).`;
  for (const f of files) {
    if (!(NOTICE_FILE_EXTENSIONS as readonly string[]).includes(fileExt(f.name)))
      return `"${f.name}": chỉ nhận ${NOTICE_FILE_EXTENSIONS.join(', ')}.`;
    if (f.size > NOTICE_FILE_MAX_BYTES) return `"${f.name}" lớn hơn 5 MB — hãy tải lên Google Drive rồi dán link.`;
    if (f.size === 0) return `"${f.name}" rỗng.`;
  }
  return null;
}

/** "1,2 MB" / "350 KB" */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Tên tệp an toàn để lưu (bỏ đường dẫn, ký tự điều khiển; tối đa 120 ký tự, giữ đuôi). */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'tep';
  const clean = base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').trim() || 'tep';
  if (clean.length <= 120) return clean;
  const ext = fileExt(clean);
  return `${clean.slice(0, 115 - ext.length)}….${ext}`;
}
