/**
 * BGH phân vai trò cho tài khoản nhân sự THẬT (Firestore /users): GVCN, GVBM, TPT, Giám thị, BGH.
 * Không cho tự bỏ quyền BGH của chính mình (tránh tự khóa).
 */

import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { ShieldCheck } from 'lucide-react';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { FAMILY_ROLES, type UserRole } from '../../types/auth';
import { logAuditEvent } from '../../services/auditService';

const EDITABLE: Array<{ role: UserRole; label: string }> = [
  { role: 'admin', label: 'BGH' },
  { role: 'gvcn', label: 'GVCN' },
  { role: 'gvbm', label: 'GVBM' },
  { role: 'tpt', label: 'TPT' },
  { role: 'giamthi', label: 'Giám thị' },
  { role: 'vanphong', label: 'Văn phòng' },
];

interface Row {
  uid: string;
  username: string;
  displayName: string;
  roles: UserRole[];
  assignedClassId?: string;
}

export const StaffRolesPanel: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) =>
        setRows(
          snap.docs
            .map((d) => ({ uid: d.id, ...(d.data() as Omit<Row, 'uid'>) }))
            .filter((u) => (u.roles || []).some((r) => !FAMILY_ROLES.includes(r)))
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'vi'))
        )
      )
      .catch((e) => {
        console.error('[Phân vai trò]', e);
        setRows([]);
      });
  }, []);

  const toggle = async (u: Row, role: UserRole) => {
    if (!profile) return;
    const has = u.roles.includes(role);
    if (has && role === 'admin' && u.uid === profile.uid) return showToast('Không thể tự bỏ quyền BGH của chính mình.', 'error');
    const next = has ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    if (next.filter((r) => !FAMILY_ROLES.includes(r)).length === 0) return showToast('Tài khoản nhân sự cần ít nhất 1 vai trò.', 'error');
    setBusy(u.uid);
    try {
      await updateDoc(doc(db, 'users', u.uid), { roles: next, updatedAt: Date.now() });
      setRows((rs) => rs?.map((x) => (x.uid === u.uid ? { ...x, roles: next } : x)) ?? null);
      await logAuditEvent({
        action: 'UPDATE',
        targetCollection: 'users',
        targetId: u.uid,
        details: `${has ? 'Bỏ' : 'Cấp'} vai trò ${role} cho ${u.displayName || u.username}.`,
      });
      showToast(`${has ? 'Đã bỏ' : 'Đã cấp'} vai trò ${EDITABLE.find((e) => e.role === role)?.label} cho ${u.displayName}.`, 'success');
    } catch (e) {
      console.error('[Phân vai trò] lưu', e);
      showToast('Lưu vai trò thất bại.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const shown = (rows || []).filter((u) => !q || `${u.displayName} ${u.username}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3" data-testid="staff-roles">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#8B1A4A]" />
        <h3 className="text-sm font-bold text-slate-900">Phân vai trò nhân sự (tài khoản thật)</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên…" aria-label="Tìm nhân sự" className="ml-auto px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
      </div>
      <p className="text-xs text-slate-500">
        Giám thị: xem sổ đầu bài mọi lớp, ghi nhận nề nếp, không chấm tiết. TPT: xem & tổng kết thi đua. Vai trò mới có hiệu lực khi người đó đăng nhập lại.
      </p>
      {!rows ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left">Nhân sự</th>
                <th className="p-2 text-left">Lớp CN</th>
                {EDITABLE.map((e) => (
                  <th key={e.role} className="p-2 text-center">
                    {e.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((u) => (
                <tr key={u.uid}>
                  <td className="p-2">
                    <div className="font-semibold text-slate-900">{u.displayName}</div>
                    <div className="text-slate-400">{u.username}</div>
                  </td>
                  <td className="p-2">{u.assignedClassId || '—'}</td>
                  {EDITABLE.map((e) => (
                    <td key={e.role} className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={u.roles.includes(e.role)}
                        disabled={busy === u.uid}
                        onChange={() => toggle(u, e.role)}
                        aria-label={`${e.label} — ${u.displayName}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
