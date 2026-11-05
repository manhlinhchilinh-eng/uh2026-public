// Rules: ai được ghi/ký tiết sổ đầu bài & điểm danh đầu giờ (lỗi 05/11: GV ký/điểm danh được lớp khác; GVCN không mở được tiết GV khác đã nhận tên).
// Chạy: npm run test:rules (Emulator, project demo — KHÔNG chạm sodaubai).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ums-logbook',
    firestore: { rules: RULES, host: '127.0.0.1', port: 8091 },
  });
});
after(async () => env?.cleanup());

const DAY = '2026-11-05'; // Thứ Năm → dayOfWeek 5 (quy ước app: 2 = Thứ Hai)
const DOW = 5;
const USERS = {
  admin: { roles: ['admin'], username: 'admin' },
  gvcn7a2: { roles: ['gvcn', 'gvbm'], assignedClassId: '7A2', username: 'gvcn7a2' },
  gvcn9a2: { roles: ['gvcn', 'gvbm'], assignedClassId: '9A2', username: 'gvcn9a2' },
  mai: { roles: ['gvbm'], username: 'mai' },
  gt: { roles: ['giamthi'], username: 'gt' },
};
const scores = { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 };
const period = (uid, p, over = {}) => ({
  id: `${p}`, dailyId: `7A2_${DAY}`, classId: '7A2', dayOfWeek: DOW, periodIndex: p,
  teacherId: uid, teacherName: uid, scores, isSigned: true, ...over,
});
const blank = { reportedBy: '', reportedAt: 1, session: 'morning', absences: [], earlyDepartures: [], notes: '' };
const filled = { ...blank, reportedBy: 'x', reportedByName: 'Cô X', absences: [{ studentId: '1', studentName: 'HS 1', type: 'K' }] };
const book = (classId, over = {}) => ({
  id: `${classId}_${DAY}`, classId, date: DAY, dayOfWeek: DOW, weekNumber: 10, totalPeriods: 8,
  status: 'draft', isCompleted: false, morningBaseline: blank, afternoonBaseline: { ...blank, session: 'afternoon' },
  preSessionAttendance: blank, updatedAt: 1, ...over,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) await setDoc(doc(db, 'users', uid), { uid, ...u });
    await setDoc(doc(db, 'teacher_aliases/mai'), { uid: 'mai', aliases: ['Ms Mai'] });
    await setDoc(doc(db, 'teacher_aliases/gvcn9a2'), { uid: 'gvcn9a2', aliases: ['Ms C.Yen'] });
    // TKB 7A2 thứ Năm: tiết 1 Ms Mai, tiết 2 Ms C.Yen (GVCN 9A2 dạy), tiết 3 trống trên TKB
    await setDoc(doc(db, 'schedules/7A2'), {
      classId: '7A2',
      slotMap: {
        [`${DOW}_1`]: { teacherName: 'Ms Mai', teacherUsername: '', subject: 'Phy' },
        [`${DOW}_2`]: { teacherName: 'Ms C.Yen', teacherUsername: '', subject: 'Chem' },
      },
    });
    await setDoc(doc(db, `daily_logbooks/7A2_${DAY}`), book('7A2'));
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const periodRef = (uid, p, cls = '7A2') => doc(as(uid), `daily_logbooks/${cls}_${DAY}/periods/${p}`);

// --- Ký tiết ---
test('GV bộ môn ký tiết của mình theo TKB', () => assertSucceeds(setDoc(periodRef('mai', 1), period('mai', 1))));
test('GV bộ môn KHÔNG ký tiết người khác', () => assertFails(setDoc(periodRef('mai', 2), period('mai', 2))));
test('GV bộ môn KHÔNG ký tiết trống trên TKB của lớp khác', () => assertFails(setDoc(periodRef('mai', 3), period('mai', 3))));
test('GV bộ môn gửi classId giả (lớp khác) để vượt TKB → bị chặn', () =>
  assertFails(setDoc(periodRef('mai', 2), period('mai', 2, { classId: '9A2' }))));
test('GV bộ môn gửi dayOfWeek giả (CN) để vượt TKB → bị chặn', () =>
  assertFails(setDoc(periodRef('mai', 2), period('mai', 2, { dayOfWeek: 8 }))));
test('GV bộ môn ở lớp chưa có TKB → bị chặn (trước đây lọt)', () =>
  assertFails(setDoc(periodRef('mai', 1, '6A1'), period('mai', 1, { classId: '6A1', dailyId: `6A1_${DAY}` }))));
test('GVCN ký MỌI tiết lớp mình, kể cả tiết GV khác đã nhận tên (lỗi thầy Đạt)', async () => {
  await assertSucceeds(setDoc(periodRef('gvcn7a2', 2), period('gvcn7a2', 2)));
  await assertSucceeds(setDoc(periodRef('gvcn7a2', 1), period('gvcn7a2', 1)));
  await assertSucceeds(setDoc(periodRef('gvcn7a2', 3), period('gvcn7a2', 3)));
});
test('GVCN lớp khác chỉ ký tiết mình dạy ở lớp này, không ký tiết người khác', async () => {
  await assertSucceeds(setDoc(periodRef('gvcn9a2', 2), period('gvcn9a2', 2)));
  await assertFails(setDoc(periodRef('gvcn9a2', 1), period('gvcn9a2', 1)));
  await assertFails(setDoc(periodRef('gvcn9a2', 3), period('gvcn9a2', 3)));
});
test('GVCN không ghi đè tiết GV khác đã ký', async () => {
  await assertSucceeds(setDoc(periodRef('mai', 1), period('mai', 1)));
  await assertFails(setDoc(periodRef('gvcn7a2', 1), period('gvcn7a2', 1)));
});
test('Giám thị không ký tiết', () => assertFails(setDoc(periodRef('gt', 1), period('gt', 1))));
test('BGH ký mọi tiết', () => assertSucceeds(setDoc(periodRef('admin', 2), period('admin', 2))));

// --- Điểm danh đầu giờ ---
const bookRef = (uid, cls) => doc(as(uid), `daily_logbooks/${cls}_${DAY}`);
test('GVCN 9A2 KHÔNG sửa điểm danh đầu giờ lớp 7A2 (sổ đã có)', () =>
  assertFails(updateDoc(bookRef('gvcn9a2', '7A2'), { morningBaseline: filled, preSessionAttendance: filled })));
test('GVCN 9A2 KHÔNG tạo sổ lớp khác kèm điểm danh đầu giờ (sổ chưa có — lỗ cũ)', () =>
  assertFails(setDoc(bookRef('gvcn9a2', '8A1'), book('8A1', { morningBaseline: filled, preSessionAttendance: filled }))));
test('GV khác vẫn tạo được sổ trống khi ghi tiết đầu tiên', () =>
  assertSucceeds(setDoc(bookRef('mai', '8A1'), book('8A1'))));
test('Tạo sổ với classId lệch dailyId → bị chặn', () =>
  assertFails(setDoc(bookRef('mai', '8A1'), book('8A1', { classId: '9A2' }))));
test('GVCN tạo sổ lớp mình kèm điểm danh', () =>
  assertSucceeds(setDoc(bookRef('gvcn9a2', '9A2'), book('9A2', { morningBaseline: filled }))));
test('GVCN sửa điểm danh lớp mình', () =>
  assertSucceeds(updateDoc(bookRef('gvcn7a2', '7A2'), { morningBaseline: filled, preSessionAttendance: filled })));
test('BGH sửa điểm danh mọi lớp', () =>
  assertSucceeds(updateDoc(bookRef('admin', '7A2'), { morningBaseline: filled })));

// --- Lỗi 05/11: tên TKB khác cách viết (dấu NFD / hoa-thường / khoảng trắng) ---
test('Tên đã lưu khác cách viết với TKB (NFC vs NFD) → rules chặn (tái hiện lỗi)', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'schedules/7A2'), { classId: '7A2', slotMap: { [`${DOW}_4`]: { teacherName: 'Ms N.Yến'.normalize('NFD'), teacherUsername: '', subject: 'UMS literature' } } });
    await setDoc(doc(db, 'teacher_aliases/mai'), { uid: 'mai', aliases: ['Ms N.Yến'] });
  });
  await assertFails(setDoc(periodRef('mai', 4), period('mai', 4)));
});
test('Lưu kèm mọi cách viết (expandAliasVariants) → ký được', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'schedules/7A2'), { classId: '7A2', slotMap: { [`${DOW}_4`]: { teacherName: 'Ms N.Yến'.normalize('NFD'), teacherUsername: '', subject: 'UMS literature' } } });
  });
  // GV tự lưu tên của mình (rules teacher_aliases cho phép ghi doc của chính mình)
  await assertSucceeds(setDoc(doc(as('mai'), 'teacher_aliases/mai'), { uid: 'mai', aliases: ['Ms N.Yến', 'Ms N.Yến'.normalize('NFD')] }));
  await assertSucceeds(setDoc(periodRef('mai', 4), period('mai', 4)));
});
