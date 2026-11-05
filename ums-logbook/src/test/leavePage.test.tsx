import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { LeaveRequest } from '../types/leave';

const authState = vi.hoisted(() => ({
  activeRole: 'gvcn' as string,
  profile: { uid: 'gv1', displayName: 'Cô A', username: 'msa', roles: ['gvcn'] } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../components/common/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const svc = vi.hoisted(() => ({
  fetchLeavePolicy: vi.fn(),
  fetchLeaveProfile: vi.fn(),
  fetchMyLeaveRequests: vi.fn(),
  fetchAllLeaveRequests: vi.fn(),
  submitLeaveRequest: vi.fn(async () => 'new'),
  decideLeaveRequest: vi.fn(async () => {}),
  cancelLeaveRequest: vi.fn(async () => {}),
  markDocsSubmitted: vi.fn(async () => {}),
  saveLeavePolicy: vi.fn(),
  saveLeaveProfile: vi.fn(),
}));
vi.mock('../services/leaveService', () => svc);
vi.mock('../services/announcementService', () => ({ fetchStaffDirectory: vi.fn(async () => []) }));
const subs = vi.hoisted(() => ({
  createSubstitutions: vi.fn(async () => {}),
  fetchAllClassSchedules: vi.fn(async () => [{ classId: '6A1', slots: [{ dayOfWeek: 2, periodIndex: 3, subject: 'Toán', teacherName: 'Ms A', teacherUsername: '' }] }]),
  fetchMySubstituteDuties: vi.fn(async () => []),
  fetchStaffDirectoryPublic: vi.fn(async () => [{ uid: 'gv1', displayName: 'Cô A' }, { uid: 'gv2', displayName: 'Thầy B' }]),
  fetchSubstitutionsForLeave: vi.fn(async () => []),
  setSubstitutionStatus: vi.fn(async () => {}),
  syncStaffDirectory: vi.fn(async () => {}),
}));
vi.mock('../services/substitutionService', () => subs);

import { LeavePage, localToday } from '../pages/LeavePage';
import { DEFAULT_LEAVE_POLICY, addDays } from '../utils/leavePolicy';

const year = Number(localToday().slice(0, 4));
const mk = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'r1', requesterId: 'gv1', requesterName: 'Cô A', type: 'annual', startDate: `${year}-03-02`, endDate: `${year}-03-03`,
  workingDays: 2, reason: 'Việc riêng', isEmergency: false, requiredDocs: [], docsDeadline: null, docsSubmittedAt: null,
  status: 'approved', createdAt: 1, ...over,
});

describe('Trang Xin nghỉ', () => {
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    Object.values(subs).forEach((f) => f.mockClear());
    svc.fetchLeavePolicy.mockResolvedValue({ ...DEFAULT_LEAVE_POLICY, annualBaseConfirmed: true });
    svc.fetchLeaveProfile.mockResolvedValue({ uid: 'gv1', displayName: 'Cô A', employmentStartDate: '2015-01-01', bhxhYears: 16 });
    svc.fetchMyLeaveRequests.mockResolvedValue([mk({})]);
    svc.fetchAllLeaveRequests.mockResolvedValue([]);
    svc.submitLeaveRequest.mockResolvedValue('new');
    authState.activeRole = 'gvcn';
  });

  it('số dư: phép năm có thâm niên trừ ngày đã dùng; trần ốm theo số năm BHXH', async () => {
    render(<LeavePage />);
    // vào làm 2015 → ≥10 năm → 12 + 2 = 14; đã dùng 2 → còn 12
    expect(await screen.findByTestId('balance-annual')).toHaveTextContent('12 / 14 ngày');
    expect(screen.getByTestId('balance-sick')).toHaveTextContent('0 / 40 ngày');
  });

  it('nhắc nộp giấy tờ ốm có đếm ngược và nút báo đã nộp', async () => {
    const deadline = addDays(localToday(), 5);
    svc.fetchMyLeaveRequests.mockResolvedValue([
      mk({ id: 's1', type: 'sick_self', treatment: 'inpatient', requiredDocs: ['Giấy ra viện'], docsDeadline: deadline, startDate: `${year}-01-05`, endDate: `${year}-01-06` }),
    ]);
    render(<LeavePage />);
    expect(await screen.findByTestId('docs-reminder')).toHaveTextContent('Giấy ra viện');
    expect(screen.getAllByTestId('countdown-s1')[0]).toHaveTextContent('Còn 5 ngày');
    fireEvent.click(screen.getByText('Tôi đã nộp giấy tờ'));
    await waitFor(() => expect(svc.markDocsSubmitted).toHaveBeenCalledWith('s1'));
  });

  it('form chặn gửi khi thiếu lý do, gửi được khi hợp lệ (đột xuất)', async () => {
    render(<LeavePage />);
    fireEvent.click(await screen.findByText('Tạo đơn xin nghỉ'));
    expect(screen.getByTestId('leave-errors')).toHaveTextContent('lý do');
    expect(screen.getByText('Gửi đơn')).toBeDisabled();
    // Chọn Thứ Hai kế tiếp để test không phụ thuộc hôm nay là ngày nào
    let monday = addDays(localToday(), 1);
    while (new Date(monday + 'T00:00:00Z').getUTCDay() !== 1) monday = addDays(monday, 1);
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: monday } });
    fireEvent.change(screen.getByLabelText('Đến hết ngày'), { target: { value: monday } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Ốm sốt' } });
    fireEvent.click(screen.getByLabelText('Nghỉ đột xuất'));
    await waitFor(() => expect(screen.getByText('Gửi đơn')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Gửi đơn'));
    await waitFor(() => expect(svc.submitLeaveRequest).toHaveBeenCalled());
    const [input] = svc.submitLeaveRequest.mock.calls[0] as any[];
    expect(input).toMatchObject({ type: 'annual', reason: 'Ốm sốt', isEmergency: true });
  });

  it('BGH thấy tab duyệt đơn và duyệt được', async () => {
    authState.activeRole = 'admin';
    svc.fetchAllLeaveRequests.mockResolvedValue([mk({ id: 'p1', status: 'pending', requesterName: 'Thầy B' })]);
    render(<LeavePage />);
    fireEvent.click(await screen.findByText('Duyệt đơn (1)'));
    expect(screen.getByTestId('leave-p1')).toHaveTextContent('Thầy B');
    fireEvent.click(screen.getByText('Duyệt'));
    await waitFor(() => expect(svc.decideLeaveRequest).toHaveBeenCalledWith('p1', true, authState.profile, ''));
    await waitFor(() => expect(subs.setSubstitutionStatus).toHaveBeenCalledWith('p1', 'approved'));
  });

  it('GV tự sắp xếp dạy thay: gợi ý tiết từ TKB theo tên trên TKB, bắt buộc chọn người dạy thay', async () => {
    svc.fetchLeaveProfile.mockResolvedValue({ uid: 'gv1', displayName: 'Cô A', employmentStartDate: '2015-01-01', bhxhYears: 16, timetableName: 'Ms A' });
    render(<LeavePage />);
    fireEvent.click(await screen.findByText('Tạo đơn xin nghỉ'));
    let monday = addDays(localToday(), 7);
    while (new Date(monday + 'T00:00:00Z').getUTCDay() !== 1) monday = addDays(monday, 1);
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: monday } });
    fireEvent.change(screen.getByLabelText('Đến hết ngày'), { target: { value: monday } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Đi tập huấn' } });
    fireEvent.click(await screen.findByText('Lấy tiết từ TKB'));
    expect(screen.getByTestId('sub-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('leave-errors')).toHaveTextContent('chưa chọn GV dạy thay');
    // Không được chọn chính mình: danh sách chỉ có đồng nghiệp
    const select = screen.getByLabelText('GV dạy thay 1') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['-- GV dạy thay --', 'Thầy B']);
    fireEvent.change(select, { target: { value: 'gv2' } });
    await waitFor(() => expect(screen.getByText('Gửi đơn')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Gửi đơn'));
    await waitFor(() => expect(subs.createSubstitutions).toHaveBeenCalled());
    const [leaveId, plans] = subs.createSubstitutions.mock.calls[0] as any[];
    expect(leaveId).toBe('new');
    expect(plans).toEqual([{ date: monday, classId: '6A1', periodIndex: 3, subject: 'Toán', substituteUid: 'gv2', substituteName: 'Thầy B' }]);
  });

  it('GV không thấy tab duyệt đơn', async () => {
    render(<LeavePage />);
    await screen.findByTestId('balance-annual');
    expect(screen.queryByText(/Duyệt đơn/)).toBeNull();
  });
});
