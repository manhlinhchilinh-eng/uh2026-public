import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import {
  LayoutDashboard,
  BookOpen,
  UserCheck,
  UserX,
  Award,
  Calendar,
  FileText,
  Trophy,
  Users,
  Database,
  FileSpreadsheet,
  ShieldAlert,
  MessageSquareWarning,
  UserRoundX,
  UtensilsCrossed,
  X,
  LayoutGrid,
  Megaphone,
  FolderOpen,
  CalendarOff,
  ClipboardCheck,
  BarChart3,
  Briefcase,
  BookOpenCheck,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Circle,
  Globe2,
} from 'lucide-react';
import { useAnnouncements } from '../../context/AnnouncementsContext';
import { useOfficeNotices } from '../../context/OfficeNoticesContext';
import { BRAND_CONFIG } from '../../config/brand';
import { Bi } from './Bi';
import { flatBilingual } from '../../utils/bilingual';
import { listPendingForClass } from '../../services/studentLeaveService';
import { L, buildNavGroups, filterNavGroups, groupBadge, type NavEntry, type NavGroupId } from '../../utils/navGroups';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isMobileDrawer?: boolean;
  onCloseDrawer?: () => void;
}

const ICONS: Record<string, React.ElementType> = {
  '/apps': LayoutGrid,
  '/dashboard': LayoutDashboard,
  '/announcements': Megaphone,
  '/hanh-chinh': FolderOpen,
  '/bgh': BarChart3,
  '/esl': Globe2,
  '/logbook': BookOpen,
  '/attendance': UserCheck,
  '/vang-muon': UserX,
  '/behavior': Award,
  '/schedule': Calendar,
  '/summary': FileText,
  '/emulation': Trophy,
  '/leave': CalendarOff,
  '/timesheet': ClipboardCheck,
  '/teacher-portfolio': Briefcase,
  '/so-diem': BookOpenCheck,
  '/portfolio': Award,
  '/thoi-khoa-bieu': Calendar,
  '/users': Users,
  '/import': FileSpreadsheet,
  '/seed': Database,
  '/audit': ShieldAlert,
  '/gop-y': MessageSquareWarning,
  '/don-nghi-hs': UserRoundX,
  '/bao-com': UtensilsCrossed,
};

