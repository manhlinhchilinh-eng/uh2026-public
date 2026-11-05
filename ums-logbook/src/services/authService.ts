/**
 * UMS Digital Class Logbook - Authentication Service
 */
import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  Unsubscribe,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { UserProfile, UserRole } from '../types/auth';
import { seedMockStorage } from './seedService';
import { verifyPassword, hashPassword, DEFAULT_PASSWORD_HASH } from '../utils/crypto';
import { logAuditEvent } from './auditService';
import { clearLeaveSessionKeys } from '../utils/studentLeave';

const UMS_EMAIL_DOMAIN = '@ums.edu.vn';
const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/**
 * Resolves a username or email input into a canonical UMS email
 * e.g. "mrlinhums" -> "mrlinhums@ums.edu.vn"
 */
export function resolveUsernameToEmail(input: string): string {
  const clean = input.trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) {
    return clean;
  }
  return `${clean}${UMS_EMAIL_DOMAIN}`;
}

/**
 * Extracts username from canonical email or raw string
 */
export function extractUsername(emailOrUsername: string): string {
  const clean = emailOrUsername.trim().toLowerCase();
  if (clean.endsWith(UMS_EMAIL_DOMAIN)) {
    return clean.replace(UMS_EMAIL_DOMAIN, '');
  }
  if (clean.includes('@')) {
    return clean.split('@')[0];
  }
  return clean;
}

/**
 * Retrieves mock users from localStorage
 */
