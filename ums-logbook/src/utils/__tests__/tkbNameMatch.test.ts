import { describe, expect, it } from 'vitest';
import { matchTkbNames, parseTkbName, type StaffAccount, type TkbName } from '../tkbNameMatch';

// Tên giả — không phải GV thật
const staff: StaffAccount[] = [
  { uid: 'u1', username: 'msphuonganhums', displayName: 'Bùi Phương Anh', assignedClassId: '6A1' },
  { uid: 'u2', username: 'msphuonganh2ums', displayName: 'Nguyễn Thị Phương Anh' },
  { uid: 'u3', username: 'mskhanhbangums', displayName: 'Phạm Khánh Băng' },
  { uid: 'u4', username: 'msngocmaiums', displayName: 'Ngô Ngọc Mai' },
  { uid: 'u5', username: 'msmaiums', displayName: 'Nguyễn Thị Mai' },
  { uid: 'u6', username: 'mrtoanums', displayName: 'Lê Văn Toàn' },
  { uid: 'u7', username: 'msanhums', displayName: 'Trương Minh Ánh' },
  { uid: 'u8', username: 'msanums', displayName: 'Nguyễn Thúy An' },
  { uid: 'u9', username: 'native1ums', displayName: 'GV bản ngữ (Native 1)' },
  { uid: 'u10', username: 'mrquyetums', displayName: 'Bùi Văn Quyết' },
  { uid: 'u11', username: 'mrxuanquyetums', displayName: 'Vũ Xuân Quyết' },
];
const n = (name: string, homeroomClasses: string[] = []): TkbName => ({ name, subjects: [], homeroomClasses });
const one = (name: string, hr: string[] = []) => matchTkbNames([n(name, hr)], staff)[0];

describe('parseTkbName', () => {
  it('tách danh xưng, chữ viết tắt, tên, gợi ý môn', () => {
    expect(parseTkbName('Ms P.Anh(Eng)')).toEqual({ title: 'ms', initials: ['p'], given: ['anh'], hint: 'eng' });
    expect(parseTkbName('M.K.Băng')).toEqual({ title: null, initials: ['k'], given: ['băng'], hint: '' });
    expect(parseTkbName('Ms NgMai')).toEqual({ title: 'ms', initials: ['ng'], given: ['mai'], hint: '' });
    expect(parseTkbName('Ms,Q.Nga').given).toEqual(['nga']);
    expect(parseTkbName('Ms Mai Anh').given).toEqual(['mai', 'anh']);
  });
});

describe('matchTkbNames', () => {
  it('chữ viết tắt phân biệt người cùng tên', () => {
    expect(one('M.K.Băng').account?.username).toBe('mskhanhbangums');
    expect(one('Ms NgMai').account?.username).toBe('msngocmaiums');
  });
  it('giữ dấu: "Ms An" khác "Ms Ánh"', () => {
    expect(one('Ms An').account?.username).toBe('msanums');
    expect(one('Ms Ánh').account?.username).toBe('msanhums');
  });
  it('danh xưng Mr/Ms lọc theo username', () => {
    expect(one('Mr Toàn').account?.username).toBe('mrtoanums');
    expect(one('Ms Toàn').status).toBe('none');
  });
  it('hòa nhau → GVCN lớp mình dạy Homeroom; không có → để người dùng chọn', () => {
    expect(one('Ms P.Anh', ['6A1'])).toMatchObject({ status: 'auto', note: 'GVCN 6A1' });
    expect(one('Ms P.Anh').status).toBe('ambiguous');
    expect(one('Mr Quyết').candidates.map((c) => c.username).sort()).toEqual(['mrquyetums', 'mrxuanquyetums']);
  });
  it('bỏ GV cấp 3 (CNN3), lớp trộn NN2; Native → tài khoản mặc định', () => {
    expect(one('CNN3. M.Hương').status).toBe('skip');
    expect(one('NN2_1').status).toBe('skip');
    expect(one('Native 1').account?.username).toBe('native1ums');
  });
});
