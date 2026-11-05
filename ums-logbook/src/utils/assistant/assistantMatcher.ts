/**
 * Trợ lý UMS+ — so khớp câu hỏi với bộ câu hỏi nhà trường đã duyệt (đặc tả DAC_TA_TRO_LY mục 3, 5).
 * Hàm thuần: mọi quyết định (trả lời / liên hệ / gợi ý / chưa có / vai trò khác) nằm ở đây để test;
 * giao diện chỉ hiển thị. Không gọi mạng, không đọc Firestore, không bịa câu trả lời.
 */
import type { UserRole } from '../../types/auth';
import { applySynonyms, buildSynonyms, normalize, tokens, type SynonymTable } from './normalize';

export const ANSWER_MIN = 0.55;
export const SUGGEST_MIN = 0.35;
const KEYWORD_BONUS = 0.15;
const KEYWORD_BONUS_MAX = 0.3;
const MAX_SUGGESTIONS = 3;
const OTHER_ROLE_MARGIN = 0.1;
export const FALLBACK_DEPARTMENT = 'vanphong';

export type AssistantRole = UserRole | 'guest';
export interface BiStr { vi: string; en: string }

export interface FaqAction {
  path?: string;
  url?: string;
  label: BiStr;
  roles?: string[];
}

export interface FaqItem {
  id: string;
  type: 'howto' | 'contact';
  status: 'da_duyet' | 'cho_duyet' | 'cho_van_phong';
  roles: string[];
  question: BiStr;
  variants?: string[];
  keywords?: string[];
  steps?: BiStr[];
  answer?: BiStr | null;
  tip?: BiStr;
  action?: FaqAction | null;
  department?: string | null;
  department_family?: string;
  escalate?: string[];
  topic?: string;
}

export interface Department {
  id: string;
  name: BiStr;
  scope_vi?: string;
  keywords?: string[];
}

export interface FaqData {
  schema_version: number;
  role_groups: Record<string, string[]>;
  role_labels: Record<string, BiStr>;
  departments: Department[];
  synonyms: string[][];
  items: FaqItem[];
  topics?: Record<string, BiStr>;
  quick_suggestions?: Record<string, string[]>;
}

export type AssistantKind = 'answer' | 'contact' | 'suggest' | 'none' | 'other_role' | 'login_required';

export interface AssistantResult {
  kind: AssistantKind;
  score: number;
  item?: FaqItem;
  suggestions?: FaqItem[];
  department?: Department;
  /** Hiện nút "Mở chức năng" hay không. */
  actionAllowed: boolean;
  /** Với `other_role`: vai trò làm được việc này (để ghi "Việc này do … làm"). */
  ownerRoles?: string[];
}

export interface MatchOptions {
  role: AssistantRole;
  /** Bản dev dùng thêm câu `cho_duyet` (gắn nhãn Nháp). Bản thật: false. */
  includeDrafts: boolean;
  /** Route vai trò này mở được (cùng nguồn với menu). Không truyền = không hiện nút route nội bộ. */
  allowedPaths?: ReadonlySet<string>;
}

interface Compiled {
  item: FaqItem;
  patterns: Array<{ norm: string; toks: Set<string> }>;
  keywords: string[];
  roles: Set<string>;
  specific: boolean;
}

export interface FaqIndex {
  data: FaqData;
  syn: SynonymTable;
  compiled: Compiled[];
  departments: Map<string, Department>;
  deptKeywords: Array<{ dept: Department; kw: string }>;
}

export function expandRoles(roles: string[], groups: Record<string, string[]>): Set<string> {
  const out = new Set<string>();
  for (const r of roles) (groups[r] || [r]).forEach((x) => out.add(x));
  return out;
}

const prep = (s: string, syn: SynonymTable) => applySynonyms(normalize(s), syn);

export function buildIndex(data: FaqData): FaqIndex {
  const syn = buildSynonyms(data.synonyms || []);
  const compiled: Compiled[] = data.items.map((item) => {
    const texts = [item.question.vi, item.question.en, ...(item.variants || [])].filter(Boolean);
    const patterns = texts.map((t) => {
      const norm = prep(t, syn);
      return { norm: [...tokens(norm)].join(' '), toks: tokens(norm) };
    });
    return {
      item,
      patterns,
      // Từ khóa trùng nhau sau khi thay đồng nghĩa (xin nghi / nghi om / don nghi → nghi_om) chỉ tính 1 lần.
      keywords: [...new Set((item.keywords || []).map((k) => prep(k, syn)).filter(Boolean))],
      roles: expandRoles(item.roles, data.role_groups),
      specific: !item.roles.includes('@all'),
    };
  });
  const departments = new Map(data.departments.map((d) => [d.id, d]));
  const deptKeywords = data.departments
    .flatMap((dept) => (dept.keywords || []).map((k) => ({ dept, kw: prep(k, syn) })))
    .filter((x) => x.kw)
    .sort((a, b) => b.kw.length - a.kw.length);
  return { data, syn, compiled, departments, deptKeywords };
}

function scoreItem(c: Compiled, qToks: Set<string>, qPadded: string): number {
  if (qToks.size === 0) return 0;
  const qKey = [...qToks].join(' ');
  let best = 0;
  for (const p of c.patterns) {
    if (p.toks.size === 0) continue;
    if (p.norm === qKey) { best = Math.max(best, 1); continue; }
    let inP = 0;
    qToks.forEach((w) => { if (p.toks.has(w)) inP++; });
    let inQ = 0;
    p.toks.forEach((w) => { if (qToks.has(w)) inQ++; });
    let s = 0.6 * (inP / qToks.size) + 0.4 * (inQ / p.toks.size);
    // Chỉ trùng dưới nửa số từ người hỏi (vd. chung 1 từ "truong") → không đủ để gợi ý.
    if (inP / qToks.size < 0.5) s = Math.min(s, SUGGEST_MIN - 0.01);
    if (s > best) best = s;
  }
  let bonus = 0;
  for (const k of c.keywords) if (qPadded.includes(` ${k} `)) bonus += KEYWORD_BONUS;
  // Không chặn ở 1.0 để xếp hạng phân biệt được (vd. "duyệt đơn nghỉ" ≠ "xin nghỉ"); hiển thị thì chặn.
  return best + Math.min(bonus, KEYWORD_BONUS_MAX);
}

