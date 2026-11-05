/**
 * UMS SmartConnect - Tiết ESL.
 * - Cấu hình (bật/tắt + phương án A/B): system_settings/esl — mọi tài khoản đọc, chỉ BGH sửa (rules sẵn có).
 * - Bản ghi gọn từng tiết ESL: esl_periods/{dailyId}_{periodIndex} — để dashboard đọc ít (không quét sổ).
 */

import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { academicYearOf } from '../utils/academicCalendar';
import {
  DEFAULT_ESL_CONFIG,
  buildEslRecord,
  eslRecordId,
  parseEslConfig,
  type EslConfig,
  type EslPeriodRecord,
  type EslTag,
} from '../utils/eslPeriods';
import type { PeriodEntry } from '../types/logbook';

const CONFIG_REF = () => doc(db, 'system_settings', 'esl');
let cache: { at: number; value: EslConfig } | null = null;
const CACHE_MS = 5 * 60_000;

export async function fetchEslConfig(force = false): Promise<EslConfig> {
  if (cache && !force && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const snap = await getDoc(CONFIG_REF());
    const value = parseEslConfig(snap.exists() ? (snap.data() as Partial<EslConfig>) : null);
    cache = { at: Date.now(), value };
    return value;
  } catch (e) {
    console.warn('[ESL] không tải được cấu hình — coi như tắt', e);
    return DEFAULT_ESL_CONFIG;
  }
}

export async function saveEslConfig(config: Pick<EslConfig, 'enabled' | 'option'>, username: string): Promise<EslConfig> {
  const value: EslConfig = { enabled: config.enabled, option: config.option, updatedAt: Date.now(), updatedBy: username };
  await setDoc(CONFIG_REF(), value);
  cache = { at: Date.now(), value };
  return value;
}

/**
 * Sau khi lưu tiết: có ESL → ghi/ghi đè bản ghi gọn; bỏ ESL → xóa bản ghi.
 * Lỗi ở đây không làm hỏng việc ghi sổ (chỉ cảnh báo).
 */
export async function syncEslPeriodRecord(entry: PeriodEntry & { dailyId: string }, hadEsl: boolean): Promise<void> {
  const ref = doc(db, 'esl_periods', eslRecordId(entry.dailyId, entry.periodIndex));
  try {
    if (entry.esl) {
      const date = entry.dailyId.split('_').slice(1).join('_');
      const record = buildEslRecord(
        {
          dailyId: entry.dailyId,
          periodIndex: entry.periodIndex,
          subject: entry.subject,
          teacherId: entry.teacherId,
          teacherName: entry.teacherName,
          classId: entry.classId,
        },
        entry.esl as EslTag,
        academicYearOf(date),
        Date.now()
      );
      await setDoc(ref, JSON.parse(JSON.stringify(record)) as EslPeriodRecord); // bỏ trường undefined
    } else if (hadEsl) {
      await deleteDoc(ref);
    }
  } catch (e) {
    console.warn('[ESL] không đồng bộ được bản ghi tiết ESL', e);
  }
}

/** Tiết ESL trong khoảng ngày (có giới hạn số bản ghi — theo bài học chi phí đọc 12/10). */
export async function fetchEslPeriods(fromDate: string, toDate: string, max = 2000): Promise<EslPeriodRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'esl_periods'), where('date', '>=', fromDate), where('date', '<=', toDate), orderBy('date', 'asc'), limit(max))
  );
  return snap.docs.map((d) => d.data() as EslPeriodRecord);
}
