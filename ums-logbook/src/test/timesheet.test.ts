import { describe, it, expect } from 'vitest';
import {
  monthRange,
  previousPeriod,
  leaveDaysInPeriod,
  buildRecord,
  reviewDeadline,
  deadlineEndMs,
  workingDaysLeft,
  effectiveStatus,
  timesheetCsv,
  isValidPeriod,
} from '../utils/timesheet';
import type { LeaveRequest } from '../types/leave';

const lr = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'x', requesterId: 'gv1', requesterName: 'GV', type: 'annual', startDate: '2026-09-07', endDate: '2026-09-08', workingDays: 2,
  reason: 'r', isEmergency: false, requiredDocs: [], docsDeadline: null, docsSubmittedAt: null, status: 'approved', createdAt: 0, ...over,
});

describe('Bảng công — kỳ công', () => {
  it('khoảng ngày của tháng, tháng trước, kiểm tra định dạng', () => {
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange('2028-02').end).toBe('2028-02-29');
    expect(previousPeriod('2026-10-02')).toBe('2026-09');
    expect(previousPeriod('2026-01-03')).toBe('2025-12');
    expect(isValidPeriod('2026-13')).toBe(false);
    expect(isValidPeriod('2026-09')).toBe(true);
  });

  it('đơn nghỉ vắt qua 2 tháng chỉ tính phần trong tháng', () => {
    // 28/9 (T2) → 2/10 (T6): tháng 9 có 28,29,30 = 3 ngày; tháng 10 có 1,2 = 2 ngày
    const r = lr({ startDate: '2026-09-28', endDate: '2026-10-02' });
    expect(leaveDaysInPeriod(r, '2026-09')).toBe(3);
    expect(leaveDaysInPeriod(r, '2026-10')).toBe(2);
    expect(leaveDaysInPeriod(r, '2026-11')).toBe(0);
  });
});

describe('Bảng công — dòng của GV', () => {
  it('[UMS] công chuẩn 22, trừ mọi loại nghỉ; chỉ tính đơn đã duyệt của chính GV', () => {
    const leaves = [
      lr({ type: 'annual', startDate: '2026-09-07', endDate: '2026-09-08' }), // 2
      lr({ type: 'sick_self', startDate: '2026-09-14', endDate: '2026-09-14' }), // 1
      lr({ type: 'unpaid', startDate: '2026-09-21', endDate: '2026-09-23' }), // 3
      lr({ type: 'annual', status: 'pending', startDate: '2026-09-24', endDate: '2026-09-24' }),
      lr({ type: 'annual', status: 'rejected', startDate: '2026-09-25', endDate: '2026-09-25' }),
      lr({ requesterId: 'gv2', startDate: '2026-09-29', endDate: '2026-09-29' }),
    ];
    const r = buildRecord({ uid: 'gv1', displayName: 'Cô A' }, leaves, '2026-09');
    expect(r.leave).toEqual({ annual: 2, unpaid: 3, sick_self: 1, sick_child: 0, maternity: 0 });
    expect(r.workedDays).toBe(16);
    expect(r.standardDays).toBe(22);
    expect(r.status).toBe('pending');
  });

  it('nghỉ dài không làm số công âm', () => {
    const r = buildRecord({ uid: 'gv1', displayName: 'A' }, [lr({ type: 'maternity', startDate: '2026-09-01', endDate: '2026-09-30' })], '2026-09');
    expect(r.leave.maternity).toBe(22);
    expect(r.workedDays).toBe(0);
  });
});

describe('[UMS] Hạn đối soát 3 ngày làm việc', () => {
  it('phát hành Thứ 5 → hạn Thứ 3 tuần sau (bỏ cuối tuần); có ngày lễ thì lùi thêm', () => {
    expect(reviewDeadline('2026-10-01')).toBe('2026-10-06');
    expect(reviewDeadline('2026-10-05')).toBe('2026-10-08');
    expect(reviewDeadline('2026-10-01', ['2026-10-05'])).toBe('2026-10-07');
  });

  it('mốc hết hạn = 23:59:59.999 giờ Việt Nam', () => {
    expect(new Date(deadlineEndMs('2026-10-06')).toISOString()).toBe('2026-10-06T16:59:59.999Z');
  });

  it('số ngày làm việc còn lại và trạng thái mặc nhiên xác nhận', () => {
    expect(workingDaysLeft('2026-10-02', '2026-10-06')).toBe(3);
    expect(workingDaysLeft('2026-10-07', '2026-10-06')).toBe(0);
    expect(effectiveStatus({ status: 'pending' }, '2026-10-06', '2026-10-06')).toBe('pending');
    expect(effectiveStatus({ status: 'pending' }, '2026-10-07', '2026-10-06')).toBe('auto_confirmed');
    expect(effectiveStatus({ status: 'disputed' }, '2026-10-07', '2026-10-06')).toBe('disputed');
  });
});

describe('Xuất CSV', () => {
  it('có BOM, cột mã nghỉ, dùng số công sau điều chỉnh, sắp theo tên', () => {
    const base = buildRecord({ uid: 'a', displayName: 'Trần B' }, [], '2026-09');
    const csv = timesheetCsv('2026-09', [
      { ...base, status: 'resolved', adjustedWorkedDays: 21, disputeReason: 'Thiếu 1 công', resolutionNote: 'Đã sửa' },
      { ...buildRecord({ uid: 'b', displayName: 'An C' }, [], '2026-09') },
    ], '2026-10-10', '2026-10-06');
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toContain('"CÔ"');
    expect(lines[1]).toContain('"An C"');
    expect(lines[1]).toContain('"Mặc nhiên xác nhận"');
    expect(lines[2]).toContain('"21"');
    expect(lines[2]).toContain('"Đã xử lý khiếu nại"');
  });
});
