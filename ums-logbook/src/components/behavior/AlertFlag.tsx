/**
 * UMS Digital Class Logbook - Early Warning Alert Flag Badge
 * Milestone 3: Pulsing alert badge with detailed reason tooltips
 * Path: src/components/behavior/AlertFlag.tsx
 */

import React, { useState } from 'react';
import {
  EarlyWarningAlert,
  EarlyWarningLevel,
  EarlyWarningReason,
} from '../../types/earlyWarning';
import { AlertTriangle, AlertOctagon, Info } from 'lucide-react';

export interface AlertFlagProps {
  alert?: EarlyWarningAlert;
  level?: EarlyWarningLevel;
  reasons?: EarlyWarningReason[];
  compact?: boolean;          // Icon-only badge with ping dot (ideal for tight table rows)
  showTooltip?: boolean;      // Default: true
  onClick?: () => void;
  className?: string;
}

export const AlertFlag: React.FC<AlertFlagProps> = ({
  alert,
  level: explicitLevel,
  reasons: explicitReasons,
  compact = false,
  showTooltip = true,
  onClick,
  className = '',
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const effectiveLevel: EarlyWarningLevel = explicitLevel || alert?.level || 'warning';
  const effectiveReasons: EarlyWarningReason[] = explicitReasons || alert?.reasons || [];
  const isCritical = effectiveLevel === 'critical';

  const titleText = isCritical ? 'Cảnh báo nghiêm trọng (Kép)' : 'Cảnh báo chuyên cần / nề nếp';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
      onFocus={() => setIsTooltipVisible(true)}
      onBlur={() => setIsTooltipVisible(false)}
    >
      <button
        type="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        aria-label={`${titleText}. Nhấn để xem hồ sơ.`}
        className={`inline-flex items-center rounded-full font-bold transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-offset-1 ${
          compact ? 'p-1' : 'px-2 py-0.5 text-[11px]'
        } ${
          isCritical
            ? 'bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100 focus:ring-rose-500'
            : 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 focus:ring-amber-500'
        }`}
      >
        {/* Pulsing Beacon Indicator */}
        <span className="relative flex h-2 w-2 mr-1">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isCritical ? 'bg-rose-400' : 'bg-amber-400'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isCritical ? 'bg-rose-600' : 'bg-amber-500'
            }`}
          />
        </span>

        {/* Icon */}
        {isCritical ? (
          <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-600" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
        )}

        {/* Label (if not compact) */}
        {!compact && (
          <span className="ml-1 select-none">
            {isCritical ? 'Khẩn cấp' : 'Cảnh báo'}
          </span>
        )}
      </button>

      {/* Accessible Floating Tooltip */}
      {showTooltip && isTooltipVisible && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs space-y-1.5 animate-in fade-in zoom-in-95 pointer-events-none"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-700">
            <span
              className={`font-bold uppercase tracking-wider text-[10px] ${
                isCritical ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {titleText}
            </span>
            {alert?.periodRange && (
              <span className="text-[10px] text-slate-400">
                {alert.periodRange.startDate} → {alert.periodRange.endDate}
              </span>
            )}
          </div>

          {effectiveReasons.length > 0 ? (
            <ul className="space-y-1 text-[11px] text-slate-200">
              {effectiveReasons.map((r, idx) => (
                <li key={idx} className="flex items-start space-x-1.5">
                  <span className={isCritical ? 'text-rose-400' : 'text-amber-400'}>•</span>
                  <span>
                    {r.type === 'unexcused_absences'
                      ? `${r.count} buổi vắng không phép (K)`
                      : `${r.count} lần ghi nhận vi phạm nề nếp`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-300">
              Học sinh đạt ngưỡng kích hoạt cảnh báo sớm.
            </p>
          )}

          {onClick && (
            <div className="pt-1 text-[10px] text-slate-400 flex items-center space-x-1 border-t border-slate-800">
              <Info className="w-3 h-3 text-pink-300" />
              <span>Nhấn để xem hồ sơ & lịch sử chi tiết</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