function getMockUsers(): any[] {
  try {
    const raw = localStorage.getItem('ums_users');
    if (raw) {
      const parsed = JSON.parse(raw);
      let modified = false;
      for (const u of parsed) {
        if (u.password) {
          if (!u.passwordHash) u.passwordHash = DEFAULT_PASSWORD_HASH;
          delete u.password;
          modified = true;
        }
      }
      if (modified) {
        localStorage.setItem('ums_users', JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch (e) {
    // ignore
  }
  // If not seeded yet, seed now
  const result = seedMockStorage();
  if (result.success) {
    try {
      const raw = localStorage.getItem('ums_users');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // ignore
    }
  }
  return [];
}

/**
 * Saves mock users to localStorage
 */
function saveMockUsers(users: any[]): void {
  try {
    localStorage.setItem('ums_users', JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save mock users', e);
  }
}

/**
 * Vai trò tạm khi đăng nhập Firebase thành công nhưng không đọc được hồ sơ.
 * TK học sinh/phụ huynh (hs/ph + mã HS 6 số) KHÔNG bao giờ được gán vai trò giáo viên.
 */
export function fallbackRoleForUsername(username: string): UserRole {
  if (/^hs\d{6}$/i.test(username)) return 'student';
  if (/^ph\d{6}$/i.test(username)) return 'parent';
  return 'gvbm';
}

/**
 * Authenticates user via Firebase Auth or Mock Storage Fallback
 */
export async function signInWithUsernameOrEmail(
  usernameOrEmail: string,
  password: string
): Promise<{ user: any; profile: UserProfile }> {
  const email = resolveUsernameToEmail(usernameOrEmail);
  const username = extractUsername(usernameOrEmail);

  if (!email || !username) {
    throw new Error('Tên đăng nhập không được để trống.');
  }

  // Check if running in test environment or offline mock
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  if (!isTestEnv) {
    // Step 1: Authenticate with Firebase Auth
    let fbUser: any = null;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      fbUser = credential.user;
    } catch (firebaseErr: any) {
      console.error('[authService] Firebase Auth failed:', firebaseErr.code, firebaseErr.message);
      if (
        firebaseErr.code === 'auth/wrong-password' ||
        firebaseErr.code === 'auth/invalid-credential'
      ) {
        throw new Error('Mật khẩu không chính xác.');
      }
      if (firebaseErr.code === 'auth/user-not-found') {
        throw new Error('Tên đăng nhập không tồn tại.');
      }
      // Bản chạy thật: KHÔNG đăng nhập offline bằng dữ liệu giả (dễ nhầm, mật khẩu mặc định).
      if (import.meta.env.PROD) {
        throw new Error('Không kết nối được máy chủ đăng nhập. Kiểm tra mạng rồi thử lại.');
      }
      // Bản phát triển: rơi về dữ liệu giả
      console.error('[authService] Falling back to offline login');
    }

    // Step 2: If Firebase Auth succeeded, get profile from Firestore
    if (fbUser) {
      let profile: UserProfile | null = null;
      try {
        profile = await getUserProfile(fbUser.uid);
        if (!profile) {
          profile = await findUserProfileByUsername(username);
          if (profile) {
            await setDoc(doc(db, 'users', fbUser.uid), {
              ...profile,
              uid: fbUser.uid,
              updatedAt: Date.now(),
            });
          }
        }
      } catch (profileErr) {
        console.error('[authService] Profile lookup error:', profileErr);
      }

      if (profile) {
        // Step 3: Record login (non-blocking — don't let this fail the login)
        try {
          await recordUserLogin(fbUser.uid);
        } catch (e) {
          console.warn('[authService] recordUserLogin failed (non-blocking):', e);
        }
        try {
          await logAuditEvent({
            actor: {
              actorId: profile.uid,
              actorName: profile.displayName || profile.username,
              actorRole: profile.roles[0] || 'gvbm',
            },
            action: 'LOGIN',
            targetCollection: 'auth',
            targetId: profile.uid,
            details: `Đăng nhập thành công với tài khoản ${profile.username}.`,
          });
        } catch (e) {
          console.warn('[authService] Audit log failed (non-blocking):', e);
        }
        return { user: fbUser, profile };
      } else {
        // Firebase Auth OK but no profile in Firestore — create a minimal profile
        console.warn('[authService] Firebase Auth OK but no Firestore profile found for', fbUser.uid);
        const minimalProfile: UserProfile = {
          uid: fbUser.uid,
          username,
          email,
          displayName: username,
          roles: [fallbackRoleForUsername(username)],
          mustChangePassword: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return { user: fbUser, profile: minimalProfile };
      }
    }
  }

  // Mock / Local Storage Authentication Logic
  const mockUsers = getMockUsers();
  const foundUser = mockUsers.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() ||
      u.email.toLowerCase() === email.toLowerCase()
  );

  if (!foundUser) {
    const error: any = new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
    error.code = 'auth/user-not-found';
    throw error;
  }

  const storedHash = foundUser.passwordHash || DEFAULT_PASSWORD_HASH;
  const isMatch = await verifyPassword(password, storedHash);
  if (!isMatch) {
    const error: any = new Error('Mật khẩu không chính xác.');
    error.code = 'auth/wrong-password';
    throw error;
  }

  // Update lastLoginAt
  foundUser.lastLoginAt = Date.now();
  saveMockUsers(mockUsers);

  const profile: UserProfile = {
    uid: foundUser.uid,
    username: foundUser.username,
    email: foundUser.email,
    displayName: foundUser.displayName,
    roles: foundUser.roles,
    assignedClassId: foundUser.assignedClassId,
    mustChangePassword: foundUser.mustChangePassword,
    createdAt: foundUser.createdAt,
    lastLoginAt: foundUser.lastLoginAt,
    updatedAt: foundUser.updatedAt || Date.now(),
  };

  const mockAuthUser = {
    uid: foundUser.uid,
    email: foundUser.email,
    displayName: foundUser.displayName,
  };

  localStorage.setItem('ums_current_user', JSON.stringify(profile));

  await logAuditEvent({
    actor: {
      actorId: profile.uid,
      actorName: profile.displayName || profile.username,
      actorRole: profile.roles[0] || 'gvbm',
    },
    action: 'LOGIN',
    targetCollection: 'auth',
    targetId: profile.uid,
    details: `Đăng nhập thành công với tài khoản ${profile.username}.`,
  });

  return { user: mockAuthUser, profile };
}

// Alias for backwards compatibility
export const loginWithUsername = signInWithUsernameOrEmail;

/**
 * Retrieves a user profile document from Firestore or Mock Storage
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userDocRef);
    if (snapshot.exists()) {
      return snapshot.data() as UserProfile;
    }
  } catch (e) {
    // ignore
  }

  // Fallback to mock storage
  const mockUsers = getMockUsers();
  const found = mockUsers.find((u) => u.uid === uid);
  if (found) {
    const { password, passwordHash, ...profile } = found;
    return profile as UserProfile;
  }

  return null;
}

/**
 * Finds user profile by username query
 */
export async function findUserProfileByUsername(username: string): Promise<UserProfile | null> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as UserProfile;
    }
  } catch (e) {
    // ignore
  }

  const mockUsers = getMockUsers();
  const found = mockUsers.find((u) => u.username.toLowerCase() === username.toLowerCase().trim());
  if (found) {
    const { password, passwordHash, ...profile } = found;
    return profile as UserProfile;
  }

  return null;
}

/**
 * Updates user profile updates in Firestore and Local Storage
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, { ...updates, updatedAt: Date.now() });
  } catch (e) {
    // ignore
  }

  const mockUsers = getMockUsers();
  const idx = mockUsers.findIndex((u) => u.uid === uid);
  if (idx !== -1) {
    mockUsers[idx] = { ...mockUsers[idx], ...updates, updatedAt: Date.now() };
    saveMockUsers(mockUsers);
  }

  const currentRaw = localStorage.getItem('ums_current_user');
  if (currentRaw) {
    try {
      const current = JSON.parse(currentRaw);
      if (current.uid === uid) {
        localStorage.setItem(
          'ums_current_user',
          JSON.stringify({ ...current, ...updates, updatedAt: Date.now() })
        );
      }
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Records login timestamp and writes an audit event
 */
export async function recordUserLogin(uid: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      lastLoginAt: Date.now(),
    });
  } catch (err) {
    // ignore
  }
}

