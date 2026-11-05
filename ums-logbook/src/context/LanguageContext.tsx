import React, { createContext, useContext, useState, useEffect } from 'react';
import { vi } from '../i18n/vi';
import { en } from '../i18n/en';
import { TranslationSchema } from '../i18n/types';
import { LANGUAGE_MODE_KEY, parseLanguageMode, pickBilingual, type BiParts, type BiText, type Language, type LanguageMode } from '../utils/bilingual';

export type { Language, LanguageMode };

export interface LanguageContextType {
  language: Language;
  t: TranslationSchema;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  /** 'dual' = song ngữ: ngôn ngữ chính to, ngôn ngữ còn lại nhỏ bên dưới */
  mode: LanguageMode;
  setMode: (mode: LanguageMode) => void;
  /** Tách 1 cặp VI/EN thành chữ chính + chữ phụ theo chế độ hiện tại */
  bi: (text: BiText) => BiParts;
}

const translations: Record<Language, TranslationSchema> = { vi, en };

const defaultLanguageContext: LanguageContextType = {
  language: 'vi',
  t: vi,
  setLanguage: () => {},
  toggleLanguage: () => {},
  mode: 'dual',
  setMode: () => {},
  bi: (text: BiText) => pickBilingual('vi', 'dual', text),
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('ums_language') as Language;
    return saved === 'en' ? 'en' : 'vi'; // Default VI
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('ums_language', lang);
    document.documentElement.lang = lang;
  };

  const [mode, setModeState] = useState<LanguageMode>(() => {
    try {
      return parseLanguageMode(localStorage.getItem(LANGUAGE_MODE_KEY));
    } catch {
      return 'dual';
    }
  });

  const setMode = (next: LanguageMode) => {
    setModeState(next);
    try {
      localStorage.setItem(LANGUAGE_MODE_KEY, next);
    } catch {
      /* chế độ duyệt riêng tư: chỉ nhớ trong phiên */
    }
  };

  const bi = (text: BiText) => pickBilingual(language, mode, text);

  const toggleLanguage = () => {
    const nextLang: Language = language === 'vi' ? 'en' : 'vi';
    setLanguage(nextLang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, t: translations[language], setLanguage, toggleLanguage, mode, setMode, bi }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  return context ?? defaultLanguageContext;
};
