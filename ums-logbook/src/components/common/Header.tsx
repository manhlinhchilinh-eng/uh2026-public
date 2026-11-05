import React, { useState, useRef, useEffect } from 'react';
import { STAFF_ROLES } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { LanguageToggle } from './LanguageToggle';
import { RoleSwitcher } from './RoleSwitcher';
import { BRAND_CONFIG } from '../../config/brand';
import { Menu, LogOut, KeyRound, Projector } from 'lucide-react';
import { isPresentationMode, setPresentationMode } from '../../utils/presentation';
import { Link } from 'react-router-dom';
import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import { PdfExportButton } from '../summary/PdfExportButton';
import { currentAcademic } from '../../utils/academicCalendar';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  onOpenChangePassword?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenChangePassword,
}) => {
  const { profile, logout, activeRole } = useAuth();
  const presenting = isPresentationMode();
  const { t, language } = useLanguage();
  const { isTeachingNow, currentTeachingSlot, todayDateStr } = useSmartNavigation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = () => {
    const date = new Date();
    if (language === 'vi') {
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = days[date.getDay()];
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${dayName}, ${d}/${m}/${y}`;
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#8B1A4A] text-white shadow-md border-b border-ums-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section: Hamburger (mobile) + Brand logo & title */}
          <div className="flex items-center space-x-3 min-w-0">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                className="md:hidden p-1.5 rounded-lg text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Open navigation menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}

            <div className="flex items-center space-x-3 cursor-pointer">
              <img
                src={BRAND_CONFIG.logoPath}
                alt="UMS Logo"
                className="hidden min-[420px]:block w-10 h-10 rounded-full object-cover border-2 border-white/80 shadow-sm bg-white"
                onError={(e) => {
                  // Fallback if image fails
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold tracking-wide uppercase leading-tight text-white">
                  {BRAND_CONFIG.schoolNameVi}
                </h1>
                <p className="text-xs text-white/85 font-medium flex items-center space-x-2">
                  <span>{t.app.title}</span>
                  <span className="text-white/40">•</span>
                  <span className="text-[11px] text-white/70">{formatDate()}</span>
                </p>
              </div>
              {/* Dưới 420px: ẩn logo + tên để đủ chỗ cho nút vai trò & song ngữ */}
              <div className="hidden min-[420px]:block sm:hidden">
                <span className="text-sm font-bold tracking-wide">{BRAND_CONFIG.platformShort}</span>
              </div>
            </div>
          </div>

          {/* Right section: Role switcher + Lang toggle + User profile */}
          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
            {/* Live teaching beacon for desktop teachers */}
            {isTeachingNow && currentTeachingSlot && (
              <Link
                to={`/logbook?classId=${encodeURIComponent(currentTeachingSlot.classId)}&date=${todayDateStr}&period=${currentTeachingSlot.periodIndex}`}
                className="hidden lg:flex items-center space-x-2 px-3 py-1 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-full text-xs font-semibold shadow-xs animate-pulse transition-all border border-emerald-400/40"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-200 animate-ping" />
                <span>
                  Tiết {currentTeachingSlot.periodIndex}: {currentTeachingSlot.subject} ({currentTeachingSlot.classId})
                </span>
                <span className="text-[10px] bg-white text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                  Vào sổ ngay
                </span>
              </Link>
            )}

            {presenting && (
              <span data-testid="presentation-badge" className="hidden sm:inline px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black tracking-wide">
                TRÌNH CHIẾU
              </span>
            )}

            {/* Role switcher for multi-role personas */}
            {profile && <RoleSwitcher />}

            {/* Quick print button — chỉ nhân sự, ẩn trên mobile để header không bị tràn */}
            {profile && activeRole && STAFF_ROLES.includes(activeRole) && (
              <span className="hidden sm:inline-flex">
                <PdfExportButton
                  classId={profile.assignedClassId || '6A1'}
                  weekNumber={currentAcademic().weekNumber}
                  variant="icon"
                  className="text-white hover:bg-white/10 p-1.5 rounded-full"
                />
              </span>
            )}

            {/* Language toggle */}
            <LanguageToggle />

            {/* User profile dropdown */}
            {profile && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-1.5 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold text-xs">
                    {profile.displayName ? profile.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden md:inline-block text-xs font-semibold max-w-[120px] truncate text-white/95">
                    {profile.displayName || profile.username}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-fade-in text-slate-800">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {profile.displayName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        @{profile.username}
                      </p>
                      {profile.assignedClassId && (
                        <p className="text-[11px] text-ums-700 font-semibold mt-0.5">
                          GVCN: Lớp {profile.assignedClassId}
                        </p>
                      )}
                    </div>

                    <div className="py-1">
                      {onOpenChangePassword && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenChangePassword();
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <KeyRound className="w-4 h-4 text-slate-400" />
                          <span>{t.auth.changePasswordTitle}</span>
                        </button>
                      )}

                      {/* Chế độ trình chiếu: che tên/mã HS khi demo công khai (chỉ máy này, không sửa dữ liệu) */}
                      <button
                        type="button"
                        data-testid="toggle-presentation"
                        onClick={() => {
                          setPresentationMode(!presenting);
                          window.location.reload();
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Projector className="w-4 h-4 text-slate-400" />
                        <span>{presenting ? 'Tắt chế độ trình chiếu' : 'Chế độ trình chiếu (che tên HS)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>{t.auth.logout}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
