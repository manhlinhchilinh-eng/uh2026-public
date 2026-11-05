import React, { useState } from 'react';
import { EarlyDepartureRecord } from '../../types/logbook';
import { StudentDoc } from '../../types';
import { validateEarlyDeparture } from '../../utils/attendance';
import { Clock, Plus, Trash2, AlertCircle } from 'lucide-react';

export interface EarlyDepartureSectionProps {
  roster: StudentDoc[];
  earlyDepartures: EarlyDepartureRecord[];
  onChange: (records: EarlyDepartureRecord[]) => void;
  periodIndex?: number;
  readOnly?: boolean;
}

export const EarlyDepartureSection: React.FC<EarlyDepartureSectionProps> = ({
  roster,
  earlyDepartures = [],
  onChange,
  periodIndex,
  readOnly = false,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [departedAt, setDepartedAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    if (!selectedStudentId) {
      setError('Vui lòng chọn học sinh về sớm');
      return;
    }

    const student = roster.find((s) => s.mhs === selectedStudentId || s.id === selectedStudentId);
    if (!student) {
      setError('Không tìm thấy thông tin học sinh trong danh sách lớp');
      return;
    }

    const newRecord: EarlyDepartureRecord = {
      studentId: student.mhs || student.id,
      studentName: student.name,
      studentNumber: student.stt,
      departedAt: departedAt.trim(),
      reason: reason.trim(),
      reportedPeriodIndex: periodIndex,
      timestamp: Date.now(),
    };

    const validation = validateEarlyDeparture(newRecord, earlyDepartures);
    if (!validation.isValid) {
      setError(validation.error || 'Dữ liệu học sinh về sớm không hợp lệ');
      return;
    }

    onChange([...earlyDepartures, newRecord]);
    setSelectedStudentId('');
    setDepartedAt('');
    setReason('');
  };

  const handleRemove = (studentId: string) => {
    onChange(earlyDepartures.filter((r) => r.studentId !== studentId));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
        <Clock className="w-4 h-4 text-blue-600" />
        <span>Ghi nhận học sinh về sớm trong ngày</span>
      </div>

      {!readOnly && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
          {error && (
            <div className="flex items-center space-x-1.5 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label htmlFor="early-departure-student-select" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Học sinh
              </label>
              <select
                id="early-departure-student-select"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-[#8B1A4A]"
              >
                <option value="">-- Chọn học sinh --</option>
                {roster.map((s) => (
                  <option key={s.id || s.mhs} value={s.mhs || s.id}>
                    {s.stt}. {s.name} ({s.mhs})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="early-departure-time-input" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Thời điểm về (HH:mm)
              </label>
              <input
                id="early-departure-time-input"
                type="text"
                value={departedAt}
                onChange={(e) => setDepartedAt(e.target.value)}
                placeholder="09:30"
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-[#8B1A4A]"
              />
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="early-departure-reason-input" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Lý do
              </label>
              <div className="flex space-x-1.5">
                <input
                  id="early-departure-reason-input"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Sốt, phụ huynh đón..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-[#8B1A4A]"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List of early departures */}
      {earlyDepartures.length > 0 ? (
        <div className="space-y-1.5">
          {earlyDepartures.map((r) => (
            <div
              key={r.studentId}
              className="flex items-center justify-between p-2 rounded-lg bg-blue-50/60 border border-blue-100 text-xs text-slate-800"
            >
              <div className="flex items-center space-x-2">
                <span className="font-bold text-blue-900">{r.studentName}</span>
                <span className="text-[11px] text-blue-700 font-medium">({r.departedAt})</span>
                <span className="text-slate-500">— {r.reason}</span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(r.studentId)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  title="Xóa học sinh này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">Chưa có học sinh nào về sớm</p>
      )}
    </div>
  );
};
