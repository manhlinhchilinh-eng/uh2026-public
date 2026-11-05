import React, { useMemo, useState } from 'react';
import type { ChildInfo, LeaveType, NewLeaveInput, Treatment } from '../../types/leave';
import { LEAVE_TYPE_LABEL, maternityGuide, requiredDocs, validateLeave, type LeaveContext } from '../../utils/leavePolicy';
import type { SubstitutionPlan } from '../../types/substitution';
import { validatePlans } from '../../utils/substitution';
import { SubstitutionPlanner, type PlannerData } from './SubstitutionPlanner';

interface Props {
  ctx: LeaveContext;
  gender?: 'female' | 'male';
  children: ChildInfo[];
  onSubmit: (input: NewLeaveInput, workingDays: number, plans: SubstitutionPlan[]) => Promise<void>;
  /** Dữ liệu để GV tự sắp xếp dạy thay (bỏ trống = ẩn phần dạy thay) */
  planner?: PlannerData;
  selfUid?: string;
  onCancel: () => void;
}

export const LeaveRequestForm: React.FC<Props> = ({ ctx, gender, children, onSubmit, onCancel, planner, selfUid = '' }) => {
  const [plans, setPlans] = useState<SubstitutionPlan[]>([]);
  const [type, setType] = useState<LeaveType>('annual');
  const [startDate, setStart] = useState(ctx.today);
  const [endDate, setEnd] = useState(ctx.today);
  const [reason, setReason] = useState('');
  const [isEmergency, setEmergency] = useState(false);
  const [treatment, setTreatment] = useState<Treatment | undefined>();
  const [childIdx, setChildIdx] = useState<number>(-1);
  const [childOrder, setChildOrder] = useState(2);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const input: NewLeaveInput = {
    type,
    startDate,
    endDate,
    reason,
    isEmergency,
    treatment: type === 'sick_self' ? treatment : undefined,
    child: type === 'sick_child' && childIdx >= 0 ? children[childIdx] : undefined,
  };
  const check = useMemo(() => validateLeave(input, ctx), [JSON.stringify(input), ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const docs = requiredDocs(type, input.treatment);
  const planErrors = validatePlans(plans, { startDate, endDate }, selfUid);
  const allErrors = [...check.errors, ...planErrors];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allErrors.length) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await onSubmit(input, check.workingDays, plans);
    } catch (err) {
      console.error(err);
      setSubmitError('Không gửi được đơn (kiểm tra kết nối hoặc quyền).');
      setBusy(false);
    }
  };

  const field = 'w-full text-sm border border-slate-300 rounded-lg p-2';
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="leave-type" className="block text-xs font-semibold text-slate-700 mb-1">Loại đơn</label>
        <select id="leave-type" value={type} onChange={(e) => setType(e.target.value as LeaveType)} className={field}>
          {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
            <option key={t} value={t}>{LEAVE_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="leave-start" className="block text-xs font-semibold text-slate-700 mb-1">Từ ngày</label>
          <input id="leave-start" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="leave-end" className="block text-xs font-semibold text-slate-700 mb-1">Đến hết ngày</label>
          <input id="leave-end" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} className={field} />
        </div>
      </div>
      {type !== 'maternity' && (
        <p data-testid="working-days" className="text-xs text-slate-600">
          Số ngày làm việc (không tính T7, CN, ngày lễ): <b>{check.workingDays}</b>
        </p>
      )}

      {type === 'sick_self' && (
        <div className="flex gap-4 text-xs">
          {(['outpatient', 'inpatient'] as Treatment[]).map((t) => (
            <label key={t} className="inline-flex items-center gap-1.5">
              <input type="radio" name="treatment" aria-label={t === 'inpatient' ? 'Điều trị nội trú' : 'Điều trị ngoại trú'} checked={treatment === t} onChange={() => setTreatment(t)} />
              {t === 'inpatient' ? 'Điều trị nội trú' : 'Điều trị ngoại trú'}
            </label>
          ))}
        </div>
      )}

      {type === 'sick_child' && (
        <div>
          <label htmlFor="leave-child" className="block text-xs font-semibold text-slate-700 mb-1">Con bị ốm</label>
          {children.length === 0 ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Hồ sơ chưa có thông tin con. Đề nghị BGH/Nhân sự cập nhật trong "Hồ sơ phép".
            </p>
          ) : (
            <select id="leave-child" value={childIdx} onChange={(e) => setChildIdx(Number(e.target.value))} className={field}>
              <option value={-1}>-- Chọn con --</option>
              {children.map((c, i) => (
                <option key={c.name + c.dob} value={i}>{c.name} ({c.dob})</option>
              ))}
            </select>
          )}
        </div>
      )}

      {type === 'maternity' && (
        <div className="text-xs bg-sky-50 border border-sky-200 rounded-lg p-2.5 space-y-1.5">
          <label className="inline-flex items-center gap-2">
            Sinh con lần thứ
            <input type="number" min={1} max={5} value={childOrder} onChange={(e) => setChildOrder(Number(e.target.value) || 1)} className="w-14 border border-slate-300 rounded p-1" />
          </label>
          <p className="text-sky-900">{maternityGuide({ gender, childOrder })}</p>
          <p className="text-sky-900">[UMS] Nộp giấy khai sinh/chứng sinh và giấy ra viện (nếu mổ) chậm nhất 1 tháng sau sinh.</p>
        </div>
      )}

      <div>
        <label htmlFor="leave-reason" className="block text-xs font-semibold text-slate-700 mb-1">Lý do</label>
        <textarea id="leave-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={field} />
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" aria-label="Nghỉ đột xuất" checked={isEmergency} onChange={(e) => setEmergency(e.target.checked)} />
        Nghỉ đột xuất (ốm đau, tai nạn, sự cố)
      </label>

      {docs.length > 0 && (
        <div className="text-xs text-slate-700">
          <p className="font-semibold">Giấy tờ cần nộp:</p>
          <ul className="list-disc ml-5">{docs.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}

      {planner && (
        <SubstitutionPlanner data={planner} selfUid={selfUid} startDate={startDate} endDate={endDate} plans={plans} onChange={setPlans} />
      )}

      {allErrors.length > 0 && (
        <ul data-testid="leave-errors" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 space-y-0.5">
          {allErrors.map((m) => <li key={m}>• {m}</li>)}
        </ul>
      )}
      {check.warnings.length > 0 && (
        <ul data-testid="leave-warnings" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-0.5">
          {check.warnings.map((m) => <li key={m}>• {m}</li>)}
        </ul>
      )}
      {submitError && <p className="text-xs text-red-700">{submitError}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-xs rounded-lg border border-slate-200">Hủy</button>
        <button type="submit" disabled={busy || allErrors.length > 0} className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold disabled:opacity-40">
          {busy ? 'Đang gửi…' : 'Gửi đơn'}
        </button>
      </div>
    </form>
  );
};
