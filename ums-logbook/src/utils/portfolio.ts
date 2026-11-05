/**
 * ePortfolio — hàm thuần: chạy AI chấm offline, tổng hợp năng lực, kiểm tra dữ liệu.
 */

import type { NewPortfolioInput, PortfolioAiResult, PortfolioItem, PortfolioType } from '../types/portfolio';
import { evaluateSubmission } from './aiRubric/rubricEvaluator';

export const AI_ENGINE_VERSION = 'growth-hub-rubric-ts-1 (khớp 121/121 ca với bản Python)';

export const TYPE_LABEL: Record<PortfolioType, string> = {
  project: 'Dự án',
  writing: 'Bài viết',
  award: 'Giải thưởng',
  activity: 'Hoạt động',
};

export const CATEGORY_LABEL: Record<string, string> = {
  general: 'Chung',
  english_presentation: 'Tiếng Anh & Thuyết trình',
  stem_scientific: 'STEM & Khoa học',
  social_humanities: 'Xã hội & Nhân văn',
};

export const DIMENSIONS = [
  { key: 'content_depth', label: 'Kiến thức & Chiều sâu nội dung', max: 3.0 },
  { key: 'language_expression', label: 'Ngôn ngữ & Truyền thông', max: 2.5 },
  { key: 'critical_innovation', label: 'Phản biện & Sáng tạo', max: 2.5 },
  { key: 'collaboration_integrity', label: 'Hợp tác & Liêm chính học thuật', max: 2.0 },
] as const;

export function validatePortfolio(input: NewPortfolioInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Vui lòng nhập tên minh chứng.');
  if (input.title.length > 150) errors.push('Tên tối đa 150 ký tự.');
  if (input.content.trim().length < 20) errors.push('Mô tả/nội dung tối thiểu 20 ký tự để AI có thể nhận xét.');
  if (input.content.length > 20000) errors.push('Nội dung tối đa 20.000 ký tự.');
  for (const l of input.links) if (l && !/^https:\/\//.test(l)) errors.push(`Liên kết phải bắt đầu bằng https:// (${l})`);
  return errors;
}

/** Chạy bộ chấm AI offline (bản TS của Growth Hub). Giải thưởng/hoạt động ngắn vẫn được chấm để gợi ý, GV quyết định. */
export function runAi(input: NewPortfolioInput, gradeLevel: number): PortfolioAiResult {
  const r = evaluateSubmission({
    title: input.title,
    category: input.category,
    language: 'auto',
    content: input.content,
    reflection: input.reflection || null,
    grade_level: gradeLevel,
  });
  return {
    content_depth: r.rubric.content_depth,
    language_expression: r.rubric.language_expression,
    critical_innovation: r.rubric.critical_innovation,
    collaboration_integrity: r.rubric.collaboration_integrity,
    total_score: r.rubric.total_score,
    overall_level: r.overall_level,
    skills: r.skills.map((s) => ({ skill_id: s.skill_id, skill_name: s.skill_name, cluster: s.cluster, confidence: s.confidence, evidence: s.evidence })),
    strengths: r.strengths,
    growth_areas: r.growth_areas,
    milestones: r.milestones,
    engineVersion: AI_ENGINE_VERSION,
  };
}

/** Năng lực tổng hợp: trung bình tỉ lệ từng chiều trên các minh chứng ĐÃ DUYỆT (0..1). */
export function competencyProfile(items: PortfolioItem[]) {
  const approved = items.filter((i) => i.status === 'approved' && i.ai);
  return {
    count: approved.length,
    dims: DIMENSIONS.map((d) => {
      const vals = approved.map((i) => (i.ai as any)[d.key] / d.max);
      return { ...d, ratio: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    }),
    topSkills: topSkills(approved),
  };
}

/** Kỹ năng xuất hiện nhiều nhất trên minh chứng đã duyệt. */
export function topSkills(items: PortfolioItem[], n = 6) {
  const counts = new Map<string, { name: string; cluster: string; count: number }>();
  for (const i of items) {
    for (const s of i.ai?.skills || []) {
      const c = counts.get(s.skill_id) || { name: s.skill_name, cluster: s.cluster, count: 0 };
      c.count++;
      counts.set(s.skill_id, c);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi')).slice(0, n);
}

export const gradeFromClass = (classId: string) => Number(classId.match(/^(\d)/)?.[1] ?? 8);
