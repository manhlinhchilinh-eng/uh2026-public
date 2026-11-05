import { describe, it, expect, beforeEach } from 'vitest';
import { maskName, buildMasker, maskDom, MASKED_ID, isPresentationMode, setPresentationMode } from '../utils/presentation';

describe('Chế độ trình chiếu — che tên HS', () => {
  it('maskName giữ họ, viết tắt tên đệm và tên', () => {
    expect(maskName('Đinh Văn An')).toBe('Đinh V. A.');
    expect(maskName('Lương Quỳnh An')).toBe('Lương Q. A.');
    expect(maskName('Lê Ánh')).toBe('Lê Á.');
    expect(maskName('  Trần   thị   bích   ngọc ')).toBe('Trần T. B. N.');
  });

  it('che tên (cả VIẾT HOA) và mã HS đúng danh sách; tên dài khớp trước; không che nhầm', () => {
    const mask = buildMasker([
      { fullName: 'Đinh Hà An', mhs: '991005' },
      { fullName: 'Đinh Hà Anh', mhs: '991006' },
    ]);
    expect(mask('Vắng: Đinh Hà Anh, Đinh Hà An.')).toBe('Vắng: Đinh H. A., Đinh H. A..');
    expect(mask('ĐINH HÀ AN đi muộn')).toBe('ĐINH H. A. đi muộn');
    expect(mask('Mã HS 991005, mã khác 999999')).toBe(`Mã HS ${MASKED_ID}, mã khác 999999`);
    expect(mask('Đinh Hà Anhthư')).toBe('Đinh Hà Anhthư'); // không phải tên trong danh sách
    expect(mask('Cô Bùi Phương Anh')).toBe('Cô Bùi Phương Anh'); // tên GV không bị che
  });

  it('maskDom che text node, bỏ qua ô nhập liệu', () => {
    document.body.innerHTML = '<div><p>HS Đinh Hà An vắng</p><textarea>Đinh Hà An</textarea><span>991005</span></div>';
    const n = maskDom(document.body, buildMasker([{ fullName: 'Đinh Hà An', mhs: '991005' }]));
    expect(n).toBe(2);
    expect(document.querySelector('p')!.textContent).toBe('HS Đinh H. A. vắng');
    expect(document.querySelector('span')!.textContent).toBe(MASKED_ID);
    expect(document.querySelector('textarea')!.value).toBe('Đinh Hà An');
  });

  describe('bật/tắt lưu trên máy', () => {
    beforeEach(() => localStorage.clear());
    it('mặc định tắt; bật/tắt được', () => {
      expect(isPresentationMode()).toBe(false);
      setPresentationMode(true);
      expect(isPresentationMode()).toBe(true);
      setPresentationMode(false);
      expect(isPresentationMode()).toBe(false);
    });
  });
});
