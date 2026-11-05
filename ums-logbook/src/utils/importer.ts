/**
 * UMS Digital Class Logbook - Excel/CSV Importer & Validation Engine
 * File: src/utils/importer.ts
 */

import * as XLSX from 'xlsx';
import { ALL_CLASSES, GVCN_USER_MAPPING } from '../services/seedService';
import {
  RawStudentRow,
  ValidStudentRow,
  RawScheduleRow,
  ValidScheduleRow,
  StudentRosterValidationReport,
  ScheduleValidationReport,
  InvalidRow,
  ImportType,
} from '../types/importer';
import { ClassSchedule, ScheduleSlot } from '../types/schedule';
import { saveClassSchedule, getClassSchedule } from '../services/scheduleService';
import { db } from '../config/firebase';
import { doc, writeBatch } from 'firebase/firestore';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/**
 * Strips UTF-8 Byte Order Mark (\uFEFF) if present at start of string
 */
export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Auto-detects delimiter by sampling the first lines
 */
export function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Parses CSV / TSV text adhering to RFC-4180 (multiline, escaped quotes, arbitrary delimiters)
 */
export function parseCsvRows(text: string, delimiter?: string): string[][] {
  const clean = stripBom(text);
  const delim = delimiter || detectCsvDelimiter(clean);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quotes
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delim) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // Carriage return, check if next is \n
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Final field & row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses date values supporting Excel serial numbers, DD/MM/YYYY, and YYYY-MM-DD
 */
