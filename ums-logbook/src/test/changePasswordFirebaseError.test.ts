/**
 * Lỗi 05/11/2026 (cô Kim Khánh): đổi MK báo thành công nhưng Firebase không đổi.
 * changePassword phải báo lỗi và KHÔNG bỏ cờ mustChangePassword khi Firebase từ chối.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({
  reauth: vi.fn(),
  updatePassword: vi.fn(),
  updateDoc: vi.fn(async () => {}),
}));

vi.mock('../config/firebase', () => ({
  auth: { currentUser: { uid: 'u1', email: 'mskimkhanhums@ums.edu.vn' } },
  db: {},
}));
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<typeof import('firebase/auth')>()),
  EmailAuthProvider: { credential: (email: string, pw: string) => ({ email, pw }) },
  reauthenticateWithCredential: fx.reauth,
  updatePassword: fx.updatePassword,
}));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  updateDoc: fx.updateDoc,
}));
vi.mock('../services/auditService', () => ({ logAuditEvent: vi.fn(async () => {}) }));

import { changePassword } from '../services/authService';

beforeEach(() => {
  fx.reauth.mockReset();
  fx.updatePassword.mockReset();
  fx.updateDoc.mockClear();
  localStorage.clear();
});

describe('changePassword — không nuốt lỗi Firebase', () => {
  it('sai mật khẩu hiện tại → báo lỗi, không bỏ cờ mustChangePassword', async () => {
    fx.reauth.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    await expect(changePassword('SaiMatKhau1', 'MoiMatKhau9')).rejects.toThrow('Mật khẩu hiện tại không chính xác.');
    expect(fx.updatePassword).not.toHaveBeenCalled();
    expect(fx.updateDoc).not.toHaveBeenCalled();
  });

  it('lỗi mạng → báo lỗi mạng, không bỏ cờ', async () => {
    fx.reauth.mockResolvedValueOnce(undefined);
    fx.updatePassword.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/network-request-failed' }));
    await expect(changePassword('CuMatKhau1', 'MoiMatKhau9')).rejects.toThrow('Không kết nối được máy chủ');
    expect(fx.updateDoc).not.toHaveBeenCalled();
  });

  it('Firebase đổi thành công → bỏ cờ mustChangePassword', async () => {
    fx.reauth.mockResolvedValueOnce(undefined);
    fx.updatePassword.mockResolvedValueOnce(undefined);
    await changePassword('CuMatKhau1', 'MoiMatKhau9');
    expect(fx.updatePassword).toHaveBeenCalledTimes(1);
    expect(fx.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, expect.objectContaining({ mustChangePassword: false }));
  });
});
