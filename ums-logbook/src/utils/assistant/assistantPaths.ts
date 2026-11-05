/**
 * Route mỗi vai trò mở được — lấy từ chính menu (buildNavGroups) để Trợ lý không giữ danh sách quyền thứ hai.
 */
import type { UserRole } from '../../types/auth';
import { buildNavGroups } from '../navGroups';

/** Trang mọi người đã đăng nhập đều mở được nhưng không nằm trong nhóm menu. */
const ALWAYS = ['/apps', '/dashboard'];

export function allowedPathsForRole(role: UserRole | null | undefined, assignedClassId?: string | null): Set<string> {
  if (!role) return new Set();
  const paths = buildNavGroups({ role, assignedClassId, devTools: false }).flatMap((g) => g.items.map((i) => i.path));
  return new Set([...paths, ...ALWAYS]);
}
