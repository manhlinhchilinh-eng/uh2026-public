/**
 * Challenger M4 Iteration 3 Adversarial Verification Test Suite
 * File: src/test/challenger_m4_iter3_adversarial.test.ts
 *
 * Empirical verification of:
 * 1. Day of Week boundary testing (Saturday rejection vs Tuesday/Wednesday normalization)
 * 2. Dot-separated date parsing (DD.MM.YYYY -> YYYY-MM-DD) and invalid calendar detection
 * 3. Real workbook data/UMS_class_list_2026_2027.xlsx import (674/674 valid, 0 errors, 26 classes)
 * 4. Adversarial stress & boundary cases
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseDayOfWeek,
  parseDateValue,
  parsePeriodIndex,
  parseExcelOrCsvFile,
  validateScheduleImport,
  validateStudentRosterImport,
} from '../utils/importer';

describe('CHALLENGER M4_ITER3: Empirical Adversarial Challenge Suite', () => {

  // =========================================================================
  // 1. DAY OF WEEK BOUNDARY TESTING
  // =========================================================================
  describe('1. Day of Week Boundary Testing', () => {
    it('MUST return day: null and error for unaccented and accented Saturday inputs', () => {
      const saturdayCases = [
        'bay',
        'thu bay',
        'Thu Bay',
        'thứ bay',
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
        'THỨ BẢY',
        '  thu bay  ',
        'THU BAY',
      ];

      for (const input of saturdayCases) {
        const res = parseDayOfWeek(input);
        expect(res.day, `Failed on input: "${input}"`).toBeNull();
        expect(res.error, `Error missing on input: "${input}"`).toBeDefined();
        expect(res.error).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
      }
    });

    it('MUST return day: 4 for Wednesday inputs in all variations', () => {
      const wednesdayCases = [
        '4',
        4,
        't4',
        'T4',
        'tu',
        'Tu',
        'TU',
        'thứ tư',
        'Thứ Tư',
        'THỨ TƯ',
        'thu tu',
        'Thu Tu',
        'THU TU',
        'thứ 4',
        'Thứ 4',
        'thu 4',
        'Thu 4',
        'wednesday',
        'Wednesday',
        'WEDNESDAY',
        'wed',
        'Wed',
        'tư',
        'Tư',
        '  thứ tư  ',
      ];

      for (const input of wednesdayCases) {
        const res = parseDayOfWeek(input);
        expect(res.day, `Failed on input: "${input}"`).toBe(4);
        expect(res.error, `Unexpected error on input: "${input}"`).toBeUndefined();
      }
    });

    it('MUST return day: 3 for Tuesday inputs in all variations without Saturday confusion', () => {
      const tuesdayCases = [
        '3',
        3,
        't3',
        'T3',
        'ba',
        'Ba',
        'BA',
        'thứ ba',
        'Thứ Ba',
        'THỨ BA',
        'thu ba',
        'Thu Ba',
        'THU BA',
        'thứ 3',
        'Thứ 3',
        'thu 3',
        'Thu 3',
        'tuesday',
        'Tuesday',
        'TUESDAY',
        'tue',
        'Tue',
        '  thứ ba  ',
      ];

      for (const input of tuesdayCases) {
        const res = parseDayOfWeek(input);
        expect(res.day, `Failed on input: "${input}"`).toBe(3);
        expect(res.error, `Unexpected error on input: "${input}"`).toBeUndefined();
      }
    });

    it('MUST reject Sunday and other weekend/invalid values', () => {
      const invalidCases = [
        'Sunday',
        'sunday',
        'Chủ Nhật',
        'chủ nhật',
        'chu nhat',
        'Chu Nhat',
        'cn',
        'CN',
        '8',
        8,
        'thứ 8',
        'thu 8',
        'Thứ Chủ Nhật',
        'Thứ 0',
        'thứ 1',
        1,
        't1',
        't7',
        't8',
        'invalid_day',
        'thứ chín',
      ];

      for (const input of invalidCases) {
        const res = parseDayOfWeek(input);
        expect(res.day, `Should have rejected input: "${input}"`).toBeNull();
        expect(res.error).toBeDefined();
      }
    });

    it('MUST handle null, undefined, and empty string gracefully', () => {
      expect(parseDayOfWeek(null)).toEqual({ day: null, error: 'Thiếu thông tin thứ trong tuần' });
      expect(parseDayOfWeek(undefined)).toEqual({ day: null, error: 'Thiếu thông tin thứ trong tuần' });
      expect(parseDayOfWeek('')).toEqual({ day: null, error: 'Thiếu thông tin thứ trong tuần' });
      const wsRes = parseDayOfWeek('   ');
      expect(wsRes.day).toBeNull();
      expect(wsRes.error).toBeDefined();
    });
  });

  // =========================================================================
  // 2. DOT-SEPARATED AND GENERAL DATE PARSING
  // =========================================================================
  describe('2. Dot-Separated and General Date Parsing', () => {
    it('MUST parse dot-separated dates into ISO format (YYYY-MM-DD)', () => {
      const testCases = [
        { input: '02.10.2014', expected: '2014-10-02' },
        { input: '04.06.2014', expected: '2014-06-04' },
        { input: '09.09.2014', expected: '2014-09-09' },
        { input: '05.03.2014', expected: '2014-03-05' },
        { input: '2.10.2014', expected: '2014-10-02' },
        { input: '4.6.2014', expected: '2014-06-04' },
        { input: '31.12.2015', expected: '2015-12-31' },
        { input: '01.01.2016', expected: '2016-01-01' },
        { input: '29.02.2024', expected: '2024-02-29' }, // Leap year 2024
      ];

      for (const { input, expected } of testCases) {
        const res = parseDateValue(input);
        expect(res.error, `Unexpected error for "${input}"`).toBeUndefined();
        expect(res.dateStr, `Failed parsing "${input}"`).toBe(expected);
      }
    });

    it('MUST parse slash and hyphen dates identically to dot dates', () => {
      expect(parseDateValue('02/10/2014').dateStr).toBe('2014-10-02');
      expect(parseDateValue('02-10-2014').dateStr).toBe('2014-10-02');
      expect(parseDateValue('2014-10-02').dateStr).toBe('2014-10-02');
      expect(parseDateValue('2014/10/02').dateStr).toBe('2014-10-02');
    });

    it('MUST reject non-existent calendar dates formatted with dots', () => {
      // February 29 in non-leap year
      const nonLeapFeb29 = parseDateValue('29.02.2023');
      expect(nonLeapFeb29.dateStr).toBeNull();
      expect(nonLeapFeb29.error).toContain('Ngày không tồn tại trong lịch');

      // April 31 (April only has 30 days)
      const apr31 = parseDateValue('31.04.2024');
      expect(apr31.dateStr).toBeNull();
      expect(apr31.error).toContain('Ngày không tồn tại trong lịch');

      // June 31
      const jun31 = parseDateValue('31.06.2024');
      expect(jun31.dateStr).toBeNull();
      expect(jun31.error).toContain('Ngày không tồn tại trong lịch');

      // Month out of range (13)
      const badMonth = parseDateValue('15.13.2024');
      expect(badMonth.dateStr).toBeNull();
      expect(badMonth.error).toContain('Ngày tháng không hợp lệ');

      // Day out of range (32)
      const badDay = parseDateValue('32.01.2024');
      expect(badDay.dateStr).toBeNull();
      expect(badDay.error).toContain('Ngày tháng không hợp lệ');
    });

    it('handles Excel numeric serial dates correctly', () => {
      // 41914 corresponds to 2014-10-02 UTC
      const res = parseDateValue(41914);
      expect(res.dateStr).toBe('2014-10-02');
      expect(res.error).toBeUndefined();
    });

    it('handles null and empty date inputs cleanly', () => {
      expect(parseDateValue(null)).toEqual({ dateStr: null });
      expect(parseDateValue(undefined)).toEqual({ dateStr: null });
      expect(parseDateValue('')).toEqual({ dateStr: null });
      expect(parseDateValue('   ')).toEqual({ dateStr: null });
    });
  });

  // =========================================================================
  // 3. REAL WORKBOOK EXTRACTION AND VALIDATION
  // =========================================================================
  describe('3. Real Workbook data/UMS_class_list_2026_2027.xlsx Verification', () => {
    const filePath = path.resolve(__dirname, '../../data/UMS_class_list_2026_2027.xlsx');

    it('verifies workbook exists and parses exactly 674 students across 26 classes', async () => {
      expect(fs.existsSync(filePath)).toBe(true);

      const fileBuffer = fs.readFileSync(filePath);
      const ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
      const mockFile = {
        name: 'UMS_class_list_2026_2027.xlsx',
        arrayBuffer: async () => ab,
      };

      const parseResult = await parseExcelOrCsvFile(mockFile);
      expect(parseResult.type).toBe('students');
      expect(parseResult.studentRows).toBeDefined();
      expect(parseResult.studentRows!.length).toBe(674);

      // Validate roster import
      const report = validateStudentRosterImport(parseResult.studentRows!);

      // Assertions per prompt instructions:
      // 674/674 valid students, 0 error rows
      expect(report.total).toBe(674);
      expect(report.validCount).toBe(674);
      expect(report.errorCount).toBe(0);
      expect(report.invalidRows.length).toBe(0);

      // Verify all 26 classes are represented
      const distinctClasses = new Set(report.validRows.map((r) => r.classId));
      expect(distinctClasses.size).toBe(26);

      // Verify student count per class is 25 or 26
      const classCounts: Record<string, number> = {};
      for (const student of report.validRows) {
        classCounts[student.classId] = (classCounts[student.classId] || 0) + 1;
      }
      for (const [cls, count] of Object.entries(classCounts)) {
        expect(count, `Class ${cls} count unexpected: ${count}`).toBeGreaterThanOrEqual(25);
        expect(count, `Class ${cls} count unexpected: ${count}`).toBeLessThanOrEqual(26);
      }

      // Verify the 5 students with dot-separated birthdates are in validRows
      const dotStudents = report.validRows.filter((s) => ['7A3', '7A4', '7A5'].includes(s.classId));
      const specificDotDates = ['2014-10-02', '2014-06-04', '2014-09-09', '2014-03-05'];
      const foundDates = dotStudents.map((s) => s.dob);
      for (const date of specificDotDates) {
        expect(foundDates.includes(date), `Expected date ${date} to be present in parsed valid students`).toBe(true);
      }
    });
  });

  // =========================================================================
  // 4. PERIOD INDEX & SCHEDULE INTEGRATION STRESS TEST
  // =========================================================================
  describe('4. Period Index & Schedule Integration Stress Test', () => {
    it('verifies boundary periods 1 and 8 pass while 0, 9, negative, and invalid fail', () => {
      // 1 to 8 pass
      for (let p = 1; p <= 8; p++) {
        expect(parsePeriodIndex(p).period).toBe(p);
        expect(parsePeriodIndex(`${p}`).period).toBe(p);
      }

      // Out of bounds fail
      expect(parsePeriodIndex(0).period).toBeNull();
      expect(parsePeriodIndex(9).period).toBeNull();
      expect(parsePeriodIndex(-1).period).toBeNull();
      expect(parsePeriodIndex('0').period).toBeNull();
      expect(parsePeriodIndex('9').period).toBeNull();
      expect(parsePeriodIndex('-1').period).toBeNull();
      expect(parsePeriodIndex('Tiết 0').period).toBeNull();
      expect(parsePeriodIndex('Tiết 9').period).toBeNull();
      expect(parsePeriodIndex('Tiết -1').period).toBeNull();
      expect(parsePeriodIndex('Ca 9').period).toBeNull();
    });

    it('verifies schedule import properly aggregates errors for hostile weekend and out-of-range periods', () => {
      const scheduleRows = [
        // Valid Monday to Friday periods 1 to 8
        { dayOfWeek: 'thứ hai', periodIndex: '1', classId: '6A1', subject: 'Toán' },
        { dayOfWeek: 'thứ ba', periodIndex: '2', classId: '6A1', subject: 'Văn' },
        { dayOfWeek: 'thứ tư', periodIndex: '3', classId: '6A1', subject: 'Anh' },
        { dayOfWeek: 'thứ năm', periodIndex: '4', classId: '6A1', subject: 'Lý' },
        { dayOfWeek: 'thứ sáu', periodIndex: '5', classId: '6A1', subject: 'Hóa' },
        // Hostile Saturday inputs
        { dayOfWeek: 'bay', periodIndex: 1, classId: '6A1', subject: 'Sử' },
        { dayOfWeek: 'thu bay', periodIndex: 2, classId: '6A1', subject: 'Địa' },
        { dayOfWeek: 'Thu Bay', periodIndex: 3, classId: '6A1', subject: 'GDCD' },
        { dayOfWeek: 'thứ bay', periodIndex: 4, classId: '6A1', subject: 'Tin' },
        { dayOfWeek: 'Saturday', periodIndex: 5, classId: '6A1', subject: 'Công nghệ' },
        { dayOfWeek: 'Thứ Bảy', periodIndex: 6, classId: '6A1', subject: 'Thể dục' },
        { dayOfWeek: 'bảy', periodIndex: 7, classId: '6A1', subject: 'Nhạc' },
        // Invalid period indices
        { dayOfWeek: 'thứ ba', periodIndex: 'Tiết 0', classId: '6A1', subject: 'Mỹ thuật' },
        { dayOfWeek: 'thứ ba', periodIndex: 'Tiết 9', classId: '6A1', subject: 'SHL' },
        { dayOfWeek: 'thứ ba', periodIndex: 'Tiết -1', classId: '6A1', subject: 'HĐTN' },
      ];

      const report = validateScheduleImport(scheduleRows);
      expect(report.total).toBe(15);
      expect(report.validCount).toBe(5);
      expect(report.errorCount).toBe(10);
      expect(report.invalidRows.length).toBe(10);

      // Verify that all 7 Saturday rows were rejected for invalid dayOfWeek
      for (let i = 0; i < 7; i++) {
        expect(report.invalidRows[i].errors[0]).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
      }
      // Verify that all 3 invalid period rows were rejected for period
      for (let i = 7; i < 10; i++) {
        expect(report.invalidRows[i].errors[0]).toContain('Tiết học phải từ 1 đến 8');
      }
    });
  });
});
