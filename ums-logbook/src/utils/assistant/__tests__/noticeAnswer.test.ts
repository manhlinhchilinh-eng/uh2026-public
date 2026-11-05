import { describe, it, expect } from 'vitest';
import {
  answerFromDocs,
  detectIntent,
  looksLikeNewsQuestion,
  scoreDoc,
  splitSections,
  DOC_ANSWER_MIN,
  DOC_SUGGEST_MIN,
  type DocAnswer,
} from '../noticeAnswer';
import { normalize } from '../normalize';
import type { KnowledgeDoc } from '../knowledgeDocs';
import { GOT_TALENT_TEXT, gotTalentDoc } from './fixtures/gotTalent';

const weekSchedule: KnowledgeDoc = {
  id: 'lich-tuan-45',
  source: 'admin_doc',
  title: 'Lịch tuần 45 - Văn phòng kính chuyển',
  text: 'Văn phòng gửi lại các thầy cô Lịch tuần của Trường THCS Ngoại ngữ.\nNếu có gì thay đổi VP sẽ thông báo.\nTrân trọng!',
  link: { path: '/hanh-chinh?open=lich-tuan-45' },
};
const midtermTitle = 'Thông báo Kế hoạch Kiểm tra đánh giá giữ học kì 1 năm học 2026-2027';
const midtermPlan: KnowledgeDoc = {
  id: 'kt-giua-ki',
  source: 'admin_doc',
  title: midtermTitle,
  docNumber: 'Số 135/TB-THCSNN',
  text: midtermTitle,
  link: { path: '/hanh-chinh?open=kt-giua-ki' },
};
const docs = [weekSchedule, gotTalentDoc(), midtermPlan];

function asAnswer(a: DocAnswer) {
  if (a.kind !== 'answer') throw new Error(`expected answer, got ${a.kind}`);
  return a;
}

describe('splitSections', () => {
  it('tách mục TẬP THỂ 10 dòng và CÁ NHÂN 8 dòng', () => {
    const secs = splitSections(GOT_TALENT_TEXT);
    const group = secs.find((s) => s.heading.includes('TẬP THỂ'));
    const solo = secs.find((s) => s.heading.includes('CÁ NHÂN'));
    expect(group?.lines).toHaveLength(10);
    expect(solo?.lines).toHaveLength(8);
    expect(group?.lines[0]).toBe('1. Lớp 6A1 – Hào khí Nam Quốc - Vũ đạo sử thi');
  });

  it('dòng in hoa (CHÚC MỪNG…, DANH SÁCH…) là heading nhưng không có dòng con', () => {
    const secs = splitSections(GOT_TALENT_TEXT);
    const list = secs.find((s) => s.heading.startsWith('DANH SÁCH'));
    expect(list?.lines).toEqual([]);
    expect(secs.filter((s) => s.lines.length > 0)).toHaveLength(2);
  });
});

describe('detectIntent / looksLikeNewsQuestion', () => {
  it('nhận đúng loại câu hỏi', () => {
    expect(detectIntent(normalize('Có bao nhiêu lớp vào chung kết?'))).toBe('count');
    expect(detectIntent(normalize('Lớp tôi có vào chung kết không?'))).toBe('membership');
    expect(detectIntent(normalize('Lớp 7A1 có trong danh sách không?'))).toBe('membership');
    expect(detectIntent(normalize('Chung kết ngày nào?'))).toBe('when');
    expect(detectIntent(normalize('Mấy giờ họp?'))).toBe('when');
    expect(detectIntent(normalize('lịch tuần'))).toBe('what');
  });

  it('nhận câu hỏi về văn bản/thông báo', () => {
    expect(looksLikeNewsQuestion(normalize('Thông báo mới nhất?'))).toBe(true);
    expect(looksLikeNewsQuestion(normalize('Chung kết Got Talent ngày nào?'))).toBe(true);
    expect(looksLikeNewsQuestion(normalize('Văn bản số 135/TB nói gì?'))).toBe(true);
    expect(looksLikeNewsQuestion(normalize('Cách ghi sổ đầu bài'))).toBe(false);
  });
});

describe('scoreDoc', () => {
  it('Got Talent vượt ngưỡng trả lời; văn bản nhiễu dưới ngưỡng gợi ý', () => {
    const q = normalize('Có bao nhiêu lớp vào chung kết Got Talent?');
    expect(scoreDoc(q, gotTalentDoc())).toBeGreaterThanOrEqual(DOC_ANSWER_MIN);
    expect(scoreDoc(q, weekSchedule)).toBeLessThan(DOC_SUGGEST_MIN);
    expect(scoreDoc(q, midtermPlan)).toBeLessThan(DOC_SUGGEST_MIN);
  });

  it('khớp số hiệu văn bản', () => {
    expect(scoreDoc(normalize('số 135/TB'), midtermPlan)).toBeGreaterThanOrEqual(DOC_ANSWER_MIN);
  });
});

