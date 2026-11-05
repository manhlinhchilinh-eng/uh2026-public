/**
 * UMS Digital Class Logbook - Audit Logging Service
 * Milestone 6: Dual-Mode Persistence, Querying, Redaction & Export Engine
 * Path: src/services/auditService.ts
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import {
  AuditLogEntry,
  LogAuditParams,
  AuditLogFilter,
  AuditStateDiff,
} from '../types/audit';
import { UserProfile, UserRole } from '../types/auth';

export const AUDIT_STORAGE_KEY = 'ums_audit_logs';
export const AUDIT_EVENT_NAME = 'ums_audit_logged';
const MAX_MOCK_AUDIT_LOGS = 500;
const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

// Keys to recursively redact from beforeState and afterState
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'secret',
  'accesstoken',
  'refreshtoken',
  'credential',
  'apikey',
]);

/**
 * Deep sanitization helper that redacts sensitive auth data
 */
export function sanitizeState(
  state: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!state || typeof state !== 'object') return null;

  try {
    const scrub = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(scrub);

      const cleaned: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          cleaned[key] = '[REDACTED]';
        } else if (typeof val === 'object' && val !== null) {
          cleaned[key] = scrub(val);
        } else {
          cleaned[key] = val;
        }
      }
      return cleaned;
    };

    return scrub(JSON.parse(JSON.stringify(state)));
  } catch (err) {
    return { _sanitizationError: 'Could not sanitize payload' };
  }
}

/**
 * Generates unique audit log entry ID
 */
export function generateAuditLogId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `audit_${ts}_${rand}`;
}

/**
 * Dispatches a custom window event for real-time audit event notification
 */
export function notifyAuditLogged(entry: AuditLogEntry): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(AUDIT_EVENT_NAME, {
        detail: {
          entry,
          timestamp: Date.now(),
        },
      })
    );
  }
}

/**
 * Retrieves the current logged-in user profile from session context or mock storage
 */
export function getCurrentActor(): { actorId: string; actorName: string; actorRole: UserRole } {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('ums_current_user') : null;
    if (raw) {
      const profile = JSON.parse(raw) as UserProfile;
      return {
        actorId: profile.uid || profile.username || 'unknown',
        actorName: profile.displayName || profile.username || 'Người dùng',
        actorRole: (profile.roles && profile.roles[0]) || 'gvbm',
      };
    }
  } catch {}

  const fbUser = auth?.currentUser;
  if (fbUser) {
    return {
      actorId: fbUser.uid,
      actorName: fbUser.displayName || fbUser.email || 'Người dùng',
      actorRole: 'gvbm',
    };
  }

  return {
    actorId: 'system',
    actorName: 'Hệ thống UMS',
    actorRole: 'admin',
  };
}

/**
 * Pure logging helper - Writes an immutable audit entry to Firestore with LocalStorage fallback.
 * Fault-tolerant: guaranteed never to throw an unhandled exception to callers.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<AuditLogEntry> {
  const actor = params.actor || getCurrentActor();
  const id = generateAuditLogId();
  const timestamp = Date.now();

  const entry: AuditLogEntry = {
    id,
    actorId: actor.actorId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    action: params.action,
    targetCollection: params.targetCollection,
    targetId: params.targetId,
    beforeState: sanitizeState(params.beforeState),
    afterState: sanitizeState(params.afterState),
    timestamp,
    details: params.details || '',
  };

  // 1. Persist to Cloud Firestore (if not in test mode and db initialized)
  if (!isTestEnv && db) {
    try {
      const auditDocRef = doc(collection(db, 'audit_logs'), id);
      await setDoc(auditDocRef, entry);
    } catch (fbErr) {
      console.warn('[AuditService] Firestore write failed, using local storage fallback:', fbErr);
    }
  }

  // 2. Persist to LocalStorage fallback / cache (FIFO capped at MAX_MOCK_AUDIT_LOGS)
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      const list: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
      list.unshift(entry); // newest first

      // Keep only recent entries to avoid exceeding storage quota
      if (list.length > MAX_MOCK_AUDIT_LOGS) {
        list.length = MAX_MOCK_AUDIT_LOGS;
      }
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (storageErr) {
    console.warn('[AuditService] LocalStorage write failed:', storageErr);
  }

  // 3. Emit notification event
  notifyAuditLogged(entry);

  return entry;
}

/**
 * Queries audit logs with filtering and limits
 */
