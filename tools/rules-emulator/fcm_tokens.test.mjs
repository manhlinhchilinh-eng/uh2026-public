// Rules: token thông báo đẩy (/fcm_tokens) — P2 ngày thi 05/11/2026.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ums-logbook', firestore: { rules: RULES, host: '127.0.0.1', port: 8091 } });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const tok = (uid, over = {}) => ({ uid, username: uid, tokens: ['t1'], topicsDone: false, updatedAt: Date.now(), ...over });

test('chủ tài khoản ghi/đọc token của mình', async () => {
  const db = env.authenticatedContext('gv').firestore();
  await assertSucceeds(setDoc(doc(db, 'fcm_tokens', 'gv'), tok('gv')));
  await assertSucceeds(getDoc(doc(db, 'fcm_tokens', 'gv')));
});
test('không ghi token người khác, không tự đánh dấu đã đăng ký nhóm, tối đa 3 máy, không thêm trường lạ', async () => {
  const db = env.authenticatedContext('gv').firestore();
  await assertFails(setDoc(doc(db, 'fcm_tokens', 'gv2'), tok('gv2')));
  await assertFails(setDoc(doc(db, 'fcm_tokens', 'gv'), tok('gv', { topicsDone: true })));
  await assertFails(setDoc(doc(db, 'fcm_tokens', 'gv'), tok('gv', { tokens: ['a', 'b', 'c', 'd'] })));
  await assertFails(setDoc(doc(db, 'fcm_tokens', 'gv'), tok('gv', { extra: 1 })));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'fcm_tokens', 'gv'), tok('gv')));
});
test('không đọc token người khác, không list', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'fcm_tokens', 'gv2'), tok('gv2')));
  const db = env.authenticatedContext('gv').firestore();
  await assertFails(getDoc(doc(db, 'fcm_tokens', 'gv2')));
  await assertFails(getDocs(collection(db, 'fcm_tokens')));
});
