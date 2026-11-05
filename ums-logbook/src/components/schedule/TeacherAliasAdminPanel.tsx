/**
 * BGH xem & sửa việc gắn "tên trên TKB" ↔ tài khoản GV.
 * Mỗi tên một dòng: ai đã nhận (GV tự chọn), xung đột (2 người cùng nhận), tên chưa ai nhận.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { AlertTriangle, UserCheck } from 'lucide-react';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { useTeachingContext } from '../../hooks/useTeachingContext';
import { saveTeacherAliases } from '../../services/teacherAliasService';
import { syncScheduleSlotMaps } from '../../services/timetableUpdateService';
import { FAMILY_ROLES, type UserRole } from '../../types/auth';
import { expandAliasVariants, listTimetableAliases, normAlias } from '../../utils/teacherAssignment';

interface StaffUser {
  uid: string;
  username: string;
  displayName: string;
}

export const TeacherAliasAdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const teach = useTeachingContext();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [filter, setFilter] = useState<'all' | 'unclaimed' | 'conflict'>('all');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) =>
        setStaff(
          snap.docs
            .map((d) => ({ uid: d.id, ...(d.data() as { username?: string; displayName?: string; roles?: UserRole[] }) }))
            .filter((u) => (u.roles || []).some((r) => !FAMILY_ROLES.includes(r)))
            .map((u) => ({ uid: u.uid, username: u.username || '', displayName: u.displayName || u.username || u.uid }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'))
        )
      )
      .catch((e) => console.error('[Gắn GV] users', e));
  }, []);

  const aliases = useMemo(() => listTimetableAliases(teach.schedules), [teach.schedules]);
  const conflictSet = new Set(teach.conflicts);
  const rows = aliases.filter((a) => {
    const owners = teach.byAlias.get(normAlias(a.alias)) || [];
    if (filter === 'unclaimed') return owners.length === 0;
    if (filter === 'conflict') return conflictSet.has(normAlias(a.alias));
    return true;
  });
  const claimed = aliases.filter((a) => (teach.byAlias.get(normAlias(a.alias)) || []).length > 0).length;

  /** Gán 1 tên TKB cho đúng 1 GV (gỡ khỏi người khác). uid '' = bỏ gán. */
  const assign = async (alias: string, uid: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      const key = normAlias(alias);
      const touched = new Set<string>([uid, ...(teach.byAlias.get(key) || []).map((o) => o.uid)].filter(Boolean));
      for (const tUid of touched) {
        const doc = teach.aliasDocs.find((d) => d.uid === tUid);
        const user = staff.find((s) => s.uid === tUid) || (doc ? { uid: doc.uid, username: doc.username, displayName: doc.displayName } : null);
        if (!user) continue;
        const current = (doc?.aliases || []).filter((a) => normAlias(a) !== key);
        await saveTeacherAliases(user, tUid === uid ? expandAliasVariants([...current, alias], teach.schedules) : current, profile);
      }
      await syncScheduleSlotMaps().catch(() => {});
      await teach.reload();
      showToast(uid ? `Đã gán "${alias}" cho ${staff.find((s) => s.uid === uid)?.displayName}.` : `Đã bỏ gán "${alias}".`, 'success');
    } catch (e) {
      console.error('[Gắn GV] lưu', e);
      showToast('Lưu thất bại.', 'error');
    } finally {
      setBusy(false);
    }
  };


  if (!teach.ready) return <p className="text-sm text-slate-500">Đang tải…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        GV tự chọn tên của mình trên TKB trong Sổ đầu bài → “Chấm tiết dạy của tôi”. Ở đây BGH kiểm tra và sửa. Tên chưa ai nhận (vd. GV bản ngữ, NN2) thì GVCN lớp đó ghi sổ thay.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <UserCheck className="w-4 h-4 text-[#8B1A4A]" />
        <span>
          Đã gắn <b>{claimed}</b>/{aliases.length} tên.
        </span>
        {teach.conflicts.length > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" /> {teach.conflicts.length} tên có 2 người cùng nhận
          </span>
        )}
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="ml-auto px-2 py-1 border border-slate-300 rounded-lg" aria-label="Lọc">
          <option value="all">Tất cả tên</option>
          <option value="unclaimed">Chưa ai nhận</option>
          <option value="conflict">Bị trùng</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {rows.map((a) => {
          const owners = teach.byAlias.get(normAlias(a.alias)) || [];
          const isConflict = owners.length > 1;
          return (
            <div key={a.alias} className={`flex flex-wrap items-center gap-3 p-2.5 text-sm ${isConflict ? 'bg-amber-50' : ''}`} data-testid="alias-row">
              <div className="w-40 shrink-0">
                <div className="font-bold text-slate-900">{a.alias}</div>
                <div className="text-[11px] text-slate-500">
                  {a.periods} tiết · {a.classes.length} lớp · {a.subjects.slice(0, 2).join(', ')}
                </div>
              </div>
              <div className="flex-1 min-w-[200px] text-xs text-slate-600">
                {owners.length === 0 ? <span className="italic text-slate-400">Chưa ai nhận</span> : owners.map((o) => o.displayName).join(' · ')}
                {isConflict && <span className="ml-2 font-semibold text-amber-700">← trùng, chọn 1 người</span>}
              </div>
              <select
                disabled={busy}
                value={owners.length === 1 ? owners[0].uid : ''}
                onChange={(e) => assign(a.alias, e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs max-w-[220px]"
                aria-label={`Gán tên ${a.alias}`}
              >
                <option value="">{owners.length > 1 ? '— chọn người đúng —' : '— chưa gán —'}</option>
                {staff.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};
