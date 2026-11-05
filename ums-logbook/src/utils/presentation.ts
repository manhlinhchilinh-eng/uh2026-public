/**
 * Chế độ trình chiếu: che tên & mã học sinh khi demo công khai.
 * Chỉ thay đổi PHẦN HIỂN THỊ trên máy đang bật, không sửa dữ liệu.
 */

export const PRESENTATION_KEY = 'ums_presentation_mode';

export function isPresentationMode(): boolean {
  try {
    return localStorage.getItem(PRESENTATION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPresentationMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(PRESENTATION_KEY, '1');
    else localStorage.removeItem(PRESENTATION_KEY);
  } catch {
    /* trình duyệt chặn localStorage → bỏ qua */
  }
}

/** "Nguyễn Văn An" → "Nguyễn V. A." (giữ họ, các tên đệm/tên viết tắt). */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/u).filter(Boolean);
  if (parts.length <= 1) return parts[0] ? `${[...parts[0]][0]}.` : fullName;
  const [ho, ...rest] = parts;
  return `${ho} ${rest.map((p) => `${[...p][0].toLocaleUpperCase('vi')}.`).join(' ')}`;
}

export const MASKED_ID = '••••••';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tạo hàm che: thay mọi tên HS (cả dạng VIẾT HOA) và mã HS trong 1 đoạn văn bản.
 * Tên dài khớp trước để "Nguyễn Hưng Ánh" không bị cắt thành "Nguyễn Hà A." + phần dư.
 */
export function buildMasker(students: Array<{ fullName: string; mhs?: string }>): (text: string) => string {
  const nameMap = new Map<string, string>();
  for (const s of students) {
    const n = s.fullName?.trim();
    if (!n || n.split(/\s+/).length < 2) continue;
    nameMap.set(n, maskName(n));
    nameMap.set(n.toLocaleUpperCase('vi'), maskName(n).toLocaleUpperCase('vi'));
  }
  const ids = new Set(students.map((s) => String(s.mhs ?? '').trim()).filter((m) => /^\d{6}$/.test(m)));
  const names = [...nameMap.keys()].sort((a, b) => b.length - a.length);
  const nameRe = names.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${names.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'gu') : null;
  const idRe = ids.size ? /(?<!\d)\d{6}(?!\d)/g : null;
  return (text: string) => {
    let out = text;
    if (nameRe) out = out.replace(nameRe, (m) => nameMap.get(m) ?? m);
    if (idRe) out = out.replace(idRe, (m) => (ids.has(m) ? MASKED_ID : m));
    return out;
  };
}

/** Che toàn bộ text node trong 1 cây DOM (bỏ qua script/style và ô nhập liệu). Trả về số node đã đổi. */
export function maskDom(root: Node, mask: (t: string) => string): number {
  let changed = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const before = n.nodeValue ?? '';
    const after = mask(before);
    if (after !== before) {
      n.nodeValue = after;
      changed++;
    }
  }
  return changed;
}
