import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

export const SessionTimeoutModal: React.FC = () => {
  const { isIdleWarningOpen, idleRemainingSeconds, extendSession, logout } = useAuth();
  const { t } = useLanguage();

  if (!isIdleWarningOpen) return null;

  const minutes = Math.floor(idleRemainingSeconds / 60);
  const seconds = idleRemainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-600 mb-4 animate-pulse">
          <Clock className="w-7 h-7" />
        </div>

        <h3 className="text-base font-bold text-slate-900">{t.auth.sessionExpiring}</h3>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">
          Phiên làm việc của bạn sắp kết thúc do không có hoạt động trong 28 phút. Hệ thống sẽ tự động đăng xuất sau:
        </p>

        {/* Circular / Big Timer Display */}
        <div className="my-5 py-3 px-4 bg-slate-50 rounded-xl border border-slate-200 inline-block">
          <span className="font-mono text-3xl font-black text-[#8B1A4A] tracking-wider">
            {formattedTime}
          </span>
        </div>

        <div className="flex flex-col space-y-2 mt-2">
          <button
            type="button"
            onClick={extendSession}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#8B1A4A] hover:bg-[#74173F] shadow transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t.auth.stayLoggedIn}</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.auth.logout}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
