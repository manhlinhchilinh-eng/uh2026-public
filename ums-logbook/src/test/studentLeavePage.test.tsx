import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudentLeavePage } from '../pages/StudentLeavePage';
import type { StudentLeave } from '../utils/studentLeave';

const isoToday = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const leave: StudentLeave = {
  id: 'p1_1_1', mhs: '269398', studentName: 'Lý Bảo Duy', classId: '6A1', parentUid: 'p1', parentName: 'Bố Duy',
  kind: 'periods', dates: [isoToday], periods: [1, 2], meal: true, reason: 'sick', note: 'Sốt', status: 'pending',
  day: 1, seq: 1, createdAt: 1,
};
const listPending = vi.fn();
const decide = vi.fn();
const listApprovedWeek = vi.fn();
vi.mock('../services/studentLeaveService', () => ({
  listPendingForClass: (...a: unknown[]) => listPending(...a),
  decideLeave: (...a: unknown[]) => decide(...a),
  listApprovedForClassWeek: (...a: unknown[]) => listApprovedWeek(...a),
}));
let authState: { user: { uid: string }; profile: { assignedClassId?: string; displayName: string } | null; activeRole: string } = {
  user: { uid: 'gv1' }, profile: { assignedClassId: '6A1', displayName: 'Cô Lan' }, activeRole: 'gvcn',
};
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../hooks/useLanguage', () => ({ useLanguage: () => ({ language: 'vi', mode: 'dual' }) }));

const by = { uid: 'gv1', displayName: 'Cô Lan' };

describe('StudentLeavePage', () => {
  beforeEach(() => {
    authState = { user: { uid: 'gv1' }, profile: { assignedClassId: '6A1', displayName: 'Cô Lan' }, activeRole: 'gvcn' };
    listPending.mockReset().mockResolvedValue([leave]);
    decide.mockReset().mockResolvedValue(undefined);
    listApprovedWeek.mockReset().mockResolvedValue([]);
  });

  it('duyệt gọi decideLeave(leave,true,by) và đơn rời danh sách chờ', async () => {
    render(<StudentLeavePage />);
    await screen.findByText('Lý Bảo Duy');
    fireEvent.click(screen.getByText('Duyệt'));
    await waitFor(() => expect(decide).toHaveBeenCalledWith(leave, true, by));
    await waitFor(() => expect(screen.queryByTestId('leave-item')).toBeNull());
    fireEvent.click(screen.getByText(/Đã duyệt tuần này \(1\)/));
    expect(screen.getByTestId('decided-item')).toBeInTheDocument();
  });

  it('tab Đã duyệt tuần này hiện đơn từ service + dòng tóm tắt', async () => {
    const old: StudentLeave = { ...leave, id: 'old', studentName: 'Trần An', status: 'approved', dates: [isoToday], periods: [] , kind: 'day' };
    listApprovedWeek.mockResolvedValue([old]);
    render(<StudentLeavePage />);
    await screen.findByText('Lý Bảo Duy');
    await waitFor(() => expect(screen.getByTestId('week-summary')).toHaveTextContent('Tuần này lớp có 1 lượt nghỉ đã duyệt (hôm nay: 1)'));
    expect(listApprovedWeek).toHaveBeenCalledWith('6A1');
    fireEvent.click(screen.getByText(/Đã duyệt tuần này \(1\)/));
    expect(screen.getByTestId('decided-item')).toHaveTextContent('Trần An');
  });

  it('lỗi tải danh sách đã duyệt hiện thông báo', async () => {
    listApprovedWeek.mockRejectedValue(new Error('x'));
    render(<StudentLeavePage />);
    expect(await screen.findByTestId('approved-error')).toHaveTextContent('Chưa tải được danh sách đã duyệt');
  });

  it('hồ sơ tải sau lần render đầu → vẫn tải đúng lớp chủ nhiệm (góp ý 05/11)', async () => {
    authState = { ...authState, profile: null };
    const { rerender } = render(<StudentLeavePage />);
    expect(listPending).not.toHaveBeenCalled();
    authState = { ...authState, profile: { assignedClassId: '6A1', displayName: 'Cô Lan' } };
    rerender(<StudentLeavePage />);
    await screen.findByText('Lý Bảo Duy');
    expect(listPending).toHaveBeenCalledWith('6A1', false);
  });

  it('BGH có lớp chủ nhiệm → chọn sẵn lớp đó', async () => {
    authState = { ...authState, activeRole: 'admin' };
    render(<StudentLeavePage />);
    await screen.findByText('Lý Bảo Duy');
    expect(listPending).toHaveBeenCalledWith('6A1', false);
  });

  it('từ chối thiếu lý do báo lỗi, không gọi decideLeave', async () => {
    render(<StudentLeavePage />);
    await screen.findByText('Lý Bảo Duy');
    fireEvent.click(screen.getByText('Từ chối'));
    fireEvent.click(screen.getByText('Xác nhận từ chối'));
    expect(await screen.findByText(/Vui lòng nhập lý do từ chối/)).toBeInTheDocument();
    expect(decide).not.toHaveBeenCalled();
  });

  it('từ chối có lý do gọi decideLeave(leave,false,by,reason)', async () => {
    render(<StudentLeavePage />);
    await screen.findByText('Lý Bảo Duy');
    fireEvent.click(screen.getByText('Từ chối'));
    fireEvent.change(screen.getByLabelText(/Lý do từ chối/), { target: { value: ' Thiếu giấy ' } });
    fireEvent.click(screen.getByText('Xác nhận từ chối'));
    await waitFor(() => expect(decide).toHaveBeenCalledWith(leave, false, by, 'Thiếu giấy'));
    await waitFor(() => expect(screen.queryByTestId('leave-item')).toBeNull());
  });

  it('lỗi service hiện tại chỗ, đơn vẫn còn', async () => {
    decide.mockRejectedValue(new Error('Đơn không còn ở trạng thái chờ duyệt.'));
    render(<StudentLeavePage />);
    await screen.findByText('Lý Bảo Duy');
    fireEvent.click(screen.getByText('Duyệt'));
    expect(await screen.findByText(/không còn ở trạng thái/)).toBeInTheDocument();
    expect(screen.getByTestId('leave-item')).toBeInTheDocument();
  });
});

import { buildNavGroups } from '../utils/navGroups';
describe('nav đơn nghỉ học', () => {
  const find = (role: 'gvcn' | 'admin' | 'gvbm', leavePending?: number) =>
    buildNavGroups({ role, assignedClassId: '6A1', leavePending }).flatMap((g) => g.items).find((i) => i.path === '/don-nghi-hs');
  it('gvcn/admin có mục, gvbm không; gvcn có badge', () => {
    expect(find('gvcn', 3)?.badge).toBe(3);
    expect(find('admin')).toBeTruthy();
    expect(find('gvbm')).toBeUndefined();
  });
});
