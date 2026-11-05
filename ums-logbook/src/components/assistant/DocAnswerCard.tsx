/**
 * Trợ lý UMS+ — thẻ trả lời theo văn bản Hành chính / thông báo (kết quả answerFromDocs).
 * Chỉ hiển thị: câu trả lời trích nguyên văn + nút mở nguồn; không chắc → danh sách link.
 */
import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import type { DocAnswer } from '../../utils/assistant/noticeAnswer';
import type { KnowledgeDoc, KnowledgeSource } from '../../utils/assistant/knowledgeDocs';

type L = (vi: string, en: string) => React.ReactNode;

const SOURCE_LABEL: Record<KnowledgeSource, [string, string]> = {
  admin_doc: ['Văn bản Hành chính', 'Administrative document'],
  office_notice: ['Thông báo Văn phòng', 'Office notice'],
  announcement: ['Thông báo nhà trường', 'School announcement'],
};

const dmy = (ms?: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** "*Tiêu đề*" trong câu trả lời → “Tiêu đề” (khung chat hiển thị chữ thường, không markdown). */
const plain = (s: string) => s.replace(/\*([^*]+)\*/g, '“$1”');

const btn =
  'mt-2 mr-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A4A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6B1338]';

const SourceHead: React.FC<{ doc: KnowledgeDoc; L: L }> = ({ doc, L }) => {
  const [v, e] = SOURCE_LABEL[doc.source];
  const meta = [doc.docNumber, dmy(doc.date)].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8B1A4A]">
      <FileText className="w-3.5 h-3.5 shrink-0" /> {L(v, e)}
      {meta && <span className="font-normal normal-case text-slate-400">· {meta}</span>}
    </div>
  );
};

const OpenButtons: React.FC<{ doc: KnowledgeDoc; L: L; go: (path: string) => void }> = ({ doc, L, go }) => (
  <div>
    {doc.link.path && (
      <button type="button" onClick={() => go(doc.link.path!)} data-testid="assistant-doc-open" className={btn}>
        {L('Mở văn bản/thông báo', 'Open document/notice')} →
      </button>
    )}
    {doc.link.url && /^https:\/\//i.test(doc.link.url) && (
      <a href={doc.link.url} target="_blank" rel="noopener noreferrer" className={btn}>
        {L('Mở tệp gốc', 'Open original')} <ExternalLink className="w-3.5 h-3.5" />
      </a>
    )}
  </div>
);

export const DocAnswerCard: React.FC<{ a: DocAnswer; L: L; go: (path: string) => void }> = ({ a, L, go }) => {
  if (a.kind === 'none') return null;
  if (a.kind === 'links')
    return (
      <div className="mb-2 rounded-xl border border-ums-100 bg-ums-50/50 p-3" data-testid="assistant-doc-links">
        <p className="text-sm text-slate-700">{L('Có thể bạn cần xem:', 'You may want to read:')}</p>
        {a.docs.map((d) => (
          <div key={d.id} className="mt-2">
            <SourceHead doc={d} L={L} />
            <div className="text-sm font-semibold text-slate-800">{d.title}</div>
            <OpenButtons doc={d} L={L} go={go} />
          </div>
        ))}
      </div>
    );
  const { doc } = a;
  return (
    <div data-testid="assistant-doc-answer">
      <SourceHead doc={doc} L={L} />
      {a.kind === 'ask_class' ? (
        <p className="mt-1 text-sm text-slate-700">
          {L(
            `Anh/chị hỏi lớp nào? Ví dụ: "lớp 7A1 có trong danh sách không". Văn bản liên quan: ${doc.title}`,
            `Which class? E.g. "is 7A1 on the list?". Related document: ${doc.title}`
          )}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">
            {L(plain(a.textVi), plain(a.textEn))}
          </p>
          {a.quotes.map((q, i) => (
            <blockquote key={i} className="mt-1.5 border-l-2 border-[#8B1A4A]/40 pl-2 text-xs italic text-slate-600">
              {q}
            </blockquote>
          ))}
        </>
      )}
      <OpenButtons doc={doc} L={L} go={go} />
      <p className="mt-1.5 text-[11px] text-slate-400">
        {L('Trích nguyên văn từ văn bản, không đoán.', 'Quoted verbatim from the document, no guessing.')}
      </p>
    </div>
  );
};
