// Rules: quyền ĐỌC sổ điểm môn học (gradebooks) và bản công bố (grade_reports) — 05/11/2026.
// GVCN đọc sổ mọi môn của lớp mình (không sửa); GV bộ môn đọc/ghi lớp-môn được phân công; PH/HS chỉ đọc bản công bố
// của đúng HS mình; HS lớp khác / PH khác không đọc được. Lớp 9A3 dữ liệu giả, không phải HS thật.
// Chạy: npm run test:rules (Emulator, project demo — KHÔNG chạm sodaubai).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ums-logbook', firestore: { rules: RULES, host: '127.0.0.1', port: 8091 } });
});
after(async () => env?.cleanup());

const YEAR = '2026-2027';
const USERS = {
  bgh: { roles: ['admin'] },
  gvcn9a3: { roles: ['gvcn', 'gvbm'], assignedClassId: '9A3' },
  gvcn6a1: { roles: ['gvcn'], assignedClassId: '6A1' },
  gvToan: { roles: ['gvbm'] },
  gvKhac: { roles: ['gvbm'] },
  ph: { roles: ['parent'], studentDocIds: ['9A3_01'], studentMhs: ['900001'], assignedClassId: '9A3' },
  hs: { roles: ['student'], studentDocIds: ['9A3_01'], studentMhs: ['900001'], assignedClassId: '9A3' },
  hsKhac: { roles: ['student'], studentDocIds: ['6A1_01'], studentMhs: ['900099'], assignedClassId: '6A1' },
  phKhac: { roles: ['parent'], studentDocIds: ['9A3_02'], studentMhs: ['900002'], assignedClassId: '9A3' },
};
const GB = `${YEAR}_HK1_9A3_toan`;
const REPORT = `${YEAR}_HK1_900001`;
const REPORT_HS2 = `${YEAR}_HK1_900002`;

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) await setDoc(doc(f, 'users', uid), { uid, username: uid, ...u });
    await setDoc(doc(f, 'grade_assignments', `${YEAR}_9A3_toan`), {
      year: YEAR, classId: '9A3', subjectKey: 'toan', subjectName: 'Toán', mode: 'score', txMin: 4, teacherUids: ['gvToan'],
    });
    await setDoc(doc(f, 'gradebooks', GB), {
      year: YEAR, term: 1, classId: '9A3', subjectKey: 'toan', subjectName: 'Toán', mode: 'score', txMin: 4, status: 'published',
      rows: { '900001': { tx: [10, 10, 10, 10], gk: 10, ck: 9.5, comment: '' }, '900002': { tx: [8, 8, 8, 8], gk: 7, ck: 7, comment: '' } },
      version: 1, updatedBy: 'gvToan',
    });
    for (const [id, mhs] of [[REPORT, '900001'], [REPORT_HS2, '900002']]) {
      await setDoc(doc(f, 'grade_reports', id), {
        mhs, classId: '9A3', year: YEAR, term: 1, lastSubjectKey: 'toan',
        subjects: { toan: { name: 'Toán', mode: 'score', tx: [10, 10, 10, 10], gk: 10, ck: 9.5, result: '9.8', comment: '', publishedAt: 1 } },
        updatedAt: 1, updatedBy: 'gvToan',
      });
    }
  });
});

const db = (uid) => env.authenticatedContext(uid).firestore();
const classBooks = (uid, classId) =>
  getDocs(query(collection(db(uid), 'gradebooks'), where('classId', '==', classId), where('year', '==', YEAR), where('term', '==', 1), limit(30)));

test('GVCN đọc sổ điểm mọi môn của lớp mình (get + list theo lớp)', async () => {
  await assertSucceeds(getDoc(doc(db('gvcn9a3'), 'gradebooks', GB)));
  await assertSucceeds(classBooks('gvcn9a3', '9A3'));
  await assertSucceeds(getDocs(query(collection(db('gvcn9a3'), 'gradebooks', GB, 'history'), limit(5))));
});

test('GVCN không sửa được điểm lớp mình khi không được phân công môn đó', async () => {
  const g = db('gvcn9a3');
  const snap = await getDoc(doc(g, 'gradebooks', GB));
  const d = snap.data();
  await assertFails(setDoc(doc(g, 'gradebooks', GB), { ...d, rows: { ...d.rows, '900001': { tx: [1, 1, 1, 1], gk: 1, ck: 1, comment: '' } }, version: 2, updatedBy: 'gvcn9a3' }));
});

