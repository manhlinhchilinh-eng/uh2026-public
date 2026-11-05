import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  isAttendanceTaken,
  summarizePeriodAttendance,
  buildAttendanceBoard,
  boardTotals,
  periodCellLabel,
} from '../utils/periodAttendance';
import type { PeriodEntry } from '../types/logbook';
import type { StudentDaily } from '../utils/studentDaily';

vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      logbook: { subject: 'Môn', ppctLesson: 'PPCT', lessonTopic: 'Bài', comment: 'Nhận xét' },
      scoring: { totalScore: 'Điểm' },
      common: { cancel: 'Hủy' },
    },
  }),
}));
vi.mock('../services/eslService', () => ({ fetchEslConfig: async () => ({ enabled: false, option: 'quick' }) }));
vi.mock('../components/logbook/PreSessionAttendanceModal', () => ({
  getClassRoster: () => [
    { id: '111111', mhs: '111111', fullName: 'Lý Bảo Duy', classId: '6A1', studentNumber: 1 },
  ],
}));
vi.mock('../components/behavior/CreateBehaviorNoteModal', () => ({ CreateBehaviorNoteModal: () => null }));

import { PeriodEntryModal } from '../components/logbook/PeriodEntryModal';
import { TimetablePeriodCard } from '../components/logbook/TimetablePeriodCard';

const abs = (studentId: string, type: 'P' | 'K' | 'Late') => ({ studentId, studentName: 'HS ' + studentId, type });

const entry = (over: Partial<PeriodEntry> = {}): PeriodEntry =>
  ({
    periodIndex: 2, subject: 'Toán', lessonTopic: '', teacherId: 'gvbm', teacherName: 'Cô B', absentStudents: [],
    scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
    teacherComment: '', teacherSignature: '', isSigned: false, updatedAt: 0, ...over,
  }) as PeriodEntry;

const day = (mhs: string, classId: string, over: Partial<StudentDaily> = {}): StudentDaily => ({
  mhs, studentName: 'HS ' + mhs, classId, date: '2026-10-28', morning: null, afternoon: null,
  periodAbsences: [], earlyDeparture: null, updatedAt: 1, ...over,
});

describe('Điểm danh đầu tiết — hàm thuần', () => {
  it('tiết đã điểm danh khi đã ký hoặc đã lưu điểm danh', () => {
    expect(isAttendanceTaken(entry())).toBe(false);
    expect(isAttendanceTaken(entry({ attendanceTakenAt: 5 }))).toBe(true);
    expect(isAttendanceTaken(entry({ isSigned: true }))).toBe(true);
    expect(isAttendanceTaken(null)).toBe(false);
  });

  it('tóm tắt đếm vắng P/K, muộn, về sớm và người điểm danh', () => {
    const s = summarizePeriodAttendance(
      entry({
        attendanceTakenAt: 100,
        attendanceTakenBy: 'gvbm',
        attendanceTakenByName: 'Cô B',
        absentStudents: [abs('1', 'P'), abs('2', 'K'), abs('3', 'K'), abs('4', 'Late')] as any,
        earlyDepartures: [{ studentId: '5', studentName: 'HS 5', departedAt: '09:00', reason: 'Ốm' }],
      })
    );
    expect(s).toEqual({ at: 100, by: 'gvbm', byName: 'Cô B', subject: 'Toán', absentP: 1, absentK: 2, late: 1, early: 1, signed: false,
      absentees: [{ mhs: '1', name: 'HS 1', type: 'P' }, { mhs: '2', name: 'HS 2', type: 'K' }, { mhs: '3', name: 'HS 3', type: 'K' }, { mhs: '4', name: 'HS 4', type: 'Late' }] });
    expect(summarizePeriodAttendance(entry({ attendanceTakenAt: 1 })).absentees).toBeUndefined();
    const many = Array.from({ length: 70 }, (_, i) => abs(String(i + 1), 'K'));
    expect(summarizePeriodAttendance(entry({ absentStudents: many as any })).absentees).toHaveLength(60);
    expect(periodCellLabel(s)).toBe('3V 1M 1S');
    expect(periodCellLabel({ ...s, absentP: 0, absentK: 0, late: 0, early: 0 })).toBe('Đủ');
  });

  it('bảng toàn trường: đủ lớp, ô tiết, đầu buổi GVCN, HS sắp theo lớp', () => {
    const summary = summarizePeriodAttendance(entry({ attendanceTakenAt: 1, absentStudents: [abs('1', 'Late')] as any }));
    const rows = buildAttendanceBoard(
      ['6A2', '6A1', '6A10'],
      [{ classId: '6A1', morningBaseline: { reportedBy: 'gvcn', reportedAt: 1, session: 'morning', absences: [], earlyDepartures: [] } as any, periodAttendance: { '2': summary } }],
      [day('1', '6A1', { periodAbsences: [{ periodIndex: 2, type: 'Late', subject: 'Toán' }] }), day('2', '6A2', { morning: 'K' })]
    );
    expect(rows.map((r) => r.classId)).toEqual(['6A1', '6A2', '6A10']);
    expect(rows[0]).toMatchObject({ hasLogbook: true, morningChecked: true, afternoonChecked: false, issueCount: 1 });
    expect(rows[0].periods[1]).toEqual(summary);
    expect(rows[0].periods[0]).toBeNull();
    expect(rows[1].hasLogbook).toBe(false);

    const t = boardTotals(rows, 2);
    expect(t).toMatchObject({ classes: 3, checkedForPeriod: 1, studentsWithIssues: 2, absentK: 1, absentP: 0, late: 1, early: 0 });
  });
});

