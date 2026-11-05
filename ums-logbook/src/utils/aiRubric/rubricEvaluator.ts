/**
 * AI Rubric Evaluator (GDPT 2018, thang 10) — chuyển 1:1 từ ums_growth_hub/app/core/evaluator.py.
 * Nội dung 3.0 • Ngôn ngữ 2.5 • Phản biện & Sáng tạo 2.5 • Hợp tác & Liêm chính 2.0.
 * 100% offline, xác định (cùng đầu vào → cùng kết quả), chạy trong trình duyệt.
 */

import { computeLexicalMetrics, detectLanguage, sanitizeText, type LexicalMetrics } from './nlpEngine';
import { extractSkills, type SkillTag } from './skillTagger';
import { WB_AFTER, WB_BEFORE, pyRound } from './pyCompat';

export interface EvaluationRequest {
  title?: string;
  category?: string;
  /** 'en' | 'vi' | 'bilingual' | 'auto' — mặc định 'en' như bản Python */
  language?: string;
  content: string;
  reflection?: string | null;
  grade_level?: number;
}

export interface CriterionDetail {
  score: number;
  max_score: number;
  criteria_name: string;
  level: string;
  rationale: string;
}

export interface EvaluationResult {
  rubric: {
    content_depth: number;
    language_expression: number;
    critical_innovation: number;
    collaboration_integrity: number;
    total_score: number;
    details: Record<'content_depth' | 'language_expression' | 'critical_innovation' | 'collaboration_integrity', CriterionDetail>;
  };
  skills: SkillTag[];
  overall_score: number;
  overall_level: string;
  strengths: string;
  growth_areas: string;
  milestones: string[];
  feedback: string;
}

type Scored = [number, string, string];
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

// Số liệu: \b\d+(?:[.,]\d+)?\s*(?:đơn vị)?\b — \b, \d theo Unicode như Python 3
const NUMBER_RE = new RegExp(
  `${WB_BEFORE}\\p{Nd}+(?:[\\.,]\\p{Nd}+)?\\s*(?:%|mg|ml|cm|m|kg|ngày|hours|days|samples|lần|độ)?${WB_AFTER}`,
  'u'
);

const hasNumbersOrData = (content: string) => NUMBER_RE.test(content);

function scoreContentDepth(content: string, m: LexicalMetrics): Scored {
  const wc = m.word_count;
  let score = wc < 30 ? 1.0 : wc < 80 ? 1.6 : wc < 150 ? 2.1 : wc < 300 ? 2.5 : 2.7;
  if (hasNumbersOrData(content)) score += 0.2;
  if (m.academic_matches >= 3) score += 0.2;
  else if (m.academic_matches >= 1) score += 0.1;
  const markers = ['mục tiêu', 'phương pháp', 'kết quả', 'kết luận', 'objective', 'method', 'result', 'discussion', 'conclusion'];
  const lower = content.toLowerCase();
  if (markers.filter((s) => lower.includes(s)).length >= 2) score += 0.2;
  score = pyRound(clamp(score, 0.8, 3.0), 1);
  if (score >= 2.7) return [score, 'Xuất sắc', 'Nội dung phong phú, bố cục bài bản, kiến thức chuyên môn chính xác và có số liệu minh chứng thuyết phục.'];
  if (score >= 2.1) return [score, 'Tốt', 'Nội dung đạt chuẩn mục tiêu dự án, lập luận rõ ràng, hiểu biết chuyên môn vững vàng.'];
  if (score >= 1.5) return [score, 'Đạt', 'Nội dung đáp ứng yêu cầu cơ bản, cần đào sâu thêm phân tích nguyên nhân và số liệu đối chứng.'];
  return [score, 'Cần cố gắng', 'Nội dung còn quá ngắn gọn hoặc sơ sài, cần bổ sung thêm dẫn chứng và chi tiết thực nghiệm.'];
}

