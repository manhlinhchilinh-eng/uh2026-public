/**
 * Thông báo trên màn hình (không cần Blaze/Cloud Functions): khi app đang mở (kể cả tab nền) mà có tin mới
 * → bật popup thông báo của trình duyệt/máy + số chưa đọc trên tiêu đề tab và biểu tượng app (PWA).
 * Đóng hẳn app thì không báo (muốn vậy phải dùng FCM + Cloud Functions → gói Blaze).
 * Kiểm tra tin mới tối thiểu 15 phút/lần, chỉ tải tin sau mốc mới nhất (thường 0–1 lượt đọc) — bài học chi phí 12/10.
 */

/** Khoảng cách tối thiểu giữa 2 lần kiểm tra tin mới (cả khi tab ẩn). */
export const NEW_CHECK_MS = 15 * 60_000;
/** Số tin mới tối đa tải mỗi lần kiểm tra. */
export const NEW_CHECK_LIMIT = 10;

const PREF_KEY = 'ums_desktop_notify';

/** "(3) UMS+" — bỏ tiền tố số cũ nếu có. */
export function titleWithCount(title: string, count: number): string {
  const base = title.replace(/^\(\d+\+?\)\s*/, '');
  if (count <= 0) return base;
  return `(${count > 99 ? '99+' : count}) ${base}`;
}

/** Tin chưa từng thấy trong phiên (lần tải đầu chỉ ghi nhận, không báo). */
export function pickUnseen<T extends { id: string }>(items: T[], seen: Set<string>): T[] {
  return items.filter((x) => !seen.has(x.id));
}

/** Mốc createdAt mới nhất (0 nếu chưa có tin) — dùng cho truy vấn "tin sau mốc này". */
export function newestCreatedAt(items: Array<{ createdAt: number }>): number {
  return items.reduce((m, x) => Math.max(m, x.createdAt || 0), 0);
}

/** Gộp tin mới vào danh sách cũ (không trùng id), mới nhất trước. */
export function mergeNewest<T extends { id: string; createdAt: number }>(old: T[], fresh: T[]): T[] {
  const ids = new Set(old.map((x) => x.id));
  return [...fresh.filter((x) => !ids.has(x.id)), ...old].sort((a, b) => b.createdAt - a.createdAt);
}

/** Đến lúc kiểm tra tin mới chưa. Tab ẩn chỉ kiểm tra khi người dùng đã bật thông báo trên máy. */
export function shouldCheckNew(s: { hidden: boolean; enabled: boolean; lastAt: number | null; now: number }, minMs = NEW_CHECK_MS): boolean {
  if (s.hidden && !s.enabled) return false;
  if (s.lastAt == null) return true;
  return s.now - s.lastAt >= minMs;
}

export type NotifySupport = 'granted' | 'default' | 'denied' | 'unsupported';

/** Trạng thái quyền thông báo của trình duyệt (iOS chỉ có khi đã "Thêm vào Màn hình chính", iOS 16.4+). */
export function notifySupport(): NotifySupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifySupport;
}

/** Người dùng đã bật trong app VÀ trình duyệt đã cho phép. */
export function desktopNotifyEnabled(): boolean {
  if (notifySupport() !== 'granted') return false;
  try {
    return localStorage.getItem(PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDesktopNotifyPref(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* chế độ ẩn danh — bỏ qua */
  }
}

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // SW tối giản: chỉ hiện popup + mở app khi bấm; KHÔNG cache, không push.
    return await navigator.serviceWorker.register('/notify-sw.js');
  } catch {
    return null;
  }
}

/** Xin quyền + bật. Trả về trạng thái cuối. */
export async function enableDesktopNotify(): Promise<NotifySupport> {
  if (notifySupport() === 'unsupported') return 'unsupported';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  setDesktopNotifyPref(p === 'granted');
  if (p === 'granted') await swRegistration();
  return p as NotifySupport;
}

/** Hiện 1 popup. Android Chrome bắt buộc qua service worker; máy tính dùng Notification trực tiếp. */
export async function showDesktopNotice(n: { title: string; body: string; tag: string; url: string }): Promise<void> {
  if (!desktopNotifyEnabled()) return;
  const options: NotificationOptions = { body: n.body.slice(0, 180), tag: n.tag, icon: '/brand/logos/umsplus/icon-192.png', data: { url: n.url } };
  const reg = await swRegistration();
  if (reg) {
    await reg.showNotification(n.title, options).catch(() => undefined);
    return;
  }
  try {
    const popup = new Notification(n.title, options);
    popup.onclick = () => {
      window.focus();
      window.location.assign(n.url);
      popup.close();
    };
  } catch {
    /* trình duyệt không cho tạo trực tiếp */
  }
}

/** Số trên biểu tượng app (Chrome/Edge PWA, iOS 16.4+ khi đã thêm vào Màn hình chính). */
export function setAppBadgeCount(count: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => undefined);
    else nav.clearAppBadge?.()?.catch(() => undefined);
  } catch {
    /* không hỗ trợ */
  }
}
