import { beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ fetchAdminDocs: vi.fn(), fetchAdminDocsSince: vi.fn() }));
vi.mock('../services/adminDocService', () => svc);

import {
  ADMIN_DOC_FULL_TTL_MS,
  clearAdminDocCache,
  getAdminDocsCached,
  removeCachedAdminDoc,
  upsertCachedAdminDoc,
} from '../services/adminDocCache';
import { ADMIN_DOC_LIMIT, type AdminDoc } from '../utils/adminDocs';

const mk = (id: string, updatedAt: number, title = id): AdminDoc =>
  ({ id, title, category: 'van_ban', url: '', description: '', docNumber: '', issuedDate: '', pinned: false, authorId: 'a', authorName: 'A', createdAt: 1, updatedAt }) as AdminDoc;

const T0 = 1_000_000;

describe('adminDocCache', () => {
  beforeEach(() => {
    clearAdminDocCache();
    localStorage.clear();
    svc.fetchAdminDocs.mockReset().mockResolvedValue([mk('a', 100), mk('b', 200)]);
    svc.fetchAdminDocsSince.mockReset().mockResolvedValue([]);
  });

  it('lần đầu đọc đủ 1 lần, không đọc delta', async () => {
    const r = await getAdminDocsCached('u1', { now: T0 });
    expect(r.map((d) => d.id)).toEqual(['a', 'b']);
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(1);
    expect(svc.fetchAdminDocsSince).not.toHaveBeenCalled();
  });

  it('lần 2 sau 61 giây chỉ đọc delta theo maxUpdatedAt, ghép đè theo id', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    svc.fetchAdminDocsSince.mockResolvedValue([mk('a', 300, 'a mới'), mk('c', 250)]);
    const r = await getAdminDocsCached('u1', { now: T0 + 61_000 });
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(1);
    expect(svc.fetchAdminDocsSince).toHaveBeenCalledWith(200);
    expect(r.map((d) => d.id)).toEqual(['a', 'c', 'b']);
    expect(r[0].title).toBe('a mới');
  });

  it('lần 2 trong 60 giây: 0 lượt', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    await getAdminDocsCached('u1', { now: T0 + 30_000 });
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(1);
    expect(svc.fetchAdminDocsSince).not.toHaveBeenCalled();
  });

  it('quá TTL đầy đủ thì đọc lại toàn bộ', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    await getAdminDocsCached('u1', { now: T0 + ADMIN_DOC_FULL_TTL_MS + 1 });
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(2);
  });

  it('force đọc lại toàn bộ', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    await getAdminDocsCached('u1', { now: T0 + 1000, force: true });
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(2);
  });

  it('removeCachedAdminDoc: biến mất khỏi kết quả lần sau mà không đọc', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    removeCachedAdminDoc('u1', 'a');
    const r = await getAdminDocsCached('u1', { now: T0 + 1000 });
    expect(r.map((d) => d.id)).toEqual(['b']);
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(1);
    expect(svc.fetchAdminDocsSince).not.toHaveBeenCalled();
  });

  it('upsertCachedAdminDoc: thêm doc mới vào cache không đọc', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    upsertCachedAdminDoc('u1', mk('z', 900));
    const r = await getAdminDocsCached('u1', { now: T0 + 1000 });
    expect(r[0].id).toBe('z');
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(1);
  });

  it('phiên mới (RAM trống) dùng localStorage: chỉ đọc delta', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    const saved = localStorage.getItem('ums.adminDocs.v1.u1');
    clearAdminDocCache();
    localStorage.setItem('ums.adminDocs.v1.u1', saved!);
    await getAdminDocsCached('u1', { now: T0 + 5000 });
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(1);
    expect(svc.fetchAdminDocsSince).toHaveBeenCalledWith(200);
  });

  it('localStorage ném lỗi vẫn trả kết quả từ fetchAdminDocs', async () => {
    const g = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const s = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const r = await getAdminDocsCached('u9', { now: T0 });
    expect(r).toHaveLength(2);
    g.mockRestore();
    s.mockRestore();
  });

  it('clearAdminDocCache() không uid xoá mọi khóa', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    await getAdminDocsCached('u2', { now: T0 });
    clearAdminDocCache();
    expect(localStorage.getItem('ums.adminDocs.v1.u1')).toBeNull();
    expect(localStorage.getItem('ums.adminDocs.v1.u2')).toBeNull();
  });

  it('TTL đầy đủ là 3 ngày', () => {
    expect(ADMIN_DOC_FULL_TTL_MS).toBe(3 * 24 * 3600_000);
  });

  it('delta lỗi: trả bản cache, lần sau thử lại delta với mốc cũ', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    svc.fetchAdminDocsSince.mockRejectedValueOnce(new Error('offline'));
    const r = await getAdminDocsCached('u1', { now: T0 + 61_000 });
    expect(r.map((d) => d.id)).toEqual(['a', 'b']);
    await getAdminDocsCached('u1', { now: T0 + 62_000 });
    expect(svc.fetchAdminDocsSince).toHaveBeenCalledTimes(2);
    expect(svc.fetchAdminDocsSince).toHaveBeenLastCalledWith(200);
    warn.mockRestore();
  });

  it('uid rỗng: không đọc, không tạo khóa chung', async () => {
    expect(await getAdminDocsCached('')).toEqual([]);
    expect(svc.fetchAdminDocs).not.toHaveBeenCalled();
    expect(localStorage.getItem('ums.adminDocs.v1.')).toBeNull();
  });

  it('hai lời gọi đồng thời chỉ đọc 1 lần', async () => {
    const [x, y] = await Promise.all([getAdminDocsCached('u1', { now: T0 }), getAdminDocsCached('u1', { now: T0 })]);
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(1);
    expect(x).toBe(y);
  });

  it('ghép delta không vượt ADMIN_DOC_LIMIT, giữ bản mới nhất', async () => {
    const many = Array.from({ length: ADMIN_DOC_LIMIT }, (_, i) => mk(`d${i}`, 1000 + i));
    svc.fetchAdminDocs.mockResolvedValue(many);
    await getAdminDocsCached('u1', { now: T0 });
    svc.fetchAdminDocsSince.mockResolvedValue([mk('new', 99_999)]);
    const r = await getAdminDocsCached('u1', { now: T0 + 61_000 });
    expect(r).toHaveLength(ADMIN_DOC_LIMIT);
    expect(r[0].id).toBe('new');
    expect(r.some((d) => d.id === 'd0')).toBe(false);
  });

  it('upsert giữ nguyên maxUpdatedAt: delta kế tiếp dùng mốc cũ', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    upsertCachedAdminDoc('u1', mk('z', 900));
    await getAdminDocsCached('u1', { now: T0 + 61_000 });
    expect(svc.fetchAdminDocsSince).toHaveBeenCalledWith(200);
  });

  it('cô lập theo uid: cache u1 không phục vụ u2', async () => {
    await getAdminDocsCached('u1', { now: T0 });
    await getAdminDocsCached('u2', { now: T0 + 1000 });
    expect(svc.fetchAdminDocs).toHaveBeenCalledTimes(2);
  });
});
