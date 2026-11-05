import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { BookOpen, UserCheck, Award, Trophy, Menu, Home, LayoutGrid, Megaphone, CalendarDays } from 'lucide-react';
import { FAMILY_ROLES } from '../../types/auth';

interface BottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenMoreMenu: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentPath,
  onNavigate,
  onOpenMoreMenu,
}) => {
  const { activeRole } = useAuth();
  const { t } = useLanguage();

  const isFamily = activeRole != null && FAMILY_ROLES.includes(activeRole);
  const tabs = isFamily
    ? [
        { path: '/dashboard', label: 'Trang chủ', icon: Home },
        { path: '/thoi-khoa-bieu', label: 'TKB', icon: CalendarDays },
        { path: '/announcements', label: 'Thông báo', icon: Megaphone },
        { path: '/apps', label: 'Ứng dụng', icon: LayoutGrid },
      ]
    : [
    { path: '/logbook', label: t.nav.logbook, icon: BookOpen },
    {
      path: activeRole === 'admin' ? '/users' : '/attendance',
      label: activeRole === 'admin' ? t.nav.users : t.nav.attendance,
      icon: UserCheck,
    },
    { path: '/behavior', label: t.nav.behavior, icon: Award },
    { path: '/emulation', label: t.nav.emulation, icon: Trophy },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 h-15 flex items-center justify-around px-2 shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentPath === tab.path;

        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => onNavigate(tab.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
              isActive ? 'text-[#8B1A4A] font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[10px] tracking-tight mt-0.5 max-w-[64px] truncate">
              {tab.label}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onOpenMoreMenu}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-slate-500 hover:text-slate-900 transition-colors"
      >
        <Menu className="w-5 h-5 stroke-2" />
        <span className="text-[10px] tracking-tight mt-0.5">Thêm</span>
      </button>
    </nav>
  );
};
