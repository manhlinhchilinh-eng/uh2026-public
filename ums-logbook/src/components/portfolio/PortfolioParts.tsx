import React, { useMemo, useState } from 'react';
import { Sparkles, Link2 } from 'lucide-react';
import type { NewPortfolioInput, PortfolioAiResult, PortfolioCategory, PortfolioItem, PortfolioType } from '../../types/portfolio';
import { CATEGORY_LABEL, DIMENSIONS, TYPE_LABEL, competencyProfile, runAi, validatePortfolio } from '../../utils/portfolio';

// Cùng màu chuỗi đã qua validator dataviz ở Dashboard BGH
const SERIES = '#A8285F';

export const STATUS_META: Record<PortfolioItem['status'], { label: string; cls: string }> = {
  submitted: { label: 'Chờ GV duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  returned: { label: 'Cần chỉnh sửa', cls: 'bg-red-50 text-red-800 border-red-200' },
};

/** 4 chiều năng lực — cột ngang 1 chuỗi (không dùng radar). */
export const CompetencyBars: React.FC<{ items: PortfolioItem[] }> = ({ items }) => {
  const prof = competencyProfile(items);
  return (
    <figure data-testid="competency" className="bg-white border border-slate-200 rounded-xl p-4">
      <figcaption className="text-xs font-bold text-slate-800 mb-1">Năng lực theo rubric GDPT 2018</figcaption>
      <p className="text-[11px] text-slate-500 mb-3">
        {prof.count ? `Trung bình trên ${prof.count} minh chứng đã được GV duyệt` : 'Chưa có minh chứng nào được GV duyệt'}
      </p>
      <div className="space-y-2">
        {prof.dims.map((d) => (
          <div key={d.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[200px_1fr_48px] items-center gap-2">
            <span className="text-[11px] text-slate-700">{d.label}</span>
            <div className="hidden sm:block h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-r" style={{ width: `${(d.ratio ?? 0) * 100}%`, background: SERIES }} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-right">{d.ratio == null ? '—' : `${Math.round(d.ratio * 100)}%`}</span>
          </div>
        ))}
      </div>
      {prof.topSkills.length > 0 && (
        <p className="text-[11px] text-slate-600 mt-3">
          <b>Kỹ năng nổi bật:</b> {prof.topSkills.map((s) => s.name).join(' • ')}
        </p>
      )}
    </figure>
  );
};

export const AiResultView: React.FC<{ ai: PortfolioAiResult; compact?: boolean }> = ({ ai, compact }) => (
  <div className="text-[11px] text-slate-700 bg-sky-50 border border-sky-100 rounded-lg p-2.5 space-y-1">
    <p className="font-bold text-sky-900 flex items-center gap-1">
      <Sparkles className="w-3.5 h-3.5" /> AI gợi ý (offline): {ai.total_score}/10 — {ai.overall_level}
    </p>
    <p>
      {DIMENSIONS.map((d) => `${d.label.split(' ')[0]} ${(ai as any)[d.key]}/${d.max}`).join(' • ')}
    </p>
    {!compact && (
      <>
        <p><b>Điểm sáng:</b> {ai.strengths}</p>
        <p><b>Cơ hội bứt phá:</b> {ai.growth_areas}</p>
        <p><b>Kỹ năng:</b> {ai.skills.map((s) => s.skill_name).join(', ')}</p>
      </>
    )}
    <p className="text-[10px] text-slate-400">Điểm AI chỉ để tham khảo — đánh giá chính thức do giáo viên quyết định.</p>
  </div>
);

export const PortfolioItemCard: React.FC<{ item: PortfolioItem; children?: React.ReactNode }> = ({ item, children }) => (
  <li data-testid={`pf-${item.id}`} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1.5">
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_META[item.status].cls}`}>{STATUS_META[item.status].label}</span>
      <span className="text-[10px] text-slate-500">{TYPE_LABEL[item.type]} • {CATEGORY_LABEL[item.category]}</span>
      <span className="text-[10px] text-slate-400 ml-auto">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
    </div>
    <p className="text-sm font-bold text-slate-900">{item.title}</p>
    <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4">{item.content}</p>
    {item.links.length > 0 && (
      <p className="text-[11px] flex flex-wrap gap-2">
        {item.links.map((l) => (
          <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline"><Link2 className="w-3 h-3" />Liên kết</a>
        ))}
      </p>
    )}
    {item.ai && <AiResultView ai={item.ai} compact />}
    {item.teacherComment && (
      <p className="text-[11px] text-slate-700"><b>GV {item.reviewerName}:</b> {item.teacherComment}{item.teacherScore != null ? ` (điểm GV: ${item.teacherScore}/10)` : ''}</p>
    )}
    {children}
  </li>
);

/** Form nộp minh chứng — xem trước nhận xét AI ngay trên máy trước khi gửi. */
export const PortfolioForm: React.FC<{
  gradeLevel: number;
  initial?: NewPortfolioInput;
  onSubmit: (input: NewPortfolioInput, ai: PortfolioAiResult | null) => Promise<void>;
  onCancel: () => void;
}> = ({ gradeLevel, initial, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [type, setType] = useState<PortfolioType>(initial?.type || 'project');
  const [category, setCategory] = useState<PortfolioCategory>(initial?.category || 'general');
  const [content, setContent] = useState(initial?.content || '');
  const [reflection, setReflection] = useState(initial?.reflection || '');
  const [linksText, setLinksText] = useState((initial?.links || []).join('\n'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const input: NewPortfolioInput = { title, type, category, content, reflection, links: linksText.split(/\s+/).filter(Boolean) };
  const errors = validatePortfolio(input);
  const ai = useMemo(() => {
    if (content.trim().length < 20) return null;
    try {
      return runAi(input, gradeLevel);
    } catch {
      return null;
    }
  }, [title, category, content, reflection, gradeLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const field = 'w-full text-sm border border-slate-300 rounded-lg p-2';
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (errors.length) return;
        setBusy(true);
        setErr(null);
        try {
          await onSubmit(input, ai);
        } catch (ex) {
          console.error(ex);
          setErr('Không gửi được (kiểm tra kết nối hoặc quyền).');
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="pf-title" className="block text-xs font-semibold text-slate-700 mb-1">Tên minh chứng</label>
        <input id="pf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-type" className="block text-xs font-semibold text-slate-700 mb-1">Loại</label>
          <select id="pf-type" value={type} onChange={(e) => setType(e.target.value as PortfolioType)} className={field}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pf-cat" className="block text-xs font-semibold text-slate-700 mb-1">Lĩnh vực</label>
          <select id="pf-cat" value={category} onChange={(e) => setCategory(e.target.value as PortfolioCategory)} className={field}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="pf-content" className="block text-xs font-semibold text-slate-700 mb-1">Nội dung / mô tả sản phẩm</label>
        <textarea id="pf-content" value={content} onChange={(e) => setContent(e.target.value)} rows={7} className={field} />
      </div>
      <div>
        <label htmlFor="pf-refl" className="block text-xs font-semibold text-slate-700 mb-1">Phản tư (em học được gì, vai trò của em)</label>
        <textarea id="pf-refl" value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} className={field} />
      </div>
      <div>
        <label htmlFor="pf-links" className="block text-xs font-semibold text-slate-700 mb-1">Liên kết sản phẩm (Google Drive, video…; mỗi dòng 1 link https://)</label>
        <textarea id="pf-links" value={linksText} onChange={(e) => setLinksText(e.target.value)} rows={2} className={field} />
      </div>
      {ai && <div data-testid="ai-preview"><AiResultView ai={ai} /></div>}
      {errors.length > 0 && (
        <ul data-testid="pf-errors" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{errors.map((m) => <li key={m}>• {m}</li>)}</ul>
      )}
      {err && <p className="text-xs text-red-700">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-xs rounded-lg border border-slate-200">Hủy</button>
        <button type="submit" disabled={busy || errors.length > 0} className="px-3 py-2 text-xs rounded-lg bg-[#8B1A4A] text-white font-semibold disabled:opacity-40">
          {busy ? 'Đang gửi…' : 'Nộp cho giáo viên'}
        </button>
      </div>
    </form>
  );
};