/**
 * Validates password complexity according to UMS security policy:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 *
 * @throws {Error} with localized message if validation fails
 */
export function validatePasswordComplexity(password: string): void {
  if (!password || password.length < 8) {
    throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Mật khẩu phải chứa ít nhất một chữ in hoa (A-Z).');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Mật khẩu phải chứa ít nhất một chữ thường (a-z).');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Mật khẩu phải chứa ít nhất một chữ số (0-9).');
  }
}

/**
 * Updates user password in Firebase Auth and updates mustChangePassword flag
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.trim() === (currentPassword || '').trim()) {
    throw new Error('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
  }
  // Validate defense-in-depth complexity criteria
  validatePasswordComplexity(newPassword);

  const currentUser = auth.currentUser;
  let changedInFirebase = false;

  if (currentUser && currentUser.email) {
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      changedInFirebase = true;
    } catch (err: any) {
      console.warn('Firebase reauth/updatePassword error:', err);
      // KHÔNG được bỏ qua: trước đây lỗi bị nuốt → app báo đổi thành công, bỏ cờ mustChangePassword,
      // nhưng mật khẩu thật trên Firebase vẫn là mật khẩu cũ → GV không đăng nhập được bằng MK mới (05/11/2026).
      const code = err?.code || '';
      const e: any = new Error(
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Mật khẩu hiện tại không chính xác.'
          : code === 'auth/too-many-requests'
            ? 'Thử sai quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.'
            : code === 'auth/network-request-failed'
              ? 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
              : 'Không đổi được mật khẩu. Vui lòng thử lại.'
      );
      e.code = code === 'auth/invalid-credential' ? 'auth/wrong-password' : code || 'auth/unknown';
      throw e;
    }
  }

  // Update in Firestore if user is authenticated
  if (currentUser) {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        mustChangePassword: false,
        updatedAt: Date.now(),
      });
    } catch (e) {
      // ignore
    }
  }

  // Update mock storage
  const currentRaw = localStorage.getItem('ums_current_user');
  if (currentRaw) {
    try {
      const current = JSON.parse(currentRaw);
      const mockUsers = getMockUsers();
      const idx = mockUsers.findIndex((u) => u.uid === current.uid);
      if (idx !== -1) {
        if (!changedInFirebase) {
          const storedHash = mockUsers[idx].passwordHash || DEFAULT_PASSWORD_HASH;
          const isCurrentValid = await verifyPassword(currentPassword, storedHash);
          if (!isCurrentValid) {
            const err: any = new Error('Mật khẩu hiện tại không chính xác.');
            err.code = 'auth/wrong-password';
            throw err;
          }
        }
        const newPasswordHash = await hashPassword(newPassword);
        mockUsers[idx].passwordHash = newPasswordHash;
        delete mockUsers[idx].password;
        mockUsers[idx].mustChangePassword = false;
        mockUsers[idx].updatedAt = Date.now();
        saveMockUsers(mockUsers);
      }

      current.mustChangePassword = false;
      current.updatedAt = Date.now();
      localStorage.setItem('ums_current_user', JSON.stringify(current));
    } catch (e: any) {
      if (e.code === 'auth/wrong-password') throw e;
    }
  }

  // Record audit log
  const profileRaw = localStorage.getItem('ums_current_user');
  let currentProfile: UserProfile | null = null;
  if (profileRaw) {
    try {
      currentProfile = JSON.parse(profileRaw);
    } catch {}
  }
  const actorId = currentUser ? currentUser.uid : currentProfile?.uid || 'local_user';
  const actorName = currentProfile?.displayName || currentUser?.email || 'Người dùng';
  const actorRole = currentProfile?.roles?.[0] || 'gvbm';

  await logAuditEvent({
    actor: {
      actorId,
      actorName,
      actorRole,
    },
    action: 'PASSWORD_CHANGE',
    targetCollection: 'auth',
    targetId: actorId,
    beforeState: { mustChangePassword: true },
    afterState: { mustChangePassword: false },
    details: 'Người dùng đổi mật khẩu thành công.',
  });
}

// Alias
export const changeUserPassword = changePassword;

/**
 * Logs out the current user and clears local state
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    // ignore
  }
  localStorage.removeItem('ums_current_user');
  localStorage.removeItem('ums_last_activity');
  // Cache đơn nghỉ (bộ nhớ + sessionStorage ums_leave_*): người đăng nhập sau trên cùng tab không thấy dữ liệu cũ.
  // Xoá key sessionStorage tại chỗ (đồng bộ), cache bộ nhớ qua import động không chờ
  // (không kéo service vào gói đăng nhập, không làm chậm đăng xuất).
  clearLeaveSessionKeys();
  void import('./studentLeaveService').then((m) => m.clearLeaveCaches()).catch(() => undefined);
  // Cache văn bản Hành chính (localStorage): xoá hết để máy dùng chung không lộ cho người sau.
  void import('./adminDocCache').then((m) => m.clearAdminDocCache()).catch(() => undefined);
}

/**
 * Subscribes to Firebase Auth state changes
 */
