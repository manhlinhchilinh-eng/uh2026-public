import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PeriodEntry, DailyLogbook } from '../types/logbook';
import type { ApprovedLeaveEntry } from '../utils/studentLeave';

const auth = vi.hoisted(() => ({
  value: { profile: { uid: 'u1', username: 'gvcn6a1', displayName: 'Cô A', assignedClassId: '6A1' } as any, activeRole: 'gvcn' as string },
}));
const logbookSvc = vi.hoisted(() => ({ daily: null as any }));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      logbook: { subject: 'Môn', ppctLesson: 'PPCT', lessonTopic: 'Bài', comment: 'Nhận xét', morningSession: 'Buổi sáng', afternoonSession: 'Buổi chiều' },
      scoring: { totalScore: 'Điểm' },
      common: { cancel: 'Hủy' },
      attendance: { morningBaselineTitle: 'Đầu buổi sáng', afternoonBaselineTitle: 'Đầu buổi chiều', morningTab: 'Sáng', afternoonTab: 'Chiều', saveBaselineSuccess: 'OK' },
    },
  }),
}));
vi.mock('../services/eslService', () => ({ fetchEslConfig: async () => ({ enabled: false, option: 'quick' }) }));
vi.mock('../components/behavior/CreateBehaviorNoteModal', () => ({ CreateBehaviorNoteModal: () => null }));
vi.mock('../components/summary/PdfExportButton', () => ({ PdfExportButton: () => null }));
vi.mock('../services/rosterService', () => ({
  fetchClassRoster: async () => [
    { id: '111', mhs: '111', stt: 1, name: 'Lý Bảo Duy', classId: '6A1', grade: 6, dob: '', gender: 'Nam', status: 'active', createdAt: 0 },
    { id: '222', mhs: '222', stt: 2, name: 'Trần An', classId: '6A1', grade: 6, dob: '', gender: 'Nữ', status: 'active', createdAt: 0 },
  ],
  getLocalRoster: () => [],
}));
vi.mock('../services/logbookService', () => ({
  generateDailyId: (c: string, d: string) => `${c}_${d}`,
  getOrCreateDailyLogbook: async () => logbookSvc.daily,
  updateAttendanceBaseline: async () => {},
}));

import { PeriodEntryModal } from '../components/logbook/PeriodEntryModal';
import { PreSessionAttendanceModal } from '../components/logbook/PreSessionAttendanceModal';
import { DailyLogbookGrid } from '../components/logbook/DailyLogbookGrid';

const leaves: Record<string, ApprovedLeaveEntry> = {
  p1_1: { mhs: '222', name: 'Trần An', stt: 2, periods: [3], meal: true },
};

const baseProps = {
  isOpen: true,
  onClose: () => {},
  classId: '6A1',
  date: '2026-11-05',
  currentUserName: 'Cô B',
  currentUserId: 'gvbm',
};

const entry = (over: Partial<PeriodEntry> = {}): PeriodEntry =>
  ({
    periodIndex: 3, subject: 'Toán', lessonTopic: '', teacherId: 'gvbm', teacherName: 'Cô B', absentStudents: [],
    scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
    teacherComment: '', teacherSignature: '', isSigned: false, updatedAt: 0, ...over,
  }) as PeriodEntry;

beforeEach(() => {
  auth.value = { profile: { uid: 'u1', username: 'gvcn6a1', displayName: 'Cô A', assignedClassId: '6A1' }, activeRole: 'gvcn' };
  // Như logbookService thật: getOrCreateDailyLogbook luôn điền baseline trống (createEmptyBaseline)
  const empty = (session: string) => ({ reportedBy: 'gvcn6a1', reportedAt: 1730000000000, session, absences: [], earlyDepartures: [], notes: '' });
  logbookSvc.daily = {
    id: '6A1_2026-11-05', classId: '6A1', date: '2026-11-05',
    morningBaseline: empty('morning'), afternoonBaseline: empty('afternoon'), preSessionAttendance: empty('morning'),
  };
});

