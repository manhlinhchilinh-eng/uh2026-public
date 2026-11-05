/**
 * UMS Digital Class Logbook - Class Early Warning Alert Banner
 * Milestone 3: High-visibility collapsible dashboard banner summarizing flagged students
 * Path: src/components/behavior/EarlyWarningBanner.tsx
 */

import React, { useState } from 'react';
import { EarlyWarningAlert } from '../../types/earlyWarning';
import {
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  User,
  Plus,
  AlertOctagon,
  AlertTriangle,
} from 'lucide-react';

export interface EarlyWarningBannerProps {
  alerts: EarlyWarningAlert[];
  onSelectStudent?: (studentId: string) => void;
  onCreateNote?: (studentId: string, studentName: string, classId: string) => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export const EarlyWarningBanner: React.FC<EarlyWarningBannerProps> = ({
  alerts = [],
  onSelectStudent,
  onCreateNote,
  collapsible = true,
  defaultExpanded = true,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  const criticalCount = alerts.filter((a) => a.level === 'critical').length;
  const warningCount = alerts.filter((a) => a.level === 'warning').length;

  // Calm State: No active alerts
  if (alerts.length === 0) {
    return (
      <div
        className={`bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between shadow-xs ${className}`}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-emerald-900">
              Tình hình nề nếp ổn định
            </h4>
            <p className="text-[11px] sm:text-xs text-emerald-700">
              100% học sinh đạt chuẩn chuyên cần và nề nếp trong 7 ngày gần nhất.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-block px-3 py-1 bg-white text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold">
          Chuẩn UMS
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden shadow-sm ${
        criticalCount > 0 ? 'bg-rose-50/40 border-rose-200' : 'bg-amber-50/40 border-amber-200'
      } ${className}`}
    >
      {/* Top Banner Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center space-x-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              criticalCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                Cảnh báo sớm: Phát hiện {alerts.length} học sinh cần can thiệp nề nếp & chuyên cần
              </h3>
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white animate-pulse">
                  {criticalCount} khẩn cấp
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                  {warningCount} cảnh báo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Dữ liệu trong 7 ngày gần nhất (ngưỡng: &ge; 3 buổi vắng không phép hoặc &ge; 3 vi phạm).
            </p>
          </div>
        </div>

        {/* Toggle Button */}
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="self-end sm:self-center px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Thu gọn' : `Xem chi tiết (${alerts.length})`}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Collapsible Card List */}
      {isExpanded && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60">
            {alerts.map((alert) => {
              const isCrit = alert.level === 'critical';
              const absenceReason = alert.reasons.find((r) => r.type === 'unexcused_absences');
              const noteReason = alert.reasons.find((r) => r.type === 'negative_notes');

              return (
                <div
                  key={`${alert.classId}_${alert.studentId}`}
                  className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3"
                >
                  {/* Student Title & Badge */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Lớp {alert.classId} {alert.studentNumber ? `• STT ${alert.studentNumber}` : ''}
                      </span>
                      {isCrit ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertOctagon className="w-3 h-3 text-rose-600" />
                          <span>Khẩn cấp</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Cảnh báo</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {alert.studentName}
                    </h4>

                    {/* Trigger Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {absenceReason && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          {absenceReason.count} buổi vắng K
                        </span>
                      )}
                      {noteReason && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                          {noteReason.count} vi phạm nề nếp
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 text-xs">
                    {onCreateNote && (
                      <button
                        type="button"
                        onClick={() => onCreateNote(alert.studentId, alert.studentName, alert.classId)}
                        className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-semibold flex items-center space-x-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ghi nhận</span>
                      </button>
                    )}
                    {onSelectStudent && (
                      <button
                        type="button"
                        onClick={() => onSelectStudent(alert.studentId)}
                        className="px-3 py-1 bg-[#8B1A4A] text-white hover:bg-[#72153c] rounded-lg font-bold flex items-center space-x-1 shadow-2xs transition-colors"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Xem hồ sơ</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
