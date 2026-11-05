import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  resolveUsernameToEmail,
  extractUsername,
  signInWithUsernameOrEmail,
  changePassword,
} from '../services/authService';
import {
  seedMockStorage,
  generateSeedDataset,
} from '../services/seedService';
import { AuthProvider, useAuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { ForcePasswordChangeModal } from '../components/auth/ForcePasswordChangeModal';
import { SessionTimeoutModal } from '../components/auth/SessionTimeoutModal';

// Consumer component to test AuthContext states
const AuthContextSpy: React.FC = () => {
  const auth = useAuthContext();
  return (
    <div>
      <div data-testid="user-email">{auth.user?.email || 'no-user'}</div>
      <div data-testid="must-change-password">{auth.mustChangePassword ? 'true' : 'false'}</div>
      <div data-testid="is-idle-warning">{auth.isIdleWarningOpen ? 'true' : 'false'}</div>
      <div data-testid="idle-remaining">{auth.idleRemainingSeconds}</div>
      <button data-testid="extend-session-btn" onClick={auth.extendSession}>Extend</button>
      <button data-testid="logout-btn" onClick={auth.logout}>Logout</button>
    </div>
  );
};

describe('CHALLENGER M1 ADVERSARIAL TEST SUITE', () => {
  beforeEach(() => {
    localStorage.clear();
    seedMockStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // MISSION ITEM 1: Username Resolution Edge Cases & Account Mapping
  // =========================================================================
  describe('Mission Item 1: Username Resolution Edge Cases & Formats', () => {
    it('1.1: Handles leading and trailing whitespace safely', () => {
      expect(resolveUsernameToEmail('  mrlinhums  ')).toBe('mrlinhums@ums.edu.vn');
      expect(resolveUsernameToEmail('\tmsphuonganhums\n')).toBe('msphuonganhums@ums.edu.vn');
      expect(resolveUsernameToEmail('   mrhoanglongums   ')).toBe('mrhoanglongums@ums.edu.vn');
    });

    it('1.2: Normalizes mixed-case usernames correctly (MsPhuongAnhUMS)', () => {
      expect(resolveUsernameToEmail('MsPhuongAnhUMS')).toBe('msphuonganhums@ums.edu.vn');
      expect(resolveUsernameToEmail('MRLinhUMS')).toBe('mrlinhums@ums.edu.vn');
      expect(resolveUsernameToEmail('mShUyEnTrAnGuMs')).toBe('mshuyentrangums@ums.edu.vn');
    });

    it('1.3: Prevents duplicate domain concatenation when input already contains @ums.edu.vn', () => {
      expect(resolveUsernameToEmail('msphuonganhums@ums.edu.vn')).toBe('msphuonganhums@ums.edu.vn');
      expect(resolveUsernameToEmail('  MsPhuongAnhUMS@ums.edu.vn  ')).toBe('msphuonganhums@ums.edu.vn');
      expect(resolveUsernameToEmail('mrlinhums@UMS.EDU.VN')).toBe('mrlinhums@ums.edu.vn');
    });

    it('1.4: Handles combined edge cases: mixed case + leading/trailing spaces + domain suffix', () => {
      const complexInput = '   MsPhuongAnhUMS@UMS.EDU.VN   ';
      expect(resolveUsernameToEmail(complexInput)).toBe('msphuonganhums@ums.edu.vn');
      expect(extractUsername(complexInput)).toBe('msphuonganhums');
    });

    it('1.5: Authenticates successfully with mixed-case and whitespace-padded username', async () => {
      const { user, profile } = await signInWithUsernameOrEmail('  MsPhuongAnhUMS  ', 'demo@2026');
      expect(user).toBeDefined();
      expect(profile.username).toBe('msphuonganhums');
      expect(profile.assignedClassId).toBe('6A1');
    });

    it('1.6: Authenticates successfully when input is the full email address', async () => {
      const { profile } = await signInWithUsernameOrEmail('msphuonganhums@ums.edu.vn', 'demo@2026');
      expect(profile.username).toBe('msphuonganhums');
    });

    it('1.7: Rejects empty, whitespace-only, or domain-only username inputs', async () => {
      await expect(signInWithUsernameOrEmail('', 'demo@2026')).rejects.toThrow();
      await expect(signInWithUsernameOrEmail('   ', 'demo@2026')).rejects.toThrow();
      await expect(signInWithUsernameOrEmail('@ums.edu.vn', 'demo@2026')).rejects.toThrow();
    });

    it('1.8: Verifies Account Roster Mapping against CORRECTION #2 (2026-09-29T11:48:58Z)', () => {
      const { users } = generateSeedDataset();

      // Check principal account mshuyentrangums
      const msHuyenTrang = users.find((u) => u.username === 'mshuyentrangums');
      // Check whether separate GVCN account msthanhhuyenums exists
      const msThanhHuyen = users.find((u) => u.username === 'msthanhhuyenums');

      // CORRECTION #2 requires:
      // mshuyentrangums: Principal -> Admin only, NOT GVCN of 7A3, assignedClassId: undefined
      // msthanhhuyenums: Nguyễn Phương Minh Hạnh -> GVCN 7A3 (regular, not admin)
      // Check if seedService reflects this:
      expect(msThanhHuyen, 'CORRECTION #2 defect: msthanhhuyenums account should exist for GVCN 7A3').toBeDefined();
      expect(msHuyenTrang?.roles, 'CORRECTION #2 defect: mshuyentrangums should be Admin ONLY').toEqual(['admin']);
      expect(msHuyenTrang?.assignedClassId, 'CORRECTION #2 defect: mshuyentrangums should not be assigned to 7A3').toBeUndefined();
    });
  });

  // =========================================================================
  // MISSION ITEM 2: Mandatory Password Change Enforcement & Modal Bypass Testing
  // =========================================================================
  describe('Mission Item 2: Mandatory Password Change Enforcement & Bypass Resistance', () => {
    it('2.1: Enforces mustChangePassword flag on newly seeded accounts upon initial login', async () => {
      const { profile } = await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      expect(profile.mustChangePassword).toBe(true);
    });

    it('2.2: Intercepts protected routes and blocks underlying content when mustChangePassword is true', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<div data-testid="secret-dashboard">Sensitive Data</div>} />
                  <Route path="/logbook" element={<div data-testid="secret-logbook">Sensitive Logbook</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </LanguageProvider>
      );

      // Verify that the protected page content is NOT rendered
      expect(screen.queryByTestId('secret-dashboard')).toBeNull();

      // Verify that ForcePasswordChangeModal is rendered
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Quy định bảo mật mật khẩu/i)).toBeInTheDocument();
    });

    it('2.3: Blocks route navigation bypass while mustChangePassword is true', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={['/logbook']}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route path="/logbook" element={<div data-testid="secret-logbook">Secret Logbook Content</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </LanguageProvider>
      );

      // Direct URL entry to /logbook must still be intercepted
      expect(screen.queryByTestId('secret-logbook')).toBeNull();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('2.4: Modal cannot be dismissed via Cancel button or backdrop when isMandatory=true', () => {
      const onCloseSpy = vi.fn();

      render(
        <LanguageProvider>
          <AuthProvider>
            <ForcePasswordChangeModal isOpen={true} isMandatory={true} onClose={onCloseSpy} />
          </AuthProvider>
        </LanguageProvider>
      );

      // Cancel button should NOT exist when isMandatory is true
      expect(screen.queryByRole('button', { name: /hủy|cancel/i })).toBeNull();

      // Clicking the modal backdrop should NOT invoke onClose
      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Pressing Escape should NOT invoke onClose or dismiss modal
      fireEvent.keyDown(backdrop, { key: 'Escape', code: 'Escape' });
      expect(onCloseSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // MISSION ITEM 3: Password Change Validation (Security Invariants)
  // =========================================================================
  describe('Mission Item 3: Password Change Validation Rules', () => {
    it('3.1: Modal disables submit and rejects default password demo@2026', async () => {
      render(
        <LanguageProvider>
          <AuthProvider>
            <ForcePasswordChangeModal isOpen={true} isMandatory={true} />
          </AuthProvider>
        </LanguageProvider>
      );

      const newPassInput = screen.getByPlaceholderText('Nhập mật khẩu mới...');
      const confirmPassInput = screen.getByPlaceholderText('Nhập lại mật khẩu mới...');
      const submitBtn = screen.getByRole('button', { name: /cập nhật mật khẩu/i });

      fireEvent.change(newPassInput, { target: { value: 'demo@2026' } });
      fireEvent.change(confirmPassInput, { target: { value: 'demo@2026' } });

      // Button must remain disabled because isNotDefault criterion is false
      expect(submitBtn).toBeDisabled();
    });

    it('3.2: Modal rejects short passwords (< 8 characters)', () => {
      render(
        <LanguageProvider>
          <AuthProvider>
            <ForcePasswordChangeModal isOpen={true} isMandatory={true} />
          </AuthProvider>
        </LanguageProvider>
      );

      const newPassInput = screen.getByPlaceholderText('Nhập mật khẩu mới...');
      const confirmPassInput = screen.getByPlaceholderText('Nhập lại mật khẩu mới...');
      const submitBtn = screen.getByRole('button', { name: /cập nhật mật khẩu/i });

      // 7 characters password with Upper, Lower, Number
      fireEvent.change(newPassInput, { target: { value: 'Abc123!' } });
      fireEvent.change(confirmPassInput, { target: { value: 'Abc123!' } });

      expect(submitBtn).toBeDisabled();
    });

    it('3.3: Modal rejects passwords missing uppercase letters', () => {
      render(
        <LanguageProvider>
          <AuthProvider>
            <ForcePasswordChangeModal isOpen={true} isMandatory={true} />
          </AuthProvider>
        </LanguageProvider>
      );

      const newPassInput = screen.getByPlaceholderText('Nhập mật khẩu mới...');
      const confirmPassInput = screen.getByPlaceholderText('Nhập lại mật khẩu mới...');
      const submitBtn = screen.getByRole('button', { name: /cập nhật mật khẩu/i });

      // >=8 chars, has lowercase & numbers, but NO uppercase
      fireEvent.change(newPassInput, { target: { value: 'securedemo_pass_x' } });
      fireEvent.change(confirmPassInput, { target: { value: 'securedemo_pass_x' } });

      expect(submitBtn).toBeDisabled();
    });

    it('3.4: Modal rejects passwords missing lowercase letters', () => {
      render(
        <LanguageProvider>
          <AuthProvider>
            <ForcePasswordChangeModal isOpen={true} isMandatory={true} />
          </AuthProvider>
        </LanguageProvider>
      );

      const newPassInput = screen.getByPlaceholderText('Nhập mật khẩu mới...');
      const confirmPassInput = screen.getByPlaceholderText('Nhập lại mật khẩu mới...');
      const submitBtn = screen.getByRole('button', { name: /cập nhật mật khẩu/i });

      // >=8 chars, has uppercase & numbers, but NO lowercase
      fireEvent.change(newPassInput, { target: { value: 'SECUREPASSWORD123' } });
      fireEvent.change(confirmPassInput, { target: { value: 'SECUREPASSWORD123' } });

      expect(submitBtn).toBeDisabled();
    });

    it('3.5: Modal rejects passwords missing numeric digits', () => {
      render(
        <LanguageProvider>
          <AuthProvider>
            <ForcePasswordChangeModal isOpen={true} isMandatory={true} />
          </AuthProvider>
        </LanguageProvider>
      );

      const newPassInput = screen.getByPlaceholderText('Nhập mật khẩu mới...');
      const confirmPassInput = screen.getByPlaceholderText('Nhập lại mật khẩu mới...');
      const submitBtn = screen.getByRole('button', { name: /cập nhật mật khẩu/i });

      // >=8 chars, has uppercase & lowercase, but NO digits
      fireEvent.change(newPassInput, { target: { value: 'SecurePasswordWithoutNumbers' } });
      fireEvent.change(confirmPassInput, { target: { value: 'SecurePasswordWithoutNumbers' } });

      expect(submitBtn).toBeDisabled();
    });

    it('3.6: Modal rejects mismatched password confirmation', () => {
      render(
        <LanguageProvider>
          <AuthProvider>
            <ForcePasswordChangeModal isOpen={true} isMandatory={true} />
          </AuthProvider>
        </LanguageProvider>
      );

      const newPassInput = screen.getByPlaceholderText('Nhập mật khẩu mới...');
      const confirmPassInput = screen.getByPlaceholderText('Nhập lại mật khẩu mới...');
      const submitBtn = screen.getByRole('button', { name: /cập nhật mật khẩu/i });

      fireEvent.change(newPassInput, { target: { value: 'ValidPass123#' } });
      fireEvent.change(confirmPassInput, { target: { value: 'MismatchPass123#' } });

      expect(submitBtn).toBeDisabled();
    });

    it('3.7: Service layer validation: checks if authService rejects weak passwords', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      // Rejects default password demo@2026
      await expect(changePassword('demo@2026', 'demo@2026')).rejects.toThrow();

      // Rejects short password <8 chars
      await expect(changePassword('demo@2026', 'Ab1!')).rejects.toThrow();

      // Check whether service layer enforces full complexity (defense-in-depth)
      // Note: If authService accepts 'alllowercase123', this identifies a defense-in-depth weakness
      let acceptedWeak = false;
      try {
        await changePassword('demo@2026', 'alllowercase123');
        acceptedWeak = true;
      } catch (err) {
        acceptedWeak = false;
      }

      // We assert whether service layer validates complexity or if it was only implemented in UI:
      expect(
        acceptedWeak,
        'DEFENSE-IN-DEPTH DEFECT: authService.changePassword accepted password missing uppercase letters!'
      ).toBe(false);
    });

    it('3.8: Accepts strong compliant password and lifts mustChangePassword', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      const strongPassword = 'StrongPassword@2026';
      await changePassword('demo@2026', strongPassword);

      const userRaw = localStorage.getItem('ums_current_user');
      expect(userRaw).not.toBeNull();
      const profile = JSON.parse(userRaw!);
      expect(profile.mustChangePassword).toBe(false);
    });
  });

  // =========================================================================
  // MISSION ITEM 4: Session Idle Timeout & Multi-Tab Synchronization
  // =========================================================================
  describe('Mission Item 4: Session Idle Timeout, Activity Reset & Countdown Warning', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('4.1: Activity tracker resets on user interaction after throttle duration (15s)', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      const startTime = 1000000000;
      vi.setSystemTime(startTime);
      localStorage.setItem('ums_last_activity', startTime.toString());

      render(
        <LanguageProvider>
          <AuthProvider>
            <AuthContextSpy />
          </AuthProvider>
        </LanguageProvider>
      );

      // Advance time by 20 seconds (greater than THROTTLE_ACTIVITY_MS = 15s)
      act(() => {
        vi.advanceTimersByTime(20000);
      });

      // Fire a user activity event (mousemove)
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove'));
      });

      // Verify that ums_last_activity was updated
      const updatedActivity = parseInt(localStorage.getItem('ums_last_activity') || '0', 10);
      expect(updatedActivity).toBe(startTime + 20000);
    });

    it('4.2: Displays advance warning countdown modal when idle for 28 minutes', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      const startTime = 1000000000;
      vi.setSystemTime(startTime);
      localStorage.setItem('ums_last_activity', startTime.toString());

      render(
        <LanguageProvider>
          <AuthProvider>
            <AuthContextSpy />
            <SessionTimeoutModal />
          </AuthProvider>
        </LanguageProvider>
      );

      // Warning should NOT be visible initially
      expect(screen.getByTestId('is-idle-warning')).toHaveTextContent('false');

      // Advance time to 28 minutes (28 * 60 * 1000 = 1,680,000 ms)
      act(() => {
        vi.advanceTimersByTime(28 * 60 * 1000);
      });

      // Trigger the 10-second idle check interval
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Warning should now be open!
      expect(screen.getByTestId('is-idle-warning')).toHaveTextContent('true');
      expect(screen.getByText(/Phiên làm việc của bạn sắp kết thúc/i)).toBeInTheDocument();

      // Remaining countdown seconds should start at ~120 or lower
      const remainingSeconds = parseInt(screen.getByTestId('idle-remaining').textContent || '0', 10);
      expect(remainingSeconds).toBeLessThanOrEqual(120);
      expect(remainingSeconds).toBeGreaterThan(0);
    });

    it('4.3: Extends session and dismisses warning when extendSession is invoked', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      const startTime = 1000000000;
      vi.setSystemTime(startTime);
      localStorage.setItem('ums_last_activity', startTime.toString());

      render(
        <LanguageProvider>
          <AuthProvider>
            <AuthContextSpy />
            <SessionTimeoutModal />
          </AuthProvider>
        </LanguageProvider>
      );

      // Advance to 28 minutes to open warning
      act(() => {
        vi.advanceTimersByTime(28 * 60 * 1000 + 10000);
      });
      expect(screen.getByTestId('is-idle-warning')).toHaveTextContent('true');

      // Click "Duy trì đăng nhập" (extend session button in modal)
      const stayLoggedInBtn = screen.getByRole('button', { name: /duy trì đăng nhập/i });
      act(() => {
        fireEvent.click(stayLoggedInBtn);
      });

      // Warning must now be closed and countdown dismissed
      expect(screen.getByTestId('is-idle-warning')).toHaveTextContent('false');
    });

    it('4.4: Logs user out automatically when idle reaches 30 minutes without interaction', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      const startTime = 1000000000;
      vi.setSystemTime(startTime);
      localStorage.setItem('ums_last_activity', startTime.toString());

      render(
        <LanguageProvider>
          <AuthProvider>
            <AuthContextSpy />
            <SessionTimeoutModal />
          </AuthProvider>
        </LanguageProvider>
      );

      // Advance time directly past 30 minutes (30 * 60 * 1000 = 1,800,000 ms) + 10s check
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 10000);
      });

      // User state must be cleared after async logout finishes
      expect(localStorage.getItem('ums_logout_reason')).toBe('idle_timeout');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
      expect(localStorage.getItem('ums_current_user')).toBeNull();
    });

    it('4.5: Synchronizes activity across multiple browser tabs via storage event', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      const startTime = 1000000000;
      vi.setSystemTime(startTime);
      localStorage.setItem('ums_last_activity', startTime.toString());

      render(
        <LanguageProvider>
          <AuthProvider>
            <AuthContextSpy />
            <SessionTimeoutModal />
          </AuthProvider>
        </LanguageProvider>
      );

      // Advance to 28 minutes step by step
      await act(async () => {
        await vi.advanceTimersByTimeAsync(28 * 60 * 1000 + 10000);
      });

      expect(screen.getByTestId('is-idle-warning')).toHaveTextContent('true');

      // Simulate user activity occurring in Tab B (updating ums_last_activity)
      const tabBTime = startTime + 28 * 60 * 1000 + 15000;
      await act(async () => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'ums_last_activity',
            newValue: tabBTime.toString(),
          })
        );
      });

      // Tab A should detect activity and close idle warning
      expect(screen.getByTestId('is-idle-warning')).toHaveTextContent('false');
    });
  });
});
