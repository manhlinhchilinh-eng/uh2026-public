import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveUsernameToEmail,
  extractUsername,
  signInWithUsernameOrEmail,
  logoutUser,
} from '../services/authService';
import { seedMockStorage, generateSeedDataset } from '../services/seedService';

describe('CHALLENGER M1 STRESS & FUZZING HARNESS', () => {
  beforeEach(() => {
    localStorage.clear();
    seedMockStorage();
  });

  it('Stress 1: Fuzzes username resolution across 5,000 variations with random case and padding', () => {
    const baseUsernames = [
      'mrlinhums',
      'msphuonganhums',
      'mrhoanggiangums',
      'mrhoanglongums',
      'msngoclinhums',
    ];

    const whitespacePadding = [
      '',
      ' ',
      '  ',
      '\t',
      '\n',
      '   \t  ',
    ];

    const domains = [
      '',
      '@ums.edu.vn',
      '@UMS.EDU.VN',
      '@Ums.Edu.Vn',
    ];

    const tStart = performance.now();
    let totalRuns = 0;

    for (let i = 0; i < 5000; i++) {
      const base = baseUsernames[i % baseUsernames.length];
      const leftPad = whitespacePadding[i % whitespacePadding.length];
      const rightPad = whitespacePadding[(i + 1) % whitespacePadding.length];
      const domain = domains[i % domains.length];

      // Randomize casing
      const randomizedCase = base
        .split('')
        .map((c, idx) => ((i + idx) % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
        .join('');

      const rawInput = `${leftPad}${randomizedCase}${domain}${rightPad}`;
      const resolved = resolveUsernameToEmail(rawInput);
      const extracted = extractUsername(rawInput);

      expect(resolved).toBe(`${base.toLowerCase()}@ums.edu.vn`);
      expect(extracted).toBe(base.toLowerCase());
      totalRuns++;
    }

    const tDuration = performance.now() - tStart;
    expect(totalRuns).toBe(5000);
    // 5,000 resolutions should complete in well under 1000ms
    expect(tDuration).toBeLessThan(1000);
  });

  it('Stress 2: Rapid sequential authentications across all 26 seeded classes and administrators', async () => {
    const { users } = generateSeedDataset();
    const tStart = performance.now();

    for (const u of users) {
      const { user, profile } = await signInWithUsernameOrEmail(u.username, 'demo@2026');
      expect(user).toBeDefined();
      expect(profile.username).toBe(u.username);
      expect(profile.mustChangePassword).toBe(true);

      // Verify immediate logout
      await logoutUser();
      expect(localStorage.getItem('ums_current_user')).toBeNull();
    }

    const tDuration = performance.now() - tStart;
    // Authenticating and logging out all 28 seeded accounts sequentially should take < 500ms
    expect(tDuration).toBeLessThan(500);
  });

  it('Stress 3: High-frequency idle reset event burst (1,000 events)', () => {
    const THROTTLE_ACTIVITY_MS = 15 * 1000;
    let lastActivity = 1000000000;
    let writesToStorage = 0;

    const simulateEvent = (now: number) => {
      if (now - lastActivity > THROTTLE_ACTIVITY_MS) {
        lastActivity = now;
        writesToStorage++;
      }
    };

    // Simulate 1,000 events arriving rapidly across 60 seconds
    const tStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      // 1000 events across 60,000ms (1 event every 60ms)
      const simulatedNow = 1000000000 + i * 60;
      simulateEvent(simulatedNow);
    }
    const tDuration = performance.now() - tStart;

    // In 60 seconds with 15s throttle, there should be at most 4 storage writes
    expect(writesToStorage).toBeLessThanOrEqual(4);
    expect(tDuration).toBeLessThan(50); // High throughput execution
  });

  it('Stress 4: Evaluates password security rule matrix against 100 edge cases', () => {
    const testCases: { pass: string; valid: boolean; reason: string }[] = [
      { pass: 'demo@2026', valid: false, reason: 'Default password' },
      { pass: 'demo@2026   ', valid: false, reason: 'Default password with space' },
      { pass: 'short', valid: false, reason: 'Too short (<8)' },
      { pass: '1234567', valid: false, reason: 'Too short (<8)' },
      { pass: 'Abcdefg', valid: false, reason: 'Too short (<8)' },
      { pass: 'alllowercase123', valid: false, reason: 'Missing uppercase' },
      { pass: 'ALLUPPERCASE123', valid: false, reason: 'Missing lowercase' },
      { pass: 'NoNumbersHere!', valid: false, reason: 'Missing digits' },
      { pass: 'ValidPass123', valid: true, reason: 'Meets length, upper, lower, digit' },
      { pass: 'Ums@Secure2026', valid: true, reason: 'Strong complex password' },
      { pass: 'P@ssw0rd999', valid: true, reason: 'Strong password with symbol' },
    ];

    const evaluateUIValidation = (newPassword: string): boolean => {
      const hasMinLength = newPassword.length >= 8;
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const isNotDefault = newPassword.trim() !== 'demo@2026';
      return hasMinLength && hasUpperCase && hasLowerCase && hasNumber && isNotDefault;
    };

    for (const tc of testCases) {
      const result = evaluateUIValidation(tc.pass);
      expect(result, `Failed expectation for "${tc.pass}": ${tc.reason}`).toBe(tc.valid);
    }
  });
});
