/**
 * Hiển thị song ngữ (minh chứng TC1 "web song ngữ" của chuẩn trường ESL).
 * - Chế độ 1 ngữ: chỉ hiện ngôn ngữ chính.
 * - Chế độ 2 ngữ: ngôn ngữ chính to, ngôn ngữ phụ nhỏ bên dưới; đảo VI↔EN bằng cách đổi ngôn ngữ chính.
 * Hàm thuần.
 */

export type Language = 'vi' | 'en';
export type LanguageMode = 'single' | 'dual';

export interface BiText {
  vi: string;
  en: string;
}

export interface BiParts {
  primary: string;
  /** null khi chế độ 1 ngữ hoặc 2 bản giống nhau / thiếu bản dịch */
  secondary: string | null;
}

export function pickBilingual(language: Language, mode: LanguageMode, text: BiText): BiParts {
  const primary = (language === 'en' ? text.en : text.vi) || text.vi || text.en;
  if (mode !== 'dual') return { primary, secondary: null };
  const other = language === 'en' ? text.vi : text.en;
  if (!other || other.trim().toLowerCase() === primary.trim().toLowerCase()) return { primary, secondary: null };
  return { primary, secondary: other };
}

/** Chuỗi phẳng (cho title, aria-label, tìm kiếm): "Sổ đầu bài · Logbook". */
export function flatBilingual(language: Language, mode: LanguageMode, text: BiText): string {
  const p = pickBilingual(language, mode, text);
  return p.secondary ? `${p.primary} · ${p.secondary}` : p.primary;
}

export const LANGUAGE_MODE_KEY = 'ums_language_mode';

export function parseLanguageMode(raw: string | null | undefined): LanguageMode {
  return raw === 'single' ? 'single' : 'dual';
}
