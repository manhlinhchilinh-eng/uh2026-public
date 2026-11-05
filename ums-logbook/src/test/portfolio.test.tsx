import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PortfolioItem } from '../types/portfolio';

const authState = vi.hoisted(() => ({
  activeRole: 'student' as string,
  profile: { uid: 'hs_1', displayName: 'Nguyễn Văn A', username: 'hs111111', roles: ['student'], studentDocIds: ['6A1_01'], studentMhs: ['111111'] } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../components/common/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../services/familyService', () => ({
  fetchLinkedStudents: vi.fn(async () => [{ docId: '6A1_01', mhs: '111111', fullName: 'Nguyễn Văn A', className: '6A1', grade: 6 }]),
}));
const svc = vi.hoisted(() => ({
  fetchPortfolioForStudent: vi.fn(async () => [] as PortfolioItem[]),
  fetchPendingPortfolio: vi.fn(async () => [] as PortfolioItem[]),
  createPortfolioItem: vi.fn(async () => 'new'),
  resubmitPortfolioItem: vi.fn(async () => {}),
  reviewPortfolioItem: vi.fn(async () => {}),
  deletePortfolioItem: vi.fn(async () => {}),
}));
vi.mock('../services/portfolioService', () => svc);

import { PortfolioPage, aiMismatch } from '../pages/PortfolioPage';
import { PassportPage } from '../pages/PassportPage';
import { competencyProfile, runAi, validatePortfolio } from '../utils/portfolio';

const CONTENT = 'Nhóm chúng em khảo sát 30 hộ gia đình về rác thải nhựa. Kết quả cho thấy 65% chưa phân loại. Tuy nhiên sau tuyên truyền còn 40%. Do đó chúng em đề xuất giải pháp thùng rác thông minh.';
const item = (over: Partial<PortfolioItem> = {}): PortfolioItem => {
  const input = { title: 'Tái chế nhựa', type: 'project' as const, category: 'general' as const, content: CONTENT, reflection: 'Em học được làm việc nhóm.', links: [] };
  return {
    id: 'p1', mhs: '111111', studentDocId: '6A1_01', studentName: 'Nguyễn Văn A', classId: '6A1', ...input,
    status: 'submitted', createdByUid: 'hs_1', createdByRole: 'student', ai: runAi(input, 6), createdAt: 1, updatedAt: 1, ...over,
  };
};

describe('ePortfolio — logic', () => {
  it('kiểm tra dữ liệu nộp', () => {
    expect(validatePortfolio({ title: '', type: 'project', category: 'general', content: 'ngắn', reflection: '', links: ['http://x'] }).join('|'))
      .toMatch(/tên minh chứng.*20 ký tự.*https/);
    expect(validatePortfolio({ title: 'A', type: 'project', category: 'general', content: CONTENT, reflection: '', links: ['https://drive.google.com/x'] })).toEqual([]);
  });

  it('năng lực chỉ tính minh chứng đã duyệt', () => {
    expect(competencyProfile([item()]).count).toBe(0);
    const p = competencyProfile([item({ status: 'approved' }), item({ id: 'p2', status: 'returned' })]);
    expect(p.count).toBe(1);
    expect(p.dims.every((d) => d.ratio != null && d.ratio > 0 && d.ratio <= 1)).toBe(true);
    expect(p.topSkills.length).toBeGreaterThan(0);
  });

  it('kiểm lại điểm AI: phát hiện điểm bị sửa tay', () => {
    expect(aiMismatch(item())).toBe(false);
    const tampered = item();
    tampered.ai = { ...tampered.ai!, total_score: 10 };
    expect(aiMismatch(tampered)).toBe(true);
  });
});

describe('ePortfolio — giao diện', () => {
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockClear());
    authState.activeRole = 'student';
  });

  it('HS: xem trước nhận xét AI rồi nộp cho GV', async () => {
    render(<MemoryRouter><PortfolioPage /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Nộp minh chứng'));
    fireEvent.change(screen.getByLabelText('Tên minh chứng'), { target: { value: 'Tái chế nhựa' } });
    fireEvent.change(screen.getByLabelText('Nội dung / mô tả sản phẩm'), { target: { value: CONTENT } });
    expect(await screen.findByTestId('ai-preview')).toHaveTextContent('AI gợi ý (offline)');
    fireEvent.click(screen.getByText('Nộp cho giáo viên'));
    await waitFor(() => expect(svc.createPortfolioItem).toHaveBeenCalled());
    const [arg] = svc.createPortfolioItem.mock.calls[0] as any[];
    expect(arg.student).toEqual({ mhs: '111111', docId: '6A1_01', name: 'Nguyễn Văn A', classId: '6A1' });
    expect(arg.ai.total_score).toBe(runAi(arg.input, 6).total_score);
  });

  it('PH chỉ xem, không có nút nộp', async () => {
    authState.activeRole = 'parent';
    svc.fetchPortfolioForStudent.mockResolvedValueOnce([item({ status: 'approved', teacherComment: 'Tốt', reviewerName: 'Cô B' })]);
    render(<MemoryRouter><PortfolioPage /></MemoryRouter>);
    expect(await screen.findByTestId('pf-p1')).toHaveTextContent('Cô B');
    expect(screen.queryByText('Nộp minh chứng')).toBeNull();
  });

  it('GV duyệt; cảnh báo khi điểm AI không khớp', async () => {
    authState.activeRole = 'gvcn';
    authState.profile = { ...authState.profile, assignedClassId: '6A1' };
    const bad = item({ id: 'p9' });
    bad.ai = { ...bad.ai!, total_score: 10 };
    svc.fetchPendingPortfolio.mockResolvedValueOnce([item(), bad]);
    render(<MemoryRouter><PortfolioPage /></MemoryRouter>);
    expect(await screen.findByTestId('ai-mismatch-p9')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-mismatch-p1')).toBeNull();
    expect(svc.fetchPendingPortfolio).toHaveBeenCalledWith('6A1');
    fireEvent.change(screen.getAllByLabelText('Nhận xét của GV')[0], { target: { value: 'Dự án có số liệu tốt' } });
    fireEvent.click(screen.getAllByText('Duyệt vào hồ sơ')[0]);
    await waitFor(() => expect(svc.reviewPortfolioItem).toHaveBeenCalledWith('p1', true, 'Dự án có số liệu tốt', null, authState.profile));
  });

  it('hộ chiếu chỉ in minh chứng đã duyệt', async () => {
    svc.fetchPortfolioForStudent.mockResolvedValueOnce([item({ status: 'approved', title: 'Đã duyệt' }), item({ id: 'p2', title: 'Chờ duyệt' })]);
    render(<MemoryRouter initialEntries={[{ pathname: '/portfolio/passport', state: { mhs: '111111' } }]}><PassportPage /></MemoryRouter>);
    expect(await screen.findByTestId('passport-student')).toHaveTextContent('Nguyễn Văn A • Lớp 6A1');
    expect(screen.getByText(/Đã duyệt/)).toBeInTheDocument();
    expect(screen.queryByText(/Chờ duyệt/)).toBeNull();
  });
});
