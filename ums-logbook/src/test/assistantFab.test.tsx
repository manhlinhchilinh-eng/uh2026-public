import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AssistantFab } from '../components/assistant/AssistantFab';
import { DocAnswerCard } from '../components/assistant/DocAnswerCard';
import { GOT_TALENT_TEXT, GOT_TALENT_TITLE } from '../utils/assistant/__tests__/fixtures/gotTalent';

let authState: { activeRole: string | null; profile: { uid?: string; assignedClassId?: string } | null } = { activeRole: 'gvbm', profile: null };
const gotTalentAdminDoc = {
  id: 'gt5', title: GOT_TALENT_TITLE, category: 'khac', url: '', description: GOT_TALENT_TEXT, docNumber: '', issuedDate: '2026-11-05',
  pinned: false, authorId: 'a', authorName: 'A', createdAt: 1, updatedAt: 1,
};
const getAdminDocsCached = vi.fn(async (_uid: string) => [gotTalentAdminDoc]);
vi.mock('../services/adminDocCache', () => ({ getAdminDocsCached: (uid: string) => getAdminDocsCached(uid) }));
let announcementItems: Array<Record<string, unknown>> = [];
vi.mock('../context/AnnouncementsContext', () => ({ useAnnouncements: () => ({ items: announcementItems }) }));
vi.mock('../context/OfficeNoticesContext', () => ({ useOfficeNotices: () => ({ notices: [] }) }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../services/rosterService', () => ({
  fetchClassRosterStrict: async (classId: string) =>
    classId === '6A1'
      ? [{ id: '1', mhs: '269398', stt: 1, name: 'Lý Bảo Duy', classId: '6A1', grade: 6, dob: '2015-07-04', gender: 'Nam', status: 'active', createdAt: 0 }]
      : null,
}));
vi.mock('../hooks/useLanguage', () => ({ useLanguage: () => ({ language: 'vi' }) }));
const att = vi.hoisted(() => ({
  school: vi.fn(async (_date: string) => ({
    logbooks: [{ classId: '6A1', morningBaseline: { reportedBy: 'gv', reportedAt: 1, absences: [], earlyDepartures: [] } }],
    students: [],
    truncated: false,
    loadedAt: Date.UTC(2026, 10, 5, 1, 30),
  })),
  cls: vi.fn(async (classId: string, _date: string) => ({
    logbooks: [{ classId, morningBaseline: { reportedBy: 'gv', reportedAt: 1, absences: [], earlyDepartures: [] } }],
    students: [],
    truncated: false,
    loadedAt: Date.UTC(2026, 10, 5, 1, 30),
  })),
  sizes: vi.fn(async () => ({ '6A1': 26 })),
  size: vi.fn(async (_classId: string) => 26),
  calendar: vi.fn(async () => ({ offPeriods: [] as Array<{ from: string; to?: string; reason?: string }> })),
}));
vi.mock('../services/schoolAttendanceService', () => ({
  fetchSchoolAttendanceCached: (d: string) => att.school(d),
  fetchClassAttendance: (c: string, d: string) => att.cls(c, d),
}));
vi.mock('../services/classSizeCache', () => ({ getClassSizes: () => att.sizes(), getClassSize: (c: string) => att.size(c) }));
vi.mock('../services/schoolCalendarService', () => ({ fetchSchoolCalendar: () => att.calendar() }));

const Where = () => {
  const l = useLocation();
  return (
    <>
      <div data-testid="where">{l.pathname}</div>
      <div data-testid="where-search">{l.search}</div>
    </>
  );
};
const setup = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
      <AssistantFab />
    </MemoryRouter>
  );
const askQ = (q: string) => {
  fireEvent.change(screen.getByLabelText('Câu hỏi cho Trợ lý'), { target: { value: q } });
  fireEvent.click(screen.getByLabelText('Gửi'));
};

