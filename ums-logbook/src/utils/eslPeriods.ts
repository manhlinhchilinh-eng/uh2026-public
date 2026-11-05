/**
 * Tiết ESL trong Sổ đầu bài (TC2 "Teaching & Learning" của chuẩn trường ESL).
 * GV đánh dấu tiết có dạy qua tiếng Anh khi ghi sổ → đếm tự động số tiết ESL/lớp/năm (ngưỡng 35/105).
 *
 * Có 2 phương án để BGH chọn trước khi áp dụng (ESL mới ở trường — phải đề xuất BGH duyệt):
 *  - 'quick' (A — Đánh dấu nhanh): 1 công tắc + mức độ. GV mất ~2 giây/tiết.
 *  - 'clil'  (B — Theo khung CLIL): thêm mục tiêu ngôn ngữ + chiến lược hỗ trợ + link minh chứng.
 * Mặc định TẮT (chưa có cấu hình) cho tới khi BGH bật. Hàm thuần.
 */

import type { BiText } from './bilingual';

export type EslOption = 'quick' | 'clil';
export type EslLevel = 'elements' | 'partial' | 'full';
/** Chế độ của trường: 'choice' = GV tự chọn báo cáo nhanh/chi tiết từng tiết (mặc định); 'quick'/'clil' = BGH khóa 1 phương án. */
export type EslMode = 'choice' | EslOption;

export interface EslConfig {
  enabled: boolean;
  option: EslMode;
  updatedAt?: number;
  updatedBy?: string;
}

export const DEFAULT_ESL_CONFIG: EslConfig = { enabled: false, option: 'choice' };

export function parseEslConfig(raw: Partial<EslConfig> | null | undefined): EslConfig {
  if (!raw) return DEFAULT_ESL_CONFIG;
  return {
    enabled: raw.enabled === true,
    option: raw.option === 'clil' || raw.option === 'quick' ? raw.option : 'choice',
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  };
}

/** Dữ liệu ESL gắn trên doc tiết (`daily_logbooks/{id}/periods/{n}.esl`). */
export interface EslTag {
  level: EslLevel;
  option: EslOption;
  /** Mục tiêu ngôn ngữ (chỉ phương án B), vd "Use 'If…, then…' to describe a cause–effect relationship" */
  objective?: string;
  strategies?: string[];
  evidenceUrl?: string;
}

export const ESL_LEVELS: Record<EslLevel, BiText & { hint: string; weight: number }> = {
  elements: { vi: 'Yếu tố ESL', en: 'ESL elements', hint: 'Thuật ngữ, câu lệnh, hoạt động ngắn bằng tiếng Anh', weight: 1 },
  partial: { vi: 'Một phần bằng TA', en: 'Partly in English', hint: 'Khoảng một nửa tiết dạy bằng tiếng Anh', weight: 1 },
  full: { vi: 'Toàn bộ bằng TA', en: 'Fully in English', hint: 'Cả tiết dạy bằng tiếng Anh', weight: 1 },
};

export const ESL_STRATEGIES: Array<{ id: string } & BiText> = [
  { id: 'terms', vi: 'Thuật ngữ song ngữ', en: 'Key terms / glossary' },
  { id: 'frames', vi: 'Khung câu mẫu', en: 'Sentence frames' },
  { id: 'visuals', vi: 'Hình ảnh, sơ đồ', en: 'Visuals & diagrams' },
  { id: 'pair', vi: 'Thảo luận cặp/nhóm bằng TA', en: 'Pair / group talk' },
  { id: 'instructions', vi: 'Câu lệnh lớp học bằng TA', en: 'Classroom language' },
  { id: 'materials', vi: 'Học liệu tiếng Anh/song ngữ', en: 'English / bilingual materials' },
  { id: 'ai', vi: 'Công cụ AI hỗ trợ ngôn ngữ', en: 'AI language support' },
];

/** Phương án áp dụng cho 1 tiết: chế độ 'choice' thì theo lựa chọn của GV trên tiết đó. */
export function effectiveOption(mode: EslMode, tag: Pick<EslTag, 'option'> | null | undefined): EslOption {
  return mode === 'choice' ? (tag?.option === 'clil' ? 'clil' : 'quick') : mode;
}

export const ESL_MODE_CHOICE: BiText & { summary: string } = {
  vi: 'GV tự chọn (khuyến nghị)',
  en: 'Teacher chooses',
  summary:
    'Mỗi tiết GV chọn "Báo cáo nhanh" (phương án A) hoặc "Chi tiết" (phương án B). Thuận tiện giai đoạn đầu; sau này BGH có thể khóa về 1 phương án, dữ liệu cũ vẫn giữ.',
};

export const ESL_OPTIONS: Record<EslOption, BiText & { summary: string; fields: string[] }> = {
  quick: {
    vi: 'Phương án A — Đánh dấu nhanh',
    en: 'Option A — Quick tag',
    summary: 'GV bật "Tiết có dạy bằng tiếng Anh" và chọn mức độ. Ít thao tác, phù hợp giai đoạn thí điểm (Mức 1 — Piloted).',
    fields: ['Có/không dạy bằng TA', 'Mức độ (yếu tố / một phần / toàn bộ)'],
  },
  clil: {
    vi: 'Phương án B — Theo khung CLIL',
    en: 'Option B — CLIL framework',
    summary:
      'Thêm mục tiêu ngôn ngữ (bên cạnh mục tiêu nội dung), chiến lược hỗ trợ và link minh chứng. Đủ minh chứng cho Mức 2–3 (Scaled/Embedded), GV tốn thêm ~30 giây/tiết.',
    fields: ['Có/không dạy bằng TA', 'Mức độ', 'Mục tiêu ngôn ngữ', 'Chiến lược hỗ trợ', 'Link minh chứng (không bắt buộc)'],
  },
};

