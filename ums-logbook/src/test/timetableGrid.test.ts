import { describe, it, expect } from 'vitest';
import { parseSchoolTimetable, splitSubjectTeacher, attachTeacherAccounts, diffClassSchedule } from '../utils/timetableGrid';

// Mô phỏng đúng bố cục file TKB của trường (tên GV giả)
const header = (cls: string) => [null, cls, null, 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
const rows: unknown[][] = [
  ['26.27. TKB HKI'],
  ['Trường', 'THCS NN'],
  ['Năm học', '2026-2027'],
  header('9A1'),
  [null, 'Sáng', 1, 'Homeroom - Ms A', 'Maths - Ms B', 'Literature - Ms A', 'Maths - Ms B', 'Lit prep - Ms C'],
  [null, null, 2, 'S.Sci His - Ms D', 'Maths - Ms B', '', 'Maths - Ms B', 'Lit prep - Ms C'],
  [null, null, 3, 'Chem - Ms E', 'Eng Test prep - CNN3. M.H', 'His - Ms D', 'Lit - Ms A', 'Lit prep - Ms C'],
  [null, null, 4, 'Chem - Ms E', 'Eng Test prep - CNN3. M.H', 'Art - Mr F', 'Lit - Ms A', 'Foreign language 2 - NN2_4'],
  [null, 'Chiều', 1, 'Eng 1 - Ms G', 'Phy - Ms H', 'Eng 1 - Ms G', 'Geo - Ms.X', 'FL2 - NN2_4'],
  [null, null, 2, 'Eng 1 - Ms G', 'Phy - Ms H', 'Eng 1 - Ms G', 'Geo - Ms.X', 'Maths prep - Ms B'],
  [null, null, 3, 'Eng 1 - Ms G', 'Bio - Ms P.A', 'Eng 1 - Ms G', 'P.E - Mr L(P.E)', 'Maths prep - Ms B'],
  [null, null, 4, 'Computer Sci - Ms N', 'Bio - Ms P.A', 'P.E - Mr L(P.E)', 'Civics - M.L.(Civic)', 'Tự học'],
  header('6a1'),
  [null, 'Sáng', 1, 'Homeroom - Ms P.A', 'Maths - Ms B', null, null, null],
];

describe('Đọc TKB dạng lưới của trường', () => {
  const r = parseSchoolTimetable(rows);

  it('nhận năm học, học kỳ, các lớp (chuẩn hóa chữ hoa)', () => {
    expect(r.academicYear).toBe('2026-2027');
    expect(r.semester).toBe(1);
    expect(Object.keys(r.classes).sort()).toEqual(['6A1', '9A1']);
  });

  it('Sáng 1–4 → tiết 1–4; Chiều 1–4 → tiết 5–8; ô trống bỏ qua', () => {
    const s = r.classes['9A1'];
    expect(s).toHaveLength(39); // 40 ô, 1 ô trống
    expect(s.find((x) => x.dayOfWeek === 2 && x.periodIndex === 1)).toMatchObject({ subject: 'Homeroom', teacherName: 'Ms A' });
    expect(s.find((x) => x.dayOfWeek === 3 && x.periodIndex === 7)).toMatchObject({ subject: 'Bio', teacherName: 'Ms P.A' });
    expect(s.find((x) => x.dayOfWeek === 6 && x.periodIndex === 8)).toMatchObject({ subject: 'Tự học', teacherName: '' });
    expect(s.some((x) => x.dayOfWeek === 4 && x.periodIndex === 2)).toBe(false);
    expect(r.classes['6A1']).toHaveLength(2);
  });

  it('cảnh báo ô thiếu tên GV', () => {
    expect(r.warnings.join('\n')).toMatch(/9A1 Thứ 6 tiết 8: "Tự học" không có tên GV/);
  });

  it('tách môn/GV ở dấu " - " cuối cùng', () => {
    expect(splitSubjectTeacher('Eng Test prep - CNN3. M.H')).toEqual({ subject: 'Eng Test prep', teacherName: 'CNN3. M.H' });
    expect(splitSubjectTeacher('Văn - Tiếng Việt - Ms A')).toEqual({ subject: 'Văn - Tiếng Việt', teacherName: 'Ms A' });
    expect(splitSubjectTeacher('  Toán  ')).toEqual({ subject: 'Toán', teacherName: '' });
  });

  it('gắn tài khoản GV theo tên trên TKB (không phân biệt hoa/thường, khoảng trắng)', () => {
    const out = attachTeacherAccounts(r.classes['6A1'], new Map([['ms  p.a', 'msphuonganhums']]));
    expect(out[0].teacherUsername).toBe('msphuonganhums');
    expect(out[1].teacherUsername).toBe('');
  });

  it('so sánh với TKB đang dùng', () => {
    const now = r.classes['6A1'];
    const old = [{ ...now[0], teacherName: 'Ms Q' }, { dayOfWeek: 5, periodIndex: 5, subject: 'Art', teacherName: 'Mr F', teacherUsername: '' }];
    expect(diffClassSchedule(old, now)).toEqual({ changed: 1, added: 1, removed: 1, total: 3 });
    expect(diffClassSchedule(now, now).total).toBe(0);
  });

  it('cảnh báo lớp lặp lại', () => {
    const r2 = parseSchoolTimetable([header('7A1'), [null, 'Sáng', 1, 'A - B'], header('7A1'), [null, 'Sáng', 1, 'C - D']]);
    expect(r2.warnings.join()).toMatch(/7A1 xuất hiện nhiều lần/);
    expect(r2.classes['7A1'][0].subject).toBe('C');
  });
});

import { listScheduleChanges, carryTeacherAccounts, describeChange, effectiveDateFromFileName, buildClassNotice, buildAdminNotice } from '../utils/timetableGrid';

describe('Thay đổi TKB & bản tin', () => {
  const slot = (d: number, p: number, subject: string, teacherName: string, teacherUsername = '') => ({ dayOfWeek: d, periodIndex: p, subject, teacherName, teacherUsername });
  const old = [slot(2, 1, 'Maths', 'Ms B', 'msb'), slot(2, 2, 'Lit', 'Ms A'), slot(3, 5, 'Art', 'Mr F')];
  const now = [slot(2, 1, 'Maths', 'Ms B'), slot(2, 2, 'Lit', 'Ms C'), slot(4, 1, 'Bio', 'Ms P')];

  it('liệt kê đúng tiết đổi / thêm / bỏ, theo thứ tự ngày–tiết', () => {
    const ch = listScheduleChanges(old, now);
    expect(ch.map(describeChange)).toEqual([
      'Thứ 2 – tiết 2: Lit (Ms A) → Lit (Ms C)',
      'Thứ 3 – tiết 5: Art (Mr F) → trống',
      'Thứ 4 – tiết 1: trống → Bio (Ms P)',
    ]);
  });

  it('giữ tài khoản GV cũ khi tên trên TKB không đổi', () => {
    expect(carryTeacherAccounts(now, old)[0].teacherUsername).toBe('msb');
    expect(carryTeacherAccounts(now, old)[1].teacherUsername).toBe('');
  });

  it('đọc ngày áp dụng từ tên file', () => {
    expect(effectiveDateFromFileName('TKB 12_10 VER2.xls')).toBe('12/10');
    expect(effectiveDateFromFileName('Copy of tkb 21_09 .xls')).toBe('21/09');
    expect(effectiveDateFromFileName('tkb-moi.xlsx')).toBeNull();
  });

  it('bản tin lớp & bản tổng hợp cho BGH', () => {
    const ch = listScheduleChanges(old, now);
    const c = buildClassNotice('6A1', ch, '12/10');
    expect(c.title).toBe('Lớp 6A1: thời khóa biểu thay đổi 3 tiết từ 12/10');
    expect(c.body).toContain('• Thứ 4 – tiết 1: trống → Bio (Ms P)');
    const a = buildAdminNotice({ '6A1': ch, '6A2': [] }, 26, '12/10');
    expect(a.title).toBe('Cập nhật TKB từ 12/10: 3 tiết thay đổi ở 1/26 lớp');
    expect(a.body).toContain('• 6A1: 3 tiết — Thứ 2 T2, Thứ 3 T5, Thứ 4 T1');
    expect(a.body).toContain('4 GV liên quan: Mr F, Ms A, Ms C, Ms P.');
  });
});

import { filterInboxForRole } from '../utils/announcements';

describe('Hộp thư: thông báo TKB theo lớp không làm ngập hộp thư nhân sự', () => {
  const mk = (id: string, classId: string | null, toStaff: boolean, kind?: 'schedule_change') =>
    ({ id, classId, kind, audience: { toStaff, toParents: !toStaff, toStudents: !toStaff, classId } }) as any;
  const items = [mk('tong', null, true, 'schedule_change'), mk('6A1', '6A1', false, 'schedule_change'), mk('6A2', '6A2', false, 'schedule_change'), mk('khac', '6A2', false)];
  const ids = (xs: any[]) => xs.map((x) => x.id);

  it('BGH/GVBM chỉ thấy bản tổng hợp; GVCN thấy thêm bản lớp mình; PH/HS giữ nguyên', () => {
    expect(ids(filterInboxForRole(items, 'admin'))).toEqual(['tong', 'khac']);
    expect(ids(filterInboxForRole(items, 'gvcn', '6A1'))).toEqual(['tong', '6A1', 'khac']);
    expect(ids(filterInboxForRole(items, 'parent', '6A1'))).toEqual(ids(items));
  });
});
