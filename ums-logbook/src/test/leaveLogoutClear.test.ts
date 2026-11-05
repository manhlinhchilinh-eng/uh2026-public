import { describe, it, expect, vi } from 'vitest';

const clearLeaveCaches = vi.hoisted(() => vi.fn());
vi.mock('../services/studentLeaveService', () => ({ clearLeaveCaches }));

import { logoutUser } from '../services/authService';

describe('Đăng xuất xoá cache đơn nghỉ', () => {
  it('logoutUser gọi clearLeaveCaches và xoá key sessionStorage ums_leave_*', async () => {
    sessionStorage.setItem('ums_leave_pending_6A1', '{}');
    sessionStorage.setItem('keep_me', '1');
    await logoutUser();
    await vi.waitFor(() => expect(clearLeaveCaches).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('ums_leave_pending_6A1')).toBeNull();
    expect(sessionStorage.getItem('keep_me')).toBe('1');
  });
});
