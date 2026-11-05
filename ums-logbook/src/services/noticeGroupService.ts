/**
 * Nhóm người nhận lưu sẵn (/directory/notice_groups) — 1 tài liệu chứa mọi nhóm (tổ bộ môn, ban, danh sách GV).
 * Nhân sự đọc được (như danh bạ); BGH / Văn phòng sửa. Chỉ tải khi mở khung soạn (1 lượt đọc).
 */

import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../types/auth';
import type { NoticeGroup } from '../utils/officeNotices';
import { guardedGetDoc } from '../utils/firestoreGuard';

const ref = () => doc(db, 'directory', 'notice_groups');

export async function fetchNoticeGroups(): Promise<NoticeGroup[]> {
  const snap = await guardedGetDoc('directory:notice_groups', ref());
  return snap.exists() ? ((snap.data().groups as NoticeGroup[]) || []) : [];
}

export async function saveNoticeGroups(groups: NoticeGroup[], me: Pick<UserProfile, 'uid'>): Promise<void> {
  await setDoc(ref(), { groups, updatedAt: Date.now(), updatedBy: me.uid });
}
