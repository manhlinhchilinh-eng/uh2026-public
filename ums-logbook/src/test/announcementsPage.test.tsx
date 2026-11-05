import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Announcement } from '../types/announcement';

const authState = vi.hoisted(() => ({
  activeRole: 'admin' as string,
  profile: { uid: 'u-admin', displayName: 'Cô Hiệu trưởng', username: 'bgh', roles: ['admin'], assignedClassId: undefined as string | undefined } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));

const ctx = vi.hoisted(() => ({
  items: [] as Announcement[],
  readIds: new Set<string>(),
  loading: false,
  error: null,
  refresh: vi.fn(async () => {}),
  markRead: vi.fn(async () => {}),
  unreadCount: 0,
  urgentUnread: [] as Announcement[],
}));
vi.mock('../context/AnnouncementsContext', () => ({ useAnnouncements: () => ctx }));

const svc = vi.hoisted(() => ({
  createAnnouncement: vi.fn(async () => 'new-id'),
  deleteAnnouncement: vi.fn(async () => {}),
  fetchReaders: vi.fn(async () => [{ uid: 'g1', displayName: 'Thầy A', readAt: 1 }]),
  fetchStaffDirectory: vi.fn(async () => [
    { uid: 'g1', displayName: 'Thầy A' },
    { uid: 'g2', displayName: 'Cô B' },
  ]),
}));
vi.mock('../services/announcementService', () => svc);

const office = vi.hoisted(() => ({
  notices: [] as any[],
  acks: new Map(),
  now: new Date(2026, 9, 23, 10, 0).getTime(),
  pendingCount: 0,
  reminders: [],
  loading: false,
  refresh: vi.fn(async () => {}),
  ack: vi.fn(async () => {}),
}));
vi.mock('../context/OfficeNoticesContext', () => ({ useOfficeNotices: () => office }));
const officeSvc = vi.hoisted(() => ({
  createNotice: vi.fn(async () => 'office-new'),
  fetchAllNotices: vi.fn(async () => []),
  fetchAcks: vi.fn(async () => []),
  deleteNotice: vi.fn(async () => {}),
  setNoticePinned: vi.fn(async () => {}),
  newNoticeId: vi.fn(() => 'office-new'),
  uploadNoticeFile: vi.fn(async () => ({ name: 'a.pdf', fileId: 'f1', size: 1, type: 'application/pdf' })),
  downloadNoticeFile: vi.fn(async () => new Blob()),
}));
vi.mock('../services/officeNoticeService', () => officeSvc);
vi.mock('../services/noticeGroupService', () => ({ fetchNoticeGroups: vi.fn(async () => []), saveNoticeGroups: vi.fn(async () => {}) }));
vi.mock('../services/substitutionService', () => ({
  syncStaffDirectory: vi.fn(async () => {}),
  fetchStaffDirectoryPublic: vi.fn(async () => []),
}));

import { AnnouncementsPage } from '../pages/AnnouncementsPage';
import { AnnouncementBanner } from '../components/announcements/AnnouncementBanner';

const ann = (over: Partial<Announcement> = {}): Announcement => ({
  id: 'a1',
  title: 'Họp hội đồng sư phạm',
  body: 'Chiều thứ 6, phòng họp tầng 2.',
  level: 'urgent',
  audience: { toStaff: true, toParents: false, toStudents: false, classId: null },
  audienceKeys: ['staff'],
  classId: null,
  forwardableToParents: true,
  authorId: 'u-admin',
  authorName: 'Cô Hiệu trưởng',
  authorRole: 'admin',
  createdAt: new Date(2026, 9, 10, 8, 0).getTime(),
  ...over,
});

const renderPage = (path = '/announcements') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AnnouncementsPage />
    </MemoryRouter>
  );

