/**
 * UMS Digital Class Logbook - Audit UI Components Test Suite
 * Milestone 6: AuditLogViewer, AuditDiffModal & IdleTimeoutModal Components
 * Path: src/test/auditComponents.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { IdleTimeoutModal } from '../components/common/IdleTimeoutModal';
import { AuditDiffModal } from '../components/admin/AuditDiffModal';
import { AuditLogViewer } from '../components/admin/AuditLogViewer';
import { logAuditEvent, clearAuditLogsMock } from '../services/auditService';
import { AuditLogEntry } from '../types/audit';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Milestone 6: Audit UI & Idle Timeout Components Suite', () => {
  beforeEach(() => {
    clearAuditLogsMock();
    localStorage.clear();
  });

  describe('1. IdleTimeoutModal Component', () => {
    it('1.1: renders countdown and labels correctly when isOpen is true', () => {
      render(
        <IdleTimeoutModal
          isOpen={true}
          remainingSeconds={300}
          onExtend={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      expect(screen.getByTestId('idle-countdown-timer')).toHaveTextContent('5:00');
      expect(screen.getByText(/Tiếp tục làm việc/i)).toBeInTheDocument();
      expect(screen.getByTestId('idle-logout-btn')).toHaveTextContent(/Đăng xuất/i);
    });

    it('1.2: does not render anything when isOpen is false', () => {
      const { container } = render(
        <IdleTimeoutModal
          isOpen={false}
          remainingSeconds={300}
          onExtend={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('1.3: triggers onExtend / resetActivity callback when clicking stay logged in', () => {
      const onExtend = vi.fn();
      render(
        <IdleTimeoutModal
          isOpen={true}
          remainingSeconds={120}
          onExtend={onExtend}
          onLogout={vi.fn()}
        />
      );

      act(() => {
        screen.getByTestId('idle-extend-btn').click();
      });

      expect(onExtend).toHaveBeenCalledTimes(1);
    });

    it('1.4: triggers onLogout / logoutNow callback when clicking logout', () => {
      const onLogout = vi.fn();
      render(
        <IdleTimeoutModal
          isOpen={true}
          remainingSeconds={60}
          onExtend={vi.fn()}
          onLogout={onLogout}
        />
      );

      act(() => {
        screen.getByTestId('idle-logout-btn').click();
      });

      expect(onLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. AuditDiffModal Component', () => {
    const sampleEntry: AuditLogEntry = {
      id: 'audit_test_diff_1',
      actorId: 'mrlinhums',
      actorName: 'Nguyễn Mạnh Linh',
      actorRole: 'admin',
      action: 'UPDATE',
      targetCollection: 'daily_logbooks',
      targetId: '9A3_2026-10-01',
      beforeState: {
        status: 'draft',
        isCompleted: false,
        score: 8.5,
      },
      afterState: {
        status: 'completed',
        isCompleted: true,
        score: 9.5,
        newCriterion: 'good',
      },
      timestamp: 1727600000000,
      details: 'Cập nhật hoàn thành sổ đầu bài',
    };

    it('2.1: renders modal with actor metadata and action info', () => {
      render(
        <AuditDiffModal
          entry={sampleEntry}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/Chi tiết sự kiện kiểm toán #audit_test_diff_1/i)).toBeInTheDocument();
      expect(screen.getByText(/Nguyễn Mạnh Linh/i)).toBeInTheDocument();
      expect(screen.getByText('daily_logbooks')).toBeInTheDocument();
      expect(screen.getByText('9A3_2026-10-01')).toBeInTheDocument();
      expect(screen.getByText(/Cập nhật hoàn thành sổ đầu bài/i)).toBeInTheDocument();
    });

    it('2.2: renders diff table highlighting modified, added, removed properties', () => {
      render(
        <AuditDiffModal
          entry={sampleEntry}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('status')).toBeInTheDocument();
      expect(screen.getByText('isCompleted')).toBeInTheDocument();
      expect(screen.getByText('score')).toBeInTheDocument();
      expect(screen.getByText('newCriterion')).toBeInTheDocument();
      expect(screen.getAllByText('sửa').length).toBeGreaterThan(0);
      expect(screen.getAllByText('mới').length).toBeGreaterThan(0);
    });

    it('2.3: does not render when isOpen is false or entry is null', () => {
      const { container } = render(
        <AuditDiffModal
          entry={null}
          isOpen={false}
          onClose={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('3. AuditLogViewer Component', () => {
    it('3.1: renders toolbar, filters, search, and export buttons', async () => {
      await logAuditEvent({
        action: 'CREATE',
        targetCollection: 'behavior_notes',
        targetId: 'note_1',
        details: 'Ghi nhận hành vi tốt',
        actor: { actorId: 'tpt1', actorName: 'Hoàng Long', actorRole: 'tpt' },
      });

      renderWithRouter(<AuditLogViewer />);

      expect(screen.getByTestId('audit-search-input')).toBeInTheDocument();
      expect(screen.getByTestId('audit-action-filter')).toBeInTheDocument();
      expect(screen.getByTestId('audit-collection-filter')).toBeInTheDocument();
      expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument();
      expect(screen.getByTestId('export-json-btn')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Hoàng Long')).toBeInTheDocument();
        expect(screen.getByText('Ghi nhận hành vi tốt')).toBeInTheDocument();
      });
    });

    it('3.2: filters table rows when selecting specific action', async () => {
      await logAuditEvent({
        action: 'CREATE',
        targetCollection: 'periods',
        targetId: 'p1',
        details: 'Tiết 1 Toán',
        actor: { actorId: 'u1', actorName: 'Giáo viên 1', actorRole: 'gvbm' },
      });

      await logAuditEvent({
        action: 'LOGIN',
        targetCollection: 'auth',
        targetId: 'u2',
        details: 'Đăng nhập',
        actor: { actorId: 'u2', actorName: 'Giáo viên 2', actorRole: 'gvcn' },
      });

      renderWithRouter(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('Tiết 1 Toán')).toBeInTheDocument();
        expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
      });

      // Filter by LOGIN
      const actionSelect = screen.getByTestId('audit-action-filter');
      fireEvent.change(actionSelect, { target: { value: 'LOGIN' } });

      await waitFor(() => {
        expect(screen.queryByText('Tiết 1 Toán')).not.toBeInTheDocument();
        expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
      });
    });
  });
});
