// Rules: Đơn xin nghỉ học của PH (/student_leave) — PH gửi, GVCN duyệt.
// Chạy: npm run test:rules (Emulator, project demo — KHÔNG chạm sodaubai).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, deleteDoc, limit } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ums-logbook', firestore: { rules: RULES, host: '127.0.0.1', port: 8091 } });
});
after(async () => env?.cleanup());

const USERS = {
  ph1: { roles: ['parent'], studentMhs: ['HS001'] },
  ph2: { roles: ['parent'], studentMhs: ['HS002'] },
  hs1: { roles: ['student'], studentMhs: ['HS001'] },
  gv6a: { roles: ['gvcn'], assignedClassId: '6A' },
  gv6b: { roles: ['gvcn'], assignedClassId: '6B' },
  vp: { roles: ['vanphong'] },
  gt: { roles: ['giamthi'] },
  tpt1: { roles: ['tpt'] },
  bgh: { roles: ['admin'] },
};
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, u] of Object.entries(USERS)) await setDoc(doc(ctx.firestore(), 'users', uid), { uid, username: uid, ...u });
  });
});

const day = () => Math.floor(Date.now() / 86400000);
const db = (uid) => env.authenticatedContext(uid).firestore();
const lid = (uid, seq) => `${uid}_${day()}_${seq}`;
const leave = (uid, seq, over = {}) => ({
  mhs: 'HS001', studentName: 'Nguyễn Văn A', classId: '6A', parentUid: uid, parentName: 'PH A',
  kind: 'day', dates: ['2026-11-10'], periods: [], meal: false, reason: 'sick', note: '',
  status: 'pending', day: day(), seq, createdAt: Date.now(), ...over,
});
const seed = async (uid = 'ph1', seq = 1, over = {}) => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'student_leave', lid(uid, seq)), leave(uid, seq, over));
  });
  return lid(uid, seq);
};

