/**
 * UMS Digital Class Logbook - MOET-Standard PDF Export & Print Engine
 * Milestone 5: Authentic 10-Column A4 Landscape Layout & Vector PDF Exporter
 * Path: src/utils/pdfGenerator.ts
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PeriodEntry, StudentAbsenceRecord } from '../types/logbook';

export interface WeeklyLogbookPdfDay {
  dayOfWeek: number; // 2..6 (2 = Thứ Hai, 6 = Thứ Sáu)
  dayNameVi: string;
  date: string; // DD/MM/YYYY
  isoDate?: string; // YYYY-MM-DD
  periods: PrintPeriod[];
}

/** Tiết trên bản in: có thêm cờ "mặc định 10đ" (tiết NN2, Native, Eng 1 K9, test prep K9 chưa ký). */
export type PrintPeriod = PeriodEntry & { printDefault10?: boolean };
export const DEFAULT10_PRINT_NOTE = 'Mặc định 10đ';

/** Bản in: tiết mặc định 10đ chưa ký → điền tổng 10, ghi chú "Mặc định 10đ" ở cột chữ ký (tiết đã ký giữ nguyên). */
export function applyDefault10ToPrint(periods: PrintPeriod[], defaults: Array<{ periodIndex: number; subject: string }>): PrintPeriod[] {
  if (!defaults.length) return periods;
  const out = new Map<number, PrintPeriod>(periods.map((p) => [p.periodIndex, p]));
  for (const d of defaults) {
    const cur = out.get(d.periodIndex);
    if (cur?.isSigned) continue;
    out.set(d.periodIndex, {
      ...(cur || ({ periodIndex: d.periodIndex, lessonTopic: '', absentStudents: [], teacherComment: '' } as unknown as PeriodEntry)),
      subject: cur?.subject || d.subject,
      scores: { ...(cur?.scores || { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0 }), total: 10 },
      teacherSignature: DEFAULT10_PRINT_NOTE,
      isSigned: false,
      printDefault10: true,
    } as PrintPeriod);
  }
  return [...out.values()].sort((a, b) => a.periodIndex - b.periodIndex);
}

export interface WeeklyLogbookPdfData {
  schoolName: string;
  districtName: string;
  academicYear: string;
  classId: string;
  gvcnName: string;
  totalStudents: number;
  weekNumber: number;
  startDate: string; // DD/MM/YYYY or YYYY-MM-DD
  endDate: string; // DD/MM/YYYY or YYYY-MM-DD
  days: WeeklyLogbookPdfDay[];
  summary?: {
    totalPeriodsExpected?: number;
    totalPeriodsTaught?: number;
    totalPeriodsSigned?: number;
    unsignedPeriodsCount?: number;
    /** Số tiết mặc định 10đ chưa ký (không tính là "chưa ký") */
    default10Count?: number;
    unsignedSubjects?: string[];
    attendanceStats?: {
      totalAbsences: number;
      excusedP: number;
      unexcusedK: number;
      late: number;
      earlyDepartures?: number;
    };
    criteriaAverage?: {
      learningAvg: number;
      disciplineAvg: number;
      hygieneAvg: number;
      customAvg: number;
      totalWeeklyScore: number;
    };
    emulationScore?: number;
    emulationStatus?: 'good' | 'standard' | 'warning';
    emulationStatusLabel?: string;
    rank?: number;
    gvcnComments?: string;
    bghComments?: string;
    teacherRemarksSummary?: string;
  };
}

/**
 * Calculates start and end dates for any academic week (Week 1 = 2026-09-07)
 */
/**
 * Gộp tiết từ 2 nguồn cho bản in: Firestore (dữ liệu thật, mọi GV ký trên máy của họ) ưu tiên hơn
 * bản nháp localStorage của máy đang in. Trước đây bản in chỉ đọc localStorage → tiết GV khác ký hiện trống.
 */
export function mergePrintPeriods(local: PeriodEntry[] = [], remote: PeriodEntry[] = []): PeriodEntry[] {
  const byIndex = new Map<number, PeriodEntry>();
  for (const p of local) if (p && typeof p.periodIndex === 'number') byIndex.set(p.periodIndex, p);
  for (const p of remote) {
    if (!p || typeof p.periodIndex !== 'number') continue;
    const cur = byIndex.get(p.periodIndex);
    // Bản nháp trên máy mới hơn bản đã ký trên Firestore thì không được đè chữ ký thật
    if (!cur || p.isSigned || !cur.isSigned || (p.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) byIndex.set(p.periodIndex, p);
  }
  return [...byIndex.values()].sort((a, b) => a.periodIndex - b.periodIndex);
}

export function getWeekDates(weekNumber: number, schoolYearStart = '2026-09-07') {
  const [startY, startM, startD] = schoolYearStart.split('-').map(Number);
  const baseDate = new Date(startY, startM - 1, startD);

  const mondayOffset = (weekNumber - 1) * 7;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() + mondayOffset);

  const days = [0, 1, 2, 3, 4].map((offset, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return {
      dayOfWeek: idx + 2,
      dayNameVi: dayNames[idx],
      date: `${dd}/${mm}/${yyyy}`,
      isoDate: `${yyyy}-${mm}-${dd}`,
    };
  });

  return {
    startDate: days[0].date,
    endDate: days[4].date,
    formattedRange: `Từ ngày ${days[0].date} đến ngày ${days[4].date}`,
    days,
  };
}

