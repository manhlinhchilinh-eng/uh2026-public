import { describe, it, expect } from 'vitest';
import { parseStaffNames, suggestUsername, asciiSlug, matchAccounts } from '../utils/staffDirectory';

// Dữ liệu GIẢ, mô phỏng bố cục file của trường (cột họ đệm | tên tách đôi, nhiều cột nhạy cảm)
const rows: unknown[][] = [
  ['DANH SÁCH CÁN BỘ'],
  [],
  ['TT', 'Họ và tên ', null, 'Ngày sinh', 'Email', 'Điện thoại'],
  [1, 'Nguyễn Thị', 'An', '01/01/1990', 'a@x.vn', '0900000001'],
  [2, 'Trần Văn', 'Bình', '02/02/1985', 'b@x.vn', '0900000002'],
  [3, 'Lê', 'Đức', null, null, null],
  [null, 'Tổ Toán', null, null, null, null],
  [4, 'Nguyễn Thị', 'An', null, null, null],
  [5, null, null, null, null, null],
];

describe('Danh sách cán bộ: chỉ lấy họ tên', () => {
  it('ghép cột họ đệm + tên, bỏ trùng/dòng trống, KHÔNG lấy cột khác', () => {
    const r = parseStaffNames(rows);
    expect(r.headerRow).toBe(3);
    expect(r.names).toEqual(['Nguyễn Thị An', 'Trần Văn Bình', 'Lê Đức']); // "Tổ Toán" không có TT → bỏ
    expect(JSON.stringify(r)).not.toMatch(/0900|@x\.vn|1990/);
  });

  it('file 1 cột "Họ và tên" đầy đủ', () => {
    expect(parseStaffNames([['STT', 'Họ và tên', 'Chức vụ'], [1, 'Phạm Minh Châu', 'GV']]).names).toEqual(['Phạm Minh Châu']);
  });

  it('không có cột Họ và tên → rỗng', () => {
    expect(parseStaffNames([['a', 'b']])).toEqual({ names: [], headerRow: null });
  });
});

describe('Gợi ý tên đăng nhập theo mẫu ms/mr + đệm + tên + ums', () => {
  it('bỏ họ, bỏ dấu, đ → d', () => {
    expect(asciiSlug('Đỗ Đức')).toBe('doduc');
    expect(suggestUsername('Bùi Phương Anh', 'Cô', new Set())).toBe('msphuonganhums');
    expect(suggestUsername('Hoàng Long', 'Thầy', new Set())).toBe('mrlongums');
    expect(suggestUsername('Nguyễn Thị Thanh Huyền', 'Cô', new Set())).toBe('msthanhhuyenums');
    expect(suggestUsername('Lê Thị Huyền', 'Cô', new Set())).toBe('mshuyenums');
    expect(suggestUsername('Vũ Văn Long', 'Thầy', new Set(['mrlongums']))).toBe('mrlong2ums');
  });

  it('trùng thì thêm số; chưa chọn Thầy/Cô → chưa gợi ý', () => {
    expect(suggestUsername('Bùi Phương Anh', 'Cô', new Set(['msphuonganhums']))).toBe('msphuonganh2ums');
    expect(suggestUsername('Bùi Phương Anh', '', new Set())).toBeNull();
  });

  it('ghép tài khoản có sẵn theo họ tên (bỏ qua khi trùng tên 2 tài khoản)', () => {
    const users = [
      { uid: 'u1', displayName: 'Nguyễn Thị An', username: 'msthianums' },
      { uid: 'u2', displayName: 'Lê Đức', username: 'mrducums' },
      { uid: 'u3', displayName: 'Lê Đức', username: 'mrduc2ums' },
    ];
    const m = matchAccounts([{ fullName: 'nguyễn thị  an' }, { fullName: 'Lê Đức' }, { fullName: 'Lê Đức', uid: 'u3' }], users);
    expect(m.get('nguyễn thị an')?.uid).toBe('u1');
    expect(m.get('lê đức')?.uid).toBe('u3');
  });
});
