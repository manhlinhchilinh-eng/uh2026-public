import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const guarded = vi.fn();
vi.mock('../utils/firestoreGuard', () => ({ guardedGetDocs: (...a: unknown[]) => guarded(...a) }));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => ({ collection: a.slice(1) }),
  where: (...a: unknown[]) => ({ where: a }),
  limit: (n: number) => ({ limit: n }),
  query: (...a: unknown[]) => ({ query: a }),
}));

import { mapStudentDocs, fetchClassRosterFromFirestore, ROSTER_LIMIT } from '../services/rosterService';
import { roundScoreInput } from '../utils/scoring';
import { ScoreInput } from '../components/logbook/ScoreInput';

const doc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

describe('Danh sách HS lấy từ Firestore (bản LIVE không có dữ liệu mẫu)', () => {
  beforeEach(() => guarded.mockReset());

  it('chuyển doc /students → StudentDoc, bỏ HS nghỉ, sắp theo STT', () => {
    const list = mapStudentDocs(
      [
        { id: 'a', data: { className: '6A1', mhs: '991005', fullName: 'Đinh Hà An', stt: 2, gender: 'Nữ', active: true } },
        { id: 'b', data: { className: '6A1', mhs: 991004, fullName: 'Lương Quỳnh An', stt: '1', active: true } },
        { id: 'c', data: { className: '6A1', mhs: '261999', fullName: 'Đã chuyển', stt: 3, active: false } },
      ],
      '6A1'
    );
    expect(list.map((s) => [s.stt, s.mhs, s.name, s.classId])).toEqual([
      [1, '991004', 'Lương Quỳnh An', '6A1'],
      [2, '991005', 'Đinh Hà An', '6A1'],
    ]);
    expect(list[1]).toMatchObject({ id: '991005', gender: 'Nữ', grade: 6, status: 'active' });
  });

  it('truy vấn đúng 1 lớp, có giới hạn, qua firestoreGuard', async () => {
    guarded.mockResolvedValue({ docs: [doc('x', { className: '9A3', mhs: '1', fullName: 'HS 1', stt: 1 })] });
    const list = await fetchClassRosterFromFirestore('9A3');
    expect(list).toHaveLength(1);
    expect(guarded).toHaveBeenCalledTimes(1);
    const [tag, q] = guarded.mock.calls[0] as [string, any];
    expect(tag).toBe('students:class_roster');
    expect(JSON.stringify(q)).toContain('"className","==","9A3"');
    expect(JSON.stringify(q)).toContain(`{"limit":${ROSTER_LIMIT}}`);
  });
});

describe('Chấm điểm tiết theo bậc 0,5', () => {
  it('làm tròn về 0,5 gần nhất, nhận dấu phẩy, kẹp [0, max]', () => {
    expect(roundScoreInput('3,5', 4)).toBe(3.5);
    expect(roundScoreInput('3.3', 4)).toBe(3.5);
    expect(roundScoreInput('2.2', 4)).toBe(2);
    expect(roundScoreInput('9', 4)).toBe(4);
    expect(roundScoreInput('-1', 4)).toBe(0);
    expect(roundScoreInput('', 4)).toBe(0);
    expect(roundScoreInput(0.5, 1)).toBe(0.5);
  });

  it('ô điểm: gõ "3," không bị xóa; "3,5" nhận ngay; rời ô thì làm tròn; nút +/− đổi 0,5', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ScoreInput value={4} max={4} onChange={onChange} label="Học tập" />);
    const input = screen.getByLabelText('Điểm Học tập') as HTMLInputElement;
    expect(input.value).toBe('4');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '3,' } });
    expect(input.value).toBe('3,');
    fireEvent.change(input, { target: { value: '3,5' } });
    expect(onChange).toHaveBeenLastCalledWith(3.5);

    fireEvent.change(input, { target: { value: '2.3' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    rerender(<ScoreInput value={2.5} max={4} onChange={onChange} label="Học tập" />);
    expect(input.value).toBe('2,5');

    fireEvent.click(screen.getByLabelText('Tăng 0,5 điểm Học tập'));
    expect(onChange).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByLabelText('Giảm 0,5 điểm Học tập'));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });
});
