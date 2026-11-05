import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  generateSeedDataset,
  seedMockStorage,
  GVCN_USER_MAPPING,
} from '../services/seedService';
import {
  signInWithUsernameOrEmail,
  resolveUsernameToEmail,
  extractUsername,
} from '../services/authService';
import { AuthProvider, useAuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { RoleGuard } from '../components/layout/RoleGuard';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import rawClassData from '../../data/class_data.json';
import fs from 'fs';
import path from 'path';

// Helper component for testing role switching & permissions in React tree
const RoleSwitchTestComponent: React.FC = () => {
  const { profile, activeRole, switchActiveRole, hasRole } = useAuthContext();

  return (
    <div>
      <div data-testid="profile-username">{profile?.username || 'none'}</div>
      <div data-testid="profile-roles">{profile?.roles.join(',') || 'none'}</div>
      <div data-testid="active-role">{activeRole || 'none'}</div>
      <div data-testid="has-role-admin">{hasRole('admin') ? 'yes' : 'no'}</div>
      <div data-testid="has-role-gvcn">{hasRole('gvcn') ? 'yes' : 'no'}</div>

      <button
        data-testid="btn-switch-admin"
        onClick={() => switchActiveRole('admin')}
      >
        Switch Admin
      </button>
      <button
        data-testid="btn-switch-gvcn"
        onClick={() => switchActiveRole('gvcn')}
      >
        Switch GVCN
      </button>
      <button
        data-testid="btn-switch-gvbm"
        onClick={() => switchActiveRole('gvbm')}
      >
        Switch GVBM
      </button>
      <button
        data-testid="btn-switch-tpt"
        onClick={() => switchActiveRole('tpt')}
      >
        Switch TPT
      </button>
    </div>
  );
};

// Test Router for testing route protection
const RouteProtectionTestApp: React.FC<{ initialRoute: string }> = ({ initialRoute }) => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard Page</div>} />

            <Route element={<ProtectedRoute />}>
              <Route path="/protected-common" element={<div data-testid="common-page">Common Page</div>} />

              {/* Admin Protected Routes */}
              <Route element={<RoleGuard allowedRoles={['admin']} />}>
                <Route path="/users" element={<div data-testid="admin-users-page">Admin Users Page</div>} />
                <Route path="/seed" element={<div data-testid="admin-seed-page">Admin Seed Page</div>} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

