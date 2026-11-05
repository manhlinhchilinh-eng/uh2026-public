/**
 * Sổ điểm cho GVCN / PH / HS + TKB cho HS (yêu cầu 05/11/2026). Dữ liệu giả, không phải HS thật.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const authState = vi.hoisted(() => ({
  activeRole: 'student' as string | null,
  profile: { uid: 'hs1', displayName: 'Em A', roles: ['student'], studentDocIds: ['9A3_01'], studentMhs: ['900001'], assignedClassId: '9A3' } as any,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));

const fam = vi.hoisted(() => ({ fetchLinkedStudents: vi.fn(), fetchBehaviorNotesForStudent: vi.fn() }));
vi.mock('../services/familyService', async (orig) => ({ ...(await orig<typeof import('../services/familyService')>()), ...fam }));
const daily = vi.hoisted(() => ({ fetchStudentDaily: vi.fn(async () => [] as any[]) }));
vi.mock('../services/studentDailyService', () => daily);

const gbs = vi.hoisted(() => ({
  fetchGradeReport: vi.fn(),
  fetchClassGradebooks: vi.fn(),
  fetchClassAssignments: vi.fn(),
}));
vi.mock('../services/gradebookService', async (orig) => ({ ...(await orig<typeof import('../services/gradebookService')>()), ...gbs }));
const roster = vi.hoisted(() => ({ fetchClassRoster: vi.fn() }));
vi.mock('../services/rosterService', async (orig) => ({ ...(await orig<typeof import('../services/rosterService')>()), ...roster }));

import { FamilyHomePage } from '../pages/FamilyHomePage';
import { familyClassIds } from '../pages/FamilyTimetablePage';
import { FamilyGradesCard } from '../components/gradebook/FamilyGradesCard';
import { ClassGradesView, studentSheetFromBooks } from '../components/gradebook/ClassGradesView';
import { newGradebook, type Gradebook } from '../utils/gradebook';

const book = (subjectKey: string, subjectName: string, mode: 'score' | 'comment', rows: Gradebook['rows'], status: Gradebook['status'] = 'published'): Gradebook => ({
  ...newGradebook({ year: '2026-2027', classId: '9A3', subjectKey, subjectName, mode, txMin: 4 }, 1),
  rows, status, version: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  authState.activeRole = 'student';
});

describe('HS xem TKB lớp mình', () => {
  it('nhận xét/chuyên cần lỗi quyền vẫn hiện TKB + điểm (trước đây cả trang báo lỗi, mất TKB)', async () => {
    fam.fetchLinkedStudents.mockResolvedValue([{ docId: '9A3_01', mhs: '900001', fullName: 'Em A', className: '9A3', grade: 9 }]);
    fam.fetchBehaviorNotesForStudent.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    gbs.fetchGradeReport.mockResolvedValue(null);
    render(<MemoryRouter><FamilyHomePage /></MemoryRouter>);
    expect(await screen.findByTestId('family-tkb-9A3')).toBeInTheDocument();
    expect(screen.getByText('Góc học sinh')).toBeInTheDocument();
    expect(screen.getByText(/Một phần dữ liệu/)).toBeInTheDocument();
    // Thẻ điểm tải sau thẻ TKB → chờ (trước đây kiểm ngay, chập chờn khi chạy cả bộ test)
    await waitFor(() => expect(gbs.fetchGradeReport).toHaveBeenCalledWith(expect.any(String), expect.any(Number), '900001'));
  });

  it('tài khoản HS chưa liên kết hồ sơ nhưng có lớp → vẫn xem TKB lớp', async () => {
    fam.fetchLinkedStudents.mockResolvedValue([]);
    render(<MemoryRouter><FamilyHomePage /></MemoryRouter>);
    expect(await screen.findByTestId('family-tkb-9A3')).toBeInTheDocument();
    expect(screen.getByText(/chưa được liên kết/)).toBeInTheDocument();
  });

  it('mục menu Thời khóa biểu: lớp của các con + lớp gắn tài khoản, không trùng', () => {
    expect(familyClassIds('9A3', [{ className: '9A3' }, { className: '6A1' }])).toEqual(['9A3', '6A1']);
    expect(familyClassIds('', [])).toEqual([]);
    expect(familyClassIds(undefined, [{ className: ' 7A2 ' }])).toEqual(['7A2']);
  });
});

describe('PH/HS tra cứu điểm (bản công bố) theo mẫu học bạ', () => {
  it('bảng TT | Môn | ĐĐGtx n cột | GK | CK | ĐTBmhk, xếp đúng thứ tự môn', async () => {
    gbs.fetchGradeReport.mockResolvedValue({
      mhs: '900001', classId: '9A3', year: '2026-2027', term: 1, updatedAt: 1,
      subjects: {
        gdtc: { name: 'Giáo dục thể chất', mode: 'comment', tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', result: 'Đ', comment: '', publishedAt: 1 },
        gdcd: { name: 'Giáo dục công dân', mode: 'score', tx: [10, 9.5], gk: 8, ck: 9.5, result: '9.1', comment: '', publishedAt: 1 },
        toan: { name: 'Toán', mode: 'score', tx: [10, 10, 10, 10], gk: 10, ck: 9.5, result: '9.8', comment: 'Tiến bộ', publishedAt: 1 },
      },
    });
    render(<FamilyGradesCard mhs="900001" year="2026-2027" defaultTerm={1} />);
    const sheet = await screen.findByTestId('family-grade-sheet-900001');
    const rows = within(sheet).getAllByRole('row').slice(2);
    const cells = rows.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent));
    expect(cells).toEqual([
      ['1', 'Toán', '10', '10', '10', '10', '10', '9,5', '9,8'],
      ['2', 'Giáo dục công dân', '10', '9,5', '', '', '8', '9,5', '9,1'],
      ['3', 'Giáo dục thể chất', 'Đ', 'Đ', '', '', 'Đ', 'Đ', 'Đ'],
    ]);
    expect(sheet).toHaveTextContent('Toán: Tiến bộ');
    expect(gbs.fetchGradeReport).toHaveBeenCalledTimes(1); // 1 lượt đọc / HS / học kỳ
  });
});

describe('GVCN xem sổ điểm mọi môn của HS lớp mình (chỉ đọc)', () => {
  const books = [
    book('toan', 'Toán', 'score', { '900001': { tx: [10, 10, 10, 10], gk: 10, ck: 9.5, comment: '' } }),
    book('cong_nghe', 'Công nghệ', 'score', { '900001': { tx: [10, 10, 10], gk: 10, ck: 10, comment: '' } }, 'draft'),
    book('hdtn', 'HĐTN', 'comment', { '900001': { tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', comment: '' } }),
  ];
  const assigns = [{ subjectKey: 'ngu_van', subjectName: 'Ngữ văn' }, { subjectKey: 'toan', subjectName: 'Toán' }];

  it('gộp sổ các môn của 1 HS; môn chưa có sổ ghi "chưa nhập"; sổ nháp ghi "Nháp"', () => {
    const s = studentSheetFromBooks(books, assigns, '900001');
    expect(s.find((x) => x.key === 'toan')).toMatchObject({ tx: [10, 10, 10, 10], result: '9,8', note: 'Đã công bố' });
    expect(s.find((x) => x.key === 'cong_nghe')).toMatchObject({ tx: [10, 10, 10], result: '10', note: 'Nháp' });
    expect(s.find((x) => x.key === 'hdtn')).toMatchObject({ result: 'Đ' });
    expect(s.find((x) => x.key === 'ngu_van')).toMatchObject({ tx: [], result: '', note: 'chưa nhập' });
  });

  it('bấm tên HS mở bảng điểm, không có ô nhập', async () => {
    roster.fetchClassRoster.mockResolvedValue([{ mhs: '900001', name: 'Em A', stt: 1 }]);
    gbs.fetchClassGradebooks.mockResolvedValue(books);
    gbs.fetchClassAssignments.mockResolvedValue([]);
    render(<ClassGradesView year="2026-2027" term={1} classOptions={['9A3']} initialClassId="9A3" />);
    fireEvent.click(await screen.findByTestId('gb-student-900001'));
    const sheet = await screen.findByTestId('gb-student-sheet');
    expect(within(sheet).getByTestId('sheet-row-toan')).toHaveTextContent('9,8');
    expect(within(sheet).getByTestId('sheet-row-cong_nghe')).toHaveTextContent('Nháp');
    expect(sheet.querySelectorAll('input')).toHaveLength(0);
    // Không đọc thêm khi mở từng HS
    expect(gbs.fetchClassGradebooks).toHaveBeenCalledTimes(1);
  });
});
