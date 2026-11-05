/**
 * UMS Digital Class Logbook - Early Warning Alert Contracts (Milestone 3)
 * File: src/types/earlyWarning.ts
 */

import { AbsenceType } from './logbook';

export type EarlyWarningLevel = 'warning' | 'critical';

export type EarlyWarningReasonType = 'unexcused_absences' | 'negative_notes';

export interface EarlyWarningReason {
  type: EarlyWarningReasonType;
  count: number;
  threshold: number;
  details: string[]; // Formatted bullet strings, e.g. "2026-10-05: Vắng không phép (K)"
}

export interface EarlyWarningAlert {
  studentId: string;       // Unique student ID (MHS, e.g. "269048")
  studentName: string;     // Full student name (e.g. "Đinh Minh Tùng")
  studentNumber: string;   // STT in class roster (e.g. "05") or formatted string
  classId: string;         // e.g. "6A1"
  level: EarlyWarningLevel;// 'warning' (amber) | 'critical' (rose/red)
  reasons: EarlyWarningReason[];
  periodRange: {
    startDate: string;     // "YYYY-MM-DD"
    endDate: string;       // "YYYY-MM-DD"
  };
  detectedAt: number;      // Epoch timestamp of evaluation
}

export interface EarlyWarningOptions {
  windowMode?: 'rolling_7_days' | 'school_week'; // Default: 'rolling_7_days'
  referenceDate?: string | Date;                 // Default: current date
  absenceThreshold?: number;                     // Default: 3
  noteThreshold?: number;                        // Default: 3
  classId?: string;                              // Optional class filter
  deduplicateAbsencesPerDay?: boolean;           // Default: false
}

/**
 * Normalized absence record for alert evaluation and timeline display
 */
export interface AbsenceEvent {
  id?: string;
  date: string;            // "YYYY-MM-DD"
  studentId: string;
  studentName?: string;
  classId: string;
  type: AbsenceType;       // 'P' | 'K' | 'Late'
  periodIndex?: number;    // 1..8, or undefined for pre-session baseline
  session?: 'morning' | 'afternoon';
  note?: string;
  timestamp?: number;
}

/**
 * Unified timeline event item for StudentProfileDrawer
 */
export type TimelineItemType = 'absence' | 'early_leave' | 'positive_note' | 'negative_note';

export interface StudentTimelineItem {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  type: TimelineItemType;
  date: string;            // "YYYY-MM-DD"
  timestamp: number;       // Epoch timestamp for exact chronological sorting
  title: string;
  description?: string;
  authorName?: string;
  authorRole?: string;
  category?: string;
  badgeLabel: string;
  badgeVariant: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate';
  periodIndex?: number;
}
