import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { TimesheetPeriod, TimesheetRecord } from '../types/timesheet';

const authState = vi.hoisted(() => ({
  activeRole: 'gvcn' as string,
  profile: { uid: 'gv1', displayName: 'Cô A', username: 'msa', roles: ['gvcn'] } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../components/common/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const svc = vi.hoisted(() => ({
  fetchPeriods: vi.fn(),
  fetchMyRecord: vi.fn(),
  fetchRecords: vi.fn(),
  publishTimesheet: vi.fn(async () => ({ count: 2, deadline: '2026-10-15' })),
  respondToRecord: vi.fn(async () => {}),
  resolveDispute: vi.fn(async () => {}),
  closePeriod: vi.fn(async () => 1),
}));
vi.mock('../services/timesheetService', () => svc);
vi.mock('../services/leaveService', () => ({
  fetchLeavePolicy: vi.fn(async () => ({ holidays: [] })),
  fetchAllLeaveRequests: vi.fn(async () => []),
}));
vi.mock('../services/announcementService', () => ({ fetchStaffDirectory: vi.fn(async () => []) }));

import { TimesheetPage } from '../pages/TimesheetPage';
import { localToday } from '../pages/LeavePage';
import { addDays } from '../utils/leavePolicy';

const today = localToday();
const period = (over: Partial<TimesheetPeriod> = {}): TimesheetPeriod => ({
  period: '2026-09', standardDays: 22, publishedAt: 1, publishedBy: 'adm', publishedByName: 'BGH',
  reviewDeadline: addDays(today, 7), reviewDeadlineAt: 0, status: 'open', ...over,
});
const record = (over: Partial<TimesheetRecord> = {}): TimesheetRecord => ({
  uid: 'gv1', displayName: 'Cô A', standardDays: 22,
  leave: { annual: 2, unpaid: 0, sick_self: 1, sick_child: 0, maternity: 0 }, workedDays: 19, status: 'pending', ...over,
});

describe('Trang Bảng công', () => {
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockClear());
    authState.activeRole = 'gvcn';
    svc.fetchPeriods.mockResolvedValue([period()]);
    svc.fetchMyRecord.mockResolvedValue(record());
    svc.fetchRecords.mockResolvedValue([record(), record({ uid: 'gv2', displayName: 'Thầy B', status: 'disputed', disputeReason: 'Thiếu 1 công' })]);
  });

  it('GV thấy công của mình, đếm ngược hạn và xác nhận được', async () => {
    render(<TimesheetPage />);
    const card = await screen.findByTestId('my-ts-2026-09');
    expect(card).toHaveTextContent('Chờ đối soát');
    expect(card).toHaveTextContent('19');
    expect(screen.getByTestId('ts-countdown-2026-09')).toHaveTextContent('Còn');
    fireEvent.click(screen.getByText('Xác nhận đúng'));
    await waitFor(() => expect(svc.respondToRecord).toHaveBeenCalledWith('2026-09', 'gv1', true));
  });

  it('khiếu nại bắt buộc ghi nội dung', async () => {
    render(<TimesheetPage />);
    fireEvent.click(await screen.findByText('Khiếu nại'));
    expect(screen.getByText('Gửi khiếu nại')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nội dung khiếu nại'), { target: { value: 'Ngày 12/9 tôi có dạy' } });
    fireEvent.click(screen.getByText('Gửi khiếu nại'));
    await waitFor(() => expect(svc.respondToRecord).toHaveBeenCalledWith('2026-09', 'gv1', false, 'Ngày 12/9 tôi có dạy'));
  });

  it('[UMS] quá hạn chưa phản hồi → hiển thị mặc nhiên xác nhận, không còn nút', async () => {
    svc.fetchPeriods.mockResolvedValue([period({ reviewDeadline: addDays(today, -1) })]);
    render(<TimesheetPage />);
    const card = await screen.findByTestId('my-ts-2026-09');
    expect(card).toHaveTextContent('Mặc nhiên xác nhận');
    expect(screen.queryByText('Xác nhận đúng')).toBeNull();
  });

  it('GV không thấy phần quản lý', async () => {
    render(<TimesheetPage />);
    await screen.findByTestId('my-ts-2026-09');
    expect(screen.queryByTestId('admin-timesheet')).toBeNull();
  });

  it('BGH: thống kê trạng thái, xử lý khiếu nại có điều chỉnh công, phát hành kỳ mới', async () => {
    authState.activeRole = 'admin';
    render(<TimesheetPage />);
    expect(await screen.findByTestId('ts-row-gv2')).toHaveTextContent('Thiếu 1 công');
    expect(screen.getByTestId('ts-counts')).toHaveTextContent('Khiếu nại: 1');
    fireEvent.change(screen.getByLabelText('Ghi chú xử lý'), { target: { value: 'Đã sửa theo sổ đầu bài' } });
    fireEvent.change(screen.getByLabelText('Số công sau điều chỉnh'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Xử lý'));
    await waitFor(() => expect(svc.resolveDispute).toHaveBeenCalledWith('2026-09', 'gv2', 'Đã sửa theo sổ đầu bài', 20, authState.profile));
    fireEvent.click(screen.getByText('Phát hành bảng công'));
    await waitFor(() => expect(svc.publishTimesheet).toHaveBeenCalled());
  });
});
