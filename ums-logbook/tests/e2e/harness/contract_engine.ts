/**
 * Contract Engine & Authoritative State Machine
 * Strictly implements requirements from ORIGINAL_REQUEST.md & PROJECT.md
 */

import {
  FIXTURE_USERS,
  FIXTURE_STUDENTS_6A1,
  FIXTURE_STUDENTS_8A3,
  DEFAULT_PASSWORD,
} from './test_fixtures.ts';
import type { FixtureUser, FixtureStudent } from './test_fixtures.ts';

export type UserRole = 'admin' | 'gvcn' | 'gvbm' | 'tpt' | 'parent';

export interface UserSession {
  token: string;
  user: {
    uid: string;
    username: string;
    email: string;
    displayName: string;
    roles: UserRole[];
    assignedClassId?: string;
    mustChangePassword: boolean;
  };
  loginTime: number;
  lastActivityTime: number;
}

export interface PeriodScore {
  learning: number; // max 4.0
  discipline: number; // max 3.0
  hygiene: number; // max 2.0
  customCriterion: number; // max 1.0 (configurable)
  total: number; // sum <= 10.0
}

export type AbsenceType = 'P' | 'K' | 'Late';

export interface StudentAbsenceRecord {
  studentId: string;
  studentName: string;
  type: AbsenceType;
  note?: string;
}

export interface EarlyDepartureRecord {
  studentId: string;
  studentName: string;
  departedAt: string; // "HH:mm"
  reason: string;
}

export interface PeriodEntry {
  periodIndex: number; // 1 to 8
  subject: string;
  ppctLessonIndex?: number;
  lessonTopic: string;
  teacherId: string;
  teacherName: string;
  absentStudents: StudentAbsenceRecord[];
  scores: PeriodScore;
  teacherComment: string;
  teacherSignature: string;
  isSigned: boolean;
  updatedAt: number;
}

export interface DailyAttendanceBaseline {
  reportedBy: string;
  reportedAt: number;
  absences: StudentAbsenceRecord[];
  earlyDepartures: EarlyDepartureRecord[];
}

export interface DailyLogbook {
  id: string; // `${classId}_${date}`
  classId: string;
  date: string; // "YYYY-MM-DD"
  weekNumber: number;
  preSessionAttendance: DailyAttendanceBaseline;
  periods: Record<number, PeriodEntry>;
  totalPeriods: number;
  isCompleted: boolean;
  updatedAt: number;
}

export type BehaviorType = 'positive' | 'negative';

export interface BehaviorNote {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  type: BehaviorType;
  category: string;
  description: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  timestamp: number;
}

export interface ScoringConfig {
  learningMax: number;
  disciplineMax: number;
  hygieneMax: number;
  customMax: number;
  customLabel: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'PASSWORD_CHANGE';
  targetCollection: string;
  targetId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  timestamp: number;
}

export interface EarlyWarningAlerts {
  studentId: string;
  studentName: string;
  classId: string;
  unexcusedAbsenceCount: number;
  attendanceAlert: boolean;
  negativeNoteCount: number;
  disciplineAlert: boolean;
}

export class UMSContractEngine {
  private users: Map<string, { profile: FixtureUser; passwordHash: string; mustChangePassword: boolean }> = new Map();
  private sessions: Map<string, UserSession> = new Map();
  private logbooks: Map<string, DailyLogbook> = new Map(); // key: `${classId}_${date}`
  private behaviorNotes: BehaviorNote[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private classRosters: Map<string, FixtureStudent[]> = new Map();
  private scoringConfig: ScoringConfig = {
    learningMax: 4.0,
    disciplineMax: 3.0,
    hygieneMax: 2.0,
    customMax: 1.0,
    customLabel: 'Hoạt động chung',
  };

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.users.clear();
    this.sessions.clear();
    this.logbooks.clear();
    this.behaviorNotes = [];
    this.auditLogs = [];
    this.classRosters.clear();

    // Seed classes
    this.classRosters.set('6A1', [...FIXTURE_STUDENTS_6A1]);
    this.classRosters.set('8A3', [...FIXTURE_STUDENTS_8A3]);

    // Seed default users
    for (const [key, user] of Object.entries(FIXTURE_USERS)) {
      this.users.set(user.username, {
        profile: { ...user },
        passwordHash: DEFAULT_PASSWORD, // in test engine, simulated hash
        mustChangePassword: true,
      });
    }

    this.scoringConfig = {
      learningMax: 4.0,
      disciplineMax: 3.0,
      hygieneMax: 2.0,
      customMax: 1.0,
      customLabel: 'Hoạt động chung',
    };
  }

