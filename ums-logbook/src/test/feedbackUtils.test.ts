import { describe, expect, it } from 'vitest';
import { dayIndex, feedbackId, fitSize, nextSeq, validateFeedback, FEEDBACK_MAX_PER_DAY } from '../utils/feedback';

describe('feedback utils', () => {
  it('id = uid_ngày_stt, ngày theo UTC như rules', () => {
    expect(dayIndex(86_400_000 * 20397 + 5)).toBe(20397);
    expect(feedbackId('u1', 20397, 3)).toBe('u1_20397_3');
  });
  it('số thứ tự kế tiếp, đủ 10 thì null', () => {
    expect(nextSeq([])).toBe(1);
    expect(nextSeq([1, 2, 4])).toBe(3);
    expect(nextSeq(Array.from({ length: FEEDBACK_MAX_PER_DAY }, (_, i) => i + 1))).toBeNull();
  });
  it('kiểm mô tả và ảnh', () => {
    expect(validateFeedback('  ', [])).toMatch(/Nhập mô tả/);
    expect(validateFeedback('ok', [{ size: 10, type: 'image/jpeg' }])).toBeNull();
    expect(validateFeedback('ok', [{ size: 10, type: 'image/gif' }])).toMatch(/JPG/);
    expect(validateFeedback('ok', [{ size: 300_000, type: 'image/jpeg' }])).toMatch(/quá lớn/);
    expect(validateFeedback('ok', Array(3).fill({ size: 1, type: 'image/png' }))).toMatch(/Tối đa 2/);
  });
  it('thu nhỏ ảnh giữ tỉ lệ', () => {
    expect(fitSize(3200, 1600, 1600)).toEqual({ w: 1600, h: 800 });
    expect(fitSize(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });
});
