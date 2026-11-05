/**
 * UMS Digital Class Logbook - Admin Audit Trail Viewer
 * Milestone 6: Filterable Audit Log Grid, Status Pills & Export Engine
 * Path: src/components/admin/AuditLogViewer.tsx
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { AuditLogEntry, AuditAction } from '../../types/audit';
import {
  getAuditLogs,
  downloadAuditLogsCsv,
  downloadAuditLogsJson,
  formatAuditTimestamp,
  AUDIT_EVENT_NAME,
} from '../../services/auditService';
import { AuditDiffModal } from './AuditDiffModal';
import { Bi } from '../common/Bi';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedCollection, setSelectedCollection] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await getAuditLogs(
        {
          searchQuery: search,
          action: selectedAction !== 'ALL' ? (selectedAction as AuditAction) : undefined,
          targetCollection: selectedCollection !== 'ALL' ? selectedCollection : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        300
      );
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedAction, selectedCollection, startDate, endDate]);

  // Reactive listener for audit events logged anywhere in the application
  useEffect(() => {
    const handleNewAuditLog = () => {
      fetchLogs();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(AUDIT_EVENT_NAME, handleNewAuditLog);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUDIT_EVENT_NAME, handleNewAuditLog);
      }
    };
  }, [selectedAction, selectedCollection, startDate, endDate, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedAction('ALL');
    setSelectedCollection('ALL');
    setStartDate('');
    setEndDate('');
  };

  const getActionBadgeClass = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'UPDATE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'LOGIN':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PASSWORD_CHANGE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rose-50 text-[#8B1A4A] rounded-xl border border-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi="Nhật ký kiểm toán hệ thống (Audit Trail)" en="System Audit Trail" />
            </h2>
            <p className="text-xs text-slate-500">
              <Bi
                vi="Theo dõi chi tiết mọi thay đổi dữ liệu, đăng nhập và an ninh hệ thống"
                en="Track all data modifications, logins, and system security events"
              />
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            data-testid="export-csv-btn"
            onClick={() => downloadAuditLogsCsv(logs)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <Bi vi="Xuất CSV" en="Export CSV" />
          </button>
          <button
            type="button"
            data-testid="export-json-btn"
            onClick={() => downloadAuditLogsJson(logs)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <Bi vi="Xuất JSON" en="Export JSON" />
          </button>
          <button
            type="button"
            data-testid="refresh-audit-btn"
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              data-testid="audit-search-input"
              placeholder="Tìm theo người thực hiện, chi tiết hoặc mã..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#8B1A4A]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Action Filter */}
          <select
            data-testid="audit-action-filter"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#8B1A4A] bg-white cursor-pointer"
          >
            <option value="ALL">Tất cả hành động</option>
            <option value="CREATE">CREATE (Tạo mới)</option>
            <option value="UPDATE">UPDATE (Cập nhật)</option>
            <option value="DELETE">DELETE (Xóa)</option>
            <option value="LOGIN">LOGIN (Đăng nhập)</option>
            <option value="PASSWORD_CHANGE">PASSWORD_CHANGE (Đổi MK)</option>
          </select>

          {/* Collection Filter */}
          <select
            data-testid="audit-collection-filter"
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#8B1A4A] bg-white cursor-pointer"
          >
            <option value="ALL">Tất cả bảng dữ liệu</option>
            <option value="daily_logbooks">Sổ đầu bài (daily_logbooks)</option>
            <option value="periods">Tiết học (periods)</option>
            <option value="behavior_notes">Ghi nhận hành vi (behavior_notes)</option>
            <option value="schedules">Thời khóa biểu (schedules)</option>
            <option value="users">Người dùng (users)</option>
            <option value="auth">Xác thực (auth)</option>
          </select>

          {/* Date range pickers */}
          <div className="flex items-center space-x-1.5">
            <input
              type="date"
              data-testid="audit-start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#8B1A4A]"
              title="Từ ngày"
            />
            <span className="text-xs text-slate-400">-</span>
            <input
              type="date"
              data-testid="audit-end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#8B1A4A]"
              title="Đến ngày"
            />
          </div>

          <button
            type="submit"
            data-testid="audit-submit-search"
            className="px-4 py-2 text-xs font-bold text-white bg-[#8B1A4A] hover:bg-[#74173F] rounded-xl transition cursor-pointer"
          >
            <Bi vi="Tìm kiếm" en="Search" />
          </button>

          <button
            type="button"
            data-testid="audit-reset-filter"
            onClick={handleResetFilters}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <Bi vi="Đặt lại" en="Reset" />
          </button>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Đối tượng</th>
                <th className="py-3 px-4">Nội dung chi tiết</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8B1A4A]" />
                    Đang tải nhật ký kiểm toán...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không tìm thấy bản ghi kiểm toán nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {formatAuditTimestamp(log.timestamp)}
                    </td>

                    {/* Actor */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{log.actorName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <span className="uppercase font-semibold text-slate-500">{log.actorRole}</span>
                        <span>•</span>
                        <span>{log.actorId}</span>
                      </div>
                    </td>

                    {/* Action Pill */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getActionBadgeClass(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Target Collection & ID */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-700">{log.targetCollection}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]" title={log.targetId}>
                        {log.targetId}
                      </div>
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 max-w-xs md:max-w-md text-slate-600 truncate" title={log.details}>
                      {log.details || '-'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        data-testid={`view-diff-btn-${log.id}`}
                        onClick={() => {
                          setSelectedEntry(log);
                          setIsDiffModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#8B1A4A] bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem diff</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Status */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
          <span>Tổng số: <strong className="text-slate-800">{logs.length}</strong> bản ghi</span>
          <span className="text-[11px] text-slate-400">Dữ liệu kiểm toán bảo mật bất biến (Append-Only)</span>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      <AuditDiffModal
        entry={selectedEntry}
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
      />
    </div>
  );
};
