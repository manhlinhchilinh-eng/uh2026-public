import { describe, it, expect } from 'vitest';
import { DEFAULT_MIXED_RULES, findMixedRule, slotPlanByClass, setMixedMode, ENG9_HUB_URL } from '../utils/mixedPeriods';
import { periodEditPolicy, describeEditScope } from '../utils/teacherAssignment';
import { computeDashboard } from '../utils/dashboard';

const sch = (classId: string, slots: Array<[number, number, string]>) => ({
  classId, academicYear: '2026-2027', semester: 1, updatedAt: 0,
  slots: slots.map(([d, p, subject]) => ({ dayOfWeek: d, periodIndex: p, subject, teacherName: 'x', teacherUsername: '' })),
});

describe('Tiết lớp trộn', () => {
  it('danh sách chung (chốt 05/11): NN2, Native 1/2 mọi khối; Eng 1, Văn/Toán test prep khối 9 → mặc định 10đ; Eng Test prep chấm bình thường', () => {
    expect(findMixedRule('6A1', 'Foreign language 2', DEFAULT_MIXED_RULES)?.mode).toBe('auto10');
    expect(findMixedRule('8A2', 'Native 1', DEFAULT_MIXED_RULES)?.mode).toBe('auto10');
    expect(findMixedRule('6A2', 'Native 2', DEFAULT_MIXED_RULES)?.mode).toBe('auto10');
    expect(findMixedRule('9A1', 'Literature test prep', DEFAULT_MIXED_RULES)?.mode).toBe('auto10');
    expect(findMixedRule('9A1', 'Maths test prep', DEFAULT_MIXED_RULES)?.mode).toBe('auto10');
    expect(findMixedRule('8A1', 'Maths test prep', DEFAULT_MIXED_RULES)).toBeNull();
    expect(findMixedRule('9A3', 'eng 1 ', DEFAULT_MIXED_RULES)).toMatchObject({ mode: 'auto10', noteUrl: ENG9_HUB_URL });
    expect(findMixedRule('9A3', 'Eng Test prep', DEFAULT_MIXED_RULES)).toBeNull();
    expect(findMixedRule('8A1', 'Eng 1', DEFAULT_MIXED_RULES)).toBeNull();
  });

  it('kế hoạch tiết: bỏ tiết trống; NN2 + Eng 1 K9 là tiết mặc định 10đ', () => {
    const plan = slotPlanByClass(
      { '9A3': sch('9A3', [[2, 1, 'Homeroom'], [2, 2, 'Eng 1'], [2, 3, 'Foreign language 2'], [3, 1, 'Eng Test prep'], [3, 2, '']]) },
      DEFAULT_MIXED_RULES
    );
    expect(plan['9A3']).toEqual({ scored: { 2: 3, 3: 1 }, auto: { 2: [2, 3] } });
  });

  it('BGH đặt/bỏ kiểu lớp trộn theo môn × khối', () => {
    let rules = setMixedMode(DEFAULT_MIXED_RULES, 'Eng 1', 8, 'auto10', ENG9_HUB_URL);
    expect(findMixedRule('8A1', 'Eng 1', rules)?.mode).toBe('auto10');
    rules = setMixedMode(rules, 'Eng 1', 8, null);
    expect(findMixedRule('8A1', 'Eng 1', rules)).toBeNull();
    rules = setMixedMode(rules, 'Foreign language 2', 6, null);
    expect(findMixedRule('6A1', 'Foreign language 2', rules)).toBeNull();
    expect(findMixedRule('7A1', 'Foreign language 2', rules)?.mode).toBe('auto10');
    rules = setMixedMode(rules, 'Foreign language 2', 7, 'skip');
    expect(findMixedRule('7A1', 'Foreign language 2', rules)?.mode).toBe('skip');
  });

  it('NN2: GV không chấm, BGH vẫn sửa; câu giải thích có nêu', () => {
    const base = { assignedClassId: '9A3', myAliases: ['Mr.Linh'], claimedAliases: new Set(['mr.linh']), classId: '9A3', slotTeacherName: 'Mr.Linh', isMySubstitution: false };
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', isMixed: true })).toEqual({ canEdit: false, reason: 'mixed' });
    expect(periodEditPolicy({ ...base, activeRole: 'admin', isMixed: true }).canEdit).toBe(true);
    expect(describeEditScope([{ period: 1, reason: 'my_period' }, { period: 2, reason: 'mixed' }])).toBe('Bạn được ghi/chấm tiết 1 (của bạn); tiết 2 là lớp trộn (không chấm điểm).');
  });
});

describe('Tổng kết: tiết dự kiến & tiết mặc định 10đ', () => {
  const base = { start: '2026-10-12', end: '2026-10-16', holidays: ['2026-10-14'], classIds: ['9A3', '6A1'], periodsByDaily: {}, notes: [] };

  it('tiết dự kiến theo kế hoạch (T4 nghỉ); lớp không có TKB vẫn 8 tiết/ngày', () => {
    const s = computeDashboard({ ...base, logbooks: [], slotPlans: { '9A3': { scored: { 2: 6, 3: 8, 4: 8, 5: 7, 6: 5 }, auto: {} } } });
    expect(s.byClass.find((c) => c.classId === '9A3')?.expectedPeriods).toBe(6 + 8 + 7 + 5);
    expect(s.byClass.find((c) => c.classId === '6A1')?.expectedPeriods).toBe(32);
    expect(computeDashboard({ ...base, logbooks: [] }).byClass[0].expectedPeriods).toBe(32);
  });

  it('tiết Eng 1 K9 chưa ai ký → tính đã ký 10đ; đã có người ký → dùng điểm thật', () => {
    const p = (periodIndex: number, total: number) => ({ periodIndex, isSigned: true, scores: { total } }) as any;
    const s = computeDashboard({
      ...base,
      classIds: ['9A3'],
      logbooks: [{ id: '9A3_2026-10-12', classId: '9A3', date: '2026-10-12' } as any],
      periodsByDaily: { '9A3_2026-10-12': [p(1, 8), p(2, 9)] },
      slotPlans: { '9A3': { scored: { 2: 3, 3: 1, 5: 0, 6: 0 }, auto: { 2: [2, 3], 3: [4] } } },
    });
    const c = s.byClass[0];
    // T2: tiết 1 thật 8đ, tiết 2 thật 9đ (ghi đè), tiết 3 tự 10đ; T3: tiết 4 tự 10đ
    expect(c.signedPeriods).toBe(4);
    expect(c.avgScore).toBe(9.3);
    expect(c.expectedPeriods).toBe(4);
  });
});
