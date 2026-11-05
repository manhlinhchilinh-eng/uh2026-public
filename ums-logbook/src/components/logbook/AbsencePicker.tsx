import React, { useState, useMemo } from 'react';
import { StudentDoc } from '../../types';
import { StudentAbsenceRecord, AttendanceStatus } from '../../types/logbook';
import { Search, X, UserCheck, ShieldCheck } from 'lucide-react';
import { LEAVE_APPROVED_NOTE } from '../../utils/studentLeave';

export interface AbsencePickerProps {
  roster: StudentDoc[];
  absences: StudentAbsenceRecord[];
  onChange: (absences: StudentAbsenceRecord[]) => void;
  readOnly?: boolean;
  showBaselineOrigin?: boolean;
}

export const AbsencePicker: React.FC<AbsencePickerProps> = ({
  roster = [],
  absences = [],
  onChange,
  readOnly = false,
  showBaselineOrigin = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'absent_only' | 'P' | 'K' | 'Late'>('all');

  // Map studentId -> StudentAbsenceRecord
  const absenceMap = useMemo(() => {
    const map = new Map<string, StudentAbsenceRecord>();
    absences.forEach((a) => map.set(a.studentId, a));
    return map;
  }, [absences]);

  const handleStatusChange = (student: StudentDoc, newStatus: AttendanceStatus) => {
    if (readOnly) return;
    const sId = student.mhs || student.id;

    if (newStatus === 'present') {
      // Remove from absences
      const next = absences.filter((a) => a.studentId !== sId);
      onChange(next);
    } else {
      const existing = absenceMap.get(sId);
      const updatedRecord: StudentAbsenceRecord = {
        studentId: sId,
        studentName: student.name,
        studentNumber: student.stt,
        type: newStatus,
        note: existing?.note || '',
        reportedInTier: existing?.reportedInTier || 'period',
        updatedAt: Date.now(),
      };

      const next = absences.filter((a) => a.studentId !== sId);
      next.push(updatedRecord);
      onChange(next);
    }
  };

  const handleNoteChange = (studentId: string, note: string) => {
    if (readOnly) return;
    const existing = absenceMap.get(studentId);
    if (!existing) return;

    const next = absences.map((a) =>
      a.studentId === studentId ? { ...a, note } : a
    );
    onChange(next);
  };

  const handleMarkAllPresent = () => {
    if (readOnly) return;
    onChange([]);
  };

  // Filtered roster
  const filteredRoster = useMemo(() => {
    return roster.filter((student) => {
      const sId = student.mhs || student.id;
      const record = absenceMap.get(sId);
      const status: AttendanceStatus = record ? record.type : 'present';

      // Search filter
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesName = student.name.toLowerCase().includes(term);
        const matchesStt = student.stt.toString() === term;
        const matchesMhs = (student.mhs || '').toLowerCase().includes(term);
        if (!matchesName && !matchesStt && !matchesMhs) return false;
      }

      // Tab filter
      if (filterTab === 'absent_only') {
        return status !== 'present';
      }
      if (filterTab === 'P' || filterTab === 'K' || filterTab === 'Late') {
        return status === filterTab;
      }
      return true;
    });
  }, [roster, absenceMap, searchTerm, filterTab]);

  const pCount = absences.filter((a) => a.type === 'P').length;
  const kCount = absences.filter((a) => a.type === 'K').length;
  const lateCount = absences.filter((a) => a.type === 'Late').length;

  return (
    <div className="space-y-3">
      {/* Top action & search bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo họ tên hoặc STT..."
            className="w-full text-xs pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#8B1A4A]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Đánh dấu cả lớp có mặt</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
            filterTab === 'all'
              ? 'bg-[#8B1A4A] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Tất cả ({roster.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('absent_only')}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
            filterTab === 'absent_only'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Vắng & Muộn ({absences.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('P')}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
            filterTab === 'P'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Có phép - P ({pCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('K')}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
            filterTab === 'K'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Không phép - K ({kCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('Late')}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
            filterTab === 'Late'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Đi muộn ({lateCount})
        </button>
      </div>

      {/* Roster list */}
      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-72 overflow-y-auto bg-white">
        {filteredRoster.length > 0 ? (
          filteredRoster.map((student) => {
            const sId = student.mhs || student.id;
            const record = absenceMap.get(sId);
            const currentStatus: AttendanceStatus = record ? record.type : 'present';

            return (
              <div key={sId} className="p-2.5 hover:bg-slate-50/80 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 text-center text-xs font-bold text-slate-400">
                      {student.stt}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-800">{student.name}</span>
                      <span className="text-[11px] text-slate-400 ml-2">({student.mhs})</span>
                      {showBaselineOrigin && record?.reportedInTier === 'baseline' && (
                        <span className="ml-2 inline-flex items-center space-x-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          <ShieldCheck className="w-3 h-3 text-slate-500" />
                          <span>GVCN báo đầu giờ</span>
                        </span>
                      )}
                      {record?.note === LEAVE_APPROVED_NOTE && (
                        <span
                          data-testid={`leave-badge-${sId}`}
                          title="Đơn PH đã duyệt · Approved parent leave"
                          className="ml-2 inline-flex items-center text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200 font-semibold"
                        >
                          Đơn PH
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4 Status Segment Buttons */}
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => handleStatusChange(student, 'present')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        currentStatus === 'present'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Có mặt
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => handleStatusChange(student, 'P')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        currentStatus === 'P'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      P
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => handleStatusChange(student, 'K')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        currentStatus === 'K'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      K
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => handleStatusChange(student, 'Late')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        currentStatus === 'Late'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Muộn
                    </button>
                  </div>
                </div>

                {/* Inline Note Drawer when absent or late */}
                {currentStatus !== 'present' && (
                  <div className="mt-2 pl-8 pr-2">
                    <input
                      type="text"
                      disabled={readOnly}
                      value={record?.note || ''}
                      onChange={(e) => handleNoteChange(sId, e.target.value)}
                      placeholder="Lý do vắng / ghi chú (ví dụ: Sốt, gia đình có việc...)"
                      className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#8B1A4A]"
                    />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">
            Không tìm thấy học sinh nào phù hợp bộ lọc
          </div>
        )}
      </div>
    </div>
  );
};
