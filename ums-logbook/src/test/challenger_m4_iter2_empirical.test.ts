/**
 * Challenger M4 Iteration 2 Empirical Verification Test Suite
 * File: src/test/challenger_m4_iter2_empirical.test.ts
 *
 * Independent, adversarial verification of the 4 remediated importer defects:
 * - Defect 1: Multi-sheet Excel workbook extraction on data/UMS_class_list_2026_2027.xlsx
 * - Defect 2: Schedule CSV and single-sheet XLSX header auto-detection
 * - Defect 3: Day of week boundary validation (Saturday/Sunday rejected, Wed/Mon-Fri pass)
 * - Defect 4: Period index boundary validation (negative, 0, 9 rejected, 1-8 pass)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  parseDayOfWeek,
  parsePeriodIndex,
  parseExcelOrCsvFile,
  validateScheduleImport,
  validateStudentRosterImport,
} from '../utils/importer';

describe('CHALLENGER M4_ITER2: Empirical Adversarial Verification Suite', () => {

  // =========================================================================
  // DEFECT 1: Multi-Sheet Excel Workbook Extraction (UMS_class_list_2026_2027.xlsx)
  // =========================================================================
  describe('Defect 1: Multi-Sheet Excel Workbook Extraction', () => {
    const filePath = path.resolve(__dirname, '../../data/UMS_class_list_2026_2027.xlsx');

    it('verifies data/UMS_class_list_2026_2027.xlsx exists and is readable', () => {
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(10000);
    });

    it('parses exactly 26 class sheets and exactly 674 students without binary corruption', async () => {
      const fileBuffer = fs.readFileSync(filePath);
      // Simulate browser File.arrayBuffer()
      const ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
      const mockFile = {
        name: 'UMS_class_list_2026_2027.xlsx',
        arrayBuffer: async () => ab,
      };

      const result = await parseExcelOrCsvFile(mockFile);
      expect(result.type).toBe('students');
      expect(result.studentRows).toBeDefined();
      expect(result.studentRows!.length).toBe(674);

      // Verify that the 26 classes are all represented
      const distinctClasses = new Set(result.studentRows!.map((r) => r.classId));
      expect(distinctClasses.size).toBe(26);

      const expectedClasses = [
        '6A1', '6A2', '6A3', '6A4', '6A5', '6A6', '6A7', '6A8',
        '7A1', '7A2', '7A3', '7A4', '7A5', '7A6',
        '8A1', '8A2', '8A3', '8A4', '8A5', '8A6',
        '9A1', '9A2', '9A3', '9A4', '9A5', '9A6',
      ];
      for (const cls of expectedClasses) {
        expect(distinctClasses.has(cls)).toBe(true);
      }

      // Verify student records are not corrupted binary strings
      for (const student of result.studentRows!) {
        expect(student.name).toBeDefined();
        expect(typeof student.name).toBe('string');
        expect(student.name!.trim().length).toBeGreaterThan(2);
        // Student name should not contain unprintable binary / control characters
        expect(/[\x00-\x08\x0E-\x1F]/.test(student.name!)).toBe(false);

        expect(student.classId).toMatch(/^[6-9]A[1-8]$/);
        expect(student.mhs).toBeDefined();
        expect(String(student.mhs).trim().length).toBeGreaterThan(0);
      }

      // Spot check first and last student from 6A1 and 9A6
      const class6A1 = result.studentRows!.filter((r) => r.classId === '6A1');
      expect(class6A1.length).toBe(26);
      expect(class6A1[0].name).toContain('An'); // Lý Bảo Duy or similar

      const class9A6 = result.studentRows!.filter((r) => r.classId === '9A6');
      expect(class9A6.length).toBe(26);
    });

    it('successfully validates student roster import of all 674 parsed students', async () => {
      const fileBuffer = fs.readFileSync(filePath);
      const ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
      const mockFile = {
        name: 'UMS_class_list_2026_2027.xlsx',
        arrayBuffer: async () => ab,
      };

      const result = await parseExcelOrCsvFile(mockFile);
      const report = validateStudentRosterImport(result.studentRows!);

      expect(report.total).toBe(674);
      // All 674 rows pass validation, including the 5 dot-separated dates (e.g. 02.10.2014)
      expect(report.validCount).toBe(674);
      expect(report.errorCount).toBe(0);

      expect(new Set(report.validRows.map((r) => r.classId)).size).toBe(26);
    });
  });

  // =========================================================================
  // DEFECT 2: Schedule Header Auto-Detection (CSV and Single-Sheet XLSX)
  // =========================================================================
  describe('Defect 2: Schedule Header Auto-Detection', () => {
    it('detects CSV as schedule when headers use Vietnamese "Thứ,Tiết,Lớp,Môn,Giáo viên"', async () => {
      const csv = 'Thứ,Tiết,Lớp,Môn học,Giáo viên\n2,1,6A1,Toán,msphuonganhums\n3,2,6A1,Văn,msphuonganhums';
      const buffer = new TextEncoder().encode(csv).buffer;
      const mockFile = { name: 'schedule_vi.csv', arrayBuffer: async () => buffer };

      const result = await parseExcelOrCsvFile(mockFile);
      expect(result.type).toBe('schedule');
      expect(result.scheduleRows).toBeDefined();
      expect(result.scheduleRows!.length).toBe(2);
      expect(result.scheduleRows![0].dayOfWeek).toBe('2');
      expect(result.scheduleRows![0].periodIndex).toBe('1');
    });

    it('detects CSV as schedule with uppercase/lowercase/camelCase variants: "DAYOFWEEK", "dayOfWeek"', async () => {
      const csv = 'DAYOFWEEK,PERIODINDEX,CLASSID,SUBJECT,TEACHER\n4,3,7A2,Tiếng Anh,mshuyentrangums';
      const buffer = new TextEncoder().encode(csv).buffer;
      const mockFile = { name: 'schedule_caps.csv', arrayBuffer: async () => buffer };

      const result = await parseExcelOrCsvFile(mockFile);
      expect(result.type).toBe('schedule');
      expect(result.scheduleRows!.length).toBe(1);
    });

    it('detects CSV as schedule when only dayOfWeek or only periodIndex is present', async () => {
      const csvWithDayOnly = 'Thứ,Lớp,Môn học,Giáo viên\n2,6A1,Chào cờ,mrlinhums';
      const buffer1 = new TextEncoder().encode(csvWithDayOnly).buffer;
      const res1 = await parseExcelOrCsvFile({ name: 'test_day.csv', arrayBuffer: async () => buffer1 });
      expect(res1.type).toBe('schedule');

      const csvWithPeriodOnly = 'Tiết,Lớp,Môn học,Giáo viên\n1,6A1,Toán,msphuonganhums';
      const buffer2 = new TextEncoder().encode(csvWithPeriodOnly).buffer;
      const res2 = await parseExcelOrCsvFile({ name: 'test_period.csv', arrayBuffer: async () => buffer2 });
      expect(res2.type).toBe('schedule');
    });

    it('detects single-sheet XLSX as schedule with Vietnamese headers "Thứ, Tiết, Lớp, Môn học"', async () => {
      const scheduleData = [
        { 'Thứ': 2, 'Tiết': 1, 'Lớp': '6A1', 'Môn học': 'Toán', 'Giáo viên': 'msphuonganhums' },
        { 'Thứ': 2, 'Tiết': 2, 'Lớp': '6A1', 'Môn học': 'Văn', 'Giáo viên': 'msphuonganhums' },
      ];
      const ws = XLSX.utils.json_to_sheet(scheduleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'TKB_6A1');
      const wbBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const mockFile = { name: 'timetable.xlsx', arrayBuffer: async () => wbBuffer };
      const result = await parseExcelOrCsvFile(mockFile);
      expect(result.type).toBe('schedule');
      expect(result.scheduleRows).toBeDefined();
      expect(result.scheduleRows!.length).toBe(2);
    });

    it('detects single-sheet XLSX as schedule with English camelCase headers "dayOfWeek, periodIndex"', async () => {
      const scheduleData = [
        { dayOfWeek: 3, periodIndex: 2, classId: '8A3', subject: 'Vật lý', teacher: 'mrhoanggiangums' },
      ];
      const ws = XLSX.utils.json_to_sheet(scheduleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ScheduleSheet');
      const wbBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const mockFile = { name: 'schedule_en.xlsx', arrayBuffer: async () => wbBuffer };
      const result = await parseExcelOrCsvFile(mockFile);
      expect(result.type).toBe('schedule');
      expect(result.scheduleRows!.length).toBe(1);
    });

    it('does NOT confuse student roster CSV or XLSX with schedule', async () => {
      const rosterCsv = 'STT,Mã học sinh,Họ và tên,Lớp,Ngày sinh,Giới tính\n1,269029,Nguyễn Văn A,6A1,2015-01-01,Nam';
      const buffer = new TextEncoder().encode(rosterCsv).buffer;
      const res = await parseExcelOrCsvFile({ name: 'roster.csv', arrayBuffer: async () => buffer });
      expect(res.type).toBe('students');
      expect(res.studentRows).toBeDefined();
      expect(res.studentRows!.length).toBe(1);
    });
  });

  // =========================================================================
  // DEFECT 3: Day of Week Boundary Validation (parseDayOfWeek)
  // =========================================================================
  describe('Defect 3: Day of Week Boundary Validation (parseDayOfWeek)', () => {
    it('rejects standard Saturday inputs (Saturday, Thứ Bảy, bảy, Thứ 7, 7)', () => {
      const saturdayInputs = [
        'Saturday',
        'saturday',
        'SATURDAY',
        'Thứ Bảy',
        'thứ bảy',
        'bảy',
        'Thứ 7',
        'thu 7',
        '7',
        7,
        'sat',
        'Sat',
      ];

      for (const input of saturdayInputs) {
        const res = parseDayOfWeek(input);
        expect(res.day).toBeNull();
        expect(res.error).toBeDefined();
        expect(res.error).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
      }
    });

    it('MUST reject unaccented Saturday inputs ("bay", "thu bay", "Thu Bay", "thứ bay") as invalid weekend days', () => {
      const unaccentedBayInputs = ['bay', 'thu bay', 'Thu Bay', 'thứ bay'];

      for (const input of unaccentedBayInputs) {
        const res = parseDayOfWeek(input);
        expect(res.day).toBeNull();
        expect(res.error).toBeDefined();
        expect(res.error).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
      }
    });

    it('MUST reject Sunday inputs in all formats (Sunday, Chủ Nhật, 8)', () => {
      const sundayInputs = [
        'Sunday',
        'sunday',
        'SUNDAY',
        'Chủ Nhật',
        'chủ nhật',
        'Chu Nhat',
        'chu nhat',
        'cn',
        'CN',
        'Thứ 8',
        'thu 8',
        '8',
        8,
      ];

      for (const input of sundayInputs) {
        const res = parseDayOfWeek(input);
        expect(res.day).toBeNull();
        expect(res.error).toBeDefined();
        expect(res.error).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
      }
    });

    it('MUST recognize Wednesday inputs without false positive contamination from Saturday', () => {
      const wednesdayInputs = [
        4,
        '4',
        't4',
        'T4',
        'tu',
        'Tu',
        'tư',
        'Tư',
        'Thứ Tư',
        'thứ tư',
        'Thu Tu',
        'thu tu',
        'Thứ 4',
        'thứ 4',
        'Thu 4',
        'thu 4',
        'Wednesday',
        'wednesday',
        'WEDNESDAY',
        'wed',
        'Wed',
      ];

      for (const input of wednesdayInputs) {
        const res = parseDayOfWeek(input);
        expect(res.day).toBe(4);
        expect(res.error).toBeUndefined();
      }
    });

    it('correctly maps all valid school weekdays Monday to Friday (2 to 6)', () => {
      const dayTestCases: Array<{ inputs: any[]; expectedDay: 2 | 3 | 4 | 5 | 6 }> = [
        { inputs: [2, '2', 't2', 'T2', 'Thứ 2', 'thứ 2', 'Thu 2', 'thu 2', 'Thứ Hai', 'thứ hai', 'Monday', 'monday', 'mon'], expectedDay: 2 },
        { inputs: [3, '3', 't3', 'T3', 'Thứ 3', 'thứ 3', 'Thu 3', 'thu 3', 'Thứ Ba', 'thứ ba', 'Tuesday', 'tuesday', 'tue'], expectedDay: 3 },
        { inputs: [4, '4', 't4', 'T4', 'Thứ 4', 'thứ 4', 'Thu 4', 'thu 4', 'Thứ Tư', 'thứ tư', 'Wednesday', 'wednesday', 'wed'], expectedDay: 4 },
        { inputs: [5, '5', 't5', 'T5', 'Thứ 5', 'thứ 5', 'Thu 5', 'thu 5', 'Thứ Năm', 'thứ năm', 'Thursday', 'thursday', 'thu'], expectedDay: 5 },
        { inputs: [6, '6', 't6', 'T6', 'Thứ 6', 'thứ 6', 'Thu 6', 'thu 6', 'Thứ Sáu', 'thứ sáu', 'Friday', 'friday', 'fri'], expectedDay: 6 },
      ];

      for (const { inputs, expectedDay } of dayTestCases) {
        for (const input of inputs) {
          const res = parseDayOfWeek(input);
          expect(res.day).toBe(expectedDay);
          expect(res.error).toBeUndefined();
        }
      }
    });

    it('rejects missing or empty weekday inputs', () => {
      expect(parseDayOfWeek(null).day).toBeNull();
      expect(parseDayOfWeek(undefined).day).toBeNull();
      expect(parseDayOfWeek('').day).toBeNull();
    });
  });

  // =========================================================================
  // DEFECT 4: Period Index Boundary Validation (parsePeriodIndex)
  // =========================================================================
  describe('Defect 4: Period Index Boundary Validation (parsePeriodIndex)', () => {
    it('MUST reject negative period numbers and strings ("Tiết -1", "Ca -5", "-1", -1, -5)', () => {
      const hostileNegativePeriods = [
        'Tiết -1',
        'tiet -1',
        'Ca -5',
        'ca -5',
        '-1',
        '-5',
        '-10',
        -1,
        -5,
        -10,
        '  -2  ',
        'Tiết -8',
      ];

      for (const input of hostileNegativePeriods) {
        const res = parsePeriodIndex(input);
        expect(res.period).toBeNull();
        expect(res.error).toBeDefined();
        expect(res.error).toContain('Tiết học phải từ 1 đến 8');
      }
    });

    it('MUST reject out-of-range positive period indices (0, 9, 10, "Tiết 0", "Tiết 9", "Ca 10")', () => {
      const hostileOutOfRangePeriods = [
        0,
        '0',
        'Tiết 0',
        'Ca 0',
        9,
        '9',
        'Tiết 9',
        'Ca 9',
        10,
        '10',
        'Tiết 10',
        'Ca 10',
        99,
        'Tiết 99',
      ];

      for (const input of hostileOutOfRangePeriods) {
        const res = parsePeriodIndex(input);
        expect(res.period).toBeNull();
        expect(res.error).toBeDefined();
        expect(res.error).toContain('Tiết học phải từ 1 đến 8');
      }
    });

    it('MUST accept valid periods 1 through 8 across various formats', () => {
      for (let p = 1; p <= 8; p++) {
        // Numeric
        expect(parsePeriodIndex(p)).toEqual({ period: p });
        // Clean string
        expect(parsePeriodIndex(`${p}`)).toEqual({ period: p });
        // With Vietnamese prefix "Tiết "
        expect(parsePeriodIndex(`Tiết ${p}`)).toEqual({ period: p });
        expect(parsePeriodIndex(`tiết ${p}`)).toEqual({ period: p });
        // With prefix "Ca "
        expect(parsePeriodIndex(`Ca ${p}`)).toEqual({ period: p });
        expect(parsePeriodIndex(`ca ${p}`)).toEqual({ period: p });
        // With leading/trailing whitespace
        expect(parsePeriodIndex(`  Tiết  ${p}  `)).toEqual({ period: p });
      }
    });

    it('rejects missing or non-numeric period inputs', () => {
      expect(parsePeriodIndex(null).period).toBeNull();
      expect(parsePeriodIndex(undefined).period).toBeNull();
      expect(parsePeriodIndex('').period).toBeNull();
      expect(parsePeriodIndex('abc').period).toBeNull();
      expect(parsePeriodIndex('Tiết học').period).toBeNull();
    });
  });

  // =========================================================================
  // INTEGRATION: Adversarial Schedule Import with Mixed Good/Bad Rows
  // =========================================================================
  describe('Adversarial Schedule Import Validation Integration', () => {
    it('accurately identifies and separates valid schedule rows from hostile rows', () => {
      const testRows = [
        // Valid rows
        { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Toán', teacher: 'msphuonganhums' },
        { dayOfWeek: 'Thứ Tư', periodIndex: 'Tiết 4', classId: '6A1', subject: 'Tin học', teacher: 'mrlinhums' },
        { dayOfWeek: 'Friday', periodIndex: 8, classId: '6A1', subject: 'Sinh hoạt lớp', teacher: 'msphuonganhums' },
        // Invalid rows
        { dayOfWeek: 'Saturday', periodIndex: 1, classId: '6A1', subject: 'Toán' }, // Saturday rejected
        { dayOfWeek: 'Thứ Bảy', periodIndex: 2, classId: '6A1', subject: 'Văn' }, // Thứ Bảy rejected
        { dayOfWeek: 2, periodIndex: 'Tiết -1', classId: '6A1', subject: 'Hóa' }, // Tiết -1 rejected
        { dayOfWeek: 3, periodIndex: 'Ca -5', classId: '6A1', subject: 'Lý' }, // Ca -5 rejected
        { dayOfWeek: 4, periodIndex: 0, classId: '6A1', subject: 'Sử' }, // 0 rejected
        { dayOfWeek: 5, periodIndex: 9, classId: '6A1', subject: 'Địa' }, // 9 rejected
        { dayOfWeek: 'Sunday', periodIndex: 1, classId: '6A1', subject: 'Nhạc' }, // Sunday rejected
      ];

      const report = validateScheduleImport(testRows);
      expect(report.total).toBe(10);
      expect(report.validCount).toBe(3);
      expect(report.errorCount).toBe(7);

      // Verify valid row details
      expect(report.validRows[0].dayOfWeek).toBe(2);
      expect(report.validRows[0].periodIndex).toBe(1);
      expect(report.validRows[1].dayOfWeek).toBe(4);
      expect(report.validRows[1].periodIndex).toBe(4);
      expect(report.validRows[2].dayOfWeek).toBe(6);
      expect(report.validRows[2].periodIndex).toBe(8);

      // Verify invalid rows contain proper error messages
      expect(report.invalidRows[0].errors[0]).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
      expect(report.invalidRows[1].errors[0]).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
      expect(report.invalidRows[2].errors[0]).toContain('Tiết học phải từ 1 đến 8');
      expect(report.invalidRows[3].errors[0]).toContain('Tiết học phải từ 1 đến 8');
      expect(report.invalidRows[4].errors[0]).toContain('Tiết học phải từ 1 đến 8');
      expect(report.invalidRows[5].errors[0]).toContain('Tiết học phải từ 1 đến 8');
      expect(report.invalidRows[6].errors[0]).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
    });
  });
});
