// E2E (05/11, góp ý sau demo — cụm A): in sổ hiện tiết GV khác đã ký; BGH thấy đủ tiết chưa ký theo TKB;
// lịch sử đơn nghỉ đã xử lý; ngày nghỉ trong hồ sơ năng lực GV; chi tiết bảng công.
// Dùng: cd tools/e2e && node gop_y_a_dev.mjs [thư mục lưu ảnh]
// Chạy trên sodaubai-dev; ghi tạm dữ liệu thử (1 tiết đã ký, 1 đơn nghỉ, 1 kỳ công) rồi dọn/khôi phục.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const SHOTS = process.argv[2] || null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const PORT = Number(process.env.E2E_PORT || 5178);
const BASE = `http://localhost:${PORT}`;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();
const uidOf = async (u) => (await adb.collection('users').where('username', '==', u).get()).docs[0]?.id;

const GVCN = await uidOf('msphuonganhums'); // GVCN 6A1
const ADMIN = await uidOf('mshuyentrangums');
const CLS = '6A1';
const DAY = '2026-10-12'; // Thứ Hai tuần 6
const WEEK = 6;
const TOPIC = 'E2E bài in sổ 05-11';

// --- Ghi tạm, nhớ để khôi phục ---
const restore = [];
async function tempSet(ref, data) {
  const snap = await ref.get();
  restore.push(snap.exists ? () => ref.set(snap.data()) : () => ref.delete());
  await ref.set(data);
}
const bookRef = adb.doc(`daily_logbooks/${CLS}_${DAY}`);
if (!(await bookRef.get()).exists) {
  await tempSet(bookRef, { id: `${CLS}_${DAY}`, classId: CLS, date: DAY, dayOfWeek: 2, weekNumber: WEEK, totalPeriods: 8, status: 'in_progress', isCompleted: false, updatedAt: Date.now() });
}
await tempSet(adb.doc(`daily_logbooks/${CLS}_${DAY}/periods/1`), {
  id: '1', dailyId: `${CLS}_${DAY}`, classId: CLS, dayOfWeek: 2, periodIndex: 1, subject: 'Civics', lessonTopic: TOPIC,
  teacherId: 'e2e_gv_khac', teacherName: 'GV khác E2E', teacherSignature: 'GV khác E2E', isSigned: true, signedAt: Date.now(),
  scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 }, absentStudents: [], updatedAt: Date.now(),
});
const LEAVE_ID = 'e2e_leave_0511';
await tempSet(adb.doc(`leave_requests/${LEAVE_ID}`), {
  requesterId: GVCN, requesterName: 'GVCN 6A1 (E2E)', type: 'annual', startDate: '2026-10-14', endDate: '2026-10-15', workingDays: 2,
  reason: 'E2E nghỉ phép', isEmergency: false, requiredDocs: [], docsDeadline: null, docsSubmittedAt: null,
  status: 'approved', decisionBy: ADMIN, decisionByName: 'BGH E2E', decisionAt: Date.now(), createdAt: Date.now() - 86400000,
});
const TS = '2026-10';
if (!(await adb.doc(`timesheets/${TS}`).get()).exists) {
  await tempSet(adb.doc(`timesheets/${TS}`), { period: TS, standardDays: 22, publishedAt: Date.now(), publishedBy: ADMIN, publishedByName: 'BGH E2E', reviewDeadline: '2099-01-01', reviewDeadlineAt: 4070908800000, status: 'open' });
}
await tempSet(adb.doc(`timesheets/${TS}/records/${GVCN}`), {
  uid: GVCN, displayName: 'GVCN 6A1', standardDays: 22, leave: { annual: 2, unpaid: 0, sick_self: 0, sick_child: 0, maternity: 0 }, workedDays: 20, status: 'pending',
});

