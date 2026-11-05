/**
 * Menu bên theo cụm (thay danh sách phẳng 15+ mục): mỗi vai trò chỉ thấy mục mình dùng,
 * cụm thu gọn được, tìm nhanh bằng phím "/" (không phân biệt dấu, khớp cả VI lẫn EN).
 * Hàm thuần — icon gắn ở Sidebar theo `path`.
 */

import { STAFF_ROLES, type UserRole } from '../types/auth';
import type { BiText } from './bilingual';

export interface NavEntry {
  path: string;
  label: BiText;
  /** số đếm việc cần làm (chưa đọc, chưa thực hiện) */
  badge?: number;
}

export type NavGroupId = 'today' | 'classes' | 'reports' | 'staff' | 'admin' | 'family';

export interface NavGroup {
  id: NavGroupId;
  label: BiText;
  items: NavEntry[];
}

export const GROUP_LABELS: Record<NavGroupId, BiText> = {
  today: { vi: 'Hôm nay', en: 'Today' },
  classes: { vi: 'Lớp & Sổ', en: 'Classes & Logbook' },
  reports: { vi: 'Tổng hợp', en: 'Reports' },
  staff: { vi: 'Cá nhân & Nhân sự', en: 'Me & Staff' },
  admin: { vi: 'Quản trị', en: 'Administration' },
  family: { vi: 'Học tập', en: 'Learning' },
};

/** Nhãn dùng chung (khớp i18n/vi.ts + i18n/en.ts mục nav, để test cũ vẫn tìm thấy chữ). */
export const L = {
  apps: { vi: 'Hệ sinh thái UMS+', en: 'UMS+ Ecosystem' },
  dashboard: { vi: 'Bảng điều khiển', en: 'Dashboard' },
  announcements: { vi: 'Thông báo', en: 'Announcements' },
  adminDocs: { vi: 'Hành chính – Văn bản', en: 'Admin Documents' },
  bgh: { vi: 'Dashboard BGH', en: 'Leadership dashboard' },
  logbook: { vi: 'Sổ đầu bài', en: 'Class Logbook' },
  myClassLogbook: { vi: 'Sổ đầu bài lớp tôi', en: 'My Class Logbook' },
  attendance: { vi: 'Điểm danh đầu giờ', en: 'Morning Attendance' },
  attendanceBoard: { vi: 'Vắng/muộn hôm nay', en: "Today's Absences" },
  behavior: { vi: 'Nề nếp & Kỷ luật', en: 'Student Behavior' },
  schedule: { vi: 'Thời khóa biểu', en: 'Timetable' },
  summary: { vi: 'Tổng kết & Báo cáo', en: 'Summaries & Reports' },
  emulation: { vi: 'Xếp hạng thi đua', en: 'Class Ranking' },
  leave: { vi: 'Xin nghỉ', en: 'Leave requests' },
  mealReport: { vi: 'Nghỉ học & Báo cơm', en: 'Leave & Lunch report' },
  studentLeave: { vi: 'Đơn nghỉ học', en: 'Student leave' },
  timesheet: { vi: 'Bảng công', en: 'Timesheet' },
  portfolioReview: { vi: 'Duyệt hồ sơ năng lực', en: 'Review student portfolios' },
  teacherPortfolio: { vi: 'Hồ sơ năng lực GV', en: 'Teacher portfolio' },
  gradebook: { vi: 'Sổ điểm môn học', en: 'Subject gradebook' },
  users: { vi: 'Quản lý tài khoản', en: 'User Accounts' },
  feedback: { vi: 'Góp ý & lỗi', en: 'Feedback & bugs' },
  adminSeed: { vi: 'Khởi tạo dữ liệu', en: 'Seed System Data' },
  import: { vi: 'Nhập dữ liệu', en: 'Data import' },
  audit: { vi: 'Nhật ký hệ thống', en: 'Audit Logs' },
  parentHome: { vi: 'Cổng phụ huynh', en: 'Parent portal' },
  studentHome: { vi: 'Góc học sinh', en: 'Student corner' },
  familyTimetable: { vi: 'Thời khóa biểu', en: 'Timetable' },
  portfolio: { vi: 'Hồ sơ năng lực', en: 'Competency portfolio' },
  esl: { vi: 'Tiết dạy bằng tiếng Anh', en: 'ESL lessons' },
} satisfies Record<string, BiText>;

export interface NavContext {
  role: UserRole | null | undefined;
  assignedClassId?: string | null;
  unreadAnnouncements?: number;
  officePending?: number;
  /** số đơn nghỉ học của PH đang chờ GVCN duyệt */
  leavePending?: number;
  /** Công cụ chỉ dành cho bản dev (Nạp dữ liệu mẫu, Nhập Excel cũ) — bản thật truyền false. */
  devTools?: boolean;
}

const item = (path: string, label: BiText, badge?: number): NavEntry => (badge ? { path, label, badge } : { path, label });

