/**
 * Thông báo Văn phòng dùng chung trong app: tin gửi cho tôi + xác nhận của tôi,
 * số việc chưa xong (badge menu) và danh sách cần nhắc (sắp hạn / quá hạn).
 * Tự làm mới tối thiểu 15 phút/lần và KHÔNG tải khi tab ẩn (bài học chi phí 12/10); quay lại tab thì tải nếu đã cũ.
 * Xác nhận (acks) chỉ đọc cho tin chưa xem lần nào — chỉ chính mình đổi được xác nhận của mình.
 * Thông báo trên màn hình: tab ẩn + đã bật → kiểm tra tin mới (chỉ tin sau mốc mới nhất) tối thiểu 15 phút/lần, có tin → popup.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { STAFF_ROLES } from '../types/auth';
import { ackNotice, fetchMyAcks, fetchMyNotices, fetchMyNoticesSince } from '../services/officeNoticeService';
import { desktopNotifyEnabled, mergeNewest, newestCreatedAt, pickUnseen, shouldCheckNew, showDesktopNotice } from '../utils/desktopNotify';
import { noticeStatus, shouldRefreshNotices, sortNotices, type NoticeAck, type OfficeNotice } from '../utils/officeNotices';

interface Ctx {
  notices: OfficeNotice[];
  acks: Map<string, NoticeAck>;
  now: number;
  pendingCount: number;
  reminders: OfficeNotice[];
  loading: boolean;
  refresh: () => Promise<void>;
  ack: (n: OfficeNotice, kind: 'read' | 'done' | 'undone') => Promise<void>;
}

const OfficeNoticesCtx = createContext<Ctx | null>(null);

export const OfficeNoticesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, activeRole } = useAuth();
  const [notices, setNotices] = useState<OfficeNotice[]>([]);
  const [acks, setAcks] = useState<Map<string, NoticeAck>>(new Map());
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const isRecipientRole = !!activeRole && STAFF_ROLES.includes(activeRole);
  const lastLoadAt = useRef<number | null>(null);
  const ackChecked = useRef<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null); // null = chưa tải lần đầu (lần đầu không báo)
  const lastNewCheckAt = useRef<number | null>(null);
  const noticesRef = useRef<OfficeNotice[]>([]);
  noticesRef.current = notices;

  /** Tin chưa thấy trong phiên → popup (bỏ tin của chính mình). */
  const announceNew = useCallback(
    (list: OfficeNotice[]) => {
      if (!seen.current) {
        seen.current = new Set(list.map((n) => n.id));
        return;
      }
      const unseen = pickUnseen(list, seen.current);
      unseen.forEach((n) => seen.current!.add(n.id));
      unseen
        .filter((n) => n.authorId !== profile?.uid)
        .slice(0, 3)
        .forEach((n) =>
          showDesktopNotice({
            title: `${n.requiresDone ? '📌 Việc cần làm: ' : '🏫 '}${n.title}`,
            body: n.body,
            tag: `office-${n.id}`,
            url: `/announcements?open=${n.id}`,
          })
        );
    },
    [profile?.uid]
  );

  const refresh = useCallback(async () => {
    if (!profile || !isRecipientRole) return;
    setLoading(true);
    lastLoadAt.current = Date.now();
    try {
      const list = await fetchMyNotices(profile.uid);
      setNotices(list);
      announceNew(list);
      lastNewCheckAt.current = Date.now();
      const unchecked = list.map((n) => n.id).filter((id) => !ackChecked.current.has(id));
      if (unchecked.length > 0) {
        const found = await fetchMyAcks(profile.uid, unchecked);
        unchecked.forEach((id) => ackChecked.current.add(id));
        setAcks((m) => {
          const next = new Map(m);
          found.forEach((a, id) => next.set(id, a));
          return next;
        });
      }
    } catch (e) {
      console.warn('[Văn phòng] không tải được thông báo', e);
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, [profile, isRecipientRole, announceNew]);

  /** Tab ẩn: chỉ tải tin sau mốc mới nhất (thường 0–1 lượt đọc). */
  const checkNew = useCallback(async () => {
    if (!profile || !isRecipientRole || !seen.current) return;
    lastNewCheckAt.current = Date.now();
    try {
      const fresh = await fetchMyNoticesSince(profile.uid, newestCreatedAt(noticesRef.current));
      if (fresh.length === 0) return;
      setNotices((old) => mergeNewest(old, fresh));
      announceNew(fresh);
    } catch (e) {
      console.warn('[Văn phòng] kiểm tra tin mới', e);
    }
  }, [profile, isRecipientRole, announceNew]);

  // Đổi tài khoản/vai trò → tải lại từ đầu
  useEffect(() => {
    lastLoadAt.current = null;
    ackChecked.current = new Set();
    seen.current = null;
    lastNewCheckAt.current = null;
    setAcks(new Map());
  }, [profile?.uid, isRecipientRole]);

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      if (document.hidden) {
        if (shouldCheckNew({ hidden: true, enabled: desktopNotifyEnabled(), lastAt: lastNewCheckAt.current, now: t })) checkNew();
        return;
      }
      setNow(t);
      if (shouldRefreshNotices({ hidden: false, lastAt: lastLoadAt.current, now: t })) refresh();
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh, checkNew]);

  const ack = useCallback(
    async (n: OfficeNotice, kind: 'read' | 'done' | 'undone') => {
      if (!profile) return;
      const next = await ackNotice(n.id, profile, kind, acks.get(n.id));
      setAcks((m) => new Map(m).set(n.id, next));
    },
    [profile, acks]
  );

  const value = useMemo<Ctx>(() => {
    const sorted = sortNotices(notices, acks, now);
    const pending = sorted.filter((n) => ['open', 'due_soon', 'overdue'].includes(noticeStatus(n, acks.get(n.id), now)));
    const reminders = sorted.filter((n) => ['due_soon', 'overdue'].includes(noticeStatus(n, acks.get(n.id), now)));
    return { notices: sorted, acks, now, pendingCount: pending.length, reminders, loading, refresh, ack };
  }, [notices, acks, now, loading, refresh, ack]);

  return <OfficeNoticesCtx.Provider value={value}>{children}</OfficeNoticesCtx.Provider>;
};

const EMPTY: Ctx = { notices: [], acks: new Map(), now: 0, pendingCount: 0, reminders: [], loading: false, refresh: async () => {}, ack: async () => {} };

export function useOfficeNotices(): Ctx {
  return useContext(OfficeNoticesCtx) ?? EMPTY;
}