const basePath = (p: string) => p.split('?')[0].split('#')[0];

export function isActionAllowed(item: FaqItem, opts: MatchOptions, groups: Record<string, string[]>): boolean {
  const a = item.action;
  if (!a) return false;
  if (a.url) return true; // trang ngoài công khai (tuyển sinh, đồng phục…) — hiện cả cho khách
  if (!a.path || opts.role === 'guest') return false;
  if (a.roles && !expandRoles(a.roles, groups).has(opts.role)) return false;
  return !!opts.allowedPaths?.has(basePath(a.path));
}

/** Bộ phận gần nhất theo từ khóa trong câu hỏi; không có thì Văn phòng. */
export function guessDepartment(index: FaqIndex, qPadded: string): Department | undefined {
  const hit = index.deptKeywords.find((d) => qPadded.includes(` ${d.kw} `));
  return hit?.dept || index.departments.get(FALLBACK_DEPARTMENT);
}

const isFamily = (role: AssistantRole) => role === 'parent' || role === 'student';

export function match(index: FaqIndex, query: string, opts: MatchOptions): AssistantResult {
  const qNorm = prep(query, index.syn);
  const qToks = tokens(qNorm);
  const qPadded = ` ${qNorm} `;
  const none = (): AssistantResult => ({ kind: 'none', score: 0, actionAllowed: false, department: guessDepartment(index, qPadded) });
  if (!qToks.size) return { kind: 'none', score: 0, actionAllowed: false };

  const usable = index.compiled.filter(
    (c) => c.item.status === 'da_duyet' || c.item.status === 'cho_van_phong' || (opts.includeDrafts && c.item.status === 'cho_duyet')
  );
  const scored = usable
    .map((c) => ({ c, s: scoreItem(c, qToks, qPadded), mine: c.roles.has(opts.role) }))
    .filter((x) => x.s > 0)
    .sort(
      (a, b) =>
        b.s - a.s ||
        Number(b.c.specific) - Number(a.c.specific) ||
        Number(a.c.item.type === 'contact') - Number(b.c.item.type === 'contact')
    );

  const mine = scored.filter((x) => x.mine);
  const bestMine = mine[0];
  const bestAny = scored[0];

  // Câu khớp rõ hơn thuộc vai trò khác (vd. GV bộ môn hỏi "duyệt đơn nghỉ") → chỉ nói ai làm, không trả câu gần đúng của mình.
  if (bestAny && !bestAny.mine && bestAny.s >= ANSWER_MIN && bestAny.s > (bestMine?.s ?? 0) + OTHER_ROLE_MARGIN) {
    if (opts.role === 'guest') return { kind: 'login_required', score: bestAny.s, actionAllowed: false };
    return {
      kind: 'other_role',
      score: bestAny.s,
      item: bestAny.c.item,
      ownerRoles: [...bestAny.c.roles].filter((r) => r !== 'guest'),
      actionAllowed: false,
    };
  }

  if (bestMine && bestMine.s >= ANSWER_MIN) {
    const item = bestMine.c.item;
    if (item.status === 'cho_van_phong') return { ...none(), score: bestMine.s };
    if (item.type === 'contact') {
      const deptId = (isFamily(opts.role) && item.department_family) || item.department || FALLBACK_DEPARTMENT;
      return {
        kind: 'contact',
        score: bestMine.s,
        item,
        department: index.departments.get(deptId) || index.departments.get(FALLBACK_DEPARTMENT),
        actionAllowed: isActionAllowed(item, opts, index.data.role_groups),
      };
    }
    return { kind: 'answer', score: bestMine.s, item, actionAllowed: isActionAllowed(item, opts, index.data.role_groups) };
  }

  if (bestMine && bestMine.s >= SUGGEST_MIN) {
    const suggestions = mine
      .filter((x) => x.s >= SUGGEST_MIN && x.c.item.status !== 'cho_van_phong')
      .slice(0, MAX_SUGGESTIONS)
      .map((x) => x.c.item);
    if (suggestions.length) return { kind: 'suggest', score: bestMine.s, suggestions, actionAllowed: false };
  }

  return { ...none(), score: bestMine?.s ?? 0 };
}

/** Chip gợi ý nhanh theo vai trò — chỉ giữ câu đúng vai trò và đúng trạng thái. */
export function quickSuggestions(index: FaqIndex, role: AssistantRole, includeDrafts: boolean): FaqItem[] {
  const ids = index.data.quick_suggestions?.[role] || [];
  return ids
    .map((id) => index.compiled.find((c) => c.item.id === id))
    .filter((c): c is Compiled => !!c && c.roles.has(role) && (c.item.status === 'da_duyet' || (includeDrafts && c.item.status === 'cho_duyet')))
    .map((c) => c.item);
}

/** Bộ phận chuyển tiếp — chỉ hiện sau khi người dùng bấm "Chưa đúng". */
export function escalateDepartments(index: FaqIndex, item: FaqItem | undefined): Department[] {
  const ids = item?.escalate?.length ? item.escalate : [FALLBACK_DEPARTMENT];
  return ids.map((id) => index.departments.get(id)).filter((d): d is Department => !!d);
}
