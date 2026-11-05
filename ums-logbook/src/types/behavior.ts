/**
 * UMS Digital Class Logbook - Student Behavior Notes Contracts
 * Milestone 3: Behavior Notes Data Model, Taxonomy & Attribution
 * Path: src/types/behavior.ts
 */

import { UserRole } from './auth';

export type BehaviorType = 'positive' | 'negative';

export type BehaviorContext =
  | 'period'       // Trong tiết học (during lesson)
  | 'patrol'       // Tuần tra nề nếp giờ học (classroom patrol)
  | 'flag_salute'  // Chào cờ đầu tuần (Monday flag salute assembly)
  | 'recess'       // Giờ ra chơi (recess / break time)
  | 'cafeteria'    // Giờ bán trú / Ăn trưa (lunch / cafeteria duty)
  | 'gate'         // Cổng trường đầu / cuối giờ (school gate patrol)
  | 'general';     // Hoạt động chung khác (other general school events)

export interface BehaviorNote {
  id: string;
  studentId: string;           // Mã học sinh (MHS e.g. "269398")
  studentName: string;         // Họ và tên học sinh
  studentNumber?: number | string; // STT trong danh sách lớp (1..26)
  studentCode?: string;        // MHS alias for flexible integrations
  classId: string;             // Lớp học (e.g. "6A1", "9A3")
  type: BehaviorType;          // 'positive' (khen ngợi) | 'negative' (nhắc nhở / vi phạm)
  category: string;            // Predefined taxonomy ID hoặc custom string
  content: string;             // Nội dung nhận xét chi tiết
  description: string;         // Backward compatibility alias for E2E harness & M1
  authorId: string;            // UID / username của người ghi nhận
  authorName: string;          // Họ tên người ghi nhận
  authorRole: UserRole;        // Vai trò xác thực (non-forgeable)
  periodIndex?: number;        // Tiết học (1..8) nếu ghi nhận trong tiết
  subject?: string;            // Môn học liên quan
  date: string;                // Định dạng YYYY-MM-DD
  context?: BehaviorContext;   // Ngữ cảnh quan sát
  createdAt: number;           // Epoch timestamp tạo
  updatedAt: number;           // Epoch timestamp cập nhật gần nhất
  timestamp: number;           // Backward compatibility alias for createdAt
  acknowledgedByGvcn?: boolean;// GVCN lớp đã tiếp nhận và xử lý
  acknowledgedAt?: number;     // Thời điểm GVCN tiếp nhận
  acknowledgedBy?: string;     // Tên GVCN tiếp nhận
}

export interface CreateBehaviorNoteDTO {
  studentId: string;
  studentName?: string;
  studentNumber?: number | string;
  studentCode?: string;
  classId: string;
  type: BehaviorType;
  category?: string;
  content?: string;
  description?: string;        // Backward compatibility alias
  periodIndex?: number;
  subject?: string;
  date?: string;               // Mặc định là ngày hiện tại YYYY-MM-DD
  context?: BehaviorContext;
}

export interface UpdateBehaviorNoteDTO {
  category?: string;
  content?: string;
  description?: string;
  type?: BehaviorType;
  periodIndex?: number;
  subject?: string;
  context?: BehaviorContext;
}

export interface BehaviorNoteFilters {
  classId?: string;
  studentId?: string;
  type?: BehaviorType | 'all';
  category?: string;
  authorRole?: UserRole | 'all';
  authorId?: string;
  startDate?: string;          // YYYY-MM-DD
  endDate?: string;            // YYYY-MM-DD
  acknowledged?: boolean;
  searchTerm?: string;
}

export interface BehaviorCategoryItem {
  id: string;
  type: BehaviorType;
  labelVi: string;
  labelEn: string;
  descriptionVi: string;
  descriptionEn: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconName: string;
}

/**
 * Predefined Category Taxonomy
 */
export const POSITIVE_BEHAVIOR_CATEGORIES: BehaviorCategoryItem[] = [
  {
    id: 'active_participation',
    type: 'positive',
    labelVi: 'Phát biểu tích cực',
    labelEn: 'Active participation',
    descriptionVi: 'Hăng hái phát biểu xây dựng bài, tích cực trao đổi học tập',
    descriptionEn: 'Eager to contribute, participates actively in lesson discussions',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    iconName: 'Sparkles',
  },
  {
    id: 'outstanding_homework',
    type: 'positive',
    labelVi: 'Bài tập xuất sắc',
    labelEn: 'Outstanding homework',
    descriptionVi: 'Chuẩn bị bài đầy đủ, giải bài tập khó chính xác, sáng tạo',
    descriptionEn: 'Completes homework with excellence and accuracy',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    iconName: 'Award',
  },
  {
    id: 'peer_support',
    type: 'positive',
    labelVi: 'Giúp đỡ bạn bè',
    labelEn: 'Peer support',
    descriptionVi: 'Chủ động giúp đỡ bạn bè trong học tập và rèn luyện nề nếp',
    descriptionEn: 'Proactively supports peers in learning and discipline',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    iconName: 'Users',
  },
  {
    id: 'exemplary_discipline',
    type: 'positive',
    labelVi: 'Ý thức kỷ luật gương mẫu',
    labelEn: 'Exemplary discipline',
    descriptionVi: 'Thực hiện xuất sắc nội quy, tác phong chuẩn mực, giữ gìn vệ sinh chung',
    descriptionEn: 'Exemplary adherence to school rules, conduct, and hygiene',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    badgeBorder: 'border-teal-200',
    iconName: 'ShieldCheck',
  },
  {
    id: 'noticeable_improvement',
    type: 'positive',
    labelVi: 'Tiến bộ vượt bậc',
    labelEn: 'Noticeable improvement',
    descriptionVi: 'Có sự tiến bộ rõ rệt về thái độ, học lực hoặc nề nếp so với tuần trước',
    descriptionEn: 'Demonstrates noticeable improvement in attitude, academics, or conduct',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    iconName: 'TrendingUp',
  },
];

