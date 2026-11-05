/**
 * Nghỉ học & Báo cơm (Văn phòng/Kế toán, BGH, Giám thị, TPT): thống kê HS nghỉ có phép (đơn đã GVCN duyệt)
 * theo khối/lớp + số HS không ăn bán trú. Đọc: 1 truy vấn/ngày (6 truy vấn cho chế độ tuần), cache 10 phút trong service,
 * chỉ khi mở trang hoặc đổi ngày/chế độ/làm mới. Có chặn phản hồi cũ đến muộn.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Bi } from '../components/common/Bi';
import { useLanguage } from '../hooks/useLanguage';
import { flatBilingual } from '../utils/bilingual';
import { listApprovedForDate, listApprovedForDates } from '../services/studentLeaveService';
import { leaveStats, weekSchoolDates } from '../utils/leaveStats';
import { mealSummary, type StudentLeave } from '../utils/studentLeave';

const pad = (n: number) => String(n).padStart(2, '0');
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const fmtDate = (iso: string) => iso.split('-').reverse().join('/');

type Mode = 'day' | 'week';

export const MealReportPage: React.FC = () => {
  const lang = useLanguage();
  const flat = (vi: string, en: string) => flatBilingual(lang?.language || 'vi', lang?.mode || 'dual', { vi, en });
  const dates = useMemo(() => Array.from({ length: 8 }, (_, i) => localIso(addDays(i))), []);
  const weekDates = useMemo(() => weekSchoolDates(dates[0]), [dates]);
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(dates[0]);
  const [leaves, setLeaves] = useState<StudentLeave[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const load = useCallback(
    async (m: Mode, d: string, force = false) => {
      const my = ++reqId.current;
      setLoading(true);
      setError('');
      try {
        const rows =
          m === 'week'
            ? await (force ? listApprovedForDates(weekDates, true) : listApprovedForDates(weekDates))
            : await (force ? listApprovedForDate(d, true) : listApprovedForDate(d));
        if (my === reqId.current) setLeaves(rows);
      } catch (e) {
        if (my === reqId.current) setError(e instanceof Error ? e.message : 'Không tải được dữ liệu.');
      } finally {
        if (my === reqId.current) setLoading(false);
      }
    },
    [weekDates]
  );

  useEffect(() => {
    void load(mode, date);
  }, [mode, date, load]);

  const viewDates = useMemo(() => (mode === 'week' ? weekDates : [date]), [mode, weekDates, date]);
  const stats = useMemo(() => leaveStats(leaves, viewDates), [leaves, viewDates]);
  const maxGrade = Math.max(1, ...stats.byGrade.map((g) => g.count));
  const sum = useMemo(() => mealSummary(leaves, date), [leaves, date]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" data-testid="meal-report-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">
          <Bi vi="Nghỉ học & Báo cơm" en="Leave & Lunch report" />
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm" role="group">
            {(['day', 'week'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 font-semibold ${mode === m ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
              >
                {m === 'day' ? <Bi vi="Hôm nay" en="Day" layout="inline" wrap /> : <Bi vi="Tuần này" en="This week" layout="inline" wrap />}
              </button>
            ))}
          </div>
          {mode === 'day' && (
            <select
              aria-label={flat('Chọn ngày', 'Choose date')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {fmtDate(d)}
                  {d === dates[0] ? ` (${flat('hôm nay', 'today')})` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => void load(mode, date, true)}
            disabled={loading}
            className="inline-flex items-center gap-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <Bi vi="Làm mới" en="Refresh" />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {mode === 'week' && (
        <p className="text-xs text-slate-500">
          {fmtDate(weekDates[0])} – {fmtDate(weekDates[weekDates.length - 1])}
        </p>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3" data-testid="leave-stats">
        <div className="text-center">
          <div className="text-5xl font-bold text-blue-700" data-testid="leave-total">
            {stats.total}
          </div>
          <div className="text-sm text-slate-600 mt-1">
            <Bi vi="HS nghỉ có phép (đã duyệt)" en="Students on approved leave" layout="inline" wrap />
          </div>
        </div>
        <div className="space-y-1.5" data-testid="leave-by-grade">
          {stats.byGrade.map((g) => (
            <div key={g.grade} className="flex items-center gap-2 text-sm" data-testid="grade-row">
              <span className="w-16 shrink-0 text-slate-600">
                <Bi vi={`Khối ${g.grade}`} en={`Grade ${g.grade}`} layout="inline" wrap />
              </span>
              <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden">
                <div className="bg-blue-500 h-4 rounded" style={{ width: `${(g.count / maxGrade) * 100}%` }} />
              </div>
              <span className="w-8 text-right font-semibold text-slate-800">{g.count}</span>
            </div>
          ))}
        </div>
        {stats.byClass.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-2 py-2"><Bi vi="Lớp" en="Class" layout="inline" wrap /></th>
                  <th className="text-left px-2 py-2"><Bi vi="Cả ngày" en="Full day" layout="inline" wrap /></th>
                  <th className="text-left px-2 py-2"><Bi vi="Theo tiết" en="Periods" layout="inline" wrap /></th>
                  <th className="text-left px-2 py-2"><Bi vi="Không ăn" en="No lunch" layout="inline" wrap /></th>
                  <th className="text-left px-2 py-2"><Bi vi="Học sinh" en="Students" layout="inline" wrap /></th>
                </tr>
              </thead>
              <tbody>
                {stats.byClass.map((c) => (
                  <tr key={c.classId} className="border-t border-slate-100 align-top" data-testid="leave-row">
                    <td className="px-2 py-2 font-semibold text-slate-800">{c.classId}</td>
                    <td className="px-2 py-2">{c.fullDay}</td>
                    <td className="px-2 py-2">{c.periods}</td>
                    <td className="px-2 py-2">{c.noMeal}</td>
                    <td className="px-2 py-2 text-slate-700 min-w-[10rem]">
                      {c.students.map((st) => (
                        <div key={st.mhs}>
                          {st.name} <span className="text-xs text-slate-500">({st.detail})</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && stats.total === 0 && (
          <p className="text-sm text-slate-500 text-center">
            <Bi vi="Không có học sinh nghỉ có phép." en="No student on approved leave." layout="inline" wrap />
          </p>
        )}
      </section>

      {mode === 'week' && (
        <p className="text-sm text-slate-500" data-testid="lunch-week-note">
          <Bi
            vi="Báo cơm chỉ hiển thị theo từng ngày — chọn “Hôm nay” để xem."
            en="Lunch report is shown per day — switch to “Day” to view it."
            layout="inline"
            wrap
          />
        </p>
      )}

      {mode === 'day' && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-5xl font-bold text-amber-600" data-testid="meal-total">
              {sum.total}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              <Bi vi="học sinh không ăn bán trú" en="students skipping school lunch" layout="inline" wrap />
            </div>
          </div>

          {!loading && sum.total === 0 && !error && (
            <p className="text-sm text-slate-500">
              <Bi vi="Không có học sinh nào báo không ăn bán trú." en="No student has opted out of school lunch." layout="inline" wrap />
            </p>
          )}

          {sum.byClass.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 w-20"><Bi vi="Lớp" en="Class" layout="inline" wrap /></th>
                    <th className="text-left px-3 py-2 w-16"><Bi vi="Số HS" en="Count" layout="inline" wrap /></th>
                    <th className="text-left px-3 py-2"><Bi vi="Học sinh" en="Students" layout="inline" wrap /></th>
                  </tr>
                </thead>
                <tbody>
                  {sum.byClass.map((c) => (
                    <tr key={c.classId} className="border-t border-slate-100 align-top" data-testid="meal-row">
                      <td className="px-3 py-2 font-semibold text-slate-800">{c.classId}</td>
                      <td className="px-3 py-2 font-semibold text-amber-700">{c.students.length}</td>
                      <td className="px-3 py-2 text-slate-700">{c.students.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-500">
            <Bi
              vi="Chỉ tính đơn nghỉ đã được GVCN duyệt, có chọn không ăn bán trú."
              en="Only leave requests approved by the homeroom teacher with school lunch opted out are counted."
              layout="inline"
              wrap
            />
          </p>
        </>
      )}
    </div>
  );
};
