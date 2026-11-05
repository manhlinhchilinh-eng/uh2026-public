/* UMS+ — service worker tối giản cho thông báo trên màn hình.
 * Chỉ hiện popup do app gửi (registration.showNotification) và mở/đưa app lên khi bấm.
 * KHÔNG cache. Nhận push (P2, 05/11/2026): tin dạng data {title, body, url, tag} do hàm `tick`
 * của project riêng umsplus-notify gửi qua FCM → luôn hiện popup (iOS bắt buộc mỗi push phải hiện). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try {
    const j = event.data ? event.data.json() : {};
    d = j.data || j || {};
  } catch (e) {
    d = { title: 'UMS+', body: event.data ? event.data.text() : '' };
  }
  const title = (d.title || 'UMS+ có thông báo mới').slice(0, 120);
  event.waitUntil(
    self.registration.showNotification(title, {
      body: (d.body || '').slice(0, 180),
      tag: d.tag || 'ums-push',
      icon: '/brand/logos/umsplus/icon-192.png',
      badge: '/brand/logos/umsplus/icon-192.png',
      data: { url: d.url || '/announcements' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/announcements';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url).catch(() => undefined);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
