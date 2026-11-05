/**
 * Unit Tests: Excel/CSV Importer & Validation Engine
 * File: src/test/importer.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  stripBom,
  detectCsvDelimiter,
  parseDateValue,
  parseDayOfWeek,
  parsePeriodIndex,
  validateStudentRosterImport,
  validateScheduleImport,
  parseExcelOrCsvFile,
} from '../utils/importer';

describe('UMS Importer & Validation Engine', () => {
  describe('1. CSV Delimiter & UTF-8 BOM Handling', () => {
    it('strips UTF-8 BOM byte marker at start of string', () => {
      const textWithBom = '\uFEFFSTT,MHS,Họ và tên';
      expect(stripBom(textWithBom)).toBe('STT,MHS,Họ và tên');
    });

    it('detects comma delimiter in standard CSV', () => {
      const csv = 'STT,MHS,Họ và tên,Lớp\n1,269029,Vũ Minh Xuân,6A2';
      expect(detectCsvDelimiter(csv)).toBe(',');
    });

    it('detects semicolon delimiter in European/Vietnamese Excel CSV', () => {
      const csv = 'STT;MHS;Họ và tên;Lớp\n1;269029;Vũ Minh Xuân;6A2';
      expect(detectCsvDelimiter(csv)).toBe(';');
    });

    it('detects tab delimiter in TSV files', () => {
      const tsv = 'STT\tMHS\tHọ và tên\tLớp\n1\t269029\tNguyễn Đạt Anh\t6A2';
      expect(detectCsvDelimiter(tsv)).toBe('\t');
    });
  });

  describe('2. Date & Serial Converter', () => {
    it('converts Excel serial number 42189 to ISO date 2015-07-04', () => {
      const res = parseDateValue(42189);
      expect(res.dateStr).toBe('2015-07-04');
      expect(res.error).toBeUndefined();
    });

    it('parses DD/MM/YYYY date strings correctly', () => {
      const res = parseDateValue('04/07/2015');
      expect(res.dateStr).toBe('2015-07-04');
    });

    it('parses YYYY-MM-DD date strings correctly', () => {
      const res = parseDateValue('2015-12-31');
      expect(res.dateStr).toBe('2015-12-31');
    });

    it('flags invalid calendar days like 31/02/2015', () => {
      const res = parseDateValue('31/02/2015');
      expect(res.dateStr).toBeNull();
      expect(res.error).toBeDefined();
    });

    it('flags malformed date strings', () => {
      const res = parseDateValue('not-a-date');
      expect(res.dateStr).toBeNull();
      expect(res.error).toBeDefined();
    });
  });

  describe('3. Schedule Helpers: parseDayOfWeek & parsePeriodIndex', () => {
    it('parses day from numeric and Vietnamese text', () => {
      expect(parseDayOfWeek(2).day).toBe(2);
      expect(parseDayOfWeek('Thứ 2').day).toBe(2);
      expect(parseDayOfWeek('Thứ Hai').day).toBe(2);
      expect(parseDayOfWeek('Thứ 6').day).toBe(6);
      expect(parseDayOfWeek('Friday').day).toBe(6);
    });

    it('flags out of range days (e.g. Sunday or Saturday)', () => {
      expect(parseDayOfWeek(7).day).toBeNull();
      expect(parseDayOfWeek('Chủ nhật').day).toBeNull();
      expect(parseDayOfWeek('Saturday').day).toBeNull();
      expect(parseDayOfWeek('Thứ Bảy').day).toBeNull();
      expect(parseDayOfWeek('bảy').day).toBeNull();
    });

    it('parses period indices between 1 and 8', () => {
      expect(parsePeriodIndex(1).period).toBe(1);
      expect(parsePeriodIndex('Tiết 8').period).toBe(8);
      expect(parsePeriodIndex(8).period).toBe(8);
    });

    it('flags out of range periods (0, 9, or negative strings)', () => {
      expect(parsePeriodIndex(0).period).toBeNull();
      expect(parsePeriodIndex(9).period).toBeNull();
      expect(parsePeriodIndex(-1).period).toBeNull();
      expect(parsePeriodIndex('Tiết -1').period).toBeNull();
      expect(parsePeriodIndex('Ca -5').period).toBeNull();
    });
  });

  describe('4. Student Roster Validation Engine', () => {
    it('validates clean student rows', () => {
      const rows = [
        { stt: 1, mhs: '269398', name: 'Lý Bảo Duy', classId: '6A1', dob: '2015-07-12', gender: 'Nữ' },
        { stt: 2, mhs: '269048', name: 'Đinh Minh Tùng', classId: '6A1', dob: '2015-05-07', gender: 'Nữ' },
      ];
      const report = validateStudentRosterImport(rows);
      expect(report.validCount).toBe(2);
      expect(report.errorCount).toBe(0);
      expect(report.validRows[0].id).toBe('269398');
      expect(report.validRows[0].grade).toBe(6);
    });

    it('detects missing required fields (MHS, Name, ClassId)', () => {
      const rows = [
        { stt: 1, mhs: '', name: 'Nguyễn Văn A', classId: '6A1' },
        { stt: 2, mhs: '269240', name: '', classId: '6A1' },
        { stt: 3, mhs: '269216', name: 'Trần Văn B', classId: '' },
      ];
      const report = validateStudentRosterImport(rows);
      expect(report.errorCount).toBe(3);
      expect(report.invalidRows[0].errors).toContain('Thiếu mã học sinh (MHS)');
      expect(report.invalidRows[1].errors).toContain('Thiếu họ và tên học sinh');
      expect(report.invalidRows[2].errors).toContain('Thiếu thông tin lớp học');
    });

    it('detects duplicate MHS in import batch', () => {
      const rows = [
        { stt: 1, mhs: '269398', name: 'Lý Bảo Duy', classId: '6A1' },
        { stt: 2, mhs: '269398', name: 'Trùng Mã', classId: '6A2' },
      ];
      const report = validateStudentRosterImport(rows);
      expect(report.validCount).toBe(1);
      expect(report.errorCount).toBe(1);
      expect(report.invalidRows[0].errors[0]).toContain('Trùng mã học sinh "269398"');
    });

    it('rejects invalid class IDs not in the 26 UMS classes', () => {
      const rows = [
        { stt: 1, mhs: '269240', name: 'Nguyễn Văn C', classId: '10A1' }, // High school class
      ];
      const report = validateStudentRosterImport(rows);
      expect(report.errorCount).toBe(1);
      expect(report.invalidRows[0].errors[0]).toContain('không hợp lệ');
    });
  });

  describe('5. Schedule Import Validation Engine', () => {
    it('validates clean schedule rows', () => {
      const rows = [
        { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Hoạt động trải nghiệm', teacher: 'msphuonganhums' },
        { dayOfWeek: 2, periodIndex: 2, classId: '6A1', subject: 'Toán học', teacher: 'Đinh Hoài Long' },
      ];
      const report = validateScheduleImport(rows);
      expect(report.validCount).toBe(2);
      expect(report.errorCount).toBe(0);
      expect(report.validRows[1].teacherUsername).toBe('msphuonganhums');
    });

    it('detects missing subject, invalid period, and invalid day', () => {
      const rows = [
        { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: '' },
        { dayOfWeek: 2, periodIndex: 9, classId: '6A1', subject: 'Toán học' },
        { dayOfWeek: 7, periodIndex: 1, classId: '6A1', subject: 'Ngữ văn' },
      ];
      const report = validateScheduleImport(rows);
      expect(report.errorCount).toBe(3);
    });

    it('detects slot collision within the same class schedule', () => {
      const rows = [
        { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Toán học' },
        { dayOfWeek: 2, periodIndex: 1, classId: '6A1', subject: 'Ngữ văn' }, // Duplicate slot
      ];
      const report = validateScheduleImport(rows);
      expect(report.validCount).toBe(1);
      expect(report.errorCount).toBe(1);
      expect(report.invalidRows[0].errors[0]).toContain('Trùng lịch học');
    });
  });

  describe('6. File Type Classification & Schedule Detection', () => {
    it('recognizes schedule CSV with case-insensitive dayOfWeek/periodIndex headers', async () => {
      const csv = 'Thứ,Tiết,Lớp,Môn học,Giáo viên\n2,1,6A1,Toán,msphuonganhums';
      const buffer = new TextEncoder().encode(csv).buffer;
      const file = { name: 'schedule.csv', arrayBuffer: async () => buffer };
      const res = await parseExcelOrCsvFile(file);
      expect(res.type).toBe('schedule');
      expect(res.scheduleRows).toHaveLength(1);
    });

    it('recognizes schedule CSV with direct English headers', async () => {
      const csv = 'dayOfWeek,periodIndex,classId,subject,teacher\n2,1,6A1,Toán,msphuonganhums';
      const buffer = new TextEncoder().encode(csv).buffer;
      const file = { name: 'schedule_en.csv', arrayBuffer: async () => buffer };
      const res = await parseExcelOrCsvFile(file);
      expect(res.type).toBe('schedule');
      expect(res.scheduleRows).toHaveLength(1);
    });
  });
});
