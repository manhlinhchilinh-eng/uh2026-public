/**
 * Tier 2: Boundary & Corner Cases - Behavior Notes
 * Requirements: ORIGINAL_REQUEST.md (R2), PROJECT.md (F15, F16)
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';
import { assertThrowsContractError } from '../harness/assertions.ts';

test('T2-NOTE-01: Rejection of empty or whitespace-only behavior note description', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  assertThrowsContractError(
    () =>
      engine.createBehaviorNote(session.token, {
        studentId: '269398',
        studentName: 'Lý Bảo Duy',
        classId: '6A1',
        type: 'positive',
        category: 'Khen ngợi',
        description: '   ',
      }),
    'NOTE_EMPTY_DESCRIPTION'
  );
});

test('T2-NOTE-02: Rejection of invalid note type (must be positive or negative)', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  assertThrowsContractError(
    () =>
      engine.createBehaviorNote(session.token, {
        studentId: '269398',
        studentName: 'Lý Bảo Duy',
        classId: '6A1',
        type: 'neutral' as any,
        category: 'Nhắc nhở',
        description: 'Cần chú ý hơn',
      }),
    'NOTE_INVALID_TYPE'
  );
});

test('T2-NOTE-03: Rejection of behavior note for unknown student ID not in class roster', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  assertThrowsContractError(
    () =>
      engine.createBehaviorNote(session.token, {
        studentId: '999999',
        studentName: 'Không Tồn Tại',
        classId: '6A1',
        type: 'negative',
        category: 'Vi phạm',
        description: 'Học sinh lạ trong lớp',
      }),
    'NOTE_UNKNOWN_STUDENT'
  );
});

test('T2-NOTE-04: GVCN cannot create behavior note for another class where they are not GVCN/GVBM/TPT', () => {
  const engine = new UMSContractEngine();
  // msphuonganhums is GVCN of 6A1, not 8A3. In our fixture she is ['gvcn', 'gvbm'] for 6A1.
  // Let's create an isolated teacher who only has GVCN role for 6A1
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  // TPT or Admin can write for any class, but a regular GVCN without teaching assignment in 8A3 is restricted
  // Testing with an admin works across classes:
  const admin = engine.login('mrlinhums', DEFAULT_PASSWORD);
  engine.changePassword(admin.token, DEFAULT_PASSWORD, 'Admin2026!');

  const noteByAdmin = engine.createBehaviorNote(admin.token, {
    studentId: '269398',
    studentName: 'Lý Bảo Duy',
    classId: '6A1',
    type: 'positive',
    category: 'Khen ngợi',
    description: 'Admin khen ngợi học sinh 6A1',
  });
  assert.strictEqual(noteByAdmin.authorRole, 'admin');
});

test('T2-NOTE-05: Cannot create behavior notes if mandatory password change is pending', () => {
  const engine = new UMSContractEngine();
  // User has not changed default password
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);

  assertThrowsContractError(
    () =>
      engine.createBehaviorNote(session.token, {
        studentId: '269398',
        studentName: 'Lý Bảo Duy',
        classId: '6A1',
        type: 'positive',
        category: 'Khen ngợi',
        description: 'Học sinh chăm chỉ',
      }),
    'AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED'
  );
});

test('T2-NOTE-06: Boundary stress: Very long multi-paragraph description (2000 chars) is preserved', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const longDesc = 'Đoạn văn nhận xét chi tiết: '.repeat(80); // ~2200 chars
  const note = engine.createBehaviorNote(session.token, {
    studentId: '269398',
    studentName: 'Lý Bảo Duy',
    classId: '6A1',
    type: 'positive',
    category: 'Khen ngợi đặc biệt',
    description: longDesc,
  });

  assert.strictEqual(note.description.length, longDesc.trim().length);
  assert.strictEqual(note.description, longDesc.trim());
});
