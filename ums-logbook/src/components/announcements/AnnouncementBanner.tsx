import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { useAnnouncements } from '../../context/AnnouncementsContext';

/** Dải đỏ đầu trang khi có thông báo KHẨN chưa đọc. */
export const AnnouncementBanner: React.FC = () => {
  const { urgentUnread } = useAnnouncements();
  const navigate = useNavigate();
  if (urgentUnread.length === 0) return null;
  const first = urgentUnread[0];

  return (
    <button
      type="button"
      data-testid="urgent-banner"
      onClick={() => navigate(`/announcements?open=${first.id}`)}
      className="w-full mb-4 flex items-center gap-3 text-left bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-3 shadow-sm"
    >
      <Siren className="w-5 h-5 shrink-0 animate-pulse" />
      <span className="text-xs sm:text-sm">
        <span className="font-black">KHẨN:</span> {first.title}
        {urgentUnread.length > 1 && <span className="opacity-80"> (+{urgentUnread.length - 1} thông báo khẩn khác)</span>}
      </span>
      <span className="ml-auto text-[11px] font-semibold underline underline-offset-2 shrink-0">Xem ngay</span>
    </button>
  );
};