  // --- Audit Log Utility ---
  private logAudit(entry: Omit<AuditLogEntry, 'id'>): void {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.auditLogs.push({ id, ...entry });
  }

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  // --- Authentication & Session ---
  public login(username: string, password: string, mockTimestamp = Date.now()): UserSession {
    const record = this.users.get(username);
    if (!record) {
      throw new Error(`AUTH_INVALID_CREDENTIALS: User "${username}" not found.`);
    }
    if (record.passwordHash !== password) {
      throw new Error(`AUTH_INVALID_CREDENTIALS: Incorrect password for user "${username}".`);
    }

    const email = `${username}@ums.edu.vn`;
    const token = `token_${username}_${mockTimestamp}_${Math.random().toString(36).substring(2, 7)}`;
    const session: UserSession = {
      token,
      user: {
        uid: `uid_${username}`,
        username: record.profile.username,
        email,
        displayName: record.profile.name,
        roles: [...record.profile.roles],
        assignedClassId: record.profile.assignedClassId,
        mustChangePassword: record.mustChangePassword,
      },
      loginTime: mockTimestamp,
      lastActivityTime: mockTimestamp,
    };

    this.sessions.set(token, session);

    this.logAudit({
      actorId: session.user.uid,
      actorName: session.user.displayName,
      actorRole: session.user.roles[0],
      action: 'LOGIN',
      targetCollection: 'users',
      targetId: session.user.uid,
      timestamp: mockTimestamp,
    });

    return JSON.parse(JSON.stringify(session));
  }

  public validateSession(token: string, currentTimestamp = Date.now()): UserSession {
    const session = this.sessions.get(token);
    if (!session) {
      throw new Error(`AUTH_UNAUTHORIZED: Invalid or expired session token.`);
    }

    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    if (currentTimestamp - session.lastActivityTime > IDLE_TIMEOUT_MS) {
      this.sessions.delete(token);
      throw new Error(`AUTH_SESSION_TIMEOUT: Session has expired after 30 minutes of inactivity.`);
    }

    session.lastActivityTime = currentTimestamp;
    return JSON.parse(JSON.stringify(session));
  }

  public changePassword(token: string, oldPassword: string, newPassword: string, mockTimestamp = Date.now()): void {
    const session = this.validateSession(token, mockTimestamp);
    const record = this.users.get(session.user.username);
    if (!record) {
      throw new Error(`AUTH_USER_NOT_FOUND: User not found.`);
    }

    if (record.passwordHash !== oldPassword) {
      throw new Error(`AUTH_INVALID_PASSWORD: Old password is incorrect.`);
    }

    if (!newPassword || newPassword.trim().length === 0) {
      throw new Error(`AUTH_EMPTY_PASSWORD: New password cannot be empty or whitespace.`);
    }

    if (newPassword.trim().length < 6) {
      throw new Error(`AUTH_PASSWORD_TOO_SHORT: New password must be at least 6 characters.`);
    }

    if (newPassword === DEFAULT_PASSWORD) {
      throw new Error(`AUTH_DEFAULT_PASSWORD_REUSE: Cannot reuse the default initial password "demo@2026".`);
    }

    record.passwordHash = newPassword;
    record.mustChangePassword = false;

    // Update in-memory session
    session.user.mustChangePassword = false;
    const active = this.sessions.get(token);
    if (active) {
      active.user.mustChangePassword = false;
    }

    this.logAudit({
      actorId: session.user.uid,
      actorName: session.user.displayName,
      actorRole: session.user.roles[0],
      action: 'PASSWORD_CHANGE',
      targetCollection: 'users',
      targetId: session.user.uid,
      afterState: { mustChangePassword: false }, // Never expose password in audit logs
      timestamp: mockTimestamp,
    });
  }

  // --- Dynamic Scoring Config ---
  public getScoringConfig(): ScoringConfig {
    return { ...this.scoringConfig };
  }

