import { describe, it, expect } from 'vitest';
import { decidedHistory, leaveStatsInRange, formatDecisionTime } from '../utils/leavePolicy';
import type { LeaveRequest } from '../types/leave';

const req = (id: string, over: Partial<LeaveRequest>): LeaveRequest => ({
  id, requesterId: 'u1', requesterName: 'GV 1', type: 'annual', startDate: '2026-11-03', endDate: '2026-11-03',
  workingDays: 1, reason: 'x', isEmergency: false, requiredDocs: [], docsDeadline: null, docsSubmittedAt: null,
  status: 'pending', createdAt: 1, ...over,
});

describe('Lịch sử đơn nghỉ (lỗi: duyệt xong đơn biến mất)', () => {
  it('chỉ gồm đơn đã duyệt/từ chối, mới xử lý nhất trước', () => {
    const h = decidedHistory([
      req('a', { status: 'approved', decisionAt: 10, decisionByName: 'BGH' }),
      req('b', { status: 'pending' }),
      req('c', { status: 'rejected', decisionAt: 20 }),
      req('d', { status: 'cancelled' }),
    ]);
    expect(h.map((r) => r.id)).toEqual(['c', 'a']);
  });
});

describe('Thống kê nghỉ cho hồ sơ năng lực / bảng công', () => {
  it('chỉ cộng ngày đơn đã duyệt trong khoảng, tách theo loại', () => {
    const s = leaveStatsInRange(
      [
        req('a', { status: 'approved', workingDays: 2 }),
        req('b', { status: 'approved', type: 'sick_self', workingDays: 0.5 }),
        req('c', { status: 'pending', workingDays: 3 }),
        req('d', { status: 'rejected', workingDays: 1 }),
        req('e', { status: 'approved', workingDays: 5, startDate: '2026-07-01' }),
      ],
      '2026-08-01',
      '2027-07-31'
    );
    expect(s).toMatchObject({ approvedCount: 2, approvedDays: 2.5, pendingCount: 1, rejectedCount: 1 });
    expect(s.byType).toEqual([
      { type: 'annual', days: 2, count: 1 },
      { type: 'sick_self', days: 0.5, count: 1 },
    ]);
  });

  it('định dạng thời điểm duyệt', () => {
    expect(formatDecisionTime(new Date(2026, 10, 5, 9, 7).getTime())).toBe('05/11/2026 09:07');
    expect(formatDecisionTime(undefined)).toBe('');
  });
});
