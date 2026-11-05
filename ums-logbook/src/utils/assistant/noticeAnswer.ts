/**
 * Trợ lý UMS+ — trả lời theo văn bản/thông báo (offline, không AI ngoài).
 * Chỉ trả lời những gì đọc được trong văn bản: đếm dòng danh sách, lớp có trong danh sách không, ngày/giờ.
 * Luôn kèm câu trích nguyên văn (≤ 3 dòng); không chắc → gợi ý mở văn bản (links) hoặc none.
 * Hàm thuần, có test: __tests__/noticeAnswer.test.ts
 */
import type { KnowledgeDoc } from './knowledgeDocs';
import { applySynonyms, buildSynonyms, normalize, tokens } from './normalize';
import { hasPhrase, parseClass } from './entities';
import { listSections, listSuffix, numbersIn, proseSentences, sectionLabels } from './docSections';

export { splitSections, type Section } from './docSections';

export type DocIntent = 'count' | 'membership' | 'when' | 'what';

export const DOC_ANSWER_MIN = 0.5;
export const DOC_SUGGEST_MIN = 0.3;
const MAX_QUOTES = 3;
const MAX_LINKS = 3;

export interface DocAskContext { ownClassId?: string | null; askedClassId?: string | null }
export type DocAnswer =
  | { kind: 'answer'; doc: KnowledgeDoc; intent: DocIntent; textVi: string; textEn: string; quotes: string[] }
  | { kind: 'links'; docs: KnowledgeDoc[] }
  | { kind: 'ask_class'; doc: KnowledgeDoc }
  | { kind: 'none' };

/* ---------------- Mã lớp ---------------- */

const CLASS_CODE = /\b[6-9]A\d{1,2}\b/g;
const HAS_CLASS_CODE = /\b[6-9]A\d{1,2}\b/;
/** Dòng có tên người: "HS A (6A3) – …" (mục con, có "(lớp)"). */
const NAME_LINE = /^\d+\.\s*[^()]+\(\s*[6-9]A\d{1,2}\s*\)/;

/* ---------------- Ý định câu hỏi ---------------- */

const WHEN_CUES = ['ngay nao', 'khi nao', 'bao gio', 'luc nao', 'may gio', 'hom nao', 'thoi gian', 'when', 'what time', 'what date'];
const COUNT_CUES = ['bao nhieu', 'so luong', 'how many'];
/** "mấy" chỉ tính là hỏi số khi đi với danh từ đếm được ("máy chiếu" cũng thành "may" sau khi bỏ dấu). */
const MAY_COUNT = /(?:^|\s)may (?:lop|ban|hoc sinh|hs|em|tiet muc|tiet|tap the|ca nhan|nhom|nguoi|doi|giai|ngay|mon|bai|cau|giao vien|gv|thay co|co giao|thay|lan|buoi|phong|doan)(?=\s|$)/;
const OWN_CLASS_CUES = ['lop toi', 'lop minh', 'lop em', 'lop con', 'lop cua toi', 'lop cua con', 'my class', 'our class'];

export function detectIntent(norm: string): DocIntent {
  if (WHEN_CUES.some((c) => hasPhrase(norm, c))) return 'when';
  if (COUNT_CUES.some((c) => hasPhrase(norm, c)) || MAY_COUNT.test(norm)) return 'count';
  if (OWN_CLASS_CUES.some((c) => hasPhrase(norm, c)) || parseClass(norm)) return 'membership';
  return 'what';
}

const NEWS_CUES = ['thong bao', 'van ban', 'ke hoach', 'lich', 'chung ket', 'cuoc thi'];
export function looksLikeNewsQuestion(norm: string): boolean {
  return NEWS_CUES.some((c) => hasPhrase(norm, c)) || /(?:^|\s)(?:so\s)?\d+\s?tb(?:\s|$)/.test(norm);
}

/* ---------------- Chấm điểm văn bản ---------------- */

