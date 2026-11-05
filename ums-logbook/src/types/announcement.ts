/**
 * UMS SmartConnect - Thông báo thông minh
 * Collection: /announcements/{id}, đã đọc: /announcements/{id}/reads/{uid}
 */

import type { ScheduleChange } from '../utils/timetableGrid';

export type AnnouncementLevel = 'urgent' | 'important' | 'normal';

export interface AnnouncementAudience {
  toStaff: boolean;
  toParents: boolean;
  toStudents: boolean;
  /** null = toàn trường; '6A1' = chỉ lớp đó (áp dụng cho PH/HS) */
  classId: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  /** Khóa đối tượng nhận, dùng cho truy vấn + rules: 'staff' | 'parent:all' | 'parent:6A1' | 'student:all' | ... */
  audienceKeys: string[];
  classId: string | null;
  forwardableToParents: boolean;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: number;
  /** Thông báo tự sinh khi cập nhật TKB — kèm danh sách tiết đổi để vẽ lưới trực quan. */
  kind?: 'schedule_change';
  scheduleChanges?: ScheduleChange[];
}

export interface AnnouncementRead {
  uid: string;
  displayName: string;
  readAt: number;
}

export type NewAnnouncementInput = Pick<Announcement, 'title' | 'body' | 'level' | 'audience' | 'forwardableToParents'>;
