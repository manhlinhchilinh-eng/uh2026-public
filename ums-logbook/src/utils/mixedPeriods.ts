/**
 * Tiết "lớp trộn" (HS nhiều lớp học chung). Hai kiểu:
 *  - 'auto10': không đánh giá theo lớp được → mặc định 10 điểm nếu chưa ai ghi (vd. Eng 1 khối 9);
 *    GV dạy tiết vẫn ghi đè được; tình hình HS ghi ở app khác (UMS Eng9 Hub).
 *  - 'skip'  : không chấm, không tính vào số tiết phải ký (vd. Ngoại ngữ 2).
 * BGH chỉnh ở system_settings/mixed_periods. Hàm thuần.
 */

import type { ClassSchedule } from '../types/schedule';
import { normAlias } from './teacherAssignment';

export type MixedMode = 'auto10' | 'skip';

export interface MixedRule {
  /** null = mọi khối */
  grade: number | null;
  subject: string;
  mode: MixedMode;
  /** Nơi GV ghi chú tình hình HS của tiết trộn (nếu có) */
  noteUrl?: string;
}

export interface MixedSettings {
  rules: MixedRule[];
  updatedAt?: number;
  updatedBy?: string;
}

export const ENG9_HUB_URL = 'https://umseng9hub.web.app';
export const AUTO_SCORE = 10;

/**
 * DANH SÁCH DUY NHẤT tiết mặc định 10đ (quy chế thi đua TPT 05/11/2026) — sổ đầu bài, tổng kết tuần, bản in,
 * Dashboard BGH và xếp hạng TPT đều đọc từ đây. Người dùng chốt 05/11: NN2 = mặc định 10đ (không còn "không chấm");
 * Eng Test prep khối 9 chấm bình thường.
 */
export const DEFAULT_MIXED_RULES: MixedRule[] = [
  { grade: null, subject: 'Foreign language 2', mode: 'auto10' },
  { grade: null, subject: 'Native 1', mode: 'auto10' },
  { grade: null, subject: 'Native 2', mode: 'auto10' },
  { grade: 9, subject: 'Eng 1', mode: 'auto10', noteUrl: ENG9_HUB_URL },
  { grade: 9, subject: 'Literature test prep', mode: 'auto10' },
  { grade: 9, subject: 'Maths test prep', mode: 'auto10' },
];

export const MIXED_MODE_TEXT: Record<MixedMode, string> = {
  auto10: 'Tiết mặc định 10đ',
  skip: 'Lớp trộn — không chấm điểm',
};

export const gradeOfClass = (classId: string) => Number(classId.match(/^(\d)/)?.[1] ?? 0);

export function findMixedRule(classId: string, subject: string, rules: MixedRule[]): MixedRule | null {
  const g = gradeOfClass(classId);
  const s = normAlias(subject);
  if (!s) return null;
  return rules.find((r) => normAlias(r.subject) === s && (r.grade == null || r.grade === g)) ?? null;
}

export interface ClassSlotPlan {
  /** Số tiết phải ký theo thứ (2..6): bỏ tiết trống và tiết 'skip' */
  scored: Record<number, number>;
  /** Tiết 'auto10' theo thứ: chưa ai ký thì tính 10 điểm */
  auto: Record<number, number[]>;
}

export function slotPlanByClass(schedules: Record<string, ClassSchedule | undefined>, rules: MixedRule[]): Record<string, ClassSlotPlan> {
  const out: Record<string, ClassSlotPlan> = {};
  for (const [classId, sch] of Object.entries(schedules)) {
    if (!sch?.slots?.length) continue;
    const plan: ClassSlotPlan = { scored: {}, auto: {} };
    for (const s of sch.slots) {
      if (!s.subject?.trim()) continue;
      const rule = findMixedRule(classId, s.subject, rules);
      if (rule?.mode === 'skip') continue;
      plan.scored[s.dayOfWeek] = (plan.scored[s.dayOfWeek] || 0) + 1;
      if (rule?.mode === 'auto10') (plan.auto[s.dayOfWeek] ??= []).push(s.periodIndex);
    }
    out[classId] = plan;
  }
  return out;
}

/** Đặt kiểu lớp trộn cho 1 môn ở 1 khối (null = bỏ, học bình thường). Tách quy tắc "mọi khối" nếu cần. */
export function setMixedMode(rules: MixedRule[], subject: string, grade: number, mode: MixedMode | null, noteUrl?: string): MixedRule[] {
  const s = normAlias(subject);
  let list = rules;
  const all = list.find((r) => normAlias(r.subject) === s && r.grade == null);
  if (all) {
    list = [...list.filter((r) => r !== all), ...[6, 7, 8, 9].map((g) => ({ ...all, grade: g }))];
  }
  list = list.filter((r) => !(normAlias(r.subject) === s && r.grade === grade));
  if (mode) {
    const url = noteUrl ?? (all?.noteUrl || undefined);
    list.push({ grade, subject, mode, ...(url ? { noteUrl: url } : {}) });
  }
  return list;
}
