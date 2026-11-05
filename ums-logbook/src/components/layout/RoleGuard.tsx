import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth';
import { ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { activeRole, profile } = useAuth();

  const userRoles = profile?.roles || [];
  const hasAccess =
    (activeRole && allowedRoles.includes(activeRole)) ||
    userRoles.some((r) => allowedRoles.includes(r));

  if (!hasAccess) {
    return (
      <div className="p-8 max-w-md mx-auto my-12 bg-white rounded-2xl shadow-lg border border-red-100 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Không có quyền truy cập</h3>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
          Tính năng này yêu cầu vai trò [{allowedRoles.join(', ')}]. Bạn hiện đang ở chế độ [
          {activeRole}].
        </p>
        <div className="mt-5">
          <Navigate to="/dashboard" replace />
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
