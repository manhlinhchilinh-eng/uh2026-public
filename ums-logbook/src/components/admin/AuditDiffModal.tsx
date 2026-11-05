/**
 * UMS Digital Class Logbook - Audit Diff Inspector Modal
 * Displays visual side-by-side or key-level difference inspection
 * Path: src/components/admin/AuditDiffModal.tsx
 */

import React from 'react';
import { X, Shield } from 'lucide-react';
import { AuditLogEntry } from '../../types/audit';
import { computeStateDiff, formatAuditTimestamp } from '../../services/auditService';

export interface AuditDiffModalProps {
  entry: AuditLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditDiffModal: React.FC<AuditDiffModalProps> = ({ entry, isOpen, onClose }) => {
  if (!isOpen || !entry) return null;

  const diffs = computeStateDiff(entry.beforeState, entry.afterState);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-50 text-[#8B1A4A] rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-900">
                Chi tiết sự kiện kiểm toán #{entry.id}
              </h3>
              <p className="text-xs text-slate-500">
                {formatAuditTimestamp(entry.timestamp)} • Thực hiện bởi: <span className="font-semibold text-slate-700">{entry.actorName} ({entry.actorRole})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Metadata Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Hành động</span>
              <span className="font-bold text-slate-800">{entry.action}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Đối tượng</span>
              <span className="font-mono text-slate-800">{entry.targetCollection}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Mã đối tượng</span>
              <span className="font-mono text-slate-800 truncate block" title={entry.targetId}>
                {entry.targetId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Mã người dùng</span>
              <span className="font-mono text-slate-800 truncate block" title={entry.actorId}>
                {entry.actorId}
              </span>
            </div>
          </div>

          {/* Details / Description */}
          {entry.details && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-900">
              <span className="font-bold">Mô tả:</span> {entry.details}
            </div>
          )}

          {/* Diff Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              So sánh thay đổi dữ liệu (Before vs After)
            </h4>

            {diffs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Không có dữ liệu snapshot trước/sau (sự kiện hệ thống hoặc đăng nhập)
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-1/4">Thuộc tính</th>
                      <th className="py-2.5 px-3 w-1/3">Trạng thái trước</th>
                      <th className="py-2.5 px-3 w-1/3">Trạng thái sau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {diffs.map((d) => (
                      <tr
                        key={d.field}
                        className={
                          d.type === 'modified'
                            ? 'bg-blue-50/40'
                            : d.type === 'added'
                            ? 'bg-emerald-50/40'
                            : d.type === 'removed'
                            ? 'bg-rose-50/40'
                            : 'bg-white'
                        }
                      >
                        <td className="py-2 px-3 font-semibold text-slate-700">
                          {d.field}
                          {d.type === 'modified' && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">
                              sửa
                            </span>
                          )}
                          {d.type === 'added' && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded">
                              mới
                            </span>
                          )}
                          {d.type === 'removed' && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-rose-100 text-rose-800 rounded">
                              xóa
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">
                          {d.oldValue !== undefined ? JSON.stringify(d.oldValue) : '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-900 max-w-[200px] truncate">
                          {d.newValue !== undefined ? JSON.stringify(d.newValue) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