describe('Trang Thông báo', () => {
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockClear());
    Object.values(officeSvc).forEach((f) => f.mockClear());
    office.notices = [];
    office.acks = new Map();
    ctx.markRead.mockClear();
    ctx.items = [ann()];
    ctx.readIds = new Set();
    authState.activeRole = 'admin';
    authState.profile = { ...authState.profile, uid: 'u-admin', assignedClassId: undefined };
  });

  it('hiển thị thông báo chưa đọc với nhãn MỚI và mức khẩn', () => {
    renderPage();
    const row = screen.getByTestId('ann-a1');
    expect(row).toHaveTextContent('MỚI');
    expect(row).toHaveTextContent('Khẩn cấp');
  });

  it('mở thông báo → đánh dấu đã đọc; BGH thấy ai đã đọc và GV chưa đọc', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('ann-a1'));
    await waitFor(() => expect(ctx.markRead).toHaveBeenCalledWith('a1'));
    expect(await screen.findByTestId('not-read-list')).toHaveTextContent('Cô B');
    expect(screen.getByText(/Thầy A/)).toBeInTheDocument();
  });

  it('nút chuyển tiếp Zalo hiện cho nhân sự khi thông báo cho phép', async () => {
    renderPage('/announcements?open=a1');
    expect(await screen.findByText(/Chuyển tiếp cho phụ huynh/)).toBeInTheDocument();
  });

  it('phụ huynh không thấy nút soạn, không thấy nút chuyển tiếp, không xem thống kê', async () => {
    authState.activeRole = 'parent';
    authState.profile = { ...authState.profile, uid: 'ph_1' };
    ctx.items = [ann({ authorId: 'u-admin', audienceKeys: ['parent:all'] })];
    renderPage('/announcements?open=a1');
    expect(screen.queryByText('Soạn thông báo')).toBeNull();
    await waitFor(() => expect(ctx.markRead).toHaveBeenCalled());
    expect(screen.queryByText(/Chuyển tiếp cho phụ huynh/)).toBeNull();
    expect(svc.fetchReaders).not.toHaveBeenCalled();
  });

  it('GVBM không được soạn; GVCN soạn được, phạm vi khóa vào lớp chủ nhiệm', async () => {
    authState.activeRole = 'gvbm';
    const { unmount } = renderPage();
    expect(screen.queryByText('Soạn thông báo')).toBeNull();
    unmount();

    authState.activeRole = 'gvcn';
    authState.profile = { ...authState.profile, uid: 'u-gvcn', assignedClassId: '6A1' };
    renderPage();
    fireEvent.click(screen.getByText('Soạn thông báo'));
    expect(screen.getByText(/lớp chủ nhiệm 6A1/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Họp phụ huynh' } });
    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'Tối thứ 6 lúc 19h.' } });
    fireEvent.click(screen.getByText('Gửi thông báo'));
    await waitFor(() => expect(svc.createAnnouncement).toHaveBeenCalled());
    const [input] = svc.createAnnouncement.mock.calls[0] as any[];
    expect(input.audience).toEqual({ toStaff: false, toParents: true, toStudents: false, classId: '6A1' });
    expect(ctx.markRead).toHaveBeenCalledWith('new-id');
  });

  it('không gửi khi thiếu tiêu đề', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Soạn thông báo'));
    fireEvent.click(screen.getByText('Gửi thông báo'));
    expect(await screen.findByText(/nhập tiêu đề/)).toBeInTheDocument();
    expect(svc.createAnnouncement).not.toHaveBeenCalled();
  });
});

