import { describe, it, expect } from 'vitest';
import { schoolYearRange, summarizeTeaching, validateEvidence, evidenceStats, type TeacherEvidence } from '../utils/teacherPortfolio';

const p = (dailyId: string, subject: string, isSigned = true, lessonTopic = '', periodIndex = 1) => ({ dailyId, subject, isSigned, lessonTopic, periodIndex });

describe('ePortfolio GV — minh chứng tự động', () => {
  it('năm học 01/08 → 31/07', () => {
    expect(schoolYearRange('2026-10-10')).toEqual({ start: '2026-08-01', end: '2027-07-31', label: '2026-2027' });
    expect(schoolYearRange('2027-03-01').label).toBe('2026-2027');
    expect(schoolYearRange('2027-08-01').label).toBe('2027-2028');
  });

  it('chỉ đếm tiết đã ký trong khoảng; theo lớp/môn/tháng; bài dạy gần nhất', () => {
    const s = summarizeTeaching(
      [
        p('6A1_2026-09-07', 'Toán', true, 'Phân số', 2),
        p('6A1_2026-09-08', 'Toán', true, 'Số thập phân', 1),
        p('7A3_2026-10-01', 'Toán', true, '', 3),
        p('7A3_2026-10-02', 'Tin học', true, 'Thuật toán', 4),
        p('6A1_2026-09-09', 'Toán', false, 'chưa ký', 1),
        p('6A1_2025-09-09', 'Toán', true, 'năm trước', 1),
      ],
      '2026-08-01',
      '2027-07-31'
    );
    expect(s.signedCount).toBe(4);
    expect(s.byClass).toEqual([{ key: '6A1', count: 2 }, { key: '7A3', count: 2 }]);
    expect(s.bySubject[0]).toEqual({ key: 'Toán', count: 3 });
    expect(s.byMonth).toEqual([{ key: '2026-09', count: 2 }, { key: '2026-10', count: 2 }]);
    expect(s.recentTopics.map((t) => t.topic)).toEqual(['Thuật toán', 'Số thập phân', 'Phân số']);
  });

  it('kiểm tra minh chứng tự nộp và thống kê', () => {
    expect(validateEvidence({ title: '', date: '', description: '', links: ['http://a'] }).length).toBe(3);
    expect(validateEvidence({ title: 'SKKN', date: '2026-10-01', description: '', links: [] })).toEqual([]);
    const ev = (over: Partial<TeacherEvidence>): TeacherEvidence => ({ id: 'e', uid: 'u', teacherName: 't', title: 'x', type: 'sang_kien', level: 'truong', date: '2026-10-01', description: '', links: [], createdAt: 1, ...over });
    const st = evidenceStats([ev({}), ev({ type: 'giai_thuong', verifiedAt: 5 })]);
    expect(st).toMatchObject({ total: 2, verified: 1 });
    expect(st.byType.find((b) => b.type === 'giai_thuong')!.count).toBe(1);
  });
});
