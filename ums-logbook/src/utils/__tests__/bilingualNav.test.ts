import { describe, expect, it } from 'vitest';
import { flatBilingual, parseLanguageMode, pickBilingual } from '../bilingual';
import { buildNavGroups, filterNavGroups, foldText, groupBadge } from '../navGroups';

const T = { vi: 'Sổ đầu bài', en: 'Class Logbook' };

describe('pickBilingual', () => {
  it('1 ngữ: chỉ ngôn ngữ chính', () => {
    expect(pickBilingual('vi', 'single', T)).toEqual({ primary: 'Sổ đầu bài', secondary: null });
    expect(pickBilingual('en', 'single', T)).toEqual({ primary: 'Class Logbook', secondary: null });
  });
  it('2 ngữ: chính + phụ, đảo được', () => {
    expect(pickBilingual('vi', 'dual', T)).toEqual({ primary: 'Sổ đầu bài', secondary: 'Class Logbook' });
    expect(pickBilingual('en', 'dual', T)).toEqual({ primary: 'Class Logbook', secondary: 'Sổ đầu bài' });
  });
  it('không lặp khi 2 bản giống nhau hoặc thiếu bản dịch', () => {
    expect(pickBilingual('vi', 'dual', { vi: 'Dashboard', en: 'dashboard' }).secondary).toBeNull();
    expect(pickBilingual('en', 'dual', { vi: 'Văn phòng', en: '' })).toEqual({ primary: 'Văn phòng', secondary: null });
  });
  it('chuỗi phẳng cho aria/title', () => {
    expect(flatBilingual('vi', 'dual', T)).toBe('Sổ đầu bài · Class Logbook');
    expect(flatBilingual('vi', 'single', T)).toBe('Sổ đầu bài');
  });
  it('mặc định 2 ngữ', () => {
    expect(parseLanguageMode(null)).toBe('dual');
    expect(parseLanguageMode('single')).toBe('single');
    expect(parseLanguageMode('xyz')).toBe('dual');
  });
});

describe('buildNavGroups', () => {
  const paths = (role: Parameters<typeof buildNavGroups>[0]['role'], extra = {}) =>
    buildNavGroups({ role, ...extra }).flatMap((g) => g.items.map((i) => i.path));

  it('BGH có cụm quản trị, GVCN/GVBM không', () => {
    expect(paths('admin')).toEqual(expect.arrayContaining(['/users', '/audit', '/bgh']));
    expect(paths('admin', { devTools: true })).toContain('/seed');
    expect(paths('gvcn')).not.toContain('/users');
    expect(paths('gvbm')).not.toContain('/seed');
  });
  it('GVCN có điểm danh + sổ lớp mình kèm mã lớp', () => {
    const g = buildNavGroups({ role: 'gvcn', assignedClassId: '9A3' });
    const logbook = g.flatMap((x) => x.items).find((i) => i.path === '/logbook');
    expect(logbook?.label.vi).toBe('Sổ đầu bài lớp tôi (9A3)');
    expect(paths('gvcn')).toContain('/attendance');
    expect(paths('gvbm')).not.toContain('/attendance');
  });
  it('Văn phòng chỉ thấy Thông báo + Báo cơm + Hành chính – Văn bản', () => {
    expect(paths('vanphong')).toEqual(['/announcements', '/bao-com', '/hanh-chinh']);
  });
  it('PH/HS không thấy mục nhân sự', () => {
    expect(paths('parent')).toEqual(['/dashboard', '/thoi-khoa-bieu', '/announcements', '/portfolio']);
    expect(paths('student')).toContain('/thoi-khoa-bieu');
    expect(paths('student')).not.toContain('/leave');
  });
  it('không có mục trùng đường dẫn, không có cụm rỗng', () => {
    for (const role of ['admin', 'gvcn', 'gvbm', 'tpt', 'giamthi', 'vanphong', 'parent', 'student'] as const) {
      const g = buildNavGroups({ role });
      const p = g.flatMap((x) => x.items.map((i) => i.path));
      expect(new Set(p).size).toBe(p.length);
      expect(g.every((x) => x.items.length > 0)).toBe(true);
    }
  });
  it('số đếm việc cần làm', () => {
    const g = buildNavGroups({ role: 'gvbm', unreadAnnouncements: 2, officePending: 3 });
    expect(groupBadge(g[0])).toBe(5);
    expect(g[0].items.find((i) => i.path === '/dashboard')?.badge).toBeUndefined();
  });
});

describe('tìm nhanh', () => {
  const groups = buildNavGroups({ role: 'admin' });
  it('bỏ dấu', () => {
    expect(foldText('Sổ Đầu Bài')).toBe('so dau bai');
  });
  it('khớp tiếng Việt không dấu, tiếng Anh, nhiều từ', () => {
    const hit = (q: string) => filterNavGroups(groups, q).flatMap((g) => g.items.map((i) => i.path));
    expect(hit('so dau')).toEqual(['/logbook']);
    expect(hit('timetable')).toEqual(['/schedule']);
    expect(hit('thoi khoa')).toEqual(['/schedule']);
    expect(hit('')).toHaveLength(groups.flatMap((g) => g.items).length);
    expect(hit('khongcogi')).toEqual([]);
  });
});

describe('công cụ dev (Nạp dữ liệu mẫu, Nhập Excel cũ)', () => {
  const adminPaths = (devTools?: boolean) => buildNavGroups({ role: 'admin', devTools }).flatMap((g) => g.items.map((i) => i.path));
  it('bản thật: không hiện /seed, /import', () => {
    expect(adminPaths()).not.toContain('/seed');
    expect(adminPaths()).not.toContain('/import');
    expect(adminPaths()).toContain('/audit');
  });
  it('bản dev: vẫn có', () => {
    expect(adminPaths(true)).toEqual(expect.arrayContaining(['/seed', '/import']));
  });
});
