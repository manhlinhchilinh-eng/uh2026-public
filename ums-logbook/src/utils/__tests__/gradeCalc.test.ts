import { describe, expect, it } from 'vitest';
import {
  formatGrade,
  isValidScore,
  minRegularAssessments,
  parseGradeInput,
  termResult,
  termResultText,
  yearAverage,
} from '../gradeCalc';

describe('minRegularAssessments (TT22 Điều 7)', () => {
  it('≤35 tiết → 2, 36–70 → 3, >70 → 4', () => {
    expect(minRegularAssessments(35)).toBe(2);
    expect(minRegularAssessments(52)).toBe(3);
    expect(minRegularAssessments(70)).toBe(3);
    expect(minRegularAssessments(105)).toBe(4);
    expect(minRegularAssessments(140)).toBe(4);
  });
});

describe('parseGradeInput', () => {
  it('đọc điểm số kiểu Việt Nam và kiểu chấm', () => {
    expect(parseGradeInput('8', 'score')).toBe(8);
    expect(parseGradeInput('8,5', 'score')).toBe(8.5);
    expect(parseGradeInput(' 7.3 ', 'score')).toBe(7.3);
    expect(parseGradeInput('10', 'score')).toBe(10);
    expect(parseGradeInput('0', 'score')).toBe(0);
    expect(parseGradeInput('', 'score')).toBeNull();
  });
  it('từ chối điểm ngoài 0–10, 2 chữ số thập phân, chữ', () => {
    expect(parseGradeInput('11', 'score')).toBeUndefined();
    expect(parseGradeInput('10.5', 'score')).toBeUndefined();
    expect(parseGradeInput('8.25', 'score')).toBeUndefined();
    expect(parseGradeInput('-1', 'score')).toBeUndefined();
    expect(parseGradeInput('abc', 'score')).toBeUndefined();
    expect(parseGradeInput('Đ', 'score')).toBeUndefined();
  });
  it('nhập nhanh trên lưới: 2 chữ số = điểm lẻ, "10" giữ là 10', () => {
    const q = (s: string) => parseGradeInput(s, 'score', { shorthand: true });
    expect(q('95')).toBe(9.5);
    expect(q('76')).toBe(7.6);
    expect(q('90')).toBe(9);
    expect(q('05')).toBe(0.5);
    expect(q('10')).toBe(10);
    expect(q('100')).toBe(10);
    expect(q('9')).toBe(9);
    expect(q('8,5')).toBe(8.5);
    expect(q('105')).toBeUndefined();
    // Không bật nhập nhanh (đọc file Excel): "95" là sai, không tự đổi
    expect(parseGradeInput('95', 'score')).toBeUndefined();
    expect(parseGradeInput('95', 'comment', { shorthand: true })).toBeUndefined();
  });
  it('môn nhận xét nhận Đ/CĐ (cả khi gõ không dấu)', () => {
    expect(parseGradeInput('Đ', 'comment')).toBe('Đ');
    expect(parseGradeInput('d', 'comment')).toBe('Đ');
    expect(parseGradeInput('cd', 'comment')).toBe('CĐ');
    expect(parseGradeInput('C Đ', 'comment')).toBe('CĐ');
    expect(parseGradeInput('8', 'comment')).toBeUndefined();
  });
});

describe('isValidScore / formatGrade', () => {
  it('kiểm 1 chữ số thập phân', () => {
    expect(isValidScore(6.7)).toBe(true);
    expect(isValidScore(6.75)).toBe(false);
    expect(isValidScore(NaN)).toBe(false);
  });
  it('hiển thị dấu phẩy', () => {
    expect(formatGrade(8.5)).toBe('8,5');
    expect(formatGrade(9)).toBe('9');
    expect(formatGrade(null)).toBe('');
    expect(formatGrade('CĐ')).toBe('CĐ');
  });
});

describe('termResult — môn điểm số', () => {
  it('công thức (ΣTX + 2GK + 3CK)/(n + 5)', () => {
    // (8+7+9+6 + 2·7 + 3·8) / 9 = 68/9 = 7,555… → 7,6
    expect(termResult({ tx: [8, 7, 9, 6], gk: 7, ck: 8 }, 'score', 4)).toEqual({ status: 'ok', avg: 7.6 });
  });
  it('làm tròn nửa lên đúng (không lỗi số thực)', () => {
    // (6+6 + 2·6 + 3·6.5)/7 = 43.5/7 ≈ 6,214 → 6,2
    expect(termResult({ tx: [6, 6, null, null], gk: 6, ck: 6.5 }, 'score', 2)).toEqual({ status: 'ok', avg: 6.2 });
    // (5+6+7 + 2·7 + 3·6.5)/8 = 51.5/8 = 6,4375 → 6,4
    expect(termResult({ tx: [5, 6, 7, null], gk: 7, ck: 6.5 }, 'score', 3)).toEqual({ status: 'ok', avg: 6.4 });
    // (6.5+6+6.5+6+6 + 2·6.5 + 3·6.2)/10 = 62.6/10 = 6,26 → 6,3
    expect(termResult({ tx: [6.5, 6, 6.5, 6, 6], gk: 6.5, ck: 6.2 }, 'score', 4)).toEqual({ status: 'ok', avg: 6.3 });
  });
  it('mẫu số theo số lần ĐGtx thực có (nhiều hơn tối thiểu vẫn tính)', () => {
    // (10·4 + 2·10 + 3·10)/9 = 10
    expect(termResult({ tx: [10, 10, 10, 10], gk: 10, ck: 10 }, 'score', 2)).toEqual({ status: 'ok', avg: 10 });
  });
  it('thiếu điểm → không tính', () => {
    const r = termResult({ tx: [8, null, null, null], gk: 7, ck: null }, 'score', 2);
    expect(r).toEqual({ status: 'missing', missing: ['ĐĐGtx (1/2)', 'ĐĐGck'] });
    expect(termResultText(r)).toBe('');
  });
});

describe('termResult — môn nhận xét', () => {
  it('Đạt khi ≥ 2/3 ĐGtx Đ và GK, CK Đ', () => {
    expect(termResult({ tx: ['Đ', 'Đ', 'CĐ'], gk: 'Đ', ck: 'Đ' }, 'comment', 3)).toEqual({ status: 'ok', result: 'Đạt' });
  });
  it('Chưa đạt khi CK CĐ hoặc < 2/3 Đ', () => {
    expect(termResult({ tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'CĐ' }, 'comment', 2)).toEqual({ status: 'ok', result: 'Chưa đạt' });
    expect(termResult({ tx: ['Đ', 'CĐ', 'CĐ'], gk: 'Đ', ck: 'Đ' }, 'comment', 3)).toEqual({ status: 'ok', result: 'Chưa đạt' });
  });
  it('thiếu lần ĐGtx → không kết luận', () => {
    expect(termResult({ tx: ['Đ'], gk: 'Đ', ck: 'Đ' }, 'comment', 2).status).toBe('missing');
  });
});

describe('yearAverage', () => {
  it('(HK1 + 2·HK2)/3', () => {
    expect(yearAverage(7, 8)).toBe(7.7); // 23/3 = 7,666 → 7,7
    expect(yearAverage(6.5, 7.1)).toBe(6.9); // 20.7/3 = 6,9
    expect(yearAverage(8.2, 8.2)).toBe(8.2);
  });
});
