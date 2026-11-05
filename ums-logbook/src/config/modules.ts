import { STAFF_ROLES, type UserRole } from '../types/auth';
import type { BrandAppSlug } from '../components/common/BrandMark';

// Các phân hệ của UMS SmartConnect, bám theo proposal.
// status phản ánh trạng thái THẬT (xem HANDOFF.md) — không ghi "live" cho phần chưa làm.
export type ModuleStatus = 'live' | 'internal' | 'building';

/** Nhóm công cụ trong thẻ "Học tập & Đánh giá" (bấm mở mới hiện; mỗi vai trò chỉ thấy lối vào của mình).
 * Hiện thí điểm khối 9 / Tiếng Anh — môn/khối khác thêm nhóm mới vào MODULE_GROUPS. */
export type ModuleGroup = 'school-grades' | 'k9-test' | 'k9-english';

export interface PlatformModule {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  status: ModuleStatus;
  /** Biểu tượng nhận diện trong bộ 8 logo UMS+ */
  logoSlug?: BrandAppSlug;
  /** Đường dẫn nội bộ trong SmartConnect */
  path?: string;
  /** Link app chuyên biệt bên ngoài */
  externalUrl?: string;
  /** Thuộc thẻ gom nào (bỏ trống = ô riêng) */
  group?: ModuleGroup;
  /** Tên ngắn khi hiện trong thẻ gom */
  shortName?: string;
  shortNameEn?: string;
  /** Vai trò được thấy ô này; bỏ trống = mọi vai trò */
  roles?: UserRole[];
}

