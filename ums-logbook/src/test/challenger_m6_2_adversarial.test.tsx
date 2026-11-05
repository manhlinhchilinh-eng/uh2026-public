/**
 * UMS Digital Class Logbook - Milestone 6 Challenger Adversarial Test Suite
 * Challenger: M6_2 (Milestone 6 Adversarial Audit Trail, Interceptors & Idle Timeout)
 * Target: Audit Logging Engine, State Mutation Interceptors, Credential Sanitization,
 * Storage FIFO Eviction, 30-Minute Idle Session Timeout & Admin Audit Viewer UI.
 * Path: src/test/challenger_m6_2_adversarial.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor, renderHook } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Services
import {
  logAuditEvent,
  getAuditLogs,
  sanitizeState,
  exportAuditLogsToCsv,
  exportAuditLogsToJson,
  clearAuditLogsMock,
  AUDIT_STORAGE_KEY,
} from '../services/auditService';
import { updateAttendanceBaseline, savePeriodEntry } from '../services/logbookService';
import {
  createBehaviorNote,
  deleteBehaviorNote,
  updateBehaviorNote,
  acknowledgeBehaviorNote,
} from '../services/behaviorService';
import { saveClassSchedule } from '../services/scheduleService';
import { signInWithUsernameOrEmail, changePassword } from '../services/authService';

// Hooks & Components
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { AuditLogViewer } from '../components/admin/AuditLogViewer';
import { IdleTimeoutModal } from '../components/common/IdleTimeoutModal';
import { UserProfile } from '../types/auth';
import { AuditLogEntry } from '../types/audit';

// Mock useAuth
const mockLogout = vi.fn().mockResolvedValue(undefined);
let mockCurrentUser: any = { uid: 'u_challenger', email: 'mrlinhums@ums.edu.vn', displayName: 'Mr Linh' };

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    logout: mockLogout,
  }),
}));

const routerWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('CHALLENGER M6_2: Milestone 6 Adversarial Audit Trail & Idle Timeout Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuditLogsMock();
    vi.clearAllMocks();
    mockCurrentUser = { uid: 'u_challenger', email: 'mrlinhums@ums.edu.vn', displayName: 'Mr Linh' };
  });

  // =========================================================================
  // DOMAIN 1: AUDIT LOGGING INTERCEPTORS STRESS-TESTING ACROSS ALL 4 SERVICES
  // =========================================================================
  describe('Domain 1: Service State Mutation Interceptors', () => {
    it('1.1: logbookService.updateAttendanceBaseline intercepts and generates UPDATE audit entry', async () => {
      const dailyId = '9A3_2026-10-05';
      const baseline = {
        reportedBy: 'mrlinhums',
        reportedAt: Date.now(),
        absences: [
          { studentId: 'hs_1', studentName: 'Nguyễn Văn A', type: 'P' as const, note: 'Sốt' },
        ],
        earlyDepartures: [
          { studentId: 'hs_2', studentName: 'Trần Thị B', departedAt: '10:30', reason: 'Gia đình' },
        ],
      };

      await updateAttendanceBaseline(dailyId, 'morning', baseline);

      const logs = await getAuditLogs({ targetCollection: 'daily_logbooks' });
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const log = logs.find((l) => l.targetId === dailyId);
      expect(log).toBeDefined();
      expect(log?.action).toBe('UPDATE');
      expect(log?.targetCollection).toBe('daily_logbooks');
      expect(log?.details).toContain('Cập nhật điểm danh đầu giờ buổi sáng');
      expect(log?.details).toContain('1 vắng, 1 về sớm');
      expect((log?.afterState as any)?.session).toBe('morning');
      expect((log?.afterState as any)?.baseline.absences.length).toBe(1);
    });

    it('1.2: logbookService.savePeriodEntry generates CREATE on first save, and UPDATE on modification', async () => {
      const dailyId = '8A3_2026-10-06';
      const periodIndex = 1;

      // 1. Initial save of an empty period slot -> should be CREATE
      const firstEntry = await savePeriodEntry(dailyId, periodIndex, {
        subject: 'Toán',
        lessonTopic: 'Đại số chương 1',
        teacherId: 'mrlinhums',
        teacherName: 'Nguyễn Mạnh Linh',
        scores: { learning: 4.0, discipline: 3.0, hygiene: 2.0, customCriterion: 1.0, total: 10.0 },
      });

      expect(firstEntry.subject).toBe('Toán');

      const logsAfterCreate = await getAuditLogs({ targetCollection: 'periods' });
      const createLog = logsAfterCreate.find((l) => l.targetId === `${dailyId}_p${periodIndex}`);
      expect(createLog).toBeDefined();
      expect(createLog?.action).toBe('CREATE');
      expect(createLog?.details).toContain('Lưu sổ đầu bài tiết 1 môn Toán');

      // 2. Subsequent modification to the existing period -> should be UPDATE
      await savePeriodEntry(dailyId, periodIndex, {
        subject: 'Toán',
        lessonTopic: 'Đại số chương 1 (sửa)',
        teacherComment: 'Lớp trật tự hơn',
      });

      const logsAfterUpdate = await getAuditLogs({ targetCollection: 'periods' });
      const updateLogs = logsAfterUpdate.filter((l) => l.targetId === `${dailyId}_p${periodIndex}`);
      expect(updateLogs.length).toBe(2);

      const latestLog = updateLogs[0]; // sorted descending
      expect(latestLog.action).toBe('UPDATE');
      expect(latestLog.details).toContain('Lưu sổ đầu bài tiết 1 môn Toán');
    });

    it('1.3: behaviorService.createBehaviorNote and deleteBehaviorNote generate CREATE and DELETE audit logs', async () => {
      const mockTeacher: UserProfile = {
        uid: 'gv_123',
        username: 'msthaoums',
        email: 'msthaoums@ums.edu.vn',
        displayName: 'Phạm Hải Yến',
        roles: ['gvcn'],
        assignedClassId: '7A1',
        mustChangePassword: false,
        createdAt: Date.now(),
      };

      // 1. Create Note
      const newNote = await createBehaviorNote(
        {
          studentId: 'hs_7a1_01',
          studentName: 'Lê Hoàng Nam',
          classId: '7A1',
          type: 'positive',
          category: 'Khen ngợi',
          content: 'Phát biểu xây dựng bài tích cực trong giờ Văn',
        },
        mockTeacher
      );

      const logsAfterCreate = await getAuditLogs({ targetCollection: 'behavior_notes' });
      const createLog = logsAfterCreate.find((l) => l.targetId === newNote.id);
      expect(createLog).toBeDefined();
      expect(createLog?.action).toBe('CREATE');
      expect(createLog?.actorName).toBe('Phạm Hải Yến');
      expect(createLog?.details).toContain('Ghi nhận hành vi tích cực');

      // 2. Delete Note
      await deleteBehaviorNote(newNote.id, mockTeacher);

      const logsAfterDelete = await getAuditLogs({ targetCollection: 'behavior_notes' });
      const deleteLog = logsAfterDelete.find((l) => l.targetId === newNote.id && l.action === 'DELETE');
      expect(deleteLog).toBeDefined();
      expect(deleteLog?.action).toBe('DELETE');
      expect(deleteLog?.actorName).toBe('Phạm Hải Yến');
      expect(deleteLog?.beforeState).toBeDefined();
      expect((deleteLog?.beforeState as any)?.studentName).toBe('Lê Hoàng Nam');
    });

    it('1.4: scheduleService.saveClassSchedule generates UPDATE audit log', async () => {
      const schedule = {
        classId: '6A5',
        academicYear: '2026-2027',
        semester: 1 as const,
        slots: [
          { dayOfWeek: 2, periodIndex: 1, subject: 'Toán', teacherUsername: 'mshuyenums', teacherName: 'Hồ Gia Trâm', room: 'P.201' },
          { dayOfWeek: 2, periodIndex: 2, subject: 'Văn', teacherUsername: 'msgiangums', teacherName: 'Bùi Hoài Khánh Châm', room: 'P.201' },
        ],
        updatedAt: Date.now(),
        updatedBy: 'admin',
      };

      await saveClassSchedule(schedule);

      const logs = await getAuditLogs({ targetCollection: 'schedules' });
      const scheduleLog = logs.find((l) => l.targetId === '6A5');
      expect(scheduleLog).toBeDefined();
      expect(scheduleLog?.action).toBe('UPDATE');
      expect(scheduleLog?.details).toContain('Cập nhật thời khóa biểu lớp 6A5 (2 tiết học)');
    });

    it('1.5: authService.signInWithUsernameOrEmail and changePassword generate LOGIN and PASSWORD_CHANGE audit logs', async () => {
      // 1. Mock user in localStorage with authentic DEFAULT_PASSWORD_HASH ('demo@2026')
      const { DEFAULT_PASSWORD_HASH } = await import('../utils/crypto');
      const testUser = {
        uid: 'u_audit_auth',
        username: 'mrhoanggiangums',
        email: 'mrhoanggiangums@ums.edu.vn',
        displayName: 'Hoàng Giang BGH',
        roles: ['admin' as const],
        mustChangePassword: true,
        createdAt: Date.now(),
        passwordHash: DEFAULT_PASSWORD_HASH,
      };
      localStorage.setItem('ums_users', JSON.stringify([testUser]));

      // 2. Sign in -> generates LOGIN audit log
      const loginResult = await signInWithUsernameOrEmail('mrhoanggiangums', 'demo@2026');
      expect(loginResult.profile.username).toBe('mrhoanggiangums');

      const logsAfterLogin = await getAuditLogs({ targetCollection: 'auth', action: 'LOGIN' });
      expect(logsAfterLogin.length).toBeGreaterThanOrEqual(1);
      const loginLog = logsAfterLogin.find((l) => l.targetId === 'u_audit_auth');
      expect(loginLog).toBeDefined();
      expect(loginLog?.action).toBe('LOGIN');
      expect(loginLog?.actorName).toBe('Hoàng Giang BGH');

      // 3. Change password -> generates PASSWORD_CHANGE audit log
      await changePassword('demo@2026', 'NewPass@2026_Secure');

      const logsAfterPwChange = await getAuditLogs({ targetCollection: 'auth', action: 'PASSWORD_CHANGE' });
      expect(logsAfterPwChange.length).toBeGreaterThanOrEqual(1);
      const pwLog = logsAfterPwChange.find((l) => l.targetId === 'u_audit_auth');
      expect(pwLog).toBeDefined();
      expect(pwLog?.action).toBe('PASSWORD_CHANGE');
      expect(pwLog?.beforeState).toEqual({ mustChangePassword: true });
      expect(pwLog?.afterState).toEqual({ mustChangePassword: false });
    });

    it('1.6: behaviorService.updateBehaviorNote and acknowledgeBehaviorNote generate UPDATE audit logs', async () => {
      const gvcnUser: UserProfile = {
        uid: 'gv_7a3',
        username: 'msthanhhuyenums',
        email: 'msthanhhuyenums@ums.edu.vn',
        displayName: 'Nguyễn Phương Minh Hạnh',
        roles: ['gvcn'],
        assignedClassId: '7A3',
        mustChangePassword: false,
        createdAt: Date.now(),
      };

      const note = await createBehaviorNote(
        {
          studentId: 'hs_7a3_05',
          studentName: 'Trần Gia Bảo',
          classId: '7A3',
          type: 'negative',
          category: 'Làm việc riêng',
          content: 'Nói chuyện trong giờ học',
        },
        gvcnUser
      );

      // Update Note
      await updateBehaviorNote(
        note.id,
        { content: 'Nói chuyện trong giờ học môn Sử (đã nhắc nhở)' },
        gvcnUser
      );

      const logsAfterUpdate = await getAuditLogs({ targetCollection: 'behavior_notes' });
      const updateLog = logsAfterUpdate.find((l) => l.targetId === note.id && l.action === 'UPDATE');
      expect(updateLog).toBeDefined();
      expect(updateLog?.details).toContain('Cập nhật ghi nhận hành vi');

      // Acknowledge Note
      await acknowledgeBehaviorNote(note.id, gvcnUser);

      const logsAfterAck = await getAuditLogs({ targetCollection: 'behavior_notes' });
      const ackLogs = logsAfterAck.filter((l) => l.targetId === note.id && l.action === 'UPDATE');
      expect(ackLogs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // DOMAIN 2: DEEP CREDENTIAL SANITIZATION ADVERSARIAL STRESS HARNESS
  // =========================================================================
  describe('Domain 2: Deep Credential Sanitization Security', () => {
    it('2.1: strictly redacts all variations of sensitive keys across case combinations', () => {
      const payloadWithVariations = {
        password: 'plain_password',
        PASSWORD: 'UPPER_PASSWORD',
        Password: 'Mixed_Password',
        passwordHash: 'hash_123',
        PASSWORDHASH: 'HASH_456',
        token: 'token_abc',
        TOKEN: 'TOKEN_XYZ',
        secret: 'my_secret',
        SECRET: 'UPPER_SECRET',
        credential: 'user_credential',
        CREDENTIAL: 'UPPER_CREDENTIAL',
        apiKey: 'api_key_value',
        APIKEY: 'UPPER_APIKEY',
        currentPassword: 'old_pw',
        newPassword: 'new_pw',
        confirmPassword: 'conf_pw',
        accessToken: 'access_tok',
        refreshToken: 'refresh_tok',
        safeProperty: 'this should remain untouched',
        count: 42,
      };

      const sanitized = sanitizeState(payloadWithVariations);

      expect(sanitized?.password).toBe('[REDACTED]');
      expect(sanitized?.PASSWORD).toBe('[REDACTED]');
      expect(sanitized?.Password).toBe('[REDACTED]');
      expect(sanitized?.passwordHash).toBe('[REDACTED]');
      expect(sanitized?.PASSWORDHASH).toBe('[REDACTED]');
      expect(sanitized?.token).toBe('[REDACTED]');
      expect(sanitized?.TOKEN).toBe('[REDACTED]');
      expect(sanitized?.secret).toBe('[REDACTED]');
      expect(sanitized?.SECRET).toBe('[REDACTED]');
      expect(sanitized?.credential).toBe('[REDACTED]');
      expect(sanitized?.CREDENTIAL).toBe('[REDACTED]');
      expect(sanitized?.apiKey).toBe('[REDACTED]');
      expect(sanitized?.APIKEY).toBe('[REDACTED]');
      expect(sanitized?.currentPassword).toBe('[REDACTED]');
      expect(sanitized?.newPassword).toBe('[REDACTED]');
      expect(sanitized?.confirmPassword).toBe('[REDACTED]');
      expect(sanitized?.accessToken).toBe('[REDACTED]');
      expect(sanitized?.refreshToken).toBe('[REDACTED]');
      expect(sanitized?.safeProperty).toBe('this should remain untouched');
      expect(sanitized?.count).toBe(42);
    });

    it('2.2: recurses deeply into 10 levels of nested objects and objects inside arrays', () => {
      const deeplyNested = {
        lvl1: {
          lvl2: {
            lvl3: {
              lvl4: {
                lvl5: {
                  lvl6: {
                    lvl7: {
                      lvl8: {
                        lvl9: {
                          lvl10: {
                            token: 'deep_token_val',
                            secret: 'deep_secret_val',
                            safeKey: 'deep_safe_val',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        items: [
          { id: 1, password: 'pw1' },
          { id: 2, nested: [{ apiKey: 'key2' }, { safe: 'ok' }] },
        ],
      };

      const sanitized = sanitizeState(deeplyNested) as any;

      expect(sanitized.lvl1.lvl2.lvl3.lvl4.lvl5.lvl6.lvl7.lvl8.lvl9.lvl10.token).toBe('[REDACTED]');
      expect(sanitized.lvl1.lvl2.lvl3.lvl4.lvl5.lvl6.lvl7.lvl8.lvl9.lvl10.secret).toBe('[REDACTED]');
      expect(sanitized.lvl1.lvl2.lvl3.lvl4.lvl5.lvl6.lvl7.lvl8.lvl9.lvl10.safeKey).toBe('deep_safe_val');
      expect(sanitized.items[0].password).toBe('[REDACTED]');
      expect(sanitized.items[1].nested[0].apiKey).toBe('[REDACTED]');
      expect(sanitized.items[1].nested[1].safe).toBe('ok');
    });

    it('2.3: handles circular references safely without crashing or throwing stack overflow', () => {
      const circularObj: any = {
        name: 'test',
        password: 'secret_circular',
      };
      circularObj.self = circularObj;

      const sanitized = sanitizeState(circularObj);
      expect(sanitized).toBeDefined();
      expect((sanitized as any)?._sanitizationError).toBe('Could not sanitize payload');
    });

    it('2.4: redacts non-string credential fields (objects, numbers, booleans)', () => {
      const nonStringCredentials = {
        password: { hash: 12345, salt: 'abc' },
        secret: 999999,
        token: true,
      };

      const sanitized = sanitizeState(nonStringCredentials);
      expect(sanitized?.password).toBe('[REDACTED]');
      expect(sanitized?.secret).toBe('[REDACTED]');
      expect(sanitized?.token).toBe('[REDACTED]');
    });

    it('2.5: handles null, undefined, and non-object primitives gracefully', () => {
      expect(sanitizeState(null)).toBeNull();
      expect(sanitizeState(undefined)).toBeNull();
      expect(sanitizeState('hello' as any)).toBeNull();
      expect(sanitizeState(12345 as any)).toBeNull();
      expect(sanitizeState(true as any)).toBeNull();
    });
  });

  // =========================================================================
  // DOMAIN 3: STORAGE EVICTION & RESILIENCE STRESS HARNESS
  // =========================================================================
  describe('Domain 3: Storage Eviction & Resilience Stress Harness', () => {
    it('3.1: maintains strict 500-item FIFO cap when filling 550 entries into LocalStorage', async () => {
      // Create initial batch of 550 entries
      for (let i = 1; i <= 550; i++) {
        await logAuditEvent({
          action: 'UPDATE',
          targetCollection: 'daily_logbooks',
          targetId: `logbook_stress_${i}`,
          details: `Entry #${i}`,
          actor: { actorId: `actor_${i}`, actorName: `Actor ${i}`, actorRole: 'gvbm' },
        });
      }

      const storedRaw = localStorage.getItem(AUDIT_STORAGE_KEY);
      expect(storedRaw).not.toBeNull();
      const storedList: AuditLogEntry[] = JSON.parse(storedRaw!);

      // Strict FIFO 500 cap
      expect(storedList.length).toBe(500);

      // Verify FIFO eviction: The first 50 entries (Entry #1 to #50) must have been evicted.
      // The newest entry must be Entry #550 (index 0).
      expect(storedList[0].details).toBe('Entry #550');
      // The oldest retained entry must be Entry #51 (index 499).
      expect(storedList[499].details).toBe('Entry #51');

      // Ensure Entry #1 is evicted
      const entry1 = storedList.find((l) => l.details === 'Entry #1');
      expect(entry1).toBeUndefined();
    });

    it('3.2: recovers gracefully without crashing when LocalStorage throws QuotaExceededError', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw quotaError;
      });

      // logAuditEvent MUST NOT throw an unhandled exception to callers
      let thrownError: any = null;
      let resultEntry: any = null;
      try {
        resultEntry = await logAuditEvent({
          action: 'CREATE',
          targetCollection: 'periods',
          targetId: 'quota_test_period',
        });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeNull();
      expect(resultEntry).toBeDefined();
      expect(resultEntry.targetId).toBe('quota_test_period');

      setItemSpy.mockRestore();
    });

    it('3.3: verifies fault tolerance and documents lack of self-healing when LocalStorage is corrupted', async () => {
      localStorage.setItem(AUDIT_STORAGE_KEY, '<<<INVALID_JSON_CORRUPTED>>>');

      // getAuditLogs should not throw and return empty array
      const logs = await getAuditLogs();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(0);

      // logAuditEvent must not throw an unhandled exception to callers (fault tolerant)
      let thrown: any = null;
      let entry: any = null;
      try {
        entry = await logAuditEvent({
          action: 'LOGIN',
          targetCollection: 'auth',
          targetId: 'u_recovery',
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeNull();
      expect(entry).toBeDefined();

      // EMPIRICAL FINDING: Because JSON.parse is in the same try-block as setItem,
      // the corrupted storage is not overwritten, so getAuditLogs still returns 0 entries.
      const logsAfter = await getAuditLogs();
      expect(logsAfter.length).toBe(0);
    });
  });

  // =========================================================================
  // DOMAIN 4: 30-MINUTE IDLE SESSION TIMEOUT ADVERSARIAL HARNESS
  // =========================================================================
  describe('Domain 4: 30-Minute Idle Session Timeout Engine', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('4.1: detects user activity across all 5 events: mousemove, keydown, click, touchstart, scroll', () => {
      renderHook(
        () =>
          useIdleTimeout({
            timeoutMs: 30 * 60 * 1000,
            warningMs: 25 * 60 * 1000,
          }),
        { wrapper: routerWrapper }
      );

      const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];

      events.forEach((evtName) => {
        // Advance past 15s throttle
        act(() => {
          vi.advanceTimersByTime(16000);
        });

        // Dispatch window event
        act(() => {
          window.dispatchEvent(new Event(evtName));
        });

        const stored = localStorage.getItem('ums_last_activity');
        expect(stored).not.toBeNull();
      });
    });

    it('4.2: enforces 15-second throttle on user activity updates', () => {
      renderHook(
        () =>
          useIdleTimeout({
            timeoutMs: 30 * 60 * 1000,
            warningMs: 25 * 60 * 1000,
          }),
        { wrapper: routerWrapper }
      );

      // Initial activity record
      const initialTimestamp = localStorage.getItem('ums_last_activity');
      expect(initialTimestamp).not.toBeNull();

      // Activity at 5s (< 15s throttle) -> should NOT update localStorage
      act(() => {
        vi.advanceTimersByTime(5000);
        window.dispatchEvent(new Event('mousemove'));
      });
      expect(localStorage.getItem('ums_last_activity')).toBe(initialTimestamp);

      // Activity at 10s (< 15s from start) -> should NOT update
      act(() => {
        vi.advanceTimersByTime(5000);
        window.dispatchEvent(new Event('keydown'));
      });
      expect(localStorage.getItem('ums_last_activity')).toBe(initialTimestamp);

      // Activity at 16s (> 15s from start) -> SHOULD update localStorage
      act(() => {
        vi.advanceTimersByTime(6000);
        window.dispatchEvent(new Event('click'));
      });
      const updatedTimestamp = localStorage.getItem('ums_last_activity');
      expect(Number(updatedTimestamp)).toBeGreaterThan(Number(initialTimestamp));
    });

    it('4.3: activates advance warning at 25 minutes with a 300s (5:00) countdown', () => {
      const onWarning = vi.fn();
      const { result } = renderHook(
        () =>
          useIdleTimeout({
            timeoutMs: 30 * 60 * 1000,
            warningMs: 25 * 60 * 1000,
            onWarning,
          }),
        { wrapper: routerWrapper }
      );

      expect(result.current.isWarningOpen).toBe(false);

      // Fast-forward to 24 min 59 sec
      act(() => {
        vi.advanceTimersByTime(24 * 60 * 1000 + 59 * 1000);
      });
      expect(result.current.isWarningOpen).toBe(false);

      // Fast-forward 1 more second to reach 25 minutes
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isWarningOpen).toBe(true);
      expect(onWarning).toHaveBeenCalledTimes(1);
      expect(result.current.remainingSeconds).toBe(300);
      expect(result.current.formattedRemaining).toBe('5:00');
    });

    it('4.4: decrements countdown timer second-by-second while warning modal is open', () => {
      const { result } = renderHook(
        () =>
          useIdleTimeout({
            timeoutMs: 30 * 60 * 1000,
            warningMs: 25 * 60 * 1000,
          }),
        { wrapper: routerWrapper }
      );

      // Reach warning at 25 minutes
      act(() => {
        vi.advanceTimersByTime(25 * 60 * 1000);
      });
      expect(result.current.remainingSeconds).toBe(300);

      // Advance 10 seconds
      act(() => {
        vi.advanceTimersByTime(10 * 1000);
      });
      expect(result.current.remainingSeconds).toBe(290);
      expect(result.current.formattedRemaining).toBe('4:50');
    });

    it('4.5: extendSession resets countdown timer back to 300s and dismisses warning modal', () => {
      const { result } = renderHook(
        () =>
          useIdleTimeout({
            timeoutMs: 30 * 60 * 1000,
            warningMs: 25 * 60 * 1000,
          }),
        { wrapper: routerWrapper }
      );

      // Reach warning at 25 min + 1 min countdown elapsed (29 min total idle)
      act(() => {
        vi.advanceTimersByTime(26 * 60 * 1000);
      });
      expect(result.current.isWarningOpen).toBe(true);
      expect(result.current.remainingSeconds).toBe(240); // 4:00

      // User clicks "Tiếp tục làm việc"
      act(() => {
        result.current.extendSession();
      });

      expect(result.current.isWarningOpen).toBe(false);
      expect(result.current.remainingSeconds).toBe(300);
      expect(result.current.formattedRemaining).toBe('5:00');
    });

    it('4.6: multi-tab synchronization resets countdown and dismisses warning on storage event', () => {
      const { result } = renderHook(
        () =>
          useIdleTimeout({
            timeoutMs: 30 * 60 * 1000,
            warningMs: 25 * 60 * 1000,
          }),
        { wrapper: routerWrapper }
      );

      // Tab 1 reaches warning state
      act(() => {
        vi.advanceTimersByTime(26 * 60 * 1000);
      });
      expect(result.current.isWarningOpen).toBe(true);

      // Tab 2 has user activity: dispatches StorageEvent for 'ums_last_activity'
      const newActivityTime = Date.now();
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'ums_last_activity',
            newValue: newActivityTime.toString(),
          })
        );
      });

      // Tab 1 should automatically extend session and close warning modal!
      expect(result.current.isWarningOpen).toBe(false);
      expect(result.current.remainingSeconds).toBe(300);
    });

    it('4.7: hard timeout at 30 minutes triggers logout callback and redirects', () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(
        () =>
          useIdleTimeout({
            timeoutMs: 30 * 60 * 1000,
            warningMs: 25 * 60 * 1000,
            onTimeout,
          }),
        { wrapper: routerWrapper }
      );

      // Fast forward past 30 minutes
      act(() => {
        vi.advanceTimersByTime(30 * 60 * 1000 + 500);
      });

      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(result.current.isWarningOpen).toBe(false);
      expect(localStorage.getItem('ums_logout_reason')).toBe('idle_timeout');
    });

    it('4.8: IdleTimeoutModal triggers immediate logout when clicking "Đăng xuất ngay"', () => {
      const onLogout = vi.fn();
      render(
        <IdleTimeoutModal
          isOpen={true}
          remainingSeconds={180}
          onExtend={vi.fn()}
          onLogout={onLogout}
        />
      );

      const logoutBtn = screen.getByTestId('idle-logout-btn');
      fireEvent.click(logoutBtn);

      expect(onLogout).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // DOMAIN 5: ADMIN AUDIT TRAIL VIEWER UI & DIFF INSPECTOR ADVERSARIAL TESTS
  // =========================================================================
  describe('Domain 5: Admin Audit Trail Viewer UI & Diff Inspector', () => {
    it('5.1: renders all action badges with correct color-coded styling', async () => {
      // Seed audit entries for each action type
      await logAuditEvent({ action: 'CREATE', targetCollection: 'daily_logbooks', targetId: '1' });
      await logAuditEvent({ action: 'UPDATE', targetCollection: 'periods', targetId: '2' });
      await logAuditEvent({ action: 'DELETE', targetCollection: 'behavior_notes', targetId: '3' });
      await logAuditEvent({ action: 'LOGIN', targetCollection: 'auth', targetId: '4' });
      await logAuditEvent({ action: 'PASSWORD_CHANGE', targetCollection: 'auth', targetId: '5' });

      render(<BrowserRouter><AuditLogViewer /></BrowserRouter>);

      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
        expect(screen.getByText('UPDATE')).toBeInTheDocument();
        expect(screen.getByText('DELETE')).toBeInTheDocument();
        expect(screen.getByText('LOGIN')).toBeInTheDocument();
        expect(screen.getByText('PASSWORD_CHANGE')).toBeInTheDocument();
      });
    });

    it('5.2: filters table rows by action dropdown', async () => {
      await logAuditEvent({
        action: 'DELETE',
        targetCollection: 'behavior_notes',
        targetId: 'del_note_99',
        details: 'Xóa ghi nhận vi phạm',
      });
      await logAuditEvent({
        action: 'CREATE',
        targetCollection: 'periods',
        targetId: 'p_100',
        details: 'Tạo tiết học mới',
      });

      render(<BrowserRouter><AuditLogViewer /></BrowserRouter>);

      await waitFor(() => {
        expect(screen.getByText('Xóa ghi nhận vi phạm')).toBeInTheDocument();
        expect(screen.getByText('Tạo tiết học mới')).toBeInTheDocument();
      });

      // Filter by DELETE
      const actionSelect = screen.getByTestId('audit-action-filter');
      fireEvent.change(actionSelect, { target: { value: 'DELETE' } });

      await waitFor(() => {
        expect(screen.getByText('Xóa ghi nhận vi phạm')).toBeInTheDocument();
        expect(screen.queryByText('Tạo tiết học mới')).not.toBeInTheDocument();
      });
    });

    it('5.3: filters table rows by target collection dropdown', async () => {
      await logAuditEvent({
        action: 'UPDATE',
        targetCollection: 'schedules',
        targetId: 'sched_7A2',
        details: 'Cập nhật TKB 7A2',
      });
      await logAuditEvent({
        action: 'UPDATE',
        targetCollection: 'daily_logbooks',
        targetId: 'log_7A2',
        details: 'Cập nhật điểm danh 7A2',
      });

      render(<BrowserRouter><AuditLogViewer /></BrowserRouter>);

      await waitFor(() => {
        expect(screen.getByText('Cập nhật TKB 7A2')).toBeInTheDocument();
        expect(screen.getByText('Cập nhật điểm danh 7A2')).toBeInTheDocument();
      });

      // Filter by schedules
      const colSelect = screen.getByTestId('audit-collection-filter');
      fireEvent.change(colSelect, { target: { value: 'schedules' } });

      await waitFor(() => {
        expect(screen.getByText('Cập nhật TKB 7A2')).toBeInTheDocument();
        expect(screen.queryByText('Cập nhật điểm danh 7A2')).not.toBeInTheDocument();
      });
    });

    it('5.4: filters table rows by search query across multiple columns', async () => {
      await logAuditEvent({
        action: 'CREATE',
        targetCollection: 'behavior_notes',
        targetId: 'note_adversarial_search',
        details: 'Ghi nhận đặc biệt bí mật',
        actor: { actorId: 'special_actor_id', actorName: 'Nguyễn Văn Đặc Biệt', actorRole: 'tpt' },
      });

      render(<BrowserRouter><AuditLogViewer /></BrowserRouter>);

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Văn Đặc Biệt')).toBeInTheDocument();
      });

      // Search by specific term
      const searchInput = screen.getByTestId('audit-search-input');
      fireEvent.change(searchInput, { target: { value: 'Đặc Biệt' } });

      const submitBtn = screen.getByTestId('audit-submit-search');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Ghi nhận đặc biệt bí mật')).toBeInTheDocument();
      });

      // Search for non-existing term
      fireEvent.change(searchInput, { target: { value: 'không tồn tại 12345' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Không tìm thấy bản ghi kiểm toán nào/i)
        ).toBeInTheDocument();
      });
    });

    it('5.5: exports CSV with UTF-8 BOM, escaped quotes, and proper Vietnamese headers', () => {
      const sampleLogs: AuditLogEntry[] = [
        {
          id: 'audit_csv_test',
          actorId: 'mrlinhums',
          actorName: 'Nguyễn Mạnh Linh',
          actorRole: 'admin',
          action: 'UPDATE',
          targetCollection: 'daily_logbooks',
          targetId: '9A3_2026-10-01',
          timestamp: 1727600000000,
          details: 'Ghi chú "có dấu ngoặc kép" và dấu phẩy, kiểm tra CSV',
        },
      ];

      const csv = exportAuditLogsToCsv(sampleLogs);

      // Must start with UTF-8 BOM for Excel Vietnamese character rendering
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // Header verification
      expect(csv).toContain('Mã sự kiện,Thời gian,Người thực hiện,Mã định danh,Vai trò,Hành động,Đối tượng dữ liệu,Mã đối tượng,Chi tiết nội dung');

      // Value & quote escaping verification (RFC 4180 double-double quotes)
      expect(csv).toContain('"audit_csv_test"');
      expect(csv).toContain('"Nguyễn Mạnh Linh"');
      expect(csv).toContain('""có dấu ngoặc kép"" và dấu phẩy');
    });

    it('5.6: exports valid, parseable formatted JSON string', () => {
      const sampleLogs: AuditLogEntry[] = [
        {
          id: 'audit_json_test',
          actorId: 'mrlinhums',
          actorName: 'Nguyễn Mạnh Linh',
          actorRole: 'admin',
          action: 'LOGIN',
          targetCollection: 'auth',
          targetId: 'u_123',
          timestamp: 1727600000000,
        },
      ];

      const jsonStr = exportAuditLogsToJson(sampleLogs);
      const parsed = JSON.parse(jsonStr);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe('audit_json_test');
      expect(parsed[0].actorRole).toBe('admin');
    });

    it('5.7: opens AuditDiffModal on "Xem diff" and displays structural changes with badges', async () => {
      await logAuditEvent({
        action: 'UPDATE',
        targetCollection: 'periods',
        targetId: 'p_diff_inspect',
        details: 'Cập nhật điểm và chữ ký',
        beforeState: {
          scores: { total: 8.0 },
          isSigned: false,
          note: 'Chưa xong',
        },
        afterState: {
          scores: { total: 9.5 },
          isSigned: true,
          newComment: 'Đã hoàn thành',
        },
      });

      render(<BrowserRouter><AuditLogViewer /></BrowserRouter>);

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText('Cập nhật điểm và chữ ký')).toBeInTheDocument();
      });

      // Click "Xem diff" button
      const diffButtons = screen.getAllByText('Xem diff');
      fireEvent.click(diffButtons[0]);

      // Verify Diff Modal content
      await waitFor(() => {
        expect(screen.getByText(/Chi tiết sự kiện kiểm toán/i)).toBeInTheDocument();
        expect(screen.getAllByText('periods').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('scores')).toBeInTheDocument();
        expect(screen.getByText('isSigned')).toBeInTheDocument();
        expect(screen.getAllByText('sửa').length).toBeGreaterThan(0);
      });

      // Close Diff Modal
      const closeBtn = screen.getByText('Đóng');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText(/So sánh thay đổi dữ liệu/i)).not.toBeInTheDocument();
      });
    });

    it('5.8: filters audit logs by start and end date pickers in UI', async () => {
      // 1. Seed log in Oct 2026
      const tsOct15 = new Date('2026-10-15T10:00:00Z').getTime();
      const tsOct01 = new Date('2026-10-01T10:00:00Z').getTime();
      const tsOct30 = new Date('2026-10-30T10:00:00Z').getTime();

      const dummyLogs: AuditLogEntry[] = [
        {
          id: 'log_oct01',
          actorId: 'u1',
          actorName: 'Teacher 1',
          actorRole: 'gvbm',
          action: 'CREATE',
          targetCollection: 'periods',
          targetId: 'p_oct01',
          timestamp: tsOct01,
          details: 'Event on Oct 01',
        },
        {
          id: 'log_oct15',
          actorId: 'u2',
          actorName: 'Teacher 2',
          actorRole: 'gvcn',
          action: 'UPDATE',
          targetCollection: 'daily_logbooks',
          targetId: 'p_oct15',
          timestamp: tsOct15,
          details: 'Event on Oct 15',
        },
        {
          id: 'log_oct30',
          actorId: 'u3',
          actorName: 'Teacher 3',
          actorRole: 'admin',
          action: 'LOGIN',
          targetCollection: 'auth',
          targetId: 'p_oct30',
          timestamp: tsOct30,
          details: 'Event on Oct 30',
        },
      ];

      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(dummyLogs));

      render(<BrowserRouter><AuditLogViewer /></BrowserRouter>);

      await waitFor(() => {
        expect(screen.getByText('Event on Oct 15')).toBeInTheDocument();
      });

      // Filter to date range 2026-10-10 to 2026-10-20
      const startInput = screen.getByTestId('audit-start-date');
      const endInput = screen.getByTestId('audit-end-date');

      fireEvent.change(startInput, { target: { value: '2026-10-10' } });
      fireEvent.change(endInput, { target: { value: '2026-10-20' } });

      await waitFor(() => {
        expect(screen.getByText('Event on Oct 15')).toBeInTheDocument();
        expect(screen.queryByText('Event on Oct 01')).not.toBeInTheDocument();
        expect(screen.queryByText('Event on Oct 30')).not.toBeInTheDocument();
      });
    });
  });
});

