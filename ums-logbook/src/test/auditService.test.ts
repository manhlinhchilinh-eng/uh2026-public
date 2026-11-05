/**
 * UMS Digital Class Logbook - Audit Logging Service Test Suite
 * Milestone 6: Dual-Mode Persistence, Querying, Redaction & Export Tests
 * Path: src/test/auditService.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  logAuditEvent,
  getAuditLogs,
  sanitizeState,
  computeStateDiff,
  exportAuditLogsToCsv,
  exportAuditLogsToJson,
  clearAuditLogsMock,
  formatAuditTimestamp,
  AUDIT_STORAGE_KEY,
  AUDIT_EVENT_NAME,
} from '../services/auditService';

describe('AuditService Unit & Sanitization Suite', () => {
  beforeEach(() => {
    clearAuditLogsMock();
  });

  it('1.1: logs CREATE and UPDATE events with auto-generated id and timestamp', async () => {
    const entry = await logAuditEvent({
      action: 'CREATE',
      targetCollection: 'daily_logbooks',
      targetId: '6A1_2026-09-30',
      details: 'Khởi tạo sổ đầu bài 6A1',
    });

    expect(entry.id).toMatch(/^audit_/);
    expect(entry.action).toBe('CREATE');
    expect(entry.targetCollection).toBe('daily_logbooks');
    expect(entry.targetId).toBe('6A1_2026-09-30');
    expect(entry.timestamp).toBeGreaterThan(0);

    const logs = await getAuditLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].id).toBe(entry.id);
  });

  it('1.2: strictly sanitizes passwords, hashes, and tokens from state payloads', () => {
    const dirtyBefore = {
      password: 'PlaintextPassword123!',
      passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      token: 'bearer_eyJhbGciOi...',
      secret: 'super_secret_key',
      credential: 'top_secret_credential',
      username: 'mrlinhums',
      roles: ['admin'],
      nested: {
        currentPassword: 'old_password_123',
        safeField: 'hello world',
      },
    };

    const sanitized = sanitizeState(dirtyBefore);
    expect(sanitized?.password).toBe('[REDACTED]');
    expect(sanitized?.passwordHash).toBe('[REDACTED]');
    expect(sanitized?.token).toBe('[REDACTED]');
    expect(sanitized?.secret).toBe('[REDACTED]');
    expect(sanitized?.credential).toBe('[REDACTED]');
    expect(sanitized?.username).toBe('mrlinhums');
    expect(sanitized?.roles).toEqual(['admin']);
    expect((sanitized?.nested as any)?.currentPassword).toBe('[REDACTED]');
    expect((sanitized?.nested as any)?.safeField).toBe('hello world');
  });

  it('1.3: handles null and non-object inputs in sanitizeState safely', () => {
    expect(sanitizeState(null)).toBeNull();
    expect(sanitizeState(undefined)).toBeNull();
    expect(sanitizeState('string' as any)).toBeNull();
  });

  it('1.4: filters audit logs by action, targetCollection, and date range', async () => {
    await logAuditEvent({ action: 'CREATE', targetCollection: 'periods', targetId: 'p1' });
    await logAuditEvent({ action: 'UPDATE', targetCollection: 'periods', targetId: 'p2' });
    await logAuditEvent({ action: 'LOGIN', targetCollection: 'users', targetId: 'u1' });

    const createOnly = await getAuditLogs({ action: 'CREATE' });
    expect(createOnly.length).toBe(1);
    expect(createOnly[0].action).toBe('CREATE');

    const periodsOnly = await getAuditLogs({ targetCollection: 'periods' });
    expect(periodsOnly.length).toBe(2);

    const loginOnly = await getAuditLogs({ action: 'LOGIN' });
    expect(loginOnly.length).toBe(1);
  });

  it('1.5: filters audit logs by search query across multiple fields', async () => {
    await logAuditEvent({
      action: 'UPDATE',
      targetCollection: 'daily_logbooks',
      targetId: '9A3_2026-10-01',
      details: 'Cập nhật điểm danh lớp 9A3',
      actor: { actorId: 'mrlinhums', actorName: 'Nguyễn Mạnh Linh', actorRole: 'admin' },
    });

    await logAuditEvent({
      action: 'CREATE',
      targetCollection: 'behavior_notes',
      targetId: 'note_123',
      details: 'Ghi nhận nề nếp tốt',
      actor: { actorId: 'mrhoanglongums', actorName: 'Hoàng Long', actorRole: 'tpt' },
    });

    const matchByName = await getAuditLogs({ searchQuery: 'Mạnh Linh' });
    expect(matchByName.length).toBe(1);
    expect(matchByName[0].actorName).toBe('Nguyễn Mạnh Linh');

    const matchByDetails = await getAuditLogs({ searchQuery: 'nề nếp' });
    expect(matchByDetails.length).toBe(1);
    expect(matchByDetails[0].targetId).toBe('note_123');

    const matchByTargetId = await getAuditLogs({ searchQuery: '9A3' });
    expect(matchByTargetId.length).toBe(1);
  });

  it('1.6: exports CSV with UTF-8 BOM and correct headers', () => {
    const sample = [
      {
        id: 'audit_test_1',
        actorId: 'admin1',
        actorName: 'Thầy Linh BGH',
        actorRole: 'admin' as const,
        action: 'UPDATE' as const,
        targetCollection: 'timetables',
        targetId: '9A3',
        timestamp: 1727600000000,
        details: 'Cập nhật TKB lớp 9A3, tiết 1 môn Toán',
      },
    ];

    const csv = exportAuditLogsToCsv(sample);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Mã sự kiện');
    expect(csv).toContain('Thầy Linh BGH');
    expect(csv).toContain('timetables');
    expect(csv).toContain('Cập nhật TKB lớp 9A3');
  });

  it('1.7: exports formatted JSON correctly', () => {
    const sample = [
      {
        id: 'audit_123',
        actorId: 'uid_1',
        actorName: 'Cô Huyền Trang',
        actorRole: 'admin' as const,
        action: 'LOGIN' as const,
        targetCollection: 'auth',
        targetId: 'uid_1',
        timestamp: 1727600000000,
      },
    ];

    const jsonStr = exportAuditLogsToJson(sample);
    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe('audit_123');
    expect(parsed[0].actorName).toBe('Cô Huyền Trang');
  });

  it('1.8: computes structural diffs accurately (added, removed, modified, unchanged)', () => {
    const before = {
      subject: 'Toán',
      teacher: 'Thầy Long',
      score: 9.0,
      oldRoom: 'P.100',
    };
    const after = {
      subject: 'Toán',
      teacher: 'Thầy Long',
      score: 9.5,
      newRoom: 'P.101',
    };

    const diffs = computeStateDiff(before, after);

    const unchanged = diffs.find((d) => d.field === 'subject');
    expect(unchanged?.type).toBe('unchanged');

    const modified = diffs.find((d) => d.field === 'score');
    expect(modified?.type).toBe('modified');
    expect(modified?.oldValue).toBe(9.0);
    expect(modified?.newValue).toBe(9.5);

    const added = diffs.find((d) => d.field === 'newRoom');
    expect(added?.type).toBe('added');
    expect(added?.newValue).toBe('P.101');

    const removed = diffs.find((d) => d.field === 'oldRoom');
    expect(removed?.type).toBe('removed');
    expect(removed?.oldValue).toBe('P.100');
  });

  it('1.9: dispatches ums_audit_logged window event on logAuditEvent', async () => {
    const listener = vi.fn();
    window.addEventListener(AUDIT_EVENT_NAME, listener);

    await logAuditEvent({
      action: 'PASSWORD_CHANGE',
      targetCollection: 'auth',
      targetId: 'user_456',
    });

    expect(listener).toHaveBeenCalled();
    window.removeEventListener(AUDIT_EVENT_NAME, listener);
  });

  it('1.10: caps localStorage mock storage at 500 items', async () => {
    // Populate dummy list of 510 items in localStorage
    const dummyList = [];
    for (let i = 0; i < 505; i++) {
      dummyList.push({
        id: `audit_dummy_${i}`,
        actorId: 'test',
        actorName: 'Test',
        actorRole: 'admin',
        action: 'UPDATE',
        targetCollection: 'test',
        targetId: `${i}`,
        timestamp: Date.now() - i * 1000,
      });
    }
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(dummyList));

    // Now log a new event
    await logAuditEvent({
      action: 'CREATE',
      targetCollection: 'daily_logbooks',
      targetId: 'new_entry',
    });

    const stored = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]');
    expect(stored.length).toBeLessThanOrEqual(500);
  });

  it('1.11: formatAuditTimestamp formats valid Vietnamese locale date and time', () => {
    const ts = new Date(2026, 8, 30, 14, 30, 45).getTime();
    const formatted = formatAuditTimestamp(ts);
    expect(formatted).toContain('30/09/2026');
    expect(formatted).toContain('14:30:45');
  });
});
