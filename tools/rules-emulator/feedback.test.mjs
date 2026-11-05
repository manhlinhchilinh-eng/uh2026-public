// Rules: Góp ý & lỗi qua Trợ lý (/feedback) — P1 ngày thi 05/11/2026.
// Chạy: npm run test:rules (Emulator, project demo — KHÔNG chạm sodaubai).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, writeBatch, collection, getDocs, query, where, Bytes } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ums-logbook', firestore: { rules: RULES, host: '127.0.0.1', port: 8091 } });
});
after(async () => env?.cleanup());

const USERS = { bgh: { roles: ['admin'] }, gv: { roles: ['gvbm'] }, gv2: { roles: ['gvbm'] }, ph: { roles: ['parent'] } };
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, u] of Object.entries(USERS)) await setDoc(doc(ctx.firestore(), 'users', uid), { uid, username: uid, ...u });
  });
});

const day = () => Math.floor(Date.now() / 86400000);
const fbDoc = (uid, seq, over = {}) => ({
  authorId: uid, authorName: uid, role: 'gvbm', kind: 'bug', message: 'Lỗi nút Gửi', question: '', page: '/leave',
  appVersion: 'index-x.js', imageCount: 0, day: day(), seq, status: 'new', createdAt: Date.now(), ...over,
});
const db = (uid) => env.authenticatedContext(uid).firestore();

test('GV gửi được góp ý của mình, id đúng uid_ngày_stt', async () => {
  await assertSucceeds(setDoc(doc(db('gv'), 'feedback', `gv_${day()}_1`), fbDoc('gv', 1)));
});
test('không gửi thay người khác, sai id, sai trạng thái, stt > 10, thừa trường', async () => {
  await assertFails(setDoc(doc(db('gv'), 'feedback', `gv2_${day()}_1`), fbDoc('gv2', 1)));
  await assertFails(setDoc(doc(db('gv'), 'feedback', `gv_${day()}_2`), fbDoc('gv', 1)));
  await assertFails(setDoc(doc(db('gv'), 'feedback', `gv_${day()}_1`), fbDoc('gv', 1, { status: 'done' })));
  await assertFails(setDoc(doc(db('gv'), 'feedback', `gv_${day()}_11`), fbDoc('gv', 11)));
  await assertFails(setDoc(doc(db('gv'), 'feedback', `gv_${day()}_1`), fbDoc('gv', 1, { hack: 1 })));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'feedback', `x_${day()}_1`), fbDoc('x', 1)));
});
test('không ghi đè bản đã gửi (giới hạn 10 bản/ngày)', async () => {
  await assertSucceeds(setDoc(doc(db('gv'), 'feedback', `gv_${day()}_1`), fbDoc('gv', 1)));
  await assertFails(setDoc(doc(db('gv'), 'feedback', `gv_${day()}_1`), fbDoc('gv', 1, { message: 'đè' })));
});
test('ảnh ghi cùng batch, ≤ imageCount, đúng định dạng', async () => {
  const g = db('gv');
  const b = writeBatch(g);
  b.set(doc(g, 'feedback', `gv_${day()}_1`), fbDoc('gv', 1, { imageCount: 1 }));
  b.set(doc(g, 'feedback', `gv_${day()}_1`, 'images', '0'), { data: Bytes.fromUint8Array(new Uint8Array(1000)), type: 'image/jpeg' });
  await assertSucceeds(b.commit());
  const b2 = writeBatch(g);
  b2.set(doc(g, 'feedback', `gv_${day()}_2`), fbDoc('gv', 2, { imageCount: 1 }));
  b2.set(doc(g, 'feedback', `gv_${day()}_2`, 'images', '1'), { data: Bytes.fromUint8Array(new Uint8Array(10)), type: 'image/jpeg' });
  await assertFails(b2.commit());
  const b3 = writeBatch(g);
  b3.set(doc(g, 'feedback', `gv_${day()}_3`), fbDoc('gv', 3, { imageCount: 1 }));
  b3.set(doc(g, 'feedback', `gv_${day()}_3`, 'images', '0'), { data: Bytes.fromUint8Array(new Uint8Array(10)), type: 'text/html' });
  await assertFails(b3.commit());
});
test('đọc: admin đọc tất cả; người gửi đọc bản của mình; người khác không đọc được', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'feedback', `gv_${day()}_1`), fbDoc('gv', 1));
  });
  await assertSucceeds(getDoc(doc(db('bgh'), 'feedback', `gv_${day()}_1`)));
  await assertSucceeds(getDoc(doc(db('gv'), 'feedback', `gv_${day()}_1`)));
  await assertSucceeds(getDocs(query(collection(db('gv'), 'feedback'), where('authorId', '==', 'gv'), where('day', '==', day()))));
  await assertFails(getDoc(doc(db('gv2'), 'feedback', `gv_${day()}_1`)));
  await assertFails(getDocs(collection(db('gv'), 'feedback')));
});
test('chỉ admin đổi trạng thái, chỉ các trường cho phép', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'feedback', `gv_${day()}_1`), fbDoc('gv', 1));
  });
  await assertSucceeds(updateDoc(doc(db('bgh'), 'feedback', `gv_${day()}_1`), { status: 'done', updatedAt: 1, updatedBy: 'bgh' }));
  await assertFails(updateDoc(doc(db('bgh'), 'feedback', `gv_${day()}_1`), { message: 'sửa' }));
  await assertFails(updateDoc(doc(db('gv'), 'feedback', `gv_${day()}_1`), { status: 'done' }));
});