function scoreLanguageExpression(content: string, m: LexicalMetrics): Scored {
  const wc = m.word_count;
  let score = wc < 30 ? 0.9 : wc < 80 ? 1.4 : wc < 150 ? 1.8 : 2.1;
  if (m.root_ttr >= 5.0 || (m.ttr >= 0.65 && wc >= 50)) score += 0.25;
  else if (m.root_ttr >= 3.5) score += 0.15;
  const lower = content.toLowerCase();
  const discourse = ['tuy nhiên', 'do đó', 'vì vậy', 'furthermore', 'however', 'therefore', 'specifically'].filter((x) => lower.includes(x)).length;
  if (discourse >= 2) score += 0.15;
  score = pyRound(clamp(score, 0.8, 2.5), 1);
  if (score >= 2.2) return [score, 'Xuất sắc', 'Vốn từ vựng phong phú, sử dụng chính xác thuật ngữ chuyên môn và cấu trúc câu mạch lạc, tự nhiên.'];
  if (score >= 1.8) return [score, 'Tốt', 'Diễn đạt lưu loát, ngữ pháp chuẩn mực, phong cách trình bày khoa học và trực quan.'];
  if (score >= 1.3) return [score, 'Đạt', 'Diễn đạt tròn ý, câu cú cơ bản hoàn chỉnh; cần trau chuốt thêm các liên từ kết nối mạch lập luận.'];
  return [score, 'Cần cố gắng', 'Câu văn còn đơn điệu hoặc lặp từ; cần mở rộng vốn từ học thuật và cải thiện diễn đạt.'];
}

function scoreCriticalInnovation(content: string, m: LexicalMetrics): Scored {
  const lower = content.toLowerCase();
  const wc = m.word_count;
  let score = wc < 30 ? 0.8 : wc < 80 ? 1.3 : wc < 150 ? 1.7 : 2.0;
  const crit = ['tại sao', 'nguyên nhân', 'phản biện', 'so sánh', 'đối chứng', 'hạn chế', 'thách thức', 'why', 'cause', 'limitation', 'challenge', 'trade-off', 'counter', 'contrast'].filter((x) => lower.includes(x)).length;
  if (crit >= 3) score += 0.3;
  else if (crit >= 1) score += 0.15;
  const innov = ['sáng tạo', 'đề xuất', 'giải pháp', 'cải tiến', 'mới', 'đột phá', 'mô hình', 'innovative', 'novel', 'solution', 'prototype', 'designed', 'improved', 'idea'].filter((x) => lower.includes(x)).length;
  if (innov >= 3) score += 0.3;
  else if (innov >= 1) score += 0.15;
  score = pyRound(clamp(score, 0.7, 2.5), 1);
  if (score >= 2.2) return [score, 'Xuất sắc', 'Ý tưởng có tính đột phá cao, tiếp cận bài toán đa chiều và đề xuất giải pháp sáng tạo, khả thi.'];
  if (score >= 1.8) return [score, 'Tốt', 'Có tư duy phản biện tốt, nhận diện đúng thách thức thực tế và đưa ra giải pháp phù hợp.'];
  if (score >= 1.3) return [score, 'Đạt', 'Giải pháp cơ bản khả thi nhưng chưa có nhiều điểm mới lạ; cần phân tích sâu hơn tính ứng dụng.'];
  return [score, 'Cần cố gắng', 'Chưa thể hiện rõ góc nhìn phản biện cá nhân hoặc giải pháp còn mang tính sao chép sơ lược.'];
}

