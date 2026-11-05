import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const authState = vi.hoisted(() => ({
  activeRole: 'vanphong' as string,
  profile: {
    uid: 'u-vp',
    displayName: 'Văn phòng UMS',
    username: 'vanphongums',
    roles: ['vanphong'],
  } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../components/common/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const docSvc = vi.hoisted(() => ({
  fetchAdminDocs: vi.fn(async (): Promise<any[]> => []),
  fetchAdminDocsSince: vi.fn(async (): Promise<any[]> => []),
  newAdminDocId: vi.fn(() => 'doc-new-1'),
  createAdminDoc: vi.fn(async () => 'doc-new-1'),
  updateAdminDoc: vi.fn(async () => {}),
  deleteAdminDoc: vi.fn(async () => {}),
  uploadAdminDocFile: vi.fn(async (_docId: string, file: File) => ({
    name: file.name,
    fileId: 'file-1',
    size: file.size,
    type: file.type || 'application/pdf',
  })),
  downloadAdminDocFile: vi.fn(async () => new Blob(['ok'])),
}));
vi.mock('../services/adminDocService', () => docSvc);

const noticeSvc = vi.hoisted(() => ({ createNotice: vi.fn(async () => 'notice-1') }));
vi.mock('../services/officeNoticeService', () => noticeSvc);
const dirSvc = vi.hoisted(() => ({
  fetchStaffDirectoryPublic: vi.fn(async () => [
    { uid: 'gv1', displayName: 'Cô A', roles: ['gvbm'] },
    { uid: 'gv2', displayName: 'Thầy B', roles: ['gvcn'], assignedClassId: '6A1' },
  ]),
}));
vi.mock('../services/substitutionService', () => dirSvc);
const groupSvc = vi.hoisted(() => ({
  fetchNoticeGroups: vi.fn(async () => [{ id: 'g1', name: 'Tổ Anh', uids: ['gv1'] }]),
}));
vi.mock('../services/noticeGroupService', () => groupSvc);

import { AdminDocsPage } from '../pages/AdminDocsPage';
import { clearAdminDocCache } from '../services/adminDocCache';

describe('Trang Hành chính – Văn bản (AdminDocsPage): tải tệp trực tiếp & nhắc nhở tránh quên', () => {
  beforeEach(() => {
    Object.values(docSvc).forEach((fn) => fn.mockClear());
    clearAdminDocCache();
    localStorage.clear();
    noticeSvc.createNotice.mockClear();
    dirSvc.fetchStaffDirectoryPublic.mockClear();
    authState.activeRole = 'vanphong';
  });

  it('không bắt buộc link hoặc tệp: bấm Lưu lần 1 hiện nhắc nhở, bấm lần 2 lưu thành công', async () => {
    render(
      <MemoryRouter>
        <AdminDocsPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('admin-doc-new'));
    fireEvent.change(screen.getByLabelText('Tên tài liệu'), {
      target: { value: 'CÙNG UMS BÙNG NỔ VỚI CHUNG KẾT UMS GOT TALENT MÙA 5!' },
    });
    fireEvent.change(screen.getByLabelText('Mô tả'), {
      target: { value: 'Danh sách 18 tiết mục vào vòng Chung kết.' },
    });

    // Bấm Lưu lần 1 khi chưa có cả tệp lẫn link → hiện nhắc nhở màu vàng, chưa gọi createAdminDoc
    fireEvent.click(screen.getByTestId('admin-doc-save'));
    expect(await screen.findByTestId('admin-doc-no-file-reminder')).toHaveTextContent(
      /Bạn chưa đính kèm tệp hoặc dán link tài liệu/
    );
    expect(docSvc.createAdminDoc).not.toHaveBeenCalled();

    // Bấm lần 2 ("Vẫn lưu (không đính kèm)") → lưu thành công
    fireEvent.click(screen.getByTestId('admin-doc-save'));
    await waitFor(() => expect(docSvc.createAdminDoc).toHaveBeenCalledTimes(1));
    const [savedInput] = docSvc.createAdminDoc.mock.calls[0] as any[];
    expect(savedInput.title).toBe('CÙNG UMS BÙNG NỔ VỚI CHUNG KẾT UMS GOT TALENT MÙA 5!');
    expect(savedInput.url).toBe('');
    expect(savedInput.attachments).toEqual([]);
  });

  it('nhắc ghi nội dung chính khi có link mà mô tả ngắn; ẩn khi mô tả ≥ 80 ký tự', async () => {
    render(
      <MemoryRouter>
        <AdminDocsPage />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByTestId('admin-doc-new'));
    expect(screen.queryByTestId('assistant-content-hint')).toBeNull();
    fireEvent.change(screen.getByLabelText('Link tài liệu'), { target: { value: 'https://drive.google.com/x' } });
    expect(screen.getByTestId('assistant-content-hint')).toHaveTextContent(/Trợ lý UMS\+/);
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'x'.repeat(80) } });
    expect(screen.queryByTestId('assistant-content-hint')).toBeNull();
  });

  it('hỗ trợ tải tệp trực tiếp từ máy (không cần dán link) và lưu ngay ở lần bấm đầu tiên', async () => {
    render(
      <MemoryRouter>
        <AdminDocsPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('admin-doc-new'));
    fireEvent.change(screen.getByLabelText('Tên tài liệu'), {
      target: { value: 'Thể lệ Chung kết Got Talent' },
    });

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'the-le.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Chọn tệp đính kèm'), {
      target: { files: [file] },
    });

    expect(await screen.findByTestId('admin-doc-upload-list')).toHaveTextContent('the-le.pdf');

    // Có tệp đính kèm → bấm Lưu 1 lần là tải tệp & lưu luôn, không hiện nhắc nhở
    fireEvent.click(screen.getByTestId('admin-doc-save'));
    await waitFor(() => expect(docSvc.uploadAdminDocFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(docSvc.createAdminDoc).toHaveBeenCalledTimes(1));
    const [savedInput] = docSvc.createAdminDoc.mock.calls[0] as any[];
    expect(savedInput.url).toBe('');
    expect(savedInput.attachments).toEqual([
      { name: 'the-le.pdf', fileId: 'file-1', size: 4, type: 'application/pdf' },
    ]);
  });

  it('không tick "Chuyển tiếp thành thông báo" → chỉ lưu văn bản, không tải danh bạ, không tạo thông báo', async () => {
    render(
      <MemoryRouter>
        <AdminDocsPage />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByTestId('admin-doc-new'));
    fireEvent.change(screen.getByLabelText('Tên tài liệu'), { target: { value: 'Quy chế chi tiêu nội bộ' } });
    fireEvent.change(screen.getByLabelText('Link tài liệu'), { target: { value: 'https://drive.google.com/file/d/abc' } });
    fireEvent.click(screen.getByTestId('admin-doc-save'));
    await waitFor(() => expect(docSvc.createAdminDoc).toHaveBeenCalledTimes(1));
    expect(noticeSvc.createNotice).not.toHaveBeenCalled();
    expect(dirSvc.fetchStaffDirectoryPublic).not.toHaveBeenCalled();
  });

  it('tick "Chuyển tiếp thành thông báo" + tệp → tạo văn bản rồi tạo 1 thông báo cho nhóm chọn, tệp trỏ về văn bản gốc', async () => {
    render(
      <MemoryRouter>
        <AdminDocsPage />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByTestId('admin-doc-new'));
    fireEvent.change(screen.getByLabelText('Tên tài liệu'), { target: { value: 'Kế hoạch thi giữa kỳ I' } });
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Lịch thi từ 10/11.' } });
    fireEvent.change(screen.getByLabelText('Số hiệu'), { target: { value: '12/KH-THCSNN' } });
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'ke-hoach.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Chọn tệp đính kèm'), { target: { files: [file] } });

    fireEvent.click(screen.getByTestId('admin-doc-forward-toggle'));
    // Bỏ "Toàn thể GV", chỉ chọn nhóm "Tổ Anh"
    fireEvent.click(await screen.findByLabelText('Nhãn Toàn thể GV'));
    fireEvent.click(screen.getByLabelText('Nhóm Tổ Anh'));
    expect(screen.getByTestId('recipient-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByTestId('admin-doc-save'));
    await waitFor(() => expect(noticeSvc.createNotice).toHaveBeenCalledTimes(1));
    expect(docSvc.createAdminDoc).toHaveBeenCalledTimes(1);
    expect(docSvc.uploadAdminDocFile.mock.calls[0][0]).toBe('doc-new-1');
    const [n] = noticeSvc.createNotice.mock.calls[0] as any[];
    expect(n.title).toBe('Kế hoạch thi giữa kỳ I');
    expect(n.body).toContain('Lịch thi từ 10/11.');
    expect(n.body).toContain('Số 12/KH-THCSNN');
    expect(n.recipientUids).toEqual(['gv1']);
    expect(n.groupNames).toEqual(['Tổ Anh']);
    expect(n.attachments).toEqual([{ name: 'ke-hoach.pdf', fileId: 'file-1', size: 4, type: 'application/pdf', srcDocId: 'doc-new-1' }]);
    // Danh bạ chỉ tải 1 lần khi tick
    expect(dirSvc.fetchStaffDirectoryPublic).toHaveBeenCalledTimes(1);
  });

  it('tick nhưng không chọn người nhận → báo lỗi, không lưu gì', async () => {
    render(
      <MemoryRouter>
        <AdminDocsPage />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByTestId('admin-doc-new'));
    fireEvent.change(screen.getByLabelText('Tên tài liệu'), { target: { value: 'Biểu mẫu A' } });
    fireEvent.change(screen.getByLabelText('Link tài liệu'), { target: { value: 'https://drive.google.com/x' } });
    fireEvent.click(screen.getByTestId('admin-doc-forward-toggle'));
    fireEvent.click(await screen.findByLabelText('Nhãn Toàn thể GV'));
    fireEvent.click(screen.getByTestId('admin-doc-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/chọn ít nhất một/);
    expect(docSvc.createAdminDoc).not.toHaveBeenCalled();
    expect(noticeSvc.createNotice).not.toHaveBeenCalled();
  });

  const sample = {
    id: 'doc-x',
    title: 'Quyết định Got Talent',
    category: 'van_ban',
    url: '',
    description: 'Danh sách HS A, HS B vào chung kết.',
    docNumber: '',
    issuedDate: '',
    pinned: false,
    authorId: 'a',
    authorName: 'VP',
    createdAt: 1,
    updatedAt: 2,
  };

  it('?open=<id> mở chi tiết văn bản', async () => {
    docSvc.fetchAdminDocs.mockResolvedValueOnce([sample]);
    render(
      <MemoryRouter initialEntries={['/hanh-chinh?open=doc-x']}>
        <AdminDocsPage />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('admin-doc-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-doc-open-missing')).not.toBeInTheDocument();
  });

  it('?open=<id lạ> hiện ghi chú không chặn', async () => {
    docSvc.fetchAdminDocs.mockResolvedValueOnce([sample]);
    render(
      <MemoryRouter initialEntries={['/hanh-chinh?open=khong-co']}>
        <AdminDocsPage />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('admin-doc-open-missing')).toHaveTextContent(/không còn hoặc bạn không có quyền/);
    expect(screen.queryByTestId('admin-doc-detail')).not.toBeInTheDocument();
  });
});
