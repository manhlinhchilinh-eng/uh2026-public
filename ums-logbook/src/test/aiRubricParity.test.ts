import { describe, it, expect } from 'vitest';
import fixtures from './fixtures/rubric_parity.json';
import { evaluateSubmission } from '../utils/aiRubric/rubricEvaluator';
import { pyRound } from '../utils/aiRubric/pyCompat';

// Bộ đối chứng sinh bằng bộ chấm Python gốc (ums_growth_hub) — TS phải cho kết quả GIỐNG HỆT.
describe('AI chấm rubric: bản TypeScript khớp 100% bản Python', () => {
  it('có đủ ca đối chứng', () => {
    expect((fixtures as unknown[]).length).toBeGreaterThanOrEqual(13);
  });

  for (const [i, f] of (fixtures as any[]).entries()) {
    it(`ca ${i + 1}: ${f.input.title} (${f.input.language}, ${f.input.category})`, () => {
      const r = evaluateSubmission(f.input);
      expect({
        content_depth: r.rubric.content_depth,
        language_expression: r.rubric.language_expression,
        critical_innovation: r.rubric.critical_innovation,
        collaboration_integrity: r.rubric.collaboration_integrity,
        total_score: r.rubric.total_score,
      }).toEqual(f.expected.rubric);
      expect(Object.fromEntries(Object.entries(r.rubric.details).map(([k, v]) => [k, v.level]))).toEqual(f.expected.levels);
      expect(r.overall_level).toBe(f.expected.overall_level);
      expect(r.skills.map((s) => ({ skill_id: s.skill_id, confidence: s.confidence, evidence: s.evidence }))).toEqual(f.expected.skills);
      expect(r.feedback).toBe(f.expected.feedback);
    });
  }
});

describe('pyRound giống round() của Python', () => {
  it('làm tròn điểm giữa về số chẵn và theo giá trị nhị phân thật', () => {
    expect(pyRound(2.5)).toBe(2);
    expect(pyRound(3.5)).toBe(4);
    expect(pyRound(0.125, 2)).toBe(0.12);
    expect(pyRound(0.375, 2)).toBe(0.38);
    expect(pyRound(2.675, 2)).toBe(2.67); // 2.675 nhị phân = 2.67499…
    expect(pyRound(1.25, 1)).toBe(1.2);
    expect(pyRound(0.1 + 0.2, 1)).toBe(0.3);
  });

  it('báo lỗi khi nội dung trống', () => {
    expect(() => evaluateSubmission({ content: '   <br>  ' })).toThrow(/không được để trống/);
  });
});
