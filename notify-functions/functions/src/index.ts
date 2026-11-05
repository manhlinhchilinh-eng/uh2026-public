/**
 * UMS+ Notify — project RIÊNG `umsplus-notify` (gói Blaze, KHÔNG chứa dữ liệu).
 * Đọc/ghi dữ liệu ở `sodaubai` (gói Spark, trần chi phí cứng) qua IAM chéo project.
 * Chặn chi phí theo bài học 12/10: 1 máy, không retry, thoát ngoài giờ trước khi đọc,
 * ≤ 300 lượt đọc / ≤ 500 tin mỗi lần chạy (vượt → tự khóa), billingGuard tắt thanh toán khi chạm ngân sách.
 */
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, FieldPath, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { logger } from 'firebase-functions';
import {
  BATCH_LIMIT,
  MAX_READS_PER_RUN,
  MAX_SENDS_PER_RUN,
  announcementPush,
  chunk,
  inRunWindow,
  isDeadTokenError,
  officePush,
  shouldCutBilling,
  topicName,
  topicsForProfile,
  type PushText,
} from './logic';

const REGION = 'asia-southeast1';
const DATA_PROJECT = 'sodaubai';
const SELF_PROJECT = 'umsplus-notify';

const notifyApp: App = getApps().find((a) => a.name === '[DEFAULT]') || initializeApp();
const dataApp: App = getApps().find((a) => a.name === 'data') || initializeApp({ projectId: DATA_PROJECT }, 'data');
const fs: Firestore = getFirestore(dataApp);
const messaging = getMessaging(notifyApp);

const webpush = { headers: { Urgency: 'high', TTL: '86400' } };
const dataOf = (p: PushText) => ({ title: p.title, body: p.body, url: p.url, tag: p.tag });

class Budget {
  reads = 0;
  sends = 0;
  get over() {
    return this.reads > MAX_READS_PER_RUN || this.sends > MAX_SENDS_PER_RUN;
  }
}

/** Đăng ký chủ đề cho máy mới bật thông báo — chủ đề tính từ hồ sơ users/{uid}, không tin client. */
async function subscribeNewDevices(b: Budget): Promise<void> {
  const pend = await fs.collection('fcm_tokens').where('topicsDone', '==', false).limit(BATCH_LIMIT).get();
  b.reads += Math.max(1, pend.size);
  for (const d of pend.docs) {
    if (b.over) return;
    const user = await fs.doc(`users/${d.id}`).get();
    b.reads++;
    const topics = topicsForProfile((user.data() || {}) as { roles?: string[]; role?: string; assignedClassId?: string | null });
    const tokens: string[] = (d.get('tokens') || []).slice(0, 3);
    for (const t of topics) if (tokens.length) await messaging.subscribeToTopic(tokens, t);
    await d.ref.update({ topicsDone: true, topics, subscribedAt: Date.now() });
  }
}

async function pushAnnouncements(since: number, b: Budget): Promise<number> {
  const snap = await fs.collection('announcements').where('createdAt', '>', since).orderBy('createdAt').limit(BATCH_LIMIT).get();
  b.reads += Math.max(1, snap.size);
  let cursor = since;
  for (const d of snap.docs) {
    if (b.over) break;
    const a = d.data() as { title?: string; level?: string; audienceKeys?: string[]; createdAt: number };
    const text = dataOf(announcementPush({ id: d.id, title: a.title || 'Thông báo mới', level: a.level }));
    for (const key of a.audienceKeys || []) {
      await messaging.send({ topic: topicName(key), data: text, webpush });
      b.sends++;
    }
    cursor = Math.max(cursor, a.createdAt);
  }
  return cursor;
}

