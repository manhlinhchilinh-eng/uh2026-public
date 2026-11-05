import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PLATFORM_MODULES, modulesForRole } from '../config/modules';
import { BRAND_CONFIG } from '../config/brand';
import { BRAND_APP_META } from '../components/common/BrandMark';

const authState = vi.hoisted(() => ({ activeRole: 'gvbm' as string | null }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));

import { AppsPage } from '../pages/AppsPage';

const openTools = () => fireEvent.click(screen.getByRole('button', { name: /Mở \d+ công cụ/ }));

describe('Phân hệ UMS SmartConnect', () => {
  it('id duy nhất; ô "đang chạy"/"nội bộ" mở được hoặc ghi rõ; ô "đang phát triển" không có link', () => {
    const ids = PLATFORM_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of PLATFORM_MODULES) {
      if (m.status === 'building') expect(m.path ?? m.externalUrl).toBeUndefined();
      if (m.status === 'live') expect(m.path ?? m.externalUrl).toBeTruthy();
      if (m.externalUrl) expect(m.externalUrl).toMatch(/^https:\/\//);
    }
  });

  it('Dashboard BGH chỉ hiện cho admin; công cụ GV không hiện cho TPT/PH', () => {
    expect(modulesForRole('admin').some((m) => m.id === 'bgh-dashboard')).toBe(true);
    expect(modulesForRole('gvcn').some((m) => m.id === 'bgh-dashboard')).toBe(false);
    expect(modulesForRole('parent').some((m) => m.id === 'omr')).toBe(false);
    expect(modulesForRole('tpt').some((m) => m.id === 'eng9hub')).toBe(false);
    expect(modulesForRole(null).every((m) => !m.roles)).toBe(true);
  });

  it('trang hiển thị đúng ô theo vai trò và nhãn trạng thái thật', () => {
    authState.activeRole = 'gvbm';
    render(
      <MemoryRouter>
        <AppsPage />
      </MemoryRouter>
    );
    expect(screen.getByTestId('module-logbook')).toHaveTextContent('Đang chạy');
    expect(screen.getByTestId('module-leave')).toHaveTextContent('Đang chạy');
    expect(screen.getByTestId('module-eportfolio')).toHaveTextContent('Đang chạy');
    expect(screen.queryByTestId('module-bgh-dashboard')).toBeNull();
    expect(screen.queryByTestId('module-omr')).toBeNull();
    openTools();
    expect(screen.getByTestId('module-omr')).toBeInTheDocument();
  });

  it('mỗi phân hệ có logoSlug hợp lệ trong bộ 8 logo UMS+ và giữ nguyên logo chính thức của trường UMS (/logo.jpg)', () => {
    expect(BRAND_CONFIG.logoPath).toBe('/logo.jpg');
    for (const m of PLATFORM_MODULES) {
      expect(m.logoSlug).toBeTruthy();
      expect(BRAND_APP_META[m.logoSlug!]).toBeDefined();
    }
    authState.activeRole = 'admin';
    render(
      <MemoryRouter>
        <AppsPage />
      </MemoryRouter>
    );
    openTools();
    expect(screen.getAllByTestId('brand-mark-umsplus').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('brand-mark-logbook').length).toBeGreaterThan(1); // Sổ đầu bài + Sổ điểm môn học
    expect(screen.getByTestId('brand-mark-practice')).toBeInTheDocument();
    expect(screen.getByTestId('brand-mark-grading')).toBeInTheDocument();
    expect(screen.getByTestId('brand-mark-eng9hub')).toBeInTheDocument();
    expect(screen.getAllByTestId('brand-mark-homeroom9').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('brand-mark-eportfolio').length).toBeGreaterThan(0);
    expect(screen.getByTestId('brand-mark-esl')).toBeInTheDocument();
  });

  it('8 công cụ học tập/đánh giá (Sổ điểm + 7 app khối 9) gom vào 1 thẻ, bấm mới hiện; mỗi vai trò chỉ thấy lối vào của mình', () => {
    const k9 = PLATFORM_MODULES.filter((m) => m.group);
    expect(k9.map((m) => m.id).sort()).toEqual(
      ['eng9hub', 'gradebook', 'k9-analytics', 'k9-homeroom', 'k9-survey-scores', 'omr', 'parent-portal', 'practice']
    );
    for (const m of k9) expect(m.shortName && m.shortNameEn).toBeTruthy();

    authState.activeRole = 'gvbm';
    const { unmount } = render(
      <MemoryRouter>
        <AppsPage />
      </MemoryRouter>
    );
    expect(screen.getByTestId('module-group-k9')).toHaveTextContent('Học tập & Đánh giá');
    expect(screen.queryByTestId('module-group-tools')).toBeNull();
    expect(screen.getByRole('button', { name: /Mở 8 công cụ/ })).toBeInTheDocument();
    openTools();
    const tools = screen.getByTestId('module-group-tools');
    expect(tools).toContainElement(screen.getByTestId('module-omr'));
    expect(tools).toContainElement(screen.getByTestId('module-k9-homeroom'));
    expect(tools).toContainElement(screen.getByTestId('module-gradebook'));
    expect(tools).not.toContainElement(screen.getByTestId('module-logbook'));
    unmount();

    authState.activeRole = 'parent';
    render(
      <MemoryRouter>
        <AppsPage />
      </MemoryRouter>
    );
    openTools();
    expect(screen.getByTestId('module-group-tools')).toContainElement(screen.getByTestId('module-parent-portal'));
    expect(screen.queryByTestId('module-omr')).toBeNull();
    expect(screen.queryByTestId('module-k9-homeroom')).toBeNull();
    expect(screen.queryByTestId('module-gradebook')).toBeNull();
  });
});
