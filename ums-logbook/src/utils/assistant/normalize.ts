/**
 * Trợ lý UMS+ — chuẩn hóa câu hỏi (hàm thuần, chạy trong trình duyệt, không gọi mạng).
 * "Xin nghỉ ỐM???" → "xin nghi om".
 */

/** Từ đệm bỏ khi so khớp (đặc tả DAC_TA_TRO_LY mục 3.3). */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'lam', 'the', 'nao', 'o', 'dau', 'gi', 'cho', 'toi', 'minh', 'a', 'oi', 'voi', 'cua', 'la', 'co', 'khong', 'duoc',
  'how', 'do', 'i', 'where', 'is', 'my', 'can', 'to', 'the', 'an', 'what',
]);

/** Chữ thường, bỏ dấu tiếng Việt, đ → d, bỏ dấu câu, gộp khoảng trắng. */
export function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SynonymTable {
  /** [cụm không dấu, cụm gốc] — cụm dài trước để `thoi khoa bieu` thay trước `tkb`. */
  pairs: Array<[string, string]>;
}

/** Mỗi nhóm thay về từ đầu nhóm; từ đầu nhóm nhiều chữ được nối bằng "_" thành 1 từ khóa
 * ("so dau bai" → "so_dau_bai") để không bị tách và bỏ từ đệm ("dau"). */
export function buildSynonyms(groups: string[][]): SynonymTable {
  const pairs: Array<[string, string]> = [];
  for (const g of groups) {
    const canon = normalize(g[0]).replace(/ /g, '_');
    for (const term of g) {
      const t = normalize(term);
      if (t) pairs.push([t, canon]);
    }
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return { pairs };
}

/** Cụm đã chuẩn hóa chỉ còn [a-z0-9 ] nên không cần thoát ký tự regex; vẫn lọc phòng hờ. */
const escapeRe = (s: string) => s.replace(/[^a-z0-9 ]/g, '');
const reCache = new WeakMap<SynonymTable, { re: RegExp; map: Map<string, string> }>();

/** Thay từ đồng nghĩa theo ranh giới từ, MỘT lượt (cụm dài trước, không thay chồng lên nhau). */
export function applySynonyms(normalized: string, table: SynonymTable): string {
  if (!table.pairs.length) return normalized;
  let c = reCache.get(table);
  if (!c) {
    c = {
      re: new RegExp(`(?<![a-z0-9_])(${table.pairs.map(([t]) => escapeRe(t)).join('|')})(?![a-z0-9_])`, 'g'),
      map: new Map(table.pairs),
    };
    reCache.set(table, c);
  }
  const { re, map } = c;
  return normalized.replace(re, (m) => map.get(m) ?? m);
}

/** Tập từ có nghĩa (đã bỏ từ đệm). */
export function tokens(s: string): Set<string> {
  return new Set(s.split(' ').filter((w) => w && !STOP_WORDS.has(w)));
}
