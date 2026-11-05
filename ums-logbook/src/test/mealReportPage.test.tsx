import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MealReportPage } from '../pages/MealReportPage';
import { buildNavGroups } from '../utils/navGroups';
import type { StudentLeave } from '../utils/studentLeave';

const mk = (id: string, classId: string, name: string, meal: boolean, dates: string[]): StudentLeave => ({
  id, mhs: id, studentName: name, classId, parentUid: 'p', parentName: 'PH', kind: 'day', dates, periods: [],
  meal, reason: 'sick', note: '', status: 'approved', day: 1, seq: 1, createdAt: 1,
});
const listApproved = vi.fn();
const listApprovedMany = vi.fn();
vi.mock('../services/studentLeaveService', () => ({
  listApprovedForDate: (...a: unknown[]) => listApproved(...a),
  listApprovedForDates: (...a: unknown[]) => listApprovedMany(...a),
}));
vi.mock('../hooks/useLanguage', () => ({ useLanguage: () => ({ language: 'vi', mode: 'dual' }) }));

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = iso(new Date());
const plus1 = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d); })();

describe('MealReportPage', () => {
  beforeEach(() => {
    listApproved.mockReset().mockImplementation(async (d: string) => [
      mk('a', '6A1', 'Lý Bảo Duy', false, [d]),
      mk('b', '6A1', 'Trần An', false, [d]),
      mk('c', '7A2', 'Hoàng Minh', false, [d]),
      mk('d', '7A2', 'Vẫn Ăn', true, [d]),
    ]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('thống kê: tổng, theo khối, theo lớp (ẩn lớp 0)', async () => {
    render(<MealReportPage />);
    await screen.findAllByText('Lý Bảo Duy', { exact: false });
    expect(screen.getByTestId('leave-total')).toHaveTextContent('4');
    const grades = screen.getAllByTestId('grade-row');
    expect(grades).toHaveLength(4);
    expect(grades[0]).toHaveTextContent('2');
    expect(grades[1]).toHaveTextContent('2');
    expect(grades[2]).toHaveTextContent('0');
    const rows = screen.getAllByTestId('leave-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('6A1');
    expect(rows[0]).toHaveTextContent('Lý Bảo Duy');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nghỉ học & Báo cơm');
  });

  it('chế độ tuần gọi listApprovedForDates với 6 ngày T2..T7, ẩn báo cơm', async () => {
    listApprovedMany.mockResolvedValue([mk('a', '8A1', 'Nguyễn Tuần', false, [today])]);
    render(<MealReportPage />);
    await screen.findByTestId('meal-total');
    fireEvent.click(screen.getByRole('button', { name: /Tuần này/ }));
    await waitFor(() => expect(listApprovedMany).toHaveBeenCalledTimes(1));
    const dates = listApprovedMany.mock.calls[0][0] as string[];
    expect(dates).toHaveLength(6);
    expect(new Date(dates[0] + 'T00:00:00').getDay()).toBe(1);
    expect(new Date(dates[5] + 'T00:00:00').getDay()).toBe(6);
    expect(await screen.findByTestId('lunch-week-note')).toBeInTheDocument();
    expect(screen.queryByTestId('meal-total')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('leave-total')).toHaveTextContent('1'));
  });

  it('hiện tổng và hàng theo lớp từ dữ liệu mock', async () => {
    render(<MealReportPage />);
    await screen.findAllByText('Lý Bảo Duy', { exact: false });
    expect(listApproved).toHaveBeenCalledWith(today);
    expect(screen.getByTestId('meal-total')).toHaveTextContent('3');
    const rows = screen.getAllByTestId('meal-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('6A1')).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[0]).toHaveTextContent('Trần An');
    expect(rows[1]).toHaveTextContent('Hoàng Minh');
    expect(rows[1]).not.toHaveTextContent('Vẫn Ăn');
  });

  it('đổi ngày gọi lại với ngày mới', async () => {
    render(<MealReportPage />);
    await screen.findByTestId('meal-total');
    fireEvent.change(screen.getByLabelText(/Chọn ngày/), { target: { value: plus1 } });
    await waitFor(() => expect(listApproved).toHaveBeenCalledWith(plus1));
    expect(listApproved).toHaveBeenCalledTimes(2);
  });

  it('ngày không có ai báo không ăn', async () => {
    listApproved.mockResolvedValue([]);
    render(<MealReportPage />);
    expect(await screen.findByText(/Không có học sinh nào/)).toBeInTheDocument();
    expect(screen.getByTestId('meal-total')).toHaveTextContent('0');
  });
});

describe('nav báo cơm', () => {
  const has = (role: 'vanphong' | 'admin' | 'gvcn' | 'giamthi' | 'tpt') =>
    buildNavGroups({ role, assignedClassId: '6A1' }).flatMap((g) => g.items).some((i) => i.path === '/bao-com');
  it('vanphong/admin/giamthi/tpt có mục, gvcn không', () => {
    expect(has('giamthi')).toBe(true);
    expect(has('tpt')).toBe(true);
    expect(has('vanphong')).toBe(true);
    expect(has('admin')).toBe(true);
    expect(has('gvcn')).toBe(false);
  });
});
