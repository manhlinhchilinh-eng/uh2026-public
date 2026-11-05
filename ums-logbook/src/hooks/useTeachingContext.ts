/**
 * Dữ liệu để biết "tiết của tôi": TKB toàn trường, tên TKB mọi GV đã nhận, tên của tôi, lịch dạy thay của tôi.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { fetchSchedulesStrict } from '../services/scheduleService';
import { fetchAllTeacherAliases } from '../services/teacherAliasService';
import { fetchMySubstituteDuties } from '../services/substitutionService';
import type { ClassSchedule } from '../types/schedule';
import type { Substitution } from '../types/substitution';
import { buildAliasIndex, type TeacherAliasDoc } from '../utils/teacherAssignment';

export function useTeachingContext() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<Record<string, ClassSchedule>>({});
  const [aliasDocs, setAliasDocs] = useState<TeacherAliasDoc[]>([]);
  const [duties, setDuties] = useState<Substitution[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!profile) return;
    const [s, a, d] = await Promise.all([
      fetchSchedulesStrict().catch(() => ({}) as Record<string, ClassSchedule>),
      fetchAllTeacherAliases().catch(() => [] as TeacherAliasDoc[]),
      fetchMySubstituteDuties(profile.uid).catch(() => [] as Substitution[]),
    ]);
    setSchedules(s);
    setAliasDocs(a);
    setDuties(d);
    setReady(true);
  }, [profile]);

  useEffect(() => {
    reload();
  }, [reload]);

  const myAliases = useMemo(() => aliasDocs.find((d) => d.uid === profile?.uid)?.aliases || [], [aliasDocs, profile?.uid]);
  const index = useMemo(() => buildAliasIndex(aliasDocs), [aliasDocs]);
  const claimedAliases = useMemo(() => new Set(index.byAlias.keys()), [index]);

  return { ready, schedules, aliasDocs, myAliases, claimedAliases, conflicts: index.conflicts, byAlias: index.byAlias, duties, reload };
}
