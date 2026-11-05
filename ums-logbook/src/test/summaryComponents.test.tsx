/**
 * Unit & Integration Tests: Summary & Emulation UI Components
 * Milestone 5: Leaderboard, Olympic Podium, WeeklySummaryCard & LogbookPdfView
 * Path: src/test/summaryComponents.test.tsx
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EmulationLeaderboard } from '../components/summary/EmulationLeaderboard';
import { WeeklySummaryCard } from '../components/summary/WeeklySummaryCard';
import { LogbookPdfView } from '../components/summary/LogbookPdfView';
import { PdfExportButton } from '../components/summary/PdfExportButton';
import { WeeklyLogbookPdfData } from '../utils/pdfGenerator';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

describe('Milestone 5: Summary & Emulation UI Components', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('1. EmulationLeaderboard renders header, grade filter tabs and 26-class standings', async () => {
    renderWithProviders(<EmulationLeaderboard initialWeekNumber={5} />);

    // Check title and thang 100 badge
    expect(await screen.findByText(/BẢNG XẾP HẠNG THI ĐUA NỀ NẾP & HỌC TẬP/i)).toBeInTheDocument();
    expect(screen.getByText(/Thang 100/i)).toBeInTheDocument();

    // Check grade tabs
    expect(screen.getByRole('button', { name: /Tất cả \(26 lớp\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Khối 6/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Khối 7/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Khối 8/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Khối 9/i })).toBeInTheDocument();
  });

  it('2. WeeklySummaryCard renders class standing, score, and attendance categories', async () => {
    renderWithProviders(<WeeklySummaryCard classId="6A1" weekNumber={5} />);

    expect(await screen.findByText(/Thi Đua Lớp 6A1 • Tuần 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Vắng P/i)).toBeInTheDocument();
    expect(screen.getByText(/Vắng K/i)).toBeInTheDocument();
    expect(screen.getByText(/Đi muộn/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem tổng kết tuần/i)).toBeInTheDocument();
  });

  it('3. LogbookPdfView renders authentic MOET 10-column table and header', () => {
    const mockPdfData: WeeklyLogbookPdfData = {
      schoolName: 'TRƯỜNG THCS NGOẠI NGỮ',
      districtName: 'UBND QUẬN CẦU GIẤY',
      academicYear: '2026 - 2027',
      classId: '9A3',
      gvcnName: 'Nguyễn Mạnh Linh',
      totalStudents: 26,
      weekNumber: 5,
      startDate: '05/10/2026',
      endDate: '09/10/2026',
      days: [
        {
          dayOfWeek: 2,
          dayNameVi: 'Thứ Hai',
          date: '05/10/2026',
          periods: [],
        },
      ],
      summary: {
        totalPeriodsExpected: 40,
        totalPeriodsTaught: 40,
        totalPeriodsSigned: 40,
        unsignedPeriodsCount: 0,
        unsignedSubjects: [],
        attendanceStats: { totalAbsences: 0, excusedP: 0, unexcusedK: 0, late: 0 },
        criteriaAverage: { learningAvg: 4, disciplineAvg: 3, hygieneAvg: 2, customAvg: 1, totalWeeklyScore: 10 },
        emulationScore: 105,
        emulationStatus: 'good',
        emulationStatusLabel: 'Xuất sắc',
        rank: 1,
        gvcnComments: 'Lớp xuất sắc dẫn đầu toàn trường.',
      },
    };

    render(<LogbookPdfView data={mockPdfData} />);

    // Header checks
    expect(screen.getByText(/UBND QUẬN CẦU GIẤY/i)).toBeInTheDocument();
    expect(screen.getByText(/TRƯỜNG THCS NGOẠI NGỮ/i)).toBeInTheDocument();
    expect(screen.getByText(/SỔ ĐẦU BÀI ĐIỆN TỬ/i)).toBeInTheDocument();
    expect(screen.getAllByText(/9A3/i).length).toBeGreaterThan(0);

    // Column headers checks
    expect(screen.getByText(/Tên bài học, nội dung công việc/i)).toBeInTheDocument();
    expect(screen.getByText(/Sĩ số \/ Vắng mặt/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhận xét của GV bộ môn/i)).toBeInTheDocument();

    // Signatures check
    expect(screen.getAllByText(/GIÁO VIÊN CHỦ NHIỆM/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/BAN GIÁM HIỆU PHÊ DUYỆT/i)).toBeInTheDocument();
  });

  it('4. PdfExportButton renders and displays print label', () => {
    renderWithProviders(<PdfExportButton classId="6A1" weekNumber={5} label="In Sổ Đầu Bài A4" />);
    expect(screen.getByText('In Sổ Đầu Bài A4')).toBeInTheDocument();
  });
});
