// E2E (05/11): GV phải chấm đủ 4 tiêu chí mới ký được sổ đầu bài. Chạy trên sodaubai-dev, KHÔNG lưu sổ.
// Dùng: cd tools/e2e && node bat_buoc_cham_diem_dev.mjs [thư mục ảnh]
// Gắn tạm tên TKB "Ms P.Anh" cho GV msphuonganhums rồi khôi phục.

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
const GV = (await adb.collection('users').where('username', '==', 'msphuonganhums').get()).docs[0]?.id;
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
let page;
const check = async (name, fn) => {
  try { const note = await fn(); results.push(['PASS', `${name}${note ? ` — ${note}` : ''}`]); } catch (e) { results.push(['FAIL', `${name} — ${String(e.message || e).split('\n')[0]}`]); if (SHOTS && page) await page.screenshot({ path: path.join(SHOTS, `fail_bbcd_${results.length}.png`), fullPage: true }).catch(() => {}); }
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  const writes = [];
  page.on('request', (r) => /Write\/channel|:commit/.test(r.url()) && r.method() === 'POST' && writes.push(r.url()));
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(GV));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });

  await check('GVBM mở tiết chưa ký: 4 ô điểm trống, nút Ký bị khóa, bấm Ký báo thiếu + không lưu', async () => {
    await page.goto(`${BASE}/logbook?date=${MON}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /GVCN 6A1/ }).first().click({ timeout: 30000 });
    await page.getByRole('button', { name: /GVBM|bộ môn/i }).first().click();
    await page.getByTestId('my-teaching-day').waitFor({ timeout: 40000 });
    await page.locator('[data-testid="my-period-7A5_2"]').click();
    const dlg = page.getByRole('dialog').first();
    await dlg.waitFor({ timeout: 20000 });
    const v = await dlg.getByLabel('Điểm Học tập', { exact: true }).inputValue();
    if (v !== '') return `tiết đã ký sẵn trên dev (điểm ${v}) — bỏ qua kiểm tra trống`;
    const btn = dlg.getByTestId('sign-submit');
    if ((await btn.getAttribute('aria-disabled')) !== 'true') throw new Error('nút Ký không khóa');
    await dlg.locator('#period-subject-input').fill('Maths');
    await dlg.locator('#period-lesson-topic-input').fill('E2E — không lưu');
    await dlg.locator('#sign-confirm').check();
    const before = writes.length;
    await btn.click({ force: true }); // aria-disabled: người dùng vẫn bấm được để được nhắc
    await dlg.getByText(/Chưa chấm điểm: Học tập, Kỷ luật, Vệ sinh/).waitFor({ timeout: 5000 });
    const focused = await page.evaluate(() => document.activeElement?.id);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'bat_buoc_cham_diem.png') });
    if (writes.length !== before) throw new Error('đã gửi ghi Firestore');
    // Chấm nhanh 10đ → nút mở khóa (không bấm lưu)
    await dlg.getByTitle(/Chấm nhanh 10 điểm/).click();
    if ((await btn.getAttribute('aria-disabled')) !== 'false') throw new Error('chấm đủ mà nút vẫn khóa');
    return `focus ô ${focused}; ⚡10đ mở khóa nút`;
  });
  await ctx.close();
} finally {
  if (aliasOrig) await aliasRef.set(aliasOrig);
  else await aliasRef.delete();
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