describe('Form ghi sổ tiết: đầu tiết điểm danh, cuối tiết ký', () => {
  const baseProps = {
    isOpen: true,
    onClose: () => {},
    periodIndex: 2,
    classId: '6A1',
    date: '2026-10-28',
    currentUserName: 'Cô B',
    currentUserId: 'gvbm',
  };

  it('"Lưu điểm danh" lưu ngay, chưa ký, không cần bài dạy', async () => {
    const onSave = vi.fn(async () => {});
    render(<PeriodEntryModal {...baseProps} onSave={onSave} />);
    expect(screen.getByTestId('step-attendance')).toBeTruthy();
    expect(screen.getByTestId('step-sign')).toBeTruthy();
    fireEvent.click(screen.getByTestId('save-attendance'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = (onSave.mock.calls[0] as any)[0] as PeriodEntry;
    expect(saved.isSigned).toBe(false);
    expect(saved.signedAt).toBeUndefined();
    expect(typeof saved.attendanceTakenAt).toBe('number');
    expect(saved.attendanceTakenBy).toBe('gvbm');
    expect(saved.lessonTopic).toBe('');
  });

  it('tiết đã điểm danh: mở lại thấy giờ đã lưu; tiết đã ký thì ẩn nút lưu điểm danh', () => {
    const { unmount } = render(
      <PeriodEntryModal {...baseProps} onSave={async () => {}} initialEntry={entry({ attendanceTakenAt: new Date(2026, 9, 28, 7, 32).getTime() })} />
    );
    expect(screen.getByTestId('attendance-taken-at').textContent).toBe('Đã lưu lúc 07:32');
    expect(screen.getByTestId('save-attendance').textContent).toBe('Cập nhật điểm danh');
    unmount();
    render(<PeriodEntryModal {...baseProps} onSave={async () => {}} initialEntry={entry({ isSigned: true, lessonTopic: 'Bài 1' })} />);
    expect(screen.queryByTestId('save-attendance')).toBeNull();
  });
});

describe('Thẻ tiết cho giám thị / GVCN', () => {
  it('đã điểm danh, chưa ký: hiện giờ, tên HS vắng/muộn', () => {
    render(
      <TimetablePeriodCard
        period={entry({
          attendanceTakenAt: new Date(2026, 9, 28, 8, 20).getTime(),
          attendanceTakenByName: 'Cô B',
          absentStudents: [abs('1', 'K'), abs('2', 'Late')] as any,
        })}
        periodIndex={2}
        canEdit={false}
      />
    );
    expect(screen.getByTestId('attendance-taken-2').textContent).toBe('Đã điểm danh 08:20');
    expect(screen.getByTestId('attendance-names-2').textContent).toBe('Vắng: HS 1 (K) • Muộn: HS 2');
    expect(screen.getByText(/Cô B • chưa ký/)).toBeTruthy();
  });
});

describe('Form ký cuối tiết — góp ý 05/11 (cô Phương Anh)', () => {
  const baseProps = {
    isOpen: true,
    onClose: () => {},
    periodIndex: 2,
    classId: '6A1',
    date: '2026-10-28',
    currentUserName: 'Cô B',
    currentUserId: 'gvbm',
  };

  it('ô Nhận xét nằm TRƯỚC khối Tổng điểm; 4 ô điểm trên 1 hàng', () => {
    render(<PeriodEntryModal {...baseProps} onSave={async () => {}} />);
    const comment = screen.getByLabelText('Nhận xét');
    const scoreBox = screen.getByTestId('score-box');
    expect(comment.compareDocumentPosition(scoreBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('score-row').className).toMatch(/\bgrid-cols-4\b/);
    expect(screen.getByTestId('score-row').className).not.toMatch(/grid-cols-2/);
  });

  it('không còn mục "Ghi nhận học sinh về sớm" trong form ký tiết', () => {
    render(<PeriodEntryModal {...baseProps} onSave={async () => {}} />);
    expect(screen.queryByText(/Ghi nhận học sinh về sớm/)).toBeNull();
    expect(screen.queryByTestId('legacy-early-departures')).toBeNull();
  });

  it('dữ liệu về sớm cũ trong tiết: vẫn hiện (chỉ đọc) và giữ nguyên khi ký lại', async () => {
    const onSave = vi.fn(async () => {});
    const old = [{ studentId: '111111', studentName: 'Lý Bảo Duy', departedAt: '09:30', reason: 'Ốm' }];
    render(
      <PeriodEntryModal
        {...baseProps}
        onSave={onSave}
        initialEntry={entry({ subject: 'Toán', lessonTopic: 'Bài 1', earlyDepartures: old })}
      />
    );
    expect(screen.getByTestId('legacy-early-departures').textContent).toContain('Lý Bảo Duy 09:30');
    fireEvent.click(screen.getByTestId('save-attendance'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(((onSave.mock.calls[0] as any)[0] as PeriodEntry).earlyDepartures).toEqual(old);
  });
});