describe('Sổ đầu bài: đơn nghỉ đã duyệt điền sẵn vắng P', () => {
  it('có đơn tiết 3 → mở tiết 3 thấy HS vắng P sẵn, nút "Lớp đủ (trừ 1 bạn có đơn)" lưu đúng 1 HS', async () => {
    const onSave = vi.fn(async () => {});
    render(<PeriodEntryModal {...baseProps} periodIndex={3} onSave={onSave} approvedLeaves={leaves} />);
    expect(await screen.findByTestId('leave-badge-222')).toBeTruthy();
    expect(screen.queryByTestId('leave-badge-111')).toBeNull();
    const quick = screen.getByTestId('quick-attendance');
    expect(quick.textContent).toContain('Lớp đủ (trừ 1 bạn có đơn)');
    fireEvent.click(quick);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = (onSave.mock.calls[0] as any)[0] as PeriodEntry;
    expect(saved.absentStudents).toEqual([
      { studentId: '222', studentName: 'Trần An', studentNumber: 2, type: 'P', note: 'Đơn PH đã duyệt' },
    ]);
    expect(saved.isSigned).toBe(false);
    expect(typeof saved.attendanceTakenAt).toBe('number');
  });

  it('tiết 1 không có đơn → không điền, không hiện nút "Lớp đủ" (form như cũ), lưu 0 HS vắng', async () => {
    const onSave = vi.fn(async () => {});
    render(<PeriodEntryModal {...baseProps} periodIndex={1} onSave={onSave} approvedLeaves={leaves} />);
    await screen.findByText('Trần An');
    expect(screen.queryByTestId('leave-badge-222')).toBeNull();
    expect(screen.queryByTestId('quick-attendance')).toBeNull();
    fireEvent.click(screen.getByTestId('save-attendance'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(((onSave.mock.calls[0] as any)[0] as PeriodEntry).absentStudents).toEqual([]);
  });

  it('tiết đã điểm danh → giữ nguyên danh sách đã lưu, không điền thêm từ đơn', async () => {
    const onSave = vi.fn(async () => {});
    const savedAbs = [{ studentId: '111', studentName: 'Lý Bảo Duy', type: 'K' as const }];
    render(
      <PeriodEntryModal
        {...baseProps}
        periodIndex={3}
        onSave={onSave}
        approvedLeaves={leaves}
        initialEntry={entry({ attendanceTakenAt: 5, absentStudents: savedAbs })}
      />
    );
    await screen.findByText('Trần An');
    expect(screen.queryByTestId('leave-badge-222')).toBeNull();
    fireEvent.click(screen.getByTestId('save-attendance'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(((onSave.mock.calls[0] as any)[0] as PeriodEntry).absentStudents).toEqual(savedAbs);
  });

  it('tiết mới có HS vắng từ đầu buổi → giữ bản ghi đầu buổi, thêm HS có đơn; không hiện nút "Lớp đủ"', async () => {
    const onSave = vi.fn(async () => {});
    render(
      <PeriodEntryModal
        {...baseProps}
        periodIndex={3}
        onSave={onSave}
        approvedLeaves={leaves}
        baselineAbsences={[{ studentId: '111', studentName: 'Lý Bảo Duy', type: 'K' }]}
      />
    );
    expect(await screen.findByTestId('leave-badge-222')).toBeTruthy();
    expect(screen.queryByTestId('quick-attendance')).toBeNull();
    fireEvent.click(screen.getByTestId('save-attendance'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = ((onSave.mock.calls[0] as any)[0] as PeriodEntry).absentStudents;
    expect(saved.map((a) => [a.studentId, a.type])).toEqual([['111', 'K'], ['222', 'P']]);
  });

  it('không có đơn → form như cũ (không badge, không nút "Lớp đủ")', async () => {
    render(<PeriodEntryModal {...baseProps} periodIndex={3} onSave={async () => {}} />);
    await screen.findByText('Trần An');
    expect(screen.queryByTestId('leave-badge-222')).toBeNull();
    expect(screen.queryByTestId('quick-attendance')).toBeNull();
  });
});

describe('Điểm danh đầu buổi: HS có đơn cả buổi', () => {
  const dayLeaves: Record<string, ApprovedLeaveEntry> = {
    a: { mhs: '222', name: 'Trần An', stt: 2, periods: [], meal: false },
    b: { mhs: '111', name: 'Lý Bảo Duy', stt: 1, periods: [2], meal: true },
  };

  it('chưa báo đầu buổi → điền sẵn HS nghỉ cả buổi (không điền HS nghỉ 1 tiết)', async () => {
    render(<PreSessionAttendanceModal isOpen onClose={() => {}} classId="6A1" date="2026-11-05" initialSession="morning" approvedLeaves={dayLeaves} />);
    expect(await screen.findByTestId('leave-badge-222')).toBeTruthy();
    expect(screen.queryByTestId('leave-badge-111')).toBeNull();
  });

  it('sổ ngày có baseline trống thật (createEmptyBaseline) → vẫn điền sẵn HS nghỉ cả buổi', async () => {
    expect(logbookSvc.daily.morningBaseline).toBeTruthy();
    render(<PreSessionAttendanceModal isOpen onClose={() => {}} classId="6A1" date="2026-11-05" initialSession="morning" approvedLeaves={dayLeaves} />);
    expect(await screen.findByTestId('leave-badge-222')).toBeTruthy();
  });

  it('sổ ngày chưa có baseline (doc cũ) → vẫn điền sẵn', async () => {
    logbookSvc.daily = { id: '6A1_2026-11-05', classId: '6A1', date: '2026-11-05' };
    render(<PreSessionAttendanceModal isOpen onClose={() => {}} classId="6A1" date="2026-11-05" initialSession="morning" approvedLeaves={dayLeaves} />);
    expect(await screen.findByTestId('leave-badge-222')).toBeTruthy();
  });

  it('đã báo đầu buổi → giữ nguyên, không điền thêm', async () => {
    logbookSvc.daily = {
      ...logbookSvc.daily,
      morningBaseline: {
        reportedBy: 'gvcn6a1', reportedByName: 'Cô A', reportedAt: 1, session: 'morning',
        absences: [{ studentId: '111', studentName: 'Lý Bảo Duy', type: 'K', reportedInTier: 'baseline' }], earlyDepartures: [], notes: '',
      },
    };
    render(<PreSessionAttendanceModal isOpen onClose={() => {}} classId="6A1" date="2026-11-05" initialSession="morning" approvedLeaves={dayLeaves} />);
    await screen.findByText('Trần An');
    await waitFor(() => expect(screen.queryByTestId('leave-badge-222')).toBeNull());
  });

  it('đã báo đầu buổi, lớp đủ (0 vắng) → không điền thêm', async () => {
    logbookSvc.daily = {
      ...logbookSvc.daily,
      morningBaseline: { reportedBy: 'gvcn6a1', reportedByName: 'Cô A', reportedAt: 1, session: 'morning', absences: [], earlyDepartures: [], notes: '' },
    };
    render(<PreSessionAttendanceModal isOpen onClose={() => {}} classId="6A1" date="2026-11-05" initialSession="morning" approvedLeaves={dayLeaves} />);
    await screen.findByText('Trần An');
    await waitFor(() => expect(screen.queryByTestId('leave-badge-222')).toBeNull());
  });
});

describe('Lưới sổ ngày: đối chiếu + dòng nghỉ có đơn', () => {
  const logbook = {
    id: '6A1_2026-11-05', classId: '6A1', date: '2026-11-05',
    approvedLeaves: leaves,
    periodAttendance: {
      '2': { at: 1, by: 'gvbm', byName: 'Cô B', subject: 'Toán', absentP: 0, absentK: 1, late: 0, early: 0, signed: false,
        absentees: [{ mhs: '111', name: 'Lý Bảo Duy', type: 'K' }] },
    },
  } as unknown as DailyLogbook;

  it('GVCN lớp thấy hộp "Cần đối chiếu" và nút mở điểm danh đầu buổi', () => {
    const onOpen = vi.fn();
    render(<DailyLogbookGrid classId="6A1" date="2026-11-05" periods={[]} logbook={logbook} onSavePeriod={async () => {}} onOpenBaseline={onOpen} />);
    const box = screen.getByTestId('reconcile-box');
    expect(box.textContent).toContain('Cần đối chiếu');
    expect(box.textContent).toContain('Lý Bảo Duy — vắng tiết 2 (K) — không có đơn, chưa có trong điểm danh đầu buổi');
    fireEvent.click(screen.getByTestId('reconcile-open-baseline'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('leave-today').textContent).toContain('Trần An (tiết 3)');
  });

  it('GVBM không thấy hộp đối chiếu nhưng vẫn thấy dòng nghỉ có đơn', () => {
    auth.value = { profile: { uid: 'u2', username: 'gvbm', displayName: 'Cô B', assignedClassId: '7A2' }, activeRole: 'gvbm' };
    render(<DailyLogbookGrid classId="6A1" date="2026-11-05" periods={[]} logbook={logbook} onSavePeriod={async () => {}} />);
    expect(screen.queryByTestId('reconcile-box')).toBeNull();
    expect(screen.getByTestId('leave-today')).toBeTruthy();
  });

  it('không có đơn, không cảnh báo → không hiện gì thêm', () => {
    render(<DailyLogbookGrid classId="6A1" date="2026-11-05" periods={[]} logbook={{ id: 'x', classId: '6A1', date: '2026-11-05' } as unknown as DailyLogbook} onSavePeriod={async () => {}} />);
    expect(screen.queryByTestId('reconcile-box')).toBeNull();
    expect(screen.queryByTestId('leave-today')).toBeNull();
  });

  it('GVCN mở tiết 3 từ lưới → modal nhận đơn và điền sẵn HS', async () => {
    render(<DailyLogbookGrid classId="6A1" date="2026-11-05" periods={[]} logbook={logbook} onSavePeriod={async () => {}} initialPeriodIndex={3} />);
    expect(await screen.findByTestId('leave-badge-222')).toBeTruthy();
  });
});
