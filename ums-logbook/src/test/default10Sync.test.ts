import { describe, it, expect } from 'vitest';
import { calculateWeeklySummary } from '../services/summaryService';
import { applyDefault10ToPrint, DEFAULT10_PRINT_NOTE } from '../utils/pdfGenerator';
import { DEFAULT_MIXED_RULES, findMixedRule } from '../utils/mixedPeriods';
import { DEFAULT10_RULES, isDefault10 } from '../utils/tptRanking';

// Tuần 10 năm học 2026-2027: 09/11 → 13/11
const W = 10;
const slots = [
  { dayOfWeek: 2, periodIndex: 1, subject: 'Maths', teacherName: 'Ms Linh' },
  { dayOfWeek: 2, periodIndex: 2, subject: 'Native 1', teacherName: 'Native' },
  { dayOfWeek: 2, periodIndex: 3, subject: 'Foreign language 2', teacherName: 'NN2_1' },
  { dayOfWeek: 2, periodIndex: 4, subject: 'Eng Test prep', teacherName: 'Ms Hà' },
];
const signedP = (periodIndex: number, total: number) =>
  ({ dailyId: '8A2_2026-11-09', periodIndex, isSigned: true, subject: 'Maths', scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: total - 9, total } }) as any;
const isDef = (subj: string) => findMixedRule('8A2', subj, DEFAULT_MIXED_RULES)?.mode === 'auto10';

describe('Tiết mặc định 10đ đồng bộ mọi nơi (chốt 05/11)', () => {
  it('xếp hạng TPT dùng đúng danh sách chung; Eng Test prep không thuộc', () => {
    expect(DEFAULT10_RULES.length).toBe(DEFAULT_MIXED_RULES.filter((r) => r.mode === 'auto10').length);
    for (const [cls, s] of [['6A1', 'Foreign language 2'], ['8A2', 'Native 1'], ['6A2', 'Native 2'], ['9A3', 'Eng 1'], ['9A3', 'Literature test prep'], ['9A3', 'Maths test prep']]) {
      expect(isDefault10(cls, s)).toBe(true);
      expect(findMixedRule(cls, s, DEFAULT_MIXED_RULES)?.mode).toBe('auto10');
    }
    expect(isDefault10('9A3', 'Eng Test prep')).toBe(false);
    expect(isDefault10('8A1', 'Eng 1')).toBe(false);
  });

  it('tổng kết tuần: Native/NN2 chưa ký → tính 10đ, không vào "chưa ký"; Eng Test prep chưa ký vẫn bị nêu', () => {
    const s = calculateWeeklySummary('8A2', W, [], { '8A2_2026-11-09': [signedP(1, 9)] }, {
      tkbSlots: slots,
      today: '2026-11-09',
      isMixedSlot: (subj) => !!findMixedRule('8A2', subj, DEFAULT_MIXED_RULES),
      isDefault10Slot: isDef,
    });
    expect(s.unsignedPeriods.map((p) => p.subject)).toEqual(['Eng Test prep']);
    expect(s.defaultScoredPeriods?.map((p) => p.periodIndex)).toEqual([2, 3]);
    // TB tổng = (9 + 10 + 10) / 3
    expect(s.criteriaAverages.totalAverage).toBe(9.67);
  });

  it('tiết mặc định 10đ GV đã ký → dùng điểm thật, không cộng thêm', () => {
    const s = calculateWeeklySummary('8A2', W, [], { '8A2_2026-11-09': [signedP(2, 8)] }, {
      tkbSlots: slots.slice(1, 2),
      today: '2026-11-09',
      isMixedSlot: (subj) => !!findMixedRule('8A2', subj, DEFAULT_MIXED_RULES),
      isDefault10Slot: isDef,
    });
    expect(s.defaultScoredPeriods).toEqual([]);
    expect(s.criteriaAverages.totalAverage).toBe(8);
  });

  it('bản in: tiết mặc định chưa ký hiện tổng 10 + "Mặc định 10đ"; tiết đã ký giữ nguyên', () => {
    const out = applyDefault10ToPrint([signedP(1, 9)], [{ periodIndex: 2, subject: 'Native 1' }, { periodIndex: 1, subject: 'Maths' }]);
    expect(out.map((p) => p.periodIndex)).toEqual([1, 2]);
    expect(out[0]).toMatchObject({ isSigned: true, scores: { total: 9 } });
    expect(out[1]).toMatchObject({ subject: 'Native 1', scores: { total: 10 }, teacherSignature: DEFAULT10_PRINT_NOTE, printDefault10: true });
  });
});