describe('Thông báo gộp (trường + Văn phòng)', () => {
  const vp = (over: any = {}) => ({
    id: 'o1', title: 'Nộp kế hoạch tuần', body: 'Trước thứ 6', tags: ['gvcn'], recipientUids: ['u-gv'], pinned: false,
    requiresDone: true, deadlineAt: null, remindBefore: [], authorId: 'vp', authorName: 'Văn phòng',
    createdAt: new Date(2026, 9, 22, 8, 0).getTime(), updatedAt: 0, ...over,
  });
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockClear());
    Object.values(officeSvc).forEach((f) => f.mockClear());
    ctx.items = [ann({ level: 'normal' })];
    ctx.readIds = new Set(['a1']);
    office.notices = [vp()];
    office.acks = new Map();
    authState.activeRole = 'gvbm';
    authState.profile = { ...authState.profile, uid: 'u-gv', assignedClassId: undefined };
  });

  it('1 hộp thư hiện cả 2 nguồn; lọc "Cần thực hiện" chỉ còn việc Văn phòng', () => {
    renderPage();
    expect(screen.getAllByTestId('notice-item')).toHaveLength(1);
    expect(screen.getByTestId('ann-a1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cần thực hiện/ }));
    expect(screen.queryByTestId('ann-a1')).toBeNull();
    expect(screen.getByTestId('notice-item')).toHaveTextContent('Nộp kế hoạch tuần');
  });

  it('Esc đóng khung chi tiết', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('notice-item'));
    expect(await screen.findByTestId('notice-detail')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('notice-detail')).toBeNull());
  });

  it('BGH soạn 1 lần gửi cả nhân sự + phụ huynh → tạo 2 bản ghi', async () => {
    authState.activeRole = 'admin';
    authState.profile = { ...authState.profile, uid: 'u-admin' };
    svc.fetchStaffDirectory.mockResolvedValueOnce([
      { uid: 'g1', displayName: 'Thầy A', roles: ['gvbm'] },
      { uid: 'g2', displayName: 'Cô B', roles: ['gvcn'] },
    ] as any);
    renderPage();
    fireEvent.click(screen.getByText('Soạn thông báo'));
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Họp toàn trường' } });
    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'Sáng thứ 2.' } });
    await waitFor(() => expect(screen.getByTestId('recipient-count')).toHaveTextContent('2'));
    fireEvent.click(screen.getByTestId('aud-parents'));
    fireEvent.click(screen.getByTestId('requires-done'));
    fireEvent.click(screen.getByText('Gửi thông báo'));
    await waitFor(() => expect(officeSvc.createNotice).toHaveBeenCalled());
    await waitFor(() => expect(svc.createAnnouncement).toHaveBeenCalled());
    const [n] = officeSvc.createNotice.mock.calls[0] as any[];
    expect(n.requiresDone).toBe(true);
    expect(n.recipientUids).toHaveLength(2);
    const [a] = svc.createAnnouncement.mock.calls[0] as any[];
    expect(a.audience).toEqual({ toStaff: false, toParents: true, toStudents: false, classId: null });
  });

  it('danh sách chưa đọc dài mặc định thu gọn, bấm để hiện / ẩn', async () => {
    authState.activeRole = 'admin';
    authState.profile = { ...authState.profile, uid: 'u-admin' };
    svc.fetchReaders.mockResolvedValueOnce([]);
    svc.fetchStaffDirectory.mockResolvedValue(['A', 'B', 'C', 'D', 'E'].map((x) => ({ uid: x, displayName: `GV ${x}` })) as any);
    ctx.items = [ann()];
    renderPage('/announcements?open=a1');
    const toggle = await screen.findByRole('button', { name: /Chưa đọc: 5/ });
    expect(screen.queryByTestId('not-read-list')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('not-read-list')).toHaveTextContent('GV E');
    fireEvent.click(toggle);
    expect(screen.queryByTestId('not-read-list')).toBeNull();
  });
});

describe('Banner khẩn', () => {
  it('ẩn khi không có thông báo khẩn chưa đọc; hiện tiêu đề khi có', () => {
    ctx.urgentUnread = [];
    const { unmount } = render(
      <MemoryRouter>
        <AnnouncementBanner />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('urgent-banner')).toBeNull();
    unmount();
    ctx.urgentUnread = [ann(), ann({ id: 'a2', title: 'Khác' })];
    render(
      <MemoryRouter>
        <AnnouncementBanner />
      </MemoryRouter>
    );
    expect(screen.getByTestId('urgent-banner')).toHaveTextContent('Họp hội đồng sư phạm');
    expect(screen.getByTestId('urgent-banner')).toHaveTextContent('+1');
  });
});
