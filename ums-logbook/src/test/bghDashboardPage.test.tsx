import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DashboardInput } from '../utils/dashboard';

const svc = vi.hoisted(() => ({ fetchDashboardInput: vi.fn() }));
vi.mock('../services/dashboardService', () => svc);
const leave = vi.hoisted(() => ({
  fetchLeavePolicy: vi.fn(async () => ({ holidays: [] })),
  fetchAllLeaveRequests: vi.fn(async () => [] as any[]),
}));
vi.mock('../services/leaveService', () => leave);
vi.mock('../services/studentDailyService', () => ({ resyncAllStudentDaily: vi.fn(async () => ({ logbooks: 7, records: 12 })) }));

import { BghDashboardPage } from '../pages/BghDashboardPage';
import { localToday } from '../pages/LeavePage';

const TODAY = localToday(); // khoảng mặc định của trang là 'Tháng này' (mùng 1 → hôm nay)

const input = (over: Partial<DashboardInput> = {}): DashboardInput => ({
  start: '2026-10-12', end: '2026-10-16', holidays: [], classIds: ['6A1', '9A3'], logbooks: [], periodsByDaily: {}, notes: [], ...over,
});

describe('Dashboard BGH', () => {
  beforeEach(() => {
    svc.fetchDashboardInput.mockReset();
    leave.fetchAllLeaveRequests.mockResolvedValue([]);
  });

  it('chưa có tiết nào ký: hiện ghi chú "chưa có", điểm TB là —, không bịa số', async () => {
    svc.fetchDashboardInput.mockResolvedValue(input());
    render(<BghDashboardPage />);
    expect(await screen.findByTestId('no-data-note')).toBeInTheDocument();
    expect(screen.getByTestId('tile-score')).toHaveTextContent('—');
    expect(screen.getByTestId('tile-signed')).toHaveTextContent('0%');
  });

  it('có dữ liệu: tỉ lệ ký, điểm TB, chuyên cần, xin nghỉ; lớp ghi ít nhất lên đầu', async () => {
    svc.fetchDashboardInput.mockResolvedValue(
      input({
        logbooks: [{ id: '9A3_2026-10-12', classId: '9A3', date: '2026-10-12', morningBaseline: { absences: [{ studentId: 'a', studentName: 'a', type: 'K' }] } } as any],
        periodsByDaily: { '9A3_2026-10-12': [{ periodIndex: 1, isSigned: true, scores: { total: 9 } } as any] },
        notes: [{ classId: '9A3', type: 'positive', date: '2026-10-13' }],
      })
    );
    leave.fetchAllLeaveRequests.mockResolvedValue([
      { requesterId: 'g1', status: 'pending', startDate: '2026-10-20', endDate: '2026-10-20', requiredDocs: [] },
      { requesterId: 'g2', status: 'approved', startDate: TODAY, endDate: TODAY, requiredDocs: ['x'], docsSubmittedAt: null },
    ]);
    render(<BghDashboardPage />);
    expect(await screen.findByTestId('tile-score')).toHaveTextContent('9/10');
    expect(screen.queryByTestId('no-data-note')).toBeNull();
    expect(screen.getByTestId('tile-attendance')).toHaveTextContent('Vắng K 1');
    expect(screen.getByTestId('tile-behavior')).toHaveTextContent('1 / 0');
    expect(screen.getByTestId('tile-leave-pending')).toHaveTextContent('1');
    expect(screen.getByTestId('tile-teachers-off')).toHaveTextContent('1');
    expect(screen.getByTestId('tile-docs')).toHaveTextContent('1');
    const rows = screen.getAllByTestId(/^class-row-/);
    expect(rows[0]).toHaveTextContent('6A1');
    expect(rows[1]).toHaveTextContent('9A3');
  });

  it('cột theo khối có tooltip khi rê chuột; đổi khoảng thời gian thì tải lại', async () => {
    svc.fetchDashboardInput.mockResolvedValue(input());
    render(<BghDashboardPage />);
    const bar = await screen.findByTestId('grade-bar-9');
    fireEvent.mouseEnter(bar);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Khối 9: 0/40 tiết đã ký');
    const calls = svc.fetchDashboardInput.mock.calls.length;
    fireEvent.click(screen.getByText('Tuần này'));
    await waitFor(() => expect(svc.fetchDashboardInput.mock.calls.length).toBeGreaterThan(calls));
  });
});
