import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LEAVE_POLICY,
  countWorkingDays,
  noticeWorkingDays,
  checkNotice,
  annualEntitlement,
  sickSelfCap,
  sickChildCap,
  maternityGuide,
  requiredDocs,
  docsDeadline,
  daysUntil,
  usedDays,
  validateLeave,
  isValidISO,
} from '../utils/leavePolicy';
import type { LeaveRequest, NewLeaveInput } from '../types/leave';

// 2026-10-12 là Thứ Hai
const MON = '2026-10-12';

const req = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'r', requesterId: 'u', requesterName: 'GV', type: 'annual', startDate: '2026-03-02', endDate: '2026-03-03',
  workingDays: 2, reason: 'x', isEmergency: false, requiredDocs: [], docsDeadline: null, docsSubmittedAt: null,
  status: 'approved', createdAt: 0, ...over,
});

const input = (over: Partial<NewLeaveInput>): NewLeaveInput => ({
  type: 'annual', startDate: '2026-10-20', endDate: '2026-10-20', reason: 'Việc gia đình', isEmergency: false, ...over,
});

describe('Ngày làm việc', () => {
  it('bỏ Thứ 7, Chủ nhật và ngày lễ; bao gồm 2 đầu', () => {
    expect(countWorkingDays(MON, '2026-10-18')).toBe(5);
    expect(countWorkingDays('2026-10-17', '2026-10-18')).toBe(0);
    expect(countWorkingDays(MON, '2026-10-16', ['2026-10-14'])).toBe(4);
    expect(countWorkingDays('2026-10-16', '2026-10-19')).toBe(2);
    expect(countWorkingDays('2026-10-20', '2026-10-19')).toBe(0);
  });

  it('kiểm tra chuỗi ngày hợp lệ', () => {
    expect(isValidISO('2026-02-29')).toBe(false);
    expect(isValidISO('2028-02-29')).toBe(true);
    expect(isValidISO('12/10/2026')).toBe(false);
  });
});

describe('[UMS] Thời hạn báo trước', () => {
  it('nghỉ 1 ngày: cần ≥1 ngày làm việc trước', () => {
    expect(noticeWorkingDays(MON, '2026-10-13')).toBe(1);
    expect(checkNotice({ today: MON, start: '2026-10-13', workingDays: 1, isEmergency: false }).ok).toBe(true);
    expect(checkNotice({ today: MON, start: MON, workingDays: 1, isEmergency: false }).ok).toBe(false);
    // Thứ 6 xin nghỉ Thứ 2: Thứ 6 là 1 ngày làm việc báo trước
    expect(checkNotice({ today: '2026-10-16', start: '2026-10-19', workingDays: 1, isEmergency: false }).ok).toBe(true);
  });

  it('nghỉ ≥2 ngày: cần ≥2 ngày làm việc trước', () => {
    expect(checkNotice({ today: MON, start: '2026-10-14', workingDays: 2, isEmergency: false }).ok).toBe(true);
    const r = checkNotice({ today: MON, start: '2026-10-13', workingDays: 3, isEmergency: false });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/ít nhất 2 ngày làm việc/);
  });

  it('đột xuất: luôn được gửi, kèm nhắc bổ sung giấy tờ', () => {
    const r = checkNotice({ today: MON, start: MON, workingDays: 3, isEmergency: true });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/bổ sung giấy tờ/);
  });
});

describe('[UMS] Phép năm', () => {
  it('+1 ngày mỗi đủ 5 năm (tính đến 31/12)', () => {
    expect(annualEntitlement(12, 2026, '2022-01-01').days).toBe(12);
    expect(annualEntitlement(12, 2026, '2021-12-31').seniorityBonus).toBe(1);
    expect(annualEntitlement(12, 2026, '2016-06-01').days).toBe(14);
  });

  it('chưa đủ 12 tháng: (cơ bản + thâm niên)/12 × số tháng', () => {
    const e = annualEntitlement(12, 2026, '2026-09-01');
    expect(e.monthsWorked).toBe(4);
    expect(e.days).toBe(4);
    expect(e.prorated).toBe(true);
    expect(annualEntitlement(12, 2026, '2026-08-15').days).toBe(5);
    expect(annualEntitlement(12, 2025, '2026-01-01').days).toBe(0);
  });

  it('thiếu ngày vào làm → dùng mức cơ bản và báo thiếu dữ liệu', () => {
    expect(annualEntitlement(12, 2026)).toMatchObject({ days: 12, missingStartDate: true });
  });
});

describe('Ốm đau', () => {
  it('[UMS] trần bản thân theo số năm BHXH; [LUẬT] ≥30 năm', () => {
    expect(sickSelfCap(14.9)).toMatchObject({ days: 30, source: 'UMS' });
    expect(sickSelfCap(15)).toMatchObject({ days: 40, source: 'UMS' });
    expect(sickSelfCap(29)).toMatchObject({ days: 40 });
    expect(sickSelfCap(30)).toMatchObject({ days: 60, source: 'LUẬT' });
    expect(sickSelfCap(undefined)).toMatchObject({ days: 30, assumed: true });
  });

  it('[UMS] trần chăm con ốm theo tuổi con', () => {
    expect(sickChildCap('2024-10-13', MON)).toBe(20); // chưa đủ 2 tuổi
    expect(sickChildCap('2023-10-12', MON)).toBe(15); // vừa đủ 3 tuổi
    expect(sickChildCap('2019-10-13', MON)).toBe(15); // 6 tuổi
    expect(sickChildCap('2019-10-12', MON)).toBe(0); // đủ 7 tuổi
  });
});

