import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FamilyLeaveCard } from '../components/family/FamilyLeaveCard';

let authState: { activeRole: string | null; user: { uid: string } | null; profile: { displayName: string } | null };
const submitLeave = vi.fn();
const listMyLeaves = vi.fn();
const cancelLeave = vi.fn();
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../hooks/useLanguage', () => ({ useLanguage: () => ({ language: 'vi' }) }));
vi.mock('../services/studentLeaveService', () => ({
  submitLeave: (...a: unknown[]) => submitLeave(...a),
  listMyLeaves: (...a: unknown[]) => listMyLeaves(...a),
  cancelLeave: (...a: unknown[]) => cancelLeave(...a),
}));

const kids = [
  { docId: 'd1', mhs: '111', fullName: 'An', className: '6A1' },
  { docId: 'd2', mhs: '222', fullName: 'Bình', className: '8B2' },
];

describe('FamilyLeaveCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { activeRole: 'parent', user: { uid: 'p1' }, profile: { displayName: 'PH A' } };
    listMyLeaves.mockResolvedValue([]);
    submitLeave.mockImplementation(async (_p, c, i) => ({ id: 'x', status: 'pending', createdAt: 1, studentName: c.name, ...i }));
  });

  it('role student không render thẻ', () => {
    authState.activeRole = 'student';
    const { container } = render(<FamilyLeaveCard students={kids} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('chỉ tải danh sách khi mở thẻ', async () => {
    render(<FamilyLeaveCard students={kids} />);
    expect(listMyLeaves).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('leave-toggle'));
    await screen.findByText('Chưa có đơn nào.');
    expect(listMyLeaves).toHaveBeenCalledWith('p1');
  });

  it('đổi kind cập nhật ô bán trú', async () => {
    render(<FamilyLeaveCard students={kids} />);
    fireEvent.click(screen.getByTestId('leave-toggle'));
    await screen.findByText('Chưa có đơn nào.');
    const meal = () => screen.getByLabelText(/Đăng ký ăn bán trú/) as HTMLInputElement;
    expect(meal().checked).toBe(false);
    fireEvent.click(screen.getByTestId('leave-kind-periods'));
    expect(meal().checked).toBe(true);
    fireEvent.click(screen.getByTestId('leave-kind-day'));
    expect(meal().checked).toBe(false);
  });

  it('submit gọi submitLeave đúng classId của con chọn', async () => {
    render(<FamilyLeaveCard students={kids} />);
    fireEvent.click(screen.getByTestId('leave-toggle'));
    await screen.findByText('Chưa có đơn nào.');
    fireEvent.change(screen.getByTestId('leave-child'), { target: { value: 'd2' } });
    fireEvent.click(screen.getByTestId('leave-submit'));
    await waitFor(() => expect(submitLeave).toHaveBeenCalledTimes(1));
    const [parent, child, input] = submitLeave.mock.calls[0];
    expect(parent).toEqual({ uid: 'p1', displayName: 'PH A' });
    expect(child).toEqual({ mhs: '222', name: 'Bình', classId: '8B2' });
    expect(input.kind).toBe('day');
    expect(input.dates.length).toBe(1);
  });

  it('xóa ngày rồi gửi: báo lỗi, không gọi submitLeave', async () => {
    render(<FamilyLeaveCard students={kids} />);
    fireEvent.click(screen.getByTestId('leave-toggle'));
    await screen.findByText('Chưa có đơn nào.');
    fireEvent.change(screen.getByTestId('leave-start'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('leave-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng chọn ngày nghỉ.');
    expect(submitLeave).not.toHaveBeenCalled();
  });

  it('ngày không có thật (2026-02-30): báo lỗi, không gọi submitLeave', async () => {
    render(<FamilyLeaveCard students={kids} />);
    fireEvent.click(screen.getByTestId('leave-toggle'));
    await screen.findByText('Chưa có đơn nào.');
    fireEvent.change(screen.getByTestId('leave-start'), { target: { value: '2026-02-30' } });
    fireEvent.click(screen.getByTestId('leave-submit'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(submitLeave).not.toHaveBeenCalled();
  });

  it.each([
    ['code permission-denied', Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })],
    ['message có "permission"', new Error('FirebaseError: Missing or insufficient permissions.')],
  ])('gửi lỗi quyền (%s): báo lỗi thân thiện song ngữ', async (_n, error) => {
    submitLeave.mockRejectedValueOnce(error);
    render(<FamilyLeaveCard students={kids} />);
    fireEvent.click(screen.getByTestId('leave-toggle'));
    await screen.findByText('Chưa có đơn nào.');
    fireEvent.click(screen.getByTestId('leave-submit'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chưa gửi được, vui lòng thử lại sau ít giây.');
    expect(alert).toHaveTextContent('Could not send, please try again in a few seconds.');
    expect(alert).not.toHaveTextContent('insufficient');
  });

  it('lỗi khác giữ nguyên thông báo của service', async () => {
    submitLeave.mockRejectedValueOnce(new Error('Mỗi ngày chỉ gửi tối đa 5 đơn.'));
    render(<FamilyLeaveCard students={kids} />);
    fireEvent.click(screen.getByTestId('leave-toggle'));
    await screen.findByText('Chưa có đơn nào.');
    fireEvent.click(screen.getByTestId('leave-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mỗi ngày chỉ gửi tối đa 5 đơn.');
  });
});
