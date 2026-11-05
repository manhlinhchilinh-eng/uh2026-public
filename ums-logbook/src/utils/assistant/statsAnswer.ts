/**
 * Trợ lý UMS+ — số liệu điểm danh trong ngày (offline, hàm thuần).
 * Lớp chưa điểm danh KHÔNG cộng vào "có mặt"; được liệt kê riêng.
 * Hàm thuần, có test: __tests__/statsAnswer.test.ts
 */
import { buildNavGroups } from '../navGroups';
import { boardTotals, formatClock, type BoardRow } from '../periodAttendance';
import { hasPhrase, type ParsedQuery } from './entities';
import type { AssistantRole } from './assistantMatcher';

export type StatId = 'attendance';

const STAT_CUES = ['di hoc', 'co mat', 'nghi', 'vang', 'muon', 've som', 'si so', 'chua diem danh'];
/** Câu hỏi đếm — "bao nhiêu HS nghỉ" chứa chữ "hs" nhưng là số liệu, không phải tra cứu 1 HS. */
const COUNT_CUES = ['bao nhieu', 'may', 'tong', 'si so', 'toan truong', 'chua diem danh', 'so lieu', 'thong ke', 'so luong'];

/** Câu của gia đình ("con vắng mấy buổi"), ngày phép/BHXH → bộ câu hỏi, không phải số liệu (trừ khi nêu rõ phạm vi). */
const NOT_STAT_CUES = ['con', 'phep', 'bhxh', 'ngay phep'];
/** "mấy giờ" luôn là câu hỏi giờ giấc, không phải số liệu. */
const NEVER_STAT_CUES = ['may gio'];
/** Hỏi về HS/lớp → "có phép", "còn"… là số liệu, không phải câu của gia đình / ngày phép. */
const STAT_SUBJECT_CUES = ['hs', 'hoc sinh', 'lop'];

/**
 * Chữ trùng nhau khi bỏ dấu ("còn"/"con", "muộn"/"muốn", "vắng"/"vàng", "nghỉ"/"nghĩ"):
 * câu có dấu → chỉ nhận nguyên từ ở đúng dạng có dấu, hoặc từ gõ không dấu y hệt; câu không dấu → so như cũ.
 */
const ACCENTED_CUES: Record<string, string> = { con: 'con', muon: 'muộn', vang: 'vắng', nghi: 'nghỉ' };
const HAS_DIACRITIC = /[^\u0000-\u007f]/;

function hasCue(p: ParsedQuery, cue: string): boolean {
  const accented = ACCENTED_CUES[cue];
  if (!accented || !HAS_DIACRITIC.test(p.raw)) return hasPhrase(p.norm, cue);
  const words = p.raw.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.includes(accented) || words.includes(cue);
}

export function detectStat(p: ParsedQuery): { id: StatId; date: string | null; classId: string | null } | null {
  if (!STAT_CUES.some((c) => hasCue(p, c))) return null;
  if (NEVER_STAT_CUES.some((c) => hasPhrase(p.norm, c))) return null;
  const scoped = hasStatScopeCue(p) || STAT_SUBJECT_CUES.some((c) => hasPhrase(p.norm, c));
  if (!scoped && NOT_STAT_CUES.some((c) => hasCue(p, c))) return null;
  // Phải có từ đếm: "xin nghỉ ốm", "đi muộn thì làm gì" là câu hướng dẫn (bộ câu hỏi), không phải số liệu.
  // "ai vắng" chỉ là số liệu khi có ngày hoặc lớp ("hôm nay ai vắng", "lớp 6A1 ai nghỉ").
  const aiScoped = hasPhrase(p.norm, 'ai') && (p.date !== null || p.classId !== null);
  if (!aiScoped && !COUNT_CUES.some((c) => hasPhrase(p.norm, c))) return null;
  return { id: 'attendance', date: p.date, classId: p.classId };
}

const SCHOOL_SCOPE_CUES = ['toan truong', 'ca truong', 'cac lop'];

/** Câu hỏi nêu rõ phạm vi (ngày, lớp, toàn trường, lớp mình, chưa điểm danh) → số liệu thắng câu trả lời FAQ. */
export function hasStatScopeCue(p: ParsedQuery): boolean {
  if (p.date !== null || p.classId !== null) return true;
  return [...SCHOOL_SCOPE_CUES, 'lop minh', 'lop toi', 'chua diem danh'].some((c) => hasPhrase(p.norm, c));
}

/** Hỏi số liệu ngoài lớp mình (toàn trường / các lớp / lớp khác) — dùng để báo "không có quyền". */
export function hasSchoolScopeCue(p: ParsedQuery, ownClassId: string | null | undefined): boolean {
  if (p.classId && p.classId !== ownClassId) return true;
  return SCHOOL_SCOPE_CUES.some((c) => hasPhrase(p.norm, c));
}

/** Chỉ vai trò có mục "Vắng/muộn" (/vang-muon) trong menu mới xem số liệu toàn trường. */
export function canSeeSchoolStats(role: AssistantRole): boolean {
  if (role === 'guest') return false;
  return buildNavGroups({ role }).some((g) => g.items.some((i) => i.path === '/vang-muon'));
}