describe('Thai sản & giấy tờ', () => {
  it('hướng dẫn thai sản ghi rõ nguồn', () => {
    expect(maternityGuide({ gender: 'female', childOrder: 2 })).toMatch(/\[UMS\].*7 tháng/);
    expect(maternityGuide({ gender: 'female', childOrder: 2, babies: 2 })).toMatch(/8 tháng/);
    expect(maternityGuide({ gender: 'male', childOrder: 2, babies: 3 })).toMatch(/13 ngày/);
    expect(maternityGuide({ gender: 'female', childOrder: 1 })).toMatch(/\[LUẬT – tham khảo\].*6 tháng/);
  });

  it('giấy tờ theo loại nghỉ', () => {
    expect(requiredDocs('sick_self', 'inpatient')[0]).toMatch(/Giấy ra viện/);
    expect(requiredDocs('sick_self', 'outpatient')[0]).toMatch(/hưởng BHXH/);
    expect(requiredDocs('maternity')).toHaveLength(2);
    expect(requiredDocs('annual')).toEqual([]);
  });

  it('[NỘI BỘ] hạn giấy ốm = 30 ngày kể từ ngày đi làm lại', () => {
    expect(docsDeadline('sick_self', '2026-10-14', DEFAULT_LEAVE_POLICY)).toBe('2026-11-14');
    expect(docsDeadline('annual', '2026-10-14', DEFAULT_LEAVE_POLICY)).toBeNull();
    expect(daysUntil(MON, '2026-10-22')).toBe(10);
  });
});

describe('Số dư & kiểm tra đơn', () => {
  const ctx = { today: MON, policy: { ...DEFAULT_LEAVE_POLICY, annualBaseConfirmed: true }, profile: { employmentStartDate: '2020-01-01', bhxhYears: 10 }, existing: [] as LeaveRequest[] };

  it('usedDays: tính đơn đã duyệt + chờ duyệt trong năm, bỏ đơn bị từ chối/hủy', () => {
    const list = [req({ workingDays: 2 }), req({ status: 'pending', workingDays: 1 }), req({ status: 'rejected', workingDays: 5 }), req({ startDate: '2025-05-05', workingDays: 3 })];
    expect(usedDays(list, 2026, (r) => r.type === 'annual')).toEqual({ approved: 2, pending: 1 });
  });

  it('đơn hợp lệ: không lỗi, tính đúng số ngày làm việc', () => {
    const r = validateLeave(input({ startDate: '2026-10-19', endDate: '2026-10-23' }), ctx);
    expect(r.errors).toEqual([]);
    expect(r.workingDays).toBe(5);
  });

  it('chặn: thiếu lý do, ngày ngược, trùng đơn cũ, vượt quỹ phép', () => {
    expect(validateLeave(input({ reason: ' ' }), ctx).errors.join()).toMatch(/lý do/);
    expect(validateLeave(input({ startDate: '2026-10-21', endDate: '2026-10-20' }), ctx).errors.join()).toMatch(/kết thúc/);
    const withOld = { ...ctx, existing: [req({ startDate: '2026-10-20', endDate: '2026-10-21', status: 'pending' })] };
    expect(validateLeave(input({}), withOld).errors.join()).toMatch(/Trùng thời gian/);
    // vào làm 2020 → đủ 6 năm tới 31/12/2026 → 12 + 1 = 13 ngày
    const used = { ...ctx, existing: [req({ workingDays: 13, startDate: '2026-03-02', endDate: '2026-03-18' })] };
    expect(validateLeave(input({}), used).errors.join()).toMatch(/Vượt quỹ phép năm: còn 0/);
  });

  it('nhắc: báo trước chưa đủ; số phép cơ bản chưa xác nhận; vượt trần ốm', () => {
    expect(validateLeave(input({ startDate: MON, endDate: MON }), ctx).warnings.join()).toMatch(/ít nhất 1 ngày/);
    expect(validateLeave(input({}), { ...ctx, policy: DEFAULT_LEAVE_POLICY }).warnings.join()).toMatch(/chưa được nhà trường xác nhận/);
    const sick = input({ type: 'sick_self', treatment: 'outpatient', isEmergency: true, startDate: '2026-10-12', endDate: '2026-10-16' });
    const many = { ...ctx, existing: [req({ type: 'sick_self', workingDays: 27, startDate: '2026-02-02', endDate: '2026-03-06' })] };
    expect(validateLeave(sick, many).warnings.join()).toMatch(/Vượt trần hưởng BHXH ốm đau 30/);
  });

  it('nghỉ ốm cần hình thức điều trị; chăm con ốm cần thông tin con', () => {
    expect(validateLeave(input({ type: 'sick_self' }), ctx).errors.join()).toMatch(/nội trú/);
    expect(validateLeave(input({ type: 'sick_child' }), ctx).errors.join()).toMatch(/con bị ốm/);
    const r = validateLeave(input({ type: 'sick_child', child: { name: 'Bé A', dob: '2018-01-01' } }), ctx);
    expect(r.warnings.join()).toMatch(/đủ 7 tuổi/);
  });
});
