/**
 * UMS Digital Class Logbook - PDF Export Button
 * Milestone 5: Reusable trigger button opening PdfExportModal
 * Path: src/components/summary/PdfExportButton.tsx
 */

import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import { PdfExportModal } from './PdfExportModal';

export interface PdfExportButtonProps {
  classId?: string;
  weekNumber?: number;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'icon';
  label?: string;
}

export const PdfExportButton: React.FC<PdfExportButtonProps> = ({
  classId = '6A1',
  weekNumber = 5,
  className = '',
  variant = 'primary',
  label = 'In Sổ Đầu Bài',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case 'icon':
        return 'p-2 rounded-xl text-slate-600 hover:text-ums-700 hover:bg-slate-100 transition';
      case 'secondary':
        return 'px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5';
      case 'outline':
        return 'px-3 py-1.5 border border-slate-300 hover:border-ums-600 hover:text-ums-700 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5';
      case 'primary':
      default:
        return 'px-3.5 py-2 bg-ums-700 hover:bg-ums-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center space-x-1.5';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`${getVariantStyles()} ${className}`}
        title="In hoặc xuất PDF Sổ Đầu Bài"
      >
        <Printer className="w-4 h-4" />
        {variant !== 'icon' && <span>{label}</span>}
      </button>

      {isModalOpen && (
        <PdfExportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialClassId={classId}
          initialWeekNumber={weekNumber}
        />
      )}
    </>
  );
};
