import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveUsernameToEmail,
  extractUsername,
  signInWithUsernameOrEmail,
  changePassword,
  logoutUser,
} from '../services/authService';
import { seedMockStorage } from '../services/seedService';

describe('Auth Service & Username Resolution', () => {
  beforeEach(() => {
    localStorage.clear();
    seedMockStorage();
  });

  describe('resolveUsernameToEmail', () => {
    it('appends @ums.edu.vn to plain usernames', () => {
      expect(resolveUsernameToEmail('mrlinhums')).toBe('mrlinhums@ums.edu.vn');
      expect(resolveUsernameToEmail('msphuonganhums')).toBe('msphuonganhums@ums.edu.vn');
      expect(resolveUsernameToEmail('mrhoanglongums')).toBe('mrhoanglongums@ums.edu.vn');
    });

    it('preserves email if already containing @ums.edu.vn', () => {
      expect(resolveUsernameToEmail('mrlinhums@ums.edu.vn')).toBe('mrlinhums@ums.edu.vn');
    });

    it('normalizes uppercase and trims whitespace', () => {
      expect(resolveUsernameToEmail('  MRLinhUMS  ')).toBe('mrlinhums@ums.edu.vn');
      expect(resolveUsernameToEmail('  MsHuyenTrangUMS@ums.edu.vn  ')).toBe(
        'mshuyentrangums@ums.edu.vn'
      );
    });

    it('returns empty string for empty input', () => {
      expect(resolveUsernameToEmail('')).toBe('');
      expect(resolveUsernameToEmail('   ')).toBe('');
    });
  });

  describe('extractUsername', () => {
    it('extracts username from canonical email or raw string', () => {
      expect(extractUsername('mrlinhums@ums.edu.vn')).toBe('mrlinhums');
      expect(extractUsername('mrlinhums')).toBe('mrlinhums');
      expect(extractUsername('  MRLinhUMS@ums.edu.vn ')).toBe('mrlinhums');
    });
  });

  describe('Authentication Lifecycle', () => {
    it('authenticates seeded admin user with default password and flags mustChangePassword', async () => {
      const { user, profile } = await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      expect(user).toBeDefined();
      expect(profile).toBeDefined();
      expect(profile.username).toBe('mrlinhums');
      expect(profile.email).toBe('mrlinhums@ums.edu.vn');
      expect(profile.roles).toContain('admin');
      expect(profile.roles).toContain('gvcn');
      expect(profile.assignedClassId).toBe('9A3');
      expect(profile.displayName).toBe('Nguyễn Mạnh Linh');
      expect(profile.mustChangePassword).toBe(true);
    });

    it('rejects incorrect password with error', async () => {
      await expect(
        signInWithUsernameOrEmail('mrlinhums', 'wrongpassword')
      ).rejects.toThrow();
    });

    it('rejects nonexistent username with error', async () => {
      await expect(
        signInWithUsernameOrEmail('nonexistentuser', 'demo@2026')
      ).rejects.toThrow();
    });

    it('allows changing password and updates mustChangePassword flag', async () => {
      // First login
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      // Change password
      const newPass = 'UmsSecure#2026';
      await changePassword('demo@2026', newPass);

      // Verify that mustChangePassword in localStorage was updated
      const rawUser = localStorage.getItem('ums_current_user');
      expect(rawUser).not.toBeNull();
      const parsedUser = JSON.parse(rawUser!);
      expect(parsedUser.mustChangePassword).toBe(false);

      // Logout
      await logoutUser();

      // Subsequent login with old password fails
      await expect(
        signInWithUsernameOrEmail('mrlinhums', 'demo@2026')
      ).rejects.toThrow();

      // Login with new password succeeds
      const { profile } = await signInWithUsernameOrEmail('mrlinhums', newPass);
      expect(profile.mustChangePassword).toBe(false);
    });

    it('rejects changing password to default demo@2026', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      await expect(changePassword('demo@2026', 'demo@2026')).rejects.toThrow(
        /không được trùng/i
      );
    });

    it('rejects changing password to less than 8 characters', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      await expect(changePassword('demo@2026', 'abc123')).rejects.toThrow(
        /ít nhất 8 ký tự/i
      );
    });

    it('rejects changing password missing uppercase letters', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      await expect(changePassword('demo@2026', 'alllowercase123')).rejects.toThrow(
        /chữ in hoa/i
      );
    });

    it('rejects changing password missing lowercase letters', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      await expect(changePassword('demo@2026', 'ALLUPPERCASE123')).rejects.toThrow(
        /chữ thường/i
      );
    });

    it('rejects changing password missing numeric digits', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      await expect(changePassword('demo@2026', 'LettersOnlyPassword')).rejects.toThrow(
        /chữ số/i
      );
    });
  });
});
