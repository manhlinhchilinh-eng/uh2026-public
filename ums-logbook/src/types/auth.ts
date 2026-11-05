/**
 * UMS Digital Class Logbook - Authentication & RBAC Types
 */

export type UserRole = 'admin' | 'gvcn' | 'gvbm' | 'tpt' | 'giamthi' | 'vanphong' | 'parent' | 'student';

/** Vai trò nhân sự nhà trường (BGH/Tổ trưởng gộp trong 'admin'). */
export const STAFF_ROLES: UserRole[] = ['admin', 'gvcn', 'gvbm', 'tpt', 'giamthi'];
/** Vai trò gia đình: phụ huynh và học sinh. */
export const FAMILY_ROLES: UserRole[] = ['parent', 'student'];

export interface UserProfile {
  uid: string;
  username: string; // e.g. "mrlinhums", lowercase, no diacritics
  email: string; // resolved as <username>@ums.edu.vn
  displayName: string; // e.g. "Hồ Thanh Quang Uyên"
  roles: UserRole[]; // e.g. ['admin', 'gvcn', 'gvbm']
  assignedClassId?: string; // e.g. "8A3" if user is GVCN
  teachingSubjects?: string[]; // e.g. ["Tin học", "Toán"]
  mustChangePassword: boolean; // default true for initial logins
  createdAt: number;
  lastLoginAt?: number;
  updatedAt?: number;
  avatarUrl?: string;
  phone?: string;
  status?: 'active' | 'suspended';
  /** PH/HS: doc ID trong /students được liên kết (HS: chính mình; PH: các con) */
  studentDocIds?: string[];
  /** PH/HS: mã HS tương ứng với studentDocIds */
  studentMhs?: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface PasswordChangeData {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserRoleOption {
  role: UserRole;
  labelVi: string;
  labelEn: string;
  badgeColor: string;
  iconName: string;
}
