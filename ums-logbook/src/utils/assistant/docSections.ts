/**
 * Trợ lý UMS+ — tách văn bản thành mục/danh sách và câu (hàm thuần, dùng cho noticeAnswer.ts).
 * Heading: dòng "I./II./III." hoặc toàn chữ in hoa ≥ 3 từ; dòng "\d+." là mục con của heading gần nhất.
 * Có test qua __tests__/noticeAnswer.test.ts.
 */

export interface Section { heading: string; lines: string[] }

const ROMAN_HEADING = /^(?:[IVX]{1,4})\.\s+\S/;
const LIST_ITEM = /^\d+\.\s+\S/;

function isAllCapsHeading(line: string): boolean {
  if (!/\p{L}/u.test(line) || line !== line.toUpperCase() || line === line.toLowerCase()) return false;
  return line.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length >= 3;
}

/** Heading: dòng "I./II./III." hoặc toàn chữ in hoa ≥ 3 từ. Dòng "\d+." là mục con của heading gần nhất. */
export function splitSections(text: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (LIST_ITEM.test(line)) {
      if (!cur) out.push((cur = { heading: '', lines: [] }));
      cur.lines.push(line);
    } else if (ROMAN_HEADING.test(line) || isAllCapsHeading(line)) {
      out.push((cur = { heading: line, lines: [] }));
    }
  }
  return out;
}

/** Mục có ít nhất 1 dòng danh sách (heading trống như "DANH SÁCH …" không tính). */
export const listSections = (text: string) => splitSections(text).filter((s) => s.lines.length > 0);

/** Các câu (không phải heading, không phải mục danh sách) của văn bản. */
export function proseSentences(text: string): string[] {
  const out: string[] = [];
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || LIST_ITEM.test(line) || ROMAN_HEADING.test(line) || isAllCapsHeading(line)) continue;
    for (const s of line.split(/(?<=[.!?])\s+(?=\p{Lu})/u)) if (s.trim()) out.push(s.trim());
  }
  return out;
}

/** Số nguyên đứng riêng (bỏ phần của ngày "13/11/2026"). */
export const numbersIn = (s: string) => (s.match(/(?<![\d/])\d+(?![\d/])/g) || []).map(Number);

function stripHeading(h: string): string {
  return h.replace(/^[IVX]{1,4}\.\s+/, '').toLowerCase().replace(/^(?:(?:danh sách|các|những)\s+)+/, '').trim();
}

/** "các tiết mục tập thể" + "các tiết mục cá nhân/nhóm" → danh từ chung "tiết mục", nhãn "tập thể", "cá nhân/nhóm". */
export function sectionLabels(secs: Section[]): { noun: string; labels: string[] } {
  const words = secs.map((s) => stripHeading(s.heading).split(/\s+/).filter(Boolean));
  if (words.length < 2) return { noun: words[0]?.join(' ') || 'mục', labels: [] };
  let k = 0;
  while (words.every((w) => w.length > k + 1 && w[k] === words[0][k])) k++;
  return { noun: k ? words[0].slice(0, k).join(' ') : 'mục', labels: words.map((w) => w.slice(k).join(' ')) };
}

/** Đuôi tên danh sách từ heading trống ngay trước mục đầu tiên:
 * "DANH SÁCH CÁC TIẾT MỤC VÀO VÒNG CHUNG KẾT" + danh từ "tiết mục" → "vào vòng chung kết". */
export function listSuffix(text: string, noun: string): string {
  const all = splitSections(text);
  const first = all.findIndex((s) => s.lines.length > 0);
  const prev = first > 0 ? all[first - 1] : null;
  if (!prev || prev.lines.length) return '';
  const t = stripHeading(prev.heading);
  return t.startsWith(`${noun} `) ? t.slice(noun.length + 1).replace(/[.!:]+$/, '') : '';
}
