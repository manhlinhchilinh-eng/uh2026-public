/**
 * Gợi ý ghép "tên trên TKB" (vd. "Ms P.Anh(Eng)", "M.K.Băng", "Ms NgMai") với tài khoản GV. Hàm thuần — không gọi Firebase.
 * Tín hiệu: danh xưng Mr/Ms ↔ username bắt đầu mr/ms; tên ↔ các chữ cuối của họ tên; chữ viết tắt ↔ chữ đầu của tên đệm/họ;
 * hòa nhau → ưu tiên GVCN của lớp mà tên đó dạy Homeroom. Không chắc → để BGH/người dùng chọn (tên giống nhau có thể là người khác nhau).
 */

export interface TkbName {
  name: string;
  subjects: string[];
  /** Lớp tên này dạy tiết Homeroom */
  homeroomClasses: string[];
}

export interface StaffAccount {
  uid: string;
  username: string;
  displayName: string;
  assignedClassId?: string;
}

export type MatchStatus = 'auto' | 'ambiguous' | 'none' | 'skip';

export interface NameMatch {
  name: string;
  status: MatchStatus;
  /** auto: đúng 1 tài khoản */
  account?: StaffAccount;
  candidates: StaffAccount[];
  note?: string;
}

const lower = (s: string) => s.normalize('NFC').toLocaleLowerCase('vi');
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

export interface ParsedTkbName {
  title: 'mr' | 'ms' | null;
  initials: string[];
  given: string[];
  hint: string;
}

/** "Ms P.Anh(Eng)" → { title: 'ms', initials: ['p'], given: ['anh'], hint: 'eng' } (chữ thường, giữ dấu). */
export function parseTkbName(raw: string): ParsedTkbName {
  let s = raw.normalize('NFC').trim();
  const hint = lower((s.match(/\(([^)]*)\)/)?.[1] || '').trim());
  s = s.replace(/\([^)]*\)/g, ' ');
  // "NgMai" → "Ng Mai"
  s = s.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');
  let tokens = lower(s).split(/[\s.,]+/).filter(Boolean);
  let title: ParsedTkbName['title'] = null;
  if (tokens[0] === 'mr' || tokens[0] === 'thầy') { title = 'mr'; tokens = tokens.slice(1); }
  else if (tokens[0] === 'ms' || tokens[0] === 'mrs' || tokens[0] === 'cô') { title = 'ms'; tokens = tokens.slice(1); }
  else if (tokens[0] === 'm' && tokens.length > 1) tokens = tokens.slice(1); // "M.K.Băng": M = Mr/Ms
  const initials: string[] = [];
  const given: string[] = [];
  for (const t of tokens) {
    if (given.length === 0 && (t.length === 1 || (t === 'ng' && tokens.length > 1))) initials.push(t);
    else given.push(t);
  }
  return { title, initials, given, hint };
}

const nameTokens = (displayName: string) => lower(displayName.replace(/\([^)]*\)/g, ' ')).split(/\s+/).filter(Boolean);

/** Tài khoản có khớp tên TKB đã tách? `loose` = so không dấu (khi so có dấu không ra ai). */
function fits(p: ParsedTkbName, a: StaffAccount, loose: boolean): boolean {
  const f = loose ? strip : (x: string) => x;
  const d = nameTokens(a.displayName).map(f);
  const g = p.given.map(f);
  if (g.length === 0 || g.length > d.length) return false;
  if (d.slice(d.length - g.length).join(' ') !== g.join(' ')) return false;
  if (p.title && !a.username.startsWith(p.title)) return false;
  // Chữ viết tắt: lần lượt khớp chữ đầu của các chữ đứng trước tên
  const rest = d.slice(0, d.length - g.length);
  let i = 0;
  for (const ini of p.initials.map(f)) {
    while (i < rest.length && !rest[i].startsWith(ini)) i++;
    if (i >= rest.length) return false;
    i++;
  }
  return true;
}

/** Gom tên GV trên TKB các lớp (kèm môn, lớp dạy Homeroom). */
export function tkbNamesFromSchedules(schedules: Record<string, { slots?: Array<{ subject: string; teacherName: string }> } | undefined>): TkbName[] {
  const m = new Map<string, TkbName>();
  for (const [classId, sch] of Object.entries(schedules)) {
    for (const s of sch?.slots || []) {
      const name = (s.teacherName || '').trim();
      if (!name) continue;
      const e = m.get(name) || { name, subjects: [], homeroomClasses: [] };
      if (!e.subjects.includes(s.subject)) e.subjects.push(s.subject);
      if (/homeroom/i.test(s.subject) && !e.homeroomClasses.includes(classId)) e.homeroomClasses.push(classId);
      m.set(name, e);
    }
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/** Kết quả ghép chắc chắn → dạng "tên TKB đã gắn" để dựng phân công (buildAssignmentsFromTimetable). */
export function aliasDocsFromMatches(matches: NameMatch[]): Array<{ uid: string; username: string; displayName: string; aliases: string[] }> {
  return matches
    .filter((m) => m.status === 'auto' && m.account)
    .map((m) => ({ uid: m.account!.uid, username: '', displayName: m.account!.displayName, aliases: [m.name] }));
}

export function matchTkbNames(names: TkbName[], staff: StaffAccount[]): NameMatch[] {
  return names.map((n): NameMatch => {
    if (/cnn3/i.test(n.name)) return { name: n.name, status: 'skip', candidates: [], note: 'GV cấp 3 (CNN3) — không có tài khoản' };
    if (/^nn2_\d/i.test(n.name)) return { name: n.name, status: 'skip', candidates: [], note: 'Ngoại ngữ 2 lớp trộn — không có tài khoản' };
    const native = n.name.match(/^native\s*(\d)$/i);
    if (native) {
      const a = staff.find((s) => s.username === `native${native[1]}ums`);
      return a ? { name: n.name, status: 'auto', account: a, candidates: [a] } : { name: n.name, status: 'none', candidates: [] };
    }
    const p = parseTkbName(n.name);
    let cands = staff.filter((a) => fits(p, a, false));
    if (cands.length === 0) cands = staff.filter((a) => fits(p, a, true));
    // Chữ viết tắt thường là tên đệm sát tên gọi ("NgMai" = Ngọc Mai, không phải Nguyễn … Mai)
    if (cands.length > 1 && p.initials.length) {
      const last = p.initials[p.initials.length - 1];
      const near = cands.filter((a) => {
        const d = nameTokens(a.displayName);
        return (d[d.length - p.given.length - 1] || '').startsWith(last);
      });
      if (near.length === 1) return { name: n.name, status: 'auto', account: near[0], candidates: cands, note: 'tên đệm khớp chữ viết tắt' };
      if (near.length > 1) cands = near;
    }
    if (cands.length > 1) {
      const hr =cands.filter((a) => a.assignedClassId && n.homeroomClasses.includes(a.assignedClassId));
      if (hr.length === 1) return { name: n.name, status: 'auto', account: hr[0], candidates: cands, note: `GVCN ${hr[0].assignedClassId}` };
    }
    if (cands.length === 1) return { name: n.name, status: 'auto', account: cands[0], candidates: cands };
    return { name: n.name, status: cands.length ? 'ambiguous' : 'none', candidates: cands };
  });
}