/** Từ chỉ loại câu hỏi, không nói lên chủ đề → bỏ khi chấm điểm. */
const QUESTION_WORDS = new Set([
  'bao', 'nhieu', 'may', 'so', 'luong', 'ngay', 'khi', 'gio', 'luc', 'lop', 'thoi', 'gian', 'hom', 'nay', 'em', 'con',
  'how', 'many', 'when', 'date', 'time', 'class', 'in', 'our',
]);
const DOC_SYNONYMS = buildSynonyms([
  ['got talent', 'gottalent'],
  ['giua ki', 'giua ky', 'giua hoc ki', 'giua hoc ky', 'giu hoc ki'],
]);
const TITLE_WEIGHT = 1;
/** Chỉ khớp phần thân tối đa 0.4 < DOC_ANSWER_MIN → không bao giờ tự trả lời khi tiêu đề không khớp. */
const BODY_WEIGHT = 0.4;

const prep = (s: string) => applySynonyms(normalize(s), DOC_SYNONYMS);
const prepNorm = (norm: string) => applySynonyms(norm, DOC_SYNONYMS);

interface PreparedDoc { head: string; body: string }
const prepCache = new WeakMap<KnowledgeDoc, PreparedDoc>();
function prepared(doc: KnowledgeDoc): PreparedDoc {
  let p = prepCache.get(doc);
  if (!p) {
    p = { head: ` ${prep(`${doc.title} ${doc.docNumber || ''}`)} `, body: ` ${prep(doc.text)} ` };
    prepCache.set(doc, p);
  }
  return p;
}

/** Cụm mở đầu câu hỏi ("tôi muốn biết…", "cho hỏi…") — không nói lên chủ đề. */
const QUESTION_PHRASES = /(^|\s)(?:muon biet|cho hoi|xin hoi|cho biet)(?=\s|$)/g;

/** Từ chủ đề của câu hỏi (bỏ từ đệm, từ hỏi, mã lớp), giữ thứ tự để ghép cặp liền nhau. */
function topicWords(norm: string): string[] {
  const q = prepNorm(norm).replace(QUESTION_PHRASES, ' ');
  return [...tokens(q)].filter((w) => !QUESTION_WORDS.has(w) && !/^[6-9]a\d{1,2}$/.test(w));
}

function weight(p: PreparedDoc, phrase: string): number {
  const k = ` ${phrase} `;
  return p.head.includes(k) ? TITLE_WEIGHT : p.body.includes(k) ? BODY_WEIGHT : 0;
}

/** 0..1: trung bình điểm từ đơn và điểm cặp từ liền nhau (cặp chặn trùng 1 từ lẻ, vd "giá" ~ "đánh giá"). */
export function scoreDoc(norm: string, doc: KnowledgeDoc): number {
  const words = topicWords(norm);
  if (!words.length) return 0;
  const p = prepared(doc);
  const uni = words.reduce((s, w) => s + weight(p, w), 0) / words.length;
  if (words.length < 2) return uni;
  const pairs = words.slice(1).map((w, i) => `${words[i]} ${w}`);
  const bi = pairs.reduce((s, w) => s + weight(p, w), 0) / pairs.length;
  return (uni + bi) / 2;
}

/* ---------------- Trích câu ---------------- */

function overlap(sentence: string, words: string[]): number {
  const t = ` ${prep(sentence)} `;
  return words.filter((w) => t.includes(` ${w} `)).length;
}

/* ---------------- Trả lời ---------------- */

const sameCounts = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort((x, y) => x - y).every((n, i) => n === [...b].sort((x, y) => x - y)[i]);

/** Số trong câu ứng với tổng: đúng bằng tổng nếu có; không thì số gần tổng nhất, bỏ các số trùng số dòng từng mục. */
function statedTotalOf(nums: number[], total: number, counts: number[]): number {
  if (nums.includes(total)) return total;
  const pool = counts.length > 1 ? nums.filter((n) => !counts.includes(n)) : nums;
  return (pool.length ? pool : nums).reduce((a, b) => (Math.abs(b - total) < Math.abs(a - total) ? b : a));
}

