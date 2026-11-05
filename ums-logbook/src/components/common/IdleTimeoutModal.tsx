/**
 * UMS Digital Class Logbook - Idle Timeout Modal Component
 * Milestone 6: High-Visibility Inactivity Warning & Session Extender
 * Path: src/components/common/IdleTimeoutModal.tsx
 */

import React from 'react';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export interface IdleTimeoutModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  formattedTime?: string;
  onExtend?: () => void;
  onLogout?: () => void;
  resetActivity?: () => void;
  logoutNow?: () => void;
}

export const IdleTimeoutModal: React.FC<IdleTimeoutModalProps> = ({
  isOpen,
  remainingSeconds,
  formattedTime,
  onExtend,
  onLogout,
  resetActivity,
  logoutNow,
}) => {
  let t: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const langContext = useLanguage();
    t = langContext?.t;
  } catch {
    // Standalone render fallback for tests outside LanguageProvider
  }

  if (!isOpen) return null;

  const handleExtend = onExtend || resetActivity || (() => {});
  const handleLogout = onLogout || logoutNow || (() => {});

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const displayTime = formattedTime || `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 p-6 text-center transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pulsing Warning Icon */}
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-600 mb-4 animate-pulse">
          <Clock className="w-8 h-8" />
        </div>

        <h3 id="idle-timeout-title" className="text-base font-bold text-slate-900">
          {t?.auth?.sessionExpiring || 'Phiên làm việc sắp hết hạn'}
        </h3>
        
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">
          Phiên làm việc của bạn sắp kết thúc do không có hoạt động trong 25 phút. Hệ thống sẽ tự động đăng xuất sau:
        </p>

        {/* Big Burgundy Countdown Display */}
        <div className="my-5 py-3 px-6 bg-slate-50 rounded-xl border border-slate-200 inline-block shadow-inner">
          <span
            data-testid="idle-countdown-timer"
            className="font-mono text-3xl font-black text-[#8B1A4A] tracking-wider"
          >
            {displayTime}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2 mt-2">
          <button
            type="button"
            data-testid="idle-extend-btn"
            onClick={handleExtend}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#8B1A4A] hover:bg-[#74173F] active:scale-[0.98] shadow transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tiếp tục làm việc</span>
          </button>

          <button
            type="button"
            data-testid="idle-logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t?.auth?.logout || 'Đăng xuất ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
