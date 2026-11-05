/**
 * Bilingual NLP Engine — chuyển 1:1 từ ums_growth_hub/app/core/nlp_engine.py.
 * 100% offline, chạy trong trình duyệt, không gửi dữ liệu HS ra ngoài.
 */

import { pyRound, pySplit } from './pyCompat';

const VI_CHARS = 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
const VIETNAMESE_DIACRITICS = new RegExp(`[${VI_CHARS}]`, 'giu');
const TOKEN_RE = new RegExp(`[a-z0-9${VI_CHARS}]+(?:-[a-z0-9${VI_CHARS}]+)*`, 'giu');
const HAS_WORD_CHAR = new RegExp(`[a-zA-Z0-9${VI_CHARS}]`, 'u');

export const VIETNAMESE_STOPWORDS = new Set([
  'và', 'của', 'là', 'trong', 'các', 'một', 'cho', 'được', 'với', 'những',
  'này', 'khi', 'để', 'về', 'người', 'có', 'đã', 'sẽ', 'em', 'chúng', 'nhóm',
  'học', 'sinh', 'trường', 'dự', 'án', 'bài', 'thực', 'hiện', 'kết', 'quả',
  'nghiên', 'cứu', 'phương', 'pháp', 'sau', 'đó', 'tuy', 'nhiên', 'do', 'đó',
  'vì', 'vậy', 'bởi', 'thầy', 'cô', 'lớp', 'nêu', 'ra', 'như', 'theo', 'tại',
  'ở', 'từ', 'lại', 'rất', 'cũng', 'đang', 'đến', 'làm', 'phát', 'triển',
]);

export const ENGLISH_STOPWORDS = new Set([
  'the', 'and', 'of', 'to', 'in', 'a', 'is', 'that', 'for', 'it', 'as', 'was',
  'with', 'on', 'are', 'by', 'this', 'be', 'or', 'from', 'at', 'which', 'an',
  'have', 'each', 'make', 'our', 'their', 'we', 'you', 'can', 'will', 'project',
  'research', 'team', 'results', 'methodology', 'study', 'analysis', 'students',
  'about', 'all', 'also', 'been', 'has', 'more', 'not', 'one', 'than', 'they',
]);

const EN_VOCAB = new Set([
  ...ENGLISH_STOPWORDS,
  'slide', 'slides', 'global', 'warming', 'climate', 'change', 'education',
  'school', 'students', 'learning', 'presentation', 'ai', 'technology',
  'stem', 'robotics', 'project', 'design', 'future', 'system', 'water',
  'plant', 'green', 'smart', 'environment', 'impact', 'youth', 'perspectives',
  'solutions', 'team', 'model', 'analysis', 'data', 'test', 'science', 'canva',
  'artificial', 'intelligence', 'ethical', 'challenges', 'opportunities', 'plastic',
]);

const ACADEMIC_STEM_TERMS = new Set([
  'hypothesis', 'experiment', 'experimental', 'variable', 'variables', 'methodology',
  'quantitative', 'qualitative', 'empirical', 'sensor', 'microcontroller', 'algorithm',
  'photosynthesis', 'biodegradable', 'biodegradability', 'tensile', 'conductivity',
  'arduino', 'iot', 'circuit', 'hydroponic', 'automation', 'data', 'statistics',
  'correlation', 'measurement', 'concentration', 'synthesis', 'specimen', 'prototype',
  'giả thuyết', 'thực nghiệm', 'thí nghiệm', 'biến số', 'phương pháp', 'định lượng',
  'định tính', 'cảm biến', 'vi điều khiển', 'thuật toán', 'quang hợp', 'phân hủy sinh học',
  'độ bền kéo', 'độ dẫn điện', 'mạch điện', 'thủy canh', 'tự động hóa', 'số liệu',
  'thống kê', 'tương quan', 'đo lường', 'nồng độ', 'tổng hợp', 'mẫu thử', 'mô hình', 'sáng chế',
]);

const ACADEMIC_HUMANITIES_TERMS = new Set([
  'heritage', 'folklore', 'tradition', 'traditional', 'culture', 'cultural', 'preservation',
  'historical', 'rhetoric', 'literary', 'empathy', 'identity', 'community', 'narrative',
  'ethics', 'aesthetic', 'perspective', 'societal', 'engagement', 'ideology', 'philosophy',
  'di sản', 'dân gian', 'truyền thống', 'văn hóa', 'bảo tồn', 'lịch sử', 'tu từ', 'văn học',
  'thấu cảm', 'bản sắc', 'cộng đồng', 'nghệ thuật', 'đạo đức', 'thẩm mỹ', 'góc nhìn',
  'xã hội', 'lan tỏa', 'phụng sự', 'nhân văn', 'triết lý', 'truyền cảm hứng',
]);

const ACADEMIC_DISCOURSE_MARKERS = new Set([
  'furthermore', 'moreover', 'nevertheless', 'consequently', 'specifically',
  'demonstrates', 'substantiate', 'conversely', 'in contrast', 'therefore',
  'accordingly', 'subsequently', 'fundamentally', 'notably', 'significantly',
  'hơn nữa', 'mặt khác', 'tuy nhiên', 'do đó', 'vì vậy', 'cụ thể là', 'chứng minh rằng',
  'đối chiếu', 'tóm lại', 'ngược lại', 'đặc biệt là', 'đáng chú ý', 'thực chất',
  'nhìn chung', 'trên cơ sở', 'xét về mặt',
]);

