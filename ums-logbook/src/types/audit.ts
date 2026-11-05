/**
 * UMS Digital Class Logbook - Master Audit Trail Contracts
 * Milestone 6: Immutable Append-Only Audit Logging & Session Hardening
 * Path: src/types/audit.ts
 */

import { UserRole } from './auth';

/**
 * Standard audit actions supported across all system mutations
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'PASSWORD_CHANGE';

/**
 * Common Firestore collection targets subject to audit tracking
 */
export type AuditTargetCollection =
  | 'daily_logbooks'
  | 'periods'
  | 'behavior_notes'
  | 'schedules'
  | 'timetables'
  | 'users'
  | 'auth'
  | 'system_settings'
  | 'classes'
  | 'students'
  | 'weekly_summaries'
  | 'monthly_summaries'
  | string;

/**
 * Immutable audit log document entry matching PROJECT.md § Interface Contracts
 */
export interface AuditLogEntry {
  id: string; // Unique entry ID (e.g., audit_${timestamp}_${rand} or firestore doc id)
  actorId: string; // UID or username of actor
  actorName: string; // Full display name or username
  actorRole: UserRole; // 'admin' | 'gvcn' | 'gvbm' | 'tpt' | 'parent'
  action: AuditAction; // 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'PASSWORD_CHANGE'
  targetCollection: AuditTargetCollection; // e.g. "daily_logbooks", "behavior_notes"
  targetId: string; // Target document identifier
  beforeState?: Record<string, unknown> | null; // Previous state snapshot (sanitized)
  afterState?: Record<string, unknown> | null; // New state snapshot (sanitized)
  timestamp: number; // Epoch milliseconds
  details?: string; // Human-readable description
}

/**
 * Parameters for the pure logging helper
 */
export interface LogAuditParams {
  actor?: {
    actorId: string;
    actorName: string;
    actorRole: UserRole;
  };
  action: AuditAction;
  targetCollection: AuditTargetCollection;
  targetId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  details?: string;
}

/**
 * Filters for querying audit logs in Admin Viewer and services
 */
export interface AuditLogFilter {
  actorId?: string;
  action?: AuditAction | 'ALL';
  targetCollection?: string | 'ALL';
  startDate?: number | string; // Milliseconds timestamp or ISO / YYYY-MM-DD
  endDate?: number | string;   // Milliseconds timestamp or ISO / YYYY-MM-DD
  searchQuery?: string;        // Text search across actorName, details, targetId, id
}

/**
 * Individual field difference item for the visual diff inspector
 */
export interface AuditStateDiff {
  field: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  oldValue?: unknown;
  newValue?: unknown;
}
