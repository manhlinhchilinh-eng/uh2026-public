/**
 * Thông báo trên màn hình: số chưa đọc trên tiêu đề tab + biểu tượng app, và nút bật popup thông báo của máy.
 * Không cần Blaze — chỉ hoạt động khi app đang mở (kể cả tab nền). Xem utils/desktopNotify.ts.
 */

import React, { useEffect, useState } from 'react';
import { useAnnouncements } from '../../context/AnnouncementsContext';
import { useOfficeNotices } from '../../context/OfficeNoticesContext';
import { refreshPushOncePerSession, registerPush } from '../../utils/pushNotify';
import { useAuth } from '../../hooks/useAuth';
import { desktopNotifyEnabled, enableDesktopNotify, notifySupport, setAppBadgeCount, setDesktopNotifyPref, titleWithCount } from '../../utils/desktopNotify';

/** Gắn trong AppLayout: "(3) UMS SmartConnect…" + số trên biểu tượng app. */
export const UnreadTitleSync: React.FC = () => {
  const { user, profile, activeRole } = useAuth();
  useEffect(() => {
    if (user && desktopNotifyEnabled()) void refreshPushOncePerSession({ uid: user.uid, username: profile?.username }, activeRole);
  }, [user, profile?.username, activeRole]);
  const { unreadCount } = useAnnouncements();
  const { pendingCount } = useOfficeNotices();
  const total = unreadCount + pendingCount;
  useEffect(() => {
    document.title = titleWithCount(document.title, total);
    setAppBadgeCount(total);
  }, [total]);
  useEffect(
    () => () => {
      document.title = titleWithCount(document.title, 0);
      setAppBadgeCount(0);
    },
    []
  );
  return null;
};

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

/** Nút ở trang Thông báo: bật/tắt popup thông báo trên máy này. */
export const DesktopNotifyToggle: React.FC = () => {
  const { user, profile, activeRole } = useAuth();
  const [support, setSupport] = useState(notifySupport);
  const [on, setOn] = useState(desktopNotifyEnabled);
  const [busy, setBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  if (support === 'unsupported') {
    return isIos() ? (
      <p className="text-[11px] text-slate-500" data-testid="notify-hint">
        iPhone/iPad: bấm Chia sẻ → "Thêm vào Màn hình chính", mở UMS+ từ biểu tượng đó để bật thông báo (iOS 16.4+).
      </p>
    ) : null;
  }
  if (support === 'denied') {
    return (
      <p className="text-[11px] text-amber-700" data-testid="notify-hint">
        Trình duyệt đang chặn thông báo của UMS+. Mở cài đặt trang (biểu tượng ổ khóa) → Thông báo → Cho phép.
      </p>
    );
  }

  const toggle = async () => {
    if (on) {
      setDesktopNotifyPref(false);
      setOn(false);
      return;
    }
    setBusy(true);
    const p = await enableDesktopNotify();
    setSupport(p);
    setOn(p === 'granted');
    // Thông báo đẩy: nhận tin kể cả khi đã đóng UMS+ (P2). Lỗi thì vẫn còn popup khi app đang mở.
    if (p === 'granted' && user) {
      const r = await registerPush({ uid: user.uid, username: profile?.username }, activeRole);
      setPushMsg(
        r === 'ok'
          ? 'Đã bật: máy này nhận thông báo cả khi đã đóng UMS+ (sau khoảng 1–2 phút).'
          : r === 'unsupported'
            ? 'Máy/trình duyệt này chỉ hiện thông báo khi UMS+ đang mở. iPhone: mở UMS+ từ biểu tượng ở Màn hình chính (iOS 16.4+).'
            : r === 'skipped'
              ? null
              : 'Chưa bật được thông báo khi đóng app (thử lại sau ít phút). Khi UMS+ đang mở vẫn có thông báo.'
      );
    }
    setBusy(false);
  };

  return (
    <>
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      data-testid="notify-toggle"
      title="Hiện thông báo trên màn hình máy tính/điện thoại khi có tin mới (khi UMS+ đang mở, kể cả ở tab nền)"
      className={`px-3 py-2 text-xs rounded-lg border font-semibold ${on ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}
    >
      {on ? '🔔 Đang bật thông báo trên máy' : '🔕 Bật thông báo trên máy'}
    </button>
    {pushMsg && <p className="mt-1 text-[11px] text-slate-500" data-testid="push-status">{pushMsg}</p>}
    </>
  );
};