export function buildNavGroups(ctx: NavContext): NavGroup[] {
  const role = ctx.role;
  const isStaff = role != null && STAFF_ROLES.includes(role);
  const group = (id: NavGroupId, items: NavEntry[]): NavGroup => ({ id, label: GROUP_LABELS[id], items });

  if (role === 'vanphong') {
    return [group('today', [item('/announcements', L.announcements, ctx.officePending), item('/bao-com', L.mealReport), item('/hanh-chinh', L.adminDocs)])];
  }
  if (role === 'parent' || role === 'student') {
    return [
      group('today', [
        item('/dashboard', role === 'parent' ? L.parentHome : L.studentHome),
        item('/thoi-khoa-bieu', L.familyTimetable),
        item('/announcements', L.announcements, ctx.unreadAnnouncements),
      ]),
      group('family', [item('/portfolio', L.portfolio)]),
    ];
  }

  const today: NavEntry[] = [
    item('/dashboard', L.dashboard),
    // Thông báo trường + Văn phòng gộp 1 mục; số đếm = chưa đọc + việc Văn phòng chưa xong
    item('/announcements', L.announcements, (ctx.unreadAnnouncements || 0) + (isStaff ? ctx.officePending || 0 : 0)),
    ...(isStaff ? [item('/hanh-chinh', L.adminDocs)] : []),
  ];

  const myLogbook: BiText = ctx.assignedClassId
    ? { vi: `${L.myClassLogbook.vi} (${ctx.assignedClassId})`, en: `${L.myClassLogbook.en} (${ctx.assignedClassId})` }
    : L.myClassLogbook;

  let classes: NavEntry[];
  let reports: NavEntry[] = [];
  switch (role) {
    case 'admin':
      classes = [item('/logbook', L.logbook), item('/don-nghi-hs', L.studentLeave), item('/bao-com', L.mealReport), item('/so-diem', L.gradebook), item('/vang-muon', L.attendanceBoard), item('/behavior', L.behavior), item('/schedule', L.schedule)];
      reports = [item('/bgh', L.bgh), item('/esl', L.esl), item('/summary', L.summary), item('/emulation', L.emulation)];
      break;
    case 'gvcn':
      classes = [item('/logbook', myLogbook), item('/don-nghi-hs', L.studentLeave, ctx.leavePending), item('/so-diem', L.gradebook), item('/attendance', L.attendance), item('/behavior', L.behavior), item('/schedule', L.schedule)];
      reports = [item('/summary', L.summary), item('/emulation', L.emulation)];
      break;
    case 'tpt':
      classes = [item('/logbook', L.logbook), item('/so-diem', L.gradebook), item('/vang-muon', L.attendanceBoard), item('/bao-com', L.mealReport), item('/behavior', L.behavior)];
      reports = [item('/emulation', L.emulation), item('/summary', L.summary)];
      break;
    case 'giamthi':
      classes = [item('/vang-muon', L.attendanceBoard), item('/bao-com', L.mealReport), item('/logbook', L.logbook), item('/behavior', L.behavior), item('/schedule', L.schedule)];
      reports = [item('/summary', L.summary), item('/emulation', L.emulation)];
      break;
    case 'gvbm':
    default:
      classes = [item('/logbook', L.logbook), item('/so-diem', L.gradebook), item('/behavior', L.behavior), item('/schedule', L.schedule)];
  }

  const staff: NavEntry[] = isStaff
    ? [item('/leave', L.leave), item('/timesheet', L.timesheet), item('/teacher-portfolio', L.teacherPortfolio), item('/portfolio', L.portfolioReview)]
    : [];

  const admin: NavEntry[] =
    role === 'admin'
      ? [
          item('/users', L.users),
          item('/gop-y', L.feedback),
          ...(ctx.devTools ? [item('/import', L.import), item('/seed', L.adminSeed)] : []),
          item('/audit', L.audit),
        ]
      : [];

  return [
    group('today', today),
    group('classes', classes),
    group('reports', reports),
    group('staff', staff),
    group('admin', admin),
  ].filter((g) => g.items.length > 0);
}

/** Bỏ dấu tiếng Việt + chữ thường để tìm "so dau bai" ra "Sổ đầu bài". */
export function foldText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Lọc mục khớp từ khóa (VI hoặc EN); giữ cụm có ít nhất 1 mục khớp. */
export function filterNavGroups(groups: NavGroup[], query: string): NavGroup[] {
  const q = foldText(query);
  if (!q) return groups;
  const words = q.split(/\s+/);
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        const hay = foldText(`${it.label.vi} ${it.label.en} ${g.label.vi} ${g.label.en}`);
        return words.every((w) => hay.includes(w));
      }),
    }))
    .filter((g) => g.items.length > 0);
}

/** Tổng số việc cần làm trong cụm (hiện cạnh tên cụm khi cụm đang thu gọn). */
export function groupBadge(g: NavGroup): number {
  return g.items.reduce((n, it) => n + (it.badge || 0), 0);
}
