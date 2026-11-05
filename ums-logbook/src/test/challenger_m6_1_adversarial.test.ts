/**
 * CHALLENGER M6_1: EMPIRICAL ADVERSARIAL SECURITY RULES & PRIVILEGE ESCALATION HARNESS
 * Milestone 6: Firestore Security Rules, RBAC Boundaries, Period Score Invariants,
 * Cross-Class Isolation, Behavior Note Attribution, and Immutable Audit Logging.
 *
 * Path: src/test/challenger_m6_1_adversarial.test.ts
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// AUTHENTICATION & RBAC HELPER MODELS (Direct Firestore Rules Semantics Replica)
// =============================================================================

export interface RequestAuth {
  uid: string;
  token?: {
    roles?: string[];
    role?: string;
    admin?: boolean;
    assignedClassId?: string;
    [key: string]: any;
  };
}

export interface UserDoc {
  uid?: string;
  roles?: string[];
  assignedClassId?: string;
  [key: string]: any;
}

export function isAuthenticated(auth: RequestAuth | null): boolean {
  return auth !== null && typeof auth === 'object' && !!auth.uid;
}

export function hasRole(auth: RequestAuth | null, userDoc: UserDoc | null, role: string): boolean {
  if (!isAuthenticated(auth)) return false;
  if (auth!.token?.role === role) return true;
  if (auth!.token?.roles && Array.isArray(auth!.token.roles) && auth!.token.roles.includes(role)) return true;
  if (userDoc?.roles && Array.isArray(userDoc.roles) && userDoc.roles.includes(role)) return true;
  return false;
}

export function isAdmin(auth: RequestAuth | null, userDoc: UserDoc | null): boolean {
  if (!isAuthenticated(auth)) return false;
  if (auth!.token?.admin === true) return true;
  return hasRole(auth, userDoc, 'admin');
}

export function isTPT(auth: RequestAuth | null, userDoc: UserDoc | null): boolean {
  return hasRole(auth, userDoc, 'tpt');
}

export function isTeacher(auth: RequestAuth | null, userDoc: UserDoc | null): boolean {
  return (
    isAdmin(auth, userDoc) ||
    hasRole(auth, userDoc, 'gvcn') ||
    hasRole(auth, userDoc, 'gvbm') ||
    isTPT(auth, userDoc)
  );
}

export function isGVCN(auth: RequestAuth | null, userDoc: UserDoc | null, classId: string): boolean {
  if (!isAuthenticated(auth)) return false;
  if (isAdmin(auth, userDoc)) return true;
  if (hasRole(auth, userDoc, 'gvcn')) {
    if (auth!.token?.assignedClassId === classId) return true;
    if (userDoc?.assignedClassId === classId) return true;
  }
  return false;
}

// =============================================================================
// 1. PERIOD SCORE VALIDATION MODEL (Firestore Rules isValidPeriodScores Replica)
// =============================================================================

export function isValidPeriodScores(scores: any): boolean {
  if (!scores || typeof scores !== 'object') return false;
  return (
    typeof scores.learning === 'number' &&
    !Number.isNaN(scores.learning) &&
    Number.isFinite(scores.learning) &&
    scores.learning >= 0.0 &&
    scores.learning <= 4.0 &&
    typeof scores.discipline === 'number' &&
    !Number.isNaN(scores.discipline) &&
    Number.isFinite(scores.discipline) &&
    scores.discipline >= 0.0 &&
    scores.discipline <= 3.0 &&
    typeof scores.hygiene === 'number' &&
    !Number.isNaN(scores.hygiene) &&
    Number.isFinite(scores.hygiene) &&
    scores.hygiene >= 0.0 &&
    scores.hygiene <= 2.0 &&
    typeof scores.customCriterion === 'number' &&
    !Number.isNaN(scores.customCriterion) &&
    Number.isFinite(scores.customCriterion) &&
    scores.customCriterion >= 0.0 &&
    scores.customCriterion <= 1.0 &&
    typeof scores.total === 'number' &&
    !Number.isNaN(scores.total) &&
    Number.isFinite(scores.total) &&
    scores.total >= 0.0 &&
    scores.total <= 10.0
  );
}

// =============================================================================
// 2. USER PROFILE UPDATE EVALUATION MODEL
// =============================================================================

export function canUpdateUserProfile(
  auth: RequestAuth | null,
  callerDoc: UserDoc | null,
  targetUserId: string,
  targetUserBefore: Record<string, any>,
  incomingData: Record<string, any>
): boolean {
  if (!isAuthenticated(auth)) return false;
  if (isAdmin(auth, callerDoc)) return true;

  if (auth!.uid === targetUserId) {
    const allKeys = new Set([
      ...Object.keys(targetUserBefore),
      ...Object.keys(incomingData),
    ]);
    const modifiedKeys: string[] = [];
    for (const key of allKeys) {
      if (JSON.stringify(targetUserBefore[key]) !== JSON.stringify(incomingData[key])) {
        modifiedKeys.push(key);
      }
    }

    const safeKeys = new Set([
      'passwordHash',
      'mustChangePassword',
      'lastLoginAt',
      'updatedAt',
    ]);

    return modifiedKeys.length > 0 && modifiedKeys.every((k) => safeKeys.has(k));
  }

  return false;
}

// =============================================================================
// 3. DAILY LOGBOOK & SCHEDULE EVALUATION MODEL
// =============================================================================

export function canCreateDailyLogbook(
  auth: RequestAuth | null,
  callerDoc: UserDoc | null,
  classId: string
): boolean {
  if (!isAuthenticated(auth)) return false;
  return isAdmin(auth, callerDoc) || isGVCN(auth, callerDoc, classId);
}

export function canUpdateDailyLogbook(
  auth: RequestAuth | null,
  callerDoc: UserDoc | null,
  targetClassId: string,
  logbookBefore: Record<string, any>,
  incomingData: Record<string, any>
): boolean {
  if (!isAuthenticated(auth)) return false;
  if (isAdmin(auth, callerDoc)) return true;
  if (isGVCN(auth, callerDoc, targetClassId)) return true;

  if (isTeacher(auth, callerDoc)) {
    const allKeys = new Set([
      ...Object.keys(logbookBefore),
      ...Object.keys(incomingData),
    ]);
    const modifiedKeys: string[] = [];
    for (const key of allKeys) {
      if (JSON.stringify(logbookBefore[key]) !== JSON.stringify(incomingData[key])) {
        modifiedKeys.push(key);
      }
    }
    const safeKeys = new Set(['status', 'isCompleted', 'updatedAt']);
    return modifiedKeys.length > 0 && modifiedKeys.every((k) => safeKeys.has(k));
  }

  return false;
}

export function canWriteSchedule(
  auth: RequestAuth | null,
  callerDoc: UserDoc | null,
  classId: string
): boolean {
  if (!isAuthenticated(auth)) return false;
  return isAdmin(auth, callerDoc) || isGVCN(auth, callerDoc, classId);
}

// =============================================================================
// 4. BEHAVIOR NOTE EVALUATION MODEL
// =============================================================================

export function canCreateBehaviorNote(
  auth: RequestAuth | null,
  callerDoc: UserDoc | null,
  payload: { authorId: string; type: string; [key: string]: any }
): boolean {
  if (!isAuthenticated(auth)) return false;
  if (!isTeacher(auth, callerDoc)) return false;
  if (payload.authorId !== auth!.uid) return false;
  if (payload.type !== 'positive' && payload.type !== 'negative') return false;
  return true;
}

export function canUpdateBehaviorNote(
  auth: RequestAuth | null,
  callerDoc: UserDoc | null,
  noteBefore: { authorId: string; classId: string; type: string; [key: string]: any },
  incomingData: { authorId: string; classId: string; type: string; [key: string]: any }
): boolean {
  if (!isAuthenticated(auth)) return false;
  if (isAdmin(auth, callerDoc)) return true;

  // Author update: authorId cannot change, type must remain valid
  if (
    noteBefore.authorId === auth!.uid &&
    incomingData.authorId === noteBefore.authorId &&
    (incomingData.type === 'positive' || incomingData.type === 'negative')
  ) {
    return true;
  }

  // Assigned GVCN acknowledgment
  if (isGVCN(auth, callerDoc, noteBefore.classId)) {
    const allKeys = new Set([
      ...Object.keys(noteBefore),
      ...Object.keys(incomingData),
    ]);
    const modifiedKeys: string[] = [];
    for (const key of allKeys) {
      if (JSON.stringify(noteBefore[key]) !== JSON.stringify(incomingData[key])) {
        modifiedKeys.push(key);
      }
    }
    const ackKeys = new Set([
      'acknowledgedByGvcn',
      'acknowledgedAt',
      'acknowledgedBy',
      'updatedAt',
    ]);
    return modifiedKeys.length > 0 && modifiedKeys.every((k) => ackKeys.has(k));
  }

  return false;
}

export function canDeleteBehaviorNote(
  auth: RequestAuth | null,
  callerDoc: UserDoc | null,
  noteBefore: { authorId: string; [key: string]: any }
): boolean {
  if (!isAuthenticated(auth)) return false;
  if (isAdmin(auth, callerDoc)) return true;
  return noteBefore.authorId === auth!.uid;
}

// =============================================================================
// 5. AUDIT LOG IMMUTABILITY MODEL
// =============================================================================

export const auditLogRules = {
  canCreate: (auth: RequestAuth | null) => isAuthenticated(auth),
  canRead: (auth: RequestAuth | null, callerDoc: UserDoc | null) =>
    isAuthenticated(auth) && isAdmin(auth, callerDoc),
  canUpdate: (_auth: RequestAuth | null, _callerDoc: UserDoc | null) => false, // ALWAYS FALSE: allow update: if false;
  canDelete: (_auth: RequestAuth | null, _callerDoc: UserDoc | null) => false, // ALWAYS FALSE: allow delete: if false;
};

// =============================================================================
// TEST SUITE: CHALLENGER M6_1
// =============================================================================

describe('CHALLENGER M6_1: Empirical Adversarial Security Rules & Privilege Escalation', () => {

  // ===========================================================================
  // REQUIREMENT 1: Period Score Manipulation Stress-Testing
  // ===========================================================================
  describe('1. Period Score Manipulation Stress-Testing', () => {
    it('1.1 accepts valid maximum period score (4.0 + 3.0 + 2.0 + 1.0 = 10.0)', () => {
      const validMax = {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
        total: 10.0,
      };
      expect(isValidPeriodScores(validMax)).toBe(true);
    });

    it('1.2 accepts valid minimum period score (0.0 + 0.0 + 0.0 + 0.0 = 0.0)', () => {
      const validMin = {
        learning: 0.0,
        discipline: 0.0,
        hygiene: 0.0,
        customCriterion: 0.0,
        total: 0.0,
      };
      expect(isValidPeriodScores(validMin)).toBe(true);
    });

    it('1.3 accepts valid intermediate fractional period scores', () => {
      const validIntermediate = {
        learning: 3.5,
        discipline: 2.5,
        hygiene: 1.5,
        customCriterion: 0.5,
        total: 8.0,
      };
      expect(isValidPeriodScores(validIntermediate)).toBe(true);
    });

    it('1.4 rejects learning: 4.1 (exceeds max 4.0 ceiling)', () => {
      const invalid = {
        learning: 4.1,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 0.9,
        total: 10.0,
      };
      expect(isValidPeriodScores(invalid)).toBe(false);
    });

    it('1.5 rejects discipline: 3.1 (exceeds max 3.0 ceiling)', () => {
      const invalid = {
        learning: 4.0,
        discipline: 3.1,
        hygiene: 1.9,
        customCriterion: 1.0,
        total: 10.0,
      };
      expect(isValidPeriodScores(invalid)).toBe(false);
    });

    it('1.6 rejects hygiene: 2.1 (exceeds max 2.0 ceiling)', () => {
      const invalid = {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.1,
        customCriterion: 0.9,
        total: 10.0,
      };
      expect(isValidPeriodScores(invalid)).toBe(false);
    });

    it('1.7 rejects customCriterion: 1.1 (exceeds max 1.0 ceiling)', () => {
      const invalid = {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 1.9,
        customCriterion: 1.1,
        total: 10.0,
      };
      expect(isValidPeriodScores(invalid)).toBe(false);
    });

    it('1.8 rejects total: 10.1 (exceeds max 10.0 ceiling)', () => {
      const invalid = {
        learning: 4.0,
        discipline: 3.0,
        hygiene: 2.0,
        customCriterion: 1.0,
        total: 10.1,
      };
      expect(isValidPeriodScores(invalid)).toBe(false);
    });

    it('1.9 rejects infinitesimal floating-point overflows', () => {
      expect(isValidPeriodScores({ learning: 4.0000000000001, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0000000000001, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0000000000001, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0000000000001, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0000000000001 })).toBe(false);
    });

    it('1.10 rejects negative scores (-0.5, -0.0001, -Infinity) across all criteria', () => {
      expect(isValidPeriodScores({ learning: -0.5, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 5.5 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: -0.1, hygiene: 2.0, customCriterion: 1.0, total: 6.9 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: -0.0001, customCriterion: 1.0, total: 7.9999 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: -0.5, total: 8.5 })).toBe(false);
      expect(isValidPeriodScores({ learning: 0.0, discipline: 0.0, hygiene: 0.0, customCriterion: 0.0, total: -1.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: -Infinity, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 5.0 })).toBe(false);
    });

    it('1.11 rejects NaN and Infinity across all fields', () => {
      expect(isValidPeriodScores({ learning: NaN, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: NaN, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: NaN, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: NaN, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: NaN })).toBe(false);
      expect(isValidPeriodScores({ learning: Infinity, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: Infinity })).toBe(false);
    });

    it('1.12 rejects non-numeric types (strings, booleans, objects, arrays, null, undefined)', () => {
      expect(isValidPeriodScores(null)).toBe(false);
      expect(isValidPeriodScores(undefined)).toBe(false);
      expect(isValidPeriodScores([])).toBe(false);
      expect(isValidPeriodScores({})).toBe(false);
      expect(isValidPeriodScores({ learning: '4.0', discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: '3.0', hygiene: 2.0, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: true, customCriterion: 1.0, total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: [1.0], total: 10.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: { val: 1.0 }, total: 10.0 })).toBe(false);
    });

    it('1.13 rejects missing any of the 5 required score fields', () => {
      expect(isValidPeriodScores({ discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 6.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, hygiene: 2.0, customCriterion: 1.0, total: 7.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, customCriterion: 1.0, total: 8.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, total: 9.0 })).toBe(false);
      expect(isValidPeriodScores({ learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0 })).toBe(false);
    });

    it('1.14 stress fuzzing: rejects 500 randomly generated out-of-bounds score payloads', () => {
      for (let i = 0; i < 500; i++) {
        // Randomly pick which criterion to violate
        const choice = i % 5;
        const payload: any = {
          learning: 4.0,
          discipline: 3.0,
          hygiene: 2.0,
          customCriterion: 1.0,
          total: 10.0,
        };

        if (choice === 0) {
          payload.learning = 4.01 + Math.random() * 50;
        } else if (choice === 1) {
          payload.discipline = 3.01 + Math.random() * 50;
        } else if (choice === 2) {
          payload.hygiene = 2.01 + Math.random() * 50;
        } else if (choice === 3) {
          payload.customCriterion = 1.01 + Math.random() * 50;
        } else {
          payload.total = 10.01 + Math.random() * 50;
        }

        expect(isValidPeriodScores(payload)).toBe(false);
      }
    });
  });

  // ===========================================================================
  // REQUIREMENT 2: Privilege Escalation Defense Stress-Testing
  // ===========================================================================
  describe('2. Privilege Escalation Defense Stress-Testing', () => {
    const victimUid = 'gvcn_msthanhhuyen';
    const initialUserDoc = {
      uid: victimUid,
      username: 'msthanhhuyenums',
      email: 'msthanhhuyenums@ums.edu.vn',
      displayName: 'Nguyễn Phương Minh Hạnh',
      roles: ['gvcn'],
      assignedClassId: '7A3',
      mustChangePassword: false,
      passwordHash: 'hash_original',
      createdAt: 1700000000000,
      lastLoginAt: 1700000001000,
      updatedAt: 1700000001000,
    };

    const regularCallerAuth: RequestAuth = {
      uid: victimUid,
      token: { roles: ['gvcn'], assignedClassId: '7A3' },
    };

    const adminCallerAuth: RequestAuth = {
      uid: 'admin_mrlinh',
      token: { admin: true, roles: ['admin', 'gvcn'], assignedClassId: '9A3' },
    };
    const adminCallerDoc: UserDoc = {
      uid: 'admin_mrlinh',
      roles: ['admin', 'gvcn'],
      assignedClassId: '9A3',
    };

    it('2.1 non-admin attempting to add role "admin" MUST be rejected', () => {
      const maliciousPayload = {
        ...initialUserDoc,
        roles: ['gvcn', 'admin'], // PRIVILEGE ESCALATION ATTEMPT
      };
      const allowed = canUpdateUserProfile(
        regularCallerAuth,
        initialUserDoc,
        victimUid,
        initialUserDoc,
        maliciousPayload
      );
      expect(allowed).toBe(false);
    });

    it('2.2 non-admin attempting to add role "tpt" MUST be rejected', () => {
      const maliciousPayload = {
        ...initialUserDoc,
        roles: ['gvcn', 'tpt'], // SUPERVISOR ESCALATION ATTEMPT
      };
      const allowed = canUpdateUserProfile(
        regularCallerAuth,
        initialUserDoc,
        victimUid,
        initialUserDoc,
        maliciousPayload
      );
      expect(allowed).toBe(false);
    });

    it('2.3 non-admin attempting to modify assignedClassId MUST be rejected', () => {
      const maliciousPayload = {
        ...initialUserDoc,
        assignedClassId: '9A3', // CLASS BOUNDARY TAMPERING
      };
      const allowed = canUpdateUserProfile(
        regularCallerAuth,
        initialUserDoc,
        victimUid,
        initialUserDoc,
        maliciousPayload
      );
      expect(allowed).toBe(false);
    });

    it('2.4 non-admin attempting to modify username or email MUST be rejected', () => {
      const maliciousUsername = { ...initialUserDoc, username: 'forged_admin_name' };
      const maliciousEmail = { ...initialUserDoc, email: 'hacker@ums.edu.vn' };

      expect(canUpdateUserProfile(regularCallerAuth, initialUserDoc, victimUid, initialUserDoc, maliciousUsername)).toBe(false);
      expect(canUpdateUserProfile(regularCallerAuth, initialUserDoc, victimUid, initialUserDoc, maliciousEmail)).toBe(false);
    });

    it('2.5 user updating safe fields (passwordHash, mustChangePassword, lastLoginAt, updatedAt) MUST pass', () => {
      // Single safe field: passwordHash
      const updatePwd = { ...initialUserDoc, passwordHash: 'new_secure_hash_sha256' };
      expect(canUpdateUserProfile(regularCallerAuth, initialUserDoc, victimUid, initialUserDoc, updatePwd)).toBe(true);

      // Single safe field: mustChangePassword
      const updateMustChange = { ...initialUserDoc, mustChangePassword: true };
      expect(canUpdateUserProfile(regularCallerAuth, initialUserDoc, victimUid, initialUserDoc, updateMustChange)).toBe(true);

      // Single safe field: lastLoginAt
      const updateLogin = { ...initialUserDoc, lastLoginAt: Date.now() };
      expect(canUpdateUserProfile(regularCallerAuth, initialUserDoc, victimUid, initialUserDoc, updateLogin)).toBe(true);

      // All safe fields together
      const updateAllSafe = {
        ...initialUserDoc,
        passwordHash: 'new_sha256_hash',
        mustChangePassword: false,
        lastLoginAt: 1700000005000,
        updatedAt: 1700000005000,
      };
      expect(canUpdateUserProfile(regularCallerAuth, initialUserDoc, victimUid, initialUserDoc, updateAllSafe)).toBe(true);
    });

    it('2.6 mixed payload: safe fields combined with one unauthorized field MUST be rejected', () => {
      const mixedMalicious = {
        ...initialUserDoc,
        passwordHash: 'new_hash',
        mustChangePassword: false,
        roles: ['admin'], // INJECTED ESCALATION
      };
      expect(canUpdateUserProfile(regularCallerAuth, initialUserDoc, victimUid, initialUserDoc, mixedMalicious)).toBe(false);
    });

    it('2.7 non-admin user attempting to update ANOTHER user profile MUST be rejected', () => {
      const otherUserUid = 'gvcn_msngoclinh';
      const targetUserDoc = {
        uid: otherUserUid,
        roles: ['gvcn'],
        assignedClassId: '8A3',
        passwordHash: 'old_hash',
      };
      // User 'msthanhhuyen' tries to change password on 'msngoclinh'
      const crossUpdate = {
        ...targetUserDoc,
        passwordHash: 'hijacked_hash',
      };
      expect(canUpdateUserProfile(regularCallerAuth, initialUserDoc, otherUserUid, targetUserDoc, crossUpdate)).toBe(false);
    });

    it('2.8 Admin updating roles, assignedClassId, and safe fields on any profile MUST pass', () => {
      const adminUpdate = {
        ...initialUserDoc,
        roles: ['gvcn', 'admin'],
        assignedClassId: '9A6',
      };
      expect(canUpdateUserProfile(adminCallerAuth, adminCallerDoc, victimUid, initialUserDoc, adminUpdate)).toBe(true);
    });
  });

  // ===========================================================================
  // REQUIREMENT 3: Cross-Class Boundary Stress-Testing
  // ===========================================================================
  describe('3. Cross-Class Boundary Stress-Testing', () => {
    const gvcn7A3Auth: RequestAuth = {
      uid: 'teacher_7A3_uid',
      token: { roles: ['gvcn'], assignedClassId: '7A3' },
    };
    const gvcn7A3Doc: UserDoc = {
      uid: 'teacher_7A3_uid',
      roles: ['gvcn'],
      assignedClassId: '7A3',
    };

    const gvcn9A3Auth: RequestAuth = {
      uid: 'teacher_9A3_uid',
      token: { roles: ['gvcn'], assignedClassId: '9A3' },
    };
    const gvcn9A3Doc: UserDoc = {
      uid: 'teacher_9A3_uid',
      roles: ['gvcn'],
      assignedClassId: '9A3',
    };

    const adminAuth: RequestAuth = {
      uid: 'admin_uid',
      token: { admin: true, roles: ['admin'] },
    };
    const adminDoc: UserDoc = {
      uid: 'admin_uid',
      roles: ['admin'],
    };

    const gvbmAuth: RequestAuth = {
      uid: 'gvbm_uid',
      token: { roles: ['gvbm'] },
    };
    const gvbmDoc: UserDoc = {
      uid: 'gvbm_uid',
      roles: ['gvbm'],
    };

    it('3.1 GVCN of 7A3 attempting to write to 9A3 schedule MUST be rejected', () => {
      const allowed = canWriteSchedule(gvcn7A3Auth, gvcn7A3Doc, '9A3');
      expect(allowed).toBe(false);
    });

    it('3.2 GVCN of 7A3 attempting to write to any other non-assigned class schedule MUST be rejected', () => {
      expect(canWriteSchedule(gvcn7A3Auth, gvcn7A3Doc, '6A1')).toBe(false);
      expect(canWriteSchedule(gvcn7A3Auth, gvcn7A3Doc, '8A3')).toBe(false);
      expect(canWriteSchedule(gvcn7A3Auth, gvcn7A3Doc, '9A6')).toBe(false);
    });

    it('3.3 GVCN of 7A3 writing to 7A3 schedule MUST pass', () => {
      expect(canWriteSchedule(gvcn7A3Auth, gvcn7A3Doc, '7A3')).toBe(true);
    });

    it('3.4 GVCN of 7A3 attempting to create daily logbook for 9A3 MUST be rejected', () => {
      expect(canCreateDailyLogbook(gvcn7A3Auth, gvcn7A3Doc, '9A3')).toBe(false);
    });

    it('3.5 GVCN of 7A3 creating daily logbook for 7A3 MUST pass', () => {
      expect(canCreateDailyLogbook(gvcn7A3Auth, gvcn7A3Doc, '7A3')).toBe(true);
    });

    it('3.6 GVCN of 7A3 attempting to update baseline attendance on 9A3 logbook MUST be rejected', () => {
      const logbook9A3Before = {
        id: '9A3_2026-10-01',
        classId: '9A3',
        date: '2026-10-01',
        preSessionAttendance: { reportedBy: 'teacher_9A3_uid', absences: [] },
        status: 'draft',
      };
      const hijackedLogbook = {
        ...logbook9A3Before,
        preSessionAttendance: { reportedBy: 'teacher_7A3_uid', absences: [{ studentId: 's1', type: 'K' }] },
      };

      const allowed = canUpdateDailyLogbook(gvcn7A3Auth, gvcn7A3Doc, '9A3', logbook9A3Before, hijackedLogbook);
      expect(allowed).toBe(false);
    });

    it('3.7 GVCN of 9A3 updating baseline attendance on 9A3 logbook MUST pass', () => {
      const logbook9A3Before = {
        id: '9A3_2026-10-01',
        classId: '9A3',
        date: '2026-10-01',
        preSessionAttendance: { reportedBy: 'teacher_9A3_uid', absences: [] },
        status: 'draft',
      };
      const updatedLogbook = {
        ...logbook9A3Before,
        preSessionAttendance: { reportedBy: 'teacher_9A3_uid', absences: [{ studentId: 's1', type: 'P' }] },
      };

      const allowed = canUpdateDailyLogbook(gvcn9A3Auth, gvcn9A3Doc, '9A3', logbook9A3Before, updatedLogbook);
      expect(allowed).toBe(true);
    });

    it('3.8 Admin writing to ANY class schedule and daily logbook MUST pass', () => {
      expect(canWriteSchedule(adminAuth, adminDoc, '7A3')).toBe(true);
      expect(canWriteSchedule(adminAuth, adminDoc, '9A3')).toBe(true);
      expect(canWriteSchedule(adminAuth, adminDoc, '6A1')).toBe(true);

      expect(canCreateDailyLogbook(adminAuth, adminDoc, '7A3')).toBe(true);
      expect(canCreateDailyLogbook(adminAuth, adminDoc, '9A3')).toBe(true);
    });

    it('3.9 Subject teacher (GVBM) updating only status/isCompleted MUST pass, but mutating attendance MUST be rejected', () => {
      const logbookBefore = {
        id: '9A3_2026-10-01',
        classId: '9A3',
        date: '2026-10-01',
        preSessionAttendance: { reportedBy: 'teacher_9A3_uid', absences: [] },
        status: 'draft',
        isCompleted: false,
        updatedAt: 1000,
      };

      // Allowed: updating status and isCompleted after teaching period
      const legitimateStatusUpdate = {
        ...logbookBefore,
        status: 'in_progress',
        updatedAt: 2000,
      };
      expect(canUpdateDailyLogbook(gvbmAuth, gvbmDoc, '9A3', logbookBefore, legitimateStatusUpdate)).toBe(true);

      // Forbidden: GVBM attempting to tamper with preSessionAttendance
      const forbiddenAttendanceMutation = {
        ...logbookBefore,
        preSessionAttendance: { reportedBy: 'gvbm_uid', absences: [{ studentId: 's99', type: 'K' }] },
      };
      expect(canUpdateDailyLogbook(gvbmAuth, gvbmDoc, '9A3', logbookBefore, forbiddenAttendanceMutation)).toBe(false);
    });
  });

  // ===========================================================================
  // REQUIREMENT 4: Behavior Note Attribution Stress-Testing
  // ===========================================================================
  describe('4. Behavior Note Attribution Stress-Testing', () => {
    const authorTeacherAuth: RequestAuth = {
      uid: 'teacher_math_01',
      token: { roles: ['gvbm'] },
    };
    const authorTeacherDoc: UserDoc = {
      uid: 'teacher_math_01',
      roles: ['gvbm'],
    };

    const gvcn7A3Auth: RequestAuth = {
      uid: 'gvcn_7A3_uid',
      token: { roles: ['gvcn'], assignedClassId: '7A3' },
    };
    const gvcn7A3Doc: UserDoc = {
      uid: 'gvcn_7A3_uid',
      roles: ['gvcn'],
      assignedClassId: '7A3',
    };

    const gvcn9A3Auth: RequestAuth = {
      uid: 'gvcn_9A3_uid',
      token: { roles: ['gvcn'], assignedClassId: '9A3' },
    };
    const gvcn9A3Doc: UserDoc = {
      uid: 'gvcn_9A3_uid',
      roles: ['gvcn'],
      assignedClassId: '9A3',
    };

    const adminAuth: RequestAuth = {
      uid: 'admin_uid',
      token: { admin: true, roles: ['admin'] },
    };
    const adminDoc: UserDoc = {
      uid: 'admin_uid',
      roles: ['admin'],
    };

    it('4.1 attempt to forge note with authorId != request.auth.uid MUST be rejected', () => {
      const forgedPayload = {
        studentId: 'student_123',
        classId: '7A3',
        type: 'negative',
        category: 'Discipline',
        description: 'Impersonated note',
        authorId: 'admin_principal_uid', // FORGERY: does not match teacher_math_01
      };

      const allowed = canCreateBehaviorNote(authorTeacherAuth, authorTeacherDoc, forgedPayload);
      expect(allowed).toBe(false);
    });

    it('4.2 legitimate author writing note with authorId == request.auth.uid MUST pass', () => {
      const legitimatePayload = {
        studentId: 'student_123',
        classId: '7A3',
        type: 'positive',
        category: 'Khen ngợi',
        description: 'Hăng hái phát biểu',
        authorId: 'teacher_math_01', // Exact match
      };

      const allowed = canCreateBehaviorNote(authorTeacherAuth, authorTeacherDoc, legitimatePayload);
      expect(allowed).toBe(true);
    });

    it('4.3 note creation with invalid behavior type (not positive or negative) MUST be rejected', () => {
      const invalidTypePayload = {
        studentId: 'student_123',
        classId: '7A3',
        type: 'neutral', // INVALID
        category: 'Observation',
        description: 'Neutral statement',
        authorId: 'teacher_math_01',
      };

      expect(canCreateBehaviorNote(authorTeacherAuth, authorTeacherDoc, invalidTypePayload)).toBe(false);
    });

    it('4.4 GVCN acknowledging note for their class MUST pass', () => {
      const noteBefore = {
        id: 'note_001',
        studentId: 'student_123',
        classId: '7A3',
        type: 'negative',
        category: 'Kỷ luật',
        description: 'Nói chuyện trong giờ',
        authorId: 'teacher_math_01',
        acknowledgedByGvcn: false,
        updatedAt: 1000,
      };

      const acknowledgedNote = {
        ...noteBefore,
        acknowledgedByGvcn: true,
        acknowledgedAt: Date.now(),
        acknowledgedBy: 'gvcn_7A3_uid',
        updatedAt: Date.now(),
      };

      const allowed = canUpdateBehaviorNote(gvcn7A3Auth, gvcn7A3Doc, noteBefore, acknowledgedNote);
      expect(allowed).toBe(true);
    });

    it('4.5 GVCN of 9A3 attempting to acknowledge note for class 7A3 MUST be rejected', () => {
      const noteBefore = {
        id: 'note_001',
        studentId: 'student_123',
        classId: '7A3',
        type: 'negative',
        category: 'Kỷ luật',
        description: 'Nói chuyện trong giờ',
        authorId: 'teacher_math_01',
        acknowledgedByGvcn: false,
        updatedAt: 1000,
      };

      const crossAck = {
        ...noteBefore,
        acknowledgedByGvcn: true,
        acknowledgedAt: Date.now(),
        acknowledgedBy: 'gvcn_9A3_uid',
        updatedAt: Date.now(),
      };

      const allowed = canUpdateBehaviorNote(gvcn9A3Auth, gvcn9A3Doc, noteBefore, crossAck);
      expect(allowed).toBe(false);
    });

    it('4.6 GVCN attempting to alter note description or category MUST be rejected', () => {
      const noteBefore = {
        id: 'note_001',
        studentId: 'student_123',
        classId: '7A3',
        type: 'negative',
        category: 'Kỷ luật',
        description: 'Nói chuyện trong giờ',
        authorId: 'teacher_math_01',
        acknowledgedByGvcn: false,
        updatedAt: 1000,
      };

      const tamperedNote = {
        ...noteBefore,
        acknowledgedByGvcn: true,
        description: 'Forged description altering history', // FORBIDDEN TAMPERING
        updatedAt: Date.now(),
      };

      const allowed = canUpdateBehaviorNote(gvcn7A3Auth, gvcn7A3Doc, noteBefore, tamperedNote);
      expect(allowed).toBe(false);
    });

    it('4.7 note deletion: author and admin can delete; third-party teacher cannot', () => {
      const noteBefore = {
        id: 'note_001',
        authorId: 'teacher_math_01',
        classId: '7A3',
        type: 'negative',
      };

      // Author can delete
      expect(canDeleteBehaviorNote(authorTeacherAuth, authorTeacherDoc, noteBefore)).toBe(true);

      // Admin can delete
      expect(canDeleteBehaviorNote(adminAuth, adminDoc, noteBefore)).toBe(true);

      // Third-party teacher cannot delete
      expect(canDeleteBehaviorNote(gvcn9A3Auth, gvcn9A3Doc, noteBefore)).toBe(false);
    });
  });

  // ===========================================================================
  // REQUIREMENT 5: Immutable Audit Trail Invariant
  // ===========================================================================
  describe('5. Immutable Audit Trail Invariant', () => {
    const adminAuth: RequestAuth = {
      uid: 'admin_uid',
      token: { admin: true, roles: ['admin'] },
    };
    const adminDoc: UserDoc = {
      uid: 'admin_uid',
      roles: ['admin'],
    };

    const regularTeacherAuth: RequestAuth = {
      uid: 'teacher_uid',
      token: { roles: ['gvbm'] },
    };
    const regularTeacherDoc: UserDoc = {
      uid: 'teacher_uid',
      roles: ['gvbm'],
    };

    it('5.1 Attempt to UPDATE an audit log MUST be rejected unconditionally (if false;)', () => {
      // By regular teacher
      expect(auditLogRules.canUpdate(regularTeacherAuth, regularTeacherDoc)).toBe(false);

      // By Admin
      expect(auditLogRules.canUpdate(adminAuth, adminDoc)).toBe(false);

      // By system or unauthenticated
      expect(auditLogRules.canUpdate(null, null)).toBe(false);
    });

    it('5.2 Attempt to DELETE an audit log MUST be rejected unconditionally (if false;)', () => {
      // By regular teacher
      expect(auditLogRules.canDelete(regularTeacherAuth, regularTeacherDoc)).toBe(false);

      // By Admin
      expect(auditLogRules.canDelete(adminAuth, adminDoc)).toBe(false);

      // By system or unauthenticated
      expect(auditLogRules.canDelete(null, null)).toBe(false);
    });

    it('5.3 Authenticated user creating audit log MUST pass', () => {
      expect(auditLogRules.canCreate(regularTeacherAuth)).toBe(true);
      expect(auditLogRules.canCreate(adminAuth)).toBe(true);
    });

    it('5.4 Unauthenticated actor creating audit log MUST be rejected', () => {
      expect(auditLogRules.canCreate(null)).toBe(false);
      expect(auditLogRules.canCreate({ uid: '' })).toBe(false);
    });

    it('5.5 Admin reading audit log MUST pass', () => {
      expect(auditLogRules.canRead(adminAuth, adminDoc)).toBe(true);
    });

    it('5.6 Non-admin reading audit log MUST be rejected', () => {
      expect(auditLogRules.canRead(regularTeacherAuth, regularTeacherDoc)).toBe(false);

      const gvcnAuth: RequestAuth = { uid: 'gvcn_uid', token: { roles: ['gvcn'] } };
      const gvcnDoc: UserDoc = { uid: 'gvcn_uid', roles: ['gvcn'] };
      expect(auditLogRules.canRead(gvcnAuth, gvcnDoc)).toBe(false);

      const tptAuth: RequestAuth = { uid: 'tpt_uid', token: { roles: ['tpt'] } };
      const tptDoc: UserDoc = { uid: 'tpt_uid', roles: ['tpt'] };
      expect(auditLogRules.canRead(tptAuth, tptDoc)).toBe(false);

      expect(auditLogRules.canRead(null, null)).toBe(false);
    });
  });

  // ===========================================================================
  // REQUIREMENT 6: Static Rules AST & Syntax Invariant Verification
  // ===========================================================================
  describe('6. Static Security Rules AST & Pattern Verification', () => {
    const rulesPath = path.resolve(__dirname, '../../firestore.rules');

    it('6.1 verifies firestore.rules exists and specifies rules_version = "2"', () => {
      expect(fs.existsSync(rulesPath)).toBe(true);
      const content = fs.readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');
      expect(content).toMatch(/rules_version\s*=\s*'2';/);
    });

    it('6.2 verifies isValidPeriodScores enforces all 5 upper bounds and >= 0.0 at database layer', () => {
      const content = fs.readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');
      expect(content).toContain('function isValidPeriodScores(scores)');
      expect(content).toMatch(/scores\.learning\s+is\s+number\s+&&\s+scores\.learning\s*>=\s*0\.0\s+&&\s+scores\.learning\s*<=\s*4\.0/);
      expect(content).toMatch(/scores\.discipline\s+is\s+number\s+&&\s+scores\.discipline\s*>=\s*0\.0\s+&&\s+scores\.discipline\s*<=\s*3\.0/);
      expect(content).toMatch(/scores\.hygiene\s+is\s+number\s+&&\s+scores\.hygiene\s*>=\s*0\.0\s+&&\s+scores\.hygiene\s*<=\s*2\.0/);
      expect(content).toMatch(/scores\.customCriterion\s+is\s+number\s+&&\s+scores\.customCriterion\s*>=\s*0\.0\s+&&\s+scores\.customCriterion\s*<=\s*1\.0/);
      expect(content).toMatch(/scores\.total\s+is\s+number\s+&&\s+scores\.total\s*>=\s*0\.0\s+&&\s+scores\.total\s*<=\s*10\.0/);
    });

    it('6.3 verifies users collection enforces strict whitelist for non-admin self updates', () => {
      const content = fs.readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');
      expect(content).toContain("hasOnly([\n            'passwordHash',\n            'mustChangePassword',\n            'lastLoginAt',\n            'updatedAt'\n          ])");
    });

    it('6.4 verifies audit_logs collection has unconditional "allow update: if false;" and "allow delete: if false;"', () => {
      const content = fs.readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');
      expect(content).toContain('match /audit_logs/{logId}');
      expect(content).toMatch(/allow\s+update:\s*if\s+false;/);
      expect(content).toMatch(/allow\s+delete:\s*if\s+false;/);
      // 2026-10-11: chỉ ghi được bản nhật ký đứng tên chính mình
      expect(content).toMatch(/allow\s+create:\s*if\s+isAuthenticated\(\)\s*&&\s*request\.resource\.data\.actorId\s*==\s*request\.auth\.uid;/);
      expect(content).toMatch(/allow\s+read:\s*if\s+isAuthenticated\(\)\s*&&\s*isAdmin\(\);/);
    });

    it('6.5 verifies behavior_notes enforces authorId == request.auth.uid on creation', () => {
      const content = fs.readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');
      expect(content).toContain('match /behavior_notes/{noteId}');
      expect(content).toMatch(/request\.resource\.data\.authorId\s*==\s*request\.auth\.uid/);
      expect(content).toMatch(/request\.resource\.data\.type\s+in\s+\['positive',\s*'negative'\]/);
    });

    it('6.6 verifies schedules collection: only Admin writes (2026-10-11 — GVCN no longer edits TKB directly)', () => {
      const content = fs.readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');
      expect(content).toContain('match /schedules/{classId}');
      expect(content).toMatch(/match \/schedules\/\{classId\} \{[\s\S]*?allow\s+write:\s*if\s+isAuthenticated\(\)\s*&&\s*isAdmin\(\);/);
    });

    it('6.7 verifies fallback catch-all rule enforces default deny (allow read, write: if false;)', () => {
      const content = fs.readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');
      expect(content).toContain('match /{document=**}');
      expect(content).toMatch(/allow\s+read,\s*write:\s*if\s+false;/);
    });
  });
});
