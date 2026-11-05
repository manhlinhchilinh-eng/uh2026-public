import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PeriodEntry } from '../types/logbook';
import { missingScoreKeys, scoringOptionalReason } from '../utils/periodScoringRequirement';

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
vi.mock('../services/rosterService', () => ({ fetchClassRoster: async () => [] }));
vi.mock('../components/behavior/CreateBehaviorNoteModal', () => ({ CreateBehaviorNoteModal: () => null }));

import { PeriodEntryModal } from '../components/logbook/PeriodEntryModal';

const baseProps = {
  isOpen: true,
  onClose: () => {},
  periodIndex: 2,
  classId: '6A1',
  date: '2026-11-05',
  currentUserName: 'Cô B',
  currentUserId: 'gvbm',
};

const fillLesson = (subject = 'Toán') => {
  fireEvent.change(screen.getByLabelText(/^Môn/), { target: { value: subject } });
  fireEvent.change(screen.getByLabelText(/^Bài/), { target: { value: 'Bài 5' } });
  fireEvent.click(screen.getByLabelText(/Xác nhận chữ ký/));
};
const score = (label: string) => screen.getByLabelText(`Điểm ${label}`) as HTMLInputElement;
const plus = (label: string) => fireEvent.click(screen.getByLabelText(`Tăng 0,5 điểm ${label}`));

