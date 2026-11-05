/**
 * Challenger M4_2: Adversarial Importer, Date Math & Validation Engine Test Suite
 * File: src/test/challenger_m4_2_adversarial.test.ts
 *
 * This test suite stress-tests and adversarially challenges the Excel/CSV importer,
 * date mathematics, delimiter auto-detection, and validation rules in src/utils/importer.ts:
 * 1. Hostile File & Encoding Testing (UTF-8 BOM, ;, \t, RFC-4180 quotes, Excel serial dates, leap years).
 * 2. Adversarial Student Roster Validation (Duplicate MHS with row numbers, required fields, 26 UMS classes, gender normalization).
 * 3. Adversarial Schedule Validation (Periods 1-8, Days 2-6, slot collision, teacher mapping).
 * 4. Multi-sheet Excel workbook extraction against real data/UMS_class_list_2026_2027.xlsx.
 * 5. Commit & Persistence engine verification.
 * 6. Empirical reproductions of discovered vulnerabilities (Bugs 1-4).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  stripBom,
  detectCsvDelimiter,
  parseCsvRows,
  parseDateValue,
  parseDayOfWeek,
  parsePeriodIndex,
  validateStudentRosterImport,
  validateScheduleImport,
  parseExcelOrCsvFile,
  commitStudentRoster,
  commitSchedule,
} from '../utils/importer';
import { ALL_CLASSES } from '../services/seedService';

describe('CHALLENGER M4_2: Empirical Adversarial Importer & Date Math Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // =========================================================================
  // MISSION 1: Hostile File, Encoding & Delimiter Auto-Detection Testing
  // =========================================================================
  describe('1. Hostile File, Encoding & Delimiter Auto-Detection Testing', () => {
    describe('1.1 UTF-8 Byte Order Mark (BOM) Resilience', () => {
      it('strips UTF-8 BOM character from string without modifying content', () => {
        const withBom = '\uFEFFSTT,MHS,Họ và tên,Lớp';
        const clean = stripBom(withBom);
        expect(clean).toBe('STT,MHS,Họ và tên,Lớp');
        expect(clean.charCodeAt(0)).not.toBe(0xfeff);
      });

      it('leaves clean strings without BOM untouched', () => {
        const withoutBom = 'STT,MHS,Họ và tên,Lớp';
        expect(stripBom(withoutBom)).toBe('STT,MHS,Họ và tên,Lớp');
      });

      it('prevents header corruption when parsing CSV buffer with binary UTF-8 BOM (0xEF, 0xBB, 0xBF)', async () => {
        const bomBytes = new Uint8Array([0xef, 0xbb, 0xbf]);
        const csvContent = 'STT,MHS,Họ và tên,Lớp,Ngày sinh,Giới tính\n1,269029,Vũ Minh Xuân,6A1,2015-07-04,Nam\n2,269963,Trần Thị Mai,6A1,2015-08-15,Nữ';
        const textBytes = new TextEncoder().encode(csvContent);
        const combined = new Uint8Array(bomBytes.length + textBytes.length);
        combined.set(bomBytes, 0);
        combined.set(textBytes, bomBytes.length);

        const mockFile = {
          name: 'students_with_bom.csv',
          arrayBuffer: async () => combined.buffer,
        };

        const result = await parseExcelOrCsvFile(mockFile);
        expect(result.type).toBe('students');
        expect(result.studentRows).toBeDefined();
        expect(result.studentRows!.length).toBe(2);

        // First header must NOT be corrupted with \uFEFF
        const firstRow = result.studentRows![0];
        expect(firstRow).toHaveProperty('stt');
        expect(firstRow.stt).toBe('1');
        expect(firstRow.mhs).toBe('269029');
        expect(firstRow.name).toBe('Vũ Minh Xuân');
        expect(firstRow.classId).toBe('6A1');
      });
    });

    describe('1.2 Delimiter Auto-Detection & RFC-4180 Parsing', () => {
      it('correctly detects standard comma delimiter', () => {
        const csv = 'STT,MHS,Họ và tên,Lớp\n1,269029,Nguyễn Văn A,6A1';
        expect(detectCsvDelimiter(csv)).toBe(',');
      });

      it('correctly detects semicolon delimiter in Vietnamese/European Excel CSV', () => {
        const csv = 'STT;MHS;Họ và tên;Lớp;Ngày sinh\n1;269029;Nguyễn Văn A;6A1;04/07/2015';
        expect(detectCsvDelimiter(csv)).toBe(';');
      });

      it('correctly detects tab delimiter in TSV files', () => {
        const tsv = 'STT\tMHS\tHọ và tên\tLớp\tNgày sinh\n1\t269029\tNguyễn Văn A\t6A1\t04/07/2015';
        expect(detectCsvDelimiter(tsv)).toBe('\t');
      });

      it('does NOT get fooled by commas inside quoted fields in semicolon-delimited CSV', () => {
        const csv =
          'STT;MHS;Họ và tên;Lớp;Địa chỉ\n' +
          '1;269029;Nguyễn Văn A;6A1;"Số 1, Phố Cầu Giấy, Quận Cầu Giấy, Hà Nội"\n' +
          '2;269963;Trần Thị B;6A1;"Phòng 402, Tòa N03, Dịch Vọng Hậu, Hà Nội"';

        expect(detectCsvDelimiter(csv)).toBe(';');

        const rows = parseCsvRows(csv);
        expect(rows.length).toBe(3);
        expect(rows[1][0]).toBe('1');
        expect(rows[1][1]).toBe('269029');
        expect(rows[1][4]).toBe('Số 1, Phố Cầu Giấy, Quận Cầu Giấy, Hà Nội');
      });

      it('does NOT get fooled by commas and semicolons inside quoted fields in TSV', () => {
        const tsv =
          'STT\tMHS\tHọ và tên\tLớp\tGhi chú\n' +
          '1\t269029\tNguyễn Văn A\t6A1\t"Học sinh giỏi; cần chú ý, hỗ trợ thêm"\n' +
          '2\t269963;Trần Thị B\t6A1\t"Đoàn viên, cán bộ lớp"';

        expect(detectCsvDelimiter(tsv)).toBe('\t');
      });

      it('correctly handles RFC-4180 escaped quotes ("")', () => {
        const csv = 'STT,MHS,Họ và tên,Lớp\n1,269029,"Nguyễn ""Bảo"" An",6A1';
        const rows = parseCsvRows(csv);
        expect(rows.length).toBe(2);
        expect(rows[1][2]).toBe('Nguyễn "Bảo" An');
      });

      it('handles mixed CRLF, LF, and CR newlines cleanly', () => {
        const csv = 'STT,MHS,Name\r\n1,269029,A\n2,269963,B\r3,269910,C';
        const rows = parseCsvRows(csv);
        expect(rows.length).toBe(4);
        expect(rows[1][1]).toBe('269029');
        expect(rows[2][1]).toBe('269963');
        expect(rows[3][1]).toBe('269910');
      });
    });

    describe('1.3 Date Mathematics & Leap Year Boundary Stress Testing', () => {
      it('converts Excel serial number 42189 to 2015-07-04', () => {
        const res = parseDateValue(42189);
        expect(res.dateStr).toBe('2015-07-04');
        expect(res.error).toBeUndefined();
      });

      it('truncates fractional serial numbers representing timestamps (e.g. 42189.75)', () => {
        const res = parseDateValue(42189.75);
        expect(res.dateStr).toBe('2015-07-04');
      });

      it('correctly handles leap year 2016 serial dates: Feb 29 and Mar 01', () => {
        // Serial 42429 is 2016-02-29
        const leapDayRes = parseDateValue(42429);
        expect(leapDayRes.dateStr).toBe('2016-02-29');

        // Serial 42430 is 2016-03-01
        const postLeapRes = parseDateValue(42430);
        expect(postLeapRes.dateStr).toBe('2016-03-01');
      });

      it('correctly handles leap year 2020 and 2024 serial dates', () => {
        expect(parseDateValue(43890).dateStr).toBe('2020-02-29');
        expect(parseDateValue(45351).dateStr).toBe('2024-02-29');
      });

      it('rejects out of range Excel serial numbers (< 1000 or > 100000)', () => {
        expect(parseDateValue(999).error).toContain('Số ngày Excel không hợp lệ');
        expect(parseDateValue(0).error).toContain('Số ngày Excel không hợp lệ');
        expect(parseDateValue(-50).error).toContain('Số ngày Excel không hợp lệ');
        expect(parseDateValue(100001).error).toContain('Số ngày Excel không hợp lệ');
      });

      it('parses valid string dates: DD/MM/YYYY, single-digit D/M/YYYY, and YYYY-MM-DD', () => {
        expect(parseDateValue('25/12/2012').dateStr).toBe('2012-12-25');
        expect(parseDateValue('04/07/2015').dateStr).toBe('2015-07-04');
        expect(parseDateValue('4/7/2015').dateStr).toBe('2015-07-04');
        expect(parseDateValue('2015-12-31').dateStr).toBe('2015-12-31');
        expect(parseDateValue('2015/07/04').dateStr).toBe('2015-07-04');
      });

      it('accepts February 29 in leap years (2016, 2020)', () => {
        expect(parseDateValue('29/02/2016').dateStr).toBe('2016-02-29');
        expect(parseDateValue('29/02/2020').dateStr).toBe('2020-02-29');
        expect(parseDateValue('2016-02-29').dateStr).toBe('2016-02-29');
      });

      it('rejects February 29 in non-leap years (2015, 2017, 2018, 2019)', () => {
        const r1 = parseDateValue('29/02/2015');
        expect(r1.dateStr).toBeNull();
        expect(r1.error).toContain('Ngày không tồn tại trong lịch');

        const r2 = parseDateValue('29/02/2019');
        expect(r2.dateStr).toBeNull();
        expect(r2.error).toContain('Ngày không tồn tại trong lịch');
      });

      it('rejects day 31 in 30-day months (April, June, September, November)', () => {
        expect(parseDateValue('31/04/2015').error).toContain('Ngày không tồn tại trong lịch');
        expect(parseDateValue('31/06/2015').error).toContain('Ngày không tồn tại trong lịch');
        expect(parseDateValue('31/09/2015').error).toContain('Ngày không tồn tại trong lịch');
        expect(parseDateValue('31/11/2015').error).toContain('Ngày không tồn tại trong lịch');
      });

      it('rejects impossible days and months (e.g. day 0 or 32, month 0 or 13)', () => {
        expect(parseDateValue('00/05/2015').error).toContain('Ngày tháng không hợp lệ');
        expect(parseDateValue('32/01/2015').error).toContain('Ngày tháng không hợp lệ');
        expect(parseDateValue('15/00/2015').error).toContain('Ngày tháng không hợp lệ');
        expect(parseDateValue('15/13/2015').error).toContain('Ngày tháng không hợp lệ');
      });

      it('rejects malformed text strings and returns null for empty values', () => {
        expect(parseDateValue('not-a-date').error).toContain('Định dạng ngày không hợp lệ');
        expect(parseDateValue('').dateStr).toBeNull();
        expect(parseDateValue(null).dateStr).toBeNull();
        expect(parseDateValue(undefined).dateStr).toBeNull();
      });
    });
  });

  // =========================================================================
  // MISSION 2: Adversarial Student Roster Validation
  // =========================================================================
  describe('2. Adversarial Student Roster Validation (validateStudentRosterImport)', () => {
    describe('2.1 Duplicate MHS Detection with Row Numbers', () => {
      it('MUST report duplicate MHS error with the exact previous row number', () => {
        const rows = [
          { stt: 1, mhs: '269029', name: 'Nguyễn Văn A', classId: '6A1' }, // Row 2
          { stt: 2, mhs: '269963', name: 'Trần Thị B', classId: '6A1' },   // Row 3
          { stt: 3, mhs: '269910', name: 'Lê Văn C', classId: '6A1' },     // Row 4
          { stt: 4, mhs: '269029', name: 'Nguyễn Văn A Fake', classId: '6A2' }, // Row 5 (duplicate of Row 2)
        ];

        const report = validateStudentRosterImport(rows);
        expect(report.validCount).toBe(3);
        expect(report.errorCount).toBe(1);

        const invalidRow = report.invalidRows[0];
        expect(invalidRow.row).toBe(5);
        expect(invalidRow.errors[0]).toBe('Trùng mã học sinh "269029" (đã xuất hiện tại dòng 2)');
      });

      it('detects multiple duplicate occurrences of the same MHS across the file', () => {
        const rows = [
          { stt: 1, mhs: '269029', name: 'A', classId: '6A1' }, // Row 2
          { stt: 2, mhs: '269029', name: 'A2', classId: '6A2' }, // Row 3
          { stt: 3, mhs: '269029', name: 'A3', classId: '6A3' }, // Row 4
        ];

        const report = validateStudentRosterImport(rows);
        expect(report.validCount).toBe(1);
        expect(report.errorCount).toBe(2);
        expect(report.invalidRows[0].row).toBe(3);
        expect(report.invalidRows[0].errors[0]).toContain('đã xuất hiện tại dòng 2');
        expect(report.invalidRows[1].row).toBe(4);
        expect(report.invalidRows[1].errors[0]).toContain('đã xuất hiện tại dòng 2');
      });
    });

    describe('2.2 Missing Required Fields (MHS, Name, ClassId)', () => {
      it('MUST reject rows missing MHS (empty string, null, undefined, or whitespace)', () => {
        const rows = [
          { stt: 1, mhs: '', name: 'Nguyễn Văn A', classId: '6A1' },
          { stt: 2, mhs: '   ', name: 'Trần Văn B', classId: '6A1' },
          { stt: 3, mhs: undefined as unknown as string, name: 'Lê Văn C', classId: '6A1' },
        ];

        const report = validateStudentRosterImport(rows);
        expect(report.errorCount).toBe(3);
        report.invalidRows.forEach((inv) => {
          expect(inv.errors).toContain('Thiếu mã học sinh (MHS)');
        });
      });

      it('MUST reject rows missing student Name', () => {
        const rows = [
          { stt: 1, mhs: '269029', name: '', classId: '6A1' },
          { stt: 2, mhs: '269963', name: '   ', classId: '6A1' },
        ];

        const report = validateStudentRosterImport(rows);
        expect(report.errorCount).toBe(2);
        report.invalidRows.forEach((inv) => {
          expect(inv.errors).toContain('Thiếu họ và tên học sinh');
        });
      });

      it('MUST reject rows missing classId', () => {
        const rows = [
          { stt: 1, mhs: '269029', name: 'Nguyễn Văn A', classId: '' },
          { stt: 2, mhs: '269963', name: 'Trần Văn B', classId: undefined },
        ];

        const report = validateStudentRosterImport(rows);
        expect(report.errorCount).toBe(2);
        report.invalidRows.forEach((inv) => {
          expect(inv.errors).toContain('Thiếu thông tin lớp học');
        });
      });

      it('accumulates multiple errors if row is missing all required fields', () => {
        const rows = [{ stt: 1, mhs: '', name: '', classId: '' }];
        const report = validateStudentRosterImport(rows);
        expect(report.errorCount).toBe(1);
        expect(report.invalidRows[0].errors).toContain('Thiếu mã học sinh (MHS)');
        expect(report.invalidRows[0].errors).toContain('Thiếu họ và tên học sinh');
        expect(report.invalidRows[0].errors).toContain('Thiếu thông tin lớp học');
      });
    });

    describe('2.3 Boundary Enforcement on 26 UMS Classes', () => {
      it('rejects high school, primary school, and imaginary class IDs', () => {
        const hostileClassRows = [
          { stt: 1, mhs: '269572', name: 'Học sinh Cấp 3', classId: '10A1' },
          { stt: 2, mhs: '269950', name: 'Học sinh Cấp 3', classId: '12A5' },
          { stt: 3, mhs: '269094', name: 'Học sinh Tiểu học', classId: '5A1' },
          { stt: 4, mhs: '269123', name: 'Lớp 6A9 (vượt quá 6A8)', classId: '6A9' },
          { stt: 5, mhs: '269849', name: 'Lớp 7A7 (vượt quá 7A6)', classId: '7A7' },
          { stt: 6, mhs: '269518', name: 'Lớp 8A7 (vượt quá 8A6)', classId: '8A7' },
          { stt: 7, mhs: '269838', name: 'Lớp 9A7 (vượt quá 9A6)', classId: '9A7' },
          { stt: 8, mhs: '269846', name: 'Tên lớp bừa bãi', classId: 'UnknownClass' },
        ];

        const report = validateStudentRosterImport(hostileClassRows);
        expect(report.validCount).toBe(0);
        expect(report.errorCount).toBe(8);
        report.invalidRows.forEach((inv) => {
          expect(inv.errors[0]).toContain('không hợp lệ (Trường UMS chỉ có 26 lớp từ 6A1 đến 9A6)');
        });
      });

      it('accepts valid classes case-insensitively and canonicalizes to uppercase', () => {
        const rows = [
          { stt: 1, mhs: '269029', name: 'Em 6A1', classId: '6a1' },
          { stt: 2, mhs: '269963', name: 'Em 9A6', classId: '9a6' },
        ];

        const report = validateStudentRosterImport(rows);
        expect(report.validCount).toBe(2);
        expect(report.validRows[0].classId).toBe('6A1');
        expect(report.validRows[0].grade).toBe(6);
        expect(report.validRows[1].classId).toBe('9A6');
        expect(report.validRows[1].grade).toBe(9);
      });

      it('verifies ALL_CLASSES contains precisely the 26 canonical UMS classes', () => {
        expect(ALL_CLASSES.length).toBe(26);
        expect(ALL_CLASSES).toContain('6A1');
        expect(ALL_CLASSES).toContain('6A8');
        expect(ALL_CLASSES).toContain('7A1');
        expect(ALL_CLASSES).toContain('7A6');
        expect(ALL_CLASSES).toContain('8A1');
        expect(ALL_CLASSES).toContain('8A6');
        expect(ALL_CLASSES).toContain('9A1');
        expect(ALL_CLASSES).toContain('9A6');
      });
    });

    describe('2.4 Adversarial Gender Normalization', () => {
      it('normalizes various male representations to canonical "Nam"', () => {
        const variations = ['nam', 'Nam', 'NAM', 'male', 'Male', 'M', 'm'];
        variations.forEach((g, idx) => {
          const report = validateStudentRosterImport([
            { stt: idx + 1, mhs: `2610${idx}`, name: `Student ${idx}`, classId: '6A1', gender: g },
          ]);
          expect(report.validCount).toBe(1);
          expect(report.validRows[0].gender).toBe('Nam');
        });
      });

      it('normalizes various female representations to canonical "Nữ"', () => {
        const variations = ['nữ', 'Nữ', 'NỮ', 'nu', 'Nu', 'NU', 'female', 'Female', 'F', 'f'];
        variations.forEach((g, idx) => {
          const report = validateStudentRosterImport([
            { stt: idx + 1, mhs: `2620${idx}`, name: `Student ${idx}`, classId: '6A1', gender: g },
          ]);
          expect(report.validCount).toBe(1);
          expect(report.validRows[0].gender).toBe('Nữ');
        });
      });

      it('rejects invalid or ambiguous gender entries with an explicit error', () => {
        const invalidGenders = ['bede', 'other', 'khác', 'x', '123', 'none'];
        invalidGenders.forEach((g, idx) => {
          const report = validateStudentRosterImport([
            { stt: idx + 1, mhs: `2630${idx}`, name: `Student ${idx}`, classId: '6A1', gender: g },
          ]);
          expect(report.errorCount).toBe(1);
          expect(report.invalidRows[0].errors[0]).toContain('Giới tính không hợp lệ');
        });
      });

      it('defaults to "Nam" when gender is empty/unspecified without throwing an error', () => {
        const report = validateStudentRosterImport([
          { stt: 1, mhs: '264001', name: 'Student No Gender', classId: '6A1', gender: undefined },
        ]);
        expect(report.validCount).toBe(1);
        expect(report.validRows[0].gender).toBe('Nam');
      });
    });

    describe('2.5 Middle School Age & Phone Number Validation', () => {
      it('rejects birth years outside reasonable middle school range (2005 - 2020)', () => {
        const rows = [
          { stt: 1, mhs: '269029', name: 'Adult', classId: '6A1', dob: '15/05/1995' },
          { stt: 2, mhs: '269963', name: 'Baby', classId: '6A1', dob: '01/01/2024' },
        ];
        const report = validateStudentRosterImport(rows);
        expect(report.errorCount).toBe(2);
        expect(report.invalidRows[0].errors[0]).toContain('Năm sinh 1995 không hợp lý');
        expect(report.invalidRows[1].errors[0]).toContain('Năm sinh 2024 không hợp lý');
      });

      it('validates and formats parent phone numbers', () => {
        const rows = [
          { stt: 1, mhs: '269029', name: 'A', classId: '6A1', parentPhone: '0912345678' },
          { stt: 2, mhs: '269963', name: 'B', classId: '6A1', parentPhone: '+84987654321' },
          { stt: 3, mhs: '269910', name: 'C', classId: '6A1', parentPhone: '090.123.4567' },
          { stt: 4, mhs: '269398', name: 'D', classId: '6A1', parentPhone: '12345' },
        ];
        const report = validateStudentRosterImport(rows);
        expect(report.validCount).toBe(3);
        expect(report.errorCount).toBe(1);
        expect(report.validRows[2].parentPhone).toBe('0901234567');
        expect(report.invalidRows[0].errors[0]).toContain('Số điện thoại phụ huynh không đúng định dạng');
      });
    });
  });

  // =========================================================================
  // MISSION 3: Adversarial Schedule Import Validation
  // =========================================================================
  describe('3. Adversarial Schedule Validation (validateScheduleImport)', () => {
    describe('3.1 Period Index Range Constraints (1 to 8)', () => {
      it('MUST reject period indices outside 1 to 8 (0, 9, -1, 99)', () => {
        const hostilePeriods = [0, 9, -1, 10, 99];
        hostilePeriods.forEach((p) => {
          const report = validateScheduleImport([
            { dayOfWeek: 2, periodIndex: p, classId: '6A1', subject: 'Toán' },
          ]);
          expect(report.errorCount).toBe(1);
          expect(report.invalidRows[0].errors[0]).toContain('Tiết học phải từ 1 đến 8');
        });
      });

      it('MUST reject string period indicators that evaluate to out-of-range positive numbers', () => {
        const hostileStrPeriods = ['Tiết 0', 'Tiết 9', 'Ca 10'];
        hostileStrPeriods.forEach((p) => {
          const report = validateScheduleImport([
            { dayOfWeek: 2, periodIndex: p, classId: '6A1', subject: 'Toán' },
          ]);
          expect(report.errorCount).toBe(1);
          expect(report.invalidRows[0].errors[0]).toContain('Tiết học phải từ 1 đến 8');
        });
      });

      it('accepts valid periods 1 through 8 in both numeric and string representations', () => {
        for (let p = 1; p <= 8; p++) {
          const rep1 = validateScheduleImport([{ dayOfWeek: 2, periodIndex: p, classId: '6A1', subject: 'Toán' }]);
          expect(rep1.validCount).toBe(1);
          expect(rep1.validRows[0].periodIndex).toBe(p);

          const rep2 = validateScheduleImport([{ dayOfWeek: 3, periodIndex: `Tiết ${p}`, classId: '6A1', subject: 'Văn' }]);
          expect(rep2.validCount).toBe(1);
          expect(rep2.validRows[0].periodIndex).toBe(p);
        }
      });
    });

    describe('3.2 Day of Week Range Constraints (Monday=2 to Friday=6)', () => {
      it('MUST reject weekend days and out-of-range days (1, 7, 8, 0, -1)', () => {
        const hostileDays = [1, 7, 8, 0, -1, 'Chủ nhật', 'Sunday'];
        hostileDays.forEach((d) => {
          const report = validateScheduleImport([
            { dayOfWeek: d, periodIndex: 1, classId: '6A1', subject: 'Toán' },
          ]);
          expect(report.errorCount).toBe(1);
          expect(report.invalidRows[0].errors[0]).toContain('Lịch học UMS chỉ áp dụng từ Thứ 2 đến Thứ 6');
        });
      });

      it('accepts valid days 2 through 6 in multiple linguistic formats', () => {
        const validDays = [
          { input: 2, expected: 2 },
          { input: 'Thứ 2', expected: 2 },
          { input: 'Thứ Hai', expected: 2 },
          { input: 'T2', expected: 2 },
          { input: 'Monday', expected: 2 },
          { input: 3, expected: 3 },
          { input: 'Thứ 3', expected: 3 },
          { input: 'Tuesday', expected: 3 },
          { input: 4, expected: 4 },
          { input: 'Thứ Tư', expected: 4 },
          { input: 'Wednesday', expected: 4 },
          { input: 5, expected: 5 },
          { input: 'Thứ 5', expected: 5 },
          { input: 'Thursday', expected: 5 },
          { input: 6, expected: 6 },
          { input: 'Thứ Sáu', expected: 6 },
          { input: 'Friday', expected: 6 },
        ];

        validDays.forEach(({ input, expected }) => {
          const report = validateScheduleImport([
            { dayOfWeek: input, periodIndex: 1, classId: '6A1', subject: 'Toán' },
          ]);
          expect(report.validCount).toBe(1);
          expect(report.validRows[0].dayOfWeek).toBe(expected);
        });
      });
    });

    describe('3.3 Slot Collision Detection', () => {
      it('MUST report slot collision when two entries target the same class, day, and period', () => {
        const rows = [
          { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Toán học' }, // Row 2
          { dayOfWeek: 2, periodIndex: 2, classId: '6A1', subject: 'Ngữ văn' }, // Row 3
          { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Khoa học tự nhiên' }, // Row 4 (Collides with Row 2)
        ];

        const report = validateScheduleImport(rows);
        expect(report.validCount).toBe(2);
        expect(report.errorCount).toBe(1);

        const invalid = report.invalidRows[0];
        expect(invalid.row).toBe(4);
        expect(invalid.errors[0]).toBe('Trùng lịch học: Lớp 6A1 đã có môn xếp vào Thứ 2 - Tiết 1 tại dòng 2');
      });

      it('does NOT trigger collision for different classes scheduled at the same day & period', () => {
        const rows = [
          { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Toán học' },
          { dayOfWeek: 2, periodIndex: 1, classId: '6A2', subject: 'Ngữ văn' },
          { dayOfWeek: 2, periodIndex: 1, classId: '9A6', subject: 'Tiếng Anh' },
        ];

        const report = validateScheduleImport(rows);
        expect(report.validCount).toBe(3);
        expect(report.errorCount).toBe(0);
      });

      it('does NOT trigger collision for the same class at different periods or different days', () => {
        const rows = [
          { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Toán' },
          { dayOfWeek: 2, periodIndex: 2, classId: '6A1', subject: 'Văn' },
          { dayOfWeek: 3, periodIndex: 1, classId: '6A1', subject: 'Anh' },
        ];

        const report = validateScheduleImport(rows);
        expect(report.validCount).toBe(3);
        expect(report.errorCount).toBe(0);
      });
    });

    describe('3.4 Faculty Resolution & Room Defaults', () => {
      it('resolves teacher by username or exact Vietnamese faculty name', () => {
        const rows = [
          { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Toán', teacher: 'msphuonganhums' },
          { dayOfWeek: 2, periodIndex: 2, classId: '6A1', subject: 'Văn', teacher: 'Đinh Hoài Long' },
          { dayOfWeek: 2, periodIndex: 3, classId: '6A1', subject: 'Sử', teacher: 'Thầy Giáo Mới' },
        ];

        const report = validateScheduleImport(rows);
        expect(report.validCount).toBe(3);
        expect(report.validRows[0].teacherUsername).toBe('msphuonganhums');
        expect(report.validRows[1].teacherUsername).toBe('msphuonganhums');
        expect(report.validRows[1].teacherName).toBe('Đinh Hoài Long');
        expect(report.validRows[2].teacherUsername).toBeUndefined();
        expect(report.validRows[2].teacherName).toBe('Thầy Giáo Mới');
      });

      it('defaults room to P.<classId> if omitted', () => {
        const report = validateScheduleImport([
          { dayOfWeek: 2, periodIndex: 1, classId: '7A3', subject: 'Toán' },
        ]);
        expect(report.validRows[0].room).toBe('P.7A3');
      });
    });
  });

  // =========================================================================
  // MISSION 4: Persistence & Commit Engine Verification
  // =========================================================================
  describe('4. Persistence & Commit Engine Verification', () => {
    it('commits valid student roster into LocalStorage and triggers progress callback', async () => {
      const initialClasses = [
        { id: '6A1', grade: 6, studentCount: 0 },
        { id: '6A2', grade: 6, studentCount: 0 },
      ];
      localStorage.setItem('ums_classes', JSON.stringify(initialClasses));

      const validStudents = [
        {
          id: '269029',
          mhs: '269029',
          stt: 1,
          name: 'Student 1',
          classId: '6A1',
          grade: 6,
          dob: '2015-01-01',
          gender: 'Nam' as const,
          status: 'active' as const,
          createdAt: Date.now(),
        },
        {
          id: '269963',
          mhs: '269963',
          stt: 2,
          name: 'Student 2',
          classId: '6A1',
          grade: 6,
          dob: '2015-02-02',
          gender: 'Nữ' as const,
          status: 'active' as const,
          createdAt: Date.now(),
        },
      ];

      const progressSpy = vi.fn();
      const res = await commitStudentRoster(validStudents, progressSpy);

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(progressSpy).toHaveBeenCalledWith(100);

      const storedStudents = JSON.parse(localStorage.getItem('ums_students') || '[]');
      expect(storedStudents.length).toBe(2);
      expect(storedStudents[0].mhs).toBe('269029');

      const storedClasses = JSON.parse(localStorage.getItem('ums_classes') || '[]');
      const c6A1 = storedClasses.find((c: any) => c.id === '6A1');
      expect(c6A1.studentCount).toBe(2);
    });

    it('commits schedule slots into persistent storage and updates class schedule', async () => {
      const validSchedule = [
        {
          dayOfWeek: 2 as const,
          periodIndex: 1,
          classId: '6A1',
          subject: 'Toán học',
          teacherUsername: 'msphuonganhums',
          teacherName: 'Đinh Hoài Long',
          room: 'P.6A1',
        },
      ];

      const progressSpy = vi.fn();
      const res = await commitSchedule(validSchedule, progressSpy);

      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(progressSpy).toHaveBeenCalledWith(100);
    });
  });

  // =========================================================================
  // MISSION 5: High-Volume Stress & Boundary Harnesses
  // =========================================================================
  describe('5. High-Volume Stress & Boundary Harnesses', () => {
    it('processes 1,000 student rows across 26 classes under 500ms', () => {
      const massiveRows = [];
      for (let i = 1; i <= 1000; i++) {
        const classIdx = (i % 26);
        const classId = ALL_CLASSES[classIdx];
        massiveRows.push({
          stt: i,
          mhs: `STRESS_${String(i).padStart(4, '0')}`,
          name: `Học Sinh Thử Nghiệm ${i}`,
          classId,
          dob: '2015-05-15',
          gender: i % 2 === 0 ? 'Nam' : 'Nữ',
        });
      }

      const t0 = performance.now();
      const report = validateStudentRosterImport(massiveRows);
      const elapsed = performance.now() - t0;

      expect(report.total).toBe(1000);
      expect(report.validCount).toBe(1000);
      expect(report.errorCount).toBe(0);
      expect(elapsed).toBeLessThan(500);
    });

    it('processes 1,040 schedule slots (40 slots x 26 classes) under 500ms', () => {
      const massiveSlots = [];
      for (const classId of ALL_CLASSES) {
        for (let day = 2; day <= 6; day++) {
          for (let period = 1; period <= 8; period++) {
            massiveSlots.push({
              classId,
              dayOfWeek: day,
              periodIndex: period,
              subject: `Môn ${day}_${period}`,
              teacher: 'msphuonganhums',
            });
          }
        }
      }

      expect(massiveSlots.length).toBe(1040);

      const t0 = performance.now();
      const report = validateScheduleImport(massiveSlots);
      const elapsed = performance.now() - t0;

      expect(report.total).toBe(1040);
      expect(report.validCount).toBe(1040);
      expect(report.errorCount).toBe(0);
      expect(elapsed).toBeLessThan(500);
    });
  });

  // =========================================================================
  // MISSION 6: REMEDIATED SPECIFICATIONS & VERIFICATIONS (BUGS 1 TO 4)
  // =========================================================================
  describe('6. Remediated Specifications & Verifications (Bugs 1-4)', () => {
    describe('BUG 1: ArrayBuffer in XLSX.read Multi-Sheet Workbook Extraction', () => {
      it('SPECIFICATION (CRITICAL): official UMS workbook must extract exactly 674 students across 26 classes', async () => {
        const filePath = path.resolve(__dirname, '../../data/UMS_class_list_2026_2027.xlsx');
        const fileBuffer = fs.readFileSync(filePath);
        const mockFile = {
          name: 'UMS_class_list_2026_2027.xlsx',
          arrayBuffer: async () => fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
        };

        const result = await parseExcelOrCsvFile(mockFile);
        expect(result.type).toBe('students');
        expect(result.studentRows!.length).toBe(674);
      });

      it('proves that wrapping ArrayBuffer in new Uint8Array(buffer) successfully extracts all 26 classes and 674 students', () => {
        const filePath = path.resolve(__dirname, '../../data/UMS_class_list_2026_2027.xlsx');
        const fileBuffer = fs.readFileSync(filePath);
        const ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

        // Required fix demonstration:
        const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
        const classSheets = wb.SheetNames.filter((s) => /l[ớo]p\s*([6-9]A[1-8])/i.test(s));
        expect(classSheets.length).toBe(26);

        let totalExtracted = 0;
        for (const sName of classSheets) {
          const raw2D: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sName], { header: 1 });
          for (let r = 6; r < raw2D.length; r++) {
            const row = raw2D[r];
            if (row && row[0] !== undefined && row[0] !== null && row[0] !== '') {
              totalExtracted++;
            }
          }
        }
        expect(totalExtracted).toBe(674);
      });
    });

    describe('BUG 2: Schedule File Type Identification (CamelCase vs Lowercase)', () => {
      it('SPECIFICATION (HIGH): schedule CSV must be recognized as type "schedule"', async () => {
        const csvContent = 'Thứ,Tiết,Lớp,Môn học,Giáo viên\n2,1,6A1,Toán học,msphuonganhums';
        const buffer = new TextEncoder().encode(csvContent).buffer;
        const mockFile = { name: 'schedule.csv', arrayBuffer: async () => buffer };

        const result = await parseExcelOrCsvFile(mockFile);
        expect(result.type).toBe('schedule');
      });

      it('SPECIFICATION (HIGH): single-sheet Excel schedule must be recognized as type "schedule"', async () => {
        const scheduleData = [
          { 'Thứ': 2, 'Tiết': 1, 'Lớp': '6A1', 'Môn học': 'Toán', 'Giáo viên': 'msphuonganhums' },
        ];
        const ws = XLSX.utils.json_to_sheet(scheduleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TKB_6A1');
        const wbBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

        const mockFile = { name: 'tkb.xlsx', arrayBuffer: async () => wbBuffer };
        const result = await parseExcelOrCsvFile(mockFile);
        expect(result.type).toBe('schedule');
      });
    });

    describe('BUG 3: Strict Substring Matching in parseDayOfWeek', () => {
      it('SPECIFICATION (HIGH): parseDayOfWeek must reject "Saturday"', () => {
        const res = parseDayOfWeek('Saturday');
        expect(res.day).toBeNull();
        expect(res.error).toBeDefined();
      });
    });

    describe('BUG 4: Negative Period Index in Text String Bypass', () => {
      it('SPECIFICATION (MEDIUM): parsePeriodIndex must reject "Tiết -1"', () => {
        const res = parsePeriodIndex('Tiết -1');
        expect(res.period).toBeNull();
        expect(res.error).toBeDefined();
      });
    });
  });
});
