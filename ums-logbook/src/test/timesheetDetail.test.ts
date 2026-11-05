import { describe, it, expect } from 'vitest';
import { timesheetDetail } from '../utils/timesheet';
import type { LeaveRequest } from '../types/leave';

const req = (id: string, over: Partial<LeaveRequest>): LeaveRequest => ({
  id, requesterId: 'u1', requesterName: 'GV', type: 'annual', startDate: '2026-11-03', endDate: '2026-11-03',
  workingDays: 1, reason: 'x', isEmergency: false, requiredDocs: [], docsDeadline: null, docsSubmittedAt: null,
  status: 'approved', createdAt: 1, ...over,
});

describe('Chi tiết bảng công: ngày nghỉ + số tiết đã ký trong kỳ', () => {
  it('liệt kê đơn đã duyệt giao với tháng (cắt theo tháng), bỏ đơn chờ/từ chối', () => {
    const d = timesheetDetail('2026-11', [
      req('a', { startDate: '2026-10-30', endDate: '2026-11-03', type: 'sick_self' }), // 30/10 (T6) → 03/11: 2 ngày làm việc trong tháng 11
      req('b', { startDate: '2026-11-10', endDate: '2026-11-10' }),
      req('c', { startDate: '2026-11-12', endDate: '2026-11-12', status: 'pending' }),
      req('d', { startDate: '2026-12-01', endDate: '2026-12-01' }),
    ], []);
    expect(d.leaves).toEqual([
      { id: 'a', type: 'sick_self', from: '2026-11-01', to: '2026-11-03', days: 2 },
      { id: 'b', type: 'annual', from: '2026-11-10', to: '2026-11-10', days: 1 },
    ]);
  });

  it('đếm tiết đã ký trong tháng theo lớp', () => {
    const d = timesheetDetail('2026-11', [], [
      { dailyId: '9A2_2026-11-05', isSigned: true },
      { dailyId: '9A2_2026-11-06', isSigned: true },
      { dailyId: '10A1_2026-11-06', isSigned: true },
      { dailyId: '8A1_2026-11-06', isSigned: false },
      { dailyId: '9A2_2026-10-31', isSigned: true },
      { isSigned: true },
    ]);
    expect(d.signedPeriods).toBe(3);
    expect(d.byClass).toEqual([{ classId: '9A2', count: 2 }, { classId: '10A1', count: 1 }]);
  });
});