describe('Bắt buộc chấm điểm trước khi ký sổ (05/11)', () => {
  it('tiết chưa ký: 4 ô điểm TRỐNG, không điền sẵn 10đ', () => {
    render(<PeriodEntryModal {...baseProps} onSave={async () => {}} />);
    for (const l of ['Học tập', 'Kỷ luật', 'Vệ sinh']) expect(score(l).value).toBe('');
    expect(screen.getByTestId('score-incomplete').textContent).toMatch(/0\/4/);
  });

  it('chưa chấm đủ: bấm Ký không lưu, báo ô còn thiếu', async () => {
    const onSave = vi.fn(async () => {});
    render(<PeriodEntryModal {...baseProps} onSave={onSave} />);
    fillLesson();
    plus('Học tập'); // ô trống + → điểm tối đa
    plus('Kỷ luật');
    expect(score('Học tập').value).toBe('4');
    fireEvent.click(screen.getByTestId('sign-submit'));
    await waitFor(() => expect(screen.getByText(/Chưa chấm điểm: Vệ sinh,/)).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('sign-blocked-hint').textContent).toMatch(/Vệ sinh/);
    expect(screen.getByTestId('sign-submit').getAttribute('aria-disabled')).toBe('true');
    expect(score('Vệ sinh').getAttribute('aria-invalid')).toBe('true');
  });

  it('chấm đủ 4 ô (kể cả đều tối đa) → ký được, lưu đúng điểm đã chọn', async () => {
    const onSave = vi.fn(async () => {});
    render(<PeriodEntryModal {...baseProps} onSave={onSave} />);
    fillLesson();
    fireEvent.change(score('Học tập'), { target: { value: '3,5' } });
    fireEvent.blur(score('Học tập'));
    plus('Kỷ luật');
    plus('Vệ sinh');
    screen.getAllByLabelText(/^Tăng 0,5 điểm/).slice(3).forEach((b) => fireEvent.click(b));
    fireEvent.click(screen.getByTestId('sign-submit'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = (onSave.mock.calls[0] as any)[0] as PeriodEntry;
    expect(saved.isSigned).toBe(true);
    expect(saved.scores).toMatchObject({ learning: 3.5, discipline: 3, hygiene: 2, total: 9.5 });
  });

  it('nút ⚡10đ tính là đã chọn đủ', async () => {
    const onSave = vi.fn(async () => {});
    render(<PeriodEntryModal {...baseProps} onSave={onSave} />);
    fillLesson();
    fireEvent.click(screen.getByText(/10đ$/));
    fireEvent.click(screen.getByTestId('sign-submit'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('tiết đã ký từ trước: giữ nguyên điểm đã lưu, không bắt chấm lại', async () => {
    const onSave = vi.fn(async () => {});
    const signed = {
      periodIndex: 2, subject: 'Toán', lessonTopic: 'Bài 1', teacherId: 'gvbm', teacherName: 'Cô B', absentStudents: [],
      scores: { learning: 3, discipline: 2.5, hygiene: 2, customCriterion: 1, total: 8.5 },
      teacherComment: '', teacherSignature: 'Cô B', isSigned: true, updatedAt: 1,
    } as PeriodEntry;
    render(<PeriodEntryModal {...baseProps} onSave={onSave} initialEntry={signed} />);
    expect(score('Học tập').value).toBe('3');
    expect(score('Kỷ luật').value).toBe('2,5');
    expect(screen.queryByTestId('score-incomplete')).toBeNull();
    fireEvent.click(screen.getByTestId('sign-submit'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(((onSave.mock.calls[0] as any)[0] as PeriodEntry).scores.total).toBe(8.5);
  });

  it('tiết đã lưu điểm danh nhưng chưa ký: điểm mặc định trong doc KHÔNG được coi là đã chấm', () => {
    const att = {
      periodIndex: 2, subject: 'Toán', lessonTopic: '', teacherId: 'gvbm', teacherName: 'Cô B', absentStudents: [],
      scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 },
      teacherComment: '', teacherSignature: '', isSigned: false, attendanceTakenAt: 5, updatedAt: 1,
    } as PeriodEntry;
    render(<PeriodEntryModal {...baseProps} onSave={async () => {}} initialEntry={att} />);
    expect(score('Học tập').value).toBe('');
  });

  it('ngoại lệ (NN2 / theo TKB): ký không cần chấm, lưu 10đ', async () => {
    const onSave = vi.fn(async () => {});
    const { unmount } = render(<PeriodEntryModal {...baseProps} onSave={onSave} />);
    fillLesson('Foreign language 2');
    expect(screen.getByTestId('score-optional')).toBeTruthy();
    fireEvent.click(screen.getByTestId('sign-submit'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(((onSave.mock.calls[0] as any)[0] as PeriodEntry).scores.total).toBe(10);
    unmount();
    const onSave2 = vi.fn(async () => {});
    render(<PeriodEntryModal {...baseProps} onSave={onSave2} scoringOptionalReason="Tiết lớp trộn" />);
    fillLesson('Tiếng Anh');
    fireEvent.click(screen.getByTestId('sign-submit'));
    await waitFor(() => expect(onSave2).toHaveBeenCalledTimes(1));
  });
});

describe('scoringOptionalReason', () => {
  it('lớp trộn, NN2, Native, HĐTN, K9 test prep / Eng 1 → không bắt buộc; môn thường → bắt buộc', () => {
    expect(scoringOptionalReason('7A1', ['Maths'], { mode: 'auto10' })).toMatch(/mặc định 10đ/);
    expect(scoringOptionalReason('7A1', ['Maths'], { mode: 'skip' })).toMatch(/lớp trộn/);
    expect(scoringOptionalReason('7A1', ['Foreign language 2'])).toBeTruthy();
    expect(scoringOptionalReason('7A1', ['Tiếng Nhật'])).toBeTruthy();
    expect(scoringOptionalReason('7A1', ['Native 1'])).toBeTruthy();
    expect(scoringOptionalReason('7A1', ['Homeroom'])).toMatch(/HĐTN/);
    expect(scoringOptionalReason('9A2', ['Maths test prep'])).toBeTruthy();
    expect(scoringOptionalReason('9A2', ['Eng 1'])).toBeTruthy();
    expect(scoringOptionalReason('8A2', ['Eng 1'])).toBeNull();
    expect(scoringOptionalReason('7A1', ['Maths', ''])).toBeNull();
    expect(scoringOptionalReason('7A1', ['', 'Literature'])).toBeNull();
  });
  it('missingScoreKeys theo thứ tự hiển thị', () => {
    expect(missingScoreKeys({ learning: 4, discipline: null, hygiene: 0, customCriterion: null })).toEqual(['discipline', 'customCriterion']);
  });
});