export interface AttendanceStats {
  date: string;
  loadedAt: number;
  classesTotal: number;
  /** Lớp có điểm danh sáng/chiều/theo tiết */
  classesChecked: number;
  /** Sĩ số các lớp đã điểm danh buổi sáng (có sĩ số, số vắng sáng không vượt sĩ số) */
  enrolledChecked: number;
  present: number;
  absentP: number;
  absentK: number;
  late: number;
  early: number;
  notChecked: string[];
  /** Đã điểm danh nhưng chưa có điểm danh đầu buổi sáng (chỉ chiều / theo tiết) — không tính vào "có mặt" */
  partialChecked: string[];
  /** Lớp đã điểm danh sáng nhưng thiếu sĩ số — không tính vào "có mặt" */
  missingSize: string[];
  /** Lớp có số HS vắng sáng vượt sĩ số — không tính vào "có mặt" */
  sizeMismatch: string[];
  truncated: boolean;
}

const isChecked = (r: BoardRow) => r.morningChecked || r.afternoonChecked || r.periods.some(Boolean);

export function computeAttendanceStats(
  rows: BoardRow[],
  sizes: Record<string, number>,
  date: string,
  loadedAt: number,
  truncated: boolean
): AttendanceStats {
  const checked = rows.filter(isChecked);
  const partialChecked: string[] = [];
  const missingSize: string[] = [];
  const sizeMismatch: string[] = [];
  let enrolledChecked = 0;
  let present = 0;
  for (const r of checked) {
    if (!r.morningChecked) {
      partialChecked.push(r.classId);
      continue;
    }
    const size = sizes[r.classId];
    if (!size) {
      missingSize.push(r.classId);
      continue;
    }
    // "Có mặt" = sĩ số trừ HS vắng cả buổi sáng (P/K); vắng lẻ tiết/muộn tính riêng.
    const absentMorning = r.students.filter((s) => s.morning === 'P' || s.morning === 'K').length;
    if (absentMorning > size) {
      sizeMismatch.push(r.classId);
      continue;
    }
    enrolledChecked += size;
    present += size - absentMorning;
  }
  const t = boardTotals(checked, null);
  return {
    date,
    loadedAt,
    classesTotal: rows.length,
    classesChecked: checked.length,
    enrolledChecked,
    present,
    absentP: t.absentP,
    absentK: t.absentK,
    late: t.late,
    early: t.early,
    notChecked: rows.filter((r) => !isChecked(r)).map((r) => r.classId),
    partialChecked,
    missingSize,
    sizeMismatch,
    truncated,
  };
}

const dmy = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** `classId`: số liệu đã được tính riêng cho lớp đó (người gọi lọc `rows` trước khi tính). */
export function formatAttendance(s: AttendanceStats, classId?: string | null): { vi: string; en: string } {
  const at = formatClock(s.loadedAt);
  const lines: string[] = [];
  const en: string[] = [];
  const hasPresent = s.enrolledChecked > 0;
  const presVi = hasPresent ? `, có mặt ${s.present}/${s.enrolledChecked}` : '';
  const presEn = hasPresent ? `, ${s.present}/${s.enrolledChecked} present` : '';
  if (classId) {
    const done = s.classesChecked > 0;
    lines.push(done ? `Lớp ${classId} (${dmy(s.date)}): đã điểm danh${presVi}.` : `Lớp ${classId} (${dmy(s.date)}): chưa điểm danh.`);
    en.push(done ? `Class ${classId} (${dmy(s.date)}): attendance taken${presEn}.` : `Class ${classId} (${dmy(s.date)}): attendance not taken yet.`);
  } else {
    lines.push(`Toàn trường (${dmy(s.date)}): ${s.classesChecked}/${s.classesTotal} lớp đã điểm danh${presVi}.`);
    en.push(`Whole school (${dmy(s.date)}): ${s.classesChecked}/${s.classesTotal} classes checked${presEn}.`);
  }
  if (s.classesChecked > 0) {
    lines.push(`Vắng có phép ${s.absentP}, không phép ${s.absentK}; muộn ${s.late}; về sớm ${s.early}. Vắng lẻ tiết được tính riêng, không trừ vào "có mặt".`);
    en.push(`Excused ${s.absentP}, unexcused ${s.absentK}; late ${s.late}; left early ${s.early}. Single-period absences are counted separately and not deducted from "present".`);
  }
  if (s.partialChecked.length) {
    lines.push(`Mới điểm danh theo tiết/buổi chiều (chưa tính vào "có mặt"): ${s.partialChecked.join(', ')}.`);
    en.push(`Only checked by period/afternoon (not in "present"): ${s.partialChecked.join(', ')}.`);
  }
  if (s.missingSize.length) {
    lines.push(`Chưa có sĩ số: ${s.missingSize.join(', ')}.`);
    en.push(`Class size unknown: ${s.missingSize.join(', ')}.`);
  }
  if (s.sizeMismatch.length) {
    lines.push(`Sĩ số chưa khớp: ${s.sizeMismatch.join(', ')}.`);
    en.push(`Class size does not match: ${s.sizeMismatch.join(', ')}.`);
  }
  if (!classId && s.notChecked.length) {
    lines.push(`Chưa điểm danh: ${s.notChecked.join(', ')}.`);
    en.push(`Not checked yet: ${s.notChecked.join(', ')}.`);
  }
  if (s.truncated) {
    lines.push('Dữ liệu có thể thiếu (chạm giới hạn đọc).');
    en.push('Data may be incomplete (read limit reached).');
  }
  lines.push(`Cập nhật lúc ${at}.`);
  en.push(`Updated at ${at}.`);
  return { vi: lines.join('\n'), en: en.join('\n') };
}
