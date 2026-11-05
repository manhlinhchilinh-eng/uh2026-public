/**
 * UMS Digital Class Logbook - Behavior Note Card Component
 * Milestone 3: Note item with emerald/rose pills & role badges
 * Path: src/components/behavior/BehaviorNoteCard.tsx
 */

import React from 'react';
import { BehaviorNote } from '../../types';
import { ThumbsUp, AlertTriangle, Clock, Trash2, Tag } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export interface BehaviorNoteCardProps {
  note: BehaviorNote;
  canDelete?: boolean;
  onDelete?: (noteId: string) => Promise<void>;
  onStudentClick?: (studentId: string) => void;
}

export const BehaviorNoteCard: React.FC<BehaviorNoteCardProps> = ({
  note,
  canDelete = false,
  onDelete,
  onStudentClick,
}) => {
  const { t } = useLanguage();
  const isPositive = note.type === 'positive';

  // Role tag formatter
  const renderRoleBadge = () => {
    switch (note.authorRole) {
      case 'gvbm':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            [GVBM {note.subject ? `${note.subject}` : ''}]
          </span>
        );
      case 'giamthi':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
            [Giám thị]
          </span>
        );
      case 'tpt':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            [TPT]
          </span>
        );
      case 'gvcn':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            [GVCN]
          </span>
        );
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            [QTV]
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
            [{note.authorRole?.toUpperCase() || 'GV'}]
          </span>
        );
    }
  };

  const rawTime = note.createdAt || note.timestamp;
  const formattedTime = rawTime
    ? new Date(rawTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';
  const formattedDate = note.date || (rawTime ? new Date(rawTime).toLocaleDateString('vi-VN') : '');

  return (
    <div
      className={`rounded-xl border p-4 transition-all shadow-xs hover:shadow-md bg-white ${
        isPositive ? 'border-emerald-100 hover:border-emerald-300' : 'border-rose-100 hover:border-rose-300'
      }`}
    >
      {/* Top Header Strip */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center space-x-2">
          {/* Positive / Negative Pill Badge */}
          {isPositive ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{t.behavior.positive}</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t.behavior.negative}</span>
            </span>
          )}

          {/* Category Badge */}
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
            <Tag className="w-3 h-3 text-slate-400" />
            <span>{note.category}</span>
          </span>
        </div>

        {/* Delete Action */}
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn xóa phiếu ghi nhận này?')) {
                onDelete(note.id);
              }
            }}
            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
            title="Xóa ghi nhận"
            aria-label="Xóa ghi nhận"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Student Identity Line */}
      <div className="flex items-baseline justify-between mb-2">
        <button
          type="button"
          onClick={() => onStudentClick && onStudentClick(note.studentId)}
          className="text-left font-bold text-slate-900 hover:text-[#8B1A4A] transition-colors flex items-center space-x-1.5"
        >
          <span className="text-sm sm:text-base">{note.studentName}</span>
          {note.studentNumber && (
            <span className="text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
              #{note.studentNumber}
            </span>
          )}
          <span className="text-xs text-slate-400">({note.classId})</span>
        </button>

        {/* In-Period Context Tag */}
        {note.periodIndex !== undefined && (
          <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Tiết {note.periodIndex}</span>
            {note.subject && <span>• {note.subject}</span>}
          </span>
        )}
      </div>

      {/* Description / Content */}
      <p className="text-xs sm:text-sm text-slate-700 bg-slate-50/70 p-3 rounded-lg border border-slate-100 mb-3 whitespace-pre-wrap leading-relaxed">
        {note.content || note.description}
      </p>

      {/* Footer Attribution Strip */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center space-x-2">
          {renderRoleBadge()}
          <span className="font-semibold text-slate-700">{note.authorName}</span>
        </div>

        <div className="text-[11px] text-slate-400 font-medium">
          {formattedTime && <span>{formattedTime} • </span>}
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};
