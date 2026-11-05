import { describe, expect, it } from 'vitest';
import { parseQuery } from '../entities';
import { canSeeSchoolStats, computeAttendanceStats, detectStat, formatAttendance, hasSchoolScopeCue, hasStatScopeCue } from '../statsAnswer';
import type { BoardRow } from '../../periodAttendance';
import type { StudentDaily } from '../../studentDaily';

const sizes = { '6A1': 26, '6A2': 26, '6A3': 25 };
let seq = 0;
const stu = (classId: string, p: Partial<StudentDaily>): StudentDaily => ({
  mhs: `HS${++seq}`, studentName: 'HS A', classId, date: '2026-11-05',
  morning: null, afternoon: null, periodAbsences: [], earlyDeparture: null, updatedAt: 0, ...p,
});
const row = (classId: string, checked: boolean, students: StudentDaily[] = []): BoardRow => ({
  classId, hasLogbook: checked, morningChecked: checked, afternoonChecked: false,
  periods: Array(8).fill(null), students, issueCount: students.length,
});
const rows = (): BoardRow[] => [
  row('6A1', true, [stu('6A1', { morning: 'P' }), stu('6A1', { morning: 'K' })]),
  row('6A2', true, [stu('6A2', { periodAbsences: [{ periodIndex: 2, type: 'Late', subject: 'Toán' }] })]),
  row('6A3', false),
];

describe('computeAttendanceStats', () => {
  it('chỉ tính lớp đã điểm danh; lớp chưa liệt kê riêng', () => {
    const s = computeAttendanceStats(rows(), sizes, '2026-11-05', 0, false);
    expect(s).toMatchObject({ classesTotal: 3, classesChecked: 2, enrolledChecked: 52, present: 50, absentP: 1, absentK: 1, late: 1, notChecked: ['6A3'] });
  });
  it('HS vắng 3 tiết P tính 1', () => {
    const p = (i: number) => ({ periodIndex: i, type: 'P' as const, subject: 'Toán' });
    const s = computeAttendanceStats([row('6A1', true, [stu('6A1', { periodAbsences: [p(1), p(2), p(3)] })])], sizes, '2026-11-05', 0, false);
    expect(s.absentP).toBe(1);
    expect(s.present).toBe(26);
  });
});

describe('computeAttendanceStats: lớp thiếu dữ liệu', () => {
  it('lớp chỉ điểm danh chiều → partialChecked, không vào có mặt', () => {
    const r = row('6A2', false);
    r.afternoonChecked = true;
    const s = computeAttendanceStats([row('6A1', true), r], sizes, '2026-11-05', 0, false);
    expect(s).toMatchObject({ classesChecked: 2, enrolledChecked: 26, present: 26, partialChecked: ['6A2'] });
    expect(formatAttendance(s).vi).toContain('Mới điểm danh theo tiết/buổi chiều');
  });
  it('lớp đã điểm danh thiếu sĩ số → missingSize, không in a/0', () => {
    const s = computeAttendanceStats([row('7A1', true)], sizes, '2026-11-05', 0, false);
    expect(s).toMatchObject({ enrolledChecked: 0, present: 0, missingSize: ['7A1'] });
    const vi = formatAttendance(s).vi;
    expect(vi).toContain('Chưa có sĩ số: 7A1');
    expect(vi).not.toContain('/0');
    expect(vi).not.toMatch(/có mặt \d/);
  });
  it('vắng sáng vượt sĩ số → sizeMismatch, không cắt về 0', () => {
    const many = Array.from({ length: 27 }, () => stu('6A1', { morning: 'P' }));
    const s = computeAttendanceStats([row('6A1', true, many)], sizes, '2026-11-05', 0, false);
    expect(s).toMatchObject({ enrolledChecked: 0, sizeMismatch: ['6A1'] });
    expect(formatAttendance(s).vi).toContain('Sĩ số chưa khớp: 6A1');
  });
});

describe('formatAttendance', () => {
  it('toàn trường', () => {
    const { vi, en } = formatAttendance(computeAttendanceStats(rows(), sizes, '2026-11-05', 0, false));
    expect(vi).toContain('2/3 lớp');
    expect(vi).toContain('50/52');
    expect(vi).toContain('Chưa điểm danh');
    expect(en).toContain('2/3 classes');
  });
  it('một lớp', () => {
    const only = rows().filter((r) => r.classId === '6A1');
    const { vi } = formatAttendance(computeAttendanceStats(only, sizes, '2026-11-05', 0, false), '6A1');
    expect(vi).toContain('Lớp 6A1');
    expect(vi).toContain('24/26');
    expect(vi).not.toContain('lớp đã điểm danh');
  });
});