export async function getAuditLogs(
  filter?: AuditLogFilter,
  limitCount = 100
): Promise<AuditLogEntry[]> {
  let logs: AuditLogEntry[] = [];

  // Attempt reading from Firestore first
  if (!isTestEnv && db) {
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(limitCount * 2));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        logs.push(d.data() as AuditLogEntry);
      });
    } catch {
      // Fallback to local storage below
    }
  }

  // Fallback to LocalStorage if Firestore returned nothing or in test mode
  if (logs.length === 0 && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (raw) {
        logs = JSON.parse(raw);
      }
    } catch {}
  }

  // In-memory filter processing
  if (filter) {
    const { actorId, action, targetCollection, startDate, endDate, searchQuery } = filter;

    const startMs = startDate
      ? typeof startDate === 'number'
        ? startDate
        : new Date(startDate).setHours(0, 0, 0, 0)
      : undefined;

    const endMs = endDate
      ? typeof endDate === 'number'
        ? endDate
        : new Date(endDate).setHours(23, 59, 59, 999)
      : undefined;

    const term = searchQuery ? searchQuery.toLowerCase().trim() : '';

    logs = logs.filter((item) => {
      if (actorId && item.actorId !== actorId) return false;
      if (action && action !== 'ALL' && item.action !== action) return false;
      if (targetCollection && targetCollection !== 'ALL' && item.targetCollection !== targetCollection) {
        return false;
      }
      if (startMs !== undefined && item.timestamp < startMs) return false;
      if (endMs !== undefined && item.timestamp > endMs) return false;

      if (term) {
        const matchName = item.actorName?.toLowerCase().includes(term);
        const matchDetails = item.details?.toLowerCase().includes(term);
        const matchTarget = item.targetId?.toLowerCase().includes(term);
        const matchId = item.id?.toLowerCase().includes(term);
        const matchActorId = item.actorId?.toLowerCase().includes(term);
        if (!matchName && !matchDetails && !matchTarget && !matchId && !matchActorId) {
          return false;
        }
      }
      return true;
    });
  }

  // Sort descending by timestamp
  logs.sort((a, b) => b.timestamp - a.timestamp);
  return logs.slice(0, limitCount);
}

/**
 * Computes structural differences between beforeState and afterState
 */
export function computeStateDiff(
  beforeState?: Record<string, unknown> | null,
  afterState?: Record<string, unknown> | null
): AuditStateDiff[] {
  const b = beforeState || {};
  const a = afterState || {};
  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();

  const diffs: AuditStateDiff[] = [];

  for (const key of allKeys) {
    const hasBefore = Object.prototype.hasOwnProperty.call(b, key);
    const hasAfter = Object.prototype.hasOwnProperty.call(a, key);
    const valBefore = b[key];
    const valAfter = a[key];

    if (!hasBefore && hasAfter) {
      diffs.push({ field: key, type: 'added', newValue: valAfter });
    } else if (hasBefore && !hasAfter) {
      diffs.push({ field: key, type: 'removed', oldValue: valBefore });
    } else {
      const isSame = JSON.stringify(valBefore) === JSON.stringify(valAfter);
      if (isSame) {
        diffs.push({ field: key, type: 'unchanged', oldValue: valBefore, newValue: valAfter });
      } else {
        diffs.push({ field: key, type: 'modified', oldValue: valBefore, newValue: valAfter });
      }
    }
  }

  return diffs;
}

/**
 * Formats epoch timestamp as Vietnamese locale DD/MM/YYYY HH:mm:ss
 */
export function formatAuditTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${dateStr} ${timeStr}`;
}

/**
 * Exports audit logs into CSV format with UTF-8 BOM for Microsoft Excel compatibility
 */
export function exportAuditLogsToCsv(logs: AuditLogEntry[]): string {
  const headers = [
    'Mã sự kiện',
    'Thời gian',
    'Người thực hiện',
    'Mã định danh',
    'Vai trò',
    'Hành động',
    'Đối tượng dữ liệu',
    'Mã đối tượng',
    'Chi tiết nội dung',
  ];

  const escapeCsv = (str: string | number | undefined | null) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = logs.map((log) => [
    escapeCsv(log.id),
    escapeCsv(formatAuditTimestamp(log.timestamp)),
    escapeCsv(log.actorName),
    escapeCsv(log.actorId),
    escapeCsv(log.actorRole),
    escapeCsv(log.action),
    escapeCsv(log.targetCollection),
    escapeCsv(log.targetId),
    escapeCsv(log.details || ''),
  ]);

  // UTF-8 BOM (\uFEFF) ensures proper rendering of Vietnamese diacritics in Excel
  const bom = '\uFEFF';
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  return bom + csvContent;
}

/**
 * Triggers a browser download of the exported CSV file
 */
export function downloadAuditLogsCsv(logs: AuditLogEntry[], filename?: string): void {
  const csv = exportAuditLogsToCsv(logs);
  const fname = filename || `UMS_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fname);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports audit logs as a formatted JSON string
 */
export function exportAuditLogsToJson(logs: AuditLogEntry[]): string {
  return JSON.stringify(logs, null, 2);
}

/**
 * Triggers a browser download of the exported JSON file
 */
export function downloadAuditLogsJson(logs: AuditLogEntry[], filename?: string): void {
  const json = exportAuditLogsToJson(logs);
  const fname = filename || `UMS_Audit_Logs_${new Date().toISOString().split('T')[0]}.json`;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fname);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Clears mock audit logs (for testing harness & reset utilities)
 */
export function clearAuditLogsMock(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  }
}
