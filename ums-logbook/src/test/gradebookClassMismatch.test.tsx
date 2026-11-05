/**
 * Lỗi prod 05/11: tab "Lớp chủ nhiệm 9A3" hiện danh sách + điểm của 6A1 (tài khoản BGH kiêm GVCN đổi vai trò),
 * và sổ GDCD (2 cột) còn điểm ở cột ĐĐGtx 3–4 nhập theo mẫu cũ. Dữ liệu giả.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';

const authState = vi.hoisted(() => ({
  activeRole: 'admin' as string,
  profile: { uid: 'u1', displayName: 'Thầy L', roles: ['admin', 'gvcn', 'gvbm'], assignedClassId: '9A3' } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
const gbs = vi.hoisted(() => ({
  fetchClassGradebooks: vi.fn(async () => [] as any[]),
  fetchClassAssignments: vi.fn(async () => [] as any[]),
  fetchMyAssignments: vi.fn(async () => [] as any[]),
  fetchAllAssignments: vi.fn(async () => [] as any[]),
}));
vi.mock('../services/gradebookService', async (orig) => ({ ...(await orig<typeof import('../services/gradebookService')>()), ...gbs }));
const roster = vi.hoisted(() => ({ fetchClassRoster: vi.fn(async () => [] as any[]) }));
vi.mock('../services/rosterService', async (orig) => ({ ...(await orig<typeof import('../services/rosterService')>()), ...roster }));

import { GradebookPage } from '../pages/GradebookPage';
import { ClassGradesView } from '../components/gradebook/ClassGradesView';
import { extraTxStudents, newGradebook, reportSubjectOf, rowResult } from '../utils/gradebook';
import { termResultText } from '../utils/gradeCalc';

beforeEach(() => vi.clearAllMocks());
const lastClass = () => (gbs.fetchClassGradebooks.mock.calls.at(-1) as unknown[] | undefined)?.[2];

describe('tổng hợp lớp không lệch lớp', () => {
  it('lớp đang xem luôn thuộc danh sách chọn (không tải 6A1 khi chỉ được xem 9A3)', async () => {
    render(<ClassGradesView year="2026-2027" term={1} classOptions={['9A3']} initialClassId="6A1" />);
    await waitFor(() => expect(gbs.fetchClassGradebooks).toHaveBeenCalled());
    expect(gbs.fetchClassGradebooks.mock.calls.every((c) => (c as unknown[])[2] === '9A3')).toBe(true);
    expect(roster.fetchClassRoster).toHaveBeenCalledWith('9A3');
    expect(roster.fetchClassRoster).not.toHaveBeenCalledWith('6A1');
  });

  it('BGH kiêm GVCN: mặc định lớp mình; đổi sang vai trò GVCN vẫn tải 9A3', async () => {
    authState.activeRole = 'admin';
    const { rerender } = render(<GradebookPage />);
    act(() => screen.getByTestId('gb-tab-class').click());
    await waitFor(() => expect(lastClass()).toBe('9A3'));
    authState.activeRole = 'gvcn';
    rerender(<GradebookPage />);
    await waitFor(() => expect(screen.getByTestId('gb-tab-class')).toHaveTextContent('Lớp chủ nhiệm 9A3'));
    act(() => screen.getByTestId('gb-tab-class').click());
    await waitFor(() => expect(lastClass()).toBe('9A3'));
    expect(gbs.fetchClassGradebooks.mock.calls.some((c) => (c as unknown[])[2] === '6A1')).toBe(false);
  });
});

describe('sổ GDCD còn điểm ở cột ĐĐGtx thừa (nhập theo mẫu 5 cột cũ)', () => {
  const gb = {
    ...newGradebook({ year: '2026-2027', classId: '9A3', subjectKey: 'gdcd', subjectName: 'GDCD', mode: 'score', txMin: 2 }, 1),
    rows: {
      a: { tx: [10, 10, 10, 10], gk: 10, ck: 9.5, comment: '' },
      b: { tx: [null, null, null, null], gk: 10, ck: null, comment: '' },
    },
  };
  it('ĐTBmhk chỉ tính 2 cột của môn: (10+10 + 2·10 + 3·9,5)/7 = 9,8', () => {
    expect(termResultText(rowResult(gb, gb.rows.a))).toBe('9,8');
    // 3 TX nhưng chỉ cột 3 thừa → vẫn đủ 2 cột, chỉ 2 cột vào công thức: (8+6+16+21)/7 = 7,29 → 7,3
    expect(termResultText(rowResult(gb, { tx: [8, 6, 1, null], gk: 8, ck: 7, comment: '' }))).toBe('7,3');
  });
  it('liệt kê HS có điểm ở cột thừa, không xóa điểm', () => {
    expect(extraTxStudents(gb)).toEqual(['a']);
    expect(reportSubjectOf(gb, 'a', 1).tx).toEqual([10, 10, 10, 10]);
  });
});

describe('tổng hợp lớp hiện điểm dở dang (mới có GK, sổ nháp)', () => {
  it('partialSummary: chỉ GK → "GK 10"; TX + GK → "TX 9 8,5 · GK 10"; chưa nhập → ""', async () => {
    const { partialSummary } = await import('../utils/gradebook');
    const g = { subjectKey: 'toan', txMin: 4 };
    expect(partialSummary(g, { tx: [null, null, null, null], gk: 10, ck: null, comment: '' })).toBe('GK 10');
    expect(partialSummary(g, { tx: [9, 8.5, null, null], gk: 10, ck: null, comment: '' })).toBe('TX 9 8,5 · GK 10');
    expect(partialSummary(g, undefined)).toBe('');
  });
  it('ô tổng hợp hiện "GK 10" khi sổ Toán nháp mới có điểm giữa kỳ', async () => {
    roster.fetchClassRoster.mockResolvedValue([{ mhs: 'a', name: 'Em A', stt: 1 }] as any);
    gbs.fetchClassGradebooks.mockResolvedValue([
      { ...newGradebook({ year: '2026-2027', classId: '9A3', subjectKey: 'toan', subjectName: 'Toán', mode: 'score', txMin: 4 }, 1), status: 'draft', version: 1,
        rows: { a: { tx: [null, null, null, null], gk: 10, ck: null, comment: '' } } },
    ] as any);
    render(<ClassGradesView year="2026-2027" term={1} classOptions={['9A3']} initialClassId="9A3" />);
    expect(await screen.findByTestId('gb-cell-a-toan')).toHaveTextContent('GK 10');
  });
});

describe('tổng hợp lớp: tab chọn loại điểm (Hệ số 1 / Giữa kỳ / Cuối kỳ / ĐTBmhk)', () => {
  const setup = async () => {
    roster.fetchClassRoster.mockResolvedValue([{ mhs: 'a', name: 'Em A', stt: 1 }] as any);
    gbs.fetchClassGradebooks.mockResolvedValue([
      { ...newGradebook({ year: '2026-2027', classId: '9A3', subjectKey: 'toan', subjectName: 'Toán', mode: 'score', txMin: 4 }, 1), status: 'draft', version: 1,
        rows: { a: { tx: [9, 4.5, null, null], gk: 8.5, ck: null, comment: '' } } },
      { ...newGradebook({ year: '2026-2027', classId: '9A3', subjectKey: 'gdcd', subjectName: 'GDCD', mode: 'score', txMin: 2 }, 1), status: 'published', version: 1,
        rows: { a: { tx: [10, 10, 7, null], gk: 10, ck: 9, comment: '' } } },
    ] as any);
    gbs.fetchClassAssignments.mockResolvedValue([{ subjectKey: 'ngu_van', subjectName: 'Ngữ văn' }] as any);
    render(<ClassGradesView year="2026-2027" term={1} classOptions={['9A3']} initialClassId="9A3" />);
    await screen.findByTestId('gb-cell-a-toan');
  };

  it('Hệ số 1: mỗi môn tách đủ số cột ĐĐGtx của môn (Toán 4, GDCD 2, Ngữ văn 4 trống), không hiện cột thừa', async () => {
    await setup();
    fireEvent.click(screen.getByTestId('gb-view-tx'));
    expect(screen.getByTestId('gb-cell-a-toan-tx1')).toHaveTextContent('9');
    expect(screen.getByTestId('gb-cell-a-toan-tx2')).toHaveTextContent('4,5');
    expect(screen.getByTestId('gb-cell-a-toan-tx2').className).toContain('text-red-700');
    expect(screen.getByTestId('gb-cell-a-toan-tx4')).toHaveTextContent('');
    expect(screen.getByTestId('gb-cell-a-gdcd-tx2')).toHaveTextContent('10');
    expect(screen.queryByTestId('gb-cell-a-gdcd-tx3')).toBeNull();
    expect(screen.getByTestId('gb-cell-a-ngu_van-tx4')).toHaveTextContent('');
  });

  it('Giữa kỳ / Cuối kỳ: 1 cột mỗi môn; ĐTBmhk: chỉ điểm trung bình, không tóm tắt dở dang', async () => {
    await setup();
    fireEvent.click(screen.getByTestId('gb-view-gk'));
    expect(screen.getByTestId('gb-cell-a-toan')).toHaveTextContent(/^8,5$/);
    fireEvent.click(screen.getByTestId('gb-view-ck'));
    expect(screen.getByTestId('gb-cell-a-toan')).toHaveTextContent(/^$/);
    expect(screen.getByTestId('gb-cell-a-gdcd')).toHaveTextContent(/^9$/);
    fireEvent.click(screen.getByTestId('gb-view-avg'));
    expect(screen.getByTestId('gb-cell-a-toan')).toHaveTextContent(/^$/);
    // (10+10 + 2·10 + 3·9)/7 = 9,57 → 9,6 (cột TX thứ 3 là thừa, không tính)
    expect(screen.getByTestId('gb-cell-a-gdcd')).toHaveTextContent('9,6');
    fireEvent.click(screen.getByTestId('gb-view-all'));
    expect(screen.getByTestId('gb-cell-a-toan')).toHaveTextContent('TX 9 4,5 · GK 8,5');
    expect(gbs.fetchClassGradebooks).toHaveBeenCalledTimes(1); // đổi tab không đọc thêm
  });
});