export const PLATFORM_MODULES: readonly PlatformModule[] = [
  {
    id: 'logbook',
    name: 'Sổ đầu bài điện tử',
    nameEn: 'Digital Class Logbook',
    description: 'Điểm danh 2 tầng, chấm tiết, nề nếp, cảnh báo sớm, xuất PDF.',
    status: 'live',
    logoSlug: 'logbook',
    path: '/logbook',
    roles: STAFF_ROLES,
  },
  {
    id: 'announcements',
    name: 'Thông báo thông minh',
    nameEn: 'Smart Announcements',
    description: 'Phân mức khẩn, theo dõi đã đọc, chuyển tiếp phụ huynh.',
    status: 'live',
    logoSlug: 'umsplus',
    path: '/announcements',
  },
  {
    id: 'leave',
    name: 'Xin nghỉ & Chấm công',
    nameEn: 'Leave & Timesheet',
    description: 'Đơn nghỉ online (4 loại), BGH duyệt, quỹ phép/ốm tự tính, nhắc nộp giấy tờ. Bảng công đối soát 3 ngày, khiếu nại, xuất Excel.',
    status: 'live',
    logoSlug: 'umsplus',
    path: '/leave',
    roles: STAFF_ROLES,
  },
  {
    id: 'bgh-dashboard',
    name: 'Dashboard Ban Giám hiệu',
    nameEn: 'Principal Dashboard',
    description: 'Tiến độ ký sổ, chuyên cần, nề nếp theo khối/lớp; xin nghỉ & giấy tờ; xuất Excel.',
    status: 'live',
    logoSlug: 'umsplus',
    path: '/bgh',
    roles: ['admin'],
  },
  {
    id: 'esl',
    name: 'Dạy học bằng Tiếng Anh (ESL)',
    nameEn: 'ESL / Bilingual Program',
    description: 'Cấu hình phương án ghi tiết ESL (đánh dấu nhanh / CLIL) và theo dõi tiến độ 35–105 tiết/năm theo lớp (TC2).',
    status: 'live',
    logoSlug: 'esl',
    path: '/esl',
    roles: ['admin'],
  },
  {
    id: 'parent-portal',
    group: 'k9-test',
    shortName: 'Tra cứu điểm (PH)',
    shortNameEn: 'Score lookup (parents)',
    name: 'Tra cứu điểm khảo sát khối 9',
    nameEn: 'Grade 9 Periodic Test Scores',
    description: 'Phụ huynh tra cứu điểm khảo sát theo mã học sinh.',
    status: 'live',
    logoSlug: 'homeroom9',
    externalUrl: 'https://umshomeroom9.web.app/tra-cuu',
  },
  {
    id: 'eportfolio',
    name: 'Hồ sơ năng lực số (ePortfolio)',
    nameEn: 'Student ePortfolio',
    description: 'HS nộp minh chứng, AI chấm rubric offline ngay trên máy, GV duyệt, hộ chiếu năng lực in được.',
    status: 'live',
    logoSlug: 'eportfolio',
    path: '/portfolio',
  },
  {
    id: 'teacher-portfolio',
    name: 'Hồ sơ năng lực giáo viên',
    nameEn: 'Teacher Portfolio',
    description: 'Tự gom minh chứng từ Sổ đầu bài, dạy thay, nề nếp; minh chứng chuyên môn BGH xác nhận; in hồ sơ thi đua.',
    status: 'live',
    logoSlug: 'eportfolio',
    path: '/teacher-portfolio',
    roles: STAFF_ROLES,
  },
  {
    id: 'practice',
    group: 'k9-english',
    shortName: 'Luyện tập',
    shortNameEn: 'Practice',
    name: 'Luyện tập Tiếng Anh khối 9',
    nameEn: 'Grade 9 English Practice',
    description: '635 câu theo 6 kỹ năng (cấu tạo từ, ngữ pháp, collocation, cloze, viết lại câu, tìm lỗi), đề thi thử, luyện lại câu sai (Eng9 Practice).',
    status: 'live',
    logoSlug: 'practice',
    externalUrl: 'https://umseng9practice.web.app',
    roles: [...STAFF_ROLES, 'student'],
  },
  {
    id: 'omr',
    group: 'k9-english',
    shortName: 'Chấm OMR',
    shortNameEn: 'OMR grading',
    name: 'Chấm thi trắc nghiệm (OMR)',
    nameEn: 'OMR Paper Grading',
    description: 'Chụp phiếu bằng điện thoại, chấm tự động, không bịa điểm khi ảnh mờ.',
    status: 'live',
    logoSlug: 'grading',
    externalUrl: 'https://umseng9grading.web.app',
    roles: ['admin', 'gvcn', 'gvbm'],
  },
  {
    id: 'eng9hub',
    group: 'k9-english',
    shortName: 'Sổ điểm (Hub)',
    shortNameEn: 'Gradebook (Hub)',
    name: 'Sổ điểm Tiếng Anh khối 9',
    nameEn: 'Grade 9 English Hub',
    description: 'Nhập điểm kiểm tra, điểm quá trình, tem nề nếp (Eng9 Hub).',
    status: 'live',
    logoSlug: 'eng9hub',
    externalUrl: 'https://umseng9hub.web.app',
    roles: ['admin', 'gvcn', 'gvbm'],
  },
  // Sổ điểm môn học của trường (bản trước khi đưa lên CSDL ngành) — PH/HS xem điểm đã công bố ở Cổng PH
  {
    id: 'gradebook',
    group: 'school-grades',
    shortName: 'Sổ điểm môn học',
    shortNameEn: 'Subject gradebook',
    name: 'Sổ điểm môn học',
    nameEn: 'Subject Gradebook',
    description: 'GV nhập ĐĐGtx/GK/CK, ĐTBmhk tự tính theo TT22, nhập/xuất Excel mẫu CSDL, công bố cho PH/HS, lịch sử sửa.',
    status: 'live',
    logoSlug: 'logbook',
    path: '/so-diem',
    roles: ['admin', 'gvcn', 'gvbm', 'tpt'],
  },
  // Cổng GV của portal khảo sát khối 9 (umshomeroom9) — đăng nhập riêng của portal. Link PH gửi riêng.
  {
    id: 'k9-homeroom',
    group: 'k9-test',
    shortName: 'Cổng GVCN',
    shortNameEn: 'Homeroom portal',
    name: 'Khảo sát khối 9 — Cổng GVCN',
    nameEn: 'Grade 9 Periodic Test — Homeroom',
    description: 'Bảng điểm khảo sát theo lớp 9A1–9A6, hạng lớp & khối, so với mặt bằng khối, xuất Word/PDF.',
    status: 'live',
    logoSlug: 'homeroom9',
    externalUrl: 'https://umshomeroom9.web.app/homeroom',
    roles: STAFF_ROLES,
  },
  {
    id: 'k9-analytics',
    group: 'k9-test',
    shortName: 'Phân tích phổ điểm',
    shortNameEn: 'Score analytics',
    name: 'Khảo sát khối 9 — Phân tích phổ điểm',
    nameEn: 'Grade 9 Periodic Test — Analytics',
    description: 'KPI 3 môn, phổ điểm, so sánh 6 lớp, bảng xếp hạng toàn khối theo đợt T8/T9.',
    status: 'live',
    logoSlug: 'homeroom9',
    externalUrl: 'https://umshomeroom9.web.app/analytics',
    roles: STAFF_ROLES,
  },
  {
    id: 'k9-survey-scores',
    group: 'k9-test',
    shortName: 'Quản lý điểm & xếp lớp',
    shortNameEn: 'Scores & placement',
    name: 'Khảo sát khối 9 — Quản lý điểm & xếp lớp',
    nameEn: 'Grade 9 Periodic Test — Scores & Placement',
    description: 'Bảng điểm 3 môn từng đợt, gợi ý xếp lớp theo cụm.',
    status: 'live',
    logoSlug: 'homeroom9',
    externalUrl: 'https://umshomeroom9.web.app/survey-scores',
    roles: STAFF_ROLES,
  },
];

export function modulesForRole(role: UserRole | null | undefined): PlatformModule[] {
  return PLATFORM_MODULES.filter((m) => !m.roles || (role != null && m.roles.includes(role)));
}

export const MODULE_GROUPS: readonly { id: ModuleGroup; name: string; nameEn: string }[] = [
  { id: 'school-grades', name: 'Sổ điểm · Toàn trường', nameEn: 'Gradebook · All grades' },
  { id: 'k9-test', name: 'Kiểm tra định kì · Khối 9', nameEn: 'Periodic Test · Grade 9' },
  { id: 'k9-english', name: 'Môn Tiếng Anh · Khối 9', nameEn: 'English · Grade 9' },
];
