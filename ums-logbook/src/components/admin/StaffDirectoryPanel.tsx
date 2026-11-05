/**
 * Danh sách cán bộ – giáo viên (chỉ BGH): nhập từ Excel của trường (CHỈ lấy họ tên, xử lý ngay trên máy),
 * chọn Thầy/Cô, bổ sung SĐT/ghi chú, xem ai đã có tài khoản UMS+ và tên đăng nhập sẽ tạo.
 */

import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs } from 'firebase/firestore';
import { BookUser, FileSpreadsheet, Plus, ShieldAlert } from 'lucide-react';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { addStaffMember, addStaffMembers, fetchStaffMembers, updateStaffMember } from '../../services/staffDirectoryService';
import { matchAccounts, normName, parseStaffNames, suggestUsername, type StaffMember, type StaffTitle } from '../../utils/staffDirectory';

interface UserRow {
  uid: string;
  username?: string;
  displayName?: string;
}

export const StaffDirectoryPanel: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [preview, setPreview] = useState<{ sheet: string; sheets: string[]; wb: XLSX.WorkBook; names: string[] } | null>(null);
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [m, u] = await Promise.all([fetchStaffMembers(), getDocs(collection(db, 'users'))]);
    setMembers(m);
    setUsers(u.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserRow, 'uid'>) })));
  };
  useEffect(() => {
    load().catch((e) => {
      console.error('[Danh sách cán bộ]', e);
      setMembers([]);
    });
  }, []);

  const accounts = useMemo(() => matchAccounts(members || [], users), [members, users]);
  const suggested = useMemo(() => {
    const taken = new Set(users.map((u) => u.username || '').filter(Boolean));
    const out = new Map<string, string | null>();
    for (const m of members || []) {
      if (accounts.has(normName(m.fullName))) continue;
      const u = suggestUsername(m.fullName, m.title, taken);
      if (u) taken.add(u);
      out.set(m.id, u);
    }
    return out;
  }, [members, users, accounts]);

  const readSheet = (wb: XLSX.WorkBook, sheet: string) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: null });
    return parseStaffNames(rows).names; // chỉ họ tên — các cột khác bị bỏ ngay tại đây
  };

  const onFile = async (file: File) => {
    try {
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      const sheet = wb.SheetNames.find((n) => readSheet(wb, n).length > 0) ?? wb.SheetNames[0];
      setPreview({ wb, sheets: wb.SheetNames, sheet, names: readSheet(wb, sheet) });
    } catch {
      showToast('Không đọc được file Excel.', 'error');
    }
  };

  const existing = new Set((members || []).map((m) => normName(m.fullName)));
  const newNames = preview ? preview.names.filter((n) => !existing.has(normName(n))) : [];

  const importNames = async () => {
    if (!profile || newNames.length === 0) return;
    setBusy(true);
    try {
      await addStaffMembers(newNames, profile.username);
      showToast(`Đã thêm ${newNames.length} cán bộ (chỉ họ tên).`, 'success');
      setPreview(null);
      await load();
    } catch (e) {
      console.error('[Danh sách cán bộ] nhập', e);
      showToast('Thêm thất bại.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (m: StaffMember, p: Partial<StaffMember>) => {
    if (!profile) return;
    setMembers((ms) => ms?.map((x) => (x.id === m.id ? { ...x, ...p } : x)) ?? null);
    try {
      await updateStaffMember(m.id, p, profile.username);
    } catch (e) {
      console.error('[Danh sách cán bộ] lưu', e);
      showToast('Lưu thất bại.', 'error');
      load();
    }
  };

  const shown = (members || []).filter((m) => !q || normName(m.fullName).includes(normName(q)));
  const withAcc = (members || []).filter((m) => accounts.has(normName(m.fullName))).length;
  const needTitle = (members || []).filter((m) => m.active && !accounts.has(normName(m.fullName)) && !m.title).length;
  const field = 'px-2 py-1 border border-slate-300 rounded-md text-xs';

  return (
    <div className="space-y-3" data-testid="staff-directory">
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookUser className="w-5 h-5 text-[#8B1A4A]" />
          <h3 className="text-sm font-bold text-slate-900">Danh sách cán bộ – giáo viên</h3>
          {members && (
            <span className="text-xs text-slate-500">
              {members.length} người · {withAcc} đã có tài khoản · {members.length - withAcc} chưa có{needTitle > 0 && ` (${needTitle} người chưa chọn Thầy/Cô)`}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 flex items-start gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Nhập file Excel của trường: app <b>chỉ lấy cột họ tên</b> ngay trên máy này, bỏ qua ngày sinh, giấy tờ, điện thoại, email… Chỉ BGH xem được danh sách. Chọn Thầy/Cô để có tên đăng nhập (mẫu ms/mr + tên đệm + tên + ums).
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Nhập từ Excel (chỉ họ tên)
            <input
              type="file"
              accept=".xls,.xlsx"
              className="sr-only"
              aria-label="Chọn file danh sách cán bộ"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = '';
              }}
            />
          </label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Thêm 1 người: họ và tên" aria-label="Họ tên cán bộ mới" className={`${field} py-2 w-56`} />
          <button
            type="button"
            disabled={!newName.trim() || busy}
            onClick={async () => {
              if (!profile) return;
              await addStaffMember(newName, profile.username);
              setNewName('');
              await load();
            }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Thêm
          </button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên…" aria-label="Tìm cán bộ" className={`${field} py-2 ml-auto`} />
        </div>

        {preview && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs space-y-2" data-testid="staff-import-preview">
            <div className="flex flex-wrap items-center gap-2">
              <span>Sheet:</span>
              <select
                value={preview.sheet}
                onChange={(e) => setPreview({ ...preview, sheet: e.target.value, names: readSheet(preview.wb, e.target.value) })}
                className={field}
                aria-label="Chọn sheet"
              >
                {preview.sheets.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <span>
                Đọc được <b>{preview.names.length}</b> họ tên · <b>{newNames.length}</b> người mới (bỏ qua người đã có trong danh sách).
              </span>
            </div>
            {newNames.length > 0 && <p className="text-slate-600">{newNames.slice(0, 12).join(' · ')}{newNames.length > 12 && ` … +${newNames.length - 12}`}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={busy || newNames.length === 0} onClick={importNames} className="px-3 py-1.5 rounded-lg font-semibold bg-[#8B1A4A] text-white disabled:opacity-50">
                Thêm {newNames.length} người
              </button>
              <button type="button" onClick={() => setPreview(null)} className="px-3 py-1.5 rounded-lg font-semibold bg-white border border-slate-300">
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>

      {!members ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left">Họ và tên</th>
                <th className="p-2 text-left">Danh xưng</th>
                <th className="p-2 text-left">Tài khoản UMS+</th>
                <th className="p-2 text-left">Số điện thoại</th>
                <th className="p-2 text-left">Ghi chú</th>
                <th className="p-2 text-center">Đang công tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((m) => {
                const acc = accounts.get(normName(m.fullName));
                const sug = suggested.get(m.id);
                return (
                  <tr key={m.id} className={m.active ? '' : 'opacity-50'} data-testid="staff-row">
                    <td className="p-2 font-semibold text-slate-900">{m.fullName}</td>
                    <td className="p-2">
                      <select value={m.title} onChange={(e) => patch(m, { title: e.target.value as StaffTitle })} className={field} aria-label={`Danh xưng ${m.fullName}`}>
                        <option value="">—</option>
                        <option value="Thầy">Thầy</option>
                        <option value="Cô">Cô</option>
                      </select>
                    </td>
                    <td className="p-2">
                      {acc ? (
                        <span className="font-mono text-emerald-700">{acc.username}</span>
                      ) : sug ? (
                        <span className="text-slate-500">
                          chưa có · sẽ tạo <span className="font-mono">{sug}</span>
                        </span>
                      ) : (
                        <span className="text-amber-700">chưa có · chọn Thầy/Cô</span>
                      )}
                    </td>
                    <td className="p-2">
                      <input
                        defaultValue={m.phone || ''}
                        onBlur={(e) => e.target.value !== (m.phone || '') && patch(m, { phone: e.target.value.trim() })}
                        inputMode="tel"
                        className={`${field} w-32`}
                        aria-label={`SĐT ${m.fullName}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        defaultValue={m.note || ''}
                        onBlur={(e) => e.target.value !== (m.note || '') && patch(m, { note: e.target.value.trim() })}
                        className={`${field} w-48`}
                        aria-label={`Ghi chú ${m.fullName}`}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={m.active} onChange={(e) => patch(m, { active: e.target.checked })} aria-label={`Đang công tác ${m.fullName}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
