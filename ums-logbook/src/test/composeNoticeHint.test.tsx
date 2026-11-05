import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ activeRole: 'vanphong', profile: { uid: 'u-vp', displayName: 'Văn phòng', roles: ['vanphong'] } }),
}));
vi.mock('../services/announcementService', () => ({ createAnnouncement: vi.fn() }));
vi.mock('../services/officeNoticeService', () => ({
  createNotice: vi.fn(),
  newNoticeId: vi.fn(() => 'n1'),
  uploadNoticeFile: vi.fn(),
}));
vi.mock('../services/noticeGroupService', () => ({ fetchNoticeGroups: vi.fn(async () => []), saveNoticeGroups: vi.fn() }));

import { ComposeNoticeModal } from '../components/notices/ComposeNoticeModal';

describe('ComposeNoticeModal: nhắc ghi nội dung chính', () => {
  it('hiện khi có link + chữ ngắn, ẩn khi chữ ≥ 80 ký tự', async () => {
    render(
      <ComposeNoticeModal targets={{ staff: true, families: false, fixedClassId: null }} dir={[]} onClose={() => {}} onSent={() => {}} />
    );
    await waitFor(() => expect(screen.getByTestId('add-attachment')).toBeTruthy());
    expect(screen.queryByTestId('assistant-content-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('add-attachment'));
    fireEvent.change(screen.getByLabelText('Link tệp 1'), { target: { value: 'https://drive.google.com/x' } });
    expect(screen.getByTestId('assistant-content-hint')).toHaveTextContent(/Trợ lý UMS\+/);
    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'x'.repeat(80) } });
    expect(screen.queryByTestId('assistant-content-hint')).toBeNull();
  });
});
