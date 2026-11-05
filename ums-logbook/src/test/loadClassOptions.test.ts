import { describe, it, expect, beforeEach, vi } from 'vitest';

// Giả lập bản production: class_data.json bị thay bằng file rỗng.
vi.mock('../../data/class_data.json', () => ({ default: {} }));

import { loadClassOptions, withSelectedClass, ALL_CLASSES } from '../services/seedService';

describe('loadClassOptions (bản production không có dữ liệu mẫu)', () => {
  beforeEach(() => localStorage.clear());

  it('vẫn trả đủ 26 lớp, có 8A3 — ô chọn lớp không bị rơi về 6A1', () => {
    const list = loadClassOptions();
    expect(list.map((c) => c.id)).toEqual(ALL_CLASSES);
    expect(list).toHaveLength(26);
    const c8a3 = list.find((c) => c.id === '8A3');
    expect(c8a3).toMatchObject({ name: '8A3', grade: 8, gvcnId: 'msngoclinhums', gvcnName: '' });
  });

  it('bỏ qua ums_classes rỗng hoặc hỏng', () => {
    localStorage.setItem('ums_classes', '[]');
    expect(loadClassOptions()).toHaveLength(26);
    localStorage.setItem('ums_classes', '{not json');
    expect(loadClassOptions()).toHaveLength(26);
  });

  it('ums_classes cũ thiếu lớp (chỉ có 6A1) → vẫn bổ sung đủ, giữ dữ liệu sẵn có', () => {
    localStorage.setItem('ums_classes', JSON.stringify([{ id: '6A1', name: '6A1', studentCount: 30 }]));
    const list = loadClassOptions();
    expect(list).toHaveLength(26);
    expect(list.some((c) => c.id === '8A3')).toBe(true);
    expect(list.find((c) => c.id === '6A1')?.studentCount).toBe(30);
  });
});

describe('withSelectedClass', () => {
  it('thêm lớp đang xem nếu danh sách thiếu, để <select> không hiện nhầm lớp đầu', () => {
    const list = [{ id: '6A1', name: '6A1' }] as any;
    expect(withSelectedClass(list, '8A3').map((c) => c.id)).toEqual(['8A3', '6A1']);
    expect(withSelectedClass(list, '6A1')).toBe(list);
  });
});
