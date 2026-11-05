import React, { useState, useEffect } from 'react';
import { Users, Search, CheckCircle2, Clock } from 'lucide-react';
import { UserDoc } from '../types';
import { StaffRolesPanel } from '../components/admin/StaffRolesPanel';
import { StaffDirectoryPanel } from '../components/admin/StaffDirectoryPanel';
import { Bi } from '../components/common/Bi';
import { useSearchParams } from 'react-router-dom';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const tab = (['staff', 'roles', 'local'] as const).find((x) => x === params.get('tab')) ?? 'staff';

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ums_users');
      if (raw) {
        setUsers(JSON.parse(raw));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      u.displayName.toLowerCase().includes(term) ||
      (u.assignedClassId && u.assignedClassId.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Quản lý tài khoản">
        {[
          { id: 'staff', label: 'Danh sách cán bộ', en: 'Staff Directory' },
          { id: 'roles', label: 'Phân vai trò nhân sự', en: 'Role Assignment' },
          { id: 'local', label: 'Tài khoản (dữ liệu thử trên máy)', en: 'Local Demo Accounts' },
        ].map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setParams(x.id === 'staff' ? {} : { tab: x.id }, { replace: true })}
            className={`px-3 py-2 rounded-lg text-xs font-bold border ${tab === x.id ? 'bg-[#8B1A4A] text-white border-[#8B1A4A]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#8B1A4A]/50'}`}
          >
            <Bi vi={x.label} en={x.en} />
          </button>
        ))}
      </div>
      {tab === 'staff' && <StaffDirectoryPanel />}
      {tab === 'roles' && <StaffRolesPanel />}
      {tab === 'local' && (
      <>
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi="Quản lý tài khoản" en="Account Management" />
            </h2>
            <p className="text-xs text-slate-500">
              <Bi vi="Danh sách 29 tài khoản Ban Giám Hiệu, GVCN và Tổng phụ trách" en="29 Leadership, Homeroom & Young Pioneer Leader accounts" />
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm tên, tài khoản hoặc lớp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#8B1A4A] w-64"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Tài khoản (Username)</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Vai trò (Roles)</th>
                <th className="py-3 px-4">Lớp CN</th>
                <th className="py-3 px-4">Trạng thái MK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.username} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-ums-900">
                    {u.username}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {u.displayName}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : r === 'gvcn'
                              ? 'bg-rose-100 text-rose-800'
                              : r === 'tpt'
                              ? 'bg-amber-100 text-amber-800'
                              : r === 'giamthi'
                              ? 'bg-orange-100 text-orange-800'
                              : r === 'vanphong'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {r.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-700">
                    {u.assignedClassId ? `Lớp ${u.assignedClassId}` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {u.mustChangePassword ? (
                      <span className="inline-flex items-center text-amber-600 space-x-1 font-semibold">
                        <Clock className="w-3 h-3" />
                        <span>Chưa đổi MK</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-emerald-600 space-x-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Đã đổi MK</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
