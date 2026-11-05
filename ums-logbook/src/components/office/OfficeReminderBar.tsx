/**
 * Thanh nhắc việc của Thông báo Văn phòng: tin sắp tới hạn / quá hạn mà tôi chưa xong.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock } from 'lucide-react';
import { useOfficeNotices } from '../../context/OfficeNoticesContext';
import { formatRemaining, noticeStatus } from '../../utils/officeNotices';

export const OfficeReminderBar: React.FC = () => {
  const { reminders, acks, now } = useOfficeNotices();
  const navigate = useNavigate();
  if (reminders.length === 0) return null;
  const shown = reminders.slice(0, 3);
  const overdue = reminders.some((n) => noticeStatus(n, acks.get(n.id), now) === 'overdue');

  return (
    <div
      role="status"
      data-testid="office-reminder"
      className={`mb-4 rounded-xl border px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-3 gap-y-1 ${
        overdue ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-amber-50 border-amber-300 text-amber-900'
      }`}
    >
      <AlarmClock className="w-4 h-4 shrink-0" />
      <span className="font-bold">Việc từ Văn phòng cần làm:</span>
      {shown.map((n) => (
        <button key={n.id} type="button" onClick={() => navigate(`/announcements?open=${n.id}`)} className="underline underline-offset-2 hover:no-underline text-left">
          {n.title} ({n.deadlineAt ? formatRemaining(n.deadlineAt - now) : ''})
        </button>
      ))}
      {reminders.length > 3 && <span>+{reminders.length - 3} việc khác</span>}
    </div>
  );
};