test('GVCN lớp khác không đọc được sổ 9A3', async () => {
  await assertFails(getDoc(doc(db('gvcn6a1'), 'gradebooks', GB)));
  await assertFails(classBooks('gvcn6a1', '9A3'));
});

test('GV bộ môn đọc + sửa lớp-môn được phân công; GV khác thì không', async () => {
  await assertSucceeds(getDoc(doc(db('gvToan'), 'gradebooks', GB)));
  const d = (await getDoc(doc(db('gvToan'), 'gradebooks', GB))).data();
  await assertSucceeds(setDoc(doc(db('gvToan'), 'gradebooks', GB), { ...d, version: 2, updatedBy: 'gvToan' }));
  await assertFails(getDoc(doc(db('gvKhac'), 'gradebooks', GB)));
  await assertFails(classBooks('gvToan', '9A3')); // không liệt kê cả lớp nếu không phải GVCN
});

test('PH/HS không đọc sổ của cả lớp (chỉ đọc bản công bố của mình)', async () => {
  for (const uid of ['ph', 'hs']) {
    await assertFails(getDoc(doc(db(uid), 'gradebooks', GB)));
    await assertFails(classBooks(uid, '9A3'));
  }
});

test('PH và HS đọc được bản công bố của đúng HS đó', async () => {
  await assertSucceeds(getDoc(doc(db('ph'), 'grade_reports', REPORT)));
  await assertSucceeds(getDoc(doc(db('hs'), 'grade_reports', REPORT)));
  // chưa có bản công bố HK2 → đọc trả rỗng, không lỗi quyền
  await assertSucceeds(getDoc(doc(db('hs'), 'grade_reports', `${YEAR}_HK2_900001`)));
});

test('HS lớp khác / PH của HS khác không đọc được bản công bố', async () => {
  await assertFails(getDoc(doc(db('hsKhac'), 'grade_reports', REPORT)));
  await assertFails(getDoc(doc(db('phKhac'), 'grade_reports', REPORT)));
  await assertFails(getDoc(doc(db('hs'), 'grade_reports', REPORT_HS2)));
  await assertFails(getDocs(query(collection(db('hs'), 'grade_reports'), where('classId', '==', '9A3'), limit(50))));
});

test('Bản công bố: GVCN đúng lớp + BGH đọc; GV bộ môn / GVCN lớp khác không đọc', async () => {
  await assertSucceeds(getDoc(doc(db('gvcn9a3'), 'grade_reports', REPORT)));
  await assertSucceeds(getDoc(doc(db('bgh'), 'grade_reports', REPORT)));
  await assertFails(getDoc(doc(db('gvToan'), 'grade_reports', REPORT)));
  await assertFails(getDoc(doc(db('gvcn6a1'), 'grade_reports', REPORT)));
});

test('GV bộ môn vẫn công bố được phần môn mình (ghi merge, không cần đọc)', async () => {
  const { setDoc: _s } = await import('firebase/firestore');
  await assertSucceeds(
    _s(doc(db('gvToan'), 'grade_reports', `${YEAR}_HK1_900003`), {
      mhs: '900003', classId: '9A3', year: YEAR, term: 1, lastSubjectKey: 'toan',
      subjects: { toan: { name: 'Toán', mode: 'score', tx: [9, 9, 9, 9], gk: 9, ck: 9, result: '9', comment: '', publishedAt: 2 } },
      updatedAt: 2, updatedBy: 'gvToan',
    }, { merge: true })
  );
  await assertSucceeds(
    _s(doc(db('gvToan'), 'grade_reports', REPORT), {
      mhs: '900001', classId: '9A3', year: YEAR, term: 1, lastSubjectKey: 'toan',
      subjects: { toan: { name: 'Toán', mode: 'score', tx: [10, 10, 10, 9], gk: 10, ck: 9.5, result: '9.7', comment: '', publishedAt: 3 } },
      updatedAt: 3, updatedBy: 'gvToan',
    }, { merge: true })
  );
  // HS không tự ghi điểm
  await assertFails(_s(doc(db('hs'), 'grade_reports', REPORT), { mhs: '900001', year: YEAR, term: 1, lastSubjectKey: 'toan', subjects: { toan: { result: '10' } } }, { merge: true }));
});
