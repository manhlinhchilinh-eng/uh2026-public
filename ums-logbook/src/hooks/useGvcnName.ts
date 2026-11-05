/**
 * Tên GVCN thật của một lớp.
 * Nguồn: Firestore `classes/{classId}.gvcnName` (cache 10 phút, dùng chung với Dashboard).
 * Không dùng GVCN_USER_MAPPING.name — đó là tên demo đã xáo trộn.
 * Trong lúc chờ: nếu người xem là GVCN của chính lớp đó thì hiện tên tài khoản của họ.
 */
import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { fetchClassGvcnName } from '../services/dashboardService';

export function useGvcnName(classId: string): string {
  const { profile } = useAuth();
  const ownName = profile?.assignedClassId === classId ? String(profile?.displayName || '').trim() : '';
  const [name, setName] = useState<string>('');

  useEffect(() => {
    let alive = true;
    setName('');
    if (!classId) return;
    fetchClassGvcnName(classId)
      .then((n) => { if (alive) setName(n); })
      .catch(() => { if (alive) setName(''); });
    return () => { alive = false; };
  }, [classId]);

  return name || ownName;
}
