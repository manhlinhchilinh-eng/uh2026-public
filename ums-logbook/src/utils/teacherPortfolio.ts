/**
 * ePortfolio giáo viên — hàm thuần: tự gom minh chứng từ Sổ đầu bài, dạy thay, nề nếp; tổng hợp minh chứng tự nộp.
 */

export type EvidenceType = 'sang_kien' | 'giai_thuong' | 'chuyen_de' | 'boi_duong' | 'khac';
export type EvidenceLevel = 'to' | 'truong' | 'dhqg' | 'thanh_pho' | 'quoc_gia';

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  sang_kien: 'Sáng kiến kinh nghiệm',
  giai_thuong: 'Giải thưởng / Thành tích',
  chuyen_de: 'Chuyên đề / Tiết dạy mẫu',
  boi_duong: 'Bồi dưỡng chuyên môn',
  khac: 'Khác',
};

export const EVIDENCE_LEVEL_LABEL: Record<EvidenceLevel, string> = {
  to: 'Cấp tổ',
  truong: 'Cấp trường',
  dhqg: 'Cấp ĐHQGHN',
  thanh_pho: 'Cấp thành phố',
  quoc_gia: 'Cấp quốc gia',
};

export interface TeacherEvidence {
  id: string;
  uid: string;
  teacherName: string;
  title: string;
  type: EvidenceType;
  level: EvidenceLevel;
  date: string; // YYYY-MM-DD
  description: string;
  links: string[];
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: number;
  createdAt: number;
}

export interface SignedPeriodLite {
  dailyId?: string;
  subject: string;
  lessonTopic?: string;
  isSigned: boolean;
  periodIndex: number;
}

/** Năm học: 01/08 năm N → 31/07 năm N+1. */
export function schoolYearRange(today: string): { start: string; end: string; label: string } {
  const [y, m] = today.split('-').map(Number);
  const startYear = m >= 8 ? y : y - 1;
  return { start: `${startYear}-08-01`, end: `${startYear + 1}-07-31`, label: `${startYear}-${startYear + 1}` };
}

const dateOf = (p: SignedPeriodLite) => p.dailyId?.split('_').slice(1).join('_') || '';
const classOf = (p: SignedPeriodLite) => p.dailyId?.split('_')[0] || '';

const countBy = <T,>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it) || '—';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => ({ key: k, count: n }));
};

/** Tổng hợp tiết đã ký trong khoảng ngày. */
export function summarizeTeaching(periods: SignedPeriodLite[], start: string, end: string) {
  const signed = periods.filter((p) => p.isSigned && dateOf(p) >= start && dateOf(p) <= end);
  const topics = signed
    .filter((p) => p.lessonTopic && p.lessonTopic.trim())
    .sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || a.periodIndex - b.periodIndex)
    .slice(0, 8)
    .map((p) => ({ date: dateOf(p), classId: classOf(p), subject: p.subject, topic: p.lessonTopic!.trim() }));
  return {
    signedCount: signed.length,
    byClass: countBy(signed, classOf).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'vi', { numeric: true })),
    bySubject: countBy(signed, (p) => p.subject).sort((a, b) => b.count - a.count),
    byMonth: countBy(signed, (p) => dateOf(p).slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
    recentTopics: topics,
  };
}

export function validateEvidence(e: Pick<TeacherEvidence, 'title' | 'date' | 'description' | 'links'>): string[] {
  const errors: string[] = [];
  if (!e.title.trim()) errors.push('Vui lòng nhập tên minh chứng.');
  if (e.title.length > 200) errors.push('Tên tối đa 200 ký tự.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push('Chọn ngày.');
  if (e.description.length > 5000) errors.push('Mô tả tối đa 5000 ký tự.');
  for (const l of e.links) if (l && !/^https:\/\//.test(l)) errors.push(`Liên kết phải bắt đầu bằng https:// (${l})`);
  return errors;
}

export function evidenceStats(items: TeacherEvidence[]) {
  return {
    total: items.length,
    verified: items.filter((i) => i.verifiedAt).length,
    byType: (Object.keys(EVIDENCE_TYPE_LABEL) as EvidenceType[]).map((t) => ({ type: t, count: items.filter((i) => i.type === t).length })),
  };
}