describe('answerFromDocs — đếm', () => {
  it('18 tiết mục (10 tập thể, 8 cá nhân/nhóm), trích nguyên văn', () => {
    const a = asAnswer(answerFromDocs('Có bao nhiêu lớp vào chung kết Got Talent?', docs, {}));
    expect(a.intent).toBe('count');
    expect(a.doc.id).toBe('got-talent-5');
    expect(a.textVi).toContain('18');
    expect(a.textVi).toContain('10');
    expect(a.textVi).toContain('8');
    expect(a.textVi).toContain('18 tiết mục vào vòng chung kết (10 tập thể, 8 cá nhân/nhóm)');
    expect(a.textEn).toContain('18');
    expect(a.quotes).toEqual([
      'Ban Tổ chức xin chúc mừng 18 tiết mục (10 tập thể và 8 cá nhân/nhóm) đã được lựa chọn bước tiếp vào vòng Chung kết!',
    ]);
    for (const q of a.quotes) expect(GOT_TALENT_TEXT).toContain(q);
  });

  it('văn bản ghi lệch số dòng → nêu cả hai, không khẳng định', () => {
    const wrong = gotTalentDoc(GOT_TALENT_TEXT.replace('chúc mừng 18 tiết mục', 'chúc mừng 19 tiết mục'));
    const a = asAnswer(answerFromDocs('Có bao nhiêu lớp vào chung kết Got Talent?', [weekSchedule, wrong], {}));
    expect(a.intent).toBe('count');
    expect(a.textVi).toContain('19');
    expect(a.textVi).toContain('18');
    expect(a.textVi).toContain('vui lòng xem văn bản');
    expect(a.textVi).not.toMatch(/^Theo/);
  });

  it('câu hỏi khớp câu "19 tập thể … tham gia" → trích câu đó, không trả 18', () => {
    const a = asAnswer(answerFromDocs('Got Talent mùa 5 có bao nhiêu tập thể tham gia?', docs, {}));
    expect(a.intent).toBe('count');
    expect(a.textVi).toContain('19');
    expect(a.quotes).toHaveLength(1);
    expect(a.quotes[0]).toContain('19 tập thể');
    expect(a.textVi).not.toContain('18');
  });

  it('số con trong câu lệch số dòng từng mục (11/7 vs 10/8) → nêu cả hai, không khẳng định', () => {
    const wrong = gotTalentDoc(GOT_TALENT_TEXT.replace('(10 tập thể và 8 cá nhân/nhóm)', '(11 tập thể và 7 cá nhân/nhóm)'));
    const a = asAnswer(answerFromDocs('Có bao nhiêu lớp vào chung kết Got Talent?', [wrong], {}));
    expect(a.textVi).not.toMatch(/^Theo/);
    for (const n of ['11', '7', '10', '8', '18']) expect(a.textVi).toContain(n);
    expect(a.textVi).toContain('vui lòng xem văn bản');
  });

  it('"trong 39 tiết mục, 19 …" → lấy số ứng với tổng (19), không lấy số đầu', () => {
    const wrong = gotTalentDoc(
      GOT_TALENT_TEXT.replace(
        'xin chúc mừng 18 tiết mục (10 tập thể và 8 cá nhân/nhóm)',
        'trong 39 tiết mục, xin chúc mừng 19 tiết mục (10 tập thể và 8 cá nhân/nhóm)',
      ),
    );
    const a = asAnswer(answerFromDocs('Có bao nhiêu lớp vào chung kết Got Talent?', [wrong], {}));
    expect(a.textVi).toContain('Văn bản ghi 19;');
    expect(a.textVi).toContain('18 dòng');
  });

  it('có danh sách nhưng không câu nào nêu số → links (không tự đếm)', () => {
    const team: KnowledgeDoc = {
      id: 'doi-co-vua', source: 'admin_doc', title: 'Danh sách đội tuyển cờ vua',
      text: 'DANH SÁCH ĐỘI TUYỂN CỜ VUA\n1. Lớp 6A1\n2. Lớp 7A2', link: { path: '/hanh-chinh?open=doi-co-vua' },
    };
    expect(answerFromDocs('Đội tuyển cờ vua có bao nhiêu bạn?', [team], {}).kind).toBe('links');
  });
});

