/**
 * Tiết nào BẮT BUỘC GV chấm 4 tiêu chí trước khi ký sổ (góp ý 05/11: GV không chấm vẫn ký được vì form điền sẵn 10đ).
 * Ngoại lệ (không bắt chấm — ký bình thường, lưu 10đ như trước):
 *  - Tiết lớp trộn (cấu hình BGH trên trang TKB).
 *  - Tiết tính mặc định 10đ theo quy chế xếp hạng (NN2, Native…, K9 chia phòng: Văn/Toán test prep, Eng 1 khối 9).
 *  - Tiết NN2 (mọi cách ghi), HĐTN.
 * Xét cả tên môn trên TKB lẫn tên môn GV gõ trong form.
 */

import { isDefault10 } from './tptRanking';
import { subjectFromTimetable } from './gradebook';

export function scoringOptionalReason(classId: string, subjects: Array<string | null | undefined>, mixed?: { mode: string } | null): string | null {
  if (mixed) return mixed.mode === 'auto10' ? 'Tiết tính mặc định 10đ theo quy chế thi đua' : 'Tiết lớp trộn';
  for (const s of subjects) {
    if (!s || !s.trim()) continue;
    if (isDefault10(classId, s)) return 'Tiết tính mặc định 10đ theo quy chế thi đua';
    const key = subjectFromTimetable(s)?.key;
    if (key === 'ngoai_ngu_2') return 'Tiết Ngoại ngữ 2 (mặc định 10đ)';
    if (key === 'hdtn') return 'Tiết HĐTN';
  }
  return null;
}

export type ScoreKey = 'learning' | 'discipline' | 'hygiene' | 'customCriterion';

/** Các ô điểm còn trống (chưa chọn) theo thứ tự hiển thị */
export function missingScoreKeys(scores: Record<ScoreKey, number | null>): ScoreKey[] {
  return (['learning', 'discipline', 'hygiene', 'customCriterion'] as const).filter((k) => scores[k] == null);
}
