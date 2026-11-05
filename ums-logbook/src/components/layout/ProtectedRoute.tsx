import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ForcePasswordChangeModal } from '../auth/ForcePasswordChangeModal';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, profile, isLoading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#8B1A4A] border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500">Đang xác thực thông tin...</p>
        </div>
      </div>
    );
  }

  if (!user && !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (mustChangePassword) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <ForcePasswordChangeModal isOpen={true} isMandatory={true} />
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
