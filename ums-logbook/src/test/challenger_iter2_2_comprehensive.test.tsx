import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  generateSeedDataset,
  seedMockStorage,
  GVCN_USER_MAPPING,
  getSeedStats,
} from '../services/seedService';
import {
  signInWithUsernameOrEmail,
} from '../services/authService';
import { AuthProvider, useAuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { RoleSwitcher } from '../components/common/RoleSwitcher';
import { Sidebar } from '../components/common/Sidebar';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_PASSWORD_HASH } from '../utils/crypto';

// Harness component to test AuthContext actions and state inspection
const FullAuthHarness: React.FC<{
  onReady?: (auth: ReturnType<typeof useAuthContext>) => void;
}> = ({ onReady }) => {
  const auth = useAuthContext();
  React.useEffect(() => {
    if (onReady) onReady(auth);
  }, [auth, onReady]);

  return (
    <div>
      <div data-testid="username">{auth.profile?.username || 'none'}</div>
      <div data-testid="active-role">{auth.activeRole || 'none'}</div>
      <div data-testid="assigned-class">{auth.profile?.assignedClassId || 'none'}</div>
      <div data-testid="roles">{auth.profile?.roles.join(',') || 'none'}</div>
      <button data-testid="btn-to-admin" onClick={() => auth.switchActiveRole('admin')}>
        To Admin
      </button>
      <button data-testid="btn-to-gvcn" onClick={() => auth.switchActiveRole('gvcn')}>
        To GVCN
      </button>
      <button data-testid="btn-to-gvbm" onClick={() => auth.switchActiveRole('gvbm')}>
        To GVBM
      </button>
      <button data-testid="btn-to-tpt" onClick={() => auth.switchActiveRole('tpt')}>
        To TPT
      </button>
      <button
        data-testid="btn-to-invalid"
        onClick={() => (auth.switchActiveRole as any)('superadmin')}
      >
        To Invalid
      </button>
    </div>
  );
};

