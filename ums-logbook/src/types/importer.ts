/**
 * UMS Digital Class Logbook - Importer Contracts (Milestone 4)
 * File: src/types/importer.ts
 */

export interface RawStudentRow {
  stt?: number | string;
  mhs: string | number;
  name: string;
  classId?: string;
  dob?: string | number;
  gender?: string;
  parentPhone?: string;
  address?: string;
  note?: string;
  secondLanguage?: string;
  [key: string]: any;
}

export interface ValidStudentRow {
  id: string; // trimmed mhs
  mhs: string; // 6-digit or formatted string
  stt: number;
  name: string;
  classId: string;
  grade: number; // 6, 7, 8, 9
  dob: string; // ISO format: YYYY-MM-DD
  gender: 'Nam' | 'Nữ';
  parentPhone?: string;
  address?: string;
  status: 'active' | 'transferred' | 'suspended';
  createdAt: number;
}

export interface RawScheduleRow {
  dayOfWeek: number | string; // 2-6 or "Thứ 2".."Thứ 6"
  periodIndex: number | string; // 1-8
  classId: string;
  subject: string;
  teacher?: string; // username or full name
  room?: string;
  [key: string]: any;
}

export interface ValidScheduleRow {
  dayOfWeek: 2 | 3 | 4 | 5 | 6;
  periodIndex: number; // 1-8
  classId: string;
  subject: string;
  teacherUsername?: string;
  teacherName?: string;
  room?: string;
}

export interface InvalidRow<T = any> {
  row: number; // 1-indexed row number in the file
  errors: string[];
  data: T;
}

export interface ImportValidationReport<TValid, TRaw> {
  validRows: TValid[];
  invalidRows: InvalidRow<TRaw>[];
  total: number;
  validCount: number;
  errorCount: number;
  warnings?: string[];
}

export type StudentRosterValidationReport = ImportValidationReport<ValidStudentRow, RawStudentRow>;
export type ScheduleValidationReport = ImportValidationReport<ValidScheduleRow, RawScheduleRow>;

export type ImportType = 'students' | 'schedule';