describe('detectStat', () => {
  const today = '2026-11-05';
  it('nhận câu hỏi số liệu', () => {
    expect(detectStat(parseQuery('hôm nay bao nhiêu hs nghỉ học', today))?.id).toBe('attendance');
    expect(detectStat(parseQuery('lớp 9A2 hôm nay vắng mấy bạn', today))).toMatchObject({ classId: '9A2' });
  });
  it('không nhận tra cứu 1 HS', () => {
    expect(detectStat(parseQuery('thông tin bạn Minh Anh', today))).toBeNull();
    expect(detectStat(parseQuery('bạn Minh Anh có đi muộn không', today))).toBeNull();
  });
  it('không nhận câu hướng dẫn không có từ đếm', () => {
    expect(detectStat(parseQuery('xin nghỉ ốm', today))).toBeNull();
    expect(detectStat(parseQuery('học sinh đi muộn thì làm gì', today))).toBeNull();
  });
  it('không nhận câu của gia đình / phép / "mấy giờ"', () => {
    expect(detectStat(parseQuery('con vắng mấy buổi', today))).toBeNull();
    expect(detectStat(parseQuery('nghỉ ốm bhxh còn bao nhiêu', today))).toBeNull();
    expect(detectStat(parseQuery('còn mấy ngày phép', today))).toBeNull();
    expect(detectStat(parseQuery('đi muộn mấy giờ thì bị ghi tên', today))).toBeNull();
  });
  it('"ai" + ngày/lớp là câu hỏi số liệu', () => {
    expect(detectStat(parseQuery('hôm nay ai vắng', today))).toMatchObject({ date: today });
    expect(detectStat(parseQuery('lớp 6A1 hôm nay ai nghỉ', today))).toMatchObject({ classId: '6A1' });
    expect(detectStat(parseQuery('ai vắng', today))).toBeNull();
  });
  it('phạm vi câu hỏi', () => {
    expect(hasStatScopeCue(parseQuery('bao nhiêu hs vắng', today))).toBe(false);
    expect(hasStatScopeCue(parseQuery('hôm nay bao nhiêu hs vắng', today))).toBe(true);
    expect(hasStatScopeCue(parseQuery('lớp tôi vắng mấy bạn', today))).toBe(true);
    expect(hasSchoolScopeCue(parseQuery('hôm nay bao nhiêu hs vắng', today), null)).toBe(false);
    expect(hasSchoolScopeCue(parseQuery('cả trường vắng bao nhiêu', today), null)).toBe(true);
    expect(hasSchoolScopeCue(parseQuery('lớp 7A3 vắng mấy bạn', today), '6A1')).toBe(true);
    expect(hasSchoolScopeCue(parseQuery('lớp 6A1 vắng mấy bạn', today), '6A1')).toBe(false);
  });
});

describe('canSeeSchoolStats', () => {
  it('theo menu /vang-muon', () => {
    for (const r of ['admin', 'giamthi', 'tpt'] as const) expect(canSeeSchoolStats(r)).toBe(true);
    for (const r of ['gvbm', 'gvcn', 'parent', 'student', 'vanphong', 'guest'] as const) expect(canSeeSchoolStats(r)).toBe(false);
  });
});

describe('detectStat — câu trùng chữ khi bỏ dấu (collision corpus)', () => {
  const today = '2026-11-05';
  it.each([
    'Tôi muốn biết có bao nhiêu lớp vào chung kết Got Talent',
    'áo vàng mấy cái',
    'tôi nghĩ có bao nhiêu',
    'ngày phép của tôi còn bao nhiêu',
    'con vắng mấy buổi',
    'Xem con nghỉ học bao nhiêu buổi?',
    'nghỉ ốm bhxh còn bao nhiêu',
    'còn mấy ngày phép',
    'đi muộn mấy giờ thì bị ghi tên',
  ])('KHÔNG phải số liệu: %s', (q) => {
    expect(detectStat(parseQuery(q, today))).toBeNull();
  });
  it.each([
    'Còn bao nhiêu lớp chưa điểm danh?',
    'Hôm nay còn mấy lớp chưa điểm danh',
    'Hôm nay bao nhiêu HS nghỉ có phép?',
    'Hôm nay vắng có phép bao nhiêu?',
    'hom nay bao nhieu hs vang',
    'con bao nhieu lop chua diem danh',
  ])('LÀ số liệu: %s', (q) => {
    expect(detectStat(parseQuery(q, today))?.id).toBe('attendance');
  });
});
