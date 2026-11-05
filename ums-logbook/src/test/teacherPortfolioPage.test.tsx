import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const authState = vi.hoisted(() => ({
  activeRole: 'gvcn' as string,
  profile: { uid: 'gv1', displayName: 'Cô A', username: 'msa', roles: ['gvcn'] } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../components/common/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
const svc = vi.hoisted(() => ({
  fetchPeriodsByTeacher: vi.fn(async () => [] as any[]),
  countApprovedSubstitutions: vi.fn(async () => 0),
  countBehaviorNotesByAuthor: vi.fn(async () => ({ positive: 0, negative: 0 })),
  fetchEvidence: vi.fn(async () => [] as any[]),
  createEvidence: vi.fn(async () => 'e1'),
  deleteEvidence: vi.fn(async () => {}),
  setEvidenceVerified: vi.fn(async () => {}),
  fetchUsername: vi.fn(async () => 'mrb'),
}));
vi.mock('../services/teacherPortfolioService', () => svc);
vi.mock('../services/leaveService', () => ({ fetchMyLeaveRequests: vi.fn(async () => []) }));
vi.mock('../services/substitutionService', () => ({
  fetchStaffDirectoryPublic: vi.fn(async () => [{ uid: 'gv1', displayName: 'Cô A' }, { uid: 'gv2', displayName: 'Thầy B' }]),
}));

import { TeacherPortfolioPage } from '../pages/TeacherPortfolioPage';
import { localToday } from '../pages/LeavePage';
import { schoolYearRange } from '../utils/teacherPortfolio';

const y = schoolYearRange(localToday());
const inYear = (d: string) => `${y.start.slice(0, 4)}-${d}`; // tháng 9–12 của năm học hiện tại

describe('Trang hồ sơ năng lực GV', () => {
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockClear());
    authState.activeRole = 'gvcn';
  });

  it('tự gom: tiết đã ký theo username của GV, dạy thay, nề nếp; minh chứng tự nộp', async () => {
    svc.fetchPeriodsByTeacher.mockResolvedValueOnce([
      { dailyId: `6A1_${inYear('09-07')}`, subject: 'Toán', lessonTopic: 'Phân số', isSigned: true, periodIndex: 1 },
      { dailyId: `7A3_${inYear('10-01')}`, subject: 'Toán', lessonTopic: '', isSigned: true, periodIndex: 2 },
      { dailyId: `7A3_${inYear('10-02')}`, subject: 'Toán', lessonTopic: '', isSigned: false, periodIndex: 2 },
    ]);
    svc.countApprovedSubstitutions.mockResolvedValueOnce(3);
    svc.countBehaviorNotesByAuthor.mockResolvedValueOnce({ positive: 5, negative: 1 });
    svc.fetchEvidence.mockResolvedValueOnce([{ id: 'e1', uid: 'gv1', teacherName: 'Cô A', title: 'SKKN dạy phân số', type: 'sang_kien', level: 'truong', date: inYear('10-01'), description: '', links: [], createdAt: 1 }]);
    render(<TeacherPortfolioPage />);
    expect(await screen.findByTestId('tp-periods')).toHaveTextContent('2');
    expect(svc.fetchPeriodsByTeacher).toHaveBeenCalledWith('msa');
    expect(screen.getByTestId('tp-subs')).toHaveTextContent('3');
    expect(screen.getByTestId('tp-notes')).toHaveTextContent('5 / 1');
    expect(screen.getByTestId('ev-e1')).toHaveTextContent('Chờ xác nhận');
    expect(screen.getByLabelText('Xóa minh chứng')).toBeInTheDocument();
    expect(screen.queryByLabelText('Chọn giáo viên')).toBeNull();
  });

  it('GV thêm minh chứng (kiểm tra dữ liệu trước khi lưu)', async () => {
    render(<TeacherPortfolioPage />);
    fireEvent.click(await screen.findByText('Thêm minh chứng'));
    expect(screen.getByTestId('ev-errors')).toHaveTextContent('tên minh chứng');
    fireEvent.change(screen.getByLabelText('Tên minh chứng'), { target: { value: 'Giải Nhì GV dạy giỏi cấp trường' } });
    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'giai_thuong' } });
    fireEvent.click(screen.getByText('Lưu minh chứng'));
    await waitFor(() => expect(svc.createEvidence).toHaveBeenCalled());
    expect((svc.createEvidence.mock.calls[0] as any[])[0]).toMatchObject({ title: 'Giải Nhì GV dạy giỏi cấp trường', type: 'giai_thuong', level: 'truong' });
  });

  it('BGH chọn GV khác để xem và xác nhận minh chứng; không thấy nút xóa của GV', async () => {
    authState.activeRole = 'admin';
    svc.fetchEvidence.mockResolvedValue([{ id: 'e9', uid: 'gv2', teacherName: 'Thầy B', title: 'Chuyên đề STEM', type: 'chuyen_de', level: 'dhqg', date: inYear('09-20'), description: '', links: [], createdAt: 1 }]);
    render(<TeacherPortfolioPage />);
    const sel = await screen.findByLabelText('Chọn giáo viên');
    await waitFor(() => expect(screen.getByText('Thầy B')).toBeInTheDocument());
    fireEvent.change(sel, { target: { value: 'gv2' } });
    await waitFor(() => expect(svc.fetchUsername).toHaveBeenCalledWith('gv2'));
    await waitFor(() => expect(svc.fetchPeriodsByTeacher).toHaveBeenCalledWith('mrb'));
    fireEvent.click(await screen.findByText('Xác nhận'));
    await waitFor(() => expect(svc.setEvidenceVerified).toHaveBeenCalledWith('e9', true, authState.profile));
    expect(screen.queryByLabelText('Xóa minh chứng')).toBeNull();
    svc.fetchEvidence.mockResolvedValue([]);
  });
});
