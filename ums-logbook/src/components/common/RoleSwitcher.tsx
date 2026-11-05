import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { UserRole } from '../../types/auth';
import { ChevronDown, Shield, GraduationCap, BookOpen, Award, Check } from 'lucide-react';

interface RoleSwitcherProps {
  className?: string;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ className = '' }) => {
  const { profile, activeRole, switchActiveRole } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile || !activeRole) return null;

  const roles = profile.roles || [];
  const assignedClassId = profile.assignedClassId;

  const getRoleMeta = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: t.roles.admin,
          shortLabel: 'Quản trị',
          icon: Shield,
          color: 'bg-purple-100 text-purple-900 border-purple-300',
        };
      case 'gvcn':
        return {
          label: assignedClassId ? `${t.roles.gvcn} - ${assignedClassId}` : t.roles.gvcn,
          shortLabel: assignedClassId ? `GVCN ${assignedClassId}` : 'GVCN',
          icon: GraduationCap,
          color: 'bg-rose-100 text-rose-900 border-rose-300 font-semibold',
        };
      case 'gvbm':
        return {
          label: t.roles.gvbm,
          shortLabel: 'GVBM',
          icon: BookOpen,
          color: 'bg-sky-100 text-sky-900 border-sky-300',
        };
      case 'tpt':
        return {
          label: t.roles.tpt,
          shortLabel: 'TPT',
          icon: Award,
          color: 'bg-amber-100 text-amber-900 border-amber-300',
        };
      case 'vanphong':
        return {
          label: t.roles.vanphong,
          shortLabel: 'Văn phòng',
          icon: Award,
          color: 'bg-teal-100 text-teal-900 border-teal-300',
        };
      case 'giamthi':
        return {
          label: t.roles.giamthi,
          shortLabel: 'Giám thị',
          icon: Award,
          color: 'bg-orange-100 text-orange-900 border-orange-300',
        };
      case 'parent':
        return {
          label: t.roles.parent,
          shortLabel: 'Phụ huynh',
          icon: GraduationCap,
          color: 'bg-slate-100 text-slate-800 border-slate-300',
        };
      case 'student':
        return {
          label: t.roles.student,
          shortLabel: 'Học sinh',
          icon: GraduationCap,
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        };
    }
  };

  const currentMeta = getRoleMeta(activeRole);
  const CurrentIcon = currentMeta.icon;

  if (roles.length <= 1) {
    return (
      <div
        className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold ${currentMeta.color} border shadow-sm ${className}`}
      >
        <CurrentIcon className="w-3.5 h-3.5" />
        <span>{currentMeta.shortLabel}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-800 rounded-full text-xs font-semibold shadow-sm border border-white/30 hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={t.roles.switchRole}
      >
        <CurrentIcon className="w-3.5 h-3.5 text-ums-700" />
        <span className="text-ums-900 font-bold">{currentMeta.shortLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fade-in">
          <div className="px-3 py-1.5 border-b border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {t.roles.switchRole}
            </p>
          </div>
          <div className="py-1">
            {roles.map((role) => {
              const meta = getRoleMeta(role);
              const Icon = meta.icon;
              const isActive = role === activeRole;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    switchActiveRole(role);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                    isActive
                      ? 'bg-ums-50 text-ums-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-ums-700' : 'text-slate-400'}`} />
                    <span>{meta.label}</span>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-ums-700 font-bold" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