function answerCount(doc: KnowledgeDoc, words: string[]): DocAnswer {
  const secs = listSections(doc.text);
  const counts = secs.map((s) => s.lines.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const listed = new Set([total, ...counts]);
  // Số có trong tiêu đề là số hiệu ("mùa 5", "tuần 45"), không phải số lượng → bỏ.
  const titleNums = new Set(numbersIn(doc.title));
  // Câu khớp chủ đề câu hỏi nhất đứng đầu; số khớp danh sách chỉ để phân hạng khi bằng nhau.
  const stated = proseSentences(doc.text)
    .map((s) => ({ s, nums: numbersIn(s).filter((n) => !titleNums.has(n)), ov: overlap(s, words) }))
    .filter((c) => c.nums.length && c.ov > 0)
    .map((c) => ({ ...c, rel: c.nums.filter((n) => listed.has(n)).length }))
    .sort((a, b) => b.ov - a.ov || b.rel - a.rel)[0];

  // Không có câu nêu số → không tự đếm (mọi câu trả lời phải có trích nguyên văn).
  if (!stated) return { kind: 'links', docs: [doc] };
  const quotes = [stated.s];
  // Câu nêu số không liên quan danh sách (vd "19 tập thể … tham gia") → chỉ trích câu, không dùng số dòng.
  if (!secs.length || stated.rel === 0) {
    return {
      kind: 'answer', doc, intent: 'count', quotes,
      textVi: `Theo *${doc.title}*: ${stated.s}`,
      textEn: `According to "${doc.title}" (quoted below).`,
    };
  }
  const statedTotal = statedTotalOf(stated.nums, total, counts);
  const paren = numbersIn(stated.s.match(/\(([^)]*)\)/)?.[1] || '');
  const subMismatch = counts.length > 1 && paren.length > 1 && !sameCounts(paren, counts);
  if (statedTotal !== total || subMismatch) {
    const sv = subMismatch ? `${statedTotal} (${paren.join(', ')})` : `${statedTotal}`;
    const lv = subMismatch ? `${total} dòng (${counts.join(', ')})` : `${total} dòng`;
    const le = subMismatch ? `${total} lines (${counts.join(', ')})` : `${total} lines`;
    return {
      kind: 'answer', doc, intent: 'count', quotes,
      textVi: `Văn bản ghi ${sv}; danh sách liệt kê ${lv} — vui lòng xem văn bản.`,
      textEn: `The document states ${sv}; the list has ${le} — please check the document.`,
    };
  }
  const { noun, labels } = sectionLabels(secs);
  const parts = labels.length ? ` (${counts.map((n, i) => `${n} ${labels[i]}`).join(', ')})` : '';
  const partsEn = counts.length > 1 ? ` (${counts.join(' + ')})` : '';
  const suffix = listSuffix(doc.text, noun);
  return {
    kind: 'answer', doc, intent: 'count', quotes,
    textVi: `Theo *${doc.title}*: ${total} ${noun}${suffix ? ` ${suffix}` : ''}${parts}.`,
    textEn: `According to "${doc.title}": ${total} listed${partsEn}.`,
  };
}

function lineHasClass(line: string, classId: string): boolean {
  return (line.match(CLASS_CODE) ?? ([] as string[])).includes(classId);
}