/**
 * Formats student absence records for the logbook column
 */
export function formatStudentAbsences(absences: StudentAbsenceRecord[] = []): string {
  if (!absences || absences.length === 0) return 'Đủ';
  const excused = absences.filter((a) => a.type === 'P').map((a) => `${a.studentName} (P)`);
  const unexcused = absences.filter((a) => a.type === 'K').map((a) => `${a.studentName} (K)`);
  const late = absences.filter((a) => a.type === 'Late').map((a) => `${a.studentName} (M)`);

  const parts: string[] = [];
  if (excused.length > 0) parts.push(`CP: ${excused.join(', ')}`);
  if (unexcused.length > 0) parts.push(`KP: ${unexcused.join(', ')}`);
  if (late.length > 0) parts.push(`Muộn: ${late.join(', ')}`);
  return parts.length > 0 ? parts.join('; ') : 'Đủ';
}

/**
 * Safe browser print invocation
 */
export function triggerBrowserPrint(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}

/**
 * Exports authentic MOET weekly logbook table to a downloadable vector PDF document.
 */
export async function exportWeeklyLogbookPdf(
  data: WeeklyLogbookPdfData,
  filename?: string
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header Left Block: Governing Bureau & School Name
  doc.setFontSize(8.5);
  doc.text(data.districtName || 'ỦY BAN NHÂN DÂN QUẬN CẦU GIẤY', 14, 12);
  doc.setFontSize(9.5);
  doc.text(data.schoolName || 'TRƯỜNG THCS NGOẠI NGỮ - ULIS', 14, 17);

  // Header Center Block: Title & Week Span
  doc.setFontSize(12);
  doc.text(
    `SỔ ĐẦU BÀI ĐIỆN TỬ - NĂM HỌC ${data.academicYear || '2026 - 2027'}`,
    148.5,
    12,
    { align: 'center' }
  );
  doc.setFontSize(9.5);
  doc.text(
    `TUẦN ${data.weekNumber} (Từ ngày ${data.startDate} đến ngày ${data.endDate})`,
    148.5,
    17,
    { align: 'center' }
  );

  // Header Right Block: Class, GVCN & Sĩ số
  doc.setFontSize(10.5);
  doc.text(`Lớp: ${data.classId}`, 283, 12, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`GVCN: ${data.gvcnName} • Sĩ số: ${data.totalStudents}`, 283, 17, { align: 'right' });

  // Prepare 40 period rows (5 days x 8 periods)
  const tableRows: any[] = [];
  data.days.forEach((d) => {
    // Ensure all 8 periods are present
    for (let pIdx = 1; pIdx <= 8; pIdx++) {
      const p =
        d.periods.find((item) => item.periodIndex === pIdx) ||
        ({
          periodIndex: pIdx,
          subject: '',
          lessonTopic: '',
          absentStudents: [],
          scores: { learning: 0, discipline: 0, hygiene: 0, customCriterion: 0, total: 0 },
          teacherComment: '',
          teacherSignature: '',
          isSigned: false,
        } as unknown as PeriodEntry);

      const isFirst = pIdx === 1;
      const dayCell = isFirst
        ? {
            content: `${d.dayNameVi}\n${d.date}`,
            rowSpan: 8,
            styles: { halign: 'center' as const, valign: 'middle' as const, fontStyle: 'bold' as const },
          }
        : null;

      const row = [
        dayCell,
        p.periodIndex,
        p.subject || '',
        p.ppctLessonIndex ?? '',
        p.lessonTopic || '',
        formatStudentAbsences(p.absentStudents),
        p.scores?.learning ? p.scores.learning.toFixed(1) : '',
        p.scores?.discipline ? p.scores.discipline.toFixed(1) : '',
        p.scores?.hygiene ? p.scores.hygiene.toFixed(1) : '',
        p.scores?.customCriterion ? p.scores.customCriterion.toFixed(1) : '',
        p.scores?.total ? p.scores.total.toFixed(1) : '',
        p.teacherComment || '',
        p.teacherSignature || '',
      ].filter((cell) => cell !== null);

      tableRows.push(row);
    }
  });

  autoTable(doc, {
    startY: 22,
    margin: { left: 8, right: 8 },
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    head: [
      [
        { content: 'Thứ, ngày', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Tiết', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Môn học', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Tiết PPCT', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Tên bài học, nội dung công việc', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Sĩ số / Vắng mặt\n(P, K, Muộn)', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Điểm số', colSpan: 5, styles: { halign: 'center' } },
        { content: 'Nhận xét của GV bộ môn', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Ký tên', rowSpan: 2, styles: { valign: 'middle' } },
      ],
      [
        { content: 'HT' },
        { content: 'KL' },
        { content: 'VS' },
        { content: 'Khác' },
        { content: 'Tổng' },
      ],
      [
        { content: '[1]' },
        { content: '[2]' },
        { content: '[3]' },
        { content: '[4]' },
        { content: '[5]' },
        { content: '[6]' },
        { content: '[7a]' },
        { content: '[7b]' },
        { content: '[7c]' },
        { content: '[7d]' },
        { content: '[7e]' },
        { content: '[8]' },
        { content: '[9]' },
      ],
    ],
    body: tableRows,
  });

  // Page 2: Weekly Summary, Emulation Standing, Notes & Signatures
  if (data.summary) {
    doc.addPage('a4', 'landscape');

    doc.setFontSize(13);
    doc.text(
      `TỔNG KẾT TUẦN ${data.weekNumber} & ĐÁNH GIÁ THI ĐUA - LỚP ${data.classId}`,
      148.5,
      15,
      { align: 'center' }
    );

    const s = data.summary;
    const summaryRows = [
      ['Tổng số tiết quy định', `${s.totalPeriodsExpected ?? 40} tiết`],
      ['Số tiết đã học / Đã ký', `${s.totalPeriodsTaught ?? 0} tiết / ${s.totalPeriodsSigned ?? 0} tiết`],
      ['Số tiết chưa ký sổ', `${s.unsignedPeriodsCount ?? 0} tiết`],
      ...(s.default10Count ? [['Tiết mặc định 10đ (NN2, Native, Eng 1 K9, test prep K9)', `${s.default10Count} tiết`]] : []),
      [
        'Chuyên cần cả tuần',
        `Nghỉ có phép (P): ${s.attendanceStats?.excusedP ?? 0} | Không phép (K): ${s.attendanceStats?.unexcusedK ?? 0} | Đi muộn: ${s.attendanceStats?.late ?? 0}`,
      ],
      [
        'Điểm trung bình tiêu chí',
        `Học tập: ${s.criteriaAverage?.learningAvg?.toFixed(1) ?? '0.0'} | Kỷ luật: ${s.criteriaAverage?.disciplineAvg?.toFixed(1) ?? '0.0'} | Vệ sinh: ${s.criteriaAverage?.hygieneAvg?.toFixed(1) ?? '0.0'} | Điểm TB tuần: ${s.criteriaAverage?.totalWeeklyScore?.toFixed(2) ?? '0.00'}/10`,
      ],
      [
        'Điểm thi đua tuần (Thang 100)',
        `${s.emulationScore?.toFixed(1) ?? '100.0'}/105 điểm • Xếp hạng: ${s.rank ? `Hạng ${s.rank}/26` : 'Chưa xếp hạng'} • Danh hiệu: ${s.emulationStatusLabel || 'Đạt tiêu chuẩn'}`,
      ],
      ['Ý kiến của GVCN', s.gvcnComments || 'Lớp duy trì tốt nề nếp và kỷ luật trong tuần.'],
    ];

    autoTable(doc, {
      startY: 25,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      head: [['Hạng mục tổng kết', 'Nội dung đánh giá & Số liệu thống kê']],
      body: summaryRows,
    });

    // Formal Signature Blocks at the bottom of Page 2
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 130;
    doc.setFontSize(10);
    doc.text('GIÁO VIÊN CHỦ NHIỆM', 50, finalY, { align: 'center' });
    doc.text('(Ký và ghi rõ họ tên)', 50, finalY + 5, { align: 'center' });
    doc.text(data.gvcnName, 50, finalY + 30, { align: 'center' });

    doc.text('BAN GIÁM HIỆU PHÊ DUYỆT', 240, finalY, { align: 'center' });
    doc.text('(Ký, đóng dấu và ghi rõ họ tên)', 240, finalY + 5, { align: 'center' });
    doc.text('Hiệu trưởng', 240, finalY + 30, { align: 'center' });
  }

  const outName =
    filename || `SoDauBai_Lop_${data.classId}_Tuan_${data.weekNumber}_${data.academicYear || '2026-2027'}.pdf`;

  // In test environment, do not call doc.save if window/download is unavailable
  if (typeof window !== 'undefined' && typeof doc.save === 'function') {
    try {
      doc.save(outName);
    } catch {
      // In virtual test environments doc.save might not trigger physical file write
    }
  }

  return doc;
}
