import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { sheetCols, SHEET_HEADER_ROW, buildGradebookSheet, exportFileName, parseGradebookSheet, type ExcelStudent } from '../gradebookExcel';
import { newGradebook, setField, emptyRow, type Gradebook } from '../gradebook';

// Dữ liệu giả — không phải HS thật
const students: ExcelStudent[] = [
  { mhs: '900001', name: 'Học Sinh Một', stt: 1, moetId: '0100000001', dob: '2012-04-08' },
  { mhs: '900002', name: 'Học Sinh Hai', stt: 2 },
  { mhs: '900003', name: 'Trùng Tên', stt: 3 },
  { mhs: '900004', name: 'Trùng Tên', stt: 4 },
];

const gb = (): Gradebook => ({
  ...newGradebook({ year: '2026-2027', classId: '9A3', subjectKey: 'toan', subjectName: 'Toán', mode: 'score', txMin: 2 }, 1),
  rows: { '900001': setField(setField(setField(setField(setField(setField(emptyRow(), 'tx1', 8), 'tx2', 7), 'tx3', 9), 'tx4', 10), 'gk', 7), 'ck', 8.5) },
});

/** Bố cục bản xuất "BẢNG ĐIỂM HỌC KỲ" của CSDL (dòng 1 trống, tiêu đề cột dòng 6–8, dữ liệu từ dòng 9) + cột phụ GV tự thêm. */
const csdlSheet = (data: Array<Array<string | number>>) => [
  [],
  ['Phường X', '', '', '', 'BẢNG ĐIỂM HỌC KỲ'],
  ['Trường: THCS Ngoại Ngữ', '', '', '', 'Năm học: 2026-2027 - Học kỳ: I'],
  ['Lớp: 9A3', '', '', '', 'Môn học: LỊCH SỬ VÀ ĐỊA LÝ'],
  [],
  ['STT', 'Tên lớp', 'Mã định danh Bộ GD&ĐT', 'Họ và tên', 'Ngày sinh', 'ĐĐGtx', '', '', '', '', 'ĐĐGgk', 'ĐĐGck', '', '', '', '', ''],
  [],
  ['', '', '', '', '', 1, 2, 3, 4, 5, '', '', '', 'Sử', 'Địa', 'Trung bình', 'Chốt'],
  ...data,
];

describe('buildGradebookSheet (bố cục CSDL)', () => {
  it('tiêu đề 3 dòng, 4 cột ĐĐGtx (Toán), điểm dạng số, ngày sinh dd/mm/yyyy', () => {
    const { aoa, merges } = buildGradebookSheet(gb(), students);
    const H = SHEET_HEADER_ROW;
    const SHEET_COLS = sheetCols(4);
    expect(aoa[H].slice(0, 11)).toEqual(['STT', 'Tên lớp', 'Mã định danh Bộ GD&ĐT', 'Họ và tên', 'Ngày sinh', 'ĐĐGtx', '', '', '', 'ĐĐGgk', 'ĐĐGck']);
    expect(aoa[H + 2].slice(5, 10)).toEqual([1, 2, 3, 4, '']);
    expect(aoa[3][0]).toBe('Lớp: 9A3');
    expect(aoa[3][4]).toBe('Môn học: TOÁN');
    // (8+7+9+10 + 14 + 25.5)/9 = 73.5/9 = 8,17 → 8,2
    expect(aoa[H + 3]).toEqual([1, '9A3', '0100000001', 'Học Sinh Một', '08/04/2012', 8, 7, 9, 10, 7, 8.5, 8.2, '']);
    expect(aoa).toHaveLength(H + 3 + students.length);
    expect(merges).toContainEqual({ s: { r: H, c: SHEET_COLS.tx }, e: { r: H + 1, c: SHEET_COLS.tx + 3 } });
    expect(exportFileName(gb())).toBe('SoDiem_9A3_toan_HK1_2026-2027.xlsx');
  });
});