describe('AssistantFab', () => {
  beforeEach(() => {
    authState = { activeRole: 'gvbm', profile: null };
    localStorage.clear();
    getAdminDocsCached.mockClear();
    announcementItems = [];
    att.school.mockClear();
    att.cls.mockClear();
    att.sizes.mockClear();
    att.size.mockClear();
    att.calendar.mockClear();
  });

  describe('số liệu điểm danh trong ngày', () => {
    // Thứ Năm 05/11/2026 (ngày học)
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 5, 9, 0));
    });
    afterEach(() => vi.useRealTimers());

    it('BGH hỏi "hôm nay bao nhiêu hs đi học" → thẻ số liệu, bấm mở Vắng/muộn', async () => {
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('hôm nay bao nhiêu hs đi học');
      const card = await screen.findByTestId('assistant-stats');
      expect(card.textContent).toContain('lớp đã điểm danh');
      expect(card.textContent).toContain('có mặt 26/26');
      expect(att.school).toHaveBeenCalledWith('2026-11-05');
      expect(att.cls).not.toHaveBeenCalled();
      expect(getAdminDocsCached).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('assistant-stats-open'));
      expect(screen.getByTestId('where').textContent).toBe('/vang-muon');
    });

    it('BGH hỏi 1 lớp → chỉ số liệu lớp đó', async () => {
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('lớp 6A2 hôm nay vắng mấy bạn');
      const card = await screen.findByTestId('assistant-stats');
      expect(card.textContent).toContain('Lớp 6A2');
      expect(card.textContent).toContain('chưa điểm danh');
    });

    it('GVBM hỏi số liệu lớp khác, bộ câu hỏi không có câu trả lời → không có quyền, không đọc', () => {
      authState = { activeRole: 'gvbm', profile: { uid: 'u-gvbm' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('lớp 7A3 hôm nay nghỉ mấy bạn');
      expect(screen.getByTestId('assistant-denied').textContent).toContain('Bạn không có quyền xem số liệu toàn trường.');
      expect(att.school).not.toHaveBeenCalled();
      expect(att.cls).not.toHaveBeenCalled();
      expect(att.sizes).not.toHaveBeenCalled();
    });

    it('GVBM hỏi không nêu phạm vi trường → không báo "không có quyền", không đọc', () => {
      authState = { activeRole: 'gvbm', profile: { uid: 'u-gvbm' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('hôm nay bao nhiêu hs đi học');
      expect(screen.queryByTestId('assistant-denied')).toBeNull();
      expect(screen.queryByTestId('assistant-stats')).toBeNull();
      expect(screen.queryByText('Đang tải số liệu điểm danh…')).toBeNull();
      expect(att.school).not.toHaveBeenCalled();
    });

    const faqCases: Array<[string, string, string]> = [
      ['parent', 'con vắng mấy buổi', 'Xem con nghỉ học bao nhiêu buổi?'],
      ['parent', 'con đi muộn mấy lần', 'Xem con nghỉ học bao nhiêu buổi?'],
      ['parent', 'Xem con nghỉ học bao nhiêu buổi?', 'Xem con nghỉ học bao nhiêu buổi?'],
      ['gvbm', 'nghỉ ốm bhxh còn bao nhiêu', 'Tôi còn bao nhiêu ngày phép?'],
      ['admin', 'nghỉ ốm bhxh còn bao nhiêu', 'Tôi còn bao nhiêu ngày phép?'],
    ];
    it.each(faqCases)('%s hỏi "%s" → câu trả lời FAQ đã duyệt, không số liệu', (role, q, faqQ) => {
      authState = { activeRole: role, profile: { uid: `u-${role}`, assignedClassId: role === 'parent' ? '6A1' : undefined } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ(q);
      expect(screen.getByTestId('assistant-reply').textContent).toContain(faqQ);
      expect(screen.queryByTestId('assistant-stats')).toBeNull();
      expect(screen.queryByText('Đang tải số liệu điểm danh…')).toBeNull();
      expect(screen.queryByTestId('assistant-denied')).toBeNull();
      expect(att.school).not.toHaveBeenCalled();
      expect(att.cls).not.toHaveBeenCalled();
    });

    it.each([['gvbm'], ['admin']])('%s hỏi câu FAQ gia đình → không số liệu, không đọc', (role) => {
      authState = { activeRole: role, profile: { uid: `u-${role}` } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('con vắng mấy buổi');
      expect(screen.queryByTestId('assistant-stats')).toBeNull();
      expect(screen.queryByText('Đang tải số liệu điểm danh…')).toBeNull();
      expect(screen.queryByTestId('assistant-denied')).toBeNull();
      expect(att.school).not.toHaveBeenCalled();
    });

    it.each([['gvbm'], ['admin']])('%s hỏi "đi muộn mấy giờ thì bị ghi tên" → không số liệu', (role) => {
      authState = { activeRole: role, profile: { uid: `u-${role}` } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('đi muộn mấy giờ thì bị ghi tên');
      expect(screen.queryByTestId('assistant-stats')).toBeNull();
      expect(screen.queryByText('Đang tải số liệu điểm danh…')).toBeNull();
      expect(screen.queryByTestId('assistant-denied')).toBeNull();
      expect(att.school).not.toHaveBeenCalled();
    });

    it('BGH hỏi "hôm nay ai vắng" → số liệu toàn trường', async () => {
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('hôm nay ai vắng');
      expect((await screen.findByTestId('assistant-stats')).textContent).toContain('lớp đã điểm danh');
      expect(att.school).toHaveBeenCalledWith('2026-11-05');
    });

    it('GVCN 6A1 hỏi "lớp 6A1 hôm nay ai nghỉ" → số liệu lớp mình', async () => {
      authState = { activeRole: 'gvcn', profile: { uid: 'u-gvcn', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('lớp 6A1 hôm nay ai nghỉ');
      expect((await screen.findByTestId('assistant-stats')).textContent).toContain('Lớp 6A1');
      expect(att.cls).toHaveBeenCalledWith('6A1', '2026-11-05');
    });

    it('GVCN: đọc sĩ số lỗi → vẫn hiện số liệu (không có "có mặt")', async () => {
      att.size.mockRejectedValueOnce(new Error('offline'));
      authState = { activeRole: 'gvcn', profile: { uid: 'u-gvcn', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('hôm nay lớp mình nghỉ mấy bạn');
      const card = await screen.findByTestId('assistant-stats');
      expect(card.textContent).toContain('Chưa có sĩ số: 6A1');
      expect(card.textContent).not.toContain('có mặt 26');
    });

    it('GVCN 6A1 hỏi lớp 7A3 → từ chối, không đọc', () => {
      authState = { activeRole: 'gvcn', profile: { uid: 'u-gvcn', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('lớp 7A3 hôm nay nghỉ mấy bạn');
      expect(screen.getByTestId('assistant-denied').textContent).toContain('6A1');
      expect(att.school).not.toHaveBeenCalled();
      expect(att.cls).not.toHaveBeenCalled();
    });

    it('GVCN 6A1 hỏi lớp mình → đọc riêng lớp, nút mở sổ đầu bài', async () => {
      authState = { activeRole: 'gvcn', profile: { uid: 'u-gvcn', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('hôm nay lớp mình nghỉ mấy bạn');
      const card = await screen.findByTestId('assistant-stats');
      expect(card.textContent).toContain('Lớp 6A1');
      expect(card.textContent).toContain('có mặt 26/26');
      expect(att.cls).toHaveBeenCalledWith('6A1', '2026-11-05');
      expect(att.size).toHaveBeenCalledWith('6A1');
      expect(att.school).not.toHaveBeenCalled();
      expect(att.sizes).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('assistant-stats-open'));
      expect(screen.getByTestId('where').textContent).toBe('/logbook');
      expect(screen.getByTestId('where-search').textContent).toBe('?classId=6A1&date=2026-11-05');
    });

    it('Chủ nhật → "không có lịch học", không đọc gì', () => {
      vi.setSystemTime(new Date(2026, 10, 8, 9, 0));
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('hôm nay bao nhiêu hs đi học');
      expect(screen.getByTestId('assistant-stats-offday').textContent).toContain('Ngày 08/11 không có lịch học.');
      expect(att.calendar).not.toHaveBeenCalled();
      expect(att.school).not.toHaveBeenCalled();
    });

    it('ngày nghỉ BGH khai → "không có lịch học", không đọc điểm danh', async () => {
      att.calendar.mockResolvedValueOnce({ offPeriods: [{ from: '2026-11-05', reason: 'Nghỉ bù' }] });
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('hôm nay bao nhiêu hs đi học');
      expect((await screen.findByTestId('assistant-stats-offday')).textContent).toContain('Ngày 05/11 không có lịch học.');
      expect(att.school).not.toHaveBeenCalled();
    });

    it('đọc điểm danh lỗi → báo chưa tải được, hết trạng thái chờ', async () => {
      att.school.mockRejectedValueOnce(new Error('offline'));
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('hôm nay bao nhiêu hs đi học');
      expect((await screen.findByTestId('assistant-stats-error')).textContent).toContain('Chưa tải được số liệu điểm danh, thử lại sau.');
      expect(screen.queryByText('Đang tải số liệu điểm danh…')).toBeNull();
    });

    it('"xin nghỉ ốm" vẫn là câu hỏi hướng dẫn, không phải số liệu', () => {
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('xin nghỉ ốm');
      expect(screen.queryByTestId('assistant-stats')).toBeNull();
      expect(screen.queryByText('Đang tải số liệu điểm danh…')).toBeNull();
      expect(att.school).not.toHaveBeenCalled();
    });

    it('BGH hỏi "Còn bao nhiêu lớp chưa điểm danh?" → thẻ số liệu ("còn" không phải "con")', async () => {
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('Còn bao nhiêu lớp chưa điểm danh?');
      const card = await screen.findByTestId('assistant-stats');
      expect(card.textContent).toContain('Chưa điểm danh');
      expect(att.school).toHaveBeenCalledWith('2026-11-05');
    });

    it('BGH hỏi "Tôi muốn biết có bao nhiêu lớp vào chung kết Got Talent" → trả lời theo văn bản, không có thẻ số liệu', async () => {
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('Tôi muốn biết có bao nhiêu lớp vào chung kết Got Talent');
      const card = await screen.findByTestId('assistant-doc-answer');
      expect(card.textContent).toContain(GOT_TALENT_TITLE);
      expect(screen.queryByTestId('assistant-stats')).toBeNull();
      expect(att.school).not.toHaveBeenCalled();
    });

    it('BGH hỏi "Nghỉ lễ 20/11 mấy ngày" (ngày tương lai) → câu trả lời FAQ, không đọc điểm danh', () => {
      authState = { activeRole: 'admin', profile: { uid: 'u-admin' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('Nghỉ lễ 20/11 mấy ngày');
      expect(screen.getByTestId('assistant-action').textContent).toContain('Mở Ngày nghỉ');
      expect(screen.queryByTestId('assistant-stats')).toBeNull();
      expect(screen.queryByText('Đang tải số liệu điểm danh…')).toBeNull();
      expect(att.school).not.toHaveBeenCalled();
      expect(att.cls).not.toHaveBeenCalled();
      expect(att.calendar).not.toHaveBeenCalled();
    });
  });

  it('bấm nút nổi mở khung, Esc đóng', () => {
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
  });

  it('hỏi "xin nghỉ ốm" → bấm nút mở đúng trang Xin nghỉ', () => {
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    askQ('xin nghỉ ốm');
    fireEvent.click(screen.getByTestId('assistant-action'));
    expect(screen.getByTestId('where').textContent).toBe('/leave');
  });

  it('bộ phận chuyển tiếp chỉ hiện sau khi bấm "Chưa đúng"', () => {
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    askQ('xin nghỉ ốm');
    expect(screen.queryByTestId('assistant-dept')).toBeNull();
    fireEvent.click(screen.getByTestId('assistant-down'));
    expect(screen.getAllByTestId('assistant-dept').length).toBeGreaterThan(0);
  });

  it('khách (chưa đăng nhập): quên mật khẩu → thẻ liên hệ, không có nút mở trang nội bộ', () => {
    authState = { activeRole: null, profile: null };
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    askQ('quên mật khẩu');
    expect(screen.getByTestId('assistant-dept')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-action')).toBeNull();
  });

  it('câu lạ → "Chưa có câu trả lời", ghi lại trên máy để bổ sung', () => {
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    askQ('trường có dạy bơi không');
    expect(screen.getByTestId('assistant-none')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('ums_assistant_unmatched') || '[]')).toHaveLength(1);
  });

  it('GVCN hỏi thông tin HS lớp mình → thẻ dữ liệu thật', async () => {
    authState = { activeRole: 'gvcn', profile: { assignedClassId: '6A1' } };
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    askQ('thông tin bạn Bảo Duy');
    const card = await screen.findByTestId('assistant-student');
    expect(card.textContent).toContain('Lý Bảo Duy');
    expect(card.textContent).toContain('04/07/2015');
  });

  it('GVCN hỏi HS lớp khác → từ chối, không đọc', () => {
    authState = { activeRole: 'gvcn', profile: { assignedClassId: '6A1' } };
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    askQ('thông tin bạn Duy lớp 9A2');
    expect(screen.getByTestId('assistant-denied').textContent).toContain('6A1');
  });

  it('sổ đầu bài tiết 3 hôm qua → mở đúng lớp/ngày/tiết', () => {
    authState = { activeRole: 'gvcn', profile: { assignedClassId: '6A1' } };
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    askQ('sổ đầu bài tiết 3 hôm qua');
    fireEvent.click(screen.getByTestId('assistant-open-logbook'));
    expect(screen.getByTestId('where').textContent).toBe('/logbook');
  });

  it('in sổ điểm từng bạn → nói thật là chưa có + gửi ý tưởng', () => {
    authState = { activeRole: 'gvcn', profile: { assignedClassId: '6A1' } };
    setup();
    fireEvent.click(screen.getByTestId('assistant-fab'));
    askQ('Làm sao để in sổ điểm từng bạn');
    expect(screen.getByTestId('assistant-missing').textContent).toContain('chưa có');
    fireEvent.click(screen.getByTestId('assistant-feedback-link'));
    expect(screen.getByTestId('feedback-guest')).toBeInTheDocument(); // mock useAuth không có user → form khách
  });

  describe('trả lời theo văn bản / thông báo', () => {
    const q = 'lớp tôi có vào chung kết got talent không';

    it('GVCN 6A1 → thẻ văn bản có 6A1, bấm mở đúng văn bản Hành chính', async () => {
      authState = { activeRole: 'gvcn', profile: { uid: 'u-gvcn', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ(q);
      const card = await screen.findByTestId('assistant-doc-answer');
      expect(card.textContent).toContain('6A1');
      expect(card.textContent).toContain('Hào khí Nam Quốc');
      expect(getAdminDocsCached).toHaveBeenCalledWith('u-gvcn');
      fireEvent.click(screen.getByTestId('assistant-doc-open'));
      expect(screen.getByTestId('where').textContent).toBe('/hanh-chinh');
      expect(screen.getByTestId('where-search').textContent).toBe('?open=gt5');
    });

    it('PH hỏi cùng câu → không đọc admin_docs, báo chưa có thông báo + liên hệ GVCN', () => {
      authState = { activeRole: 'parent', profile: { uid: 'u-ph', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ(q);
      expect(getAdminDocsCached).not.toHaveBeenCalled();
      expect(screen.getByTestId('assistant-doc-none').textContent).toContain('Chưa có thông báo gửi phụ huynh');
      expect(screen.getByTestId('assistant-dept')).toBeInTheDocument();
    });

    it('GVBM (không có lớp chủ nhiệm) hỏi "lớp tôi" → hỏi lại lớp', async () => {
      authState = { activeRole: 'gvbm', profile: { uid: 'u-gvbm' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ(q);
      const card = await screen.findByTestId('assistant-doc-answer');
      expect(card.textContent).toContain('lớp nào');
      expect(screen.getByTestId('assistant-doc-open')).toBeInTheDocument();
    });

    it('câu FAQ đã duyệt → hiển thị như cũ, không đọc admin_docs', () => {
      authState = { activeRole: 'gvcn', profile: { uid: 'u-gvcn', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ('xin nghỉ ốm');
      expect(screen.getByTestId('assistant-action')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-doc-answer')).toBeNull();
      expect(getAdminDocsCached).not.toHaveBeenCalled();
    });

    const familyFaqQ = 'Thông báo của lớp, của trường gửi phụ huynh xem ở đâu?';

    it('PH hỏi câu FAQ đã duyệt có chữ "thông báo", không có văn bản khớp → giữ câu trả lời FAQ', () => {
      authState = { activeRole: 'parent', profile: { uid: 'u-ph', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ(familyFaqQ);
      expect(screen.getByTestId('assistant-reply').textContent).toContain(familyFaqQ);
      expect(screen.queryByTestId('assistant-doc-none')).toBeNull();
      expect(getAdminDocsCached).not.toHaveBeenCalled();
    });

    it('văn bản chỉ khớp một phần (links) → hiện link kèm câu trả lời FAQ', () => {
      announcementItems = [
        { id: 'an1', title: 'Tin tuần 10', body: 'Thông báo của trường gửi phụ huynh xem ở đâu: trên UMS+.', createdAt: 1 },
      ];
      authState = { activeRole: 'parent', profile: { uid: 'u-ph', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ(familyFaqQ);
      expect(screen.getByTestId('assistant-doc-links').textContent).toContain('Tin tuần 10');
      expect(screen.getByTestId('assistant-reply').textContent).toContain(familyFaqQ);
      fireEvent.click(screen.getByTestId('assistant-doc-open'));
      expect(screen.getByTestId('where').textContent).toBe('/announcements');
      expect(screen.getByTestId('where-search').textContent).toBe('?open=an1');
    });

    it('đọc admin_docs lỗi → không vỡ, quay về luồng cũ', async () => {
      getAdminDocsCached.mockRejectedValueOnce(new Error('offline'));
      authState = { activeRole: 'gvcn', profile: { uid: 'u-gvcn', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ(q);
      // Bộ câu hỏi chỉ gợi ý (suggest) cho câu này → hiện lại gợi ý như cũ, không có thẻ văn bản.
      expect(await screen.findByText('Có phải bạn muốn hỏi:')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-doc-answer')).toBeNull();
      expect(screen.queryByText('Đang tìm trong văn bản, thông báo…')).toBeNull();
    });

    it('văn bản hỏng dữ liệu (mô tả không phải chữ) → không kẹt "Đang tìm…", quay về luồng cũ', async () => {
      getAdminDocsCached.mockResolvedValueOnce([{ ...gotTalentAdminDoc, description: 42 as unknown as string }]);
      authState = { activeRole: 'gvcn', profile: { uid: 'u-gvcn', assignedClassId: '6A1' } };
      setup();
      fireEvent.click(screen.getByTestId('assistant-fab'));
      askQ(q);
      expect(await screen.findByText('Có phải bạn muốn hỏi:')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-doc-answer')).toBeNull();
      expect(screen.queryByText('Đang tìm trong văn bản, thông báo…')).toBeNull();
    });
  });

  it('DocAnswerCard: chỉ hiện link ngoài khi là https', () => {
    const doc = (id: string, url: string) => ({ id, source: 'admin_doc' as const, title: `VB ${id}`, text: '', link: { url } });
    render(
      <DocAnswerCard
        a={{ kind: 'links', docs: [doc('ok', 'https://example.com/a'), doc('bad', 'javascript:alert(1)')] }}
        L={(v) => v}
        go={() => {}}
      />
    );
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://example.com/a']);
  });
});
