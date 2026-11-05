/**
 * Tier 2: Boundary & Corner Cases - Authentication & Access Control
 * Requirements: ORIGINAL_REQUEST.md (R3, R7), PROJECT.md (F4, F5, F6)
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';
import { assertThrowsContractError } from '../harness/assertions.ts';

test('T2-AUTH-01: Cannot reuse default password "demo@2026" during mandatory change', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);

  assertThrowsContractError(
    () => engine.changePassword(session.token, DEFAULT_PASSWORD, 'demo@2026'),
    'AUTH_DEFAULT_PASSWORD_REUSE'
  );
});

test('T2-AUTH-02: Cannot change password to empty, whitespace-only, or under 6 characters', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);

  assertThrowsContractError(
    () => engine.changePassword(session.token, DEFAULT_PASSWORD, '   '),
    'AUTH_EMPTY_PASSWORD'
  );

  assertThrowsContractError(
    () => engine.changePassword(session.token, DEFAULT_PASSWORD, '12345'),
    'AUTH_PASSWORD_TOO_SHORT'
  );
});

test('T2-AUTH-03: Session expires after 30 minutes of idle inactivity', () => {
  const engine = new UMSContractEngine();
  const loginTime = Date.now();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD, loginTime);

  // Activity 31 minutes later (31 * 60 * 1000 = 1860000ms)
  const expiredTime = loginTime + 31 * 60 * 1000;

  assertThrowsContractError(
    () => engine.validateSession(session.token, expiredTime),
    'AUTH_SESSION_TIMEOUT'
  );
});

test('T2-AUTH-04: Nonexistent user or incorrect password fails authentication cleanly', () => {
  const engine = new UMSContractEngine();

  assertThrowsContractError(
    () => engine.login('nonexistent_user', 'any_password'),
    'AUTH_INVALID_CREDENTIALS'
  );

  assertThrowsContractError(
    () => engine.login('mrlinhums', 'wrong_password'),
    'AUTH_INVALID_CREDENTIALS'
  );
});

test('T2-AUTH-05: Non-admin user cannot modify scoring criteria configuration', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Teacher2026!');

  assertThrowsContractError(
    () => engine.updateScoringConfig(session.token, { customMax: 2.0 }),
    'AUTH_FORBIDDEN'
  );
});

test('T2-AUTH-06: Passwords and sensitive hashes are never exposed in audit logs or state', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'TopSecretNewPass!');

  const auditLogs = engine.getAuditLogs();
  for (const log of auditLogs) {
    const jsonStr = JSON.stringify(log);
    assert.strictEqual(
      jsonStr.includes('TopSecretNewPass!'),
      false,
      'Raw password must not appear in audit log entry'
    );
    assert.strictEqual(
      jsonStr.includes(DEFAULT_PASSWORD),
      false,
      'Default password must not appear in audit log entry'
    );
  }
});
