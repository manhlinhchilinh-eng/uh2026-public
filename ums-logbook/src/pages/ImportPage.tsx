import React from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { ImportTool } from '../components/admin/ImportTool';
import { Bi } from '../components/common/Bi';
import { FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ImportType } from '../types/importer';

export const ImportPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const typeParam = searchParams.get('type');
  const initialType: ImportType = typeParam === 'schedule' ? 'schedule' : 'students';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi="Nhập dữ liệu Excel / CSV (UMS Data Importer)" en="Excel / CSV Data Importer" />
            </h2>
            <p className="text-xs text-slate-500">
              <Bi
                vi="Công cụ nhập danh sách học sinh và thời khóa biểu hàng loạt cho 26 lớp UMS"
                en="Bulk import student rosters & timetables for 26 UMS classes"
              />
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <Bi vi={t.common.back} en="Back" />
        </button>
      </div>

      {/* Main Tool */}
      <ImportTool initialType={initialType} />
    </div>
  );
};