async function pushOfficeNotices(since: number, b: Budget): Promise<number> {
  const snap = await fs.collection('office_notices').where('createdAt', '>', since).orderBy('createdAt').limit(BATCH_LIMIT).get();
  b.reads += Math.max(1, snap.size);
  let cursor = since;
  for (const d of snap.docs) {
    if (b.over) break;
    const n = d.data() as { title?: string; recipientUids?: string[]; requiresDone?: boolean; deadlineAt?: number | null; createdAt: number };
    const text = dataOf(officePush({ id: d.id, title: n.title || 'Thông báo mới', requiresDone: n.requiresDone, deadlineAt: n.deadlineAt }));
    for (const ids of chunk((n.recipientUids || []).slice(0, 300), 30)) {
      if (b.over) break;
      const toks = await fs.collection('fcm_tokens').where(FieldPath.documentId(), 'in', ids).get();
      b.reads += Math.max(1, toks.size);
      const owners = new Map<string, string>();
      toks.docs.forEach((t) => ((t.get('tokens') || []) as string[]).slice(0, 3).forEach((tk) => owners.set(tk, t.id)));
      const tokens = [...owners.keys()];
      if (!tokens.length) continue;
      const res = await messaging.sendEachForMulticast({ tokens, data: text, webpush });
      b.sends += tokens.length;
      // Token hỏng (gỡ app, đổi máy) → xóa khỏi danh sách để lần sau không gửi lại.
      await Promise.all(
        res.responses.map((r, i) =>
          !r.success && isDeadTokenError(r.error?.code)
            ? fs.doc(`fcm_tokens/${owners.get(tokens[i])}`).update({ tokens: FieldValue.arrayRemove(tokens[i]) })
            : null
        )
      );
    }
    cursor = Math.max(cursor, n.createdAt);
  }
  return cursor;
}

export const tick = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'Asia/Ho_Chi_Minh',
    region: REGION,
    maxInstances: 1,
    minInstances: 0,
    memory: '256MiB',
    timeoutSeconds: 60,
    retryCount: 0,
  },
  async () => {
    const now = Date.now();
    if (!inRunWindow(now)) return; // ngoài giờ: 0 lượt đọc
    const b = new Budget();
    const curRef = fs.doc('_system/notify_cursor');
    const cur = await curRef.get();
    b.reads++;
    if (!cur.exists) {
      // Lần đầu: chỉ gửi tin tạo SAU thời điểm này (không bắn lại tin cũ).
      await curRef.set({ office: now, announcements: now, createdAt: now, locked: false });
      return;
    }
    const c = cur.data() as { office: number; announcements: number; locked?: boolean };
    if (c.locked) return;
    try {
      await subscribeNewDevices(b);
      const ann = await pushAnnouncements(c.announcements, b);
      const off = await pushOfficeNotices(c.office, b);
      await curRef.update({ announcements: ann, office: off, lastRunAt: now, lastReads: b.reads, lastSends: b.sends });
    } finally {
      if (b.over) {
        await curRef.update({ locked: true, lockedAt: now, lockReason: `reads=${b.reads} sends=${b.sends}` });
        logger.error('notify locked by fuse', { reads: b.reads, sends: b.sends });
      }
    }
  }
);

/** Ngắt cứng: budget chạm 100% → tắt thanh toán của CHÍNH project này (không chứa dữ liệu → chỉ ngừng gửi thông báo). */
export const billingGuard = onMessagePublished(
  { topic: 'billing-guard', region: REGION, maxInstances: 1, retry: false, memory: '256MiB' },
  async (event) => {
    const msg = (event.data.message.json || {}) as { costAmount?: number; budgetAmount?: number };
    logger.info('budget notification', msg);
    if (!shouldCutBilling(msg)) return;
    const tokRes = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' },
    });
    const { access_token } = (await tokRes.json()) as { access_token: string };
    const res = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${SELF_PROJECT}/billingInfo`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ billingAccountName: '' }),
    });
    if (res.ok) logger.warn('BILLING DISABLED for ' + SELF_PROJECT);
    else logger.error('FAILED to disable billing for ' + SELF_PROJECT, { status: res.status, body: (await res.text()).slice(0, 300) });
  }
);
