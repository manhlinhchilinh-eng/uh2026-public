import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { seedMockStorage, generateSeedDataset } from '../services/seedService';
import { signInWithUsernameOrEmail } from '../services/authService';
import { AuthProvider, useAuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';

// Helper component to test AuthContext hooks in React
const TestAuthConsumer: React.FC = () => {
  const { profile, activeRole, switchActiveRole, hasRole, canAccessClass } =
    useAuthContext();

  return (
    <div>
      <div data-testid="user-username">{profile?.username || 'no-user'}</div>
      <div data-testid="active-role">{activeRole || 'no-role'}</div>
      <div data-testid="assigned-class">{profile?.assignedClassId || 'no-class'}</div>
      <div data-testid="is-admin">{hasRole('admin') ? 'true' : 'false'}</div>
      <div data-testid="is-gvcn">{hasRole('gvcn') ? 'true' : 'false'}</div>
      <div data-testid="can-access-8a3">{canAccessClass('8A3') ? 'true' : 'false'}</div>

      <button
        onClick={() => switchActiveRole('gvcn')}
        data-testid="switch-to-gvcn"
      >
        Switch to GVCN
      </button>
      <button
        onClick={() => switchActiveRole('admin')}
        data-testid="switch-to-admin"
      >
        Switch to Admin
      </button>
      <button
        onClick={() => switchActiveRole('gvbm')}
        data-testid="switch-to-gvbm"
      >
        Switch to GVBM
      </button>
    </div>
  );
};

describe('RBAC, Dual-Role Identity & Seed Roster Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    seedMockStorage();
  });

  describe('Seed Dataset Integrity', () => {
    it('seeds exactly 26 classes, 674 students, and 29 users', () => {
      const { classes, students, users, scoringConfig } = generateSeedDataset();

      expect(classes.length).toBe(26);
      expect(students.length).toBe(674);
      expect(users.length).toBe(29);

      // Verify unique student IDs
      const studentIds = new Set(students.map((s) => s.mhs));
      expect(studentIds.size).toBe(674);

      // Verify scoring criteria
      expect(scoringConfig.criteria.length).toBe(4);
      expect(scoringConfig.maxTotal).toBe(10.0);
    });

    it('verifies dual-role configurations for school leadership', () => {
      const { users } = generateSeedDataset();

      // mrlinhums: Admin + GVCN 9A3
      const mrLinh = users.find((u) => u.username === 'mrlinhums');
      expect(mrLinh).toBeDefined();
      expect(mrLinh?.roles).toContain('admin');
      expect(mrLinh?.roles).toContain('gvcn');
      expect(mrLinh?.roles).toContain('gvbm');
      expect(mrLinh?.assignedClassId).toBe('9A3');
      expect(mrLinh?.displayName).toBe('Nguyễn Mạnh Linh');

      // msngoclinhums: GVCN 8A3
      const msNgocLinh = users.find((u) => u.username === 'msngoclinhums');
      expect(msNgocLinh).toBeDefined();
      expect(msNgocLinh?.roles).toContain('gvcn');
      expect(msNgocLinh?.roles).not.toContain('admin');
      expect(msNgocLinh?.assignedClassId).toBe('8A3');
      expect(msNgocLinh?.displayName).toBe('Hồ Thanh Quang Uyên');

      // msthanhhuyenums: GVCN 7A3
      const msThanhHuyen = users.find((u) => u.username === 'msthanhhuyenums');
      expect(msThanhHuyen).toBeDefined();
      expect(msThanhHuyen?.roles).toContain('gvcn');
      expect(msThanhHuyen?.roles).toContain('gvbm');
      expect(msThanhHuyen?.roles).not.toContain('admin');
      expect(msThanhHuyen?.assignedClassId).toBe('7A3');
      expect(msThanhHuyen?.displayName).toBe('Nguyễn Phương Minh Hạnh');

      // mshuyentrangums: Principal (Admin only)
      const msHuyenTrang = users.find((u) => u.username === 'mshuyentrangums');
      expect(msHuyenTrang).toBeDefined();
      expect(msHuyenTrang?.roles).toEqual(['admin']);
      expect(msHuyenTrang?.assignedClassId).toBeUndefined();
      expect(msHuyenTrang?.displayName).toBe('Hiệu trưởng / Principal');

      // mrhoanggiangums: Admin only
      const mrHoangGiang = users.find((u) => u.username === 'mrhoanggiangums');
      expect(mrHoangGiang).toBeDefined();
      expect(mrHoangGiang?.roles).toEqual(['admin']);
      expect(mrHoangGiang?.assignedClassId).toBeUndefined();

      // mrhoanglongums: TPT
      const mrHoangLong = users.find((u) => u.username === 'mrhoanglongums');
      expect(mrHoangLong).toBeDefined();
      expect(mrHoangLong?.roles).toEqual(['tpt']);
      expect(mrHoangLong?.assignedClassId).toBeUndefined();
    });
  });

  describe('Dual-Role Perspective Switching in AuthContext', () => {
    it('allows dual-role user mrlinhums to switch perspective between admin and gvcn', async () => {
      // Simulate authenticating as mrlinhums
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <TestAuthConsumer />
          </AuthProvider>
        </LanguageProvider>
      );

      // Verify user loaded
      expect(screen.getByTestId('user-username')).toHaveTextContent('mrlinhums');
      expect(screen.getByTestId('assigned-class')).toHaveTextContent('9A3');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
      expect(screen.getByTestId('is-gvcn')).toHaveTextContent('true');

      // Initial priority role should be admin
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');

      // Switch to GVCN
      await act(async () => {
        screen.getByTestId('switch-to-gvcn').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');

      // Switch to GVBM
      await act(async () => {
        screen.getByTestId('switch-to-gvbm').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvbm');

      // Switch back to Admin
      await act(async () => {
        screen.getByTestId('switch-to-admin').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');
    });
  });
});
