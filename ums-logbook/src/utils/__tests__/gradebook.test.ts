import { describe, expect, it } from 'vitest';
import {
  buildAssignmentsFromTimetable,
  classMatrix,
  compactRows,
  diffRows,
  emptyRow,
  gradebookId,
  gradebookProgress,
  mergeAssignments,
  newGradebook,
  nextCell,
  reportId,
  reportSubjectOf,
  setField,
  subjectFromTimetable,
  type GradeAssignment,
  type Gradebook,
} from '../gradebook';
import type { ClassSchedule } from '../../types/schedule';

const sch = (classId: string, slots: Array<[string, string, string?]>): ClassSchedule => ({
  classId,
  academicYear: '2026-2027',
  semester: 1,
  updatedAt: 0,
  slots: slots.map(([subject, teacherName, teacherUsername = ''], i) => ({
    dayOfWeek: 2 + Math.floor(i / 8), periodIndex: (i % 8) + 1, subject, teacherName, teacherUsername,
  })),
});

describe('subjectFromTimetable', () => {
  it('nhận diện tên môn viết tắt trên TKB', () => {
    expect(subjectFromTimetable('Toán')?.key).toBe('toan');
    expect(subjectFromTimetable('Văn')?.key).toBe('ngu_van');
    expect(subjectFromTimetable('Anh')?.key).toBe('ngoai_ngu_1');
    expect(subjectFromTimetable('T.Anh')?.key).toBe('ngoai_ngu_1');
    expect(subjectFromTimetable('Tiếng Nhật')?.key).toBe('ngoai_ngu_2');
    expect(subjectFromTimetable('KHTN-Lý')?.key).toBe('khtn');
    expect(subjectFromTimetable('Hóa')?.key).toBe('khtn');
    expect(subjectFromTimetable('LS&ĐL')?.key).toBe('lich_su_dia_li');
    expect(subjectFromTimetable('Sử')?.key).toBe('lich_su_dia_li');
    expect(subjectFromTimetable('GDCD')?.key).toBe('gdcd');
    expect(subjectFromTimetable('Tin')?.key).toBe('tin_hoc');
    expect(subjectFromTimetable('Thể dục')?.mode).toBe('comment');
    expect(subjectFromTimetable('HĐTN')?.key).toBe('hdtn');
    expect(subjectFromTimetable('Hoạt động trải nghiệm')?.key).toBe('hdtn');
    expect(subjectFromTimetable('GDĐP')?.key).toBe('gddp');
    expect(subjectFromTimetable('Mĩ thuật')?.key).toBe('mi_thuat');
  });
  it('tên môn tiếng Anh trên TKB của trường', () => {
    const k = (s: string) => subjectFromTimetable(s)?.key ?? null;
    expect(k('Maths')).toBe('toan');
    expect(k('Literature')).toBe('ngu_van');
    expect(k('Eng 1')).toBe('ngoai_ngu_1');
    expect(k('Eng 2')).toBe('ngoai_ngu_1');
    expect(k('Foreign language 2')).toBe('ngoai_ngu_2');
    expect(k('N.Sci Bio')).toBe('khtn');
    expect(k('N.Scie Phy')).toBe('khtn');
    expect(k('N.Sci Chem')).toBe('khtn');
    expect(k('S.Sci His')).toBe('lich_su_dia_li');
    expect(k('S.Sci Geo')).toBe('lich_su_dia_li');
    expect(k('Civics')).toBe('gdcd');
    expect(k('Computer Sci')).toBe('tin_hoc');
    expect(k('Technology Edu')).toBe('cong_nghe');
    expect(k('Physical Edu')).toBe('gdtc');
    expect(k('Music')).toBe('am_nhac');
    expect(k('Fine art')).toBe('mi_thuat');
    expect(k('Art')).toBe('mi_thuat');
    expect(k('Homeroom')).toBe('hdtn');
  });
  it('bỏ môn riêng của trường (không có trên CSDL)', () => {
    for (const s of ['UMS maths', 'UMS literature', 'Maths test prep', 'Literature test prep', 'Eng Test prep', 'Native 1', 'Native 2', 'Public Speaking', 'ESL', 'CRC']) {
      expect(subjectFromTimetable(s), s).toBeNull();
    }
  });
  it('bỏ tiết không phải môn học', () => {
    expect(subjectFromTimetable('Chào cờ')).toBeNull();
    expect(subjectFromTimetable('SHL')).toBeNull();
    expect(subjectFromTimetable('Sinh hoạt lớp')).toBeNull();
    expect(subjectFromTimetable('')).toBeNull();
  });
  it('môn lạ vẫn có khóa riêng, mặc định điểm số', () => {
    const s = subjectFromTimetable('STEM Robotics');
    expect(s).toMatchObject({ key: 'stem_robotics', mode: 'score', txMin: 2 });
  });
});

describe('id doc', () => {
  it('ổn định, có năm học và học kì', () => {
    expect(gradebookId('2026-2027', 1, '9A3', 'toan')).toBe('2026-2027_HK1_9A3_toan');
    expect(reportId('2026-2027', 2, '100001')).toBe('2026-2027_HK2_100001');
  });
});

