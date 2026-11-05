import React from 'react';

export type BrandAppSlug =
  | 'umsplus'
  | 'logbook'
  | 'practice'
  | 'grading'
  | 'eng9hub'
  | 'homeroom9'
  | 'eportfolio'
  | 'esl';

export const BRAND_APP_META: Record<
  BrandAppSlug,
  { titleVi: string; titleEn: string; squarePath: string; horizontalPath: string }
> = {
  umsplus: {
    titleVi: 'UMS+ SmartConnect',
    titleEn: 'Connected School Platform',
    squarePath: '/brand/logos/umsplus/logo.svg',
    horizontalPath: '/brand/logos/umsplus/logo-horizontal.svg',
  },
  logbook: {
    titleVi: 'Sổ Đầu Bài Điện Tử',
    titleEn: 'Digital Class Logbook',
    squarePath: '/brand/logos/logbook/logo.svg',
    horizontalPath: '/brand/logos/logbook/logo-horizontal.svg',
  },
  practice: {
    titleVi: 'Luyện Tập Anh 9',
    titleEn: 'Eng9 Practice Portal',
    squarePath: '/brand/logos/practice/logo.svg',
    horizontalPath: '/brand/logos/practice/logo-horizontal.svg',
  },
  grading: {
    titleVi: 'Chấm Thi OMR',
    titleEn: 'Eng9 OMR Grading',
    squarePath: '/brand/logos/grading/logo.svg',
    horizontalPath: '/brand/logos/grading/logo-horizontal.svg',
  },
  eng9hub: {
    titleVi: 'Sổ Điểm Anh 9',
    titleEn: 'Eng9 Gradebook Hub',
    squarePath: '/brand/logos/eng9hub/logo.svg',
    horizontalPath: '/brand/logos/eng9hub/logo-horizontal.svg',
  },
  homeroom9: {
    titleVi: 'Cổng Khảo Sát Khối 9',
    titleEn: 'Homeroom9 Survey Portal',
    squarePath: '/brand/logos/homeroom9/logo.svg',
    horizontalPath: '/brand/logos/homeroom9/logo-horizontal.svg',
  },
  eportfolio: {
    titleVi: 'Hồ Sơ Năng Lực Số',
    titleEn: 'Digital ePortfolio',
    squarePath: '/brand/logos/eportfolio/logo.svg',
    horizontalPath: '/brand/logos/eportfolio/logo-horizontal.svg',
  },
  esl: {
    titleVi: 'Dạy Học Bằng Tiếng Anh',
    titleEn: 'UMS Bilingual / ESL Program',
    squarePath: '/brand/logos/esl/logo.svg',
    horizontalPath: '/brand/logos/esl/logo-horizontal.svg',
  },
};

export interface BrandMarkProps {
  /** Tên phân hệ trong bộ 8 logo UMS+ */
  app: BrandAppSlug;
  /** 'square' = icon vuông (mặc định), 'horizontal' = icon + tên VI/EN */
  variant?: 'square' | 'horizontal';
  /** Kích thước chiều cao (px) */
  size?: number;
  className?: string;
  alt?: string;
  basePath?: string;
}

/**
 * Component hiển thị biểu tượng phân hệ UMS+ (không thay thế logo chính thức của trường UMS).
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  app,
  variant = 'square',
  size = 36,
  className = '',
  alt,
  basePath = '/brand/logos',
}) => {
  const meta = BRAND_APP_META[app] ?? BRAND_APP_META.umsplus;
  const src =
    variant === 'horizontal'
      ? `${basePath}/${app}/logo-horizontal.svg`
      : `${basePath}/${app}/logo.svg`;
  const computedAlt = alt ?? `${meta.titleVi} (${meta.titleEn})`;

  if (variant === 'horizontal') {
    const width = Math.round((size * 860) / 256);
    return (
      <img
        src={src}
        alt={computedAlt}
        width={width}
        height={size}
        data-testid={`brand-mark-${app}-horizontal`}
        className={`inline-block object-contain select-none ${className}`.trim()}
      />
    );
  }

  return (
    <img
      src={src}
      alt={computedAlt}
      width={size}
      height={size}
      data-testid={`brand-mark-${app}`}
      className={`inline-block rounded-xl object-contain select-none ${className}`.trim()}
    />
  );
};