function scoreCollaborationIntegrity(content: string, reflection: string): Scored {
  const lower = content.toLowerCase();
  const refl = reflection.toLowerCase();
  let base = 1.2;
  const citations = ['nguồn', 'tài liệu tham khảo', 'trích dẫn', 'theo nghiên cứu', 'apa', 'mla', 'references', 'sources', 'bibliography', 'cited', 'et al', 'http', 'doi'];
  if (citations.some((c) => lower.includes(c))) base += 0.4;
  const collab = ['nhóm', 'thành viên', 'phân công', 'vai trò', 'đồng đội', 'phối hợp', 'chúng em', 'team', 'member', 'collaborate', 'divided', 'coordination', 'partner', 'role'];
  if (collab.some((c) => lower.includes(c) || refl.includes(c))) base += 0.3;
  const rl = reflection.trim().length;
  if (rl >= 30) base += 0.3;
  else if (rl > 0) base += 0.15;
  const score = pyRound(clamp(base, 0.6, 2.0), 1);
  if (score >= 1.8) return [score, 'Xuất sắc', 'Tuân thủ nghiêm ngặt liêm chính học thuật với nguồn trích dẫn chuẩn mực; tinh thần hợp tác nhóm và phản tư rất gương mẫu.'];
  if (score >= 1.4) return [score, 'Tốt', 'Trích dẫn nguồn tài liệu minh bạch; phân công công việc trong nhóm rõ ràng và có tinh thần trách nhiệm.'];
  if (score >= 1.0) return [score, 'Đạt', 'Có ghi nhận tài liệu tham khảo và tham gia nhóm; cần chuẩn hóa định dạng trích dẫn theo chuẩn học thuật (APA).'];
  return [score, 'Cần cố gắng', 'Thiếu danh mục tài liệu tham khảo hoặc chưa thể hiện rõ sự đóng góp trong quy trình làm việc nhóm.'];
}

function generateFeedback(title: string, grade: number, r: EvaluationResult['rubric'], skills: SkillTag[], lang: string) {
  const en = lang === 'en';
  const names = skills.slice(0, 2).map((s) => s.skill_name);
  const skillStr = names.length ? names.join(', ') : 'tư duy nghiên cứu độc lập';
  let strengths: string;
  if (r.total_score >= 8.5) {
    strengths = en
      ? `Outstanding performance on project '${title}'! The submission showcases strong academic rigor, sophisticated vocabulary, and compelling argumentation. Your command of ${skillStr} is exemplary for Grade ${grade}.`
      : `Bài nộp dự án '${title}' thể hiện chất lượng học thuật rất xuất sắc! Em đã vận dụng hiệu quả ${skillStr}, lập luận chặt chẽ và kết hợp trực quan sinh động, vượt chuẩn kỳ vọng của lứa tuổi THCS.`;
  } else if (r.total_score >= 7.0) {
    strengths = en
      ? `Very commendable work on '${title}'. Your content is well-structured, concepts are articulated clearly, and your application of ${skillStr} demonstrates commendable diligence and capability.`
      : `Dự án '${title}' được hoàn thiện rất chỉn chu và đúng tiến độ. Em đã nắm vững kiến thức chuyên môn, thể hiện rõ ${skillStr} và tinh thần trách nhiệm cao đối với sản phẩm học tập.`;
  } else {
    strengths = en
      ? `Good initiative in completing '${title}'. You successfully addressed the basic objectives and showed an encouraging start in developing ${skillStr}.`
      : `Ghi nhận nỗ lực bước đầu của em trong việc hoàn thành dự án '${title}'. Em đã bước đầu làm quen với phương pháp làm việc dự án và rèn luyện ${skillStr}.`;
  }
  const ratios: Array<[keyof typeof GROWTH_VI, number]> = [
    ['content_depth', r.content_depth / 3.0],
    ['language_expression', r.language_expression / 2.5],
    ['critical_innovation', r.critical_innovation / 2.5],
    ['collaboration_integrity', r.collaboration_integrity / 2.0],
  ];
  const lowest = ratios.reduce((min, x) => (x[1] < min[1] ? x : min))[0];
  const growth = en ? GROWTH_EN[lowest] : GROWTH_VI[lowest];
  const milestones = en
    ? [
        '1. Refine the project bibliography using APA 7th edition citation standards within the next revision.',
        '2. Engage actively in UMS academic clubs (Debate Club or STEM Robotics) to practice presenting and defending your research before wider audiences.',
      ]
    : [
        '1. Chuẩn hóa định dạng trích dẫn tài liệu tham khảo và bổ sung 1 biểu đồ trực quan hóa dữ liệu trong lần nộp tiếp theo.',
        '2. Đăng ký tham gia Câu lạc bộ Tranh biện hoặc CLB Nghiên cứu Khoa học UMS để tiếp tục bồi dưỡng tư duy phản biện và sẵn sàng cho mục tiêu chuyển cấp vào THPT Chuyên Ngoại ngữ (CNN).',
      ];
  const feedback = `【Điểm sáng nổi bật】: ${strengths}\n\n【Cơ hội bứt phá】: ${growth}\n\n【Hành động tiếp theo】:\n` + milestones.join('\n');
  return { strengths, growth_areas: growth, milestones, feedback };
}

