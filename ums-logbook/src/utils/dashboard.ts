/**
 * Dashboard BGH — tổng hợp số liệu từ dữ liệu THẬT của Sổ đầu bài (hàm thuần).
 * Không có dữ liệu thì trả 0 / null để giao diện ghi "chưa có dữ liệu" — không bao giờ bịa số.
 */

import type { DailyLogbook, PeriodEntry, StudentAbsenceRecord } from '../types/logbook';
import { countWorkingDays } from './leavePolicy';

export interface DashboardInput {
  start: string;
  end: string;
  holidays: string[];
  classIds: string[];
  logbooks: Array<Pick<DailyLogbook, 'id' | 'classId' | 'date' | 'morningBaseline' | 'afternoonBaseline' | 'preSessionAttendance'>>;
  periodsByDaily: Record<string, PeriodEntry[]>;
  notes: Array<{ classId: string; type: 'positive' | 'negative'; date: string }>;
  /** Kế hoạch tiết theo TKB (bỏ tiết trống/lớp trộn không chấm; tiết mặc định 10đ). Thiếu → 8 tiết/ngày. */
  slotPlans?: Record<string, { scored: Record<number, number>; auto: Record<number, number[]> }>;
}

export interface ClassStats {
  classId: string;
  grade: number;
  expectedPeriods: number;
  signedPeriods: number;
  /** Tỉ lệ tiết đã ký (0..1), null nếu chưa có tiết nào dự kiến */
  signedRate: number | null;
  /** Điểm tiết trung bình (thang 10) trên các tiết đã ký, null nếu chưa có */
  avgScore: number | null;
  absP: number;
  absK: number;
  late: number;
  positive: number;
  negative: number;
}

export interface DashboardStats {
  schoolDays: number;
  totals: Omit<ClassStats, 'classId' | 'grade'>;
  byClass: ClassStats[];
  byGrade: Array<{ grade: number; expectedPeriods: number; signedPeriods: number; signedRate: number | null }>;
}

export const gradeOf = (classId: string) => Number(classId.match(/^(\d)/)?.[1] ?? 0);

const baselineOf = (lb: DashboardInput['logbooks'][number], session: 'morning' | 'afternoon') =>
  session === 'morning' ? lb.morningBaseline || lb.preSessionAttendance : lb.afternoonBaseline;

/**
 * Chuyên cần theo NGÀY: mỗi HS chỉ tính 1 lần/ngày cho mỗi loại (gộp điểm danh sáng + chiều),
 * tránh đếm đôi HS nghỉ cả ngày.
 */
function attendanceOfDay(lb: DashboardInput['logbooks'][number]) {
  const seen = { P: new Set<string>(), K: new Set<string>(), Late: new Set<string>() };
  for (const s of ['morning', 'afternoon'] as const) {
    const recs: StudentAbsenceRecord[] = baselineOf(lb, s)?.absences || [];
    for (const r of recs) seen[r.type]?.add(r.studentId);
  }
  return { absP: seen.P.size, absK: seen.K.size, late: seen.Late.size };
}

const rate = (num: number, den: number) => (den > 0 ? num / den : null);

