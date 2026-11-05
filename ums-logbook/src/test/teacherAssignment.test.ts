import { describe, it, expect } from 'vitest';
import {
  attendanceClassIds,
  buildAliasIndex,
  canSaveAttendance,
  listTimetableAliases,
  myTeachingSlots,
  periodEditPolicy,
  normAlias,
  visibleLogbookClassIds,
  expandAliasVariants,
  missingAliasVariants,
  uniqueAliasLabels,
} from '../utils/teacherAssignment';

const sch = (classId: string, slots: Array<[number, number, string, string]>) => ({
  classId, academicYear: '2026-2027', semester: 1, updatedAt: 0,
  slots: slots.map(([d, p, subject, teacherName]) => ({ dayOfWeek: d, periodIndex: p, subject, teacherName, teacherUsername: '' })),
});
const schedules = {
  '9A3': sch('9A3', [[2, 1, 'Homeroom', 'Mr.Linh'], [2, 2, 'Maths', 'Ms Linh'], [3, 1, 'P.E', 'Mr Linh(P.E)'], [2, 5, 'Native 2', 'Native 1']]),
  '8A1': sch('8A1', [[2, 3, 'Eng 1', 'Mr.Linh'], [4, 1, 'Eng 2', 'mr.linh ']]),
};

describe('Gắn tên TKB với tài khoản GV', () => {
  it('liệt kê tên trên TKB, gộp hoa/thường/khoảng trắng', () => {
    const l = listTimetableAliases(schedules);
    expect(l.map((x) => x.alias)).toEqual(['Mr Linh(P.E)', 'Mr.Linh', 'Ms Linh', 'Native 1']);
    expect(l.find((x) => x.alias === 'Mr.Linh')).toMatchObject({ periods: 3, classes: ['8A1', '9A3'] });
  });

  it('phát hiện 2 người cùng nhận 1 tên', () => {
    const { byAlias, conflicts } = buildAliasIndex([
      { uid: 'a', username: 'mrlinh', displayName: 'Linh', aliases: ['Mr.Linh'] },
      { uid: 'b', username: 'mslinh', displayName: 'Linh nữ', aliases: ['Ms Linh', 'MR.LINH'] },
    ]);
    expect(conflicts).toEqual([normAlias('Mr.Linh')]);
    expect(byAlias.get('ms linh')?.[0].uid).toBe('b');
  });

  it('tiết dạy của tôi theo thứ, không lẫn tên gần giống', () => {
    const mon = myTeachingSlots(schedules, ['Mr.Linh'], 2);
    expect(mon.map((s) => `${s.classId}-${s.periodIndex}`)).toEqual(['9A3-1', '8A1-3']);
    expect(myTeachingSlots(schedules, ['Mr.Linh']).length).toBe(3);
    expect(myTeachingSlots(schedules, [])).toEqual([]);
  });
});

describe('Ai được ghi/chấm tiết', () => {
  const base = { assignedClassId: '9A3', myAliases: ['Mr.Linh'], claimedAliases: new Set(['mr.linh', 'ms linh']), classId: '9A3', slotTeacherName: 'Mr.Linh', isMySubstitution: false };

  it('BGH mọi tiết; TPT/Giám thị chỉ xem', () => {
    expect(periodEditPolicy({ ...base, activeRole: 'admin', slotTeacherName: 'Ms Linh' }).canEdit).toBe(true);
    expect(periodEditPolicy({ ...base, activeRole: 'tpt' }).reason).toBe('view_only_role');
    expect(periodEditPolicy({ ...base, activeRole: 'giamthi' }).canEdit).toBe(false);
    expect(periodEditPolicy({ ...base, activeRole: 'parent' }).canEdit).toBe(false);
  });

  it('GV thường: tiết của mình được, tiết người khác chỉ xem', () => {
    expect(periodEditPolicy({ ...base, activeRole: 'gvbm', classId: '8A1' }).canEdit).toBe(true);
    expect(periodEditPolicy({ ...base, activeRole: 'gvbm', slotTeacherName: 'Ms Linh' })).toEqual({ canEdit: false, reason: 'not_mine' });
    // GVBM không có lớp chủ nhiệm → không ghi thay tiết lớp nào
    expect(periodEditPolicy({ ...base, activeRole: 'gvbm', slotTeacherName: 'Native 1' }).canEdit).toBe(false);
  });

  it('GVCN: mọi tiết lớp mình (kể cả tiết GV khác đã nhận tên — lỗi thầy Đạt báo), lớp khác chỉ tiết của mình', () => {
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn' })).toEqual({ canEdit: true, reason: 'my_period' });
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', slotTeacherName: 'Ms Linh' })).toEqual({ canEdit: true, reason: 'homeroom' });
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', myAliases: [], slotTeacherName: 'Ms Linh' }).canEdit).toBe(true);
    // lớp khác: tiết người khác → không được ký
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', classId: '7A2', slotTeacherName: 'Ms Linh' })).toEqual({ canEdit: false, reason: 'not_mine' });
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', classId: '7A2', slotTeacherName: '' }).canEdit).toBe(false);
    // GVCN chưa được gán lớp → không coi là lớp mình
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', assignedClassId: null, slotTeacherName: 'Ms Linh' }).canEdit).toBe(false);
    // lớp trộn (skip) vẫn không chấm
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', slotTeacherName: 'Ms Linh', isMixed: true }).reason).toBe('mixed');
  });

  it('dạy thay đã duyệt được ghi', () => {
    expect(periodEditPolicy({ ...base, activeRole: 'gvbm', slotTeacherName: 'Ms Linh', isMySubstitution: true }).reason).toBe('substitute');
  });

  it('tiết GV chưa có tài khoản (Native, NN2) / TKB trống: GVCN lớp đó ghi thay, GV khác không', () => {
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', slotTeacherName: 'Native 1' }).reason).toBe('homeroom');
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', slotTeacherName: '' }).canEdit).toBe(true);
    expect(periodEditPolicy({ ...base, activeRole: 'gvcn', classId: '8A1', slotTeacherName: 'Native 1' }).canEdit).toBe(false);
    expect(periodEditPolicy({ ...base, activeRole: 'gvbm', slotTeacherName: 'Native 1' }).canEdit).toBe(false);
  });

  it('chưa chọn tên trên TKB → nhắc chọn', () => {
    expect(periodEditPolicy({ ...base, activeRole: 'gvbm', myAliases: [], slotTeacherName: 'Ms Linh' }).reason).toBe('no_alias');
  });
});

