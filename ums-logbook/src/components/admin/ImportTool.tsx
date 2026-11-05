import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import {
  ImportType,
  StudentRosterValidationReport,
  ScheduleValidationReport,
} from '../../types/importer';
import {
  parseExcelOrCsvFile,
  validateStudentRosterImport,
  validateScheduleImport,
  downloadStudentRosterTemplate,
  downloadScheduleTemplate,
  commitStudentRoster,
  commitSchedule,
} from '../../utils/importer';
import { getDayOfWeekVi } from '../../utils/schedule';
import { ALL_CLASSES } from '../../services/seedService';

interface ImportToolProps {
  initialType?: ImportType;
}

export const ImportTool: React.FC<ImportToolProps> = ({ initialType = 'students' }) => {
  const [activeTab, setActiveTab] = useState<ImportType>(initialType);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Validation reports
  const [studentReport, setStudentReport] = useState<StudentRosterValidationReport | null>(null);
  const [scheduleReport, setScheduleReport] = useState<ScheduleValidationReport | null>(null);

  // Filters for preview
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setStudentReport(null);
    setScheduleReport(null);
    setCommitSuccess(null);
    setCommitProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTabChange = (tab: ImportType) => {
    setActiveTab(tab);
    resetState();
  };

  const handleProcessFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('Kích thước file không được vượt quá 10MB');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    setCommitSuccess(null);

    try {
      const parsed = await parseExcelOrCsvFile(file);

      if (parsed.type === 'students' || (activeTab === 'students' && parsed.studentRows)) {
        setActiveTab('students');
        const report = validateStudentRosterImport(parsed.studentRows || []);
        setStudentReport(report);
      } else if (parsed.type === 'schedule' || (activeTab === 'schedule' && parsed.scheduleRows)) {
        setActiveTab('schedule');
        const report = validateScheduleImport(parsed.scheduleRows || []);
        setScheduleReport(report);
      }
    } catch (err: any) {
      alert(`Lỗi khi đọc file: ${err.message || 'Định dạng file không hỗ trợ'}`);
      resetState();
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    setCommitProgress(0);

    try {
      if (activeTab === 'students' && studentReport) {
        await commitStudentRoster(studentReport.validRows, (pct) => setCommitProgress(pct));
        setCommitSuccess(`Đã nhập thành công ${studentReport.validCount} học sinh vào hệ thống!`);
      } else if (activeTab === 'schedule' && scheduleReport) {
        await commitSchedule(scheduleReport.validRows, (pct) => setCommitProgress(pct));
        setCommitSuccess(`Đã cập nhật thành công ${scheduleReport.validCount} tiết thời khóa biểu!`);
      }
    } catch (err: any) {
      alert(`Lỗi lưu dữ liệu: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Filtered rows for Student Preview
  const filteredStudents = useMemo(() => {
    if (!studentReport) return [];

    let combined: Array<{ isInvalid: boolean; errors: string[]; row: number; data: any }> = [];

    // Map valid rows
    studentReport.validRows.forEach((vr, idx) => {
      combined.push({
        isInvalid: false,
        errors: [],
        row: idx + 2,
        data: vr,
      });
    });

    // Map invalid rows
    studentReport.invalidRows.forEach((ir) => {
      combined.push({
        isInvalid: true,
        errors: ir.errors,
        row: ir.row,
        data: ir.data,
      });
    });

    // Sort by original row number
    combined.sort((a, b) => a.row - b.row);

    // Apply valid/invalid filter
    if (previewFilter === 'valid') combined = combined.filter((r) => !r.isInvalid);
    if (previewFilter === 'invalid') combined = combined.filter((r) => r.isInvalid);

    // Apply class filter
    if (classFilter !== 'all') {
      combined = combined.filter((r) => String(r.data.classId || '').toUpperCase() === classFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      combined = combined.filter(
        (r) =>
          String(r.data.name || '').toLowerCase().includes(q) ||
          String(r.data.mhs || '').toLowerCase().includes(q) ||
          String(r.data.classId || '').toLowerCase().includes(q)
      );
    }

    return combined;
  }, [studentReport, previewFilter, classFilter, searchQuery]);

  // Filtered rows for Schedule Preview
  const filteredSchedule = useMemo(() => {
    if (!scheduleReport) return [];

    let combined: Array<{ isInvalid: boolean; errors: string[]; row: number; data: any }> = [];

    scheduleReport.validRows.forEach((vr, idx) => {
      combined.push({
        isInvalid: false,
        errors: [],
        row: idx + 2,
        data: vr,
      });
    });

    scheduleReport.invalidRows.forEach((ir) => {
      combined.push({
        isInvalid: true,
        errors: ir.errors,
        row: ir.row,
        data: ir.data,
      });
    });

    combined.sort((a, b) => a.row - b.row);

    if (previewFilter === 'valid') combined = combined.filter((r) => !r.isInvalid);
    if (previewFilter === 'invalid') combined = combined.filter((r) => r.isInvalid);

    if (classFilter !== 'all') {
      combined = combined.filter((r) => String(r.data.classId || '').toUpperCase() === classFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      combined = combined.filter(
        (r) =>
          String(r.data.subject || '').toLowerCase().includes(q) ||
          String(r.data.teacher || r.data.teacherName || '').toLowerCase().includes(q) ||
          String(r.data.classId || '').toLowerCase().includes(q)
      );
    }

    return combined;
  }, [scheduleReport, previewFilter, classFilter, searchQuery]);

  const currentReport = activeTab === 'students' ? studentReport : scheduleReport;

  return (
    <div className="space-y-6">
      {/* 1. Mode Switcher Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          type="button"
          onClick={() => handleTabChange('students')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'students'
              ? 'border-[#8B1A4A] text-[#8B1A4A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Danh sách học sinh (26 Lớp)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('schedule')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'border-[#8B1A4A] text-[#8B1A4A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Thời khóa biểu (TKB 40 Tiết)</span>
        </button>
      </div>

      {/* 2. Sample Template Download Section */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-800">Tải file mẫu chuẩn UMS:</h4>
          <p className="text-[11px] text-slate-500">
            {activeTab === 'students'
              ? 'Tải file mẫu Excel / CSV danh sách học sinh (hỗ trợ cả file nhiều sheet hoặc file phẳng)'
              : 'Tải file mẫu thời khóa biểu tuần chuẩn UMS (Thứ 2 - Thứ 6, Tiết 1 - 8)'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() =>
              activeTab === 'students'
                ? downloadStudentRosterTemplate('xlsx')
                : downloadScheduleTemplate('xlsx')
            }
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>File Mẫu (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              activeTab === 'students'
                ? downloadStudentRosterTemplate('csv')
                : downloadScheduleTemplate('csv')
            }
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>File Mẫu (.csv)</span>
          </button>
        </div>
      </div>

      {/* 3. Drag & Drop Upload Zone */}
      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
            isDragOver
              ? 'border-[#8B1A4A] bg-pink-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-[#8B1A4A] bg-white hover:bg-slate-50/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-12 h-12 mx-auto rounded-full bg-pink-50 text-[#8B1A4A] flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            Kéo thả file Excel (.xlsx, .xls) hoặc CSV vào đây, hoặc{' '}
            <span className="text-[#8B1A4A] underline">nhấp để chọn file</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Hỗ trợ file tối đa 10MB • Hỗ trợ workbook 26 sheet UMS_class_list • Tự động nhận diện UTF-8 BOM
          </p>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{selectedFile.name}</p>
              <p className="text-xs text-slate-400">
                {(selectedFile.size / 1024).toFixed(1)} KB •{' '}
                {isParsing ? 'Đang phân tích...' : 'Đã phân tích xong'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetState}
            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
            title="Xóa và chọn file khác"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 4. Pre-Commit Validation Summary & Filter Toolbar */}
      {currentReport && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500">Tổng số bản ghi</span>
                <p className="text-lg font-black text-slate-900">{currentReport.total}</p>
              </div>
              <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-800">Hợp lệ (Sẵn sàng nhập)</span>
                <p className="text-lg font-black text-emerald-700">{currentReport.validCount}</p>
              </div>
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                currentReport.errorCount > 0
                  ? 'bg-rose-50/60 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <span
                  className={`text-xs font-semibold ${
                    currentReport.errorCount > 0 ? 'text-rose-800' : 'text-slate-500'
                  }`}
                >
                  Có lỗi (Bị từ chối)
                </span>
                <p
                  className={`text-lg font-black ${
                    currentReport.errorCount > 0 ? 'text-rose-700' : 'text-slate-700'
                  }`}
                >
                  {currentReport.errorCount}
                </p>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  currentReport.errorCount > 0
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tab Filters */}
              <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPreviewFilter('all')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    previewFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({currentReport.total})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('valid')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    previewFilter === 'valid'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hợp lệ ({currentReport.validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('invalid')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    previewFilter === 'invalid'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Có lỗi ({currentReport.errorCount})
                </button>
              </div>

              {/* Class Filter */}
              <div className="flex items-center space-x-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1 bg-white text-slate-800"
                >
                  <option value="all">Tất cả các lớp</option>
                  {ALL_CLASSES.map((c) => (
                    <option key={c} value={c}>
                      Lớp {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Tìm theo tên, mã..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
              />
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs max-h-96">
            {activeTab === 'students' ? (
              <table className="w-full text-left border-collapse min-w-[760px] text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-16">Dòng</th>
                    <th className="p-2.5">MHS</th>
                    <th className="p-2.5">Họ và tên</th>
                    <th className="p-2.5">Lớp</th>
                    <th className="p-2.5">Ngày sinh</th>
                    <th className="p-2.5">Giới tính</th>
                    <th className="p-2.5">SĐT PH</th>
                    <th className="p-2.5">Trạng thái / Chi tiết lỗi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                        Không có dữ liệu phù hợp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((item, idx) => (
                      <tr
                        key={idx}
                        className={item.isInvalid ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50'}
                      >
                        <td className="p-2.5 text-center font-mono font-bold text-slate-400">
                          {item.row}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">
                          {item.data.mhs || '—'}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{item.data.name || '—'}</td>
                        <td className="p-2.5 font-semibold text-slate-700">{item.data.classId || '—'}</td>
                        <td className="p-2.5 text-slate-600">{item.data.dob || '—'}</td>
                        <td className="p-2.5 text-slate-600">{item.data.gender || '—'}</td>
                        <td className="p-2.5 text-slate-600">{item.data.parentPhone || '—'}</td>
                        <td className="p-2.5">
                          {item.isInvalid ? (
                            <div className="space-y-1">
                              {item.errors.map((err, eIdx) => (
                                <span
                                  key={eIdx}
                                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 mr-1"
                                >
                                  {err}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Hợp lệ</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse min-w-[760px] text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-16">Dòng</th>
                    <th className="p-2.5">Thứ</th>
                    <th className="p-2.5">Tiết</th>
                    <th className="p-2.5">Lớp</th>
                    <th className="p-2.5">Môn học</th>
                    <th className="p-2.5">Giáo viên</th>
                    <th className="p-2.5">Phòng</th>
                    <th className="p-2.5">Trạng thái / Chi tiết lỗi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchedule.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                        Không có dữ liệu phù hợp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    filteredSchedule.map((item, idx) => (
                      <tr
                        key={idx}
                        className={item.isInvalid ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50'}
                      >
                        <td className="p-2.5 text-center font-mono font-bold text-slate-400">
                          {item.row}
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {item.data.dayOfWeek ? getDayOfWeekVi(item.data.dayOfWeek) : '—'}
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {item.data.periodIndex ? `Tiết ${item.data.periodIndex}` : '—'}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{item.data.classId || '—'}</td>
                        <td className="p-2.5 font-bold text-[#8B1A4A]">{item.data.subject || '—'}</td>
                        <td className="p-2.5 text-slate-600">
                          {item.data.teacherName || item.data.teacher || item.data.teacherUsername || '—'}
                        </td>
                        <td className="p-2.5 text-slate-600">{item.data.room || '—'}</td>
                        <td className="p-2.5">
                          {item.isInvalid ? (
                            <div className="space-y-1">
                              {item.errors.map((err, eIdx) => (
                                <span
                                  key={eIdx}
                                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 mr-1"
                                >
                                  {err}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Hợp lệ</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* 5. Commit Section & Progress Bar */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-800">
                Sẵn sàng nhập dữ liệu vào cơ sở dữ liệu:
              </p>
              <p className="text-[11px] text-slate-500">
                Chỉ những dòng hợp lệ ({currentReport.validCount} bản ghi) sẽ được ghi vào hệ thống. Các dòng có lỗi sẽ tự động bỏ qua.
              </p>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="button"
                disabled={currentReport.validCount === 0 || isCommitting}
                onClick={handleCommit}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#8B1A4A] hover:bg-[#72153c] disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang nhập ({commitProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nhập dữ liệu vào hệ thống ({currentReport.validCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Real-time Progress Bar */}
          {isCommitting && (
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${commitProgress}%` }}
              />
            </div>
          )}

          {/* Success Banner */}
          {commitSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-900">{commitSuccess}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