describe('answerFromDocs — văn bản không có mã lớp', () => {
  it('hỏi "lớp tôi" với danh sách không chứa mã lớp → links, không trả "không có"', () => {
    const plan: KnowledgeDoc = {
      id: 'kh-thi-giua-ki', source: 'admin_doc', title: 'Kế hoạch thi giữa kì 1',
      text: 'I. MỤC ĐÍCH\n1. Đánh giá kết quả học tập\n2. Rút kinh nghiệm dạy học',
      link: { path: '/hanh-chinh?open=kh-thi-giua-ki' },
    };
    const a = answerFromDocs('Lớp tôi có thi giữa kì không?', [...docs, plan], { ownClassId: '6A1' });
    expect(a.kind).toBe('links');
    if (a.kind === 'links') expect(a.docs[0].id).toBe('kh-thi-giua-ki');
  });
});

describe('detectIntent — "mấy" và "máy"', () => {
  it('"máy chiếu" không phải câu hỏi đếm; "mấy lớp" là câu hỏi đếm', () => {
    expect(detectIntent(normalize('Máy chiếu phòng 3 hỏng báo ai?'))).toBe('what');
    expect(detectIntent(normalize('Mấy lớp vào chung kết?'))).toBe('count');
  });
});

describe('answerFromDocs — lớp tôi có vào không', () => {
  const ask = 'Lớp tôi có vào chung kết Got Talent không?';

  it('6A1: tập thể có, cá nhân không có', () => {
    const a = asAnswer(answerFromDocs(ask, docs, { ownClassId: '6A1' }));
    expect(a.intent).toBe('membership');
    expect(a.textVi).toContain('6A1');
    expect(a.textVi).toContain('I. CÁC TIẾT MỤC TẬP THỂ: 1');
    expect(a.textVi).toContain('II. CÁC TIẾT MỤC CÁ NHÂN/NHÓM: không có');
    expect(a.quotes).toEqual(['1. Lớp 6A1 – Hào khí Nam Quốc - Vũ đạo sử thi']);
  });

  it('6A3 (lớp mình): tập thể không có, cá nhân 2, hiện tên HS', () => {
    const a = asAnswer(answerFromDocs(ask, docs, { ownClassId: '6A3' }));
    expect(a.textVi).toContain('TẬP THỂ: không có');
    expect(a.textVi).toContain('CÁ NHÂN/NHÓM: 2');
    expect(a.quotes.some((q) => q.includes('HS A'))).toBe(true);
    expect(a.quotes).toHaveLength(2);
  });

  it('hỏi lớp khác (6A3, mình 9A3): chỉ đếm, không hiện tên HS', () => {
    const a = asAnswer(answerFromDocs(ask, docs, { askedClassId: '6A3', ownClassId: '9A3' }));
    expect(a.textVi).toContain('6A3');
    expect(a.textVi).toContain('CÁ NHÂN/NHÓM: 2');
    expect(a.quotes.some((q) => q.includes('HS A'))).toBe(false);
    expect(a.quotes.join('\n')).not.toMatch(/HS [A-H]/);
  });

  it('lớp nêu trong câu hỏi (7A1) được dùng khi không có askedClassId', () => {
    const a = asAnswer(answerFromDocs('Lớp 7A1 có vào chung kết Got Talent không?', docs, { ownClassId: '9A3' }));
    expect(a.textVi).toContain('7A1');
    expect(a.textVi).toContain('TẬP THỂ: 1');
    expect(a.textVi).toContain('CÁ NHÂN/NHÓM: 1');
    expect(a.quotes.join('\n')).not.toContain('HS D');
  });

  it('9A1: cả hai mục không có', () => {
    const a = asAnswer(answerFromDocs(ask, docs, { ownClassId: '9A1' }));
    expect(a.textVi).toContain('TẬP THỂ: không có');
    expect(a.textVi).toContain('CÁ NHÂN/NHÓM: không có');
    expect(a.quotes).toEqual([]);
  });

  it('không biết lớp → hỏi lại lớp', () => {
    const a = answerFromDocs(ask, docs, {});
    expect(a.kind).toBe('ask_class');
    if (a.kind === 'ask_class') expect(a.doc.id).toBe('got-talent-5');
  });

  it('8A2 (lớp mình, 4 dòng) → trích tối đa 3 dòng', () => {
    const a = asAnswer(answerFromDocs(ask, docs, { ownClassId: '8A2' }));
    expect(a.textVi).toContain('TẬP THỂ: 1');
    expect(a.textVi).toContain('CÁ NHÂN/NHÓM: 3');
    expect(a.quotes.length).toBeLessThanOrEqual(3);
  });
});