import { myPeriodsOnDate, dayOfWeekOf } from '../utils/teacherAssignment';

describe('Tiết cần ghi sổ trong ngày', () => {
  it('thứ của ngày', () => {
    expect(dayOfWeekOf('2026-10-12')).toBe(2); // Thứ Hai
    expect(dayOfWeekOf('2026-10-11')).toBe(8); // Chủ nhật
  });

  it('TKB + dạy thay đã duyệt, sắp theo tiết, không trùng', () => {
    const duties = [
      { date: '2026-10-12', classId: '7A2', periodIndex: 2, subject: 'Maths', status: 'approved', absentName: 'Cô B' },
      { date: '2026-10-12', classId: '7A3', periodIndex: 4, subject: 'Maths', status: 'planned' },
      { date: '2026-10-13', classId: '7A2', periodIndex: 1, subject: 'Maths', status: 'approved' },
      { date: '2026-10-12', classId: '9A3', periodIndex: 1, subject: 'Homeroom', status: 'approved' },
    ];
    const r = myPeriodsOnDate(schedules, ['Mr.Linh'], duties, '2026-10-12');
    expect(r.map((s) => `${s.periodIndex}-${s.classId}${s.substitute ? '(thay)' : ''}`)).toEqual(['1-9A3', '2-7A2(thay)', '3-8A1']);
  });
});

import { describeEditScope } from '../utils/teacherAssignment';

describe('Câu giải thích quyền ghi sổ', () => {
  it('gộp theo lý do', () => {
    expect(describeEditScope([1, 2].map((period) => ({ period, reason: 'admin' as const })))).toBe('BGH được sửa mọi tiết.');
    expect(
      describeEditScope([
        { period: 1, reason: 'my_period' },
        { period: 2, reason: 'not_mine' },
        { period: 5, reason: 'homeroom' },
        { period: 6, reason: 'homeroom' },
      ])
    ).toBe('Bạn được ghi/chấm tiết 1 (của bạn); tiết 5, 6 (lớp chủ nhiệm); các tiết khác chỉ xem.');
    expect(describeEditScope([{ period: 1, reason: 'not_mine' }])).toBe('Không có tiết nào của bạn — chỉ xem.');
    expect(describeEditScope([{ period: 1, reason: 'no_alias' }])).toBe('Bạn chưa chọn tên của mình trên TKB.');
    expect(describeEditScope([{ period: 1, reason: 'view_only_role' }])).toBe('Vai trò này chỉ xem sổ đầu bài.');
  });
});