describe('CHALLENGER M1_ITER2_2 EMPIRICAL ADVERSARIAL AUDIT', () => {
  beforeEach(() => {
    localStorage.clear();
    seedMockStorage();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ALL 29 ACCOUNTS ROSTER & USER CORRECTION #2 GROUND TRUTH AUDIT
  // =========================================================================
  describe('1. Ground-Truth Roster Audit: All 29 Accounts & User Correction #2', () => {
    const { users, classes } = generateSeedDataset();

    it('1.1 Total accounts count is exactly 29, unique usernames and emails', () => {
      expect(users.length).toBe(29);
      expect(getSeedStats().usersCount).toBe(29);

      const usernameSet = new Set(users.map((u) => u.username));
      expect(usernameSet.size).toBe(29);

      const emailSet = new Set(users.map((u) => u.email));
      expect(emailSet.size).toBe(29);

      const uidSet = new Set(users.map((u) => u.uid));
      expect(uidSet.size).toBe(29);
    });

    it('1.2 mrlinhums: Admin + GVCN 9A3 (assignedClassId: "9A3")', () => {
      const user = users.find((u) => u.username === 'mrlinhums');
      expect(user).toBeDefined();
      expect(user!.displayName).toBe('Nguyễn Mạnh Linh');
      expect(user!.roles).toContain('admin');
      expect(user!.roles).toContain('gvcn');
      expect(user!.roles).toContain('gvbm');
      expect(user!.assignedClassId).toBe('9A3');
      expect(user!.email).toBe('mrlinhums@ums.edu.vn');
      expect(user!.mustChangePassword).toBe(true);
      expect(user!.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
      expect((user as any).password).toBeUndefined();

      // Class 9A3 verification
      const cls = classes.find((c) => c.id === '9A3');
      expect(cls).toBeDefined();
      expect(cls!.gvcnId).toBe('mrlinhums');
      expect(cls!.gvcnName).toBe('Nguyễn Mạnh Linh');
    });

    it('1.3 mshuyentrangums: Principal / Admin ONLY (Correction #2 compliant)', () => {
      const principal = users.find((u) => u.username === 'mshuyentrangums');
      expect(principal).toBeDefined();
      expect(principal!.displayName).toBe('Hiệu trưởng / Principal');
      expect(principal!.roles).toEqual(['admin']);
      expect(principal!.assignedClassId).toBeUndefined();
      expect(principal!.email).toBe('mshuyentrangums@ums.edu.vn');
      expect(principal!.mustChangePassword).toBe(true);
      expect(principal!.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
      expect((principal as any).password).toBeUndefined();
    });

    it('1.4 msthanhhuyenums: GVCN 7A3 (roles: [gvcn, gvbm], assignedClassId: "7A3", NOT admin)', () => {
      const gvcn7a3 = users.find((u) => u.username === 'msthanhhuyenums');
      expect(gvcn7a3).toBeDefined();
      expect(gvcn7a3!.displayName).toBe('Nguyễn Phương Minh Hạnh');
      expect(gvcn7a3!.roles).toEqual(['gvcn', 'gvbm']);
      expect(gvcn7a3!.roles).not.toContain('admin');
      expect(gvcn7a3!.assignedClassId).toBe('7A3');
      expect(gvcn7a3!.email).toBe('msthanhhuyenums@ums.edu.vn');
      expect(gvcn7a3!.mustChangePassword).toBe(true);
      expect(gvcn7a3!.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
      expect((gvcn7a3 as any).password).toBeUndefined();

      // Class 7A3 verification
      const cls = classes.find((c) => c.id === '7A3');
      expect(cls).toBeDefined();
      expect(cls!.gvcnId).toBe('msthanhhuyenums');
      expect(cls!.gvcnName).toBe('Nguyễn Phương Minh Hạnh');
    });

    it('1.5 msngoclinhums: regular GVCN 8A3 (assignedClassId: "8A3", NOT admin)', () => {
      const gvcn8a3 = users.find((u) => u.username === 'msngoclinhums');
      expect(gvcn8a3).toBeDefined();
      expect(gvcn8a3!.displayName).toBe('Hồ Thanh Quang Uyên');
      expect(gvcn8a3!.roles).toEqual(['gvcn', 'gvbm']);
      expect(gvcn8a3!.roles).not.toContain('admin');
      expect(gvcn8a3!.assignedClassId).toBe('8A3');
      expect(gvcn8a3!.email).toBe('msngoclinhums@ums.edu.vn');
      expect(gvcn8a3!.mustChangePassword).toBe(true);
      expect(gvcn8a3!.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
      expect((gvcn8a3 as any).password).toBeUndefined();

      // Class 8A3 verification
      const cls = classes.find((c) => c.id === '8A3');
      expect(cls).toBeDefined();
      expect(cls!.gvcnId).toBe('msngoclinhums');
      expect(cls!.gvcnName).toBe('Hồ Thanh Quang Uyên');
    });

    it('1.6 mrhoanggiangums: Admin only (no assigned class)', () => {
      const user = users.find((u) => u.username === 'mrhoanggiangums');
      expect(user).toBeDefined();
      expect(user!.displayName).toBe('Hoàng Giang');
      expect(user!.roles).toEqual(['admin']);
      expect(user!.assignedClassId).toBeUndefined();
      expect(user!.email).toBe('mrhoanggiangums@ums.edu.vn');
      expect(user!.mustChangePassword).toBe(true);
      expect(user!.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
    });

    it('1.7 mrhoanglongums: TPT only (no assigned class)', () => {
      const user = users.find((u) => u.username === 'mrhoanglongums');
      expect(user).toBeDefined();
      expect(user!.displayName).toBe('Hoàng Long');
      expect(user!.roles).toEqual(['tpt']);
      expect(user!.assignedClassId).toBeUndefined();
      expect(user!.email).toBe('mrhoanglongums@ums.edu.vn');
      expect(user!.mustChangePassword).toBe(true);
      expect(user!.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
    });

    it('1.8 All 24 remaining GVCNs: verified and mapped exactly to specified usernames and classes', () => {
      // The 24 remaining GVCNs from the original specification table (excluding 9A3 and 7A3 which were verified above)
      const remainingGVCNs: Array<{ classId: string; expectedUser: string; expectedName: string }> = [
        { classId: '6A1', expectedUser: 'msphuonganhums', expectedName: 'Đinh Hoài Long' },
        { classId: '6A2', expectedUser: 'msmaihuong6a2ums', expectedName: 'Phạm Hà Ánh Định' },
        { classId: '6A3', expectedUser: 'mrlongums', expectedName: 'Lý Trung Yến' },
        { classId: '6A4', expectedUser: 'msphuonganh6a4ums', expectedName: 'Trần Ngọc Đạt' },
        { classId: '6A5', expectedUser: 'mshuyenums', expectedName: 'Hồ Gia Trâm' },
        { classId: '6A6', expectedUser: 'msquynhtrangums', expectedName: 'Bùi Đức An Xuân' },
        { classId: '6A7', expectedUser: 'mshienums', expectedName: 'Nguyễn Minh Vy' },
        { classId: '6A8', expectedUser: 'msngaums', expectedName: 'Đặng Bảo Giang' },
        { classId: '7A1', expectedUser: 'msthaoums', expectedName: 'Phạm Hải Yến' },
        { classId: '7A2', expectedUser: 'mrdatums', expectedName: 'Đinh Trung Vy' },
        { classId: '7A4', expectedUser: 'msquynhngaums', expectedName: 'Lê Phương Quang Khoa' },
        { classId: '7A5', expectedUser: 'mrhuyums', expectedName: 'Lâm Phương Quân' },
        { classId: '7A6', expectedUser: 'msthuytrangums', expectedName: 'Nguyễn Văn Hạnh' },
        { classId: '8A1', expectedUser: 'mshuonglyums', expectedName: 'Dương Trung Hoài Châm' },
        { classId: '8A2', expectedUser: 'mshongnhungums', expectedName: 'Mai An Thanh Giang' },
        { classId: '8A3', expectedUser: 'msngoclinhums', expectedName: 'Hồ Thanh Quang Uyên' },
        { classId: '8A4', expectedUser: 'mshangums', expectedName: 'Mai Quang Hưng' },
        { classId: '8A5', expectedUser: 'mshueums', expectedName: 'Bùi Bảo Cường' },
        { classId: '8A6', expectedUser: 'mshaiyen8a6ums', expectedName: 'Lê Thị Khánh Châm' },
        { classId: '9A1', expectedUser: 'msgiangums', expectedName: 'Bùi Hoài Khánh Châm' },
        { classId: '9A2', expectedUser: 'mshaiyen9a2ums', expectedName: 'Lý Gia Đạt' },
        { classId: '9A4', expectedUser: 'mrphuongums', expectedName: 'Phạm Gia Ly' },
        { classId: '9A5', expectedUser: 'msbaoums', expectedName: 'Trần Bảo Tuệ Hiếu' },
        { classId: '9A6', expectedUser: 'msmaiums', expectedName: 'Phan Đức Tùng' },
      ];

      expect(remainingGVCNs.length).toBe(24);

      for (const item of remainingGVCNs) {
        // Verify in GVCN_USER_MAPPING
        const mapping = GVCN_USER_MAPPING[item.classId];
        expect(mapping, `Class ${item.classId} must be in GVCN_USER_MAPPING`).toBeDefined();
        expect(mapping.username).toBe(item.expectedUser);
        expect(mapping.name).toBe(item.expectedName);

        // Verify in generated users list
        const user = users.find((u) => u.username === item.expectedUser);
        expect(user, `User ${item.expectedUser} for class ${item.classId} must exist`).toBeDefined();
        expect(user!.displayName).toBe(item.expectedName);
        expect(user!.assignedClassId).toBe(item.classId);
        expect(user!.roles).toEqual(['gvcn', 'gvbm']);
        expect(user!.roles).not.toContain('admin');
        expect(user!.roles).not.toContain('tpt');
        expect(user!.email).toBe(`${item.expectedUser}@ums.edu.vn`);
        expect(user!.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
        expect((user as any).password).toBeUndefined();

        // Verify in generated classes list
        const cls = classes.find((c) => c.id === item.classId);
        expect(cls, `Class ${item.classId} must exist in generated classes`).toBeDefined();
        expect(cls!.gvcnId).toBe(item.expectedUser);
        expect(cls!.gvcnName).toBe(item.expectedName);
      }
    });

    it('1.9 Exactly 26 classes, all 26 have valid GVCNs, and student counts match 674', () => {
      expect(classes.length).toBe(26);
      const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
      expect(totalStudents).toBe(674);

      for (const c of classes) {
        expect(c.gvcnId).toBeTruthy();
        expect(c.gvcnName).toBeTruthy();
        expect(c.studentCount).toBeGreaterThanOrEqual(25);
        expect(c.studentCount).toBeLessThanOrEqual(26);
      }
    });
  });

  // =========================================================================
  // 2. ROLE SWITCHING & PRIVILEGE ESCALATION RESISTANCE AUDIT
  // =========================================================================
  describe('2. Role Switching & Anti-Privilege Escalation Audit', () => {
    it('2.1 Admin+GVCN (mrlinhums) can switch between admin, gvcn, and gvbm without privilege leakage', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <FullAuthHarness />
          </AuthProvider>
        </LanguageProvider>
      );

      // Default active role should be admin (highest priority)
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');

      // Switch to GVCN
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-gvcn'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');

      // Switch to GVBM
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-gvbm'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvbm');

      // Switch back to Admin
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-admin'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');

      // Attempt to switch to TPT (which mrlinhums DOES NOT possess)
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-tpt'));
      });
      // Should remain 'admin' - privilege escalation to TPT rejected!
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');

      // Attempt to switch to invalid arbitrary role string ('superadmin')
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-invalid'));
      });
      // Should remain 'admin' - completely rejected!
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');
    });

    it('2.2 Regular GVCN (msthanhhuyenums) CANNOT switch to admin or tpt', async () => {
      await signInWithUsernameOrEmail('msthanhhuyenums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <FullAuthHarness />
          </AuthProvider>
        </LanguageProvider>
      );

      expect(screen.getByTestId('username')).toHaveTextContent('msthanhhuyenums');
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');
      expect(screen.getByTestId('assigned-class')).toHaveTextContent('7A3');

      // Attempt escalation to admin
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-admin'));
      });
      // Must still be gvcn!
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');

      // Attempt escalation to tpt
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-tpt'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');

      // Legitimate switch to gvbm should work
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-gvbm'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvbm');
    });

    it('2.3 Principal / Admin ONLY (mshuyentrangums) CANNOT switch to gvcn or tpt', async () => {
      await signInWithUsernameOrEmail('mshuyentrangums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <FullAuthHarness />
          </AuthProvider>
        </LanguageProvider>
      );

      expect(screen.getByTestId('username')).toHaveTextContent('mshuyentrangums');
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');
      expect(screen.getByTestId('assigned-class')).toHaveTextContent('none');

      // Attempt switch to gvcn
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-gvcn'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');

      // Attempt switch to tpt
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-tpt'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');

      // Attempt switch to gvbm
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-gvbm'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');
    });

    it('2.4 TPT ONLY (mrhoanglongums) CANNOT switch to admin, gvcn, or gvbm', async () => {
      await signInWithUsernameOrEmail('mrhoanglongums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <FullAuthHarness />
          </AuthProvider>
        </LanguageProvider>
      );

      expect(screen.getByTestId('username')).toHaveTextContent('mrhoanglongums');
      expect(screen.getByTestId('active-role')).toHaveTextContent('tpt');
      expect(screen.getByTestId('assigned-class')).toHaveTextContent('none');

      // Attempt switch to admin
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-admin'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('tpt');

      // Attempt switch to gvcn
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-to-gvcn'));
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('tpt');
    });
  });

  // =========================================================================
  // 3. UI INTEGRATION: SIDEBAR & ROLESWITCHER ADVERSARIAL BEHAVIOR
  // =========================================================================
  describe('3. UI Navigation & RoleSwitcher Verification', () => {
    it('3.1 RoleSwitcher only renders dropdown for accounts with multiple roles', async () => {
      // Single role user: mshuyentrangums (roles: ['admin'])
      await signInWithUsernameOrEmail('mshuyentrangums', 'demo@2026');

      const { unmount } = render(
        <LanguageProvider>
          <AuthProvider>
            <RoleSwitcher />
          </AuthProvider>
        </LanguageProvider>
      );

      // For single role, RoleSwitcher renders a static badge without a button toggle
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByText('Quản trị')).toBeInTheDocument();
      unmount();

      // Multi-role user: mrlinhums (roles: ['admin', 'gvcn', 'gvbm'])
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      render(
        <LanguageProvider>
          <AuthProvider>
            <RoleSwitcher />
          </AuthProvider>
        </LanguageProvider>
      );

      // Now RoleSwitcher has a toggle button
      const toggleBtn = screen.getByRole('button');
      expect(toggleBtn).toBeInTheDocument();

      // Open dropdown
      fireEvent.click(toggleBtn);
      expect(screen.getByText(/Chuyển vai trò/i)).toBeInTheDocument();
      // Should show BGH, GVCN 9A3, GVBM options
      expect(screen.getByText(/Ban Giám Hiệu/i)).toBeInTheDocument();
      expect(screen.getByText(/Giáo viên chủ nhiệm.*9A3/i)).toBeInTheDocument();
      expect(screen.getByText(/Giáo viên bộ môn/i)).toBeInTheDocument();
    });

    it('3.2 Sidebar navigation links adapt dynamically when mrlinhums switches role', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      let authRef: ReturnType<typeof useAuthContext> | null = null;

      render(
        <LanguageProvider>
          <AuthProvider>
            <FullAuthHarness onReady={(a) => (authRef = a)} />
            <MemoryRouter>
              <Sidebar currentPath="/dashboard" onNavigate={() => {}} />
            </MemoryRouter>
          </AuthProvider>
        </LanguageProvider>
      );

      // In admin role: should see "Quản lý tài khoản" (users) and "Khởi tạo dữ liệu" (seed)
      expect(screen.getByText(/Quản lý tài khoản/i)).toBeInTheDocument();
      expect(screen.getByText(/Khởi tạo dữ liệu/i)).toBeInTheDocument();

      // Switch role to GVCN
      await act(async () => {
        authRef?.switchActiveRole('gvcn');
      });

      // Now in GVCN role: Admin items (/users, /seed) MUST disappear!
      expect(screen.queryByText(/Quản lý tài khoản/i)).toBeNull();
      expect(screen.queryByText(/Khởi tạo dữ liệu/i)).toBeNull();
      // Homeroom specific items appear:
      expect(screen.getByText(/Điểm danh đầu giờ/i)).toBeInTheDocument();
      expect(screen.getByText(/Sổ đầu bài lớp tôi \(9A3\)/i)).toBeInTheDocument();

      // Switch role to GVBM
      await act(async () => {
        authRef?.switchActiveRole('gvbm');
      });

      // In GVBM role: attendance and admin items must not appear
      expect(screen.queryByText(/Quản lý tài khoản/i)).toBeNull();
      expect(screen.queryByText(/Khởi tạo dữ liệu/i)).toBeNull();
      expect(screen.queryByText(/Điểm danh đầu giờ/i)).toBeNull();
    });
  });
});