function answerMembership(doc: KnowledgeDoc, classId: string, ownClassId: string | null): DocAnswer {
  const secs = listSections(doc.text);
  // Danh sách không có mã lớp nào (vd "I. MỤC ĐÍCH") → không kết luận "không có", chỉ gợi ý mở văn bản.
  if (!secs.some((s) => s.lines.some((l) => HAS_CLASS_CODE.test(l)))) return { kind: 'links', docs: [doc] };
  const vi: string[] = [];
  const en: string[] = [];
  const quotes: string[] = [];
  for (const s of secs) {
    const hit = s.lines.filter((l) => lineHasClass(l, classId));
    vi.push(`${s.heading}: ${hit.length || 'không có'}`);
    en.push(`${s.heading}: ${hit.length || 'none'}`);
    // Dòng có tên HS chỉ hiện cho chính lớp của người hỏi; lớp khác chỉ đếm.
    for (const l of hit) if (!NAME_LINE.test(l) || classId === ownClassId) quotes.push(l);
  }
  return {
    kind: 'answer', doc, intent: 'membership', quotes: quotes.slice(0, MAX_QUOTES),
    textVi: `Theo *${doc.title}*, lớp ${classId}: ${vi.join('; ')}.`,
    textEn: `According to "${doc.title}", class ${classId}: ${en.join('; ')}.`,
  };
}

const DATE_RE = /\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/g;
const HOUR_RE = /\b\d{1,2}h(?:\d{2})?\b/g;

function answerWhen(doc: KnowledgeDoc, words: string[]): DocAnswer {
  const best = proseSentences(doc.text)
    .map((s) => ({ s, when: [...(s.match(DATE_RE) || []), ...(s.match(HOUR_RE) || [])], ov: overlap(s, words) }))
    // Câu có ngày nhưng không khớp chủ đề (vd "Hà Nội, ngày 02/11/2026") → không trả lời, chỉ gợi ý mở văn bản.
    .filter((c) => c.when.length && c.ov > 0)
    .sort((a, b) => b.ov - a.ov)[0];
  if (!best) return { kind: 'links', docs: [doc] };
  const when = best.when.join(', ');
  return {
    kind: 'answer', doc, intent: 'when', quotes: [best.s],
    textVi: `Theo *${doc.title}*: ${when}.`,
    textEn: `According to "${doc.title}": ${when}.`,
  };
}

function answerWhat(doc: KnowledgeDoc, words: string[]): DocAnswer {
  const quotes = proseSentences(doc.text)
    .map((s) => ({ s, ov: overlap(s, words) }))
    .filter((c) => c.ov > 0)
    .sort((a, b) => b.ov - a.ov)
    .slice(0, MAX_QUOTES)
    .map((c) => c.s);
  return {
    kind: 'answer', doc, intent: 'what', quotes,
    textVi: `Văn bản liên quan: *${doc.title}*.`,
    textEn: `Related document: "${doc.title}".`,
  };
}

export function answerFromDocs(query: string, docs: KnowledgeDoc[], ctx: DocAskContext): DocAnswer {
  const norm = normalize(query);
  const ranked = docs
    .map((doc) => ({ doc, score: scoreDoc(norm, doc) }))
    .filter((r) => r.score >= DOC_SUGGEST_MIN)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { kind: 'none' };
  if (ranked[0].score < DOC_ANSWER_MIN) return { kind: 'links', docs: ranked.slice(0, MAX_LINKS).map((r) => r.doc) };

  const doc = ranked[0].doc;
  const words = topicWords(norm);
  switch (detectIntent(norm)) {
    case 'count': {
      // "Lớp 6A3 / lớp tôi có bao nhiêu tiết mục" → đếm riêng lớp đó theo từng mục, không lấy tổng cả văn bản.
      const ownCue = OWN_CLASS_CUES.some((c) => hasPhrase(norm, c));
      const classId = ctx.askedClassId ?? parseClass(norm) ?? (ownCue ? ctx.ownClassId ?? null : null);
      if (classId) return answerMembership(doc, classId, ctx.ownClassId ?? null);
      return ownCue ? { kind: 'ask_class', doc } : answerCount(doc, words);
    }
    case 'membership': {
      const classId = ctx.askedClassId ?? parseClass(norm) ?? ctx.ownClassId ?? null;
      return classId ? answerMembership(doc, classId, ctx.ownClassId ?? null) : { kind: 'ask_class', doc };
    }
    case 'when':
      return answerWhen(doc, words);
    default:
      return answerWhat(doc, words);
  }
}