  public updateScoringConfig(
    adminToken: string,
    update: Partial<ScoringConfig>,
    mockTimestamp = Date.now()
  ): ScoringConfig {
    const session = this.validateSession(adminToken, mockTimestamp);
    if (!session.user.roles.includes('admin')) {
      throw new Error(`AUTH_FORBIDDEN: Only administrators can modify scoring configuration.`);
    }

    if (update.customMax !== undefined) {
      if (typeof update.customMax !== 'number' || isNaN(update.customMax) || update.customMax < 0 || update.customMax > 5.0) {
        throw new Error(`CONFIG_INVALID_MAX: Custom criterion max points must be between 0.0 and 5.0`);
      }
      this.scoringConfig.customMax = update.customMax;
    }
    if (update.customLabel !== undefined) {
      if (!update.customLabel.trim()) {
        throw new Error(`CONFIG_INVALID_LABEL: Custom criterion label cannot be empty.`);
      }
      this.scoringConfig.customLabel = update.customLabel.trim();
    }

    return { ...this.scoringConfig };
  }

  // --- Scoring Engine ---
  public validateScores(rawScores: any): PeriodScore {
    if (!rawScores || typeof rawScores !== 'object') {
      throw new Error(`SCORE_INVALID_INPUT: Scores object must be provided.`);
    }

    const { learning, discipline, hygiene, customCriterion } = rawScores;
    const values = [
      { name: 'learning', val: learning, max: this.scoringConfig.learningMax },
      { name: 'discipline', val: discipline, max: this.scoringConfig.disciplineMax },
      { name: 'hygiene', val: hygiene, max: this.scoringConfig.hygieneMax },
      { name: 'customCriterion', val: customCriterion, max: this.scoringConfig.customMax },
    ];

    for (const item of values) {
      if (typeof item.val !== 'number' || isNaN(item.val)) {
        throw new Error(`SCORE_NON_NUMERIC: Criterion "${item.name}" must be a valid number, got ${item.val}`);
      }
      if (item.val < 0) {
        throw new Error(`SCORE_NEGATIVE_VALUE: Criterion "${item.name}" cannot be negative (${item.val})`);
      }
      if (item.val > item.max) {
        throw new Error(
          `SCORE_EXCEEDS_MAX: Criterion "${item.name}" value ${item.val} exceeds maximum allowed ceiling of ${item.max}`
        );
      }
    }

    const sum = Math.round((learning + discipline + hygiene + customCriterion) * 100) / 100;
    if (sum > 10.0) {
      throw new Error(`SCORE_TOTAL_EXCEEDS_10: Total period score ${sum} exceeds maximum allowed of 10.0`);
    }

    return {
      learning,
      discipline,
      hygiene,
      customCriterion,
      total: sum,
    };
  }

  // --- Daily Logbook & Period Operations ---
  public getOrCreateDailyLogbook(classId: string, date: string, gvcnId: string): DailyLogbook {
    const key = `${classId}_${date}`;
    let logbook = this.logbooks.get(key);
    if (!logbook) {
      logbook = {
        id: key,
        classId,
        date,
        weekNumber: 1,
        preSessionAttendance: {
          reportedBy: gvcnId,
          reportedAt: Date.now(),
          absences: [],
          earlyDepartures: [],
        },
        periods: {},
        totalPeriods: 8,
        isCompleted: false,
        updatedAt: Date.now(),
      };
      this.logbooks.set(key, logbook);
    }
    return logbook;
  }

  public recordPreSessionAttendance(
    token: string,
    classId: string,
    date: string,
    absences: StudentAbsenceRecord[],
    earlyDepartures: EarlyDepartureRecord[] = [],
    mockTimestamp = Date.now()
  ): DailyAttendanceBaseline {
    const session = this.validateSession(token, mockTimestamp);
    if (session.user.mustChangePassword) {
      throw new Error(`AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED: Must change password before performing operations.`);
    }

    // Must be Admin or GVCN of this class
    const isClassGvcn = session.user.roles.includes('gvcn') && session.user.assignedClassId === classId;
    const isAdmin = session.user.roles.includes('admin');
    if (!isClassGvcn && !isAdmin) {
      throw new Error(`AUTH_FORBIDDEN: Only GVCN of class ${classId} or Admin can record pre-session attendance.`);
    }

    const roster = this.classRosters.get(classId) || [];
    const rosterMhsSet = new Set(roster.map((s) => s.mhs));

    // Validate absences
    for (const abs of absences) {
      if (!rosterMhsSet.has(abs.studentId)) {
        throw new Error(`ATTENDANCE_UNKNOWN_STUDENT: Student ${abs.studentId} is not in class ${classId} roster.`);
      }
      if (!['P', 'K', 'Late'].includes(abs.type)) {
        throw new Error(`ATTENDANCE_INVALID_TYPE: Invalid absence type "${abs.type}". Must be P, K, or Late.`);
      }
    }

    // Validate early departures
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    for (const ed of earlyDepartures) {
      if (!rosterMhsSet.has(ed.studentId)) {
        throw new Error(`ATTENDANCE_UNKNOWN_STUDENT: Early departure student ${ed.studentId} is not in class ${classId}.`);
      }
      if (!timeRegex.test(ed.departedAt)) {
        throw new Error(`ATTENDANCE_INVALID_TIME_FORMAT: Departure time "${ed.departedAt}" must match format HH:mm.`);
      }
      if (!ed.reason || !ed.reason.trim()) {
        throw new Error(`ATTENDANCE_MISSING_REASON: Early departure reason must be specified.`);
      }
    }

    const logbook = this.getOrCreateDailyLogbook(classId, date, session.user.uid);
    logbook.preSessionAttendance = {
      reportedBy: session.user.uid,
      reportedAt: mockTimestamp,
      absences: [...absences],
      earlyDepartures: [...earlyDepartures],
    };
    logbook.updatedAt = mockTimestamp;

    this.logAudit({
      actorId: session.user.uid,
      actorName: session.user.displayName,
      actorRole: session.user.roles[0],
      action: 'UPDATE',
      targetCollection: 'daily_logbooks',
      targetId: logbook.id,
      afterState: { preSessionAttendance: logbook.preSessionAttendance },
      timestamp: mockTimestamp,
    });

    return JSON.parse(JSON.stringify(logbook.preSessionAttendance));
  }

