/**
 * BGH: phân công nhập điểm (dựng từ TKB + tên TKB đã gắn tài khoản, sửa tay từng lớp-môn) và tiến độ nhập điểm toàn trường.
 * Tiến độ chỉ tải khi bấm nút (≈ số lớp × số môn lượt đọc).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, X } from 'lucide-react';
import { useToast } from '../common/Toast';
import type { UserProfile } from '../../types/auth';
import { fetchSchedulesStrict } from '../../services/scheduleService';
import { fetchAllTeacherAliases } from '../../services/teacherAliasService';
import { aliasDocsFromMatches, matchTkbNames, tkbNamesFromSchedules } from '../../utils/tkbNameMatch';
import {
  fetchAllAssignments,
  fetchStaffAccounts,
  fetchTermGradebooks,
  saveAssignments,
} from '../../services/gradebookService';
import {
  buildAssignmentsFromTimetable,
  mergeAssignments,
  type GradeAssignment,
  type Gradebook,
} from '../../utils/gradebook';

interface Props {
  profile: UserProfile;
  year: string;
  term: 1 | 2;
}

type Staff = { uid: string; username: string; displayName: string; assignedClassId?: string };

const SHORT_STATUS = { draft: 'Nháp', published: 'Công bố', locked: 'Khóa' } as const;

export const GradebookAdminPanel: React.FC<Props> = ({ profile, year, term }) => {
  const { showToast } = useToast();
  const [list, setList] = useState<GradeAssignment[] | null>(null);
  const [pending, setPending] = useState<GradeAssignment[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [busy, setBusy] = useState(false);
  const [books, setBooks] = useState<Gradebook[] | null>(null);
  const [cls, setCls] = useState('');

  const load = () =>
    fetchAllAssignments(year)
      .then(setList)
      .catch((e) => {
        console.warn('[Sổ điểm] phân công', e);
        setList([]);
      });
  useEffect(() => {
    load();
    fetchStaffAccounts().then(setStaff).catch(() => setStaff([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const shown = pending ?? list ?? [];
  const classes = useMemo(() => [...new Set(shown.map((a) => a.classId))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })), [shown]);
  useEffect(() => {
    if (classes.length && !classes.includes(cls)) setCls(classes[0]);
  }, [classes, cls]);

  const buildFromTkb = async () => {
    setBusy(true);
    try {
      const [schedules, aliases] = await Promise.all([fetchSchedulesStrict(), fetchAllTeacherAliases()]);
      // Tên TKB chưa gắn tài khoản → bộ ghép tự đề xuất (chỉ nhận kết quả chắc chắn)
      const linked = new Set(aliases.flatMap((a) => a.aliases));
      const matches = matchTkbNames(tkbNamesFromSchedules(schedules).filter((n) => !linked.has(n.name)), staff);
      const docs = [...aliases, ...aliasDocsFromMatches(matches), ...staff.map((s) => ({ ...s, aliases: [] as string[] }))];
      const built = buildAssignmentsFromTimetable(schedules, docs, year);
      setPending(mergeAssignments(built, list || []));
      const unsure = matches.filter((m) => m.status === 'ambiguous' || m.status === 'none').map((m) => m.name);
      showToast(
        `Dựng ${built.length} lớp-môn từ TKB, tự ghép ${matches.filter((m) => m.status === 'auto').length} tên GV.` +
          (unsure.length ? ` Chưa rõ: ${unsure.join(', ')} — thêm GV tay.` : '') + ' Kiểm tra rồi bấm "Lưu phân công".',
        'success'
      );
    } catch (e) {
      console.warn('[Sổ điểm] dựng phân công', e);
      showToast('Không đọc được TKB.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePending = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await saveAssignments(pending, profile);
      setPending(null);
      await load();
      showToast('Đã lưu phân công.', 'success');
    } catch {
      showToast('Không lưu được phân công.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const editOne = async (a: GradeAssignment, uids: string[]) => {
    const next: GradeAssignment = {
      ...a,
      teacherUids: uids,
      teacherNames: uids.map((u) => staff.find((s) => s.uid === u)?.displayName || a.teacherNames[a.teacherUids.indexOf(u)] || u),
      source: 'manual',
    };
    if (pending) {
      setPending(pending.map((x) => (x.id === a.id ? next : x)));
      return;
    }
    try {
      await saveAssignments([next], profile);
      setList((prev) => (prev || []).map((x) => (x.id === a.id ? next : x)));
    } catch {
      showToast('Không lưu được.', 'error');
    }
  };

  const loadProgress = async () => {
    setBusy(true);
    try {
      setBooks(await fetchTermGradebooks(year, term));
    } catch {
      showToast('Không tải được tiến độ.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const unresolved = shown.filter((a) => a.teacherUids.length === 0);
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50';
  const bookOf = new Map((books || []).map((b) => [`${b.classId}_${b.subjectKey}`, b]));
  const allSubjects = [...new Map(shown.map((a) => [a.subjectKey, a.subjectName])).entries()].sort((x, y) => x[1].localeCompare(y[1], 'vi'));

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">Phân công nhập điểm · {year}</h3>
          <span className="text-xs text-slate-500">{shown.length} lớp-môn{pending ? ' (chưa lưu)' : ''}</span>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={busy} onClick={buildFromTkb} className={`${btn} border border-slate-300 bg-white`} data-testid="gb-build-tkb">
              <RefreshCw className="w-3.5 h-3.5" /> Dựng phân công từ TKB
            </button>
            {pending && (
              <>
                <button type="button" disabled={busy} onClick={() => setPending(null)} className={`${btn} border border-slate-300 bg-white`}>Bỏ</button>
                <button type="button" disabled={busy} onClick={savePending} className={`${btn} bg-[#8B1A4A] text-white`} data-testid="gb-save-assign">
                  <Save className="w-3.5 h-3.5" /> Lưu phân công
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Lấy từ TKB: ô có tài khoản GV hoặc tên TKB đã gắn ở trang Thời khóa biểu. Lớp-môn BGH sửa tay được giữ nguyên khi dựng lại.
          {unresolved.length > 0 && <b className="text-amber-700"> {unresolved.length} lớp-môn chưa có GV (tên TKB chưa gắn tài khoản).</b>}
        </p>
        {classes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {classes.map((c) => (
              <button key={c} type="button" aria-pressed={cls === c} onClick={() => setCls(c)}
                className={`px-2 py-0.5 rounded-full border font-semibold ${cls === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-300'}`}>
                {c}{shown.some((a) => a.classId === c && a.teacherUids.length === 0) ? ' ⚠' : ''}
              </button>
            ))}
          </div>
        )}
        <table className="w-full text-xs border-collapse">
          <tbody>
            {shown.filter((a) => a.classId === cls).map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-1.5 pr-2 font-semibold text-slate-800 w-56">{a.subjectName}{a.source === 'manual' && <span className="ml-1 text-[10px] text-sky-700">(sửa tay)</span>}</td>
                <td className="py-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {a.teacherUids.map((u, i) => (
                      <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ums-50 text-[#8B1A4A] border border-ums-100">
                        {a.teacherNames[i]}
                        <button type="button" aria-label={`Bỏ ${a.teacherNames[i]}`} onClick={() => editOne(a, a.teacherUids.filter((x) => x !== u))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    {a.unresolvedNames.length > 0 && <span className="text-amber-700">TKB: {a.unresolvedNames.join(', ')}</span>}
                    <select value="" onChange={(e) => e.target.value && editOne(a, [...a.teacherUids, e.target.value])} className="border border-slate-300 rounded px-1 py-0.5" aria-label={`Thêm GV ${a.subjectName}`}>
                      <option value="">+ Thêm GV…</option>
                      {staff.filter((s) => !a.teacherUids.includes(s.uid)).map((s) => <option key={s.uid} value={s.uid}>{s.displayName}</option>)}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">Tiến độ nhập điểm · HK{term}</h3>
          <button type="button" disabled={busy || !list?.length} onClick={loadProgress} className={`${btn} ml-auto border border-slate-300 bg-white`} data-testid="gb-progress">
            <RefreshCw className="w-3.5 h-3.5" /> {books ? 'Tải lại' : 'Tải tiến độ'}
          </button>
        </div>
        {books && (
          <div className="overflow-auto">
            <table className="text-[11px] border-collapse" data-testid="gb-progress-table">
              <thead>
                <tr>
                  <th className="px-2 py-1 border border-slate-200 bg-slate-50">Lớp</th>
                  {allSubjects.map(([k, n]) => <th key={k} className="px-2 py-1 border border-slate-200 bg-slate-50 min-w-16">{n}</th>)}
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c}>
                    <td className="px-2 py-1 border border-slate-200 font-semibold">{c}</td>
                    {allSubjects.map(([k]) => {
                      const assigned = shown.some((a) => a.classId === c && a.subjectKey === k);
                      const b = bookOf.get(`${c}_${k}`);
                      const n = b ? Object.keys(b.rows).length : 0;
                      return (
                        <td key={k} className={`px-2 py-1 border border-slate-200 text-center ${!assigned ? 'bg-slate-100' : !b ? 'text-slate-400' : b.status === 'locked' ? 'bg-amber-50' : b.status === 'published' ? 'bg-emerald-50' : ''}`}>
                          {!assigned ? '' : b ? `${SHORT_STATUS[b.status]} · ${n} HS` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 mt-1">"n HS" = số HS đã có ít nhất 1 điểm/nhận xét. — = chưa mở sổ.</p>
          </div>
        )}
      </section>
    </div>
  );
};