describe('parseGradebookSheet', () => {
  it('đọc lại đúng file vừa xuất (vòng tròn qua xlsx)', () => {
    const { aoa, merges } = buildGradebookSheet(gb(), students);
    const H = SHEET_HEADER_ROW;
    const SHEET_COLS = sheetCols(4);
    aoa[H + 4][SHEET_COLS.tx] = 9.5; // HS Hai tx1
    aoa[H + 4][SHEET_COLS.ck] = 6;
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '', blankrows: true });
    const r = parseGradebookSheet(rows, { ...gb(), rows: {} }, students);
    expect(r.error).toBeUndefined();
    expect(r.matched).toBe(4);
    expect(r.rows['900001']).toMatchObject({ tx: [8, 7, 9, 10], gk: 7, ck: 8.5 });
    expect(r.rows['900002']).toMatchObject({ tx: [9.5, null, null, null], ck: 6 });
    expect(r.moetIds).toEqual({ '900001': '0100000001' });
  });

  it('file CSDL có cột phụ: không nhầm "Sử/Địa/Chốt" thành ĐĐGck; liệt kê cột để chọn', () => {
    const rows = csdlSheet([
      [1, '9A3', '0100000001', 'Học Sinh Một', '08/04/2012', '', '', '', '', '', '', '', '', 8.75, 7.5, 8.125, 8],
      [2, '9A3', '', 'Học Sinh Hai', '05/07/2012', '', '', '', '', '', '', '', '', 8, 7.25, 7.625, 7.5],
    ]);
    const r = parseGradebookSheet(rows, { ...gb(), rows: {} }, students);
    expect(r.matched).toBe(2);
    expect(r.used).toEqual({ gk: 10, ck: 11 });
    expect(r.rows['900001']).toMatchObject({ gk: null, ck: null });
    expect(r.columns.filter((c) => c.kind === 'other').map((c) => [c.label, c.filled])).toEqual([
      ['Tên lớp', 2], ['Ngày sinh', 2], ['Sử', 2], ['Địa', 2], ['Trung bình', 2], ['Chốt', 2],
    ]);
  });

  it('GV chọn cột "Chốt" làm ĐĐGgk; điểm 2 chữ số thập phân bị báo sai', () => {
    const rows = csdlSheet([
      [1, '9A3', '0100000001', 'Tên Gõ Khác', '08/04/2012', '', '', '', '', '', '', '', '', 8.75, 7.5, 8.125, 8],
      [2, '9A3', '', 'Học Sinh Hai', '05/07/2012', '', '', '', '', '', '', '', '', 8, 7.25, 7.625, 7.5],
    ]);
    const r = parseGradebookSheet(rows, { ...gb(), rows: {} }, students, { gk: 16 });
    expect(r.used.gk).toBe(16);
    expect(r.rows['900001'].gk).toBe(8); // khớp theo mã định danh dù tên khác
    expect(r.rows['900002'].gk).toBe(7.5);
    const bad = parseGradebookSheet(rows, { ...gb(), rows: {} }, students, { gk: 15 });
    expect(bad.invalid.map((x) => x.value)).toEqual(['8.125', '7.625']);
  });

  it('file 1 dòng tiêu đề; tên trùng không đoán; ô sai bị báo', () => {
    const rows = [
      ['Danh sách điểm'],
      ['STT', 'Mã định danh Bộ GD&ĐT', 'Họ và tên', 'ĐĐGtx1', 'ĐĐGtx2', 'ĐĐGgk', 'ĐĐGck', 'Nhận xét'],
      [1, '0100000001', 'Tên Gõ Sai', 9, '', 8, 12, 'Chăm'],
      [9, '', 'Trùng Tên', 5, '', '', '', ''],
      [3, '', 'Người Lạ', 5, '', '', '', ''],
    ];
    const r = parseGradebookSheet(rows, gb(), students);
    expect(r.rows['900001']).toMatchObject({ tx: [9, 7, 9, 10], gk: 8, ck: 8.5, comment: 'Chăm' });
    expect(r.invalid).toEqual([{ line: 3, name: 'Học Sinh Một', field: 'ck', value: '12' }]);
    expect(r.unmatched.map((u) => u.name)).toEqual(['Trùng Tên', 'Người Lạ']);
  });

  it('môn nhận xét đọc Đ/CĐ', () => {
    const cm = { ...gb(), subjectKey: 'gdtc', mode: 'comment' as const, rows: {} };
    const rows = [['Họ tên', 'ĐĐGtx', '', 'ĐĐGgk', 'ĐĐGck'], ['', 1, 2, '', ''], ['Học Sinh Hai', 'Đ', 'CD', 'Đ', 'x']];
    const r = parseGradebookSheet(rows, cm, students);
    expect(r.rows['900002']).toMatchObject({ tx: ['Đ', 'CĐ'], gk: 'Đ', ck: null });
    expect(r.invalid).toHaveLength(1);
  });

  it('file không có cột Họ tên', () => {
    expect(parseGradebookSheet([['a', 'b']], gb(), students).error).toMatch(/Họ tên/);
  });
});
