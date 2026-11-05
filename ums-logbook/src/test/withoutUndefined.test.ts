import { describe, it, expect } from 'vitest';
import { withoutUndefined } from '../services/logbookService';

describe('Lưu tiết không gửi trường undefined lên Firestore', () => {
  it('bỏ trường undefined (vd. ô Tiết PPCT trống, signedAt khi chưa ký), giữ 0/false/null/""', () => {
    const r = withoutUndefined({ ppctLessonIndex: undefined, signedAt: undefined, total: 0, isSigned: false, note: '', x: null });
    expect(r).toEqual({ total: 0, isSigned: false, note: '', x: null });
    expect('ppctLessonIndex' in r).toBe(false);
  });
});