describe('Lớp được xem ở Sổ đầu bài / Điểm danh đầu giờ (lỗi GV thấy mọi lớp)', () => {
  const all = ['6A1', '7A2', '8A1', '9A2', '9A3'];

  it('BGH/TPT/Giám thị: mọi lớp', () => {
    for (const r of ['admin', 'tpt', 'giamthi'] as const) {
      expect(visibleLogbookClassIds({ activeRole: r, allClassIds: all, schedules, myAliases: [] })).toEqual(all);
      expect(attendanceClassIds(r, null, all)).toEqual(all);
    }
  });

  it('GVCN: lớp chủ nhiệm đứng đầu + lớp có tiết mình dạy; không thấy lớp khác', () => {
    expect(visibleLogbookClassIds({ activeRole: 'gvcn', allClassIds: all, assignedClassId: '9A3', schedules, myAliases: ['Mr.Linh'] })).toEqual(['9A3', '8A1']);
    expect(visibleLogbookClassIds({ activeRole: 'gvcn', allClassIds: all, assignedClassId: '9A2', schedules, myAliases: [] })).toEqual(['9A2']);
  });

  it('GV thường chưa nhận tên TKB: không lớp nào (trước đây rơi về mọi lớp); có dạy thay thì thấy lớp đó', () => {
    expect(visibleLogbookClassIds({ activeRole: 'gvbm', allClassIds: all, schedules, myAliases: [] })).toEqual([]);
    expect(visibleLogbookClassIds({ activeRole: 'gvbm', allClassIds: all, schedules, myAliases: [], substituteClassIds: ['7A2'] })).toEqual(['7A2']);
    expect(visibleLogbookClassIds({ activeRole: 'gvbm', allClassIds: all, schedules, myAliases: ['Ms Linh'] })).toEqual(['9A3']);
  });

  it('Điểm danh đầu giờ: GVCN chỉ lớp chủ nhiệm, GVBM không lớp nào; chỉ BGH/GVCN đúng lớp được lưu', () => {
    expect(attendanceClassIds('gvcn', '9A2', all)).toEqual(['9A2']);
    expect(attendanceClassIds('gvcn', null, all)).toEqual([]);
    expect(attendanceClassIds('gvbm', null, all)).toEqual([]);
    expect(canSaveAttendance('gvcn', '9A2', '9A2')).toBe(true);
    expect(canSaveAttendance('gvcn', '9A2', '7A2')).toBe(false);
    expect(canSaveAttendance('admin', null, '7A2')).toBe(true);
    expect(canSaveAttendance('giamthi', null, '7A2')).toBe(false);
    expect(canSaveAttendance('gvbm', null, '7A2')).toBe(false);
  });
});

describe('Tên TKB nhiều cách viết (lỗi 05/11: GV ký tiết lớp khác bị chặn bởi rules)', () => {
  const nfc = 'Ms N.Yến';
  const nfd = 'Ms N.Yến'.normalize('NFD');
  const multi = {
    '6A1': { ...sch('6A1', [[2, 1, 'Literature', nfc]]) },
    '7A5': { ...sch('7A5', [[5, 4, 'UMS literature', nfd]]), slotMap: { '5_4': { teacherName: 'ms  n.yến ', teacherUsername: '' } } },
    '8A1': sch('8A1', [[2, 2, 'Maths', 'Ms Linh']]),
  } as any;

  it('UI coi là cùng 1 người nhưng chuỗi khác nhau', () => {
    expect(nfc === nfd).toBe(false);
    expect(normAlias(nfc)).toBe(normAlias(nfd));
  });

  it('bổ sung mọi cách viết thật trên TKB (slots + slotMap), không thêm tên người khác', () => {
    const out = expandAliasVariants([nfc], multi);
    expect(out[0]).toBe(nfc);
    expect(out).toContain(nfd);
    expect(out).toContain('ms  n.yến');
    expect(out).not.toContain('Ms Linh');
    expect(missingAliasVariants([nfc], multi)).toEqual(out.slice(1));
    expect(missingAliasVariants(out, multi)).toEqual([]);
  });

  it('giữ trong giới hạn 10 tên của rules', () => {
    // 15 cách viết khác nhau chỉ ở số khoảng trắng giữa → cùng 1 tên sau chuẩn hóa
    const many = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`C${i}`, sch(`C${i}`, [[2, 1, 'X', `Ms${' '.repeat(i + 1)}N.Yến`]])])) as any;
    const out = expandAliasVariants([nfc], many);
    expect(out.length).toBe(10);
    expect(out[0]).toBe(nfc);
  });
});

describe('uniqueAliasLabels', () => {
  it('ẩn cách viết phụ khi hiển thị', () => {
    expect(uniqueAliasLabels(['Ms N.Yến', 'Ms N.Yến'.normalize('NFD'), 'ms  n.yến', 'Mr.Linh'])).toEqual(['Ms N.Yến', 'Mr.Linh']);
  });
});

import { pickDefaultTeachingSlot } from '../utils/teacherAssignment';
describe('Tiết mặc định ở chế độ "Chấm tiết dạy của tôi" (không mặc định lớp chủ nhiệm)', () => {
  const ends = { 1: '08:15', 2: '09:10', 3: '10:05', 4: '11:00', 5: '13:45' };
  const slots = [{ classId: '9A2', periodIndex: 2 }, { classId: '6A1', periodIndex: 1 }, { classId: '7A2', periodIndex: 5 }];
  it('hôm nay: tiết đang dạy / sắp tới; hết giờ: tiết cuối', () => {
    expect(pickDefaultTeachingSlot(slots, '2026-11-05', ends, new Date(2026, 10, 5, 8, 30))?.classId).toBe('9A2');
    expect(pickDefaultTeachingSlot(slots, '2026-11-05', ends, new Date(2026, 10, 5, 7, 0))?.classId).toBe('6A1');
    expect(pickDefaultTeachingSlot(slots, '2026-11-05', ends, new Date(2026, 10, 5, 17, 0))?.classId).toBe('7A2');
  });
  it('ngày khác: tiết đầu tiên; không có tiết: null', () => {
    expect(pickDefaultTeachingSlot(slots, '2026-11-04', ends, new Date(2026, 10, 5, 8, 30))?.classId).toBe('6A1');
    expect(pickDefaultTeachingSlot([], '2026-11-05', ends)).toBeNull();
  });
});
