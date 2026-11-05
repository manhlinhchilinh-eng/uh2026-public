import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ profile: { uid: 'u', username: 'gv', displayName: 'Cô A' }, activeRole: 'gvcn' }) }));
vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({ t: { logbook: { morningSession: 'Buổi sáng', afternoonSession: 'Buổi chiều' } } }),
}));
vi.mock('../components/summary/PdfExportButton', () => ({ PdfExportButton: () => null }));
vi.mock('../components/logbook/PeriodEntryModal', () => ({
  PeriodEntryModal: ({ periodIndex }: { periodIndex: number }) => <div data-testid="modal">Modal tiết {periodIndex}</div>,
}));

import { DailyLogbookGrid } from '../components/logbook/DailyLogbookGrid';
import { OffDayNotice } from '../components/common/OffDayNotice';
import type { PeriodEntry } from '../types/logbook';

const entry = (p: number, over: Partial<PeriodEntry> = {}): PeriodEntry =>
  ({
    periodIndex: p, subject: '', lessonTopic: '', teacherId: '', teacherName: '', absentStudents: [],
    scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
    teacherComment: '', teacherSignature: '', isSigned: false, updatedAt: 0, ...over,
  }) as PeriodEntry;

describe('Sổ đầu bài trình bày giống Thời khóa biểu', () => {
  const periods = [
    entry(1, { subject: 'Homeroom', teacherName: 'Ms A' }),
    entry(3, { subject: 'Maths', teacherName: 'Ms B', isSigned: true, lessonTopic: 'Phương trình', scores: { learning: 3, discipline: 3, hygiene: 2, customCriterion: 2, total: 10 } }),
  ];

  it('đủ 8 tiết theo giờ chuông, có dòng ra chơi & nghỉ trưa, hiện môn + GV', () => {
    render(<DailyLogbookGrid classId="6A1" date="2026-10-12" periods={periods} onSavePeriod={async () => {}} substituteLabels={{ 1: 'Dạy thay: Thầy C' }} />);
    for (let p = 1; p <= 8; p++) expect(screen.getByTestId(`period-card-${p}`)).toBeTruthy();
    expect(screen.getByText('07:30 - 08:15')).toBeTruthy();
    expect(screen.getByText('Ra chơi sáng')).toBeTruthy();
    expect(screen.getByText('Nghỉ trưa')).toBeTruthy();
    expect(screen.getByText('Ra chơi chiều')).toBeTruthy();
    expect(screen.getByText('Homeroom')).toBeTruthy();
    expect(screen.getByText('Ms A')).toBeTruthy();
    expect(screen.getByText('Phương trình')).toBeTruthy();
    expect(screen.getByText('Đã ký')).toBeTruthy();
    expect(screen.getByTestId('sub-label-1').textContent).toBe('Dạy thay: Thầy C');
  });

  it('bấm 1 tiết mở form ghi sổ đúng tiết', () => {
    render(<DailyLogbookGrid classId="6A1" date="2026-10-12" periods={periods} onSavePeriod={async () => {}} />);
    fireEvent.click(screen.getByTestId('period-card-3'));
    expect(screen.getByTestId('modal').textContent).toBe('Modal tiết 3');
  });

  it('không có quyền → không mở form', () => {
    render(<DailyLogbookGrid classId="6A1" date="2026-10-12" periods={periods} onSavePeriod={async () => {}} canEditPeriod={() => false} />);
    fireEvent.click(screen.getByTestId('period-card-1'));
    expect(screen.queryByTestId('modal')).toBeNull();
  });

  it('ngày nghỉ báo không có TKB', () => {
    render(<OffDayNotice date="2026-10-10" reason="Thứ Bảy" kind="weekend" />);
    expect(screen.getByTestId('off-day-notice').textContent).toMatch(/ngày nghỉ — Thứ Bảy.*Không có thời khóa biểu/);
  });
});
