/**
 * UMS Digital Class Logbook - Challenger M1 Iteration 2 Adversarial Test Suite
 *
 * Empirical verification of:
 * 1. Web Crypto SHA-256 standard test vectors and constant-time comparison.
 * 2. Storage sanitization (zero cleartext passwords in localStorage before and after change).
 * 3. Defense-in-depth service-level password complexity validation in authService.
 * 4. Legacy storage migration & credential leak prevention.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  hashPassword,
  verifyPassword,
  DEFAULT_PASSWORD_HASH,
} from '../utils/crypto';
import { DEFAULT_PASSWORD_RAW } from './fixtures/defaultPassword';
import {
  signInWithUsernameOrEmail,
  changePassword,
  validatePasswordComplexity,
} from '../services/authService';
import { seedMockStorage, generateSeedDataset } from '../services/seedService';

describe('CHALLENGER M1 ITERATION 2: EMPIRICAL ADVERSARIAL SUITE', () => {
  beforeEach(() => {
    localStorage.clear();
    seedMockStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. CRYPTOGRAPHIC INTEGRITY & CONSTANT-TIME VERIFICATION
  // =========================================================================
  describe('1. Web Crypto SHA-256 Hashing & Verification Engine', () => {
    it('1.1: Matches standard NIST/RFC test vector "abc"', async () => {
      const hash = await hashPassword('abc');
      const expected = crypto.createHash('sha256').update('abc').digest('hex');
      expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      expect(hash).toBe(expected);
    });

    it('1.2: Matches standard test vector "The quick brown fox jumps over the lazy dog"', async () => {
      const input = 'The quick brown fox jumps over the lazy dog';
      const hash = await hashPassword(input);
      const expected = crypto.createHash('sha256').update(input).digest('hex');
      expect(hash).toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
      expect(hash).toBe(expected);
    });

    it('1.3: Matches standard multi-block test vector (56 bytes)', async () => {
      const input = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
      const hash = await hashPassword(input);
      const expected = crypto.createHash('sha256').update(input).digest('hex');
      expect(hash).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
      expect(hash).toBe(expected);
    });

    it('1.4: Matches UTF-8 Vietnamese diacritics input vector', async () => {
      const input = 'Trường THCS Ngoại Ngữ - Sổ đầu bài điện tử UMS @ 2026!';
      const hash = await hashPassword(input);
      const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
      expect(hash).toBe(expected);
    });

    it('1.5: Verifies DEFAULT_PASSWORD_RAW hashes strictly to DEFAULT_PASSWORD_HASH', async () => {
      const hash = await hashPassword(DEFAULT_PASSWORD_RAW);
      const expected = crypto.createHash('sha256').update('demo@2026').digest('hex');
      expect(hash).toBe(DEFAULT_PASSWORD_HASH);
      expect(hash).toBe(expected);
      expect(hash).toBe('56d8c422bc5ae8560b7784552525471ae00c1547ef6527ab7cca4f3c5cb2e6cd');
    });

    it('1.6: Empty string or whitespace-only password handling in hashPassword', async () => {
      await expect(hashPassword('')).rejects.toThrow('Mật khẩu không được để trống khi băm.');
    });

    it('1.7: Constant-time verifyPassword returns true for matching password and hash', async () => {
      const isMatch = await verifyPassword(DEFAULT_PASSWORD_RAW, DEFAULT_PASSWORD_HASH);
      expect(isMatch).toBe(true);
    });

    it('1.8: Constant-time verifyPassword supports case-insensitive hash input', async () => {
      const upperHash = DEFAULT_PASSWORD_HASH.toUpperCase();
      const isMatch = await verifyPassword(DEFAULT_PASSWORD_RAW, upperHash);
      expect(isMatch).toBe(true);
    });

    it('1.9: Constant-time verifyPassword rejects mismatching length hashes without throwing', async () => {
      // Truncated hashes
      expect(await verifyPassword('demo@2026', '5c46114204634a10bc81340b6d441e18')).toBe(false);
      expect(await verifyPassword('demo@2026', DEFAULT_PASSWORD_HASH.slice(0, 63))).toBe(false);
      // Extended hashes
      expect(await verifyPassword('demo@2026', DEFAULT_PASSWORD_HASH + '0')).toBe(false);
      expect(await verifyPassword('demo@2026', ' ' + DEFAULT_PASSWORD_HASH)).toBe(false);
    });

    it('1.10: Constant-time verifyPassword rejects single-character bit flips across all 64 positions', async () => {
      const baseHash = DEFAULT_PASSWORD_HASH;
      for (let i = 0; i < baseHash.length; i++) {
        // Substitute character with a different hex char
        const originalChar = baseHash[i];
        const perturbedChar = originalChar === 'a' ? 'b' : 'a';
        const perturbedHash =
          baseHash.substring(0, i) + perturbedChar + baseHash.substring(i + 1);

        const result = await verifyPassword(DEFAULT_PASSWORD_RAW, perturbedHash);
        expect(result, `Failed to reject perturbed hash at index ${i}`).toBe(false);
      }
    });

    it('1.11: Constant-time verifyPassword rejects null/empty/undefined inputs gracefully', async () => {
      expect(await verifyPassword('', DEFAULT_PASSWORD_HASH)).toBe(false);
      expect(await verifyPassword(DEFAULT_PASSWORD_RAW, '')).toBe(false);
      expect(await verifyPassword(null as any, DEFAULT_PASSWORD_HASH)).toBe(false);
      expect(await verifyPassword(DEFAULT_PASSWORD_RAW, null as any)).toBe(false);
      expect(await verifyPassword(undefined as any, undefined as any)).toBe(false);
    });
  });

  // =========================================================================
  // 2. STORAGE SANITIZATION & LEAK PREVENTION
  // =========================================================================
  describe('2. Storage Sanitization & Zero Plaintext Credentials', () => {
    it('2.1: Inspects localStorage ums_users after initial seeding for zero plaintext passwords', () => {
      const raw = localStorage.getItem('ums_users');
      expect(raw).not.toBeNull();

      // Adversarial scan of raw JSON payload
      expect(raw).not.toContain('"password":');
      expect(raw).not.toContain('"demo@2026"');
      expect(raw).toContain(DEFAULT_PASSWORD_HASH);

      const users = JSON.parse(raw!);
      expect(users.length).toBe(29);

      for (const u of users) {
        expect(u.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
        expect(u.password).toBeUndefined();
        expect(Object.keys(u)).not.toContain('password');
      }
    });

    it('2.2: Inspects localStorage ums_users and ums_current_user after password change', async () => {
      // Sign in as mrlinhums
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      const newPass = 'SuperSecurePass2026!';
      const expectedNewHash = await hashPassword(newPass);

      await changePassword('demo@2026', newPass);

      // Verify ums_users in localStorage
      const usersRaw = localStorage.getItem('ums_users');
      expect(usersRaw).not.toBeNull();
      expect(usersRaw).not.toContain(newPass);
      expect(usersRaw).not.toContain('"password":');

      const users = JSON.parse(usersRaw!);
      const mrlinh = users.find((u: any) => u.username === 'mrlinhums');
      expect(mrlinh).toBeDefined();
      expect(mrlinh.passwordHash).toBe(expectedNewHash);
      expect(mrlinh.password).toBeUndefined();
      expect(mrlinh.mustChangePassword).toBe(false);

      // Verify ums_current_user in localStorage
      const currentRaw = localStorage.getItem('ums_current_user');
      expect(currentRaw).not.toBeNull();
      expect(currentRaw).not.toContain(newPass);
      expect(currentRaw).not.toContain('passwordHash');
      expect(currentRaw).not.toContain('"password":');

      const currentUser = JSON.parse(currentRaw!);
      expect(currentUser.password).toBeUndefined();
      expect(currentUser.passwordHash).toBeUndefined();
      expect(currentUser.mustChangePassword).toBe(false);
    });

    it('2.3: Automatically purges legacy plaintext password property on getMockUsers execution', async () => {
      // Inject legacy contaminated record directly into localStorage
      const legacyUsers = [
        {
          uid: 'user_legacy_test',
          username: 'testlegacy',
          email: 'testlegacy@ums.edu.vn',
          displayName: 'Test Legacy User',
          roles: ['gvcn'],
          assignedClassId: '6A1',
          mustChangePassword: true,
          password: 'leaked_plaintext_password_123', // LEGACY CONTAMINATION
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem('ums_users', JSON.stringify(legacyUsers));

      // Trigger authentication which invokes getMockUsers()
      try {
        await signInWithUsernameOrEmail('testlegacy', 'demo@2026');
      } catch {
        // May fail or succeed depending on password, but getMockUsers() will have run
      }

      const sanitizedRaw = localStorage.getItem('ums_users');
      expect(sanitizedRaw).not.toBeNull();
      expect(sanitizedRaw).not.toContain('leaked_plaintext_password_123');
      expect(sanitizedRaw).not.toContain('"password":');

      const sanitized = JSON.parse(sanitizedRaw!);
      expect(sanitized[0].password).toBeUndefined();
      expect(sanitized[0].passwordHash).toBe(DEFAULT_PASSWORD_HASH);
    });

    it('2.4: Generates clean Firestore seed without exposing passwordHash or password', () => {
      const { users } = generateSeedDataset();
      expect(users.length).toBe(29);
      for (const u of users) {
        expect(u.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
        expect((u as any).password).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // 3. SERVICE-LEVEL PASSWORD COMPLEXITY ENFORCEMENT
  // =========================================================================
  describe('3. Service-Level Password Complexity (authService.changePassword)', () => {
    it('3.1: Directly validates validatePasswordComplexity rejection rules', () => {
      // Empty or short
      expect(() => validatePasswordComplexity('')).toThrow('Mật khẩu mới phải có ít nhất 8 ký tự.');
      expect(() => validatePasswordComplexity('Ab1!')).toThrow('Mật khẩu mới phải có ít nhất 8 ký tự.');
      expect(() => validatePasswordComplexity('1234567')).toThrow('Mật khẩu mới phải có ít nhất 8 ký tự.');

      // Mật khẩu mặc định cũ không có chữ hoa → bị chặn bởi quy tắc chữ hoa
      expect(() => validatePasswordComplexity('demo@2026')).toThrow(
        'Mật khẩu phải chứa ít nhất một chữ in hoa (A-Z).'
      );
      expect(() => validatePasswordComplexity('  demo@2026  ')).toThrow(
        'Mật khẩu phải chứa ít nhất một chữ in hoa (A-Z).'
      );

      // Missing uppercase
      expect(() => validatePasswordComplexity('alllowercase123')).toThrow(
        'Mật khẩu phải chứa ít nhất một chữ in hoa (A-Z).'
      );
      expect(() => validatePasswordComplexity('lowercase@2026')).toThrow(
        'Mật khẩu phải chứa ít nhất một chữ in hoa (A-Z).'
      );

      // Missing lowercase
      expect(() => validatePasswordComplexity('ALLUPPERCASE123')).toThrow(
        'Mật khẩu phải chứa ít nhất một chữ thường (a-z).'
      );
      expect(() => validatePasswordComplexity('UPPERCASE@2026')).toThrow(
        'Mật khẩu phải chứa ít nhất một chữ thường (a-z).'
      );

      // Missing digit
      expect(() => validatePasswordComplexity('PasswordWithoutDigits!')).toThrow(
        'Mật khẩu phải chứa ít nhất một chữ số (0-9).'
      );
      expect(() => validatePasswordComplexity('OnlyLettersAbc')).toThrow(
        'Mật khẩu phải chứa ít nhất một chữ số (0-9).'
      );

      // Compliant passwords
      expect(() => validatePasswordComplexity('ValidPassword123')).not.toThrow();
      expect(() => validatePasswordComplexity('Demo@2027Strong!')).not.toThrow();
      expect(() => validatePasswordComplexity('Abcdefg1')).not.toThrow();
    });

    it('3.2: Rejects weak passwords via changePassword and does NOT mutate stored state', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      const testWeakPasswords = [
        { pass: 'short1A', expectedErr: /ít nhất 8 ký tự/i },
        { pass: 'demo@2026', expectedErr: /không được trùng/i },
        { pass: 'alllowercase123', expectedErr: /ít nhất một chữ in hoa/i },
        { pass: 'ALLUPPERCASE123', expectedErr: /ít nhất một chữ thường/i },
        { pass: 'PasswordNoDigits!', expectedErr: /ít nhất một chữ số/i },
      ];

      for (const item of testWeakPasswords) {
        await expect(
          changePassword('demo@2026', item.pass),
          `Expected changePassword to reject: ${item.pass}`
        ).rejects.toThrow(item.expectedErr);

        // Verify mrlinhums still has DEFAULT_PASSWORD_HASH in storage
        const users = JSON.parse(localStorage.getItem('ums_users')!);
        const mrlinh = users.find((u: any) => u.username === 'mrlinhums');
        expect(mrlinh.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
        expect(mrlinh.mustChangePassword).toBe(true);
      }
    });

    it('3.3: Rejects changePassword when currentPassword is wrong', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      await expect(
        changePassword('wrongDefaultPass', 'ValidNewPass123!')
      ).rejects.toThrow('Mật khẩu hiện tại không chính xác.');

      const users = JSON.parse(localStorage.getItem('ums_users')!);
      const mrlinh = users.find((u: any) => u.username === 'mrlinhums');
      expect(mrlinh.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
    });

    it('3.4: Successfully changes password and allows re-login with new password while old password fails', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      const newPass = 'UmsNewSecret2026!';
      await changePassword('demo@2026', newPass);

      // Verify old password now fails
      await expect(
        signInWithUsernameOrEmail('mrlinhums', 'demo@2026')
      ).rejects.toThrow('Mật khẩu không chính xác.');

      // Verify new password succeeds
      const { profile } = await signInWithUsernameOrEmail('mrlinhums', newPass);
      expect(profile.username).toBe('mrlinhums');
      expect(profile.mustChangePassword).toBe(false);
    });
  });
});
