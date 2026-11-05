/**
 * Hộ chiếu năng lực số — trang in (Ctrl+P → Lưu PDF). Dùng trình duyệt in để giữ đúng dấu tiếng Việt.
 * Chỉ gồm minh chứng ĐÃ được giáo viên duyệt.
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Printer } from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import type { PortfolioItem } from '../types/portfolio';
import { fetchPortfolioForStudent } from '../services/portfolioService';
import { CATEGORY_LABEL, TYPE_LABEL } from '../utils/portfolio';
import { CompetencyBars } from '../components/portfolio/PortfolioParts';

export const PassportPage: React.FC = () => {
  // Mã HS truyền qua state của router (không đặt trên URL để tránh lưu vào lịch sử trình duyệt).
  // PH/HS mở trực tiếp → mặc định HS được liên kết với tài khoản.
  const location = useLocation();
  const { profile } = useAuth();
  const mhs: string = (location.state as { mhs?: string } | null)?.mhs || profile?.studentMhs?.[0] || '';
  const [items, setItems] = useState<PortfolioItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mhs) return;
    fetchPortfolioForStudent(mhs)
      .then((all) => setItems(all.filter((i) => i.status === 'approved')))
      .catch((e) => {
        console.error(e);
        setError('Không tải được hồ sơ (kiểm tra quyền truy cập).');
      });
  }, [mhs]);

  if (!mhs) return <p className="text-sm text-slate-600">Chưa chọn học sinh. Mở hộ chiếu từ trang Hồ sơ năng lực.</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!items) return <p className="text-sm text-slate-500">Đang tải…</p>;

  const first = items[0];
  return (
    <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 border border-slate-200 rounded-xl print:border-0 print:p-0 print:shadow-none">
      <div className="flex justify-end print:hidden mb-4">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#8B1A4A] text-white">
          <Printer className="w-4 h-4" /> In / Lưu PDF
        </button>
      </div>
      <header className="text-center border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold text-slate-600">{BRAND_CONFIG.schoolNameVi} — {BRAND_CONFIG.subTitleVi}</p>
        <h1 className="text-xl font-black text-[#8B1A4A] mt-1">HỘ CHIẾU NĂNG LỰC SỐ</h1>
        <p className="text-sm text-slate-800 mt-1" data-testid="passport-student">
          {first ? `${first.studentName} • Lớp ${first.classId}` : `Mã HS ${mhs}`}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">Theo khung năng lực GDPT 2018 • {BRAND_CONFIG.platformName}</p>
      </header>

      <section className="mt-5">
        <CompetencyBars items={items} />
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-bold text-slate-900 mb-2">Minh chứng đã được giáo viên xác nhận ({items.length})</h2>
        {items.length === 0 && <p className="text-xs text-slate-500">Chưa có minh chứng nào được duyệt.</p>}
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={it.id} className="text-xs border-l-2 border-[#A8285F] pl-3 break-inside-avoid">
              <p className="font-bold text-slate-900">{i + 1}. {it.title}</p>
              <p className="text-slate-500">{TYPE_LABEL[it.type]} • {CATEGORY_LABEL[it.category]} • {new Date(it.createdAt).toLocaleDateString('vi-VN')}</p>
              {it.ai && <p className="text-slate-700">Đánh giá rubric (AI hỗ trợ): {it.ai.overall_level} — {it.ai.skills.slice(0, 3).map((s) => s.skill_name).join(', ')}</p>}
              {it.teacherComment && <p className="text-slate-800">Nhận xét GV {it.reviewerName}: “{it.teacherComment}”{it.teacherScore != null ? ` — ${it.teacherScore}/10` : ''}</p>}
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-8 grid grid-cols-2 gap-6 text-center text-xs text-slate-700">
        <div>
          <p className="font-semibold">Giáo viên chủ nhiệm</p>
          <p className="text-slate-400 mt-10">(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-semibold">Ban Giám hiệu</p>
          <p className="text-slate-400 mt-10">(Ký, đóng dấu)</p>
        </div>
      </footer>
      <p className="text-[10px] text-slate-400 text-center mt-6">In ngày {new Date().toLocaleDateString('vi-VN')}. Điểm AI là gợi ý xử lý offline trên máy, không gửi dữ liệu ra ngoài.</p>
    </div>
  );
};
