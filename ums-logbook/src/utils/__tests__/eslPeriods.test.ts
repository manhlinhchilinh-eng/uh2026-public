import { describe, expect, it } from 'vitest';
import {
  buildEslRecord,
  isEnglishSubject,
  normalizeEslTag,
  parseEslConfig,
  validateEslTag,
} from '../eslPeriods';

describe('cấu hình ESL', () => {
  it('mặc định TẮT khi chưa có cấu hình (chờ BGH duyệt)', () => {
    expect(parseEslConfig(null)).toEqual({ enabled: false, option: 'choice' });
    expect(parseEslConfig({ enabled: 'yes' as unknown as boolean }).enabled).toBe(false);
  });
  it('đọc đúng phương án', () => {
    expect(parseEslConfig({ enabled: true, option: 'clil' })).toMatchObject({ enabled: true, option: 'clil' });
    expect(parseEslConfig({ enabled: true, option: 'xyz' as never }).option).toBe('choice');
  });
});

describe('normalizeEslTag', () => {
  const full = { level: 'partial' as const, option: 'clil' as const, objective: '  Describe a process ', strategies: ['frames', 'frames', 'bogus'], evidenceUrl: 'https://drive.google.com/x' };
  it('phương án A bỏ các trường của B', () => {
    expect(normalizeEslTag(full, 'quick')).toEqual({ level: 'partial', option: 'quick' });
  });
  it('phương án B giữ trường hợp lệ, bỏ trùng/lạ', () => {
    expect(normalizeEslTag(full, 'clil')).toEqual({
      level: 'partial',
      option: 'clil',
      objective: 'Describe a process',
      strategies: ['frames'],
      evidenceUrl: 'https://drive.google.com/x',
    });
  });
  it('bỏ link không phải https', () => {
    expect(normalizeEslTag({ ...full, evidenceUrl: 'javascript:alert(1)' }, 'clil')?.evidenceUrl).toBeUndefined();
  });
  it('không có tag / mức lạ → null', () => {
    expect(normalizeEslTag(null, 'quick')).toBeNull();
    expect(normalizeEslTag({ level: 'x' as never, option: 'quick' }, 'quick')).toBeNull();
  });
});

describe('validateEslTag', () => {
  it('B bắt buộc mục tiêu ngôn ngữ, A thì không', () => {
    expect(validateEslTag({ level: 'full', option: 'quick' }, 'quick')).toBeNull();
    expect(validateEslTag({ level: 'full', option: 'clil' }, 'clil')).toMatch(/mục tiêu ngôn ngữ/);
    expect(validateEslTag({ level: 'full', option: 'clil', objective: 'Compare fractions' }, 'clil')).toBeNull();
  });
  it('tiết không đánh dấu ESL luôn hợp lệ', () => {
    expect(validateEslTag(null, 'clil')).toBeNull();
  });
});

describe('buildEslRecord', () => {
  it('tách lớp + ngày từ dailyId', () => {
    const r = buildEslRecord(
      { dailyId: '8A3_2026-10-22', periodIndex: 3, subject: 'Toán', teacherId: 'gv1', teacherName: 'GV 1' },
      { level: 'elements', option: 'quick' },
      '2026-2027',
      123
    );
    expect(r).toMatchObject({ id: '8A3_2026-10-22_3', classId: '8A3', date: '2026-10-22', academicYear: '2026-2027', level: 'elements' });
    expect('objective' in r).toBe(false);
  });
});

describe('isEnglishSubject', () => {
  it('nhận ra môn tiếng Anh/ngoại ngữ', () => {
    for (const s of ['Tiếng Anh', 'Eng 1', 'English', 'Ngoại ngữ 2', 'NN2', 'IELTS']) expect(isEnglishSubject(s)).toBe(true);
    for (const s of ['Toán', 'Khoa học tự nhiên', 'Lịch sử và Địa lí', 'Engineering']) expect(isEnglishSubject(s)).toBe(false);
  });
});

describe('summarizeEslByClass', () => {
  it('đếm theo lớp, bỏ môn tiếng Anh, đánh dấu lớp đạt 35 tiết', async () => {
    const { summarizeEslByClass } = await import('../eslPeriods');
    const rows = [
      ...Array.from({ length: 35 }, (_, i) => ({ classId: '6A1', subject: i % 2 ? 'Toán' : 'KHTN', teacherId: i % 2 ? 'a' : 'b' })),
      { classId: '7A2', subject: 'Toán', teacherId: 'a' },
      { classId: '7A2', subject: 'Tiếng Anh', teacherId: 'c' },
    ];
    const out = summarizeEslByClass(rows);
    expect(out.map((r) => [r.classId, r.periods, r.reached])).toEqual([
      ['6A1', 35, true],
      ['7A2', 1, false],
    ]);
    expect(out[0].subjects).toEqual(['KHTN', 'Toán']);
    expect(out[0].teachers).toBe(2);
  });
});

describe('chế độ GV tự chọn', () => {
  it('theo lựa chọn của GV trên từng tiết', () => {
    expect(normalizeEslTag({ level: 'full', option: 'quick', objective: 'x' }, 'choice')).toEqual({ level: 'full', option: 'quick' });
    expect(normalizeEslTag({ level: 'full', option: 'clil', objective: 'Compare' }, 'choice')).toEqual({ level: 'full', option: 'clil', objective: 'Compare' });
    expect(validateEslTag({ level: 'full', option: 'clil' }, 'choice')).toMatch(/mục tiêu ngôn ngữ/);
    expect(validateEslTag({ level: 'full', option: 'quick' }, 'choice')).toBeNull();
  });
  it('BGH khóa phương án thì ghi đè lựa chọn GV', () => {
    expect(normalizeEslTag({ level: 'full', option: 'clil', objective: 'x' }, 'quick')).toEqual({ level: 'full', option: 'quick' });
  });
});
