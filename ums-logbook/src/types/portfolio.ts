/**
 * UMS SmartConnect - Hồ sơ năng lực số (ePortfolio) học sinh
 * Collection: /portfolio_items/{id}
 * HS nộp minh chứng → AI chấm rubric offline ngay trên máy → GV duyệt/trả lại → PH xem.
 */

export type PortfolioType = 'project' | 'writing' | 'award' | 'activity';
export type PortfolioCategory = 'general' | 'english_presentation' | 'stem_scientific' | 'social_humanities';
export type PortfolioStatus = 'submitted' | 'approved' | 'returned';

export interface PortfolioAiResult {
  content_depth: number;
  language_expression: number;
  critical_innovation: number;
  collaboration_integrity: number;
  total_score: number;
  overall_level: string;
  skills: Array<{ skill_id: string; skill_name: string; cluster: string; confidence: number; evidence: string }>;
  strengths: string;
  growth_areas: string;
  milestones: string[];
  engineVersion: string;
}

export interface PortfolioItem {
  id: string;
  mhs: string;
  studentDocId: string;
  studentName: string;
  classId: string;
  title: string;
  type: PortfolioType;
  category: PortfolioCategory;
  content: string;
  reflection: string;
  links: string[];
  status: PortfolioStatus;
  createdByUid: string;
  createdByRole: string;
  ai: PortfolioAiResult | null;
  teacherComment?: string;
  teacherScore?: number | null;
  reviewerUid?: string;
  reviewerName?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type NewPortfolioInput = Pick<PortfolioItem, 'title' | 'type' | 'category' | 'content' | 'reflection' | 'links'>;
