/**
 * UMS Digital Class Logbook - Behavior Notes Filter Component
 * Milestone 3: Rich multi-axis filter toolbar
 * Path: src/components/behavior/BehaviorNotesFilter.tsx
 */

import React, { useState } from 'react';
import { BehaviorNotesFilterState } from '../../hooks/useBehaviorNotes';
import { StudentDoc, BehaviorType } from '../../types';
import { Search, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export interface BehaviorNotesFilterProps {
  filters: BehaviorNotesFilterState;
  onChange: (newFilters: BehaviorNotesFilterState) => void;
  onReset: () => void;
  roster?: StudentDoc[];
}

export const BehaviorNotesFilter: React.FC<BehaviorNotesFilterProps> = ({
  filters,
  onChange,
  onReset,
  roster = [],
}) => {
  const [showCustomDates, setShowCustomDates] = useState(filters.dateRange === 'custom');
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);

  const handleDatePreset = (range: BehaviorNotesFilterState['dateRange']) => {
    setShowCustomDates(range === 'custom');
    onChange({ ...filters, dateRange: range });
  };

  const handleTypeChange = (type: 'all' | BehaviorType) => {
    onChange({ ...filters, type, category: 'all' });
  };

  const activeFiltersCount = [
    filters.dateRange !== 'all',
    filters.studentId !== 'all',
    filters.type !== 'all',
    filters.category !== 'all',
    filters.authorRole !== 'all',
    filters.searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
      {/* Search Bar & Mobile Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên học sinh, người ghi nhận, nội dung..."
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            className="w-full text-xs font-medium pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#8B1A4A]"
          />
        </div>

        {/* Active Filters Counter & Reset Button */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center space-x-1 shrink-0"
            title="Đặt lại bộ lọc"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đặt lại ({activeFiltersCount})</span>
          </button>
        )}

        {/* Mobile Toggle Button */}
        <button
          type="button"
          onClick={() => setIsExpandedMobile(!isExpandedMobile)}
          className="sm:hidden p-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          aria-label="Mở rộng bộ lọc"
        >
          {isExpandedMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Filter Controls */}
      <div className={`space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3 ${isExpandedMobile ? 'block' : 'hidden sm:flex'}`}>
        {/* Date Presets */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
          {(['all', 'today', 'week', 'month', 'custom'] as const).map((range) => {
            const labels = {
              all: 'Tất cả',
              today: 'Hôm nay',
              week: 'Tuần này',
              month: 'Tháng này',
              custom: 'Tùy chọn',
            };
            return (
              <button
                key={range}
                type="button"
                onClick={() => handleDatePreset(range)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filters.dateRange === range
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {labels[range]}
              </button>
            );
          })}
        </div>

        {/* Custom Date Pickers */}
        {showCustomDates && (
          <div className="flex items-center space-x-1.5 text-xs">
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
              className="text-xs p-1.5 border border-slate-200 rounded-md"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
              className="text-xs p-1.5 border border-slate-200 rounded-md"
            />
          </div>
        )}

        {/* Type Toggle */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => handleTypeChange('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              filters.type === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả loại
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('positive')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
              filters.type === 'positive'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Khen ngợi
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('negative')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
              filters.type === 'negative'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            Nhắc nhở
          </button>
        </div>

        {/* Student Dropdown */}
        <select
          value={filters.studentId}
          onChange={(e) => onChange({ ...filters, studentId: e.target.value })}
          className="text-xs font-medium border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#8B1A4A]"
        >
          <option value="all">Tất cả học sinh ({roster.length})</option>
          {roster.map((s) => (
            <option key={s.id || s.mhs} value={s.id || s.mhs}>
              {s.stt}. {s.name}
            </option>
          ))}
        </select>

        {/* Author Role Dropdown */}
        <select
          value={filters.authorRole}
          onChange={(e) => onChange({ ...filters, authorRole: e.target.value as any })}
          className="text-xs font-medium border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#8B1A4A]"
        >
          <option value="all">Tất cả người ghi</option>
          <option value="gvcn">GVCN</option>
          <option value="gvbm">GVBM</option>
          <option value="tpt">Tổng phụ trách</option>
          <option value="admin">Ban Giám Hiệu</option>
        </select>
      </div>
    </div>
  );
};