const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], { cwd: APP, shell: true, stdio: 'ignore' });
const stop = () => { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }) : server.kill(); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];
let lastPage = null;
const check = async (name, fn) => {
  try { const note = await fn(); results.push(['PASS', `${name}${note ? ` — ${note}` : ''}`]); } catch (e) { results.push(['FAIL', `${name} — ${String(e.message || e).split('\n')[0]} @ ${lastPage?.url()}`]); if (SHOTS && lastPage) await lastPage.screenshot({ path: path.join(SHOTS, `fail_a_${results.length}.png`), fullPage: true }).catch(() => {}); }
};
async function signIn(uid) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.getByText('Vai trò hiện tại', { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => {});
  lastPage = page;
  return { ctx, page };
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

try {
  {
    const { ctx, page } = await signIn(ADMIN);
    await check('A1 In sổ: tiết GV khác đã ký (trên Firestore) hiện trong bản in', async () => {
      await page.goto(`${BASE}/logbook?classId=${CLS}&date=${DAY}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /In Sổ A4/ }).click({ timeout: 30000 });
      await page.getByLabel('Chọn tuần học').waitFor({ timeout: 20000 });
      await page.getByText(TOPIC).first().waitFor({ timeout: 30000 });
      await shot(page, 'a1_ban_in');
    });
    await check('A2 BGH: cảnh báo tiết chưa ký liệt kê cả tiết "Chưa mở" theo TKB', async () => {
      await page.goto(`${BASE}/summary?classId=${CLS}&week=${WEEK}`, { waitUntil: 'domcontentloaded' });
      const box = page.getByText(/Danh sách tiết dạy chưa ký sổ đầu bài \(\d+ tiết\)/);
      await box.waitFor({ timeout: 40000 });
      const txt = await box.textContent();
      const n = Number(txt.match(/\((\d+) tiết\)/)[1]);
      const notStarted = await page.getByText('Chưa mở', { exact: true }).count();
      if (n < 5 || notStarted === 0) throw new Error(`${n} tiết, ${notStarted} chưa mở`);
      await shot(page, 'a2_tiet_chua_ky');
      return `${n} tiết, ${notStarted} "Chưa mở"`;
    });
    await check('A3 BGH: đơn đã duyệt vẫn còn trong "Lịch sử đơn đã xử lý" (ai duyệt, lúc nào)', async () => {
      await page.goto(`${BASE}/leave`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Duyệt đơn/ }).click({ timeout: 30000 });
      const item = page.getByTestId('leave-history').getByTestId(`leave-${LEAVE_ID}`);
      await item.waitFor({ timeout: 20000 });
      const t = await item.textContent();
      if (!/bởi BGH E2E lúc \d{2}\/\d{2}\/\d{4}/.test(t)) throw new Error(t);
      await shot(page, 'a3_lich_su_don');
    });
    await ctx.close();
  }
  {
    const { ctx, page } = await signIn(GVCN);
    await check('A3 Hồ sơ năng lực GV: có ô ngày nghỉ đã duyệt', async () => {
      await page.goto(`${BASE}/teacher-portfolio`, { waitUntil: 'domcontentloaded' });
      const tile = page.getByTestId('tp-leave');
      await tile.waitFor({ timeout: 30000 });
      const t = await tile.textContent();
      if (!/Ngày nghỉ/.test(t) || /—/.test(t)) throw new Error(t);
      await shot(page, 'a3_ho_so_nang_luc');
      return t.replace(/\s+/g, ' ').slice(0, 80);
    });
    await check('A4 Bảng công: xem chi tiết ngày nghỉ & số tiết dạy', async () => {
      await page.goto(`${BASE}/timesheet`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId(`my-ts-${TS}`).getByRole('button', { name: /Xem chi tiết/ }).click({ timeout: 30000 });
      const d = page.getByTestId('ts-detail');
      await d.waitFor({ timeout: 30000 });
      const t = await d.textContent();
      if (!/2026-10-14 → 2026-10-15/.test(t) || !/Số tiết đã ký sổ đầu bài/.test(t)) throw new Error(t);
      await shot(page, 'a4_bang_cong');
      return t.replace(/\s+/g, ' ').slice(0, 110);
    });
    await ctx.close();
  }
} finally {
  for (const r of restore.reverse()) await r().catch((e) => console.error('restore', e.message));
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
