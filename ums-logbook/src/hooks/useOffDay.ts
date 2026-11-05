/**
 * Ngày đang xem có phải ngày nghỉ không (T7, CN hoặc ngày nghỉ BGH khai).
 * `ready` = đã tải xong lịch nghỉ → chỉ khi ready && !off mới nạp/tạo sổ, tránh sinh sổ rỗng ngày nghỉ.
 */

import { useEffect, useState } from 'react';
import { fetchSchoolCalendar } from '../services/schoolCalendarService';
import { getOffDayInfo, type OffDayInfo, type SchoolCalendar } from '../utils/schoolCalendar';

export function useOffDay(date: string): OffDayInfo & { ready: boolean } {
  const [calendar, setCalendar] = useState<SchoolCalendar | null>(null);
  useEffect(() => {
    let alive = true;
    fetchSchoolCalendar().then((c) => alive && setCalendar(c));
    return () => {
      alive = false;
    };
  }, []);
  const weekend = getOffDayInfo(date);
  // Cuối tuần biết ngay, không cần chờ tải lịch.
  if (weekend.off) return { ...weekend, ready: true };
  if (!calendar) return { off: false, reason: null, kind: null, ready: false };
  return { ...getOffDayInfo(date, calendar), ready: true };
}
