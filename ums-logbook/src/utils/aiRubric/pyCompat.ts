/**
 * Tương thích hành vi Python để bản TypeScript cho kết quả GIỐNG HỆT bản Python (ums_growth_hub).
 */

/**
 * round(x, n) của Python: làm tròn theo giá trị nhị phân thật của số; khi đúng điểm giữa → làm tròn về số chẵn.
 * (JS toFixed làm tròn điểm giữa lên, Math.round làm tròn lên → khác Python.)
 */
export function pyRound(x: number, ndigits = 0): number {
  if (!Number.isFinite(x)) return x;
  // Khai triển thập phân CHÍNH XÁC của số nhị phân (không nhân x*10^n vì phép nhân tự làm tròn, vd. 2.675*100 = 267.5)
  const exact = Math.abs(x).toFixed(100);
  const dot = exact.indexOf('.');
  const rest = exact.slice(dot + 1 + ndigits);
  const isTie = rest[0] === '5' && /^0*$/.test(rest.slice(1));
  if (isTie) {
    // Điểm giữa thật sự (vd. 2.5, 0.125): Python làm tròn về chữ số chẵn
    const kept = exact.slice(0, dot + 1 + ndigits).replace(/\.$/, '');
    const lastDigit = Number(kept[kept.length - 1]);
    const truncated = Number(kept);
    const step = 10 ** -ndigits;
    const rounded = lastDigit % 2 === 0 ? truncated : truncated + step;
    return Math.sign(x) * Number(rounded.toFixed(ndigits));
  }
  // Ngoài điểm giữa: toFixed làm tròn theo giá trị nhị phân thật, giống Python
  return Number(x.toFixed(ndigits));
}

/** \b của Python 3 (Unicode): ranh giới giữa ký tự chữ/số/_ và ký tự khác. */
export const WB_BEFORE = '(?<![\\p{L}\\p{N}_])';
export const WB_AFTER = '(?![\\p{L}\\p{N}_])';

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** str.split() không tham số của Python: tách theo khoảng trắng, bỏ phần rỗng. */
export const pySplit = (s: string) => s.split(/\s+/u).filter(Boolean);