export const NEGATIVE_BEHAVIOR_CATEGORIES: BehaviorCategoryItem[] = [
  {
    id: 'missing_homework',
    type: 'negative',
    labelVi: 'Không làm bài tập',
    labelEn: 'Missing homework',
    descriptionVi: 'Không hoàn thành bài tập về nhà hoặc bài được giao trên lớp',
    descriptionEn: 'Fails to complete homework or assigned classwork',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    badgeBorder: 'border-orange-200',
    iconName: 'FileX',
  },
  {
    id: 'classroom_disruption',
    type: 'negative',
    labelVi: 'Mất trật tự trong giờ',
    labelEn: 'Classroom disruption',
    descriptionVi: 'Nói chuyện riêng, gây mất tập trung cho lớp học',
    descriptionEn: 'Talking out of turn, disrupting the classroom learning environment',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    iconName: 'VolumeX',
  },
  {
    id: 'missing_supplies',
    type: 'negative',
    labelVi: 'Không chuẩn bị đồ dùng học tập',
    labelEn: 'Missing school supplies',
    descriptionVi: 'Quên sách giáo khoa, vở ghi, đồ dùng bộ môn',
    descriptionEn: 'Forgot textbooks, notebooks, or required learning supplies',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    iconName: 'BookX',
  },
  {
    id: 'phone_usage',
    type: 'negative',
    labelVi: 'Sử dụng điện thoại không đúng quy định',
    labelEn: 'Unauthorized phone usage',
    descriptionVi: 'Sử dụng thiết bị điện tử khi chưa có sự cho phép của giáo viên',
    descriptionEn: 'Uses electronic devices without teacher authorization',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    iconName: 'Smartphone',
  },
  {
    id: 'tardy_to_class',
    type: 'negative',
    labelVi: 'Đi muộn vào tiết',
    labelEn: 'Tardy to class',
    descriptionVi: 'Vào lớp sau hiệu lệnh trống hoặc sau khi giáo viên đã bắt đầu tiết',
    descriptionEn: 'Arrives at class late after the bell has sounded',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    iconName: 'ClockAlert',
  },
  {
    id: 'inattention',
    type: 'negative',
    labelVi: 'Thiếu tập trung',
    labelEn: 'Inattention',
    descriptionVi: 'Làm việc riêng, ngủ gật hoặc không chú ý bài giảng',
    descriptionEn: 'Engaging in unrelated activities, drowsing, or not paying attention',
    badgeBg: 'bg-yellow-50',
    badgeText: 'text-yellow-800',
    badgeBorder: 'border-yellow-200',
    iconName: 'EyeOff',
  },
];

export const ALL_BEHAVIOR_CATEGORIES: BehaviorCategoryItem[] = [
  ...POSITIVE_BEHAVIOR_CATEGORIES,
  ...NEGATIVE_BEHAVIOR_CATEGORIES,
];

export const BEHAVIOR_CATEGORY_MAP: Record<string, BehaviorCategoryItem> = ALL_BEHAVIOR_CATEGORIES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, BehaviorCategoryItem>
);

/**
 * Resolves localized label for any category ID (handles predefined and custom strings)
 */
export function resolveCategoryLabel(categoryId: string, lang: 'vi' | 'en' = 'vi'): string {
  const item = BEHAVIOR_CATEGORY_MAP[categoryId];
  if (item) {
    return lang === 'en' ? item.labelEn : item.labelVi;
  }
  // Return verbatim custom category string (e.g. from tests or custom user input)
  return categoryId;
}

/**
 * Resolves visual badge styles for a category
 */
export function resolveCategoryBadge(
  categoryId: string,
  type: BehaviorType = 'positive'
): {
  bg: string;
  text: string;
  border: string;
} {
  const item = BEHAVIOR_CATEGORY_MAP[categoryId];
  if (item) {
    return {
      bg: item.badgeBg,
      text: item.badgeText,
      border: item.badgeBorder,
    };
  }
  // Fallback for custom categories based on type
  if (type === 'positive') {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  }
  return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
}
