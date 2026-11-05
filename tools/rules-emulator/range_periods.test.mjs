// Rules: tải tiết toàn trường bằng 1 truy vấn collectionGroup('periods') theo dailyId in [...] (sửa N+1, 05/11).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDocs, query, where, collectionGroup, limit } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ums-logbook', firestore: { rules: RULES, host: '127.0.0.1', port: 8091 } });
});
after(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, roles] of [['bgh', ['admin']], ['tpt', ['tpt']], ['gv', ['gvbm']], ['ph', ['parent']]]) await setDoc(doc(db, 'users', uid), { uid, username: uid, roles });
    for (const c of ['6A1', '6A2']) for (const p of [1, 2]) {
      await setDoc(doc(db, `daily_logbooks/${c}_2026-11-05/periods/${p}`), { dailyId: `${c}_2026-11-05`, periodIndex: p, isSigned: true });
    }
  });
});

const q = (uid) => query(collectionGroup(env.authenticatedContext(uid).firestore(), 'periods'), where('dailyId', 'in', ['6A1_2026-11-05', '6A2_2026-11-05']), limit(16));

test('BGH / TPT / GV đọc tiết nhiều sổ trong 1 truy vấn', async () => {
  const s = await assertSucceeds(getDocs(q('bgh')));
  if (s.size !== 4) throw new Error(`size ${s.size}`);
  await assertSucceeds(getDocs(q('tpt')));
  await assertSucceeds(getDocs(q('gv')));
});
test('PH không đọc được', () => assertFails(getDocs(q('ph'))));