describe('buildAssignmentsFromTimetable', () => {
  const aliases = [
    { uid: 'u1', username: 'gvtoan', displayName: 'GV Toán', aliases: ['Mr.A'] },
    { uid: 'u2', username: 'gvanh', displayName: 'GV Anh', aliases: ['Ms B(Eng)'] },
  ];
  it('gom lớp × môn → GV theo username hoặc tên TKB đã gắn', () => {
    const out = buildAssignmentsFromTimetable(
      {
        '6A1': sch('6A1', [['Toán', 'Mr.A'], ['Toán', 'Mr.A'], ['Anh', 'Ms B(Eng)'], ['Chào cờ', 'Mr.A']]),
        '6A2': sch('6A2', [['Toán', 'Ai đó', 'gvtoan'], ['Văn', 'Cô Chưa Gắn']]),
      },
      aliases,
      '2026-2027'
    );
    expect(out.map((a) => a.id)).toEqual([
      '2026-2027_6A1_ngoai_ngu_1', '2026-2027_6A1_toan', '2026-2027_6A2_ngu_van', '2026-2027_6A2_toan',
    ]);
    expect(out.find((a) => a.id === '2026-2027_6A1_toan')).toMatchObject({ teacherUids: ['u1'], teacherNames: ['GV Toán'] });
    expect(out.find((a) => a.id === '2026-2027_6A2_toan')?.teacherUids).toEqual(['u1']);
    expect(out.find((a) => a.id === '2026-2027_6A2_ngu_van')).toMatchObject({ teacherUids: [], unresolvedNames: ['Cô Chưa Gắn'] });
  });
  it('dựng lại: tên TKB chưa ghép được thì giữ GV đã gán trước', () => {
    const fresh = buildAssignmentsFromTimetable({ '6A2': sch('6A2', [['Văn', 'Cô Chưa Gắn']]) }, aliases, '2026-2027');
    const before: GradeAssignment = { ...fresh[0], teacherUids: ['u5'], teacherNames: ['GV đã gán'], unresolvedNames: [] };
    expect(mergeAssignments(fresh, [before])[0]).toMatchObject({ teacherUids: ['u5'], teacherNames: ['GV đã gán'], source: 'tkb' });
  });
  it('giữ phân công BGH sửa tay', () => {
    const tkb = buildAssignmentsFromTimetable({ '6A1': sch('6A1', [['Toán', 'Mr.A']]) }, aliases, '2026-2027');
    const manual: GradeAssignment = { ...tkb[0], teacherUids: ['u9'], teacherNames: ['GV thay'], source: 'manual' };
    const extra: GradeAssignment = { ...tkb[0], id: 'x', subjectKey: 'stem', source: 'manual' };
    const merged = mergeAssignments(tkb, [manual, extra]);
    expect(merged.map((a) => a.teacherUids)).toEqual([['u9'], tkb[0].teacherUids]);
  });
});

const gbOf = (rows: Gradebook['rows'], mode: 'score' | 'comment' = 'score'): Gradebook => ({
  // Tin học: 2 cột ĐĐGtx, bắt buộc 2 lần
  ...newGradebook({ year: '2026-2027', classId: '6A1', subjectKey: 'tin_hoc', subjectName: 'Tin học', mode, txMin: 2 }, 1),
  rows,
});

describe('diffRows / setField / compactRows', () => {
  it('liệt kê đúng ô đổi', () => {
    const before = { a: setField(emptyRow(), 'tx1', 8) };
    const after = { a: setField(setField(before.a, 'tx1', 9), 'comment', 'Tiến bộ'), b: setField(emptyRow(), 'ck', 7) };
    expect(diffRows(before, after)).toEqual([
      { mhs: 'a', field: 'tx1', from: 8, to: 9 },
      { mhs: 'a', field: 'comment', from: '', to: 'Tiến bộ' },
      { mhs: 'b', field: 'ck', from: null, to: 7 },
    ]);
  });
  it('không đổi → rỗng; bỏ dòng trống', () => {
    const r = { a: setField(emptyRow(), 'gk', 6) };
    expect(diffRows(r, { ...r })).toEqual([]);
    expect(Object.keys(compactRows({ ...r, b: emptyRow() }))).toEqual(['a']);
  });
});

describe('gradebookProgress / classMatrix / reportSubjectOf', () => {
  const full = { tx: [8, 7], gk: 7, ck: 8, comment: 'Tốt' };
  const gb = gbOf({ a: full, b: { tx: [5, null], gk: null, ck: null, comment: '' } });
  it('đếm ô bắt buộc', () => {
    expect(gradebookProgress(gb, ['a', 'b', 'c'])).toEqual({ filled: 5, required: 12, complete: 1 });
  });
  it('ma trận lớp', () => {
    const m = classMatrix([gb], ['a', 'b']);
    // (8+7 + 14 + 24)/7 = 53/7 = 7,57 → 7,6
    expect(m.a.tin_hoc).toEqual({ status: 'ok', avg: 7.6 });
    expect(m.b.tin_hoc.status).toBe('missing');
  });
  it('bản công bố chỉ chứa điểm của 1 HS', () => {
    expect(reportSubjectOf(gb, 'a', 123)).toEqual({
      name: 'Tin học', mode: 'score', tx: [8, 7], gk: 7, ck: 8, result: '7.6', comment: 'Tốt', publishedAt: 123,
    });
    expect(reportSubjectOf(gb, 'zzz', 1).result).toBe('');
  });
});

describe('nextCell', () => {
  it('nhảy cột: đi xuống, hết dòng sang cột kế', () => {
    expect(nextCell(0, 0, 3, 2, 'column')).toEqual([1, 0]);
    expect(nextCell(2, 0, 3, 2, 'column')).toEqual([0, 1]);
    expect(nextCell(2, 1, 3, 2, 'column')).toEqual([2, 1]);
  });
  it('nhảy dòng: sang phải, hết cột xuống dòng', () => {
    expect(nextCell(0, 0, 3, 2, 'row')).toEqual([0, 1]);
    expect(nextCell(0, 1, 3, 2, 'row')).toEqual([1, 0]);
    expect(nextCell(1, 0, 3, 2, 'row', true)).toEqual([0, 1]);
  });
});
