/**
 * UMS Digital Class Logbook - Early Warning UI Components Unit Tests
 * Milestone 3: AlertFlag, EarlyWarningBanner, StudentProfileDrawer
 * Path: src/test/earlyWarningComponents.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertFlag } from '../components/behavior/AlertFlag';
import { EarlyWarningBanner } from '../components/behavior/EarlyWarningBanner';
import { StudentProfileDrawer } from '../components/behavior/StudentProfileDrawer';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { EarlyWarningAlert } from '../types/earlyWarning';
import { StudentDoc } from '../types';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <AuthProvider>
      <LanguageProvider>{ui}</LanguageProvider>
    </AuthProvider>
  );
};

describe('Milestone 3: Early Warning UI Components', () => {
  const mockWarningAlert: EarlyWarningAlert = {
    studentId: '269029',
    studentName: 'Trần Văn Nam',
    studentNumber: '01',
    classId: '6A1',
    level: 'warning',
    reasons: [
      {
        type: 'unexcused_absences',
        count: 3,
        threshold: 3,
        details: ['2026-09-24: Vắng không phép (K)'],
      },
    ],
    periodRange: {
      startDate: '2026-09-22',
      endDate: '2026-09-29',
    },
    detectedAt: Date.now(),
  };

  const mockCriticalAlert: EarlyWarningAlert = {
    studentId: '269963',
    studentName: 'Lê Hoàng Long',
    studentNumber: '02',
    classId: '6A1',
    level: 'critical',
    reasons: [
      {
        type: 'unexcused_absences',
        count: 3,
        threshold: 3,
        details: ['2026-09-24: Vắng không phép (K)'],
      },
      {
        type: 'negative_notes',
        count: 4,
        threshold: 3,
        details: ['2026-09-25: Quên sách giáo khoa'],
      },
    ],
    periodRange: {
      startDate: '2026-09-22',
      endDate: '2026-09-29',
    },
    detectedAt: Date.now(),
  };

  const mockStudent: StudentDoc = {
    id: '269029',
    mhs: '269029',
    name: 'Trần Văn Nam',
    stt: 1,
    grade: 6,
    gender: 'Nam',
    dob: '2014-05-12',
    classId: '6A1',
    status: 'active',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ums_students', JSON.stringify([mockStudent]));
    vi.clearAllMocks();
  });

  describe('1. AlertFlag Component', () => {
    it('renders warning alert badge with amber styling and text', () => {
      renderWithProviders(<AlertFlag alert={mockWarningAlert} />);

      expect(screen.getByText('Cảnh báo')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-amber-50');
    });

    it('renders critical alert badge with rose styling and text', () => {
      renderWithProviders(<AlertFlag alert={mockCriticalAlert} />);

      expect(screen.getByText('Khẩn cấp')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-rose-50');
    });

    it('renders compact mode without text label', () => {
      renderWithProviders(<AlertFlag alert={mockWarningAlert} compact={true} />);

      expect(screen.queryByText('Cảnh báo')).not.toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('displays tooltip on hover with detailed reasons', () => {
      renderWithProviders(<AlertFlag alert={mockCriticalAlert} />);

      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText(/3 buổi vắng không phép \(K\)/)).toBeInTheDocument();
      expect(screen.getByText(/4 lần ghi nhận vi phạm nề nếp/)).toBeInTheDocument();

      fireEvent.mouseLeave(container);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('triggers onClick on Enter and Space key presses', () => {
      const clickSpy = vi.fn();
      renderWithProviders(<AlertFlag alert={mockWarningAlert} onClick={clickSpy} />);

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(clickSpy).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(button, { key: ' ' });
      expect(clickSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('2. EarlyWarningBanner Component', () => {
    it('renders calm state when there are no alerts', () => {
      renderWithProviders(<EarlyWarningBanner alerts={[]} />);

      expect(screen.getByText('Tình hình nề nếp ổn định')).toBeInTheDocument();
      expect(
        screen.getByText('100% học sinh đạt chuẩn chuyên cần và nề nếp trong 7 ngày gần nhất.')
      ).toBeInTheDocument();
      expect(screen.getByText('Chuẩn UMS')).toBeInTheDocument();
    });

    it('renders active alert summary counts when alerts exist', () => {
      renderWithProviders(
        <EarlyWarningBanner alerts={[mockWarningAlert, mockCriticalAlert]} />
      );

      expect(
        screen.getByText(/Cảnh báo sớm: Phát hiện 2 học sinh cần can thiệp nề nếp & chuyên cần/)
      ).toBeInTheDocument();
      expect(screen.getByText('1 khẩn cấp')).toBeInTheDocument();
      expect(screen.getByText('1 cảnh báo')).toBeInTheDocument();
      expect(screen.getByText('Trần Văn Nam')).toBeInTheDocument();
      expect(screen.getByText('Lê Hoàng Long')).toBeInTheDocument();
    });

    it('toggles collapsible drawer on button click', () => {
      renderWithProviders(
        <EarlyWarningBanner alerts={[mockWarningAlert]} collapsible={true} />
      );

      expect(screen.getByText('Trần Văn Nam')).toBeInTheDocument();
      const toggleBtn = screen.getByRole('button', { name: /Thu gọn/i });
      fireEvent.click(toggleBtn);

      // Card list hidden
      expect(screen.queryByText('Trần Văn Nam')).not.toBeInTheDocument();
      expect(screen.getByText(/Xem chi tiết/)).toBeInTheDocument();
    });

    it('triggers onSelectStudent and onCreateNote callbacks', () => {
      const selectSpy = vi.fn();
      const noteSpy = vi.fn();

      renderWithProviders(
        <EarlyWarningBanner
          alerts={[mockWarningAlert]}
          onSelectStudent={selectSpy}
          onCreateNote={noteSpy}
        />
      );

      const viewProfileBtn = screen.getByText('Xem hồ sơ');
      fireEvent.click(viewProfileBtn);
      expect(selectSpy).toHaveBeenCalledWith('269029');

      const addNoteBtn = screen.getByText('Ghi nhận');
      fireEvent.click(addNoteBtn);
      expect(noteSpy).toHaveBeenCalledWith('269029', 'Trần Văn Nam', '6A1');
    });
  });

  describe('3. StudentProfileDrawer Component', () => {
    it('does not render when isOpen is false', () => {
      const { container } = renderWithProviders(
        <StudentProfileDrawer
          isOpen={false}
          onClose={vi.fn()}
          studentId="269029"
          classId="6A1"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders demographic details and calm state when no activeAlert is provided', async () => {
      renderWithProviders(
        <StudentProfileDrawer
          isOpen={true}
          onClose={vi.fn()}
          studentId="269029"
          classId="6A1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Trần Văn Nam')).toBeInTheDocument();
      });

      expect(screen.getByText('269029')).toBeInTheDocument();
      expect(screen.getByText('STT 1')).toBeInTheDocument();
      expect(screen.getByText('Nam')).toBeInTheDocument();
      expect(screen.getByText('Chuyên cần & nề nếp đạt chuẩn')).toBeInTheDocument();
    });

    it('renders active early warning details when activeAlert is provided', async () => {
      renderWithProviders(
        <StudentProfileDrawer
          isOpen={true}
          onClose={vi.fn()}
          studentId="269963"
          classId="6A1"
          activeAlert={mockCriticalAlert}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText('Cảnh báo Nghiêm trọng: Học sinh cần can thiệp khẩn cấp')
        ).toBeInTheDocument();
      });
      expect(
        screen.getByText(/3 buổi vắng không phép \(K\) trong 7 ngày gần nhất/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/4 lần bị ghi nhận vi phạm nề nếp/)
      ).toBeInTheDocument();
    });

    it('renders KPI metrics and switches timeline tabs', async () => {
      renderWithProviders(
        <StudentProfileDrawer
          isOpen={true}
          onClose={vi.fn()}
          studentId="269029"
          classId="6A1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Trần Văn Nam')).toBeInTheDocument();
      });

      expect(screen.getByText('Vắng không phép')).toBeInTheDocument();
      expect(screen.getByText('Vắng có phép')).toBeInTheDocument();
      expect(screen.getByText('Đi muộn')).toBeInTheDocument();
      expect(screen.getAllByText('Khen ngợi')[0]).toBeInTheDocument();

      const attendanceTab = screen.getByRole('button', { name: 'Chuyên cần' });
      fireEvent.click(attendanceTab);

      const reminderTab = screen.getByRole('button', { name: 'Nhắc nhở' });
      fireEvent.click(reminderTab);

      const praiseTab = screen.getByRole('button', { name: 'Khen ngợi' });
      fireEvent.click(praiseTab);
    });

    it('calls onClose on close button and Escape key', async () => {
      const closeSpy = vi.fn();
      renderWithProviders(
        <StudentProfileDrawer
          isOpen={true}
          onClose={closeSpy}
          studentId="269029"
          classId="6A1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Trần Văn Nam')).toBeInTheDocument();
      });

      const closeBtn = screen.getByLabelText('Đóng');
      fireEvent.click(closeBtn);
      expect(closeSpy).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(closeSpy).toHaveBeenCalledTimes(2);
    });

    it('calls onAddNote when add note action button is clicked', async () => {
      const addNoteSpy = vi.fn();
      renderWithProviders(
        <StudentProfileDrawer
          isOpen={true}
          onClose={vi.fn()}
          studentId="269029"
          classId="6A1"
          onAddNote={addNoteSpy}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('+ Thêm ghi nhận nề nếp')).toBeInTheDocument();
      });

      const addBtn = screen.getByText('+ Thêm ghi nhận nề nếp');
      fireEvent.click(addBtn);

      expect(addNoteSpy).toHaveBeenCalledWith('269029', 'Trần Văn Nam', '6A1');
    });
  });
});
