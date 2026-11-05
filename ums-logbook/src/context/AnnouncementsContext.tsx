/**
 * UMS SmartConnect - Trạng thái Thông báo dùng chung (banner khẩn, badge chưa đọc, trang Thông báo).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Announcement } from '../types/announcement';
import { fetchAnnouncementsFor, fetchAnnouncementsSince, fetchReadIds, markAnnouncementRead } from '../services/announcementService';
import { desktopNotifyEnabled, mergeNewest, newestCreatedAt, pickUnseen, shouldCheckNew, showDesktopNotice } from '../utils/desktopNotify';
import { sortForInbox, filterInboxForRole, unreadUrgent } from '../utils/announcements';

interface AnnouncementsState {
  items: Announcement[];
  readIds: Set<string>;
  unreadCount: number;
  urgentUnread: Announcement[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const empty: AnnouncementsState = {
  items: [],
  readIds: new Set(),
  unreadCount: 0,
  urgentUnread: [],
  loading: false,
  error: null,
  refresh: async () => {},
  markRead: async () => {},
};

const AnnouncementsContext = createContext<AnnouncementsState>(empty);

export const AnnouncementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, activeRole } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Thông báo trên màn hình: tin đã thấy trong phiên + mốc kiểm tra tin mới gần nhất
  const seen = useRef<Set<string>>(new Set());
  const lastCheckAt = useRef<number | null>(null);
  const itemsRef = useRef<Announcement[]>([]);
  itemsRef.current = items;
  const readIdsRef = useRef<Set<string>>(readIds);
  readIdsRef.current = readIds;

  const refresh = useCallback(async () => {
    // Văn phòng không thuộc đối tượng Thông báo PH/HS–nhân sự trường
    if (!profile || !activeRole || activeRole === 'vanphong') return;
    setLoading(true);
    setError(null);
    try {
      const list = filterInboxForRole(await fetchAnnouncementsFor(activeRole, profile), activeRole, profile.assignedClassId);
      const reads = await fetchReadIds(profile.uid, list.map((a) => a.id));
      setReadIds(reads);
      setItems(sortForInbox(list, reads));
      list.forEach((a) => seen.current.add(a.id));
      lastCheckAt.current = Date.now();
    } catch (e) {
      console.error('[Announcements] load failed', e);
      setError('Không tải được thông báo.');
    } finally {
      setLoading(false);
    }
  }, [profile, activeRole]);

  useEffect(() => {
    seen.current = new Set();
    lastCheckAt.current = null;
    refresh();
  }, [refresh]);

  // Kiểm tra tin mới tối thiểu 15 phút/lần (tab ẩn: chỉ khi đã bật thông báo trên máy) → popup + cập nhật số chưa đọc.
  useEffect(() => {
    if (!profile || !activeRole || activeRole === 'vanphong') return;
    const check = async () => {
      const now = Date.now();
      if (lastCheckAt.current == null) return; // chưa tải lần đầu
      if (!shouldCheckNew({ hidden: document.hidden, enabled: desktopNotifyEnabled(), lastAt: lastCheckAt.current, now })) return;
      lastCheckAt.current = now;
      try {
        const fresh = filterInboxForRole(
          await fetchAnnouncementsSince(activeRole, profile, newestCreatedAt(itemsRef.current)),
          activeRole,
          profile.assignedClassId
        ).filter((a) => a.authorId !== profile.uid);
        const unseen = pickUnseen(fresh, seen.current);
        if (unseen.length === 0) return;
        unseen.forEach((a) => seen.current.add(a.id));
        setItems((old) => sortForInbox(mergeNewest(old, unseen), readIdsRef.current));
        for (const a of unseen.slice(0, 3)) {
          await showDesktopNotice({
            title: `${a.level === 'urgent' ? '🚨 ' : '📢 '}${a.title}`,
            body: a.body,
            tag: `ann-${a.id}`,
            url: `/announcements?open=${a.id}`,
          });
        }
      } catch (e) {
        console.warn('[Announcements] kiểm tra tin mới', e);
      }
    };
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [profile, activeRole]);

  const markRead = useCallback(
    async (id: string) => {
      if (!profile || readIds.has(id)) return;
      await markAnnouncementRead(id, profile);
      setReadIds((prev) => new Set(prev).add(id));
    },
    [profile, readIds]
  );

  const value = useMemo<AnnouncementsState>(
    () => ({
      items,
      readIds,
      unreadCount: items.filter((a) => !readIds.has(a.id)).length,
      urgentUnread: unreadUrgent(items, readIds),
      loading,
      error,
      refresh,
      markRead,
    }),
    [items, readIds, loading, error, refresh, markRead]
  );

  return <AnnouncementsContext.Provider value={value}>{children}</AnnouncementsContext.Provider>;
};

export const useAnnouncements = () => useContext(AnnouncementsContext);