const COLLAPSED_KEY = 'ums_nav_collapsed_groups';
const RAIL_KEY = 'ums_nav_rail';

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* chế độ duyệt riêng tư: chỉ nhớ trong phiên */
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isMobileDrawer = false,
  onCloseDrawer,
}) => {
  const { profile, activeRole } = useAuth();
  const { t, language, mode } = useLanguage();
  const { unreadCount } = useAnnouncements();
  const { pendingCount: officePending } = useOfficeNotices();

  // Badge đơn nghỉ học chờ duyệt (chỉ GVCN): dùng cache 10 phút của service, không polling
  const [leavePending, setLeavePending] = useState(0);
  const gvcnClass = activeRole === 'gvcn' ? profile?.assignedClassId : undefined;
  useEffect(() => {
    if (!gvcnClass) {
      setLeavePending(0);
      return;
    }
    let alive = true;
    const refresh = () =>
      listPendingForClass(gvcnClass)
        .then((l) => alive && setLeavePending(l.length))
        .catch(() => {});
    refresh();
    // Trang Đơn nghỉ học báo khi vừa duyệt/từ chối → đọc lại từ cache (0 lượt đọc)
    window.addEventListener('ums-leave-changed', refresh);
    return () => {
      alive = false;
      window.removeEventListener('ums-leave-changed', refresh);
    };
  }, [gvcnClass]);

  const [collapsed, setCollapsed] = useState<NavGroupId[]>(() => readStored<NavGroupId[]>(COLLAPSED_KEY, []));
  const [rail, setRail] = useState<boolean>(() => !isMobileDrawer && readStored<boolean>(RAIL_KEY, false));
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(
    () =>
      buildNavGroups({
        role: activeRole,
        assignedClassId: profile?.assignedClassId,
        unreadAnnouncements: unreadCount,
        officePending,
        leavePending,
        devTools: import.meta.env.DEV,
      }),
    [activeRole, profile?.assignedClassId, unreadCount, officePending, leavePending]
  );
  const visibleGroups = filterNavGroups(groups, query);
  const searching = query.trim().length > 0;

  // Phím "/" để tìm nhanh (bỏ qua khi đang gõ trong ô nhập)
  useEffect(() => {
    if (rail) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rail]);

  const toggleGroup = (id: NavGroupId) => {
    const next = collapsed.includes(id) ? collapsed.filter((g) => g !== id) : [...collapsed, id];
    setCollapsed(next);
    writeStored(COLLAPSED_KEY, next);
  };

  const toggleRail = () => {
    setRail(!rail);
    writeStored(RAIL_KEY, !rail);
  };

  const handleItemClick = (path: string) => {
    onNavigate(path);
    setQuery('');
    if (isMobileDrawer && onCloseDrawer) {
      onCloseDrawer();
    }
  };

  const renderItem = (item: NavEntry) => {
    const Icon = ICONS[item.path] || Circle;
    const isActive = currentPath === item.path;
    const flat = flatBilingual(language, mode, item.label);
    return (
      <button
        key={item.path}
        type="button"
        onClick={() => handleItemClick(item.path)}
        title={rail ? flat : undefined}
        aria-label={rail ? flat : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`relative w-full flex items-center ${rail ? 'justify-center px-0 py-2.5' : `gap-3 px-3 ${mode === 'dual' ? 'py-1.5' : 'py-2'}`} rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-ums-50 text-ums-900 font-bold shadow-xs before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-[#8B1A4A]'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${isActive ? 'text-[#8B1A4A]' : 'text-slate-400'}`} />
        {!rail && <Bi vi={item.label.vi} en={item.label.en} className="flex-1 text-left min-w-0" />}
        {item.badge ? (
          <span
            data-testid="nav-badge"
            className={`${rail ? 'absolute top-1 right-2' : 'ml-auto'} min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center`}
          >
            {item.badge}
          </span>
        ) : null}
      </button>
    );
  };

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Drawer close button on mobile */}
      {isMobileDrawer && (
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#8B1A4A] text-white">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm">{BRAND_CONFIG.platformName}</span>
          </div>
          <button
            type="button"
            onClick={onCloseDrawer}
            className="p-1 rounded-lg text-white hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* User info mini banner */}
      {!rail && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t.roles.currentRole}</p>
          <p className="text-sm font-bold text-ums-900 truncate mt-0.5">{profile?.displayName || profile?.username}</p>
          {profile?.assignedClassId && activeRole === 'gvcn' && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-rose-50 text-ums-700 text-[11px] font-semibold rounded-md border border-rose-200">
              Lớp chủ nhiệm: {profile.assignedClassId}
            </span>
          )}
        </div>
      )}

      {/* Tìm nhanh */}
      {!rail && (
        <div className="px-3 pt-3">
          <label className="relative block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const first = visibleGroups[0]?.items[0];
                  if (first) handleItemClick(first.path);
                }
                if (e.key === 'Escape') {
                  setQuery('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder={language === 'en' ? 'Quick find' : 'Tìm nhanh'}
              aria-label="Tìm nhanh trong menu · Quick find"
              data-testid="nav-search"
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-ums-300 focus:ring-2 focus:ring-ums-100 outline-none transition"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 text-[10px] font-mono text-slate-400 border border-slate-200 rounded bg-white">
              /
            </kbd>
          </label>
        </div>
      )}

      {/* Navigation Links */}
      <nav className={`flex-1 overflow-y-auto ${rail ? 'p-2' : 'p-3'} space-y-1`}>
        {visibleGroups.map((g) => {
          const isCollapsed = !searching && !rail && collapsed.includes(g.id) && !g.items.some((i) => i.path === currentPath);
          const badge = groupBadge(g);
          return (
            <div key={g.id} className={rail ? 'pt-2 mt-1 border-t border-slate-100' : 'pt-2'} data-testid={`nav-group-${g.id}`}>
              {!rail && (
                <button
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  aria-expanded={!isCollapsed}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                  <Bi vi={g.label.vi} en={g.label.en} layout="inline" />
                  {isCollapsed && badge > 0 && (
                    <span className="ml-auto min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              )}
              {!isCollapsed && <div className="space-y-0.5 animate-fade-in">{g.items.map(renderItem)}</div>}
            </div>
          );
        })}
        {searching && visibleGroups.length === 0 && (
          <p className="px-3 py-4 text-xs text-slate-400 text-center">Không thấy mục nào · No match</p>
        )}

        {/* Hệ sinh thái UMS+ để cuối menu (tách bằng đường kẻ) — tránh hiểu nhầm là trang chính */}
        {!searching && (
          <div className="mt-2 pt-2 border-t border-slate-100" data-testid="nav-apps-bottom">
            {renderItem({ path: '/apps', label: { vi: `Hệ sinh thái ${BRAND_CONFIG.platformShort}`, en: L.apps.en } })}
          </div>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div
        className={`border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-400 flex items-center ${
          rail ? 'justify-center p-2' : 'justify-between px-4 py-2.5'
        }`}
      >
        {!rail && (
          <span className="truncate">
            {BRAND_CONFIG.platformName} • {BRAND_CONFIG.academicYear}
          </span>
        )}
        {!isMobileDrawer && (
          <button
            type="button"
            onClick={toggleRail}
            className="p-1 rounded-md hover:bg-slate-200 text-slate-500"
            title={rail ? 'Mở rộng menu · Expand' : 'Thu gọn menu · Collapse'}
            aria-label={rail ? 'Mở rộng menu' : 'Thu gọn menu'}
            data-testid="nav-rail-toggle"
          >
            {rail ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );

  if (isMobileDrawer) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-fade-in" onClick={onCloseDrawer} />
        <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-slide-right">{content}</div>
      </div>
    );
  }

  return (
    <aside
      className={`hidden md:block ${rail ? 'w-16' : 'w-64'} h-[calc(100vh-4rem)] sticky top-16 shrink-0 transition-[width] duration-300 ease-out`}
    >
      {content}
    </aside>
  );
};