/** Các ngày học (T2–T6, trừ ngày nghỉ) trong khoảng, kèm thứ (2..6). */
function schoolDates(start: string, end: string, holidays: string[]): Array<{ iso: string; dow: number }> {
  const out: Array<{ iso: string; dow: number }> = [];
  const [y, m, d] = start.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 800; i++) {
    const iso = cur.toISOString().slice(0, 10);
    if (iso > end) break;
    const wd = cur.getUTCDay();
    if (wd !== 0 && wd !== 6 && !holidays.includes(iso)) out.push({ iso, dow: wd + 1 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function computeDashboard(input: DashboardInput): DashboardStats {
  const schoolDays = countWorkingDays(input.start, input.end, input.holidays);
  const dates = input.slotPlans ? schoolDates(input.start, input.end, input.holidays) : [];
  const inRange = (d: string) => d >= input.start && d <= input.end;

  const byClass: ClassStats[] = input.classIds.map((classId) => {
    const books = input.logbooks.filter((b) => b.classId === classId && inRange(b.date));
    let signed = 0;
    let scoreSum = 0;
    let absP = 0, absK = 0, late = 0;
    for (const b of books) {
      for (const p of input.periodsByDaily[b.id] || []) {
        if (p.isSigned) {
          signed++;
          scoreSum += p.scores?.total ?? 0;
        }
      }
      const a = attendanceOfDay(b);
      absP += a.absP;
      absK += a.absK;
      late += a.late;
    }
    const notes = input.notes.filter((n) => n.classId === classId && inRange(n.date));
    const plan = input.slotPlans?.[classId];
    const expected = plan ? dates.reduce((n, d) => n + (plan.scored[d.dow] ?? 0), 0) : schoolDays * 8;
    // Tiết lớp trộn mặc định 10đ: chưa ai ký thì tính như đã ký 10 điểm
    if (plan) {
      for (const d of dates) {
        const autos = plan.auto[d.dow] || [];
        if (!autos.length) continue;
        const signedHere = new Set((input.periodsByDaily[`${classId}_${d.iso}`] || []).filter((x) => x.isSigned).map((x) => x.periodIndex));
        for (const pi of autos) {
          if (signedHere.has(pi)) continue;
          signed++;
          scoreSum += 10;
        }
      }
    }
    return {
      classId,
      grade: gradeOf(classId),
      expectedPeriods: expected,
      signedPeriods: signed,
      signedRate: rate(signed, expected),
      avgScore: signed > 0 ? Math.round((scoreSum / signed) * 10) / 10 : null,
      absP,
      absK,
      late,
      positive: notes.filter((n) => n.type === 'positive').length,
      negative: notes.filter((n) => n.type === 'negative').length,
    };
  });

  const sum = (k: keyof ClassStats) => byClass.reduce((s, c) => s + (Number(c[k]) || 0), 0);
  const signedAll = sum('signedPeriods');
  const expectedAll = sum('expectedPeriods');
  const scoreWeighted = byClass.reduce((s, c) => s + (c.avgScore ?? 0) * c.signedPeriods, 0);

  const grades = Array.from(new Set(byClass.map((c) => c.grade))).sort();
  return {
    schoolDays,
    totals: {
      expectedPeriods: expectedAll,
      signedPeriods: signedAll,
      signedRate: rate(signedAll, expectedAll),
      avgScore: signedAll > 0 ? Math.round((scoreWeighted / signedAll) * 10) / 10 : null,
      absP: sum('absP'),
      absK: sum('absK'),
      late: sum('late'),
      positive: sum('positive'),
      negative: sum('negative'),
    },
    byClass,
    byGrade: grades.map((g) => {
      const cs = byClass.filter((c) => c.grade === g);
      const e = cs.reduce((s, c) => s + c.expectedPeriods, 0);
      const sg = cs.reduce((s, c) => s + c.signedPeriods, 0);
      return { grade: g, expectedPeriods: e, signedPeriods: sg, signedRate: rate(sg, e) };
    }),
  };
}

export const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 1000) / 10}%`);

export function dashboardCsv(stats: DashboardStats, start: string, end: string): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Từ ngày', 'Đến ngày', 'Lớp', 'Khối', 'Tiết dự kiến', 'Tiết đã ký', 'Tỉ lệ ký', 'Điểm TB tiết', 'Vắng P', 'Vắng K', 'Muộn', 'Khen', 'Nhắc nhở'];
  const rows = stats.byClass.map((c) =>
    [start, end, c.classId, c.grade, c.expectedPeriods, c.signedPeriods, pct(c.signedRate), c.avgScore ?? '', c.absP, c.absK, c.late, c.positive, c.negative].map(esc).join(',')
  );
  return '﻿' + [head.map(esc).join(','), ...rows].join('\r\n') + '\r\n';
}

/** Khoảng ngày nhanh: tuần này (T2 → hôm nay) và tháng này (ngày 1 → hôm nay). */
export function quickRanges(today: string) {
  const d = new Date(today + 'T00:00:00Z');
  const wd = d.getUTCDay() || 7;
  const monday = new Date(d.getTime() - (wd - 1) * 86_400_000).toISOString().slice(0, 10);
  return { week: { start: monday, end: today }, month: { start: today.slice(0, 8) + '01', end: today } };
}