describe('Milestone 1 Challenger Suite (Empirical & Adversarial)', () => {
  beforeEach(() => {
    localStorage.clear();
    seedMockStorage();
  });

  // =========================================================================
  // 1. Dual-Role and Required Accounts Verification
  // =========================================================================
  describe('1. Dual-Role and Key Accounts Integrity', () => {
    const { users, classes } = generateSeedDataset();

    it('1.1 mrlinhums: Admin + GVCN 9A3 (assignedClassId: "9A3")', () => {
      const user = users.find((u) => u.username === 'mrlinhums');
      expect(user, 'Account mrlinhums must exist').toBeDefined();
      expect(user!.roles).toContain('admin');
      expect(user!.roles).toContain('gvcn');
      expect(user!.roles).toContain('gvbm');
      expect(user!.assignedClassId).toBe('9A3');
      expect(user!.displayName).toBe('Nguyễn Mạnh Linh');
      expect(user!.email).toBe('mrlinhums@ums.edu.vn');
      expect(user!.mustChangePassword).toBe(true);

      // Verify class 9A3 points to mrlinhums
      const class9A3 = classes.find((c) => c.id === '9A3');
      expect(class9A3).toBeDefined();
      expect(class9A3!.gvcnId).toBe('mrlinhums');
      expect(class9A3!.gvcnName).toBe('Nguyễn Mạnh Linh');
    });

    it('1.2 msngoclinhums: regular GVCN 8A3 (assignedClassId: "8A3", NOT admin)', () => {
      const user = users.find((u) => u.username === 'msngoclinhums');
      expect(user, 'Account msngoclinhums must exist').toBeDefined();
      expect(user!.roles).toContain('gvcn');
      expect(user!.roles).toContain('gvbm');
      expect(user!.roles).not.toContain('admin');
      expect(user!.assignedClassId).toBe('8A3');
      expect(user!.displayName).toBe('Hồ Thanh Quang Uyên');
      expect(user!.email).toBe('msngoclinhums@ums.edu.vn');
      expect(user!.mustChangePassword).toBe(true);

      // Verify class 8A3 points to msngoclinhums
      const class8A3 = classes.find((c) => c.id === '8A3');
      expect(class8A3).toBeDefined();
      expect(class8A3!.gvcnId).toBe('msngoclinhums');
      expect(class8A3!.gvcnName).toBe('Hồ Thanh Quang Uyên');
    });

    it('1.3 mshuyentrangums & msthanhhuyenums: Check configuration against Correction #2', () => {
      const principal = users.find((u) => u.username === 'mshuyentrangums');
      expect(principal, 'Account mshuyentrangums must exist').toBeDefined();
      expect(principal!.roles).toEqual(['admin']);
      expect(principal!.assignedClassId).toBeUndefined();
      expect(principal!.email).toBe('mshuyentrangums@ums.edu.vn');
      expect(principal!.displayName).toBe('Hiệu trưởng / Principal');

      const gvcn7a3 = users.find((u) => u.username === 'msthanhhuyenums');
      expect(gvcn7a3, 'Account msthanhhuyenums must exist for 7A3').toBeDefined();
      expect(gvcn7a3!.roles).toEqual(['gvcn', 'gvbm']);
      expect(gvcn7a3!.assignedClassId).toBe('7A3');
      expect(gvcn7a3!.displayName).toBe('Nguyễn Phương Minh Hạnh');
    });

    it('1.4 mrhoanggiangums: Admin only (no assigned class)', () => {
      const user = users.find((u) => u.username === 'mrhoanggiangums');
      expect(user, 'Account mrhoanggiangums must exist').toBeDefined();
      expect(user!.roles).toEqual(['admin']);
      expect(user!.assignedClassId).toBeUndefined();
      expect(user!.email).toBe('mrhoanggiangums@ums.edu.vn');
      expect(user!.displayName).toBe('Hoàng Giang');
      expect(user!.mustChangePassword).toBe(true);
    });

    it('1.5 mrhoanglongums: TPT only (no assigned class)', () => {
      const user = users.find((u) => u.username === 'mrhoanglongums');
      expect(user, 'Account mrhoanglongums must exist').toBeDefined();
      expect(user!.roles).toEqual(['tpt']);
      expect(user!.assignedClassId).toBeUndefined();
      expect(user!.email).toBe('mrhoanglongums@ums.edu.vn');
      expect(user!.displayName).toBe('Hoàng Long');
      expect(user!.mustChangePassword).toBe(true);
    });
  });

  // =========================================================================
  // 2. Role Switching and Privilege Escalation Prevention
  // =========================================================================
  describe('2. Role Switching & Privilege Escalation Adversarial Tests', () => {
    it('2.1 Non-admin account (msngoclinhums) CANNOT escalate to admin via switchActiveRole', async () => {
      // Authenticate as regular GVCN msngoclinhums
      await signInWithUsernameOrEmail('msngoclinhums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <RoleSwitchTestComponent />
          </AuthProvider>
        </LanguageProvider>
      );

      expect(screen.getByTestId('profile-username')).toHaveTextContent('msngoclinhums');
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');
      expect(screen.getByTestId('has-role-admin')).toHaveTextContent('no');

      // Attempt privilege escalation to admin
      await act(async () => {
        screen.getByTestId('btn-switch-admin').click();
      });

      // Role must NOT have changed to admin
      expect(screen.getByTestId('active-role')).not.toHaveTextContent('admin');
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');
      expect(screen.getByTestId('has-role-admin')).toHaveTextContent('no');

      // Attempt privilege escalation to TPT
      await act(async () => {
        screen.getByTestId('btn-switch-tpt').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');

      // Switching to legitimate sub-role (gvbm) should work
      await act(async () => {
        screen.getByTestId('btn-switch-gvbm').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvbm');
    });

    it('2.2 TPT account (mrhoanglongums) CANNOT escalate to admin or gvcn', async () => {
      await signInWithUsernameOrEmail('mrhoanglongums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <RoleSwitchTestComponent />
          </AuthProvider>
        </LanguageProvider>
      );

      expect(screen.getByTestId('profile-username')).toHaveTextContent('mrhoanglongums');
      expect(screen.getByTestId('active-role')).toHaveTextContent('tpt');
      expect(screen.getByTestId('has-role-admin')).toHaveTextContent('no');

      // Attempt to switch to admin
      await act(async () => {
        screen.getByTestId('btn-switch-admin').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('tpt');

      // Attempt to switch to gvcn
      await act(async () => {
        screen.getByTestId('btn-switch-gvcn').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('tpt');
    });

    it('2.3 Dual-role account (mrlinhums) can switch between authorized roles admin, gvcn, gvbm', async () => {
      await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');

      render(
        <LanguageProvider>
          <AuthProvider>
            <RoleSwitchTestComponent />
          </AuthProvider>
        </LanguageProvider>
      );

      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');

      // Switch to gvcn
      await act(async () => {
        screen.getByTestId('btn-switch-gvcn').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvcn');

      // Switch to gvbm
      await act(async () => {
        screen.getByTestId('btn-switch-gvbm').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('gvbm');

      // Switch back to admin
      await act(async () => {
        screen.getByTestId('btn-switch-admin').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');

      // Cannot switch to unauthorized role (tpt)
      await act(async () => {
        screen.getByTestId('btn-switch-tpt').click();
      });
      expect(screen.getByTestId('active-role')).toHaveTextContent('admin');
    });

    it('2.4 Protected admin routes (/users, /seed) reject unauthenticated users', async () => {
      // Unauthenticated - no user in localStorage
      localStorage.removeItem('ums_current_user');

      render(<RouteProtectionTestApp initialRoute="/users" />);
      // Should redirect to /login
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-users-page')).not.toBeInTheDocument();
    });

    it('2.5 Protected admin routes (/users, /seed) reject non-admin users (msngoclinhums) and redirect to /dashboard', async () => {
      const { profile } = await signInWithUsernameOrEmail('msngoclinhums', 'demo@2026');
      profile.mustChangePassword = false;
      localStorage.setItem('ums_current_user', JSON.stringify(profile));

      render(<RouteProtectionTestApp initialRoute="/users" />);

      // RoleGuard blocks access to /users and redirects to /dashboard
      expect(screen.queryByTestId('admin-users-page')).not.toBeInTheDocument();
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('2.6 Protected admin routes (/users, /seed) reject TPT user (mrhoanglongums) and redirect to /dashboard', async () => {
      const { profile } = await signInWithUsernameOrEmail('mrhoanglongums', 'demo@2026');
      profile.mustChangePassword = false;
      localStorage.setItem('ums_current_user', JSON.stringify(profile));

      render(<RouteProtectionTestApp initialRoute="/seed" />);

      expect(screen.queryByTestId('admin-seed-page')).not.toBeInTheDocument();
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('2.7 Protected admin routes (/users, /seed) allow admin user (mrhoanggiangums)', async () => {
      const { profile } = await signInWithUsernameOrEmail('mrhoanggiangums', 'demo@2026');
      profile.mustChangePassword = false;
      localStorage.setItem('ums_current_user', JSON.stringify(profile));

      render(<RouteProtectionTestApp initialRoute="/users" />);

      expect(screen.getByTestId('admin-users-page')).toBeInTheDocument();
    });

    it('2.8 RoleGuard Behavioral Analysis: Inspect activeRole vs userRoles in RoleGuard', async () => {
      // Adversarial check: What happens if mrlinhums switches activeRole to 'gvcn' and visits /users?
      const { profile } = await signInWithUsernameOrEmail('mrlinhums', 'demo@2026');
      profile.mustChangePassword = false;
      localStorage.setItem('ums_current_user', JSON.stringify(profile));

      // In RoleGuard.tsx:
      // const hasAccess = (activeRole && allowedRoles.includes(activeRole)) || userRoles.some(r => allowedRoles.includes(r));
      // Because mrlinhums has 'admin' in userRoles, hasAccess is true even when activeRole is 'gvcn'.
      render(<RouteProtectionTestApp initialRoute="/users" />);
      expect(screen.getByTestId('admin-users-page')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Seed Data Completeness & Integrity (Zero Dropped Records)
  // =========================================================================
  describe('3. Seed Data Completeness & Zero Dropped Records', () => {
    const rawData = rawClassData as Record<string, { gvcn: string; student_count: number; students: any[] }>;
    const { classes, students, users, scoringConfig } = generateSeedDataset();

    it('3.1 Exactly 26 classes are generated matching all raw data classes', () => {
      const rawClassKeys = Object.keys(rawData);
      expect(rawClassKeys.length).toBe(26);
      expect(classes.length).toBe(26);

      // Verify every raw class exists in generated classes
      for (const classKey of rawClassKeys) {
        const found = classes.find((c) => c.id === classKey);
        expect(found, `Class ${classKey} must be in generated classes`).toBeDefined();
        expect(found!.studentCount).toBe(rawData[classKey].students.length);
        expect(found!.academicYear).toBe('2026-2027');
        expect(found!.grade).toBe(parseInt(classKey[0], 10));
      }
    });

    it('3.2 All 26 classes belong to valid grades 6, 7, 8, 9', () => {
      const gradeCounts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
      for (const c of classes) {
        expect([6, 7, 8, 9]).toContain(c.grade);
        gradeCounts[c.grade]++;
      }
      // 6A1-6A8 (8), 7A1-7A6 (6), 8A1-8A6 (6), 9A1-9A6 (6)
      expect(gradeCounts[6]).toBe(8);
      expect(gradeCounts[7]).toBe(6);
      expect(gradeCounts[8]).toBe(6);
      expect(gradeCounts[9]).toBe(6);
    });

    it('3.3 Exactly 674 students are parsed with zero dropped records', () => {
      let rawStudentCount = 0;
      for (const cls of Object.values(rawData)) {
        rawStudentCount += cls.students.length;
      }
      expect(rawStudentCount).toBe(674);
      expect(students.length).toBe(674);

      // Verify sum of class.studentCount equals 674
      const sumClassStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
      expect(sumClassStudents).toBe(674);
    });

    it('3.4 All student records have valid, non-empty attributes, DOB (ISO or DD.MM.YYYY), and valid genders', () => {
      const mhsSet = new Set<string>();

      for (const s of students) {
        expect(s.id).toBeTruthy();
        expect(s.mhs).toBeTruthy();
        expect(s.stt).toBeGreaterThan(0);
        expect(s.name.trim().length).toBeGreaterThan(0);
        expect(s.classId).toBeTruthy();
        expect([6, 7, 8, 9]).toContain(s.grade);
        // Valid DOB formats in class_data.json: ISO (YYYY-MM-DD) or Vietnamese dotted (DD.MM.YYYY)
        const isValidDob = /^\d{4}-\d{2}-\d{2}$/.test(s.dob) || /^\d{2}\.\d{2}\.\d{4}$/.test(s.dob);
        expect(isValidDob, `Invalid DOB: ${s.dob} for student ${s.mhs}`).toBe(true);
        expect(['Nam', 'Nữ']).toContain(s.gender);
        expect(s.status).toBe('active');

        // Check for uniqueness of student ID (mhs)
        expect(mhsSet.has(s.mhs), `Duplicate student ID found: ${s.mhs}`).toBe(false);
        mhsSet.add(s.mhs);
      }

      expect(mhsSet.size).toBe(674);
    });

    it('3.5 Exact 1:1 match between raw class_data.json and generated student records', () => {
      const studentMap = new Map(students.map((s) => [s.mhs, s]));

      for (const [classId, classObj] of Object.entries(rawData)) {
        for (const rawS of classObj.students) {
          const generatedS = studentMap.get(rawS.mhs);
          expect(generatedS, `Student ${rawS.mhs} missing in generated data`).toBeDefined();
          expect(generatedS!.name).toBe(rawS.name);
          expect(generatedS!.stt).toBe(rawS.stt);
          expect(generatedS!.dob).toBe(rawS.dob);
          expect(generatedS!.gender).toBe(rawS.gender);
          expect(generatedS!.classId).toBe(classId);
        }
      }
    });

    it('3.6 Cross-check with all_students.csv confirms consistency across all 674 records', () => {
      const csvPath = path.resolve(process.cwd(), 'data/all_students.csv');
      expect(fs.existsSync(csvPath)).toBe(true);

      const csvContent = fs.readFileSync(csvPath, 'utf-8').trim();
      const csvLines = csvContent.split('\n').filter((l) => l.trim().length > 0);
      const csvDataRows = csvLines.slice(1); // Exclude header

      expect(csvDataRows.length).toBe(674);

      // Verify each CSV row matches generated students
      const studentMap = new Map(students.map((s) => [s.mhs, s]));
      for (const row of csvDataRows) {
        // format: class,stt,mhs,name,dob,gender
        const parts = row.split(',').map((p) => p.trim());
        const [cls, sttStr, mhs, name, dob, gender] = parts;
        const generated = studentMap.get(mhs);
        expect(generated, `Student from CSV ${mhs} not found in generated set`).toBeDefined();
        expect(generated!.classId).toBe(cls);
        expect(generated!.stt).toBe(parseInt(sttStr, 10));
        expect(generated!.name).toBe(name);
        expect(generated!.dob).toBe(dob);
        expect(generated!.gender).toBe(gender);
      }
    });

    it('3.7 All 26 classes have a mapped GVCN user account', () => {
      expect(Object.keys(GVCN_USER_MAPPING).length).toBe(26);

      for (const c of classes) {
        const mapping = GVCN_USER_MAPPING[c.id];
        expect(mapping, `Class ${c.id} must be in GVCN_USER_MAPPING`).toBeDefined();
        expect(c.gvcnId).toBe(mapping.username);
        expect(c.gvcnName).toBe(mapping.name);

        // Verify that this user account was actually generated in users
        const user = users.find((u) => u.username === mapping.username);
        expect(user, `User ${mapping.username} for class ${c.id} must be generated`).toBeDefined();
        expect(user!.assignedClassId).toBe(c.id);
      }
    });

    it('3.8 Total user accounts generated is exactly 29 (26 GVCN + 2 Admin + 1 TPT)', () => {
      expect(users.length).toBe(29);

      const uniqueUsernames = new Set(users.map((u) => u.username));
      expect(uniqueUsernames.size).toBe(29);

      const uniqueEmails = new Set(users.map((u) => u.email));
      expect(uniqueEmails.size).toBe(29);
    });

    it('3.9 Scoring configuration document is complete and valid', () => {
      expect(scoringConfig.criteria.length).toBe(4);
      expect(scoringConfig.maxTotal).toBe(10.0);

      const sumMaxPoints = scoringConfig.criteria.reduce((s, c) => s + c.maxPoints, 0);
      expect(sumMaxPoints).toBe(10.0);

      const criteriaIds = scoringConfig.criteria.map((c) => c.id);
      expect(criteriaIds).toContain('learning');
      expect(criteriaIds).toContain('discipline');
      expect(criteriaIds).toContain('hygiene');
      expect(criteriaIds).toContain('customCriterion');
    });
  });

  // =========================================================================
  // 4. Security & Default Credentials
  // =========================================================================
  describe('4. Security & Default Credential Policies', () => {
    const { users } = generateSeedDataset();

    it('4.1 All seeded accounts have default passwordHash and mustChangePassword = true', () => {
      for (const u of users) {
        expect(u.passwordHash).toBe('56d8c422bc5ae8560b7784552525471ae00c1547ef6527ab7cca4f3c5cb2e6cd');
        expect((u as any).password).toBeUndefined();
        expect(u.mustChangePassword).toBe(true);
      }
    });

    it('4.2 Authenticating with correct credentials sets session and flags mustChangePassword', async () => {
      const { user, profile } = await signInWithUsernameOrEmail('msngoclinhums', 'demo@2026');
      expect(user).toBeDefined();
      expect(profile.mustChangePassword).toBe(true);
      expect(profile.roles).toEqual(['gvcn', 'gvbm']);
    });

    it('4.3 Wrong password authentication fails with auth/wrong-password', async () => {
      await expect(
        signInWithUsernameOrEmail('mrlinhums', 'incorrectPass')
      ).rejects.toThrow();
    });

    it('4.4 Non-existent username fails with auth/user-not-found', async () => {
      await expect(
        signInWithUsernameOrEmail('unknown_teacher_ums', 'demo@2026')
      ).rejects.toThrow();
    });

    it('4.5 Username resolution handles edge cases and casing', () => {
      expect(resolveUsernameToEmail('MRLINHUMS')).toBe('mrlinhums@ums.edu.vn');
      expect(resolveUsernameToEmail('  mrlinhums  ')).toBe('mrlinhums@ums.edu.vn');
      expect(resolveUsernameToEmail('mrlinhums@ums.edu.vn')).toBe('mrlinhums@ums.edu.vn');
      expect(resolveUsernameToEmail('')).toBe('');
      expect(extractUsername('  MRLINHUMS@ums.edu.vn  ')).toBe('mrlinhums');
    });
  });
});
