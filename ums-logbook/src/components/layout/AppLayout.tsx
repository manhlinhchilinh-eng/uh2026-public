import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../common/Header';
import { Sidebar } from '../common/Sidebar';
import { BottomNav } from '../common/BottomNav';
import { SessionTimeoutModal } from '../auth/SessionTimeoutModal';
import { IdleTimeoutModal } from '../common/IdleTimeoutModal';
import { ForcePasswordChangeModal } from '../auth/ForcePasswordChangeModal';
import { useIdleTimeout } from '../../hooks/useIdleTimeout';
import { AnnouncementsProvider } from '../../context/AnnouncementsContext';
import { AnnouncementBanner } from '../announcements/AnnouncementBanner';
import { OfficeNoticesProvider } from '../../context/OfficeNoticesContext';
import { OfficeReminderBar } from '../office/OfficeReminderBar';
import { PresentationMasker } from '../common/PresentationMasker';
import { UnreadTitleSync } from '../notices/DesktopNotify';
import { AssistantFab } from '../assistant/AssistantFab';

export const AppLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isWarningOpen, remainingSeconds, resetTimer, logout } = useIdleTimeout();

  return (
    <AnnouncementsProvider>
    <OfficeNoticesProvider>
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <UnreadTitleSync />
      {/* Top Header */}
      <Header
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar
          currentPath={location.pathname}
          onNavigate={(path) => navigate(path)}
        />

        {/* Mobile Slide Drawer */}
        {isMobileMenuOpen && (
          <Sidebar
            currentPath={location.pathname}
            onNavigate={(path) => navigate(path)}
            isMobileDrawer={true}
            onCloseDrawer={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-8 min-w-0 overflow-y-auto">
          <PresentationMasker />
          <AnnouncementBanner />
          <OfficeReminderBar />
          <Outlet />
        </main>
      </div>

      {/* Trợ lý UMS+ (nút nổi góc phải dưới) */}
      <AssistantFab />

      {/* Mobile Bottom Navigation Bar (375px) */}
      <BottomNav
        currentPath={location.pathname}
        onNavigate={(path) => navigate(path)}
        onOpenMoreMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* 30m Idle Session Timeout Warning Modal */}
      <IdleTimeoutModal
        isOpen={isWarningOpen}
        remainingSeconds={remainingSeconds}
        onExtend={resetTimer}
        onLogout={logout}
      />

      {/* Legacy SessionTimeoutModal for backwards compatibility with tests */}
      <SessionTimeoutModal />

      {/* Voluntary Password Change Modal */}
      <ForcePasswordChangeModal
        isOpen={isChangePasswordModalOpen}
        isMandatory={false}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
    </OfficeNoticesProvider>
    </AnnouncementsProvider>
  );
};
