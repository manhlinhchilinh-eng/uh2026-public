/**
 * UMS Digital Class Logbook - Security Rules Invariants & Database Boundary Tests
 * Milestone 6: Mathematical verification of Firestore security rules logic
 * Path: src/test/securityRulesInvariant.test.ts
 */

import { describe, it, expect } from 'vitest';

/**
 * Pure TypeScript replica of the Firestore Security Rule:
 * function isValidPeriodScores(scores)
 */
function isValidPeriodScores(scores: any): boolean {
  if (!scores || typeof scores !== 'object') return false;
  return (
    typeof scores.learning === 'number' &&
    scores.learning >= 0.0 &&
    scores.learning <= 4.0 &&
    typeof scores.discipline === 'number' &&
    scores.discipline >= 0.0 &&
    scores.discipline <= 3.0 &&
    typeof scores.hygiene === 'number' &&
    scores.hygiene >= 0.0 &&
    scores.hygiene <= 2.0 &&
    typeof scores.customCriterion === 'number' &&
    scores.customCriterion >= 0.0 &&
    scores.customCriterion <= 1.0 &&
    typeof scores.total === 'number' &&
    scores.total >= 0.0 &&
    scores.total <= 10.0
  );
}

/**
 * Pure replica of the Firestore User Profile Safe Update Rule:
 * allow update: if isAuthenticated() && (isAdmin() || (request.auth.uid == userId && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['passwordHash', 'mustChangePassword', 'lastLoginAt', 'updatedAt'])))
 */
function canUserUpdateProfile(
  authUid: string | null,
  targetUserId: string,
  userRoles: string[],
  modifiedKeys: string[]
): boolean {
  if (!authUid) return false;
  const isAdmin = userRoles.includes('admin');
  if (isAdmin) return true;

  if (authUid !== targetUserId) return false;

  const allowedKeys = new Set([
    'passwordHash',
    'mustChangePassword',
    'lastLoginAt',
    'updatedAt',
  ]);

  return modifiedKeys.every((key) => allowedKeys.has(key));
}

/**
 * Pure replica of the Firestore GVCN Authorization Rule:
 * function isGVCN(classId)
 */
function isAuthorizedGVCN(
  authUid: string | null,
  roles: string[],
  assignedClassId: string | undefined,
  targetClassId: string
): boolean {
  if (!authUid) return false;
  if (roles.includes('admin')) return true;
  if (roles.includes('gvcn') && assignedClassId === targetClassId) return true;
  return false;
}

/**
 * Pure replica of Behavior Note Creation Rule:
 * allow create: if isAuthenticated() && isTeacher() && request.resource.data.authorId == request.auth.uid && request.resource.data.type in ['positive', 'negative'];
 */
function canCreateBehaviorNote(
  authUid: string | null,
  roles: string[],
  payload: { authorId: string; type: string }
): boolean {
  if (!authUid) return false;
  const isTeacher =
    roles.includes('admin') ||
    roles.includes('gvcn') ||
    roles.includes('gvbm') ||
    roles.includes('tpt');
  if (!isTeacher) return false;
  if (payload.authorId !== authUid) return false;
  if (payload.type !== 'positive' && payload.type !== 'negative') return false;
  return true;
}

/**
 * Pure replica of Audit Log Immutability Rule:
 * allow create: if isAuthenticated();
 * allow read: if isAuthenticated() && isAdmin();
 * allow update: if false;
 * allow delete: if false;
 */
const auditLogRules = {
  canCreate: (authUid: string | null) => authUid !== null,
  canRead: (authUid: string | null, roles: string[]) => authUid !== null && roles.includes('admin'),
  canUpdate: (_authUid: string | null, _roles: string[]) => false, // ALWAYS FALSE
  canDelete: (_authUid: string | null, _roles: string[]) => false, // ALWAYS FALSE
};

