// E2E (05/11, góp ý cô Phương Anh — cụm B): form ký cuối tiết gọn — Nhận xét trước Tổng điểm, 4 ô điểm 1 hàng,
// không còn mục "về sớm", nút ký luôn nhìn thấy (desktop + mobile). Chỉ mở form, KHÔNG lưu.
// Dùng: cd tools/e2e && node gop_y_b_dev.mjs [thư mục lưu ảnh]

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
const GVCN = (await adb.collection('users').where('username', '==', 'msphuonganhums').get()).docs[0]?.id; // GVCN 6A1
const DAY = '2026-10-12';

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
  for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 375, height: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.name === 'mobile', hasTouch: vp.name === 'mobile' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
    await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(GVCN));
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await check(`[${vp.name}] form ký cuối tiết gọn, nút ký luôn thấy`, async () => {
      await page.goto(`${BASE}/logbook?date=${DAY}&mode=homeroom&period=2`, { waitUntil: 'domcontentloaded' });
      const dialog = page.getByRole('dialog').first();
      await dialog.waitFor({ timeout: 40000 });
      await page.getByTestId('score-row').waitFor();
      // 1. Nhận xét trước Tổng điểm
      const order = await page.evaluate(() => {
        const c = document.getElementById('period-comment-textarea');
        const s = document.querySelector('[data-testid="score-box"]');
        return !!(c && s && c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      if (!order) throw new Error('Nhận xét không nằm trước Tổng điểm');
      // 2. 4 ô điểm cùng 1 hàng
      const tops = await page.getByTestId('score-row').evaluate((el) => [...el.children].map((c) => Math.round(c.getBoundingClientRect().top)));
      if (tops.length !== 4 || new Set(tops).size !== 1) throw new Error(`ô điểm không cùng hàng: ${tops}`);
      // 3. Không còn mục về sớm
      if (await page.getByText(/Ghi nhận học sinh về sớm/).count()) throw new Error('còn mục về sớm');
      // 4. Nút ký nằm trong khung nhìn (không phải cuộn)
      const btn = dialog.locator('button[type="submit"]');
      const box = await btn.boundingBox();
      if (!box || box.y + box.height > vp.height || box.y < 0) throw new Error(`nút ký ngoài màn hình: ${JSON.stringify(box)}`);
      // 5. Không cuộn ngang
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) throw new Error(`cuộn ngang ${overflow}px`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `b_form_${vp.name}.png`) });
      return `nút ký y=${Math.round(box.y)}`;
    });
    await ctx.close();
  }
} finally {
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
