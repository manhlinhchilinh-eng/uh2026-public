import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  DEFAULT_PASSWORD_HASH,
} from '../utils/crypto';
import { DEFAULT_PASSWORD_RAW } from './fixtures/defaultPassword';
import { seedMockStorage } from '../services/seedService';

describe('Web Crypto API Password Hashing Utilities', () => {
  it('hashes default password demo@2026 to expected SHA-256 hex string', async () => {
    const hash = await hashPassword(DEFAULT_PASSWORD_RAW);
    expect(hash).toBe(DEFAULT_PASSWORD_HASH);
    expect(hash).toBe('56d8c422bc5ae8560b7784552525471ae00c1547ef6527ab7cca4f3c5cb2e6cd');
  });

  it('produces 64-character lowercase hexadecimal hash', async () => {
    const hash = await hashPassword('SamplePassword#2026');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces distinct hashes for different passwords', async () => {
    const hash1 = await hashPassword('Password123!');
    const hash2 = await hashPassword('Password123?');
    expect(hash1).not.toBe(hash2);
  });

  it('verifies correct password returns true', async () => {
    const isMatch = await verifyPassword(DEFAULT_PASSWORD_RAW, DEFAULT_PASSWORD_HASH);
    expect(isMatch).toBe(true);
  });

  it('verifies wrong password returns false', async () => {
    const isMatch = await verifyPassword('wrongpassword', DEFAULT_PASSWORD_HASH);
    expect(isMatch).toBe(false);
  });

  it('handles case-insensitive stored hash verification', async () => {
    const isMatch = await verifyPassword(
      DEFAULT_PASSWORD_RAW,
      DEFAULT_PASSWORD_HASH.toUpperCase()
    );
    expect(isMatch).toBe(true);
  });

  it('rejects empty password or empty hash safely', async () => {
    expect(await verifyPassword('', DEFAULT_PASSWORD_HASH)).toBe(false);
    expect(await verifyPassword(DEFAULT_PASSWORD_RAW, '')).toBe(false);
    await expect(hashPassword('')).rejects.toThrow();
  });

  it('guarantees seedMockStorage persists zero cleartext passwords in localStorage', () => {
    localStorage.clear();
    seedMockStorage();
    const raw = localStorage.getItem('ums_users');
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('"password":');
    expect(raw).not.toContain('"demo@2026"');
    expect(raw).toContain(DEFAULT_PASSWORD_HASH);
    const parsed = JSON.parse(raw!);
    expect(parsed.length).toBe(29);
    for (const u of parsed) {
      expect(u.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
      expect(u.password).toBeUndefined();
    }
  });
});
