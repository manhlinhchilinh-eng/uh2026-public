// E2E (05/11, góp ý sau demo — cụm C): PH/HS xem TKB lớp của con (+ tên GVCN) trên trang Gia đình. Chỉ đọc.
// Dùng: cd tools/e2e && node gop_y_c_dev.mjs [thư mục lưu ảnh]

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
const pickUser = async (role) =>
  (await adb.collection('users').where('roles', 'array-contains', role).limit(10).get()).docs.find((d) => !d.data().mustChangePassword && (d.data().studentDocIds || []).length)?.id;
const USERS = { parent: await pickUser('parent'), student: await pickUser('student') };

const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], { cwd: APP, shell: true, stdio: 'ignore' });
const stop = () => { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }) : server.kill(); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];
const check = async (name, fn) => {
  try { const note = await fn(); results.push(['PASS', `${name}${note ? ` — ${note}` : ''}`]); } catch (e) { results.push(['FAIL', `${name} — ${String(e.message || e).split('\n')[0]}`]); }
};

try {
  for (const [role, uid] of Object.entries(USERS)) {
    if (!uid) { results.push(['FAIL', `không có tài khoản ${role} thử trên dev`]); continue; }
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
    await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await check(`[${role}] trang Gia đình có TKB lớp của con + tên GVCN`, async () => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
      const card = page.locator('[data-testid^="family-tkb-"]').first();
      await card.waitFor({ timeout: 40000 });
      await card.getByText(/^Tiết 1$/).waitFor({ timeout: 20000 });
      const subjects = await card.locator('li').allTextContents();
      if (subjects.filter((t) => !/—/.test(t)).length === 0) throw new Error('TKB rỗng');
      await card.getByRole('tab', { name: 'T3' }).click();
      const gv = await page.getByTestId('family-gvcn').first().textContent().catch(() => '(chưa có tên GVCN)');
      if (SHOTS) await card.screenshot({ path: path.join(SHOTS, `c_tkb_${role}.png`) });
      return `${await card.getAttribute('data-testid')} • ${gv}`;
    });
    await ctx.close();
  }
} finally {
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
