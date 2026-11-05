/**
 * Thông báo đẩy (P2) — nhận tin kể cả khi đã đóng UMS+.
 * Token FCM lấy từ project RIÊNG `umsplus-notify` (gói Blaze, chỉ có hàm gửi); token lưu ở `sodaubai: fcm_tokens/{uid}`.
 * Client KHÔNG tự khai nhóm nhận: hàm gửi tự tính chủ đề từ hồ sơ users/{uid}.
 * Không polling. Mỗi phiên làm mới token tối đa 1 lần.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useEmulator } from '../config/firebaseEnv';

const NOTIFY_CONFIG = {
  apiKey: 'AIzaSyC6xAumu_3lqa_9K5GSoX-g8vxjqUgXulg',
  authDomain: 'umsplus-notify.firebaseapp.com',
  projectId: 'umsplus-notify',
  messagingSenderId: '817394516614',
  appId: '1:817394516614:web:1388d621531a5cba348707',
};
/** Khóa CÔNG KHAI Web Push (VAPID) của umsplus-notify — không phải bí mật. */
export const NOTIFY_VAPID_KEY: string =
  import.meta.env.VITE_NOTIFY_VAPID_KEY || 'BB_xV6cr9B2etPQqaWEEFXbs8KAa17gLOhckQai3XIjFObuoyi-jeJc6n85DJBnCTflb5OuXfBwjUGdygteaG8U';
const SESSION_KEY = 'ums_push_registered';
export const MAX_DEVICES = 3;

/** Giữ tối đa 3 máy gần nhất, máy hiện tại đứng cuối. */
export function mergeTokens(existing: string[] | undefined, token: string, max = MAX_DEVICES): string[] {
  return [...(existing || []).filter((t) => t !== token), token].slice(-max);
}

export type PushResult = 'ok' | 'unsupported' | 'no-key' | 'denied' | 'skipped' | 'error';

export async function registerPush(user: { uid: string; username?: string }, role: string | null): Promise<PushResult> {
  if (role === 'vanphong' || !role) return 'skipped'; // Văn phòng không nhận thông báo
  if (useEmulator(import.meta.env)) return 'skipped'; // Emulator không có FCM
  if (!NOTIFY_VAPID_KEY) return 'no-key';
  if (!('serviceWorker' in navigator) || !(await isSupported().catch(() => false))) return 'unsupported';
  if (Notification.permission !== 'granted') return 'denied';
  try {
    await navigator.serviceWorker.register('/notify-sw.js');
    // iPhone/Safari: getToken lỗi "no active Service Worker" nếu SW chưa chạy xong → đợi SW sẵn sàng.
    const reg = await navigator.serviceWorker.ready;
    const app = getApps().find((a) => a.name === 'notify') || initializeApp(NOTIFY_CONFIG, 'notify');
    const token = await getToken(getMessaging(app), { vapidKey: NOTIFY_VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return 'error';
    const ref = doc(db, 'fcm_tokens', user.uid);
    const prev = await getDoc(ref);
    const tokens: string[] = prev.exists() ? (prev.data().tokens as string[]) || [] : [];
    if (tokens.includes(token) && prev.data()?.topicsDone !== undefined) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* bỏ qua */ }
      return 'ok';
    }
    await setDoc(ref, { uid: user.uid, username: (user.username || '').slice(0, 60), tokens: mergeTokens(tokens, token), topicsDone: false, updatedAt: Date.now() }, { merge: true });
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* bỏ qua */ }
    return 'ok';
  } catch {
    return 'error';
  }
}

/** Gọi khi mở app: chỉ làm khi người dùng đã bật thông báo từ trước, mỗi phiên 1 lần. */
export async function refreshPushOncePerSession(user: { uid: string; username?: string }, role: string | null): Promise<void> {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
  } catch { /* bỏ qua */ }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  await registerPush(user, role);
}
