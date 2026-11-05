import { useEffect, useState } from 'react';
import type { StudentDoc } from '../types';
import { fetchClassRoster } from '../services/rosterService';

/** Danh sách HS của lớp (Firestore, nhớ trong phiên). `enabled=false` → không đọc. */
export function useClassRoster(classId: string | null | undefined, enabled = true): { roster: StudentDoc[]; loading: boolean } {
  const [roster, setRoster] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !classId) {
      setRoster([]);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchClassRoster(classId)
      .then((list) => alive && setRoster(list))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [classId, enabled]);

  return { roster, loading };
}
