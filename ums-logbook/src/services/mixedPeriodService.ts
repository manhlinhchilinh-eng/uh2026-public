/**
 * UMS SmartConnect - Cấu hình tiết lớp trộn (system_settings/mixed_periods). Mọi tài khoản đọc, BGH sửa.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_MIXED_RULES, type MixedRule, type MixedSettings } from '../utils/mixedPeriods';

const REF = () => doc(db, 'system_settings', 'mixed_periods');
let cache: MixedRule[] | null = null;

export async function fetchMixedRules(force = false): Promise<MixedRule[]> {
  if (cache && !force) return cache;
  try {
    const snap = await getDoc(REF());
    cache = snap.exists() ? ((snap.data() as MixedSettings).rules ?? DEFAULT_MIXED_RULES) : DEFAULT_MIXED_RULES;
  } catch (e) {
    console.warn('[Lớp trộn] không tải được cấu hình, dùng mặc định', e);
    return DEFAULT_MIXED_RULES;
  }
  return cache;
}

export async function saveMixedRules(rules: MixedRule[], username: string): Promise<void> {
  const data: MixedSettings = { rules, updatedAt: Date.now(), updatedBy: username };
  await setDoc(REF(), data);
  cache = rules;
}
