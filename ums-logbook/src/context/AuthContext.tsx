/**
 * UMS Digital Class Logbook - AuthContext & Provider
 * Encapsulates Authentication, Dual-Role RBAC, Password Change Interception,
 * and 30-Minute Idle Session Timeout.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  signInWithUsernameOrEmail,
  logoutUser,
  changePassword as authChangePassword,
  subscribeToAuthChanges,
} from '../services/authService';
import { UserProfile, UserRole } from '../types/auth';

export interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  activeRole: UserRole | null;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  mustChangePassword: boolean;
  isIdleWarningOpen: boolean;
  idleRemainingSeconds: number;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  switchActiveRole: (role: UserRole) => void;
  setActiveRole: (role: UserRole) => void;
  extendSession: () => void;
  hasRole: (role: UserRole) => boolean;
  canAccessClass: (classId: string) => boolean;
  canEditPeriod: (classId: string, periodIndex: number, scheduledTeacherId?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_TIMEOUT_MS = 28 * 60 * 1000; // 28 minutes
const THROTTLE_ACTIVITY_MS = 15 * 1000; // 15 seconds

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  // Idle timeout states
  const [isIdleWarningOpen, setIsIdleWarningOpen] = useState<boolean>(false);
  const [idleRemainingSeconds, setIdleRemainingSeconds] = useState<number>(120);

  const lastActivityRef = useRef<number>(Date.now());
  const idleCheckIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Determine initial role prioritizing admin > gvcn > tpt > gvbm
  const determineInitialRole = (roles: UserRole[]): UserRole => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('gvcn')) return 'gvcn';
    if (roles.includes('tpt')) return 'tpt';
    if (roles.includes('giamthi')) return 'giamthi';
    if (roles.includes('vanphong')) return 'vanphong';
    if (roles.includes('gvbm')) return 'gvbm';
    // PH/HS: tuyệt đối không rơi về vai trò giáo viên
    if (roles.includes('parent')) return 'parent';
    if (roles.includes('student')) return 'student';
    return 'gvbm';
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser, userProfile) => {
      setUser(currentUser);
      setProfile(userProfile);
      if (userProfile) {
        setMustChangePassword(userProfile.mustChangePassword);
        setActiveRoleState((prev) =>
          prev && userProfile.roles.includes(prev) ? prev : determineInitialRole(userProfile.roles)
        );
      } else {
        setActiveRoleState(null);
        setMustChangePassword(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearError = () => setError(null);

  // Idle Timeout Engine
  const resetActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > THROTTLE_ACTIVITY_MS) {
      lastActivityRef.current = now;
      localStorage.setItem('ums_last_activity', now.toString());
    }
  }, []);

  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem('ums_last_activity', now.toString());
    setIsIdleWarningOpen(false);
    setIdleRemainingSeconds(120);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setIsIdleWarningOpen(false);
    if (idleCheckIntervalRef.current) clearInterval(idleCheckIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    await logoutUser();
    setUser(null);
    setProfile(null);
    setActiveRoleState(null);
  }, []);

  // Set up activity event listeners and multi-tab sync
  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleUserActivity = () => {
      if (!isIdleWarningOpen) {
        resetActivity();
      }
    };

    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ums_last_activity' && e.newValue) {
        lastActivityRef.current = parseInt(e.newValue, 10);
        if (isIdleWarningOpen) {
          extendSession();
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Periodic check every 10 seconds
    idleCheckIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= IDLE_TIMEOUT_MS) {
        localStorage.setItem('ums_logout_reason', 'idle_timeout');
        handleLogout();
      } else if (elapsed >= WARNING_TIMEOUT_MS && !isIdleWarningOpen) {
        setIsIdleWarningOpen(true);
        const remaining = Math.max(0, Math.floor((IDLE_TIMEOUT_MS - elapsed) / 1000));
        setIdleRemainingSeconds(remaining);

        // Start 1-second countdown
        countdownIntervalRef.current = window.setInterval(() => {
          setIdleRemainingSeconds((prev) => {
            if (prev <= 1) {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              localStorage.setItem('ums_logout_reason', 'idle_timeout');
              handleLogout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }, 10000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      window.removeEventListener('storage', handleStorageChange);
      if (idleCheckIntervalRef.current) clearInterval(idleCheckIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, isIdleWarningOpen, resetActivity, extendSession, handleLogout]);

  // Auth Operations
  const login = async (username: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { user: authedUser, profile: authedProfile } = await signInWithUsernameOrEmail(
        username,
        pass
      );
      setUser(authedUser);
      setProfile(authedProfile);
      setMustChangePassword(authedProfile.mustChangePassword);
      setActiveRoleState(determineInitialRole(authedProfile.roles));
      lastActivityRef.current = Date.now();
      localStorage.setItem('ums_last_activity', Date.now().toString());
    } catch (err: any) {
      let friendlyMessage = 'Đăng nhập không thành công. Vui lòng kiểm tra lại.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'Tên đăng nhập hoặc mật khẩu không chính xác.';
      } else if (err.code === 'auth/wrong-password') {
        friendlyMessage = 'Mật khẩu không chính xác.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyMessage = 'Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau.';
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
      throw new Error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (newPass: string, currPass?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authChangePassword(currPass || '', newPass);
      setMustChangePassword(false);
      if (profile) {
        setProfile({ ...profile, mustChangePassword: false, updatedAt: Date.now() });
      }
    } catch (err: any) {
      let msg = err.message || 'Đổi mật khẩu thất bại.';
      if (err.code === 'auth/wrong-password') {
        msg = 'Mật khẩu hiện tại không chính xác.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const switchActiveRole = (role: UserRole) => {
    if (profile && profile.roles.includes(role)) {
      setActiveRoleState(role);
    }
  };

  const setActiveRole = (role: UserRole) => {
    switchActiveRole(role);
  };

  const hasRole = (role: UserRole): boolean => {
    return profile?.roles.includes(role) ?? false;
  };

  const canAccessClass = (classId: string): boolean => {
    if (!profile) return false;
    if (profile.roles.includes('admin') || profile.roles.includes('tpt') || profile.roles.includes('giamthi')) return true;
    if (profile.roles.includes('gvcn') && profile.assignedClassId === classId) return true;
    return true; // GVBM can view classes to input period entries
  };

  const canEditPeriod = (
    classId: string,
    _periodIndex: number,
    scheduledTeacherId?: string
  ): boolean => {
    if (!profile) return false;
    if (profile.roles.includes('admin')) return true;
    if (scheduledTeacherId && (profile.uid === scheduledTeacherId || profile.username === scheduledTeacherId)) return true;
    if (profile.roles.includes('gvcn') && profile.assignedClassId === classId) return true;
    return true; // Allows subject teachers to sign their periods
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        activeRole,
        isLoading,
        error,
        clearError,
        mustChangePassword,
        isIdleWarningOpen,
        idleRemainingSeconds,
        login,
        logout: handleLogout,
        changePassword,
        switchActiveRole,
        setActiveRole,
        extendSession,
        hasRole,
        canAccessClass,
        canEditPeriod,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
