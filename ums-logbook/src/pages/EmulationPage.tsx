/**
 * Xếp hạng thi đua (TPT/BGH/Giám thị/GV) — quy chế TPT 05/11/2026:
 * Thi đua = (Sổ đầu bài × 2 + Sổ cờ đỏ) / 3, SĐB = trung bình ngày thang 80 (tối đa 360/tuần).
 * Thay bảng "thang 100" cũ (công thức sai, dữ liệu mẫu). Chi tiết: utils/tptRanking.ts.
 */

import React from 'react';
import { TptRankingPanel } from '../components/summary/TptRankingPanel';
import { useAuth } from '../hooks/useAuth';
import { STAFF_ROLES } from '../types/auth';

export const EmulationPage: React.FC = () => {
  const { activeRole } = useAuth();
  // Mọi nhân sự xem xếp hạng từ sổ đầu bài thật (đều có quyền đọc sổ)
  const canView = !!activeRole && STAFF_ROLES.includes(activeRole);
  if (!canView) return <p className="text-sm text-slate-500">Trang này dành cho nhân sự nhà trường.</p>;
  return <TptRankingPanel />;
};

export default EmulationPage;
