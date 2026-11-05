// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LanguageProvider } from '../../context/LanguageContext';
import { Bi } from '../common/Bi';
import { LanguageToggle } from '../common/LanguageToggle';
import { LoginForm } from '../auth/LoginForm';
import { PLATFORM_MODULES } from '../../config/modules';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn().mockResolvedValue(undefined),
    user: null,
    isLoading: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

describe('Bi & LanguageToggle & LoginForm (P4.2 + P4.4)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('Bi hiển thị song ngữ ở chế độ 2 ngữ và ẩn phụ ngữ ở chế độ 1 ngữ', () => {
    render(
      <LanguageProvider>
        <LanguageToggle variant="light" />
        <Bi vi="Bảng điều khiển" en="Dashboard" />
      </LanguageProvider>
    );

    expect(screen.getByText('Bảng điều khiển')).toBeTruthy();
    expect(screen.getByText(/Dashboard/)).toBeTruthy();

    // Chuyển sang 1 ngữ
    fireEvent.click(screen.getByTestId('bilingual-toggle'));
    expect(screen.getByText('Bảng điều khiển')).toBeTruthy();
    expect(screen.queryByText(/Dashboard/)).toBeNull();

    // Chuyển sang EN ở chế độ 1 ngữ
    fireEvent.click(screen.getByText('EN'));
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.queryByText('Bảng điều khiển')).toBeNull();
  });

  it('Bi hỗ trợ layout="stack" và vẫn giữ accessible name là ngôn ngữ chính', () => {
    render(
      <LanguageProvider>
        <button type="button">
          <Bi vi="Lưu điểm danh" en="Save Attendance" layout="stack" />
        </button>
      </LanguageProvider>
    );
    const btn = screen.getByRole('button', { name: 'Lưu điểm danh' });
    expect(btn).toBeTruthy();
    expect(screen.getByText('Save Attendance')).toBeTruthy();
  });

  it('LanguageToggle variant="light" có chữ tối trên nền sáng (không bị chữ trắng trên nền trắng)', () => {
    render(
      <LanguageProvider>
        <LanguageToggle variant="light" />
      </LanguageProvider>
    );
    const enBtn = screen.getByText('EN');
    expect(enBtn.className).toContain('text-slate-700');
    expect(enBtn.className).not.toContain('text-white/80');

    // Khi tắt chế độ song ngữ, nút bilingual-toggle cũng dùng màu tối dễ đọc trên nền sáng
    const modeBtn = screen.getByTestId('bilingual-toggle');
    fireEvent.click(modeBtn);
    expect(modeBtn.className).toContain('text-slate-700');
    expect(modeBtn.className).not.toContain('text-white/80');
  });

  it('Tất cả 13 phân hệ trong PLATFORM_MODULES đều có nhãn tiếng Anh nameEn', () => {
    expect(PLATFORM_MODULES.length).toBeGreaterThanOrEqual(13);
    for (const m of PLATFORM_MODULES) {
      expect((m.nameEn || '').trim().length).toBeGreaterThan(0);
    }
  });

  it('LoginForm có trọn bộ motion Orbital Rings + Comet Trails + UMS+ -> UMS SmartConnect + Khẩu hiệu tuần tự', () => {
    const { container } = render(
      <LanguageProvider>
        <LoginForm />
      </LanguageProvider>
    );

    expect(screen.getByTestId('login-network-bg')).toBeTruthy();
    expect(container.querySelectorAll('.animate-orbit-cw').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.animate-comet-trail').length).toBe(6);
    expect(screen.getByTestId('login-kinetic-title')).toBeTruthy();
    expect(screen.getByTestId('login-slogan-motion')).toBeTruthy();
    expect(screen.getByText('Một nền tảng')).toBeTruthy();

    // Từ bf6fb96 (05/11): chế độ Sáng mặc định dùng nút ngôn ngữ kiểu nền tối (chữ trắng)
    const enBtn = screen.getByText('EN');
    expect(enBtn.className).toContain('text-white/80');
    expect(screen.getByText('Tên đăng nhập')).toBeTruthy();
    expect(screen.getByText(/Username/)).toBeTruthy();
    expect(screen.getByText('Đăng nhập')).toBeTruthy();
    expect(screen.getByText(/Sign in/)).toBeTruthy();
  });
});
