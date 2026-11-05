/**
 * Hàm thuần cho bộ gửi thông báo đẩy UMS+ (có test, không gọi mạng).
 */
export const TZ_OFFSET_MIN = 7 * 60; // Asia/Ho_Chi_Minh, không đổi giờ mùa hè
export const MAX_READS_PER_RUN = 300;
export const MAX_SENDS_PER_RUN = 500;
export const BATCH_LIMIT = 20;

/** Giờ địa phương VN từ epoch ms. */
export function vnClock(ms: number): { day: number; minutes: number } {
  const d = new Date(ms + TZ_OFFSET_MIN * 60_000);
  return { day: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** Khung chạy: Thứ 2 – Thứ 7, 06:30 – 21:30 (giờ VN). Ngoài khung: thoát trước khi đọc gì. */
export function inRunWindow(ms: number): boolean {
  const { day, minutes } = vnClock(ms);
  if (day === 0) return false;
  return minutes >= 6 * 60 + 30 && minutes <= 21 * 60 + 30;
}

/** Khóa nhận của app ('parent:6A1') → tên chủ đề FCM hợp lệ ('parent_6A1'). */
export const topicName = (key: string) => key.replace(/[^A-Za-z0-9_.~%-]/g, '_');

/** Chủ đề một tài khoản được nghe — tính từ hồ sơ, KHÔNG tin client. Văn phòng không nhận. */
export function topicsForProfile(p: { roles?: string[]; role?: string; assignedClassId?: string | null }): string[] {
  const roles = p.roles?.length ? p.roles : p.role ? [p.role] : [];
  const out = new Set<string>();
  const staff = ['admin', 'gvcn', 'gvbm', 'tpt', 'giamthi'];
  if (roles.some((r) => staff.includes(r))) out.add('staff');
  for (const fam of ['parent', 'student'] as const) {
    if (!roles.includes(fam)) continue;
    out.add(`${fam}:all`);
    if (p.assignedClassId) out.add(`${fam}:${p.assignedClassId}`);
  }
  return [...out].map(topicName);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface PushText { title: string; body: string; url: string; tag: string }

/** Nội dung đẩy: chỉ tiêu đề + mức độ, không đưa nội dung tin / tệp. */
export function announcementPush(a: { id: string; title: string; level?: string }): PushText {
  const prefix = a.level === 'urgent' ? '🔴 Khẩn: ' : a.level === 'important' ? '🟠 Quan trọng: ' : '';
  return { title: `${prefix}${a.title}`.slice(0, 120), body: 'Mở UMS+ để xem thông báo.', url: '/announcements', tag: `ann-${a.id}` };
}

export function officePush(n: { id: string; title: string; requiresDone?: boolean; deadlineAt?: number | null }): PushText {
  const prefix = n.requiresDone ? '✅ Cần thực hiện: ' : '';
  return {
    title: `${prefix}${n.title}`.slice(0, 120),
    body: n.deadlineAt ? `Hạn: ${new Date(n.deadlineAt + TZ_OFFSET_MIN * 60_000).toISOString().slice(0, 16).replace('T', ' ')}` : 'Văn phòng / BGH gửi bạn một thông báo.',
    url: '/announcements',
    tag: `office-${n.id}`,
  };
}

/** Lỗi FCM cho biết token đã hỏng → xóa khỏi danh sách. */
export const isDeadTokenError = (code?: string) =>
  code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument';

/** Budget Pub/Sub: tắt thanh toán khi chi phí ≥ ngân sách. */
export function shouldCutBilling(msg: { costAmount?: number; budgetAmount?: number }): boolean {
  return typeof msg.costAmount === 'number' && typeof msg.budgetAmount === 'number' && msg.budgetAmount > 0 && msg.costAmount >= msg.budgetAmount;
}
