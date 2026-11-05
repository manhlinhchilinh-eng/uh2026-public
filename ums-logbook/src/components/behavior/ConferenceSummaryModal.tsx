/**
 * UMS Digital Class Logbook - Parent-Teacher Conference Summary Modal
 * Milestone 3: Balanced 2-column positive vs negative display, printable export & 1-click copy
 * Path: src/components/behavior/ConferenceSummaryModal.tsx
 */

import React, { useState, useMemo } from 'react';
import { StudentDoc, BehaviorNote } from '../../types';
import { X, Printer, Copy, Check, FileSpreadsheet, Award, AlertTriangle } from 'lucide-react';

export interface ConferenceSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  notes: BehaviorNote[];
  roster: StudentDoc[];
  gvcnName?: string;
}

export const ConferenceSummaryModal: React.FC<ConferenceSummaryModalProps> = ({
  isOpen,
  onClose,
  classId,
  notes,
  roster,
  gvcnName = 'Giáo viên chủ nhiệm',
}) => {
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [copied, setCopied] = useState<boolean>(false);

  // Group notes per student
  const studentReports = useMemo(() => {
    const map = new Map<
      string,
      { student: StudentDoc; positives: BehaviorNote[]; negatives: BehaviorNote[] }
    >();

    roster.forEach((s) => {
      const key = s.id || s.mhs;
      map.set(key, { student: s, positives: [], negatives: [] });
    });

    notes.forEach((note) => {
      let entry = map.get(note.studentId);
      if (!entry && note.studentCode) {
        entry = map.get(note.studentCode);
      }
      if (entry) {
        if (note.type === 'positive') entry.positives.push(note);
        if (note.type === 'negative') entry.negatives.push(note);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.student.stt - b.student.stt);
  }, [roster, notes]);

  const displayedReports = useMemo(() => {
    if (selectedStudentFilter === 'all') return studentReports;
    return studentReports.filter(
      (r) => r.student.id === selectedStudentFilter || r.student.mhs === selectedStudentFilter
    );
  }, [studentReports, selectedStudentFilter]);

  if (!isOpen) return null;

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Copy Summary Handler (Markdown/Text for Zalo/Email)
  const handleCopySummary = () => {
    let text = `TRƯỜNG THCS NGOẠI NGỮ (UMS) - BÁO CÁO NỀ NẾP LỚP ${classId}\n`;
    text += `Năm học 2026-2027 • GVCN: ${gvcnName}\n\n`;

    displayedReports.forEach(({ student, positives, negatives }) => {
      text += `----------------------------------------\n`;
      text += `STT ${student.stt}: ${student.name} (MHS: ${student.mhs})\n`;
      text += `+ Khen ngợi (${positives.length} lần):\n`;
      if (positives.length === 0) text += `  (Chưa có ghi nhận)\n`;
      else
        positives.forEach(
          (p) =>
            (text += `  - ${p.date || ''}: [${p.category}] ${p.content || p.description} (${p.authorName})\n`)
        );

      text += `- Cần lưu ý / Nhắc nhở (${negatives.length} lần):\n`;
      if (negatives.length === 0) text += `  (Không có vi phạm)\n`;
      else
        negatives.forEach(
          (n) =>
            (text += `  - ${n.date || ''}: [${n.category}] ${n.content || n.description} (${n.authorName})\n`)
        );
      text += `\n`;
    });

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-8 print:my-0 print:border-none print:shadow-none">
        {/* Header - Screen only */}
        <div className="bg-[#8B1A4A] text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-pink-200" />
            <div>
              <h2 className="text-base font-bold">Tổng hợp Báo cáo Họp Phụ Huynh - Lớp {classId}</h2>
              <p className="text-xs text-pink-200">Bảng tổng hợp khen ngợi và rèn luyện nề nếp từng học sinh</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              title="Sao chép tóm tắt gửi Zalo/Email"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã sao chép!' : 'Sao chép Zalo/Email'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white text-[#8B1A4A] hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>In Báo Cáo</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar - Screen only */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-700">Lọc theo học sinh:</label>
            <select
              value={selectedStudentFilter}
              onChange={(e) => setSelectedStudentFilter(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-[#8B1A4A]"
            >
              <option value="all">Toàn bộ lớp ({roster.length} học sinh)</option>
              {roster.map((s) => (
                <option key={s.id || s.mhs} value={s.id || s.mhs}>
                  {s.stt}. {s.name} ({s.mhs})
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Hiển thị: {displayedReports.length} học sinh
          </span>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6 print:max-h-none print:overflow-visible print:p-8">
          {/* Formal School Header */}
          <div className="text-center pb-4 border-b border-slate-300">
            <span className="text-xs uppercase tracking-widest text-slate-600 font-bold block">
              TRƯỜNG THCS NGOẠI NGỮ - ĐẠI HỌC QUỐC GIA HÀ NỘI
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1 uppercase">
              BẢNG TỔNG HỢP NỀ NẾP & RÈN LUYỆN HỌC SINH
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Lớp: <span className="font-bold">{classId}</span> • Năm học: 2026 - 2027 • GVCN:{' '}
              <span className="font-bold">{gvcnName}</span>
            </p>
          </div>

          {/* Student Reports List */}
          <div className="space-y-4">
            {displayedReports.map(({ student, positives, negatives }) => (
              <div
                key={student.id || student.mhs}
                className="rounded-xl border border-slate-200 p-4 bg-white break-inside-avoid print:border-slate-300"
              >
                {/* Student Identity */}
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-[#8B1A4A] text-white text-xs font-bold flex items-center justify-center">
                      {student.stt}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{student.name}</span>
                    <span className="text-xs text-slate-400 font-mono">({student.mhs})</span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-emerald-700 font-bold">Khen ngợi: {positives.length}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-rose-700 font-bold">Nhắc nhở: {negatives.length}</span>
                  </div>
                </div>

                {/* 2-Column Balanced Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Positive Column */}
                  <div className="p-3 bg-emerald-50/40 rounded-lg border border-emerald-100">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800 mb-2">
                      <Award className="w-4 h-4 text-emerald-600" />
                      <span>Khen ngợi & Điểm sáng ({positives.length})</span>
                    </div>

                    {positives.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">Chưa có ghi nhận khen ngợi</p>
                    ) : (
                      <ul className="space-y-2 text-xs text-slate-700">
                        {positives.map((p) => (
                          <li key={p.id} className="pb-1.5 border-b border-emerald-100/60 last:border-b-0">
                            <div className="flex items-center justify-between text-[11px] text-emerald-900 font-semibold mb-0.5">
                              <span>• {p.category}</span>
                              <span className="text-slate-400 font-normal">
                                {p.date} {p.subject ? `(${p.subject})` : ''}
                              </span>
                            </div>
                            <p className="text-slate-600 pl-2">{p.content || p.description}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Negative Column */}
                  <div className="p-3 bg-rose-50/40 rounded-lg border border-rose-100">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-800 mb-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Cần lưu ý & Khắc phục ({negatives.length})</span>
                    </div>

                    {negatives.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">Không có vi phạm ghi nhận</p>
                    ) : (
                      <ul className="space-y-2 text-xs text-slate-700">
                        {negatives.map((n) => (
                          <li key={n.id} className="pb-1.5 border-b border-rose-100/60 last:border-b-0">
                            <div className="flex items-center justify-between text-[11px] text-rose-900 font-semibold mb-0.5">
                              <span>• {n.category}</span>
                              <span className="text-slate-400 font-normal">
                                {n.date} {n.subject ? `(${n.subject})` : ''}
                              </span>
                            </div>
                            <p className="text-slate-600 pl-2">{n.content || n.description}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Teacher Signature Block */}
          <div className="pt-8 flex justify-end print:block">
            <div className="text-center w-64 space-y-1">
              <p className="text-xs text-slate-500 italic">Hà Nội, ngày ..... tháng ..... năm 202...</p>
              <p className="text-xs font-bold text-slate-800 uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
              <div className="h-16" />
              <p className="text-xs font-bold text-slate-900">{gvcnName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