  public submitPeriodEntry(
    token: string,
    params: {
      classId: string;
      date: string;
      periodIndex: number;
      subject: string;
      ppctLessonIndex?: number;
      lessonTopic: string;
      scores: PeriodScore;
      teacherComment: string;
      teacherSignature: string;
      absentStudents?: StudentAbsenceRecord[];
    },
    mockTimestamp = Date.now()
  ): PeriodEntry {
    const session = this.validateSession(token, mockTimestamp);
    if (session.user.mustChangePassword) {
      throw new Error(`AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED: Must change password before performing operations.`);
    }

    // Period index must be 1 to 8
    if (!Number.isInteger(params.periodIndex) || params.periodIndex < 1 || params.periodIndex > 8) {
      throw new Error(`PERIOD_INDEX_OUT_OF_BOUNDS: Period index must be an integer between 1 and 8, got ${params.periodIndex}`);
    }

    if (!params.subject || !params.subject.trim()) {
      throw new Error(`PERIOD_MISSING_SUBJECT: Subject name is required.`);
    }
    if (!params.lessonTopic || !params.lessonTopic.trim()) {
      throw new Error(`PERIOD_MISSING_LESSON_TOPIC: Lesson topic is required.`);
    }
    if (!params.teacherSignature || !params.teacherSignature.trim()) {
      throw new Error(`PERIOD_MISSING_SIGNATURE: Teacher signature is required.`);
    }

    const validatedScores = this.validateScores(params.scores);

    // Validate period absence records
    const absentList: StudentAbsenceRecord[] = [];
    if (params.absentStudents) {
      const roster = this.classRosters.get(params.classId) || [];
      const rosterMhsSet = new Set(roster.map((s) => s.mhs));
      const seenStudents = new Set<string>();

      for (const abs of params.absentStudents) {
        if (!rosterMhsSet.has(abs.studentId)) {
          throw new Error(`ATTENDANCE_UNKNOWN_STUDENT: Student ${abs.studentId} is not in class ${params.classId}`);
        }
        if (!['P', 'K', 'Late'].includes(abs.type)) {
          throw new Error(`ATTENDANCE_INVALID_TYPE: Invalid absence type "${abs.type}"`);
        }
        if (seenStudents.has(abs.studentId)) {
          throw new Error(`ATTENDANCE_DUPLICATE_ENTRY: Student ${abs.studentId} recorded multiple times in period ${params.periodIndex}`);
        }
        seenStudents.add(abs.studentId);
        absentList.push({ ...abs });
      }
    }

    const logbook = this.getOrCreateDailyLogbook(params.classId, params.date, session.user.uid);
    const entry: PeriodEntry = {
      periodIndex: params.periodIndex,
      subject: params.subject.trim(),
      ppctLessonIndex: params.ppctLessonIndex,
      lessonTopic: params.lessonTopic.trim(),
      teacherId: session.user.uid,
      teacherName: session.user.displayName,
      absentStudents: absentList,
      scores: validatedScores,
      teacherComment: params.teacherComment || '',
      teacherSignature: params.teacherSignature.trim(),
      isSigned: true,
      updatedAt: mockTimestamp,
    };

    logbook.periods[params.periodIndex] = entry;
    logbook.updatedAt = mockTimestamp;

    // Check if all 8 periods are signed
    if (Object.keys(logbook.periods).length === 8 && Object.values(logbook.periods).every((p) => p.isSigned)) {
      logbook.isCompleted = true;
    }

    this.logAudit({
      actorId: session.user.uid,
      actorName: session.user.displayName,
      actorRole: session.user.roles[0],
      action: 'CREATE',
      targetCollection: 'periods',
      targetId: `${logbook.id}_period_${params.periodIndex}`,
      afterState: { scores: validatedScores, subject: entry.subject },
      timestamp: mockTimestamp,
    });

    return JSON.parse(JSON.stringify(entry));
  }

