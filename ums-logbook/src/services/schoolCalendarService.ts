/**
 * UMS SmartConnect - Lịch nghỉ của trường (system_settings/school_calendar).
 * Mọi tài khoản đọc được; chỉ BGH sửa (rules system_settings sẵn có).
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { EMPTY_CALENDAR, type SchoolCalendar } from '../utils/schoolCalendar';

const REF = () => doc(db, 'system_settings', 'school_calendar');
let cache: SchoolCalendar | null = null;

export async function fetchSchoolCalendar(force = false): Promise<SchoolCalendar> {
  if (cache && !force) return cache;
  try {
    const snap = await getDoc(REF());
    cache = snap.exists() ? { ...EMPTY_CALENDAR, ...(snap.data() as SchoolCalendar) } : EMPTY_CALENDAR;
  } catch (e) {
    console.warn('[Lịch nghỉ] không tải được, chỉ dùng T7/CN', e);
    return EMPTY_CALENDAR;
  }
  return cache;
}

export async function saveSchoolCalendar(calendar: SchoolCalendar, username: string): Promise<void> {
  const data: SchoolCalendar = { offPeriods: calendar.offPeriods, updatedAt: Date.now(), updatedBy: username };
  await setDoc(REF(), data);
  cache = data;
}