describe('Milestone 6: Firestore Security Rules Invariant Suite', () => {
  describe('1. 4-Criteria Period Scoring Bounds Invariants (isValidPeriodScores)', () => {
    it('1.1 accepts valid maximum score configuration (4.0 + 3.0 + 2.0 + 1.0 = 10.0)', () => {
      const validMax = {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
        total: 10.0,
      };
      expect(isValidPeriodScores(validMax)).toBe(true);
    });

    it('1.2 accepts valid minimum score configuration (0.0 across all criteria)', () => {
      const validMin = {
        learning: 0.0,
        discipline: 0.0,
        hygiene: 0.0,
        customCriterion: 0.0,
        total: 0.0,
      };
      expect(isValidPeriodScores(validMin)).toBe(true);
    });

    it('1.3 accepts valid intermediate fractional points (3.5, 2.5, 1.5, 0.5 = 8.0)', () => {
      const validIntermediate = {
        learning: 3.5,
        discipline: 2.5,
        hygiene: 1.5,
        customCriterion: 0.5,
        total: 8.0,
      };
      expect(isValidPeriodScores(validIntermediate)).toBe(true);
    });

    it('1.4 rejects learning score > 4.0', () => {
      const invalidLearning = {
        learning: 4.1,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 0.9,
        total: 10.0,
      };
      expect(isValidPeriodScores(invalidLearning)).toBe(false);
    });

    it('1.5 rejects discipline score > 3.0', () => {
      const invalidDiscipline = {
        learning: 4.0,
        discipline: 3.5,
        hygiene: 1.5,
        customCriterion: 1.0,
        total: 10.0,
      };
      expect(isValidPeriodScores(invalidDiscipline)).toBe(false);
    });

    it('1.6 rejects hygiene score > 2.0', () => {
      const invalidHygiene = {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.5,
        customCriterion: 0.5,
        total: 10.0,
      };
      expect(isValidPeriodScores(invalidHygiene)).toBe(false);
    });

    it('1.7 rejects custom criterion score > 1.0', () => {
      const invalidCustom = {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 1.5,
        customCriterion: 1.5,
        total: 10.0,
      };
      expect(isValidPeriodScores(invalidCustom)).toBe(false);
    });

    it('1.8 rejects total score > 10.0 even if individual criteria are within bounds', () => {
      const invalidTotal = {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
        total: 10.5, // Exceeds 10.0 limit
      };
      expect(isValidPeriodScores(invalidTotal)).toBe(false);
    });

    it('1.9 rejects negative values for any criterion', () => {
      expect(
        isValidPeriodScores({ learning: -0.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 5.5 })
      ).toBe(false);
      expect(
        isValidPeriodScores({ learning: 4.0, discipline: -1.0, hygiene: 2.0, customCriterion: 1.0, total: 6.0 })
      ).toBe(false);
      expect(
        isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: -0.1, customCriterion: 1.0, total: 7.9 })
      ).toBe(false);
      expect(
        isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: -0.5, total: 8.5 })
      ).toBe(false);
      expect(
        isValidPeriodScores({ learning: 0.0, discipline: 0.0, hygiene: 0.0, customCriterion: 0.0, total: -1.0 })
      ).toBe(false);
    });

    it('1.10 rejects non-numeric or missing properties', () => {
      expect(isValidPeriodScores(null)).toBe(false);
      expect(isValidPeriodScores(undefined)).toBe(false);
      expect(isValidPeriodScores({})).toBe(false);
      expect(isValidPeriodScores({ learning: '4.0', discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: NaN, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
    });
  });

  describe('2. RBAC & Anti-Privilege Escalation Invariants', () => {
    it('2.1 allows self-updates to safe fields only (passwordHash, mustChangePassword, etc.)', () => {
      const canUpdate = canUserUpdateProfile('user_123', 'user_123', ['gvcn'], [
        'passwordHash',
        'mustChangePassword',
        'updatedAt',
      ]);
      expect(canUpdate).toBe(true);
    });

    it('2.2 blocks self-updates attempting privilege escalation (changing roles)', () => {
      const canUpdate = canUserUpdateProfile('user_123', 'user_123', ['gvcn'], [
        'passwordHash',
        'roles', // ATTEMPTED PRIVILEGE ESCALATION
      ]);
      expect(canUpdate).toBe(false);
    });

    it('2.3 blocks self-updates attempting to change assignedClassId or username', () => {
      expect(
        canUserUpdateProfile('user_123', 'user_123', ['gvcn'], ['assignedClassId'])
      ).toBe(false);
      expect(
        canUserUpdateProfile('user_123', 'user_123', ['gvcn'], ['username'])
      ).toBe(false);
      expect(
        canUserUpdateProfile('user_123', 'user_123', ['gvcn'], ['email'])
      ).toBe(false);
    });

    it('2.4 allows admin to update any field on any user profile', () => {
      const adminCanUpdate = canUserUpdateProfile('admin_uid', 'target_user_uid', ['admin'], [
        'roles',
        'assignedClassId',
        'displayName',
      ]);
      expect(adminCanUpdate).toBe(true);
    });

    it('2.5 prevents cross-user profile mutation by non-admins', () => {
      const crossUpdate = canUserUpdateProfile('user_1', 'user_2', ['gvbm'], [
        'passwordHash',
      ]);
      expect(crossUpdate).toBe(false);
    });
  });

  describe('3. GVCN Class Boundary Invariants', () => {
    it('3.1 allows GVCN of 9A3 to modify their assigned class 9A3', () => {
      expect(isAuthorizedGVCN('mrlinh_uid', ['gvcn'], '9A3', '9A3')).toBe(true);
    });

    it('3.2 blocks GVCN of 9A3 from modifying other classes (e.g., 6A1, 7A3, 8A3)', () => {
      expect(isAuthorizedGVCN('mrlinh_uid', ['gvcn'], '9A3', '6A1')).toBe(false);
      expect(isAuthorizedGVCN('mrlinh_uid', ['gvcn'], '9A3', '7A3')).toBe(false);
      expect(isAuthorizedGVCN('mrlinh_uid', ['gvcn'], '9A3', '8A3')).toBe(false);
    });

    it('3.3 allows Admin to modify any class (e.g., 6A1, 9A3)', () => {
      expect(isAuthorizedGVCN('admin_uid', ['admin'], undefined, '6A1')).toBe(true);
      expect(isAuthorizedGVCN('admin_uid', ['admin'], undefined, '9A3')).toBe(true);
    });
  });

  describe('4. Behavior Notes Attribution & Impersonation Prevention', () => {
    it('4.1 allows teacher to create note when authorId matches request.auth.uid', () => {
      const canCreate = canCreateBehaviorNote('teacher_123', ['gvbm'], {
        authorId: 'teacher_123',
        type: 'positive',
      });
      expect(canCreate).toBe(true);
    });

    it('4.2 strictly rejects note creation when authorId does not match request.auth.uid (forgery/impersonation)', () => {
      const forgedCreate = canCreateBehaviorNote('teacher_123', ['gvbm'], {
        authorId: 'principal_admin_uid', // FORGED IDENTITY
        type: 'negative',
      });
      expect(forgedCreate).toBe(false);
    });

    it('4.3 rejects notes with invalid behavior type', () => {
      const invalidType = canCreateBehaviorNote('teacher_123', ['gvbm'], {
        authorId: 'teacher_123',
        type: 'arbitrary_type',
      });
      expect(invalidType).toBe(false);
    });
  });

  describe('5. Audit Log Non-Bypassable Immutability Invariants', () => {
    it('5.1 permits append (create) by any authenticated actor', () => {
      expect(auditLogRules.canCreate('user_uid')).toBe(true);
      expect(auditLogRules.canCreate(null)).toBe(false);
    });

    it('5.2 permits read only to Admin users', () => {
      expect(auditLogRules.canRead('admin_uid', ['admin'])).toBe(true);
      expect(auditLogRules.canRead('gvcn_uid', ['gvcn'])).toBe(false);
      expect(auditLogRules.canRead('gvbm_uid', ['gvbm'])).toBe(false);
      expect(auditLogRules.canRead(null, [])).toBe(false);
    });

    it('5.3 unconditionally rejects UPDATE on audit logs (even by Admin)', () => {
      expect(auditLogRules.canUpdate('admin_uid', ['admin'])).toBe(false);
      expect(auditLogRules.canUpdate('user_uid', ['gvcn'])).toBe(false);
      expect(auditLogRules.canUpdate(null, [])).toBe(false);
    });

    it('5.4 unconditionally rejects DELETE on audit logs (even by Admin)', () => {
      expect(auditLogRules.canDelete('admin_uid', ['admin'])).toBe(false);
      expect(auditLogRules.canDelete('user_uid', ['gvcn'])).toBe(false);
      expect(auditLogRules.canDelete(null, [])).toBe(false);
    });
  });
});
