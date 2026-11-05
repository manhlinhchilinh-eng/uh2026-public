// Rules: điểm danh đầu tiết — tóm tắt `periodAttendance` trên sổ ngày + bảng Vắng/muộn hôm nay.
// Chạy: npm run test:rules (Emulator, project demo — KHÔNG chạm sodaubai).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ums-logbook',
    firestore: { rules: RULES, host: '127.0.0.1', port: 8091 },
  });
});
after(async () => env?.cleanup());

const USERS = {
  gvcn1: { roles: ['gvcn', 'gvbm'], assignedClassId: '6A1' },
  gvbm: { roles: ['gvbm'] },
  gt: { roles: ['giamthi'] },
  ph1: { roles: ['parent'], assignedClassId: '6A1', studentDocIds: ['6A1_01'] },
};
const DAY = '2026-10-28';
const baseline = { reportedBy: 'gvcn1', reportedAt: 1, session: 'morning', absences: [], earlyDepartures: [] };
const summary = (over = {}) => ({ at: 1, by: 'gvbm', byName: 'Cô B', subject: 'Toán', absentP: 0, absentK: 1, late: 1, early: 0, signed: false, ...over });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) await setDoc(doc(db, 'users', uid), { uid, username: uid, ...u });
    await setDoc(doc(db, `daily_logbooks/6A1_${DAY}`), {
      id: `6A1_${DAY}`, classId: '6A1', date: DAY, weekNumber: 9, totalPeriods: 8, isCompleted: false, status: 'draft',
      morningBaseline: baseline, preSessionAttendance: baseline, updatedAt: 1,
    });
    await setDoc(doc(db, `student_daily/111111_${DAY}`), {
      mhs: '111111', studentName: 'HS 1', classId: '6A1', date: DAY, morning: null, afternoon: null,
      periodAbsences: [{ periodIndex: 2, type: 'K', subject: 'Toán' }], earlyDeparture: null, updatedAt: 1,
    });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const book = (uid) => doc(as(uid), `daily_logbooks/6A1_${DAY}`);

test('GVBM (không phải GVCN) ghi tóm tắt điểm danh tiết lên sổ ngày', () =>
  assertSucceeds(updateDoc(book('gvbm'), { 'periodAttendance.2': summary() })));
test('GVBM cập nhật tóm tắt tiết đã có (ký cuối tiết)', async () => {
  await assertSucceeds(updateDoc(book('gvbm'), { 'periodAttendance.2': summary() }));
  await assertSucceeds(updateDoc(book('gvbm'), { 'periodAttendance.2': summary({ signed: true, early: 1 }) }));
});
test('GVBM ghi tóm tắt tiết không hợp lệ ("9") bị chặn', () =>
  assertFails(updateDoc(book('gvbm'), { 'periodAttendance.9': summary() })));
test('GVBM ghi periodAttendance không phải map bị chặn', () =>
  assertFails(updateDoc(book('gvbm'), { periodAttendance: 'x' })));
test('GVBM vẫn KHÔNG sửa điểm danh đầu buổi của GVCN', () =>
  assertFails(updateDoc(book('gvbm'), { 'morningBaseline.absences': [{ studentId: '1', studentName: 'HS 1', type: 'K' }], 'periodAttendance.2': summary() })));
test('GVCN lớp ghi tóm tắt được', () => assertSucceeds(updateDoc(book('gvcn1'), { 'periodAttendance.1': summary({ by: 'gvcn1' }) })));
test('PH không ghi được sổ ngày', () => assertFails(updateDoc(book('ph1'), { 'periodAttendance.2': summary() })));

// --- Bảng Vắng/muộn hôm nay (đọc 1 lần, có giới hạn) ---
test('Giám thị đọc sổ ngày mọi lớp theo ngày', () =>
  assertSucceeds(getDocs(query(collection(as('gt'), 'daily_logbooks'), where('date', '==', DAY), limit(60)))));
test('Giám thị đọc bản tin HS vắng/muộn theo ngày', () =>
  assertSucceeds(getDocs(query(collection(as('gt'), 'student_daily'), where('date', '==', DAY), limit(500)))));
test('PH không quét sổ ngày toàn trường', () =>
  assertFails(getDocs(query(collection(as('ph1'), 'daily_logbooks'), where('date', '==', DAY), limit(60)))));
test('PH không quét bản tin HS toàn trường', () =>
  assertFails(getDocs(query(collection(as('ph1'), 'student_daily'), where('date', '==', DAY), limit(500)))));
