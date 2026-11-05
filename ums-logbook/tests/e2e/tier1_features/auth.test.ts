/**
 * Tier 1: Feature Coverage - Authentication & Access Control
 * Requirements: ORIGINAL_REQUEST.md (R3, R7), PROJECT.md (F4, F5, F6)
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T1-AUTH-01: User can log in with valid credentials and receives resolved email', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('mrlinhums', DEFAULT_PASSWORD);

  assert.ok(session.token, 'Session token must be present');
  assert.strictEqual(session.user.username, 'mrlinhums');
  assert.strictEqual(session.user.email, 'mrlinhums@ums.edu.vn', 'Email must resolve as <username>@ums.edu.vn');
  assert.strictEqual(session.user.displayName, 'Hồ Thanh Quang Uyên (Mr. Linh)');
});

test('T1-AUTH-02: Initial login flags mandatory password change', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);

  assert.strictEqual(
    session.user.mustChangePassword,
    true,
    'First-time login must require mandatory password change'
  );
});

test('T1-AUTH-03: Mandatory password change succeeds and clears flag', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);

  const newPassword = 'SecureNewPassword2026!';
  engine.changePassword(session.token, DEFAULT_PASSWORD, newPassword);

  const updatedSession = engine.validateSession(session.token);
  assert.strictEqual(
    updatedSession.user.mustChangePassword,
    false,
    'mustChangePassword must be false after successful change'
  );
});

test('T1-AUTH-04: User can log in with newly updated password', () => {
  const engine = new UMSContractEngine();
  const initialSession = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  const newPassword = 'TeacherPassword2026#';
  engine.changePassword(initialSession.token, DEFAULT_PASSWORD, newPassword);

  const nextSession = engine.login('msphuonganhums', newPassword);
  assert.ok(nextSession.token);
  assert.strictEqual(nextSession.user.mustChangePassword, false);
});

test('T1-AUTH-05: Dual-role account preserves both Admin and GVCN roles', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('mrlinhums', DEFAULT_PASSWORD);

  assert.ok(session.user.roles.includes('admin'), 'mrlinhums must have admin role');
  assert.ok(session.user.roles.includes('gvcn'), 'mrlinhums must have gvcn role');
  assert.strictEqual(session.user.assignedClassId, '8A3', 'Assigned class must be 8A3');
});

test('T1-AUTH-06: TPT user account has specialized supervisor role', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('mrhoanglongums', DEFAULT_PASSWORD);

  assert.ok(session.user.roles.includes('tpt'), 'mrhoanglongums must have tpt role');
  assert.strictEqual(session.user.assignedClassId, undefined, 'TPT should not be restricted to single class');
});