const GROWTH_VI = {
  content_depth: 'Em nên bổ sung thêm số liệu thực nghiệm định lượng hoặc phân tích sâu hơn về nguyên nhân cốt lõi của vấn đề.',
  language_expression: 'Có thể mở rộng thêm vốn thuật ngữ học thuật chuyên sâu và sử dụng các câu chuyển ý linh hoạt hơn để tăng tính thuyết phục.',
  critical_innovation: 'Nên dành thêm dung lượng để so sánh ưu - nhược điểm của các phương án khác nhau và làm nổi bật tính mới lạ của giải pháp.',
  collaboration_integrity: 'Cần chuẩn hóa danh mục tài liệu tham khảo theo định dạng APA và viết nhật ký phản tư cá nhân chi tiết hơn.',
};
const GROWTH_EN: typeof GROWTH_VI = {
  content_depth: 'Consider expanding the quantitative empirical evidence and deepening the analysis of underlying root causes.',
  language_expression: 'Try integrating more advanced academic terminology and varied discourse connectors to elevate expression flow.',
  critical_innovation: 'You can strengthen the critical evaluation by contrasting counter-arguments and emphasizing the unique novelty of your solution.',
  collaboration_integrity: 'Standardize your bibliography according to APA guidelines and elaborate on peer collaboration in your reflection.',
};

export function evaluateSubmission(req: EvaluationRequest): EvaluationResult {
  const cleaned = sanitizeText(req.content);
  if (!cleaned || cleaned.trim().length === 0) {
    throw new Error('Nội dung bài nộp không được để trống hoặc chỉ chứa ký tự đặc biệt');
  }
  const reflection = req.reflection || '';
  const title = req.title || 'Untitled Project';
  const language = req.language ?? 'en';
  const grade = req.grade_level ?? 8;

  const combined = `${cleaned}\n\n${reflection}`.trim();
  const metrics = computeLexicalMetrics(combined);
  const detected = detectLanguage(combined);
  const lang = ['en', 'vi', 'bilingual'].includes(language) ? language : detected;

  const c1 = scoreContentDepth(cleaned, metrics);
  const c2 = scoreLanguageExpression(cleaned, metrics);
  const c3 = scoreCriticalInnovation(cleaned, metrics);
  const c4 = scoreCollaborationIntegrity(cleaned, reflection);
  const total = clamp(pyRound(c1[0] + c2[0] + c3[0] + c4[0], 1), 1.0, 10.0);

  const detail = (s: Scored, max: number, name: string): CriterionDetail => ({ score: s[0], max_score: max, criteria_name: name, level: s[1], rationale: s[2] });
  const rubric: EvaluationResult['rubric'] = {
    content_depth: c1[0],
    language_expression: c2[0],
    critical_innovation: c3[0],
    collaboration_integrity: c4[0],
    total_score: total,
    details: {
      content_depth: detail(c1, 3.0, 'Kiến thức Chuyên môn & Chiều sâu Nội dung'),
      language_expression: detail(c2, 2.5, 'Năng lực Ngôn ngữ & Truyền thông Đa phương thức'),
      critical_innovation: detail(c3, 2.5, 'Tư duy Phản biện, Sáng tạo & Giải quyết vấn đề'),
      collaboration_integrity: detail(c4, 2.0, 'Hợp tác, Quản lý dự án & Đạo đức học thuật'),
    },
  };
  const skills = extractSkills(cleaned, req.reflection, req.category || 'general', 3, 6, 0.65);
  const fb = generateFeedback(title, grade, rubric, skills, lang);
  const overall_level = total >= 9.0 ? 'Xuất sắc' : total >= 7.0 ? 'Tốt' : total >= 5.0 ? 'Đạt' : 'Cần cố gắng';
  return { rubric, skills, overall_score: total, overall_level, ...fb };
}
