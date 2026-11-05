/**
 * UMS Digital Class Logbook - Behavior UI Components Unit & Integration Tests
 * Milestone 3: BehaviorNoteCard, CreateBehaviorNoteModal, BehaviorNotesFilter, ConferenceSummaryModal, StudentNotesView
 * Path: src/test/behaviorComponents.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BehaviorNoteCard } from '../components/behavior/BehaviorNoteCard';
import { CreateBehaviorNoteModal } from '../components/behavior/CreateBehaviorNoteModal';
import { BehaviorNotesFilter } from '../components/behavior/BehaviorNotesFilter';
import { ConferenceSummaryModal } from '../components/behavior/ConferenceSummaryModal';
import { StudentNotesView } from '../components/behavior/StudentNotesView';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { BehaviorNote, StudentDoc } from '../types';

describe('Milestone 3: Behavior UI Components', () => {
  const mockPositiveNote: BehaviorNote = {
    id: 'note_pos_1',
    studentId: '269398',
    studentName: 'Lý Bảo Duy',
    studentNumber: 4,
    classId: '6A1',
    type: 'positive',
    category: 'active_participation',
    content: 'Phát biểu rất sôi nổi trong giờ Toán',
    description: 'Phát biểu rất sôi nổi trong giờ Toán',
    authorId: 'user_gvbm_math',
    authorName: 'Thầy Tuấn',
    authorRole: 'gvbm',
    subject: 'Toán học',
    periodIndex: 2,
    date: '2026-09-29',
    createdAt: 1759132800000,
    updatedAt: 1759132800000,
    timestamp: 1759132800000,
  };

  const mockNegativeNote: BehaviorNote = {
    id: 'note_neg_1',
    studentId: '269048',
    studentName: 'Đinh Minh Tùng',
    studentNumber: 5,
    classId: '6A1',
    type: 'negative',
    category: 'missing_homework',
    content: 'Quên vở bài tập Ngữ văn',
    description: 'Quên vở bài tập Ngữ văn',
    authorId: 'user_mrhoanglongums',
    authorName: 'Hoàng Long (TPT)',
    authorRole: 'tpt',
    date: '2026-09-29',
    createdAt: 1759132800000,
    updatedAt: 1759132800000,
    timestamp: 1759132800000,
  };

  const mockRoster: StudentDoc[] = [
    {
      id: '269398',
      mhs: '269398',
      stt: 4,
      name: 'Lý Bảo Duy',
      classId: '6A1',
      grade: 6,
      dob: '2015-07-04',
      gender: 'Nữ',
      status: 'active',
      createdAt: Date.now(),
    },
    {
      id: '269048',
      mhs: '269048',
      stt: 5,
      name: 'Đinh Minh Tùng',
      classId: '6A1',
      grade: 6,
      dob: '2015-11-20',
      gender: 'Nữ',
      status: 'active',
      createdAt: Date.now(),
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ums_students', JSON.stringify(mockRoster));
    localStorage.setItem('ums_auth_token', 'token_demo');
    localStorage.setItem(
      'ums_current_user',
      JSON.stringify({
        uid: 'user_admin',
        username: 'mrlinhums',
        displayName: 'Nguyễn Mạnh Linh',
        roles: ['admin', 'gvcn'],
        assignedClassId: '9A3',
        mustChangePassword: false,
      })
    );
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <LanguageProvider>
        <AuthProvider>{ui}</AuthProvider>
      </LanguageProvider>
    );
  };

  describe('1. BehaviorNoteCard Component', () => {
    it('renders positive note with emerald pill and [GVBM] role badge', () => {
      renderWithProviders(<BehaviorNoteCard note={mockPositiveNote} />);

      expect(screen.getByText('Lý Bảo Duy')).toBeInTheDocument();
      expect(screen.getByText('Phát biểu rất sôi nổi trong giờ Toán')).toBeInTheDocument();
      expect(screen.getByText('[GVBM Toán học]')).toBeInTheDocument();
      expect(screen.getByText(/Tiết 2/)).toBeInTheDocument();
    });

    it('renders negative note with rose pill and [TPT] role badge', () => {
      renderWithProviders(<BehaviorNoteCard note={mockNegativeNote} />);

      expect(screen.getByText('Đinh Minh Tùng')).toBeInTheDocument();
      expect(screen.getByText('Quên vở bài tập Ngữ văn')).toBeInTheDocument();
      expect(screen.getByText('[TPT]')).toBeInTheDocument();
    });

    it('handles delete action when confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const deleteSpy = vi.fn().mockResolvedValue(undefined);

      renderWithProviders(
        <BehaviorNoteCard note={mockPositiveNote} canDelete={true} onDelete={deleteSpy} />
      );

      const deleteBtn = screen.getByTitle('Xóa ghi nhận');
      fireEvent.click(deleteBtn);

      expect(deleteSpy).toHaveBeenCalledWith('note_pos_1');
    });

    it('triggers onStudentClick when student name clicked', () => {
      const clickSpy = vi.fn();
      renderWithProviders(
        <BehaviorNoteCard note={mockPositiveNote} onStudentClick={clickSpy} />
      );

      const nameBtn = screen.getByText('Lý Bảo Duy');
      fireEvent.click(nameBtn);

      expect(clickSpy).toHaveBeenCalledWith('269398');
    });
  });

  describe('2. CreateBehaviorNoteModal Component', () => {
    it('renders in-period mode with locked context tags', () => {
      renderWithProviders(
        <CreateBehaviorNoteModal
          isOpen={true}
          onClose={vi.fn()}
          classId="6A1"
          periodIndex={3}
          subject="Tiếng Anh"
          roster={mockRoster}
        />
      );

      expect(screen.getByText(/Ghi nhận nề nếp tiết 3/)).toBeInTheDocument();
      expect(screen.getByText(/Lớp 6A1 • Môn: Tiếng Anh/)).toBeInTheDocument();
    });

    it('toggles between positive and negative note types', () => {
      renderWithProviders(
        <CreateBehaviorNoteModal
          isOpen={true}
          onClose={vi.fn()}
          classId="6A1"
          roster={mockRoster}
        />
      );

      const negativeBtn = screen.getByText('Vi phạm / Cần chấn chỉnh');
      fireEvent.click(negativeBtn);

      // Category select should update to negative categories
      expect(screen.getByText('Không làm bài tập')).toBeInTheDocument();
    });
  });

  describe('3. BehaviorNotesFilter Component', () => {
    it('renders filter presets and triggers onChange on date preset click', () => {
      const changeSpy = vi.fn();
      renderWithProviders(
        <BehaviorNotesFilter
          filters={{
            dateRange: 'all',
            studentId: 'all',
            type: 'all',
            category: 'all',
            authorRole: 'all',
            searchQuery: '',
          }}
          onChange={changeSpy}
          onReset={vi.fn()}
          roster={mockRoster}
        />
      );

      const todayBtn = screen.getByText('Hôm nay');
      fireEvent.click(todayBtn);

      expect(changeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: 'today' })
      );
    });

    it('triggers onChange when searching keyword', () => {
      const changeSpy = vi.fn();
      renderWithProviders(
        <BehaviorNotesFilter
          filters={{
            dateRange: 'all',
            studentId: 'all',
            type: 'all',
            category: 'all',
            authorRole: 'all',
            searchQuery: '',
          }}
          onChange={changeSpy}
          onReset={vi.fn()}
          roster={mockRoster}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Tìm theo tên học sinh/);
      fireEvent.change(searchInput, { target: { value: 'Quỳnh An' } });

      expect(changeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ searchQuery: 'Quỳnh An' })
      );
    });
  });

  describe('4. ConferenceSummaryModal Component', () => {
    it('renders formal school header and student summaries', () => {
      renderWithProviders(
        <ConferenceSummaryModal
          isOpen={true}
          onClose={vi.fn()}
          classId="6A1"
          notes={[mockPositiveNote, mockNegativeNote]}
          roster={mockRoster}
          gvcnName="Đinh Hoài Long"
        />
      );

      expect(screen.getByText(/TRƯỜNG THCS NGOẠI NGỮ - ĐẠI HỌC QUỐC GIA HÀ NỘI/)).toBeInTheDocument();
      expect(screen.getByText(/BẢNG TỔNG HỢP NỀ NẾP & RÈN LUYỆN HỌC SINH/)).toBeInTheDocument();
      expect(screen.getAllByText(/Đinh Hoài Long/)[0]).toBeInTheDocument();
    });

    it('copies summary text to clipboard when clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      renderWithProviders(
        <ConferenceSummaryModal
          isOpen={true}
          onClose={vi.fn()}
          classId="6A1"
          notes={[mockPositiveNote]}
          roster={mockRoster}
          gvcnName="Đinh Hoài Long"
        />
      );

      const copyBtn = screen.getByText('Sao chép Zalo/Email');
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalled();
      expect(writeTextMock.mock.calls[0][0]).toContain('BÁO CÁO NỀ NẾP LỚP 6A1');
    });

    it('triggers window.print when print button clicked', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

      renderWithProviders(
        <ConferenceSummaryModal
          isOpen={true}
          onClose={vi.fn()}
          classId="6A1"
          notes={[mockPositiveNote]}
          roster={mockRoster}
        />
      );

      const printBtn = screen.getByText('In Báo Cáo');
      fireEvent.click(printBtn);

      expect(printSpy).toHaveBeenCalled();
    });
  });

  describe('5. StudentNotesView Component', () => {
    it('renders KPI summary cards and view mode switcher', async () => {
      localStorage.setItem('ums_behavior_notes', JSON.stringify([mockPositiveNote, mockNegativeNote]));

      renderWithProviders(<StudentNotesView classId="6A1" />);

      await waitFor(() => {
        expect(screen.getByText('Sổ theo dõi nề nếp & hành vi học sinh')).toBeInTheDocument();
      });

      expect(screen.getByText('Tổng lượt ghi nhận')).toBeInTheDocument();
      expect(screen.getByText('Dòng thời gian')).toBeInTheDocument();
      expect(screen.getByText('Theo học sinh')).toBeInTheDocument();
    });

    it('toggles view mode between timeline and per-student', async () => {
      localStorage.setItem('ums_behavior_notes', JSON.stringify([mockPositiveNote, mockNegativeNote]));

      renderWithProviders(<StudentNotesView classId="6A1" />);

      await waitFor(() => {
        expect(screen.getByText('Theo học sinh')).toBeInTheDocument();
      });

      const perStudentBtn = screen.getByText('Theo học sinh');
      fireEvent.click(perStudentBtn);

      // In student view, it groups by roster students
      expect(screen.getAllByText(/phiếu ghi nhận/)[0]).toBeInTheDocument();
    });
  });
});
