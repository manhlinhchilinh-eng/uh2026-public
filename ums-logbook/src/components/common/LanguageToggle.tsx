import React from 'react';
import { useLanguage } from '../../hooks/useLanguage';

interface LanguageToggleProps {
  className?: string;
  /** 'dark' = dùng trên nền đậm (Header); 'light' = dùng trên nền sáng (LoginForm) */
  variant?: 'dark' | 'light';
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '', variant = 'dark' }) => {
  const { language, setLanguage, mode, setMode } = useLanguage();
  const isLight = variant === 'light';

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-full backdrop-blur-sm border ${
        isLight
          ? 'bg-white/95 border-slate-300 shadow-sm'
          : 'bg-black/20 border-white/20'
      } ${className}`}
      role="group"
      aria-label="Language selection"
      data-variant={variant}
    >
      <button
        type="button"
        onClick={() => setLanguage('vi')}
        className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
          language === 'vi'
            ? isLight
              ? 'bg-[#8B1A4A] text-white shadow-xs'
              : 'bg-white text-ums-800 shadow-sm'
            : isLight
              ? 'text-slate-700 hover:text-slate-950'
              : 'text-white/80 hover:text-white'
        }`}
        aria-pressed={language === 'vi'}
      >
        VI
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
          language === 'en'
            ? isLight
              ? 'bg-[#8B1A4A] text-white shadow-xs'
              : 'bg-white text-ums-800 shadow-sm'
            : isLight
              ? 'text-slate-700 hover:text-slate-950'
              : 'text-white/80 hover:text-white'
        }`}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
      {/* Song ngữ: ngôn ngữ đang chọn to, ngôn ngữ còn lại nhỏ bên dưới */}
      <button
        type="button"
        onClick={() => setMode(mode === 'dual' ? 'single' : 'dual')}
        className={`ml-0.5 px-2 py-1 text-[10px] font-bold rounded-full transition-all duration-200 ${
          mode === 'dual'
            ? isLight
              ? 'bg-amber-200 text-ums-900 shadow-xs'
              : 'bg-amber-300 text-ums-900 shadow-sm'
            : isLight
              ? 'text-slate-700 hover:text-slate-950'
              : 'text-white/80 hover:text-white'
        }`}
        aria-pressed={mode === 'dual'}
        title={mode === 'dual' ? 'Đang song ngữ — bấm để chỉ 1 ngôn ngữ · Bilingual on' : 'Bật song ngữ · Show both languages'}
        data-testid="bilingual-toggle"
      >
        {language === 'vi' ? 'VI+EN' : 'EN+VI'}
      </button>
    </div>
  );
};
