import { describe, expect, it, vi } from 'vitest';
import faq from '../../../data/assistantFaq.json';
import { buildIndex, match, quickSuggestions, escalateDepartments, expandRoles, type AssistantRole, type FaqData } from '../assistantMatcher';
import { allowedPathsForRole } from '../assistantPaths';
import { normalize } from '../normalize';

const data = faq as unknown as FaqData;
const idx = buildIndex(data);
const ask = (q: string, role: AssistantRole, includeDrafts = false) =>
  match(idx, q, { role, includeDrafts, allowedPaths: allowedPathsForRole(role === 'guest' ? null : role) });

describe('normalize', () => {
  it('bỏ dấu, chữ thường, bỏ dấu câu', () => {
    expect(normalize('Xin nghỉ ỐM???')).toBe('xin nghi om');
    expect(normalize('Đổi')).toBe('doi');
  });
  it('chuỗi rỗng / khoảng trắng → none, không lỗi', () => {
    expect(ask('   ', 'gvbm').kind).toBe('none');
    expect(ask('', 'guest').kind).toBe('none');
  });
});

describe('Trợ lý trả lời đúng câu', () => {
  it('không dấu, có từ đệm', () => {
    const r = ask('xin nghi om lam the nao', 'gvbm');
    expect(r.kind).toBe('answer');
    expect(r.item?.id).toBe('leave-create');
    expect(r.actionAllowed).toBe(true);
    expect(r.department).toBeUndefined(); // hướng dẫn không kèm liên hệ
  });
  it('biến thể có dấu', () => expect(ask('nghỉ đột xuất', 'gvbm').item?.id).toBe('leave-create'));
  it('từ đồng nghĩa', () => expect(ask('xem lich day', 'gvbm').item?.id).toBe('timetable-view'));
  it('tiếng Anh', () => expect(ask('how do I request leave', 'gvbm').item?.id).toBe('leave-create'));
  it('việc ngoài UMS+ → liên hệ bộ phận, không nút', () => {
    const r = ask('hoc phi', 'parent');
    expect(r.kind).toBe('contact');
    expect(r.department?.id).toBe('ktct');
    expect(r.actionAllowed).toBe(false);
  });
});

describe('Không bịa', () => {
  it('câu lạ → chưa có câu trả lời, gợi ý Văn phòng', () => {
    const r = ask('truong co day boi khong', 'parent');
    expect(r.kind).toBe('none');
    expect(r.item).toBeUndefined();
    expect(r.department?.id).toBe('vanphong');
  });
  it('câu lạ có từ khóa bộ phận → không có bước hướng dẫn', () => {
    const r = ask('xe bus truong hom nay', 'parent');
    expect(['none', 'contact']).toContain(r.kind);
    expect(r.item?.steps?.length ?? 0).toBe(0);
  });
});

describe('Lọc theo vai trò', () => {
  it('PH hỏi việc của GV → vai trò khác, không nút', () => {
    const r = ask('ghi so dau bai', 'parent');
    expect(['other_role', 'none']).toContain(r.kind);
    expect(r.actionAllowed).toBe(false);
  });
  it('GV bộ môn hỏi "duyệt đơn nghỉ" → việc của BGH', () => {
    const r = ask('duyet don nghi', 'gvbm');
    expect(r.kind).toBe('other_role');
    expect(r.ownerRoles).toContain('admin');
    expect(r.actionAllowed).toBe(false);
  });
  it('khách: quên mật khẩu → Quản trị hệ thống', () => {
    const r = ask('quen mat khau', 'guest');
    expect(r.item?.id).toBe('guest-forgot-password');
    expect(r.department?.id).toBe('quantri');
  });
  it('khách hỏi chức năng nội bộ → cần đăng nhập, không lộ bước', () => {
    const r = ask('nhap diem', 'guest');
    expect(r.kind).toBe('login_required');
    expect(r.item).toBeUndefined();
  });
  it('khách không bao giờ có nút route nội bộ', () => {
    for (const it2 of data.items) {
      if (!it2.action?.path) continue;
      const r = ask(it2.question.vi, 'guest');
      if (r.item?.id === it2.id) expect(r.actionAllowed).toBe(false);
    }
  });
});

describe('Dữ liệu và trạng thái', () => {
  it('bản thật không trả câu nháp', () => {
    for (const it2 of data.items.filter((i) => i.status === 'cho_duyet')) {
      const roles = [...expandRoles(it2.roles, data.role_groups)];
      const r = ask(it2.question.vi, roles[0] as AssistantRole, false);
      expect(r.item?.id === it2.id && r.item.status === 'cho_duyet').toBe(false);
    }
  });
  it('id không trùng, bộ phận tồn tại, không có SĐT/email', () => {
    const ids = data.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const depts = new Set(data.departments.map((d) => d.id));
    for (const i of data.items) {
      if (i.department) expect(depts.has(i.department)).toBe(true);
      (i.escalate || []).forEach((d) => expect(depts.has(d)).toBe(true));
    }
    const raw = JSON.stringify(data);
    expect(raw).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(raw).not.toMatch(/(?<!\d)0\d{9}(?!\d)/);
  });
  it('≥ 60 câu đã duyệt', () => expect(data.items.filter((i) => i.status === 'da_duyet').length).toBeGreaterThanOrEqual(60));
  it('nút route: mọi câu đã duyệt có action.path → mọi vai trò được thấy câu đó mở được route', () => {
    const bad: string[] = [];
    for (const i of data.items.filter((x) => x.status === 'da_duyet' && x.action?.path)) {
      const roles = [...expandRoles(i.action!.roles || i.roles, data.role_groups)].filter((r) => r !== 'guest');
      for (const role of roles) {
        if (!allowedPathsForRole(role as never).has(i.action!.path!.split('?')[0])) bad.push(`${i.id}:${role}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('chip gợi ý nhanh đúng vai trò', () => {
    for (const role of Object.keys(data.quick_suggestions || {}) as AssistantRole[]) {
      for (const it2 of quickSuggestions(idx, role, false)) {
        expect(expandRoles(it2.roles, data.role_groups).has(role)).toBe(true);
        expect(it2.status).toBe('da_duyet');
      }
    }
  });
  it('bộ phận chuyển tiếp mặc định là Văn phòng', () => {
    expect(escalateDepartments(idx, undefined).map((d) => d.id)).toEqual(['vanphong']);
  });
});

describe('Hiệu năng, không gọi mạng', () => {
  it('1000 lần hỏi < 1 giây, không fetch', () => {
    const f = vi.spyOn(globalThis, 'fetch');
    const t = performance.now();
    for (let n = 0; n < 1000; n++) ask('xin nghi om lam the nao', 'gvbm');
    expect(performance.now() - t).toBeLessThan(1000);
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });
});
