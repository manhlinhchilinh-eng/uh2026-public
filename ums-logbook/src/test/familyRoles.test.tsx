import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const authState = vi.hoisted(() => ({
  activeRole: 'parent' as string | null,
  profile: { displayName: 'Phụ huynh em A', roles: ['parent'], studentDocIds: ['6A1_01'], studentMhs: ['111111'] } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));

const svc = vi.hoisted(() => ({
  fetchLinkedStudents: vi.fn(),
  fetchBehaviorNotesForStudent: vi.fn(),
}));
vi.mock('../services/familyService', async (orig) => {
  const real = await orig<typeof import('../services/familyService')>();
  return { ...real, ...svc };
});

const daily = vi.hoisted(() => ({ fetchStudentDaily: vi.fn(async () => [] as any[]) }));
vi.mock('../services/studentDailyService', () => daily);

import { FamilyHomePage } from '../pages/FamilyHomePage';
import { RoleGuard } from '../components/layout/RoleGuard';
import { sortRecent, summarizeBehavior } from '../services/familyService';
import { STAFF_ROLES, FAMILY_ROLES } from '../types/auth';
import { modulesForRole } from '../config/modules';

describe('Vai trò phụ huynh / học sinh', () => {
  beforeEach(() => {
    svc.fetchLinkedStudents.mockReset();
    svc.fetchBehaviorNotesForStudent.mockReset();
  });

  it('nhóm vai trò tách bạch: PH/HS không phải nhân sự', () => {
    for (const r of FAMILY_ROLES) expect(STAFF_ROLES).not.toContain(r);
  });

  it('summarizeBehavior và sortRecent', () => {
    expect(summarizeBehavior([{ type: 'positive' }, { type: 'negative' }, { type: 'positive' }])).toEqual({ positive: 2, negative: 1 });
    expect(sortRecent([{ createdAt: 1 }, { createdAt: 3 }, { createdAt: 2 }]).map((x) => x.createdAt)).toEqual([3, 2, 1]);
  });

  it('trang chủ PH hiển thị hồ sơ con và nhận xét, chỉ truy vấn theo mã HS của con', async () => {
    svc.fetchLinkedStudents.mockResolvedValue([{ docId: '6A1_01', mhs: '111111', fullName: 'Nguyễn Văn A', className: '6A1' }]);
    svc.fetchBehaviorNotesForStudent.mockResolvedValue([
      { id: 'n1', type: 'positive', content: 'Phát biểu tốt', date: '2026-10-05', createdAt: 2, authorName: 'Cô B' },
      { id: 'n2', type: 'negative', content: 'Quên vở', date: '2026-10-04', createdAt: 1 },
    ]);
    render(
      <MemoryRouter>
        <FamilyHomePage />
      </MemoryRouter>
    );
    const card = await screen.findByTestId('family-student-6A1_01');
    expect(card).toHaveTextContent('Nguyễn Văn A');
    expect(card).toHaveTextContent('Lớp 6A1');
    expect(card).toHaveTextContent('Phát biểu tốt');
    expect(card).toHaveTextContent('Quên vở');
    expect(screen.getByText('Cổng phụ huynh')).toBeInTheDocument();
    expect(svc.fetchLinkedStudents).toHaveBeenCalledWith(['6A1_01']);
    expect(svc.fetchBehaviorNotesForStudent).toHaveBeenCalledWith('111111');
  });

  it('chuyên cần của con: tóm tắt tháng này + từng ngày; khối 9 có link tra cứu điểm', async () => {
    const d = new Date();
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    svc.fetchLinkedStudents.mockResolvedValue([{ docId: '9A3_05', mhs: '222222', fullName: 'Trần B', className: '9A3', grade: 9 }]);
    svc.fetchBehaviorNotesForStudent.mockResolvedValue([]);
    daily.fetchStudentDaily.mockResolvedValue([
      { mhs: '222222', studentName: 'Trần B', classId: '9A3', date: `${ym}-02`, morning: 'P', afternoon: 'P', periodAbsences: [], earlyDeparture: null, updatedAt: 1 },
      { mhs: '222222', studentName: 'Trần B', classId: '9A3', date: `${ym}-01`, morning: 'Late', afternoon: null, periodAbsences: [], earlyDeparture: null, updatedAt: 1 },
      { mhs: '222222', studentName: 'Trần B', classId: '9A3', date: '2000-01-01', morning: 'K', afternoon: null, periodAbsences: [], earlyDeparture: null, updatedAt: 1 },
    ]);
    render(<MemoryRouter><FamilyHomePage /></MemoryRouter>);
    const sum = await screen.findByTestId('att-summary-9A3_05');
    expect(sum).toHaveTextContent('Vắng có phép2');
    expect(sum).toHaveTextContent('Vắng không phép0'); // ngày tháng khác không tính
    expect(sum).toHaveTextContent('Đi muộn1');
    expect(screen.getByTestId('att-days-9A3_05')).toHaveTextContent('Cả ngày vắng có phép');
    expect(daily.fetchStudentDaily).toHaveBeenCalledWith('222222');
    expect(screen.getByText(/Tra cứu điểm khảo sát khối 9/)).toBeInTheDocument();
  });

  it('tài khoản chưa liên kết HS → hướng dẫn liên hệ GVCN', async () => {
    svc.fetchLinkedStudents.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <FamilyHomePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/chưa được liên kết/)).toBeInTheDocument());
  });

  it('PH bị chặn khỏi phân hệ nhân sự (vd. Sổ đầu bài)', () => {
    authState.activeRole = 'parent';
    render(
      <MemoryRouter initialEntries={['/logbook']}>
        <Routes>
          <Route element={<RoleGuard allowedRoles={STAFF_ROLES} />}>
            <Route path="/logbook" element={<div>SO DAU BAI</div>} />
          </Route>
          <Route path="/dashboard" element={<div>TRANG CHU</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('SO DAU BAI')).toBeNull();
  });

  it('ô phân hệ: PH không thấy Sổ đầu bài; HS thấy Kho bài tập', () => {
    expect(modulesForRole('parent').some((m) => m.id === 'logbook')).toBe(false);
    expect(modulesForRole('student').some((m) => m.id === 'practice')).toBe(true);
    expect(modulesForRole('parent').some((m) => m.id === 'practice')).toBe(false);
    expect(modulesForRole('gvbm').some((m) => m.id === 'logbook')).toBe(true);
  });
});

describe('Chốt an toàn vai trò khi thiếu hồ sơ', () => {
  it('fallbackRoleForUsername: hs/ph + mã HS không bao giờ thành giáo viên', async () => {
    const { fallbackRoleForUsername } = await import('../services/authService');
    expect(fallbackRoleForUsername('hs991004')).toBe('student');
    expect(fallbackRoleForUsername('PH991004')).toBe('parent');
    expect(fallbackRoleForUsername('msphuonganhums')).toBe('gvbm');
    expect(fallbackRoleForUsername('hs26100')).toBe('gvbm');
  });
});