describe('answerFromDocs — hỏi đếm theo lớp', () => {
  it('Lớp 6A3 có bao nhiêu tiết mục → đếm riêng lớp 6A3 (tập thể 0, cá nhân 2), không phải tổng 18', () => {
    const a = asAnswer(answerFromDocs('Lớp 6A3 có bao nhiêu tiết mục vào chung kết Got Talent?', docs, { ownClassId: '9A3' }));
    expect(a.intent).toBe('membership');
    expect(a.textVi).toContain('6A3');
    expect(a.textVi).toContain('TẬP THỂ: không có');
    expect(a.textVi).toContain('CÁ NHÂN/NHÓM: 2');
    expect(a.textVi).not.toContain('18');
    expect(a.quotes.join('\n')).not.toMatch(/HS [A-H]/);
  });

  it('Lớp tôi có mấy tiết mục (GVCN 6A3) → đếm lớp mình, hiện tên HS lớp mình', () => {
    const a = asAnswer(answerFromDocs('Lớp tôi có mấy tiết mục vào chung kết Got Talent?', docs, { ownClassId: '6A3' }));
    expect(a.intent).toBe('membership');
    expect(a.textVi).toContain('CÁ NHÂN/NHÓM: 2');
    expect(a.textVi).not.toContain('18');
    expect(a.quotes.some((q) => q.includes('HS A'))).toBe(true);
  });

  it('"lớp tôi" nhưng không có lớp chủ nhiệm → hỏi lại lớp, không trả tổng', () => {
    expect(answerFromDocs('Lớp tôi có mấy tiết mục vào chung kết Got Talent?', docs, {}).kind).toBe('ask_class');
  });

  it('"Tôi muốn biết…" không làm giảm điểm khớp → vẫn trả lời đếm', () => {
    const a = asAnswer(answerFromDocs('Tôi muốn biết có bao nhiêu lớp vào chung kết Got Talent', docs, {}));
    expect(a.intent).toBe('count');
    expect(a.doc.id).toBe('got-talent-5');
  });

  it('không nêu lớp → vẫn đếm cả văn bản', () => {
    const a = asAnswer(answerFromDocs('Có bao nhiêu lớp vào chung kết Got Talent?', docs, { ownClassId: '6A3' }));
    expect(a.intent).toBe('count');
  });
});

describe('answerFromDocs — khi nào: câu có ngày nhưng không liên quan', () => {
  it('chỉ có dòng ngày ban hành không khớp chủ đề → links, không trả ngày', () => {
    const memo: KnowledgeDoc = {
      id: 'tb-hop-ph', source: 'admin_doc', title: 'Thông báo họp phụ huynh học kì 1',
      text: 'Nhà trường tổ chức họp phụ huynh toàn trường.\nHà Nội, ngày 02/11/2026',
      link: { path: '/hanh-chinh?open=tb-hop-ph' },
    };
    const a = answerFromDocs('Họp phụ huynh học kì 1 khi nào?', [memo], {});
    expect(a.kind).toBe('links');
  });
});

describe('answerFromDocs — khi nào / không chắc', () => {
  it('Chung kết ngày nào → 13/11/2026, trích câu gốc', () => {
    const a = asAnswer(answerFromDocs('Chung kết Got Talent ngày nào?', docs, {}));
    expect(a.intent).toBe('when');
    expect(a.textVi).toContain('13/11/2026');
    expect(a.quotes).toHaveLength(1);
    expect(GOT_TALENT_TEXT).toContain(a.quotes[0]);
    expect(a.quotes[0]).toContain('13/11/2026');
  });

  it('câu không liên quan → none', () => {
    expect(answerFromDocs('giá xăng hôm nay', docs, {}).kind).toBe('none');
  });

  it('lịch tuần → doc Lịch tuần 45 đứng đầu', () => {
    const a = answerFromDocs('lịch tuần', docs, {});
    const top = a.kind === 'answer' ? a.doc : a.kind === 'links' ? a.docs[0] : null;
    expect(top?.id).toBe('lich-tuan-45');
  });

  it('chỉ khớp phần thân (không khớp tiêu đề) → links, không trả lời', () => {
    const a = answerFromDocs('tham gia', docs, {});
    expect(a.kind).toBe('links');
    if (a.kind === 'links') expect(a.docs.length).toBeLessThanOrEqual(3);
  });
});
