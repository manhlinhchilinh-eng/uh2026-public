/**
 * Chế độ trình chiếu: khi bật, che tên & mã HS trên MỌI màn hình (chỉ phần hiển thị, máy này).
 * Danh sách tên lấy đúng phạm vi tài khoản được xem: nhân sự → toàn trường; PH/HS → con/mình.
 */

import React, { useEffect } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { FAMILY_ROLES } from '../../types/auth';
import { fetchLinkedStudents } from '../../services/familyService';
import { buildMasker, isPresentationMode, maskDom } from '../../utils/presentation';
import { guardedGetDocs } from '../../utils/firestoreGuard';

const SESSION_CACHE_KEY = 'ums_presentation_students_v1';
let memoryStudentsCache: Array<{ fullName: string; mhs: string }> | null = null;

async function loadStudents(isFamily: boolean, docIds?: string[]) {
  if (isFamily) {
    return (await fetchLinkedStudents(docIds)).map((s) => ({ fullName: s.fullName, mhs: s.mhs }));
  }
  if (memoryStudentsCache) {
    return memoryStudentsCache;
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ fullName: string; mhs: string }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStudentsCache = parsed;
          return parsed;
        }
      }
    } catch {
      // Bỏ qua lỗi đọc sessionStorage
    }
  }
  const snap = await guardedGetDocs('students:presentation_masker', collection(db, 'students'));
  const list = snap.docs.map((d) => ({
    fullName: String(d.data().fullName || ''),
    mhs: String(d.data().mhs || ''),
  }));
  memoryStudentsCache = list;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(list));
    } catch {
      // Bỏ qua lỗi ghi sessionStorage
    }
  }
  return list;
}

export const PresentationMasker: React.FC = () => {
  const { user, profile, activeRole } = useAuth();

  useEffect(() => {
    if (!isPresentationMode() || !user || !profile || profile.uid !== user.uid || !activeRole) return;
    let observer: MutationObserver | null = null;
    let cancelled = false;
    const isFamily = FAMILY_ROLES.includes(activeRole) || profile.roles?.some((r) => FAMILY_ROLES.includes(r));
    loadStudents(Boolean(isFamily), profile.studentDocIds)
      .then((students) => {
        if (cancelled) return;
        const mask = buildMasker(students);
        maskDom(document.body, mask);
        observer = new MutationObserver((records) => {
          for (const r of records) {
            if (r.type === 'characterData') maskDom(r.target.parentNode ?? r.target, mask);
            r.addedNodes.forEach((n) => maskDom(n, mask));
          }
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      })
      .catch((e) => console.warn('[Trình chiếu] không tải được danh sách tên', e));
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [user, profile, activeRole]);

  return null;
};