export type Lang = 'vi' | 'en' | 'bilingual';

export interface LexicalMetrics {
  word_count: number;
  unique_word_count: number;
  sentence_count: number;
  paragraph_count: number;
  avg_sentence_length: number;
  ttr: number;
  root_ttr: number;
  academic_matches: number;
  academic_density: number;
  complexity_score: number;
  language: Lang;
}

export function sanitizeText(text: string): string {
  if (!text) return '';
  let t = text.normalize('NFC');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/[ \t\r\f\v]+/g, ' ');
  return t.trim();
}

export function tokenize(text: string, lowercase = true): string[] {
  if (!text) return [];
  const t = lowercase ? text.toLowerCase() : text;
  return t.match(TOKEN_RE) ?? [];
}

export function tokenizeSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  const cleaned = text.trim();
  const raw = cleaned.split(/(?<=[.!?])\s+|\n+/u);
  const sentences = raw.map((s) => (s ?? '').trim()).filter((s) => s.length > 0 && HAS_WORD_CHAR.test(s));
  return sentences.length ? sentences : [cleaned];
}

const countMatches = (re: RegExp, s: string) => (s.match(re) ?? []).length;

export function detectLanguage(text: string): Lang {
  if (!text || !text.trim()) return 'vi';
  const lower = text.toLowerCase();
  const tokens = tokenize(lower);
  if (tokens.length === 0) return 'vi';
  const total = tokens.length;

  const diacriticChars = countMatches(VIETNAMESE_DIACRITICS, lower);
  const viHits = tokens.filter((t) => VIETNAMESE_STOPWORDS.has(t) || new RegExp(`[${VI_CHARS}]`, 'iu').test(t)).length;
  const enHits = tokens.filter((t) => EN_VOCAB.has(t)).length;
  const viRatio = viHits / total;
  const enRatio = enHits / total;

  const codeSwitching = (diacriticChars >= 2 || viHits >= 2) && enHits >= 2 && enRatio >= 0.12;
  if (codeSwitching) return 'bilingual';
  if (diacriticChars >= 2 || viRatio > 0.1 || (viHits > enHits && viHits > 0)) {
    if (enRatio > 0.25 && viRatio > 0.15) return 'bilingual';
    return 'vi';
  }
  if (enRatio >= 0.05 || enHits >= 3 || enHits > viHits) return 'en';
  return diacriticChars > 0 ? 'vi' : 'en';
}

export function computeLexicalMetrics(text: string): LexicalMetrics {
  const sanitized = sanitizeText(text);
  const tokens = tokenize(sanitized, true);
  const sentences = tokenizeSentences(sanitized);
  const paragraphs = text.split('\n\n').map((p) => p.trim()).filter(Boolean);

  const wordCount = tokens.length;
  const unique = new Set(tokens).size;
  const sentenceCount = Math.max(sentences.length, 1);
  const avgLen = wordCount > 0 ? pyRound(wordCount / sentenceCount, 2) : 0;
  const ttr = pyRound(unique / Math.max(wordCount, 1), 3);
  const rootTtr = wordCount > 0 ? pyRound(unique / Math.sqrt(Math.max(wordCount, 1)), 2) : 0;

  const lower = sanitized.toLowerCase();
  const count = (set: Set<string>) => [...set].filter((term) => lower.includes(term)).length;
  const academic = count(ACADEMIC_STEM_TERMS) + count(ACADEMIC_HUMANITIES_TERMS) + count(ACADEMIC_DISCOURSE_MARKERS);
  const density = pyRound(academic / Math.max(wordCount / 100, 1), 2);

  const normTtr = Math.min(rootTtr / 8.0, 1.0);
  const normLen = Math.min(avgLen / 25.0, 1.0);
  const normAcad = Math.min(density / 5.0, 1.0);
  const complexity = pyRound(0.4 * normTtr + 0.3 * normLen + 0.3 * normAcad, 2);

  return {
    word_count: wordCount,
    unique_word_count: unique,
    sentence_count: sentenceCount,
    paragraph_count: Math.max(paragraphs.length, 1),
    avg_sentence_length: avgLen,
    ttr,
    root_ttr: rootTtr,
    academic_matches: academic,
    academic_density: density,
    complexity_score: complexity,
    language: detectLanguage(sanitized),
  };
}

export function findEvidenceSnippet(text: string, keywords: string[], categoryHint = '', maxWords = 45): string {
  const sentences = tokenizeSentences(text);
  if (sentences.length === 0) {
    return categoryHint
      ? `Học sinh thể hiện năng lực qua dự án ${categoryHint}.`
      : 'Minh chứng được xác thực từ nội dung bài nộp dự án của học sinh.';
  }
  let best = '';
  let bestScore = -1;
  for (const sent of sentences) {
    const lower = sent.toLowerCase();
    let score = 0;
    for (const kw of keywords) if (lower.includes(kw.toLowerCase())) score += 1;
    const n = pySplit(sent).length;
    if (n >= 8 && n <= 40) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = sent;
    }
  }
  if (bestScore <= 0 || !best) {
    // Giống Python: KHÔNG xóa câu tốt nhất trước đó; chỉ thay nếu có câu ≥ 6 từ
    for (const sent of sentences) {
      if (pySplit(sent).length >= 6) {
        best = sent;
        break;
      }
    }
    if (!best) best = sentences[0];
  }
  const words = pySplit(best);
  if (words.length > maxWords) return words.slice(0, maxWords).join(' ') + '...';
  return best.trim();
}
