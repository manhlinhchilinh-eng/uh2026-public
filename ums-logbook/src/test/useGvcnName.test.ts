import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const authState: { profile: any } = { profile: null };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));

const fetchMock = vi.fn();
vi.mock('../services/dashboardService', () => ({ fetchClassGvcnName: (id: string) => fetchMock(id) }));

import { useGvcnName } from '../hooks/useGvcnName';

describe('useGvcnName — tên GVCN thật, không dùng tên demo', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    authState.profile = null;
  });

  it('lấy tên từ Firestore classes (6A8 → Phạm Thị Nga), không phải "Đặng Bảo Giang"', async () => {
    fetchMock.mockResolvedValue('Phạm Thị Nga');
    const { result } = renderHook(() => useGvcnName('6A8'));
    await waitFor(() => expect(result.current).toBe('Phạm Thị Nga'));
    expect(result.current).not.toBe('Đặng Bảo Giang');
    expect(fetchMock).toHaveBeenCalledWith('6A8');
  });

  it('GVCN xem lớp mình: dùng tên tài khoản khi Firestore chưa có tên', async () => {
    authState.profile = { assignedClassId: '6A8', displayName: 'Phạm Thị Nga' };
    fetchMock.mockResolvedValue('');
    const { result } = renderHook(() => useGvcnName('6A8'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe('Phạm Thị Nga');
  });

  it('lỗi đọc → chuỗi rỗng (UI hiện "Chưa phân công"), không hiện tên demo', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useGvcnName('7A1'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe('');
  });
});
