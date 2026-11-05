// E2E (05/11 tối): Xếp hạng thi đua — tab Ngày (hạng từng hôm), nhập file "Sổ Sao Đỏ" (xem trước, KHÔNG lưu).
// Dùng: cd tools/e2e && node co_do_ngay_dev.mjs <đường dẫn file Sổ Sao Đỏ .xlsx> [thư mục ảnh]
// Chạy trên sodaubai-dev, chỉ đọc. File Excel chứa tên HS thật — không copy vào repo.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const FILE = process.argv[2];
const SHOTS = process.argv[3] || null;
if (!FILE || !existsSync(FILE)) throw new Error('Thiếu file Sổ Sao Đỏ');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const PORT = Number(process.env.E2E_PORT || 5178);
const BASE = `http://localhost:${PORT}`;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();
const ADMIN = (await adb.collection('users').where('username', '==', 'mshuyentrangums').get()).docs[0]?.id;

const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], { cwd: APP, shell: true, stdio: 'ignore' });
const stop = () => { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }) : server.kill(); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];
let page;
const check = async (name, fn) => {
  try { const note = await fn(); results.push(['PASS', `${name}${note ? ` — ${note}` : ''}`]); } catch (e) { results.push(['FAIL', `${name} — ${String(e.message || e).split('\n')[0]}`]); if (SHOTS && page) await page.screenshot({ path: path.join(SHOTS, `fail_cdn_${results.length}.png`), fullPage: true }).catch(() => {}); }
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  const guard = [];
  page.on('console', (m) => /FIRESTORE_GUARD/.test(m.text()) && guard.push(m.text()));
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(ADMIN));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });

  await check('Tab Ngày: bảng xếp hạng 1 hôm tải xong, không bị chặn', async () => {
    await page.goto(`${BASE}/emulation`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Ngày' }).click();
    await page.getByLabel('Chọn ngày', { exact: true }).fill('2026-11-04');
    await page.getByTestId('tpt-table').waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    if (await page.locator('#ums-firestore-guard-banner').count()) throw new Error(guard.join(' | '));
    return (await page.getByText(/T4 04\/11\/2026/).count()) ? 'nhãn T4 04/11/2026' : '';
  });
  await check('Tuần: chi tiết lớp có cột "Hạng ngày"', async () => {
    await page.getByRole('tab', { name: 'Tuần' }).click();
    await page.getByLabel('Chọn ngày trong tuần').fill('2026-11-04');
    await page.getByTestId('tpt-table').waitFor({ timeout: 60000 });
    await page.getByTestId('tpt-row-6A1').click();
    const t = await page.getByTestId('tpt-days-6A1').textContent({ timeout: 10000 });
    if (!/Hạng ngày/.test(t)) throw new Error(t);
    return t.replace(/\s+/g, ' ').slice(0, 160);
  });
  await check('Nhập file Sổ Sao Đỏ: xem trước 05/11, 26 lớp, cảnh báo dòng 7A1 ngày 07/11 (không lưu)', async () => {
    await page.getByTestId('sao-do-toggle').click();
    await page.getByTestId('sao-do-file').setInputFiles(FILE);
    const pv = await page.getByTestId('sao-do-preview').textContent({ timeout: 15000 });
    const fut = await page.getByTestId('sao-do-future').textContent();
    if (!/05\/11\/2026/.test(pv) || !/9A1 −3/.test(pv) || !/7A1 07\/11\/2026/.test(fut)) throw new Error(`${pv} | ${fut}`);
    if (!(await page.getByText('Đọc được 26 lớp.').count())) throw new Error('không đủ 26 lớp');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'sao_do_preview.png'), fullPage: true });
    return pv.replace(/\s+/g, ' ').slice(0, 200);
  });
  await ctx.close();
} finally {
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