const MAX_OBJECTIVE = 300;

/** Chuẩn hóa dữ liệu ESL theo phương án đang áp dụng (bỏ trường thừa của phương án khác). */
export function normalizeEslTag(tag: EslTag | null | undefined, mode: EslMode): EslTag | null {
  if (!tag || !ESL_LEVELS[tag.level]) return null;
  const option = effectiveOption(mode, tag);
  if (option === 'quick') return { level: tag.level, option };
  const out: EslTag = { level: tag.level, option };
  const objective = (tag.objective || '').trim().slice(0, MAX_OBJECTIVE);
  if (objective) out.objective = objective;
  const known = new Set(ESL_STRATEGIES.map((s) => s.id));
  const strategies = [...new Set((tag.strategies || []).filter((s) => known.has(s)))];
  if (strategies.length) out.strategies = strategies;
  const url = (tag.evidenceUrl || '').trim();
  if (/^https:\/\/\S+$/i.test(url) && url.length <= 500) out.evidenceUrl = url;
  return out;
}

/** Lỗi nhập (tiếng Việt) hoặc null. Phương án B bắt buộc mục tiêu ngôn ngữ. */
export function validateEslTag(tag: EslTag | null, mode: EslMode): string | null {
  if (!tag) return null;
  const option = effectiveOption(mode, tag);
  if (!ESL_LEVELS[tag.level]) return 'Chọn mức độ dạy bằng tiếng Anh.';
  if (option === 'clil' && !(tag.objective || '').trim()) return 'Phương án CLIL: nhập mục tiêu ngôn ngữ của tiết.';
  if ((tag.objective || '').length > MAX_OBJECTIVE) return `Mục tiêu ngôn ngữ tối đa ${MAX_OBJECTIVE} ký tự.`;
  if (tag.evidenceUrl && !/^https:\/\/\S+$/i.test(tag.evidenceUrl.trim())) return 'Link minh chứng phải bắt đầu bằng https://';
  return null;
}

/** Bản ghi gọn cho collection `esl_periods/{dailyId}_{periodIndex}` — dashboard chỉ đọc collection này, không quét sổ. */
export interface EslPeriodRecord {
  id: string;
  dailyId: string;
  classId: string;
  date: string;
  academicYear: string;
  periodIndex: number;
  subject: string;
  teacherId: string;
  teacherName: string;
  level: EslLevel;
  option: EslOption;
  objective?: string;
  strategies?: string[];
  evidenceUrl?: string;
  updatedAt: number;
}

export function eslRecordId(dailyId: string, periodIndex: number): string {
  return `${dailyId}_${periodIndex}`;
}

export function buildEslRecord(
  p: { dailyId: string; periodIndex: number; subject: string; teacherId: string; teacherName: string; classId?: string },
  tag: EslTag,
  academicYear: string,
  now: number
): EslPeriodRecord {
  const [cls, ...rest] = p.dailyId.split('_');
  return {
    id: eslRecordId(p.dailyId, p.periodIndex),
    dailyId: p.dailyId,
    classId: p.classId || cls,
    date: rest.join('_'),
    academicYear,
    periodIndex: p.periodIndex,
    subject: p.subject,
    teacherId: p.teacherId,
    teacherName: p.teacherName,
    level: tag.level,
    option: tag.option,
    ...(tag.objective ? { objective: tag.objective } : {}),
    ...(tag.strategies?.length ? { strategies: tag.strategies } : {}),
    ...(tag.evidenceUrl ? { evidenceUrl: tag.evidenceUrl } : {}),
    updatedAt: now,
  };
}

/** Môn tiếng Anh/ngoại ngữ không tính là "môn dạy bằng tiếng Anh" (chuẩn: môn NGOÀI tiếng Anh). */
export function isEnglishSubject(subject: string): boolean {
  const s = subject
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /tieng anh|\benglish\b|\beng\b|ngoai ngu|\bnn2?\b|\besl\b|\bielts\b/.test(s);
}

/** Ngưỡng chuẩn: 1 lớp ESL ≥ 35 tiết/năm môn ngoài TA dạy bằng TA; Mức 2 cần 105 tiết. */
export const ESL_CLASS_THRESHOLD = 35;
export const ESL_LEVEL2_PERIODS = 105;

export interface EslClassSummary {
  classId: string;
  periods: number;
  subjects: string[];
  teachers: number;
  reached: boolean;
}

/** Đếm tiết ESL theo lớp (bỏ môn tiếng Anh/ngoại ngữ), sắp lớp nhiều tiết lên trước. */
export function summarizeEslByClass(records: Pick<EslPeriodRecord, 'classId' | 'subject' | 'teacherId'>[]): EslClassSummary[] {
  const by = new Map<string, { periods: number; subjects: Set<string>; teachers: Set<string> }>();
  for (const r of records) {
    if (isEnglishSubject(r.subject)) continue;
    const cur = by.get(r.classId) || { periods: 0, subjects: new Set<string>(), teachers: new Set<string>() };
    cur.periods += 1;
    cur.subjects.add(r.subject);
    cur.teachers.add(r.teacherId);
    by.set(r.classId, cur);
  }
  return [...by.entries()]
    .map(([classId, v]) => ({
      classId,
      periods: v.periods,
      subjects: [...v.subjects].sort((a, b) => a.localeCompare(b, 'vi')),
      teachers: v.teachers.size,
      reached: v.periods >= ESL_CLASS_THRESHOLD,
    }))
    .sort((a, b) => b.periods - a.periods || a.classId.localeCompare(b.classId));
}
