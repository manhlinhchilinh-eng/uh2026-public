import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { RoleGuard } from './components/layout/RoleGuard';
import { AppLayout } from './components/layout/AppLayout';
import { AssistantFab } from './components/assistant/AssistantFab';
import { LoginForm } from './components/auth/LoginForm';
import { useAuth } from './hooks/useAuth';
import { seedMockStorage } from './services/seedService';

import { DashboardPage } from './pages/DashboardPage';
import { LogbookPage } from './pages/LogbookPage';
import { AttendancePage } from './pages/AttendancePage';
import { SchoolAttendancePage } from './pages/SchoolAttendancePage';
import { BehaviorPage } from './pages/BehaviorPage';
import { SchedulePage } from './pages/SchedulePage';
import { SummaryPage } from './pages/SummaryPage';
import { EmulationPage } from './pages/EmulationPage';
import { AppsPage } from './pages/AppsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { AdminDocsPage } from './pages/AdminDocsPage';
import { LeavePage } from './pages/LeavePage';
import { TimesheetPage } from './pages/TimesheetPage';
import { BghDashboardPage } from './pages/BghDashboardPage';
import { EslPage } from './pages/EslPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { PassportPage } from './pages/PassportPage';
import { TeacherPortfolioPage } from './pages/TeacherPortfolioPage';
import { GradebookPage } from './pages/GradebookPage';
import { FamilyHomePage } from './pages/FamilyHomePage';
import { FamilyTimetablePage } from './pages/FamilyTimetablePage';
import { STAFF_ROLES, FAMILY_ROLES } from './types/auth';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminSeedPage } from './pages/AdminSeedPage';
import { ImportPage } from './pages/ImportPage';
import { AuditPage } from './pages/AuditPage';
import { FeedbackAdminPage } from './pages/FeedbackAdminPage';
import { StudentLeavePage } from './pages/StudentLeavePage';
import { MealReportPage } from './pages/MealReportPage';

const LoginRoute: React.FC = () => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <LoginForm />
      <AssistantFab />
    </>
  );
};

/** Trang chủ theo vai trò: PH/HS → cổng gia đình; nhân sự → bảng điều khiển. */
/** Link cũ /van-phong[?open=…|?tab=sent] → trang Thông báo gộp, giữ tham số. */
const LegacyOfficeRedirect: React.FC = () => {
  const { search } = useLocation();
  return <Navigate to={`/announcements${search}`} replace />;
};

const HomeRoute: React.FC = () => {
  const { activeRole } = useAuth();
  if (activeRole === 'vanphong') return <Navigate to="/announcements" replace />;
  return activeRole && FAMILY_ROLES.includes(activeRole) ? <FamilyHomePage /> : <DashboardPage />;
};

export const AppContent: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('offline_demo') === '1') {
      localStorage.setItem('ums_offline_demo', '1');
    }
    const isTestOrOffline =
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
      localStorage.getItem('ums_offline_demo') === '1';
    if (isTestOrOffline && localStorage.getItem('ums_seeded') !== 'true') {
      seedMockStorage();
    }
  }, []);


  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      {/* Protected Application Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<HomeRoute />} />
          <Route path="/apps" element={<AppsPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/portfolio/passport" element={<PassportPage />} />

          {/* PH/HS: TKB lớp của con/của em (góp ý 05/11) */}
          <Route element={<RoleGuard allowedRoles={FAMILY_ROLES} />}>
            <Route path="/thoi-khoa-bieu" element={<FamilyTimetablePage />} />
          </Route>

          {/* Thông báo Văn phòng: nhân sự + Văn phòng */}
          <Route element={<RoleGuard allowedRoles={[...STAFF_ROLES, 'vanphong']} />}>
            {/* Thông báo Văn phòng đã gộp vào /announcements — giữ link cũ */}
            <Route path="/van-phong" element={<LegacyOfficeRedirect />} />
            {/* Hành chính – Văn bản – Quy trình: Văn phòng/BGH quản lý, nhân sự xem */}
            <Route path="/hanh-chinh" element={<AdminDocsPage />} />
          </Route>

          {/* Phân hệ nghiệp vụ của nhà trường — chỉ nhân sự (không cho PH/HS) */}
          <Route element={<RoleGuard allowedRoles={STAFF_ROLES} />}>
            <Route path="/logbook" element={<LogbookPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/vang-muon" element={<SchoolAttendancePage />} />
            <Route path="/behavior" element={<BehaviorPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/emulation" element={<EmulationPage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/timesheet" element={<TimesheetPage />} />
            <Route path="/teacher-portfolio" element={<TeacherPortfolioPage />} />
            <Route path="/so-diem" element={<GradebookPage />} />
          </Route>

          {/* Đơn nghỉ học của PH: GVCN duyệt, BGH chọn lớp */}
          <Route element={<RoleGuard allowedRoles={['gvcn', 'admin']} />}>
            <Route path="/don-nghi-hs" element={<StudentLeavePage />} />
          </Route>

          {/* Nghỉ học & Báo cơm: Văn phòng/Kế toán + BGH + Giám thị + TPT */}
          <Route element={<RoleGuard allowedRoles={['vanphong', 'admin', 'giamthi', 'tpt']} />}>
            <Route path="/bao-com" element={<MealReportPage />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/users" element={<AdminUsersPage />} />
            <Route path="/gop-y" element={<FeedbackAdminPage />} />
            <Route path="/tkb" element={<Navigate to="/schedule?tab=update" replace />} />
            <Route path="/audit" element={<AuditPage />} />
            {/* Công cụ dev: nạp dữ liệu mẫu (localStorage) + importer Excel cũ — không có trên bản thật */}
            {import.meta.env.DEV && <Route path="/seed" element={<AdminSeedPage />} />}
            {import.meta.env.DEV && <Route path="/import" element={<ImportPage />} />}
            <Route path="/bgh" element={<BghDashboardPage />} />
            <Route path="/esl" element={<EslPage />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
