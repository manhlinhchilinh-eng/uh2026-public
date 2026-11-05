import React from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { pickBilingual, type BiText } from '../../utils/bilingual';

interface BiProps extends BiText {
  /** stack = chữ phụ xuống dòng (mặc định); inline = cùng dòng, ngăn bằng "·" */
  layout?: 'stack' | 'inline';
  /** Cho phép xuống dòng tự nhiên thay vì cắt chữ (...) ở thẻ nội dung */
  wrap?: boolean;
  className?: string;
  secondaryClassName?: string;
}

/**
 * Nhãn song ngữ: ngôn ngữ chính cỡ thường, ngôn ngữ phụ nhỏ & nhạt.
 * Dùng cho nhãn giao diện (menu, tiêu đề, nút) — không dùng cho dữ liệu người dùng nhập.
 */
export const Bi: React.FC<BiProps> = ({
  vi,
  en,
  layout = 'stack',
  wrap = false,
  className = '',
  secondaryClassName = '',
}) => {
  const ctx = useLanguage();
  const language = ctx?.language || 'vi';
  const mode = ctx?.mode || 'dual';
  const { primary, secondary } = typeof ctx?.bi === 'function' ? ctx.bi({ vi, en }) : pickBilingual(language, mode, { vi, en });
  if (!secondary) return <span className={className}>{primary}</span>;
  const otherLang = language === 'vi' ? 'en' : 'vi';
  if (layout === 'inline') {
    return (
      <span className={className}>
        <span>{primary}</span>
        <span lang={otherLang} aria-hidden="true" className={`ml-1.5 text-[0.78em] font-normal opacity-60 ${secondaryClassName}`}>
          · {secondary}
        </span>
      </span>
    );
  }
  const textFlow = wrap ? 'break-words' : 'truncate';
  return (
    <span className={`inline-flex flex-col leading-tight min-w-0 max-w-full ${className}`}>
      <span className={textFlow}>{primary}</span>
      <span lang={otherLang} aria-hidden="true" className={`${textFlow} text-[0.72em] font-normal opacity-60 ${secondaryClassName}`}>
        {secondary}
      </span>
    </span>
  );
};