  public getDailyLogbook(classId: string, date: string): DailyLogbook | null {
    const key = `${classId}_${date}`;
    const logbook = this.logbooks.get(key);
    return logbook ? JSON.parse(JSON.stringify(logbook)) : null;
  }

  // --- Behavior Notes & Immediate Visibility ---
  public createBehaviorNote(
    token: string,
    params: {
      studentId: string;
      studentName: string;
      classId: string;
      type: BehaviorType;
      category: string;
      description: string;
    },
    mockTimestamp = Date.now()
  ): BehaviorNote {
    const session = this.validateSession(token, mockTimestamp);
    if (session.user.mustChangePassword) {
      throw new Error(`AUTH_MANDATORY_PASSWORD_CHANGE_REQUIRED: Must change password before creating behavior notes.`);
    }

    if (!['positive', 'negative'].includes(params.type)) {
      throw new Error(`NOTE_INVALID_TYPE: Behavior note type must be either 'positive' or 'negative', got "${params.type}"`);
    }

    if (!params.description || !params.description.trim()) {
      throw new Error(`NOTE_EMPTY_DESCRIPTION: Behavior note description cannot be empty.`);
    }

    const roster = this.classRosters.get(params.classId) || [];
    const student = roster.find((s) => s.mhs === params.studentId);
    if (!student) {
      throw new Error(`NOTE_UNKNOWN_STUDENT: Student ${params.studentId} not found in class ${params.classId}.`);
    }

    // Role verification:
    // Admin & TPT can write for ANY class.
    // GVCN can write for assigned class.
    // GVBM can write for classes they teach.
    const isTPTorAdmin = session.user.roles.includes('tpt') || session.user.roles.includes('admin');
    const isClassGvcn = session.user.roles.includes('gvcn') && session.user.assignedClassId === params.classId;
    const isGvbm = session.user.roles.includes('gvbm');

    if (!isTPTorAdmin && !isClassGvcn && !isGvbm) {
      throw new Error(`AUTH_FORBIDDEN: User does not have permission to create notes for class ${params.classId}.`);
    }

    const authorRole: UserRole = session.user.roles.includes('tpt')
      ? 'tpt'
      : session.user.roles.includes('admin')
      ? 'admin'
      : session.user.roles.includes('gvcn') && session.user.assignedClassId === params.classId
      ? 'gvcn'
      : 'gvbm';

    const note: BehaviorNote = {
      id: `note_${mockTimestamp}_${Math.random().toString(36).substring(2, 7)}`,
      studentId: params.studentId,
      studentName: params.studentName || student.name,
      classId: params.classId,
      type: params.type,
      category: params.category || (params.type === 'positive' ? 'Khen ngợi' : 'Vi phạm'),
      description: params.description.trim(),
      authorId: session.user.uid,
      authorName: session.user.displayName,
      authorRole,
      timestamp: mockTimestamp,
    };

    this.behaviorNotes.push(note);

    this.logAudit({
      actorId: session.user.uid,
      actorName: session.user.displayName,
      actorRole: authorRole,
      action: 'CREATE',
      targetCollection: 'behavior_notes',
      targetId: note.id,
      afterState: { type: note.type, studentId: note.studentId, category: note.category },
      timestamp: mockTimestamp,
    });

    return JSON.parse(JSON.stringify(note));
  }

  public getBehaviorNotes(
    token: string,
    filter: { classId?: string; studentId?: string; type?: BehaviorType } = {}
  ): BehaviorNote[] {
    this.validateSession(token);
    return this.behaviorNotes
      .filter((n) => {
        if (filter.classId && n.classId !== filter.classId) return false;
        if (filter.studentId && n.studentId !== filter.studentId) return false;
        if (filter.type && n.type !== filter.type) return false;
        return true;
      })
      .map((n) => JSON.parse(JSON.stringify(n)));
  }

