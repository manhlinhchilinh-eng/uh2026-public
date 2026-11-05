/**
 * Số cột ĐĐGtx theo môn + công thức ĐTBmhk, đối chiếu ảnh mẫu học bạ người dùng gửi 05/11/2026
 * (TT | Môn học | ĐĐGtx (n cột) | ĐĐGgk | ĐĐGck | ĐTBmhk). Điểm trong test = điểm trên ảnh mẫu, không gắn với HS thật.
 */
import { describe, expect, it } from 'vitest';
import { termResult, termResultText, isLowResult, type GradeValue } from '../gradeCalc';
import {
  SUBJECTS,
  compareSubjects,
  emptyRow,
  gradeFields,
  newGradebook,
  normalizeRow,
  reportSubjectOf,
  rowResult,
  setField,
  subjectFromTimetable,
  txSpecOf,
  diffRows,
  type Gradebook,
} from '../gradebook';
import { buildGradebookSheet, parseGradebookSheet, sheetCols } from '../gradebookExcel';

type Row = { key: string; tx: GradeValue[]; gk: GradeValue; ck: GradeValue; expected: string };
/** Ảnh mẫu: 13 môn theo đúng thứ tự TT. */
const SAMPLE: Row[] = [
  { key: 'toan', tx: [10, 10, 10, 10], gk: 10, ck: 9.5, expected: '9,8' },
  { key: 'ngu_van', tx: [9, 9, 10, 10], gk: 8, ck: 9, expected: '9' },
  { key: 'ngoai_ngu_1', tx: [10, 10, 10, 10], gk: 8.9, ck: 8.5, expected: '9,3' },
  { key: 'ngoai_ngu_2', tx: [9, 10, 10, 10], gk: 9.5, ck: 9.6, expected: '9,6' },
  { key: 'gdcd', tx: [10, 9.5], gk: 8, ck: 9.5, expected: '9,1' },
  { key: 'cong_nghe', tx: [10, 10, 10], gk: 10, ck: 10, expected: '10' },
  { key: 'tin_hoc', tx: [9, 10], gk: 10, ck: 10, expected: '9,9' },
  { key: 'khtn', tx: [10, 9.5, 10, 10], gk: 8, ck: 9.5, expected: '9,3' },
  { key: 'lich_su_dia_li', tx: [10, 10, 10, 10], gk: 9, ck: 8.5, expected: '9,3' },
  { key: 'gdtc', tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', expected: 'Đ' },
  { key: 'am_nhac', tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', expected: 'Đ' },
  { key: 'mi_thuat', tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', expected: 'Đ' },
  { key: 'hdtn', tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', expected: 'Đ' },
  { key: 'gddp', tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', expected: 'Đ' },
];

const book = (key: string, rows: Gradebook['rows'] = {}, storedTxMin = 4): Gradebook => {
  const def = SUBJECTS.find((s) => s.key === key)!;
  return { ...newGradebook({ year: '2026-2027', classId: '9A3', subjectKey: key, subjectName: def.name, mode: def.mode, txMin: storedTxMin }, 1), rows };
};

describe('số cột ĐĐGtx theo môn (mẫu học bạ)', () => {
  it('Toán/Văn/NN1/NN2/KHTN/LS&ĐL 4 · Công nghệ 3 · GDCD/Tin 2 · môn nhận xét 2', () => {
    const slots = Object.fromEntries(SUBJECTS.map((s) => [s.key, txSpecOf({ subjectKey: s.key }).txSlots]));
    expect(slots).toEqual({
      toan: 4, ngu_van: 4, ngoai_ngu_1: 4, ngoai_ngu_2: 4, gdcd: 2, cong_nghe: 3, tin_hoc: 2, khtn: 4, lich_su_dia_li: 4,
      gdtc: 2, am_nhac: 2, mi_thuat: 2, hdtn: 2, gddp: 2,
    });
    for (const s of SUBJECTS) expect(s.txMin).toBe(s.txSlots);
    expect(SUBJECTS.filter((s) => s.mode === 'comment').map((s) => s.key)).toEqual(['gdtc', 'am_nhac', 'mi_thuat', 'hdtn', 'gddp']);
  });

  it('txMin đã lưu trên Firestore trước 05/11 (CN 2, GDTC 3, HĐTN 4) không còn quyết định số cột/số lần bắt buộc', () => {
    expect(txSpecOf({ subjectKey: 'cong_nghe', txMin: 2 })).toEqual({ txSlots: 3, txMin: 3 });
    expect(txSpecOf({ subjectKey: 'gdtc', txMin: 3 })).toEqual({ txSlots: 2, txMin: 2 });
    expect(txSpecOf({ subjectKey: 'hdtn', txMin: 4 })).toEqual({ txSlots: 2, txMin: 2 });
    // Môn lạ (BGH tự thêm): dùng txMin đã lưu
    expect(txSpecOf({ subjectKey: 'stem', txMin: 3 })).toEqual({ txSlots: 3, txMin: 3 });
    expect(newGradebook({ year: 'y', classId: '6A1', subjectKey: 'cong_nghe', subjectName: 'CN', mode: 'score', txMin: 2 }, 1).txMin).toBe(3);
  });

  it('thứ tự môn như học bạ', () => {
    const shuffled = [...SUBJECTS].reverse().map((s) => ({ key: s.key, name: s.name }));
    expect(shuffled.sort(compareSubjects).map((s) => s.key)).toEqual(SAMPLE.map((r) => r.key));
  });

  it('các ô của dòng điểm theo số cột', () => {
    expect(gradeFields(3)).toEqual(['tx1', 'tx2', 'tx3', 'gk', 'ck', 'comment']);
    expect(emptyRow(2).tx).toEqual([null, null]);
  });
});

describe('ĐTBmhk = (ΣĐĐGtx + 2·ĐĐGgk + 3·ĐĐGck) / (số ĐĐGtx + 5), làm tròn 1 chữ số', () => {
  it.each(SAMPLE)('$key → $expected (khớp ảnh mẫu)', ({ key, tx, gk, ck, expected }) => {
    const gb = book(key, { hs: { tx, gk, ck, comment: '' } });
    expect(termResultText(rowResult(gb, gb.rows.hs))).toBe(expected);
  });

  it('chưa đủ số cột ĐĐGtx của môn → chưa tính (Toán 3/4)', () => {
    const r = rowResult(book('toan'), { tx: [10, 10, 10, null], gk: 10, ck: 10, comment: '' });
    expect(r).toEqual({ status: 'missing', missing: ['ĐĐGtx (3/4)'] });
  });

  it('môn nhận xét: Đ khi đạt, CĐ khi chưa đạt; bản công bố ghi Đ/CĐ', () => {
    expect(termResultText(termResult({ tx: ['Đ', 'CĐ'], gk: 'Đ', ck: 'Đ' }, 'comment', 2))).toBe('CĐ');
    const gb = book('gdtc', { a: { tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', comment: '' } });
    expect(reportSubjectOf(gb, 'a', 1)).toMatchObject({ tx: ['Đ', 'Đ'], result: 'Đ' });
    expect(isLowResult('CĐ')).toBe(true);
    expect(isLowResult('Chưa đạt')).toBe(true);
    expect(isLowResult('4.9')).toBe(true);
    expect(isLowResult('5')).toBe(false);
    expect(isLowResult('Đ')).toBe(false);
  });
});

describe('sổ cũ 5 cột ĐĐGtx — không mất điểm', () => {
  it('ô ngoài số cột của môn có điểm thì giữ lại; ô trống thì cắt', () => {
    expect(normalizeRow({ tx: [8, 7, null, null, null] }, 2).tx).toEqual([8, 7]);
    expect(normalizeRow({ tx: [8, 7, null, null, 6] }, 2).tx).toEqual([8, 7, null, null, 6]);
    expect(setField({ tx: [8, 7], gk: null, ck: null, comment: '' }, 'tx2', 9).tx).toEqual([8, 9]);
  });
  it('lịch sử sửa so được dòng 5 ô với dòng 2 ô', () => {
    const before = { a: { tx: [8, 7, null, null, null], gk: null, ck: null, comment: '' } };
    const after = { a: { tx: [8, 9], gk: null, ck: null, comment: '' } };
    expect(diffRows(before, after)).toEqual([{ mhs: 'a', field: 'tx2', from: 7, to: 9 }]);
  });
});

describe('Excel theo số cột của môn', () => {
  const students = [{ mhs: '900001', name: 'Học Sinh Một', stt: 1 }];
  it('Công nghệ xuất 3 cột ĐĐGtx; GDCD 2 cột; ĐTBmhk đúng', () => {
    const cn = book('cong_nghe', { '900001': { tx: [10, 10, 10], gk: 10, ck: 10, comment: '' } });
    const { aoa } = buildGradebookSheet(cn, students);
    const C = sheetCols(3);
    expect(aoa[7].slice(C.tx, C.gk)).toEqual([1, 2, 3]);
    expect(aoa[5][C.gk]).toBe('ĐĐGgk');
    expect(aoa[8][C.avg]).toBe(10);
    const gdcd = book('gdcd', { '900001': { tx: [10, 9.5], gk: 8, ck: 9.5, comment: '' } });
    const g = buildGradebookSheet(gdcd, students).aoa;
    expect(g[8].slice(5, 10)).toEqual([10, 9.5, 8, 9.5, 9.1]);
  });
  it('môn nhận xét xuất ĐTBmhk = Đ', () => {
    const tc = book('gdtc', { '900001': { tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', comment: '' } });
    const C = sheetCols(2);
    expect(buildGradebookSheet(tc, students).aoa[8][C.avg]).toBe('Đ');
  });
  it('file CSDL 5 cột ĐĐGtx nhập vào môn 2 cột: cột thừa có điểm bị báo, không nhập', () => {
    const rows = [
      ['Họ và tên', 'ĐĐGtx', '', '', '', '', 'ĐĐGgk', 'ĐĐGck'],
      ['', 1, 2, 3, 4, 5, '', ''],
      ['Học Sinh Một', 9, 8, 7, '', '', 8, 9],
    ];
    const r = parseGradebookSheet(rows, { ...book('tin_hoc'), rows: {} }, students);
    expect(r.rows['900001']).toMatchObject({ tx: [9, 8], gk: 8, ck: 9 });
    expect(r.invalid).toEqual([{ line: 3, name: 'Học Sinh Một', field: 'tx3', value: '7' }]);
  });
});

describe('tên môn tiếng Anh trên TKB thật (bản backup 05/11) → môn sổ điểm', () => {
  it('đủ 28 tên môn đang dùng', () => {
    const k = (s: string) => subjectFromTimetable(s)?.key ?? null;
    const map = Object.fromEntries(
      ['Art', 'CRC', 'Civics', 'Computer Sci', 'ESL', 'Eng 1', 'Eng 2', 'Eng Test prep', 'Fine art', 'Foreign language 2', 'Homeroom',
        'Literature', 'Literature test prep', 'Maths', 'Maths test prep', 'Music', 'N.Sci Bio', 'N.Sci Chem', 'N.Scie Phy', 'Native 1',
        'Native 2', 'Physical Edu', 'Public Speaking', 'S.Sci Geo', 'S.Sci His', 'Technology Edu', 'UMS literature', 'UMS maths'].map((s) => [s, k(s)])
    );
    expect(map).toEqual({
      Art: 'mi_thuat', CRC: null, Civics: 'gdcd', 'Computer Sci': 'tin_hoc', ESL: null, 'Eng 1': 'ngoai_ngu_1', 'Eng 2': 'ngoai_ngu_1',
      'Eng Test prep': null, 'Fine art': 'mi_thuat', 'Foreign language 2': 'ngoai_ngu_2', Homeroom: 'hdtn', Literature: 'ngu_van',
      'Literature test prep': null, Maths: 'toan', 'Maths test prep': null, Music: 'am_nhac', 'N.Sci Bio': 'khtn', 'N.Sci Chem': 'khtn',
      'N.Scie Phy': 'khtn', 'Native 1': null, 'Native 2': null, 'Physical Edu': 'gdtc', 'Public Speaking': null, 'S.Sci Geo': 'lich_su_dia_li',
      'S.Sci His': 'lich_su_dia_li', 'Technology Edu': 'cong_nghe', 'UMS literature': null, 'UMS maths': null,
    });
  });
});