export function parseDateValue(val: any): { dateStr: string | null; error?: string } {
  if (val === null || val === undefined || val === '') {
    return { dateStr: null };
  }

  // 1. Numeric Excel Serial Date
  if (typeof val === 'number') {
    if (val < 1000 || val > 100000) {
      return { dateStr: null, error: `Số ngày Excel không hợp lệ: ${val}` };
    }
    const utc_days = Math.floor(val - 25569);
    const date_info = new Date(utc_days * 86400 * 1000);
    if (isNaN(date_info.getTime())) {
      return { dateStr: null, error: `Giá trị ngày không hợp lệ: ${val}` };
    }
    const y = date_info.getUTCFullYear();
    const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date_info.getUTCDate()).padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}` };
  }

  const str = String(val).trim();
  if (!str) return { dateStr: null };

  // 2. Format DD/MM/YYYY, DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { dateStr: null, error: `Ngày tháng không hợp lệ: ${str}` };
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      return { dateStr: null, error: `Ngày không tồn tại trong lịch: ${str}` };
    }
    return {
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  // 3. Format YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { dateStr: null, error: `Ngày tháng không hợp lệ: ${str}` };
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      return { dateStr: null, error: `Ngày không tồn tại trong lịch: ${str}` };
    }
    return {
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  return {
    dateStr: null,
    error: `Định dạng ngày không hợp lệ: "${str}". Định dạng hỗ trợ: YYYY-MM-DD hoặc DD/MM/YYYY`,
  };
}

/**
 * Parses day of week (2 to 6, Monday to Friday)
 */
export function parseDayOfWeek(val: any): { day: 2 | 3 | 4 | 5 | 6 | null; error?: string } {
  if (val === null || val === undefined || val === '') {
    return { day: null, error: 'Thiếu thông tin thứ trong tuần' };
  }
  const str = String(val).trim().toLowerCase();

  if (
    str.includes('saturday') ||
    str.includes('bảy') ||
    str.includes('bay') ||
    str.includes('sunday') ||
    str.includes('nhật') ||
    str.includes('nhat') ||
    str === '7' ||
    str === '8' ||
    str === 'cn'
  ) {
    return { day: null, error: `Thứ trong tuần không hợp lệ: "${val}" (Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6)` };
  }

  if (str === '2' || str === 't2' || str.includes('hai') || str === 'thứ 2' || str === 'thu 2' || str === 'monday' || str === 'mon') {
    return { day: 2 };
  }
  if (str === '3' || str === 't3' || str === 'ba' || str.includes('thứ ba') || str.includes('thu ba') || str === 'thứ 3' || str === 'thu 3' || str === 'tuesday' || str === 'tue') {
    return { day: 3 };
  }
  if (str === '4' || str === 't4' || str === 'tu' || str.includes('thứ tư') || str.includes('thu tu') || str === 'thứ 4' || str === 'thu 4' || str === 'wednesday' || str === 'wed' || str.includes('tư')) {
    return { day: 4 };
  }
  if (str === '5' || str === 't5' || str.includes('năm') || str.includes('nam') || str === 'thứ 5' || str === 'thu 5' || str === 'thursday' || str === 'thu') {
    return { day: 5 };
  }
  if (str === '6' || str === 't6' || str.includes('sáu') || str.includes('sau') || str === 'thứ 6' || str === 'thu 6' || str === 'friday' || str === 'fri') {
    return { day: 6 };
  }
  return { day: null, error: `Thứ trong tuần không hợp lệ: "${val}" (Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6)` };
}

/**
 * Parses period index (1 to 8)
 */
export function parsePeriodIndex(val: any): { period: number | null; error?: string } {
  if (val === null || val === undefined || val === '') {
    return { period: null, error: 'Thiếu thông tin tiết học' };
  }
  if (typeof val === 'number') {
    if (val < 1 || val > 8) {
      return { period: null, error: `Tiết học phải từ 1 đến 8 (nhận được: "${val}")` };
    }
    return { period: val };
  }
  const str = String(val).trim();
  if (str.includes('-')) {
    return { period: null, error: `Tiết học phải từ 1 đến 8 (nhận được: "${val}")` };
  }
  const cleanStr = str.replace(/[^0-9]/g, '');
  const num = parseInt(cleanStr, 10);
  if (isNaN(num) || num < 1 || num > 8) {
    return { period: null, error: `Tiết học phải từ 1 đến 8 (nhận được: "${val}")` };
  }
  return { period: num };
}

/**
 * Header synonym normalization dictionary
 */
const HEADER_SYNONYMS: Record<string, string> = {
  // STT
  'stt': 'stt',
  'số thứ tự': 'stt',
  'tt': 'stt',
  'no': 'stt',
  'no.': 'stt',
  'index': 'stt',

  // MHS
  'mhs': 'mhs',
  'mã học sinh': 'mhs',
  'mã hs': 'mhs',
  'mã số': 'mhs',
  'student id': 'mhs',
  'student_id': 'mhs',
  'id': 'mhs',

  // Name
  'họ và tên': 'name',
  'họ và tên học sinh': 'name',
  'họ tên': 'name',
  'tên học sinh': 'name',
  'tên': 'name',
  'full name': 'name',
  'name': 'name',

  // DOB
  'ngày sinh': 'dob',
  'ngaysinh': 'dob',
  'dob': 'dob',
  'date of birth': 'dob',
  'birthdate': 'dob',
  'sinh ngày': 'dob',

  // Gender
  'giới tính': 'gender',
  'gioitinh': 'gender',
  'gender': 'gender',
  'sex': 'gender',
  'phái': 'gender',

  // Class
  'lớp': 'classId',
  'lớp học': 'classId',
  'class': 'classId',
  'class id': 'classId',
  'classid': 'classId',
  'grade': 'classId',

  // Phone
  'sđt phụ huynh': 'parentPhone',
  'số điện thoại phụ huynh': 'parentPhone',
  'sđt': 'parentPhone',
  'điện thoại': 'parentPhone',
  'phone': 'parentPhone',
  'parent phone': 'parentPhone',
  'tel': 'parentPhone',

  // Address
  'địa chỉ': 'address',
  'dia chi': 'address',
  'address': 'address',
  'hộ khẩu': 'address',
  'nơi ở': 'address',

  // Note
  'ghi chú': 'note',
  'note': 'note',
  'ngoại ngữ 2': 'secondLanguage',

  // Schedule keys
  'thứ': 'dayOfWeek',
  'thu': 'dayOfWeek',
  'day': 'dayOfWeek',
  'day of week': 'dayOfWeek',
  'thứ trong tuần': 'dayOfWeek',
  'ngày': 'dayOfWeek',

  'tiết': 'periodIndex',
  'tiet': 'periodIndex',
  'tiết học': 'periodIndex',
  'period': 'periodIndex',
  'period index': 'periodIndex',
  'ca': 'periodIndex',

  'môn học': 'subject',
  'mon hoc': 'subject',
  'môn': 'subject',
  'mon': 'subject',
  'subject': 'subject',

  'giáo viên': 'teacher',
  'giao vien': 'teacher',
  'gv': 'teacher',
  'teacher': 'teacher',
  'teacher name': 'teacher',
  'username': 'teacher',

  'phòng': 'room',
  'phong': 'room',
  'phòng học': 'room',
  'room': 'room',
  'địa điểm': 'room',
};

export function normalizeHeaderKey(rawHeader: string): string {
  const clean = String(rawHeader || '')
    .trim()
    .toLowerCase()
    .replace(/[\r\n\t_]/g, ' ')
    .replace(/\s+/g, ' ');
  return HEADER_SYNONYMS[clean] || clean;
}

/**
 * Validates raw student roster rows
 */
export function validateStudentRosterImport(
  rows: RawStudentRow[],
  knownClasses: string[] = ALL_CLASSES
): StudentRosterValidationReport {
  const validRows: ValidStudentRow[] = [];
  const invalidRows: InvalidRow<RawStudentRow>[] = [];
  const seenMhs = new Map<string, number>();

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];

    // 1. Validate MHS
    const rawMhs = raw.mhs !== undefined && raw.mhs !== null ? String(raw.mhs).trim() : '';
    if (!rawMhs) {
      errors.push('Thiếu mã học sinh (MHS)');
    } else {
      if (seenMhs.has(rawMhs)) {
        errors.push(`Trùng mã học sinh "${rawMhs}" (đã xuất hiện tại dòng ${seenMhs.get(rawMhs)})`);
      } else {
        seenMhs.set(rawMhs, rowNumber);
      }
    }

    // 2. Validate Name
    const rawName = raw.name !== undefined && raw.name !== null ? String(raw.name).trim() : '';
    if (!rawName) {
      errors.push('Thiếu họ và tên học sinh');
    }

    // 3. Validate ClassId
    const rawClassId =
      raw.classId !== undefined && raw.classId !== null ? String(raw.classId).trim().toUpperCase() : '';
    if (!rawClassId) {
      errors.push('Thiếu thông tin lớp học');
    } else if (!knownClasses.includes(rawClassId)) {
      errors.push(`Lớp học "${rawClassId}" không hợp lệ (Trường UMS chỉ có 26 lớp từ 6A1 đến 9A6)`);
    }

    // 4. Validate DOB
    let parsedDob = '';
    if (raw.dob !== undefined && raw.dob !== null && raw.dob !== '') {
      const dateRes = parseDateValue(raw.dob);
      if (dateRes.error) {
        errors.push(dateRes.error);
      } else if (dateRes.dateStr) {
        parsedDob = dateRes.dateStr;
        const birthYear = parseInt(parsedDob.slice(0, 4), 10);
        if (birthYear < 2005 || birthYear > 2020) {
          errors.push(`Năm sinh ${birthYear} không hợp lý cho học sinh THCS (2005 - 2020)`);
        }
      }
    }

    // 5. Gender normalization
    let normalizedGender: 'Nam' | 'Nữ' = 'Nam';
    if (raw.gender) {
      const g = String(raw.gender).trim().toLowerCase();
      if (['nam', 'male', 'm'].includes(g)) {
        normalizedGender = 'Nam';
      } else if (['nữ', 'nu', 'female', 'f'].includes(g)) {
        normalizedGender = 'Nữ';
      } else {
        errors.push(`Giới tính không hợp lệ: "${raw.gender}" (Chấp nhận "Nam" hoặc "Nữ")`);
      }
    }

    // 6. Parent Phone
    let cleanPhone = raw.parentPhone ? String(raw.parentPhone).trim().replace(/[\s\.\-]/g, '') : undefined;
    if (cleanPhone) {
      if (!/^(0|\+84)[0-9]{9}$/.test(cleanPhone)) {
        errors.push(`Số điện thoại phụ huynh không đúng định dạng: "${raw.parentPhone}"`);
      }
    }

    // 7. STT resolution
    const stt = raw.stt ? parseInt(String(raw.stt), 10) || (validRows.length + 1) : (validRows.length + 1);

    if (errors.length > 0) {
      invalidRows.push({
        row: rowNumber,
        errors,
        data: raw,
      });
    } else {
      const grade = parseInt(rawClassId[0], 10) || 6;
      validRows.push({
        id: rawMhs,
        mhs: rawMhs,
        stt,
        name: rawName,
        classId: rawClassId,
        grade,
        dob: parsedDob,
        gender: normalizedGender,
        parentPhone: cleanPhone,
        address: raw.address ? String(raw.address).trim() : undefined,
        status: 'active',
        createdAt: Date.now(),
      });
    }
  });

  return {
    validRows,
    invalidRows,
    total: rows.length,
    validCount: validRows.length,
    errorCount: invalidRows.length,
  };
}

/**
 * Validates raw schedule rows
 */
export function validateScheduleImport(
  rows: RawScheduleRow[],
  knownClasses: string[] = ALL_CLASSES
): ScheduleValidationReport {
  const validRows: ValidScheduleRow[] = [];
  const invalidRows: InvalidRow<RawScheduleRow>[] = [];
  const seenSlots = new Map<string, number>();

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];

    // 1. Validate ClassId
    const rawClassId =
      raw.classId !== undefined && raw.classId !== null ? String(raw.classId).trim().toUpperCase() : '';
    if (!rawClassId) {
      errors.push('Thiếu thông tin lớp học');
    } else if (!knownClasses.includes(rawClassId)) {
      errors.push(`Lớp học "${rawClassId}" không tồn tại trong danh sách 26 lớp UMS`);
    }

    // 2. Validate Day of Week (2 to 6)
    const dayRes = parseDayOfWeek(raw.dayOfWeek);
    if (dayRes.error || !dayRes.day) {
      errors.push(dayRes.error || 'Thứ trong tuần không hợp lệ');
    }

    // 3. Validate Period Index (1 to 8)
    const periodRes = parsePeriodIndex(raw.periodIndex);
    if (periodRes.error || !periodRes.period) {
      errors.push(periodRes.error || 'Tiết học không hợp lệ');
    }

    // 4. Validate Subject
    const rawSubject = raw.subject !== undefined && raw.subject !== null ? String(raw.subject).trim() : '';
    if (!rawSubject) {
      errors.push('Thiếu tên môn học');
    }

    // 5. Detect Slot Collision
    if (rawClassId && dayRes.day && periodRes.period) {
      const slotKey = `${rawClassId}_T${dayRes.day}_P${periodRes.period}`;
      if (seenSlots.has(slotKey)) {
        errors.push(
          `Trùng lịch học: Lớp ${rawClassId} đã có môn xếp vào Thứ ${dayRes.day} - Tiết ${periodRes.period} tại dòng ${seenSlots.get(slotKey)}`
        );
      } else {
        seenSlots.set(slotKey, rowNumber);
      }
    }

    // 6. Teacher resolution (Username or Display Name)
    let teacherUsername: string | undefined = undefined;
    let teacherName: string | undefined = raw.teacher ? String(raw.teacher).trim() : undefined;

    if (teacherName) {
      const lower = teacherName.toLowerCase();
      const matchedByUsername = Object.values(GVCN_USER_MAPPING).find(
        (m) => m.username.toLowerCase() === lower
      );
      if (matchedByUsername) {
        teacherUsername = matchedByUsername.username;
        teacherName = matchedByUsername.name;
      } else {
        const matchedByName = Object.values(GVCN_USER_MAPPING).find(
          (m) => m.name.toLowerCase() === lower
        );
        if (matchedByName) {
          teacherUsername = matchedByName.username;
          teacherName = matchedByName.name;
        }
      }
    }

    if (errors.length > 0) {
      invalidRows.push({
        row: rowNumber,
        errors,
        data: raw,
      });
    } else {
      validRows.push({
        dayOfWeek: dayRes.day!,
        periodIndex: periodRes.period!,
        classId: rawClassId,
        subject: rawSubject,
        teacherUsername,
        teacherName,
        room: raw.room ? String(raw.room).trim() : `P.${rawClassId}`,
      });
    }
  });

  return {
    validRows,
    invalidRows,
    total: rows.length,
    validCount: validRows.length,
    errorCount: invalidRows.length,
  };
}

/**
 * Parses an Excel or CSV file in browser or Node environment
 */
export async function parseExcelOrCsvFile(
  file: File | { name: string; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<{
  type: ImportType;
  studentRows?: RawStudentRow[];
  scheduleRows?: RawScheduleRow[];
  warnings?: string[];
}> {
  const buffer = await file.arrayBuffer();
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    const parsedRows = parseCsvRows(text);
    if (parsedRows.length === 0) {
      throw new Error('File không có nội dung hoặc rỗng');
    }

    const header = parsedRows[0].map(normalizeHeaderKey);
    const isSchedule = header.some((h) => h.toLowerCase() === 'dayofweek' || h.toLowerCase() === 'periodindex');

    const dataRows = parsedRows.slice(1).map((row) => {
      const obj: any = {};
      header.forEach((key, colIdx) => {
        obj[key] = row[colIdx] ?? '';
      });
      return obj;
    });

    if (isSchedule) {
      return { type: 'schedule', scheduleRows: dataRows };
    }
    return { type: 'students', studentRows: dataRows };
  }

  // Excel workbook (.xlsx, .xls)
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('Workbook không chứa bất kỳ sheet nào');
  }

  // Check if it's the multi-sheet UMS class list workbook
  const classSheets = sheetNames.filter((s) => /l[ớo]p\s*([6-9]A[1-8])/i.test(s));

  if (classSheets.length > 0) {
    // Multi-sheet UMS format
    const allStudents: RawStudentRow[] = [];

    for (const sName of classSheets) {
      const match = sName.match(/([6-9]A[1-8])/i);
      const classId = match ? match[1].toUpperCase() : '';
      const sheet = workbook.Sheets[sName];
      const raw2D: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Scan rows 0 to 10 for header containing MHS and Name
      let headerRowIdx = -1;
      for (let r = 0; r < Math.min(raw2D.length, 12); r++) {
        const row = (raw2D[r] || []).map((c) => String(c).toLowerCase());
        if (
          row.some((c) => c.includes('mhs') || c.includes('mã')) &&
          row.some((c) => c.includes('tên') || c.includes('họ'))
        ) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx === -1) {
        // Fallback to row 5 (standard UMS header)
        headerRowIdx = 5;
      }

      const headers = (raw2D[headerRowIdx] || []).map((h) => normalizeHeaderKey(String(h || '')));

      for (let r = headerRowIdx + 1; r < raw2D.length; r++) {
        const row = raw2D[r];
        if (!row || row.length === 0) continue;

        // Stop if non-numeric STT or empty row
        const sttVal = row[0];
        if (sttVal === undefined || sttVal === null || sttVal === '') continue;

        const studentObj: any = { classId };
        headers.forEach((hKey, colIdx) => {
          if (hKey) {
            studentObj[hKey] = row[colIdx];
          }
        });

        // Must have at least MHS or Name
        if (studentObj.mhs || studentObj.name) {
          allStudents.push(studentObj);
        }
      }
    }

    return { type: 'students', studentRows: allStudents };
  }

  // Single-sheet standard workbook
  const firstSheet = workbook.Sheets[sheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  if (rawRows.length === 0) {
    throw new Error('Sheet dữ liệu không có dòng dữ liệu nào');
  }

  // Normalize keys
  const normalizedRows = rawRows.map((r) => {
    const obj: any = {};
    for (const key of Object.keys(r)) {
      obj[normalizeHeaderKey(key)] = r[key];
    }
    return obj;
  });

  const firstKeys = Object.keys(normalizedRows[0] || {});
  const isSchedule = firstKeys.some((k) => k.toLowerCase() === 'dayofweek' || k.toLowerCase() === 'periodindex');

  if (isSchedule) {
    return { type: 'schedule', scheduleRows: normalizedRows };
  }
  return { type: 'students', studentRows: normalizedRows };
}

/**
 * Downloads student roster template client-side
 */
export function downloadStudentRosterTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const sampleData = [
    {
      'STT': 1,
      'Mã học sinh': '269398',
      'Họ và tên': 'Lý Bảo Duy',
      'Lớp': '6A1',
      'Ngày sinh': '2015-07-04',
      'Giới tính': 'Nữ',
      'SĐT phụ huynh': '0900000678',
      'Địa chỉ': 'Cầu Giấy, Hà Nội',
    },
    {
      'STT': 2,
      'Mã học sinh': '269594',
      'Họ và tên': 'Tạ Gia Thị Định',
      'Lớp': '6A1',
      'Ngày sinh': '2015-12-31',
      'Giới tính': 'Nam',
      'SĐT phụ huynh': '0900000321',
      'Địa chỉ': 'Ba Đình, Hà Nội',
    },
    {
      'STT': 3,
      'Mã học sinh': '269688',
      'Họ và tên': 'Trần Diệu An Duy',
      'Lớp': '6A1',
      'Ngày sinh': '2015-04-13',
      'Giới tính': 'Nam',
      'SĐT phụ huynh': '0900000567',
      'Địa chỉ': 'Tây Hồ, Hà Nội',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');

  if (format === 'csv') {
    XLSX.writeFile(wb, 'mau_danh_sach_hoc_sinh_UMS.csv', { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, 'mau_danh_sach_hoc_sinh_UMS.xlsx', { bookType: 'xlsx' });
  }
}

/**
 * Downloads schedule template client-side
 */
export function downloadScheduleTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const sampleData = [
    { 'Thứ': 2, 'Tiết': 1, 'Lớp': '6A1', 'Môn học': 'Hoạt động trải nghiệm', 'Giáo viên': 'msphuonganhums', 'Phòng': 'P.6A1' },
    { 'Thứ': 2, 'Tiết': 2, 'Lớp': '6A1', 'Môn học': 'Toán học', 'Giáo viên': 'mrlongums', 'Phòng': 'P.6A1' },
    { 'Thứ': 2, 'Tiết': 3, 'Lớp': '6A1', 'Môn học': 'Ngữ văn', 'Giáo viên': 'msmaihuong6a2ums', 'Phòng': 'P.6A1' },
    { 'Thứ': 2, 'Tiết': 4, 'Lớp': '6A1', 'Môn học': 'Tiếng Anh', 'Giáo viên': 'msphuonganhums', 'Phòng': 'P.6A1' },
    { 'Thứ': 2, 'Tiết': 5, 'Lớp': '6A1', 'Môn học': 'Khoa học tự nhiên', 'Giáo viên': 'mshuyenums', 'Phòng': 'P.6A1' },
    { 'Thứ': 2, 'Tiết': 6, 'Lớp': '6A1', 'Môn học': 'Lịch sử và Địa lí', 'Giáo viên': 'msbaoums', 'Phòng': 'P.6A1' },
    { 'Thứ': 2, 'Tiết': 7, 'Lớp': '6A1', 'Môn học': 'Giáo dục thể chất', 'Giáo viên': 'mrhoanglongums', 'Phòng': 'Sân thể thao' },
    { 'Thứ': 2, 'Tiết': 8, 'Lớp': '6A1', 'Môn học': 'Tin học', 'Giáo viên': 'mshaiyen8a6ums', 'Phòng': 'Phòng Tin học' },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ThoiKhoaBieu');

  if (format === 'csv') {
    XLSX.writeFile(wb, 'mau_thoi_khoa_bieu_UMS.csv', { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, 'mau_thoi_khoa_bieu_UMS.xlsx', { bookType: 'xlsx' });
  }
}

/**
 * Commits valid student roster rows to LocalStorage and Firestore
 */
export async function commitStudentRoster(
  validRows: ValidStudentRow[],
  onProgress?: (pct: number) => void
): Promise<{ success: boolean; count: number }> {
  if (validRows.length === 0) return { success: true, count: 0 };

  // 1. Update LocalStorage ums_students
  try {
    const raw = localStorage.getItem('ums_students');
    const existing: any[] = raw ? JSON.parse(raw) : [];
    const map = new Map<string, any>(existing.map((s) => [s.mhs || s.id, s]));

    validRows.forEach((r) => {
      map.set(r.mhs, r);
    });

    const updated = Array.from(map.values());
    localStorage.setItem('ums_students', JSON.stringify(updated));

    // Update class student counts in ums_classes
    const rawClasses = localStorage.getItem('ums_classes');
    if (rawClasses) {
      const classes: any[] = JSON.parse(rawClasses);
      const countsByClass: Record<string, number> = {};
      updated.forEach((s) => {
        countsByClass[s.classId] = (countsByClass[s.classId] || 0) + 1;
      });
      classes.forEach((c) => {
        if (countsByClass[c.id]) {
          c.studentCount = countsByClass[c.id];
        }
      });
      localStorage.setItem('ums_classes', JSON.stringify(classes));
    }
  } catch (e) {
    console.error('Failed to commit students to LocalStorage', e);
  }

  // 2. Commit to Cloud Firestore in chunks
  if (!isTestEnv) {
    try {
      const chunkSize = 250;
      const totalChunks = Math.ceil(validRows.length / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = validRows.slice(i * chunkSize, (i + 1) * chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((st) => {
          const docRef = doc(db, 'students', st.mhs);
          batch.set(docRef, st, { merge: true });
        });

        await batch.commit();

        if (onProgress) {
          onProgress(Math.round(((i + 1) / totalChunks) * 100));
        }
      }
    } catch (e) {
      console.warn('Firestore student sync deferred:', e);
    }
  } else {
    if (onProgress) onProgress(100);
  }

  return { success: true, count: validRows.length };
}

/**
 * Commits valid schedule rows to LocalStorage and Firestore
 */
export async function commitSchedule(
  validRows: ValidScheduleRow[],
  onProgress?: (pct: number) => void
): Promise<{ success: boolean; count: number }> {
  if (validRows.length === 0) return { success: true, count: 0 };

  // Group slots by classId
  const byClass = new Map<string, ValidScheduleRow[]>();
  validRows.forEach((r) => {
    if (!byClass.has(r.classId)) {
      byClass.set(r.classId, []);
    }
    byClass.get(r.classId)!.push(r);
  });

  const totalClasses = byClass.size;
  let processed = 0;

  for (const [classId, classSlots] of byClass.entries()) {
    const existingSchedule = await getClassSchedule(classId);
    const existingMap = new Map<string, ScheduleSlot>();

    if (existingSchedule && existingSchedule.slots) {
      existingSchedule.slots.forEach((s) => {
        existingMap.set(`${s.dayOfWeek}_${s.periodIndex}`, s);
      });
    }

    // Overwrite or add imported slots
    classSlots.forEach((slot) => {
      const key = `${slot.dayOfWeek}_${slot.periodIndex}`;
      existingMap.set(key, {
        dayOfWeek: slot.dayOfWeek,
        periodIndex: slot.periodIndex,
        subject: slot.subject,
        teacherUsername: slot.teacherUsername || '',
        teacherName: slot.teacherName || slot.teacherUsername || '',
        room: slot.room || `P.${classId}`,
      });
    });

    const mergedSlots = Array.from(existingMap.values()).sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.periodIndex - b.periodIndex;
    });

    const updatedSchedule: ClassSchedule = {
      classId,
      academicYear: existingSchedule?.academicYear || '2026-2027',
      semester: existingSchedule?.semester || 1,
      slots: mergedSlots,
      updatedAt: Date.now(),
      updatedBy: 'admin',
    };

    await saveClassSchedule(updatedSchedule);

    processed++;
    if (onProgress) {
      onProgress(Math.round((processed / totalClasses) * 100));
    }
  }

  return { success: true, count: validRows.length };
}
