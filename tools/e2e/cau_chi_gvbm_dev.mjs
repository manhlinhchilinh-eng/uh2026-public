// E2E (05/11): (1) Xếp hạng tuần/tháng + Dashboard BGH tải xong, KHÔNG bị chặn vì quá nhiều truy vấn;
// (2) GV có cả vai trò GVCN + GVBM: ở vai trò GVBM, sổ bám theo tiết đang chọn, không mặc định lớp chủ nhiệm.
// Dùng: cd tools/e2e && node cau_chi_gvbm_dev.mjs [thư mục ảnh]
// Chạy trên sodaubai-dev; gắn tạm tên TKB "Ms P.Anh" cho GVCN 6A1 rồi khôi phục. Không lưu sổ.

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
const ADMIN = await uidOf('mshuyentrangums');
const GV = await uidOf('msphuonganhums'); // roles gvcn(6A1) + gvbm
const MON = '2026-10-12';

const aliasRef = adb.doc(`teacher_aliases/${GV}`);
const aliasOrig = (await aliasRef.get()).data() ?? null;
await aliasRef.set({ uid: GV, username: 'msphuonganhums', displayName: 'GV E2E', aliases: ['Ms P.Anh'], updatedAt: Date.now(), updatedBy: 'e2e' });

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
  try { const note = await fn(); results.push(['PASS', `${name}${note ? ` — ${note}` : ''}`]); } catch (e) { results.push(['FAIL', `${name} — ${String(e.message || e).split('\n')[0]}`]); if (SHOTS && lastPage) await lastPage.screenshot({ path: path.join(SHOTS, `fail_cc_${results.length}.png`), fullPage: true }).catch(() => {}); }
};
async function signIn(uid) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const guardLogs = [];
  page.on('console', (m) => /FIRESTORE_GUARD/.test(m.text()) && guardLogs.push(m.text()));
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  lastPage = page;
  return { ctx, page, guardLogs };
}
const noBanner = async (page, guardLogs) => {
  if (await page.locator('#ums-firestore-guard-banner').count()) throw new Error(`bị chặn: ${guardLogs.join(' | ')}`);
};

try {
  {
    const { ctx, page, guardLogs } = await signIn(ADMIN);
    await check('Xếp hạng — tuần (tất cả khối): tải xong, không bị chặn', async () => {
      await page.goto(`${BASE}/emulation`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Chọn ngày trong tuần').fill('2026-11-04');
      await page.getByTestId('tpt-table').waitFor({ timeout: 60000 });
      await page.waitForTimeout(1500);
      await noBanner(page, guardLogs);
    });
    await check('Xếp hạng — tháng 10: tải xong, không bị chặn', async () => {
      await page.getByRole('tab', { name: 'Tháng' }).click();
      await page.getByLabel('Chọn tháng').fill('2026-10');
      await page.getByTestId('tpt-table').waitFor({ timeout: 60000 });
      await page.waitForTimeout(1500);
      await noBanner(page, guardLogs);
    });
    await check('Dashboard BGH: tải xong, không bị chặn', async () => {
      await page.goto(`${BASE}/bgh`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(6000);
      await noBanner(page, guardLogs);
      return guardLogs.length ? guardLogs.join(' | ') : 'không có cảnh báo';
    });
    await ctx.close();
  }
  {
    const { ctx, page } = await signIn(GV);
    await check('GVBM: tiêu đề ghi "Tiết dạy của tôi" + tiết đang chọn, đổi theo tiết bấm (không kẹt lớp chủ nhiệm)', async () => {
      await page.goto(`${BASE}/logbook?date=${MON}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /GVCN 6A1/ }).first().click({ timeout: 30000 });
      await page.getByRole('button', { name: /GVBM|bộ môn/i }).first().click();
      await page.getByTestId('my-teaching-day').waitFor({ timeout: 40000 });
      const head = () => page.getByText(/Tiết dạy của tôi • Lớp|Sổ đầu bài 8 tiết học • Lớp/).first().textContent();
      await page.waitForTimeout(1500);
      const h1 = await head();
      if (!/Tiết dạy của tôi • Lớp 6A1 • Tiết 1/.test(h1)) throw new Error(`mặc định: ${h1}`);
      await page.locator('[data-testid="my-period-7A5_2"]').click();
      await page.getByRole('dialog').first().waitFor({ timeout: 20000 });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const h2 = await head();
      const scope = await page.getByTestId('edit-scope').textContent();
      if (!/Lớp 7A5 • Tiết 2/.test(h2) || !/^Lớp 7A5/.test(scope)) throw new Error(`${h2} | ${scope}`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'gvbm_tiet_dang_chon.png'), fullPage: true });
      return `${h1.trim()} → ${h2.trim()}`;
    });
    await ctx.close();
  }
} finally {
  if (aliasOrig) await aliasRef.set(aliasOrig);
  else await aliasRef.delete();
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