  // --- Early Warning Alerts Engine ---
  public evaluateStudentAlerts(classId: string, studentId: string): EarlyWarningAlerts {
    const roster = this.classRosters.get(classId) || [];
    const student = roster.find((s) => s.mhs === studentId);
    if (!student) {
      throw new Error(`Student ${studentId} not found in class ${classId}`);
    }

    // 1. Calculate unexcused absences (K) across all logbooks for this student
    let unexcusedCount = 0;
    for (const logbook of this.logbooks.values()) {
      if (logbook.classId !== classId) continue;

      // Check pre-session baseline
      const preK = logbook.preSessionAttendance.absences.some((a) => a.studentId === studentId && a.type === 'K');
      if (preK) {
        unexcusedCount++;
      }

      // Check each period
      for (const period of Object.values(logbook.periods)) {
        const periodK = period.absentStudents.some((a) => a.studentId === studentId && a.type === 'K');
        if (periodK) {
          unexcusedCount++;
        }
      }
    }

    // 2. Calculate negative behavior notes
    const negativeNoteCount = this.behaviorNotes.filter(
      (n) => n.classId === classId && n.studentId === studentId && n.type === 'negative'
    ).length;

    // Rules from ORIGINAL_REQUEST R5 / AC: >=3 unexcused absences or >=3 negative notes triggers alert
    return {
      studentId,
      studentName: student.name,
      classId,
      unexcusedAbsenceCount: unexcusedCount,
      attendanceAlert: unexcusedCount >= 3,
      negativeNoteCount,
      disciplineAlert: negativeNoteCount >= 3,
    };
  }

  // --- Weekly Summaries & Emulation Ranking ---
  public calculateWeeklySummary(classId: string, weekDates: string[]): {
    classId: string;
    totalPeriods: number;
    completedPeriods: number;
    totalScore: number;
    averageScore: number;
    criteriaAverages: { learning: number; discipline: number; hygiene: number; custom: number };
    attendanceTotals: { excused: number; unexcused: number; late: number; earlyLeave: number };
    emulationScore: number;
  } {
    let completedPeriods = 0;
    let totalScore = 0;
    let sumLearning = 0;
    let sumDiscipline = 0;
    let sumHygiene = 0;
    let sumCustom = 0;
    let excused = 0;
    let unexcused = 0;
    let late = 0;
    let earlyLeave = 0;

    for (const date of weekDates) {
      const logbook = this.getDailyLogbook(classId, date);
      if (!logbook) continue;

      earlyLeave += logbook.preSessionAttendance.earlyDepartures.length;

      for (const period of Object.values(logbook.periods)) {
        if (!period.isSigned) continue;
        completedPeriods++;
        totalScore += period.scores.total;
        sumLearning += period.scores.learning;
        sumDiscipline += period.scores.discipline;
        sumHygiene += period.scores.hygiene;
        sumCustom += period.scores.customCriterion;

        for (const abs of period.absentStudents) {
          if (abs.type === 'P') excused++;
          else if (abs.type === 'K') unexcused++;
          else if (abs.type === 'Late') late++;
        }
      }
    }

    const averageScore = completedPeriods > 0 ? Math.round((totalScore / completedPeriods) * 100) / 100 : 0;
    const criteriaAverages = {
      learning: completedPeriods > 0 ? Math.round((sumLearning / completedPeriods) * 100) / 100 : 0,
      discipline: completedPeriods > 0 ? Math.round((sumDiscipline / completedPeriods) * 100) / 100 : 0,
      hygiene: completedPeriods > 0 ? Math.round((sumHygiene / completedPeriods) * 100) / 100 : 0,
      custom: completedPeriods > 0 ? Math.round((sumCustom / completedPeriods) * 100) / 100 : 0,
    };

    // Class Emulation formula: Base 100 + (averageScore * 10) - (unexcused * 2) - (late * 0.5)
    const baseEmulation = 100;
    const emulationScore = Math.round(
      (baseEmulation + averageScore * 10 - unexcused * 2 - late * 0.5) * 100
    ) / 100;

    return {
      classId,
      totalPeriods: weekDates.length * 8,
      completedPeriods,
      totalScore: Math.round(totalScore * 100) / 100,
      averageScore,
      criteriaAverages,
      attendanceTotals: { excused, unexcused, late, earlyLeave },
      emulationScore,
    };
  }
}
