/**
 * Danh sách cán bộ – giáo viên (BGH quản lý). Nhập từ file Excel của trường nhưng CHỈ LẤY HỌ TÊN —
 * mọi cột khác (ngày sinh, giấy tờ, điện thoại, email…) bị bỏ qua ngay trên máy, không gửi đi đâu.
 * Hàm thuần — không gọi Firebase.
 */

export type StaffTitle = 'Thầy' | 'Cô' | '';

export interface StaffMember {
  id: string;
  fullName: string;
  title: StaffTitle;
  /** Bổ sung sau khi cần (BGH tự nhập) */
  phone?: string;
  note?: string;
  active: boolean;
  /** Tài khoản UMS+ đã gắn */
  uid?: string;
  username?: string;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
}

const cell = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
export const normName = (s: string) => cell(s).normalize('NFC').toLocaleLowerCase('vi');

/** Bỏ dấu tiếng Việt, chỉ giữ a-z0-9. */
export function asciiSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Đọc họ tên từ 1 sheet: tìm dòng tiêu đề có "Họ và tên"; nếu cột kế bên không có tiêu đề
 * (file tách "Họ đệm" | "Tên") thì ghép 2 cột. Chỉ trả về danh sách họ tên.
 */
export function parseStaffNames(rows: unknown[][]): { names: string[]; headerRow: number | null } {
  const headerIdx = rows.findIndex((r) => (r || []).some((c) => /họ\s*(và|&)\s*tên/i.test(cell(c))));
  if (headerIdx < 0) return { names: [], headerRow: null };
  const header = rows[headerIdx].map(cell);
  const col = header.findIndex((c) => /họ\s*(và|&)\s*tên/i.test(c));
  const joinNext = header[col + 1] === '';
  // Có cột TT/STT → chỉ lấy dòng có số thứ tự (bỏ dòng tiêu đề nhóm như "Tổ Toán")
  const ttCol = header.findIndex((c) => /^s?tt$/i.test(c));
  const names: string[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(headerIdx + 1)) {
    if (ttCol >= 0 && !/^\d+$/.test(cell(r?.[ttCol]))) continue;
    const name = cell([cell(r?.[col]), joinNext ? cell(r?.[col + 1]) : ''].join(' '));
    if (!name || name.split(' ').length < 2 || /\d/.test(name)) continue;
    const k = normName(name);
    if (seen.has(k)) continue;
    seen.add(k);
    names.push(name);
  }
  return { names, headerRow: headerIdx + 1 };
}

/**
 * Tên đăng nhập theo mẫu đang dùng: ms/mr + tên đệm + tên + "ums" (bỏ họ), không dấu.
 * VD "Bùi Phương Anh" (Cô) → msphuonganhums. Trùng thì thêm số: mslinh2ums.
 */
export function suggestUsername(fullName: string, title: StaffTitle, taken: Set<string>): string | null {
  if (!title) return null;
  const words = cell(fullName).split(' ');
  // Bỏ tên đệm "Thị"/"Văn" như các tài khoản đang dùng (Lê Thị Huyền → mshuyenums)
  const rest = (words.length > 1 ? words.slice(1) : words).filter((w, i, a) => i === a.length - 1 || !/^(thị|văn)$/i.test(w));
  const given = rest.slice(-2);
  const base = `${title === 'Thầy' ? 'mr' : 'ms'}${asciiSlug(given.join(''))}`;
  if (!asciiSlug(given.join(''))) return null;
  for (let i = 1; i < 100; i++) {
    const u = `${base}${i === 1 ? '' : i}ums`;
    if (!taken.has(u)) return u;
  }
  return null;
}

/** Ghép người trong danh sách với tài khoản sẵn có theo họ tên. */
export function matchAccounts<T extends { displayName?: string; username?: string; uid: string }>(
  members: Pick<StaffMember, 'fullName' | 'uid'>[],
  users: T[]
): Map<string, T> {
  const byName = new Map<string, T[]>();
  users.forEach((u) => {
    const k = normName(u.displayName || '');
    if (k) byName.set(k, [...(byName.get(k) || []), u]);
  });
  const out = new Map<string, T>();
  for (const m of members) {
    const linked = m.uid ? users.find((u) => u.uid === m.uid) : undefined;
    const byN = byName.get(normName(m.fullName));
    const hit = linked || (byN?.length === 1 ? byN[0] : undefined);
    if (hit) out.set(normName(m.fullName), hit);
  }
  return out;
}
