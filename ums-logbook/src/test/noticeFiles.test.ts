import { describe, expect, it } from 'vitest';
import {
  NOTICE_FILE_CHUNK_BYTES,
  NOTICE_FILE_MAX_BYTES,
  chunkCountFor,
  formatBytes,
  joinChunks,
  safeFileName,
  splitChunks,
  validateNoticeFiles,
} from '../utils/noticeFiles';
import { uploadedFiles } from '../utils/officeNotices';

describe('Tệp tải lên trong thông báo (lưu Firestore, chia khối)', () => {
  it('chia khối rồi ghép lại đúng từng byte', () => {
    const bytes = new Uint8Array(NOTICE_FILE_CHUNK_BYTES * 2 + 123).map((_, i) => i % 251);
    const parts = splitChunks(bytes);
    expect(parts.length).toBe(3);
    expect(parts.every((p) => p.length <= NOTICE_FILE_CHUNK_BYTES)).toBe(true);
    expect(chunkCountFor(bytes.length)).toBe(3);
    expect(joinChunks(parts)).toEqual(bytes);
  });

  it('tệp 5 MB vừa ≤ 8 khối (khớp rules chunkCount ≤ 8)', () => {
    expect(chunkCountFor(NOTICE_FILE_MAX_BYTES)).toBeLessThanOrEqual(8);
  });

  it('kiểm loại, cỡ, số tệp', () => {
    expect(validateNoticeFiles([{ name: 'Ke hoach.PDF', size: 1000 }])).toBeNull();
    expect(validateNoticeFiles([{ name: 'virus.exe', size: 10 }])).toMatch(/chỉ nhận/);
    expect(validateNoticeFiles([{ name: 'trang.html', size: 10 }])).toMatch(/chỉ nhận/);
    expect(validateNoticeFiles([{ name: 'lon.pdf', size: NOTICE_FILE_MAX_BYTES + 1 }])).toMatch(/5 MB/);
    expect(validateNoticeFiles([{ name: 'rong.pdf', size: 0 }])).toMatch(/rỗng/);
    expect(validateNoticeFiles(Array.from({ length: 4 }, (_, i) => ({ name: `${i}.pdf`, size: 1 })))).toMatch(/Tối đa 3/);
  });

  it('tên tệp an toàn, giữ đuôi', () => {
    expect(safeFileName(String.raw`C:\fakepath\Biên bản họp.docx`)).toBe('Biên bản họp.docx');
    expect(safeFileName('a<b>:c.pdf')).toBe('a_b__c.pdf');
    const long = safeFileName(`${'x'.repeat(200)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith('.pdf')).toBe(true);
  });

  it('formatBytes', () => {
    expect(formatBytes(350 * 1024)).toBe('350 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });

  it('uploadedFiles chỉ lấy tệp có fileId hợp lệ, bỏ link và dữ liệu lạ', () => {
    expect(
      uploadedFiles([
        { name: 'a.pdf', fileId: 'abc123', size: 10, type: 'application/pdf' },
        { name: 'link', url: 'https://drive.google.com/x' },
        { name: 'xấu', fileId: '../hack' },
      ])
    ).toEqual([{ name: 'a.pdf', fileId: 'abc123', size: 10, type: 'application/pdf' }]);
  });
});
