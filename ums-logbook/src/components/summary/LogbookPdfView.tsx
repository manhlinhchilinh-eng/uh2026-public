/**
 * UMS Digital Class Logbook - MOET A4 Landscape Logbook Printable View
 * Milestone 5: Authentic 10-Column Traditional Layout & Signature Verification Block
 * Path: src/components/summary/LogbookPdfView.tsx
 */

import React from 'react';
import { WeeklyLogbookPdfData, formatStudentAbsences, type PrintPeriod } from '../../utils/pdfGenerator';
import { PeriodEntry } from '../../types/logbook';

export interface LogbookPdfViewProps {
  data: WeeklyLogbookPdfData;
}

export const LogbookPdfView: React.FC<LogbookPdfViewProps> = ({ data }) => {
  const days = data.days || [];
  const s = data.summary;

  return (
    <div
      id="moet-print-area"
      className="bg-white text-black p-4 max-w-[1122px] mx-auto print:p-0 print:m-0 font-serif"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* ================= PAGE 1: 40-PERIOD TABLE ================= */}
      <div className="w-full">
        {/* Official MOET Header Block */}
        <div className="flex justify-between items-start pb-2 border-b-2 border-black mb-3">
          {/* Left Block */}
          <div className="text-left w-1/3">
            <p className="text-[10px] uppercase font-bold tracking-wider leading-tight">
              {data.districtName || 'UBND QUẬN CẦU GIẤY'}
            </p>
            <p className="text-[11px] uppercase font-black text-ums-900 leading-tight">
              {data.schoolName || 'TRƯỜNG THCS NGOẠI NGỮ'}
            </p>
          </div>

          {/* Center Block */}
          <div className="text-center w-1/3">
            <h1 className="text-sm font-black uppercase tracking-wider leading-tight">
              SỔ ĐẦU BÀI ĐIỆN TỬ
            </h1>
            <p className="text-[10px] font-bold uppercase mt-0.5 leading-tight">
              NĂM HỌC {data.academicYear || '2026 - 2027'}
            </p>
            <p className="text-[10px] italic font-semibold mt-0.5">
              TUẦN {data.weekNumber} (Từ ngày {data.startDate} đến ngày {data.endDate})
            </p>
          </div>

          {/* Right Block */}
          <div className="text-right w-1/3">
            <p className="text-xs font-black uppercase">
              Lớp: <span className="underline">{data.classId}</span>
            </p>
            <p className="text-[10px] font-semibold">
              GVCN: {data.gvcnName || 'Chưa phân công'}
            </p>
            <p className="text-[10px] text-slate-700">
              Sĩ số: {data.totalStudents || 26} học sinh
            </p>
          </div>
        </div>

        {/* 10-Column Authentic MOET Table */}
        <div className="overflow-x-auto">
          <table className="moet-logbook-table w-full border-collapse border border-black text-[9px] leading-tight">
            <thead>
              <tr className="bg-slate-100 text-black text-center font-bold">
                <th rowSpan={2} className="border border-black p-1 w-[7%]">
                  Thứ, ngày
                </th>
                <th rowSpan={2} className="border border-black p-1 w-[3%]">
                  Tiết
                </th>
                <th rowSpan={2} className="border border-black p-1 w-[8%]">
                  Môn học
                </th>
                <th rowSpan={2} className="border border-black p-1 w-[4%]">
                  Tiết PPCT
                </th>
                <th rowSpan={2} className="border border-black p-1 w-[26%]">
                  Tên bài học, nội dung công việc
                </th>
                <th rowSpan={2} className="border border-black p-1 w-[12%]">
                  Sĩ số / Vắng mặt
                </th>
                <th colSpan={5} className="border border-black p-1 w-[16%]">
                  Điểm số
                </th>
                <th rowSpan={2} className="border border-black p-1 w-[16%]">
                  Nhận xét của GV bộ môn
                </th>
                <th rowSpan={2} className="border border-black p-1 w-[8%]">
                  Ký tên
                </th>
              </tr>
              <tr className="bg-slate-50 text-black text-center font-bold text-[8px]">
                <th className="border border-black p-0.5">HT (4)</th>
                <th className="border border-black p-0.5">KL (3)</th>
                <th className="border border-black p-0.5">VS (2)</th>
                <th className="border border-black p-0.5">Khác (1)</th>
                <th className="border border-black p-0.5 bg-slate-200">Tổng (10)</th>
              </tr>
              {/* MOET Official Column Numbering Row */}
              <tr className="bg-slate-200 text-black text-center text-[7.5px] italic font-semibold">
                <th className="border border-black p-0.5">[1]</th>
                <th className="border border-black p-0.5">[2]</th>
                <th className="border border-black p-0.5">[3]</th>
                <th className="border border-black p-0.5">[4]</th>
                <th className="border border-black p-0.5">[5]</th>
                <th className="border border-black p-0.5">[6]</th>
                <th className="border border-black p-0.5">[7a]</th>
                <th className="border border-black p-0.5">[7b]</th>
                <th className="border border-black p-0.5">[7c]</th>
                <th className="border border-black p-0.5">[7d]</th>
                <th className="border border-black p-0.5 bg-slate-300">[7e]</th>
                <th className="border border-black p-0.5">[8]</th>
                <th className="border border-black p-0.5">[9]</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dayPeriods = day.periods || [];
                return [1, 2, 3, 4, 5, 6, 7, 8].map((pIdx) => {
                  const entry = dayPeriods.find((p) => p.periodIndex === pIdx) || ({
                    periodIndex: pIdx,
                    subject: '',
                    lessonTopic: '',
                    absentStudents: [],
                    scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
                    teacherComment: '',
                    teacherSignature: '',
                    isSigned: false,
                  } as unknown as PeriodEntry);

                  const isMorningEnd = pIdx === 4;
                  const borderClass = isMorningEnd ? 'border-b-2 border-black' : '';

                  return (
                    <tr
                      key={`${day.dayOfWeek}-${pIdx}`}
                      className={`hover:bg-slate-50 ${borderClass}`}
                    >
                      {/* Day Cell spanning 8 periods */}
                      {pIdx === 1 && (
                        <td
                          rowSpan={8}
                          className="border border-black p-1 text-center font-bold align-middle bg-slate-50"
                        >
                          <div className="font-bold text-[10px] text-slate-900">{day.dayNameVi}</div>
                          <div className="text-[8px] text-slate-600 mt-0.5">{day.date}</div>
                        </td>
                      )}

                      {/* Period Index */}
                      <td className="border border-black p-1 text-center font-bold">
                        {pIdx}
                      </td>

                      {/* Subject */}
                      <td className="border border-black p-1 font-semibold text-slate-900">
                        {entry.subject || ''}
                      </td>

                      {/* PPCT */}
                      <td className="border border-black p-1 text-center">
                        {entry.ppctLessonIndex ?? ''}
                      </td>

                      {/* Topic */}
                      <td className="border border-black p-1 text-left">
                        {entry.lessonTopic || ''}
                      </td>

                      {/* Absences */}
                      <td className="border border-black p-1 text-left text-[8px]">
                        {formatStudentAbsences(entry.absentStudents)}
                      </td>

                      {/* Scores */}
                      <td className="border border-black p-1 text-center">
                        {entry.isSigned && entry.scores?.learning ? entry.scores.learning.toFixed(1) : ''}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {entry.isSigned && entry.scores?.discipline ? entry.scores.discipline.toFixed(1) : ''}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {entry.isSigned && entry.scores?.hygiene ? entry.scores.hygiene.toFixed(1) : ''}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {entry.isSigned && entry.scores?.customCriterion ? entry.scores.customCriterion.toFixed(1) : ''}
                      </td>
                      <td className="border border-black p-1 text-center font-bold bg-slate-100">
                        {(entry.isSigned || (entry as PrintPeriod).printDefault10) && entry.scores?.total ? entry.scores.total.toFixed(1) : ''}
                      </td>

                      {/* Teacher Comment */}
                      <td className="border border-black p-1 text-left italic">
                        {entry.teacherComment || ''}
                      </td>

                      {/* Teacher Signature */}
                      <td className="border border-black p-1 text-center font-medium">
                        {entry.teacherSignature || (entry.isSigned ? entry.teacherName : '')}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= PAGE 2: WEEKLY SUMMARY & EMULATION BOX ================= */}
      {s && (
        <div className="moet-page-break mt-6 pt-4 border-t-2 border-black">
          <div className="text-center mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider">
              TỔNG KẾT TUẦN {data.weekNumber} & ĐÁNH GIÁ THI ĐUA NỀ NẾP • HỌC TẬP
            </h2>
            <p className="text-[9px] italic text-slate-700">
              Lớp {data.classId} — Năm học {data.academicYear || '2026 - 2027'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[9px] mb-4">
            {/* Box 1: Tổng số tiết & Chuyên cần */}
            <div className="border border-black p-2 rounded-xs">
              <h3 className="font-bold uppercase text-[9px] mb-1.5 border-b border-black pb-0.5">
                1. Tình hình học tập & Chuyên cần
              </h3>
              <ul className="space-y-1">
                <li>• Tổng số tiết quy định: <strong>{s.totalPeriodsExpected ?? 40}</strong> tiết</li>
                <li>• Số tiết đã dạy & ký sổ: <strong>{s.totalPeriodsSigned ?? 0}</strong> tiết</li>
                <li>• Số tiết chưa ký sổ: <strong className={s.unsignedPeriodsCount ? 'text-rose-600' : ''}>{s.unsignedPeriodsCount ?? 0}</strong> tiết</li>
                {!!s.default10Count && <li>• Tiết mặc định 10đ (NN2, Native, Eng 1 K9, test prep K9): <strong>{s.default10Count}</strong> tiết</li>}
                <li>• Nghỉ có phép (P): <strong>{s.attendanceStats?.excusedP ?? 0}</strong> lượt</li>
                <li>• Nghỉ không phép (K): <strong className={s.attendanceStats?.unexcusedK ? 'text-rose-600' : ''}>{s.attendanceStats?.unexcusedK ?? 0}</strong> lượt</li>
                <li>• Đi muộn (M): <strong>{s.attendanceStats?.late ?? 0}</strong> lượt</li>
              </ul>
            </div>

            {/* Box 2: Điểm trung bình & Thi đua */}
            <div className="border border-black p-2 rounded-xs">
              <h3 className="font-bold uppercase text-[9px] mb-1.5 border-b border-black pb-0.5">
                2. Điểm trung bình & Xếp hạng thi đua
              </h3>
              <ul className="space-y-1">
                <li>
                  • Điểm TB Tiêu chí: Học tập: <strong>{s.criteriaAverage?.learningAvg?.toFixed(1) ?? '0.0'}</strong> | Kỷ luật: <strong>{s.criteriaAverage?.disciplineAvg?.toFixed(1) ?? '0.0'}</strong> | Vệ sinh: <strong>{s.criteriaAverage?.hygieneAvg?.toFixed(1) ?? '0.0'}</strong>
                </li>
                <li>
                  • Điểm TB các tiết học: <strong>{s.criteriaAverage?.totalWeeklyScore?.toFixed(2) ?? '0.00'}</strong> / 10 điểm
                </li>
                <li>
                  • Điểm thi đua tuần: <strong>{s.emulationScore?.toFixed(1) ?? '100.0'}</strong> / 105 điểm
                </li>
                <li>
                  • Xếp hạng toàn trường: <strong>{s.rank ? `Hạng ${s.rank}/26` : 'Chưa xếp hạng'}</strong>
                </li>
                <li>
                  • Danh hiệu: <strong>{s.emulationStatusLabel || 'Đạt tiêu chuẩn'}</strong>
                </li>
              </ul>
            </div>
          </div>

          {/* Ý kiến của GVCN */}
          <div className="border border-black p-2 rounded-xs text-[9px] mb-6">
            <h3 className="font-bold uppercase mb-1">3. Ý kiến & Nhận xét của Giáo viên chủ nhiệm</h3>
            <p className="italic text-slate-800 min-h-[30px]">
              {s.gvcnComments || 'Lớp duy trì nề nếp học tập nghiêm túc, tham gia tích cực các hoạt động của nhà trường.'}
            </p>
          </div>

          {/* Dual Formal Signature Blocks */}
          <div className="flex justify-between items-start text-center text-[10px] mt-8 pt-4">
            <div className="w-1/2">
              <p className="font-bold uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
              <p className="italic text-[8px] text-slate-600">(Ký và ghi rõ họ tên)</p>
              <div className="h-16 flex items-end justify-center font-bold">
                {data.gvcnName || ''}
              </div>
            </div>

            <div className="w-1/2">
              <p className="font-bold uppercase">BAN GIÁM HIỆU PHÊ DUYỆT</p>
              <p className="italic text-[8px] text-slate-600">(Ký, đóng dấu và ghi rõ họ tên)</p>
              <div className="h-16 flex items-end justify-center font-bold">
                Hiệu trưởng
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
