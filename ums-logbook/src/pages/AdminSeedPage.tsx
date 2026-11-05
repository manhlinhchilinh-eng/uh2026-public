import React, { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { seedMockStorage, getSeedStats } from '../services/seedService';
import { Bi } from '../components/common/Bi';
import { Database, RefreshCw, CheckCircle2, AlertCircle, Layers, Users, BookOpen } from 'lucide-react';

export const AdminSeedPage: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({ classesCount: 0, studentsCount: 0, usersCount: 0 });

  useEffect(() => {
    updateCurrentStats();
  }, []);

  const updateCurrentStats = () => {
    try {
      const cls = JSON.parse(localStorage.getItem('ums_classes') || '[]');
      const std = JSON.parse(localStorage.getItem('ums_students') || '[]');
      const usr = JSON.parse(localStorage.getItem('ums_users') || '[]');
      setStats({
        classesCount: cls.length,
        studentsCount: std.length,
        usersCount: usr.length,
      });
    } catch (e) {
      // ignore
    }
  };

  const handleSeed = () => {
    setLoading(true);
    setResultMessage(null);
    try {
      const res = seedMockStorage();
      if (res.success) {
        setResultMessage(res.message);
        updateCurrentStats();
      } else {
        setResultMessage(`Lỗi: ${res.message}`);
      }
    } catch (e: any) {
      setResultMessage(`Lỗi ngoại lệ: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const seedStats = getSeedStats();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rose-50 text-ums-800 rounded-xl">
            <Database className="w-6 h-6 text-[#8B1A4A]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              <Bi vi={t.admin.seedTitle} en="System Data Seeding" />
            </h2>
            <p className="text-xs text-slate-500">
              Khởi tạo dữ liệu lớp học, học sinh từ file <span className="font-mono">class_data.json</span>
            </p>
          </div>
        </div>
      </div>

      {/* Live Data Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-2">
            <Layers className="w-5 h-5" />
          </div>
          <span className="block text-2xl font-black text-slate-900">
            {stats.classesCount} / {seedStats.classesCount}
          </span>
          <span className="text-xs font-semibold text-slate-500">
            <Bi vi={t.admin.totalClasses} en="Total Classes" />
          </span>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
            <Users className="w-5 h-5" />
          </div>
          <span className="block text-2xl font-black text-slate-900">
            {stats.studentsCount} / {seedStats.studentsCount}
          </span>
          <span className="text-xs font-semibold text-slate-500">
            <Bi vi={t.admin.totalStudents} en="Total Students" />
          </span>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mb-2">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="block text-2xl font-black text-slate-900">
            {stats.usersCount} / {seedStats.usersCount}
          </span>
          <span className="text-xs font-semibold text-slate-500">
            <Bi vi={t.admin.totalUsers} en="Total Accounts" />
          </span>
        </div>
      </div>

      {/* Action Box */}
      <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800">
          <Bi vi="Thao tác nạp dữ liệu chuẩn" en="Seed Standard Data" />
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {t.admin.seedPrompt} Tất cả 26 lớp (6A1–9A6), 674 học sinh và 29 tài khoản (bao gồm BGH,
          TPT, và GVCN) sẽ được tạo với mật khẩu ban đầu do quản trị cấp riêng và cờ buộc đổi mật khẩu <span className="font-mono text-ums-800">mustChangePassword: true</span>.
        </p>

        {resultMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
              resultMessage.includes('Lỗi')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {resultMessage.includes('Lỗi') ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{resultMessage}</span>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleSeed}
            disabled={loading}
            className="px-5 py-2.5 bg-[#8B1A4A] hover:bg-[#74173F] text-white rounded-xl text-xs font-bold shadow flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? t.admin.seedProgress : t.admin.seedButton}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