test('PH tạo đơn cho con mình OK (cả ngày và theo tiết)', async () => {
  await assertSucceeds(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1)));
  await assertSucceeds(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 2)),
    leave('ph1', 2, { kind: 'periods', periods: [1, 2, 3], meal: true })));
});
test('PH tạo cho con người khác / thay PH khác / HS / GV / chưa đăng nhập → DENY', async () => {
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1, { mhs: 'HS002' })));
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph2', 1)), leave('ph2', 1)));
  await assertFails(setDoc(doc(db('hs1'), 'student_leave', lid('hs1', 1)), leave('hs1', 1)));
  await assertFails(setDoc(doc(db('gv6a'), 'student_leave', lid('gv6a', 1)), leave('gv6a', 1)));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'student_leave', lid('x', 1)), leave('x', 1)));
});
test('seq 6, sai id, sai ngày, sai trạng thái, thừa trường → DENY', async () => {
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 6)), leave('ph1', 6)));
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 2)), leave('ph1', 1)));
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1, { day: day() - 1 })));
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1, { status: 'approved' })));
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1, { hack: 1 })));
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1, { decidedBy: 'ph1' })));
});
test('không ghi đè đơn đã gửi (giới hạn 5 đơn/ngày)', async () => {
  await assertSucceeds(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1)));
  await assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1, { note: 'đè' })));
});
test('kiểm tra dữ liệu: kind/dates/periods/reason/note/độ dài', async () => {
  const bad = (over) => assertFails(setDoc(doc(db('ph1'), 'student_leave', lid('ph1', 1)), leave('ph1', 1, over)));
  await bad({ kind: 'week' });
  await bad({ dates: [] });
  await bad({ dates: ['1', '2', '3', '4', '5', '6'] });
  await bad({ kind: 'day', periods: [1] });
  await bad({ kind: 'periods', periods: [], meal: true });
  await bad({ kind: 'periods', periods: [9], meal: true });
  await bad({ kind: 'periods', periods: [1], dates: ['2026-11-10', '2026-11-11'], meal: true });
  await bad({ meal: 'yes' });
  await bad({ reason: 'khac' });
  await bad({ note: 'x'.repeat(301) });
  await bad({ classId: '6A12345' });
  await bad({ studentName: 'x'.repeat(81) });
  await bad({ parentName: 'x'.repeat(81) });
  await bad({ createdAt: 'now' });
});
test('đọc: PH chính chủ, GVCN đúng lớp, admin, văn phòng OK; PH khác, HS, GVCN lớp khác DENY', async () => {
  const id = await seed();
  await assertSucceeds(getDoc(doc(db('ph1'), 'student_leave', id)));
  await assertSucceeds(getDoc(doc(db('gv6a'), 'student_leave', id)));
  await assertSucceeds(getDoc(doc(db('bgh'), 'student_leave', id)));
  await assertSucceeds(getDoc(doc(db('vp'), 'student_leave', id)));
  await assertFails(getDoc(doc(db('ph2'), 'student_leave', id)));
  await assertFails(getDoc(doc(db('hs1'), 'student_leave', id)));
  await assertFails(getDoc(doc(db('gv6b'), 'student_leave', id)));
  const c = collection(db('gv6a'), 'student_leave');
  await assertSucceeds(getDocs(query(c, where('classId', '==', '6A'), where('status', '==', 'pending'), limit(50))));
  await assertSucceeds(getDocs(query(collection(db('ph1'), 'student_leave'), where('parentUid', '==', 'ph1'), limit(20))));
  await assertFails(getDocs(query(collection(db('ph1'), 'student_leave'), limit(20))));
});
test('thống kê nghỉ: giám thị, TPT đọc/list array-contains OK; HS, PH khác DENY', async () => {
  const id = await seed('ph1', 1, { status: 'approved' });
  const q = (u) => getDocs(query(collection(db(u), 'student_leave'),
    where('dates', 'array-contains', '2026-11-10'), where('status', '==', 'approved'), limit(200)));
  await assertSucceeds(getDoc(doc(db('gt'), 'student_leave', id)));
  await assertSucceeds(getDoc(doc(db('tpt1'), 'student_leave', id)));
  await assertSucceeds(q('gt'));
  await assertSucceeds(q('tpt1'));
  await assertFails(q('hs1'));
  const pend = await seed('ph1', 2, { status: 'pending' });
  await assertFails(getDoc(doc(db('gt'), 'student_leave', pend)));
  await assertFails(getDoc(doc(db('tpt1'), 'student_leave', pend)));
  await assertFails(getDocs(query(collection(db('gt'), 'student_leave'), where('dates', 'array-contains', '2026-11-10'), limit(50))));
  await assertFails(q('ph2'));
  await assertFails(getDoc(doc(db('ph2'), 'student_leave', id)));
  await assertFails(updateDoc(doc(db('gt'), 'student_leave', id), { note: 'x' }));
});
test('PH huỷ đơn chờ → cancelled OK; tự duyệt, sửa trường khác DENY', async () => {
  const id = await seed();
  await assertFails(updateDoc(doc(db('ph1'), 'student_leave', id), { status: 'approved', decidedAt: 1 }));
  await assertFails(updateDoc(doc(db('ph1'), 'student_leave', id), { status: 'cancelled', decidedAt: 1, note: 'sửa' }));
  await assertFails(updateDoc(doc(db('ph2'), 'student_leave', id), { status: 'cancelled', decidedAt: 1 }));
  await assertSucceeds(updateDoc(doc(db('ph1'), 'student_leave', id), { status: 'cancelled', decidedAt: Date.now() }));
});
test('đơn đã duyệt không huỷ được; đơn đã huỷ không duyệt được', async () => {
  const a = await seed('ph1', 1, { status: 'approved' });
  await assertFails(updateDoc(doc(db('ph1'), 'student_leave', a), { status: 'cancelled', decidedAt: 1 }));
  const c = await seed('ph1', 2, { status: 'cancelled' });
  await assertFails(updateDoc(doc(db('gv6a'), 'student_leave', c),
    { status: 'approved', decidedAt: 1, decidedBy: 'gv6a', decidedByName: 'GV' }));
});
test('GVCN lớp đúng duyệt/từ chối OK; lớp khác, GV bất kỳ, HS DENY', async () => {
  const id = await seed();
  const ok = { status: 'approved', decidedAt: Date.now(), decidedBy: 'gv6a', decidedByName: 'Cô A' };
  await assertFails(updateDoc(doc(db('gv6b'), 'student_leave', id), { ...ok, decidedBy: 'gv6b' }));
  await assertFails(updateDoc(doc(db('hs1'), 'student_leave', id), { ...ok, decidedBy: 'hs1' }));
  await assertFails(updateDoc(doc(db('vp'), 'student_leave', id), { ...ok, decidedBy: 'vp' }));
  await assertFails(updateDoc(doc(db('gv6a'), 'student_leave', id), { ...ok, decidedBy: 'someone' }));
  await assertFails(updateDoc(doc(db('gv6a'), 'student_leave', id), { ...ok, note: 'sửa' }));
  await assertFails(updateDoc(doc(db('gv6a'), 'student_leave', id), { ...ok, status: 'cancelled' }));
  await assertSucceeds(updateDoc(doc(db('gv6a'), 'student_leave', id), ok));
  const r = await seed('ph1', 2);
  await assertSucceeds(updateDoc(doc(db('gv6a'), 'student_leave', r),
    { status: 'rejected', decidedAt: Date.now(), decidedBy: 'gv6a', decidedByName: 'Cô A', rejectReason: 'Thiếu minh chứng' }));
});
test('đơn đã quyết định không đổi lại', async () => {
  const id = await seed('ph1', 1, { status: 'approved', decidedBy: 'gv6a' });
  await assertFails(updateDoc(doc(db('gv6a'), 'student_leave', id),
    { status: 'rejected', decidedAt: 1, decidedBy: 'gv6a', decidedByName: 'Cô A' }));
});
test('xoá: không ai xoá được', async () => {
  const id = await seed();
  await assertFails(deleteDoc(doc(db('ph1'), 'student_leave', id)));
  await assertFails(deleteDoc(doc(db('gv6a'), 'student_leave', id)));
  await assertFails(deleteDoc(doc(db('bgh'), 'student_leave', id)));
});
