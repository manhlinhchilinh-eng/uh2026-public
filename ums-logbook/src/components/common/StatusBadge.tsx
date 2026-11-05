import React from 'react';
import { UserRole } from '../../types/auth';

export type BadgeVariant =
  | UserRole
  | 'present'
  | 'absentP'
  | 'absentK'
  | 'late'
  | 'early'
  | 'positive'
  | 'negative'
  | 'neutral';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  size = 'sm',
  className = '',
}) => {
  const getBadgeConfig = () => {
    switch (variant) {
      case 'admin':
        return {
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          defaultLabel: 'Quản trị viên',
        };
      case 'gvcn':
        return {
          bg: 'bg-ums-100 text-ums-900 border-ums-200 font-semibold',
          defaultLabel: 'GVCN',
        };
      case 'gvbm':
        return {
          bg: 'bg-sky-100 text-sky-800 border-sky-200',
          defaultLabel: 'GV Bộ Môn',
        };
      case 'tpt':
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          defaultLabel: 'Tổng Phụ Trách',
        };
      case 'vanphong':
        return {
          bg: 'bg-teal-100 text-teal-800 border-teal-200',
          defaultLabel: 'Văn phòng',
        };
      case 'giamthi':
        return {
          bg: 'bg-orange-100 text-orange-800 border-orange-200',
          defaultLabel: 'Giám thị',
        };
      case 'parent':
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          defaultLabel: 'Phụ Huynh',
        };
      case 'student':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          defaultLabel: 'Học Sinh',
        };
      case 'present':
        return {
          bg: 'bg-attendance-present-bg text-attendance-present-text border-attendance-present-border',
          defaultLabel: 'Có mặt',
        };
      case 'absentP':
        return {
          bg: 'bg-attendance-excused-bg text-attendance-excused-text border-attendance-excused-border',
          defaultLabel: 'Vắng (P)',
        };
      case 'absentK':
        return {
          bg: 'bg-attendance-unexcused-bg text-attendance-unexcused-text border-attendance-unexcused-border font-bold',
          defaultLabel: 'Vắng (K)',
        };
      case 'late':
        return {
          bg: 'bg-attendance-late-bg text-attendance-late-text border-attendance-late-border',
          defaultLabel: 'Muộn',
        };
      case 'early':
        return {
          bg: 'bg-attendance-early-bg text-attendance-early-text border-attendance-early-border',
          defaultLabel: 'Về sớm',
        };
      case 'positive':
        return {
          bg: 'bg-behavior-positive-bg text-behavior-positive-text border-green-200',
          defaultLabel: 'Khen ngợi',
        };
      case 'negative':
        return {
          bg: 'bg-behavior-negative-bg text-behavior-negative-text border-red-200 font-bold',
          defaultLabel: 'Vi phạm',
        };
      case 'neutral':
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          defaultLabel: 'Bình thường',
        };
    }
  };

  const config = getBadgeConfig();
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs md:text-sm';

  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-md border ${config.bg} ${sizeClasses} ${className}`}
    >
      {label || config.defaultLabel}
    </span>
  );
};
