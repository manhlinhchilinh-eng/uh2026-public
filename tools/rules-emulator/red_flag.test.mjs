// Rules: sổ cờ đỏ /red_flag_weekly — TPT/BGH nhập, nhân sự xem, PH/HS không xem.
// Chạy: npm run test:rules (Emulator, project demo — KHÔNG chạm sodaubai).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ums-logbook', firestore: { rules: RULES, host: '127.0.0.1', port: 8091 } });
});
after(async () => env?.cleanup());

const USERS = {
  tpt: { roles: ['tpt'] },
  bgh: { roles: ['admin'] },
  gv: { roles: ['gvcn', 'gvbm'], assignedClassId: '7A1' },
  gt: { roles: ['giamthi'] },
  ph: { roles: ['parent'] },
};
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, u] of Object.entries(USERS)) await setDoc(doc(ctx.firestore(), 'users', uid), { uid, username: uid, ...u });
  });
});
const as = (uid) => env.authenticatedContext(uid).firestore();
const W = '2026-11-09';
const flag = (uid, over = {}) => ({ weekStart: W, classId: '7A1', score: 90, maxScore: 100, note: '', updatedBy: uid, updatedByName: uid, updatedAt: 1, ...over });
const ref = (uid, id = `${W}_7A1`) => doc(as(uid), 'red_flag_weekly', id);

test('TPT nhập điểm cờ đỏ', () => assertSucceeds(setDoc(ref('tpt'), flag('tpt'))));
test('BGH nhập điểm cờ đỏ', () => assertSucceeds(setDoc(ref('bgh'), flag('bgh'))));
test('GV / Giám thị KHÔNG nhập', async () => {
  await assertFails(setDoc(ref('gv'), flag('gv')));
  await assertFails(setDoc(ref('gt'), flag('gt')));
});
test('Điểm vượt thang / âm / id lệch / mạo danh người nhập → chặn', async () => {
  await assertFails(setDoc(ref('tpt'), flag('tpt', { score: 101 })));
  await assertFails(setDoc(ref('tpt'), flag('tpt', { score: -1 })));
  await assertFails(setDoc(ref('tpt', `${W}_7A2`), flag('tpt')));
  await assertFails(setDoc(ref('tpt'), flag('bgh')));
  await assertFails(setDoc(ref('tpt'), flag('tpt', { extra: 1 })));
});
test('Nhân sự xem; PH không xem', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'red_flag_weekly', `${W}_7A1`), flag('tpt')));
  await assertSucceeds(getDoc(ref('gv')));
  await assertSucceeds(getDoc(ref('gt')));
  await assertFails(getDoc(ref('ph')));
});
test('TPT xóa được, GV không', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'red_flag_weekly', `${W}_7A1`), flag('tpt')));
  await assertFails(deleteDoc(ref('gv')));
  await assertSucceeds(deleteDoc(ref('tpt')));
});

// Sổ cờ đỏ theo ngày /red_flag_daily/{date} — nhập từ file Sổ Sao Đỏ (05/11 tối)
const D = '2026-11-05';
const dayDoc = (uid, over = {}) => ({
  date: D,
  weekStart: '2026-11-02',
  classes: { '6A1': { d: 3, n: 1, items: [{ v: 'Đi học muộn', p: 3, n: 1 }] }, '6A5': { d: 0, n: 0, items: [] } },
  updatedBy: uid,
  updatedByName: uid,
  updatedAt: 1,
  ...over,
});
const dref = (uid, id = D) => doc(as(uid), 'red_flag_daily', id);

test('Sổ ngày: TPT / BGH nhập; GV / Giám thị / PH không', async () => {
  await assertSucceeds(setDoc(dref('tpt'), dayDoc('tpt')));
  await assertSucceeds(setDoc(dref('bgh'), dayDoc('bgh')));
  await assertFails(setDoc(dref('gv'), dayDoc('gv')));
  await assertFails(setDoc(dref('gt'), dayDoc('gt')));
  await assertFails(setDoc(dref('ph'), dayDoc('ph')));
});
test('Sổ ngày: id lệch ngày / mạo danh / trường lạ / classes không phải map → chặn', async () => {
  await assertFails(setDoc(dref('tpt', '2026-11-06'), dayDoc('tpt')));
  await assertFails(setDoc(dref('tpt'), dayDoc('bgh')));
  await assertFails(setDoc(dref('tpt'), dayDoc('tpt', { names: ['A'] })));
  await assertFails(setDoc(dref('tpt'), dayDoc('tpt', { classes: 'x' })));
});
test('Sổ ngày: nhân sự xem; PH không xem', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'red_flag_daily', D), dayDoc('tpt')));
  await assertSucceeds(getDoc(dref('gv')));
  await assertSucceeds(getDoc(dref('gt')));
  await assertFails(getDoc(dref('ph')));
});
