// E2E (05/11): quyền theo lớp — Điểm danh đầu giờ chỉ lớp chủ nhiệm; GVCN mở/ký mọi tiết lớp mình (kể cả tiết GV khác đã nhận tên TKB).
// Dùng: cd tools/e2e && node quyen_lop_dev.mjs [thư mục lưu ảnh]
// Chạy trên sodaubai-dev; chỉ ghi tạm 1 teacher_aliases thử rồi khôi phục. Không lưu tiết/điểm danh.

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
const OTHER = await uidOf('mrhoanglongums'); // giả làm GV bộ môn đã nhận tên 1 tiết của 6A1
const MONDAY = '2026-10-12';
const sch = (await adb.collection('schedules').doc('6A1').get()).data();
const slot = (sch?.slots || []).find((x) => x.dayOfWeek === 2 && x.teacherName && x.teacherName !== 'Ms P.Anh' && !/^NN2|Native/.test(x.teacherName));
if (!slot) throw new Error('TKB 6A1 thứ Hai không có tiết GV khác');
const otherAliasOrig = (await adb.collection('teacher_aliases').doc(OTHER).get()).data() ?? null;
await adb.collection('teacher_aliases').doc(OTHER).set({ uid: OTHER, username: 'mrhoanglongums', displayName: 'GV E2E', aliases: [slot.teacherName], updatedAt: Date.now(), updatedBy: 'e2e' });

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
  try { const note = await fn(); results.push(['PASS', `${name}${note ? ` — ${note}` : ''}`]); } catch (e) { results.push(['FAIL', `${name} — ${String(e.message || e).split('\n')[0]} @ ${lastPage?.url()}`]); if (SHOTS && lastPage) await lastPage.screenshot({ path: path.join(SHOTS, `fail_${results.length}.png`) }).catch(() => {}); }
};
async function signIn(uid) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  lastPage = page;
  return { ctx, page };
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const options = (page, sel) => page.locator(`${sel} option`).evaluateAll((os) => os.map((o) => o.value));

try {
  {
    const { ctx, page } = await signIn(GVCN);
    await check('GVCN 6A1: Điểm danh đầu giờ chỉ có lớp 6A1, ô chọn khóa', async () => {
      await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' });
      await page.locator('#attendance-class-select').waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      const ops = await options(page, '#attendance-class-select');
      if (ops.join(',') !== '6A1') throw new Error(`ô chọn có: ${ops.join(',')}`);
      if (!(await page.locator('#attendance-class-select').isDisabled())) throw new Error('chưa khóa');
      await shot(page, 'gvcn_diem_danh');
      return ops.join(',');
    });
    await check(`GVCN 6A1: mở được tiết ${slot.periodIndex} (${slot.teacherName}, đã có GV nhận tên)`, async () => {
      await page.goto(`${BASE}/logbook?date=${MONDAY}&mode=homeroom`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('edit-scope').waitFor({ timeout: 30000 });
      await page.waitForTimeout(2500);
      const scope = (await page.getByTestId('edit-scope').textContent()) || '';
      if (/chỉ xem/.test(scope)) throw new Error(scope);
      const cards = page.locator('[role="button"]').filter({ hasText: slot.teacherName });
      if ((await cards.count()) === 0) throw new Error(`tiết ${slot.periodIndex} không bấm được; ${scope}`);
      await cards.first().click();
      await page.getByRole('dialog').first().waitFor({ timeout: 20000 });
      const label = await page.getByRole('dialog').first().getAttribute('aria-label');
      await shot(page, 'gvcn_mo_tiet_gv_khac');
      return `${scope.trim().slice(0, 90)} | ${label}`;
    });
    await ctx.close();
  }
  {
    const { ctx, page } = await signIn(ADMIN);
    await check('BGH: Điểm danh đầu giờ chọn được mọi lớp', async () => {
      await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' });
      await page.locator('#attendance-class-select').waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      const ops = await options(page, '#attendance-class-select');
      if (ops.length < 26) throw new Error(`${ops.length} lớp`);
      return `${ops.length} lớp`;
    });
    await ctx.close();
  }
} finally {
  if (otherAliasOrig) await adb.collection('teacher_aliases').doc(OTHER).set(otherAliasOrig);
  else await adb.collection('teacher_aliases').doc(OTHER).delete();
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
