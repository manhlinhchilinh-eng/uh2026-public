import { describe, expect, it } from 'vitest';
import { findStudents, logbookLink, parseQuery, studentLookupClass } from '../entities';
import { normalize } from '../normalize';

const TODAY = '2026-11-05'; // thứ Năm

describe('parseQuery', () => {
  it('lớp, tiết, ngày tương đối', () => {
    const p = parseQuery('Sổ đầu bài tiết 3 hôm qua lớp 9A2', TODAY);
    expect(p).toMatchObject({ classId: '9A2', period: 3, date: '2026-11-04', wantsLogbook: true, wantsStudent: false });
  });
  it('thứ trong tuần + tuần trước + ngày d/m', () => {
    expect(parseQuery('sdb thứ 2 tiết 1', TODAY).date).toBe('2026-11-02');
    expect(parseQuery('sổ đầu bài thứ ba tuần trước', TODAY).date).toBe('2026-10-27');
    expect(parseQuery('sổ đầu bài ngày 4/11 tiết 5', TODAY)).toMatchObject({ date: '2026-11-04', period: 5 });
  });
  it('câu hướng dẫn không có tiết/ngày → để FAQ trả lời', () => {
    const p = parseQuery('Làm sao để ký sổ đầu bài', TODAY);
    expect(p.wantsLogbook).toBe(false);
    expect(p.wantsStudent).toBe(false);
  });
  it('hỏi thông tin học sinh', () => {
    expect(parseQuery('cho mình thông tin bạn Lý Bảo Duy', TODAY).wantsStudent).toBe(true);
  });
  it('chức năng chưa có: in sổ điểm từng bạn', () => {
    const p = parseQuery('Làm sao để in sổ điểm từng bạn', TODAY);
    expect(p.missing?.id).toBe('print-grade-per-student');
    expect(p.wantsStudent).toBe(false);
  });
  it('câu sổ điểm thường không bị coi là chức năng thiếu', () => {
    expect(parseQuery('GVCN xem điểm tất cả các môn của lớp ở đâu', TODAY).missing).toBeNull();
  });
});

describe('quyền', () => {
  it('GVCN chỉ lớp chủ nhiệm', () => {
    expect(studentLookupClass('gvcn', '6A1', null)).toEqual({ classId: '6A1' });
    expect(studentLookupClass('gvcn', '6A1', '9A2')).toEqual({ denied: 'other_class', own: '6A1' });
  });
  it('BGH cần nêu lớp; GVBM/PH không tra HS', () => {
    expect(studentLookupClass('admin', null, '9A2')).toEqual({ classId: '9A2' });
    expect(studentLookupClass('admin', null, null)).toEqual({ denied: 'need_class' });
    expect(studentLookupClass('gvbm', null, '9A2')).toEqual({ denied: 'role' });
    expect(studentLookupClass('parent', null, null)).toEqual({ denied: 'role' });
  });
  it('link sổ đầu bài', () => {
    expect(logbookLink('gvcn', '6A1', { classId: null, date: '2026-11-04', period: 3 }, TODAY)).toMatchObject({
      path: '/logbook?classId=6A1&date=2026-11-04&period=3',
    });
    expect(logbookLink('gvbm', null, { classId: null, date: null, period: 2 }, TODAY)).toEqual({ denied: 'need_class' });
    expect(logbookLink('parent', null, { classId: '6A1', date: null, period: 1 }, TODAY)).toEqual({ denied: 'role' });
  });
});

describe('findStudents', () => {
  const roster = [{ name: 'Lý Bảo Duy' }, { name: 'Đinh Minh Anh' }, { name: 'Trần Hoàng Anh' }, { name: 'Vũ Minh Anh' }];
  it('khớp tên gọi 2 chữ, trùng tên trả nhiều', () => {
    expect(findStudents(roster, normalize('thông tin bạn Minh Anh')).map((s) => s.name)).toEqual(['Đinh Minh Anh', 'Vũ Minh Anh']);
  });
  it('họ tên đầy đủ thắng', () => {
    expect(findStudents(roster, normalize('thông tin Vũ Minh Anh')).map((s) => s.name)).toEqual(['Vũ Minh Anh']);
  });
  it('không có tên → rỗng (không đoán)', () => {
    expect(findStudents(roster, normalize('thông tin bạn Tuấn'))).toEqual([]);
  });
});

describe('findStudents — tên 1 chữ', () => {
  const roster = [{ name: 'Đỗ Thị Mai' }, { name: 'Lê Văn An' }];
  it('chỉ nhận khi đứng sau bạn/em/hs', () => {
    expect(findStudents(roster, normalize('thông tin bạn Mai')).map((s) => s.name)).toEqual(['Đỗ Thị Mai']);
    expect(findStudents(roster, normalize('hs nghỉ học ngày mai ghi ở đâu'))).toEqual([]);
  });
});