export function subscribeToAuthChanges(
  callback: (user: any | null, profile: UserProfile | null) => void
): Unsubscribe {
  if (isTestEnv) {
    const currentRaw = localStorage.getItem('ums_current_user');
    if (currentRaw) {
      try {
        const profile = JSON.parse(currentRaw);
        callback({ uid: profile.uid, email: profile.email }, profile);
      } catch (err) {
        callback(null, null);
      }
    } else {
      callback(null, null);
    }
    return () => {};
  }

  try {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        console.log('[authService] onAuthStateChanged: user signed in, uid:', fbUser.uid);
        let profile = await getUserProfile(fbUser.uid);
        if (!profile) {
          console.warn('[authService] onAuthStateChanged: getUserProfile returned null, trying by username');
          // Try to find by email-derived username
          const username = fbUser.email?.replace('@ums.edu.vn', '') || '';
          if (username) {
            profile = await findUserProfileByUsername(username);
          }
        }
        console.log('[authService] onAuthStateChanged: profile found:', !!profile, profile?.username);
        callback(fbUser, profile);
      } else {
        console.log('[authService] onAuthStateChanged: no user');
        // Check mock session (chỉ bản phát triển)
        const currentRaw = import.meta.env.PROD ? null : localStorage.getItem('ums_current_user');
        if (currentRaw) {
          try {
            const profile = JSON.parse(currentRaw);
            callback({ uid: profile.uid, email: profile.email }, profile);
            return;
          } catch (e) {
            // ignore
          }
        }
        callback(null, null);
      }
    });
  } catch (e) {
    const currentRaw = localStorage.getItem('ums_current_user');
    if (currentRaw) {
      try {
        const profile = JSON.parse(currentRaw);
        callback({ uid: profile.uid, email: profile.email }, profile);
      } catch (err) {
        callback(null, null);
      }
    } else {
      callback(null, null);
    }
    return () => {};
  }
}
