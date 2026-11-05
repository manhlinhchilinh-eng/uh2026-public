/**
 * Master TypeScript Contracts for UMS Logbook
 */

export * from './auth';
export * from './logbook';
export * from './behavior';
export * from './earlyWarning';
export * from './schedule';
export * from './summary';
export * from './audit';
export * from './importer';

import { UserRole } from './auth';

export interface ClassDoc {
  id: string; // e.g. "6A1"
  name: string; // "6A1"
  grade: number; // 6, 7, 8, 9
  room: string; // "P.6A1"
  gvcnId: string; // "msphuonganhums"
  gvcnName: string; // "Đinh Hoài Long"
  studentCount: number; // 25 or 26
  academicYear: string; // "2026-2027"
  createdAt: number;
}

export interface StudentDoc {
  id: string; // "269398"
  mhs: string; // "269398"
  stt: number; // 1 to 26
  name: string; // "Lý Bảo Duy"
  classId: string; // "6A1"
  grade: number; // 6
  dob: string; // "2015-07-04"
  gender: 'Nam' | 'Nữ';
  status: 'active' | 'transferred' | 'suspended';
  createdAt: number;
  /** ID doc trong /students (vd. "6A1_01") — cần khi BGH cập nhật hồ sơ */
  docId?: string;
  /** Mã định danh Bộ GD&ĐT (CSDL ngành) */
  moetId?: string;
}

export interface UserDoc {
  uid: string;
  username: string; // "mrlinhums"
  email: string; // "mrlinhums@ums.edu.vn"
  displayName: string; // "Hồ Thanh Quang Uyên"
  roles: UserRole[]; // ['admin', 'gvcn', 'gvbm']
  assignedClassId?: string; // "8A3"
  mustChangePassword: boolean; // default: true
  createdAt: number;
  lastLoginAt?: number;
}

export interface ScoringCriterionConfig {
  id: 'learning' | 'discipline' | 'hygiene' | 'customCriterion';
  label: string;
  maxPoints: number;
  step: number;
}

export interface ScoringConfigDoc {
  criteria: ScoringCriterionConfig[];
  maxTotal: number; // 10.0
  activeTerm: number; // 1
  activeWeek: number; // 1
  schoolYear: string; // "2026-2027"
}
