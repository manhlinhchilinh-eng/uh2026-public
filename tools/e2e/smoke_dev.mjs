// E2E thật bằng trình duyệt (Chrome của máy) trên project DEV — kiểm các luồng chính theo vai trò.
// Dùng: cd tools/e2e && npm install && node smoke_dev.mjs
// - Tự chạy dev server (cổng 5174), đăng nhập từng vai trò bằng custom token (Admin SDK dev), không dùng mật khẩu.
// - CHỈ ĐỌC dữ liệu, không ghi gì lên Firestore.
// - Báo PASS/FAIL từng bước + lỗi quyền trong console; exit 1 nếu có FAIL.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const KEY = path.resolve(HERE, '../backup/keys/sodaubai-dev.json');
const PORT = Number(process.env.E2E_PORT || 5174);
const BASE = `http://localhost:${PORT}`;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();
const uidOf = async (username) => (await adb.collection('users').where('username', '==', username).get()).docs[0]?.id;
const mhs = (await adb.collection('students').doc('6A1_01').get()).data().mhs;

const ROLES = {
  admin: await uidOf('mshuyentrangums'),
  gvcn: await uidOf('msphuonganhums'),
  parent: `ph_${mhs}`,
  student: `hs_${mhs}`,
};

// ---------------------------------------------------------------------------
const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], { cwd: APP, shell: true, stdio: 'ignore' });
const stop = () => { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }) : server.kill(); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];
const check = async (role, name, fn) => {
  try { await fn(); results.push(['PASS', role, name]); } catch (e) { results.push(['FAIL', role, `${name} — ${String(e.message || e).split('\n')[0]}`]); }
};

async function asRole(role, steps) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const permErrors = [];
  page.on('console', (m) => { if (/permission|insufficient/i.test(m.text())) permErrors.push(m.text().slice(0, 140)); });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  const token = await admin.auth().createCustomToken(ROLES[role]);
  await page.evaluate((t) => window.__umsDevSignIn(t), token);
  // Không chờ 'networkidle': Firestore giữ kết nối liên tục → luôn treo tới timeout. Chờ phần tử cụ thể thay vào đó.
  const go = async (p) => { await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' }); };
  await go('/dashboard');
  await steps(page, go);
  await check(role, 'không có lỗi quyền Firestore trong console', async () => { if (permErrors.length) throw new Error(permErrors[0]); });
  await ctx.close();
}

const seeText = (page, text, timeout = 15000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });

await asRole('admin', async (page, go) => {
  await check('admin', 'Dashboard BGH hiển thị số liệu', async () => { await go('/bgh'); await page.getByTestId('tile-signed').waitFor({ timeout: 20000 }); });
  await check('admin', 'Xin nghỉ: có tab duyệt đơn', async () => { await go('/leave'); await seeText(page, 'Duyệt đơn'); });
  await check('admin', 'Bảng công: có phần quản lý', async () => { await go('/timesheet'); await page.getByTestId('admin-timesheet').waitFor({ timeout: 15000 }); });
  await check('admin', 'Thông báo: có nút soạn', async () => { await go('/announcements'); await seeText(page, 'Soạn thông báo'); });
  await check('admin', 'Hồ sơ GV: chọn được GV', async () => { await go('/teacher-portfolio'); await page.getByLabel('Chọn giáo viên').waitFor({ timeout: 15000 }); });
  await check('admin', 'Hệ sinh thái: thấy Dashboard BGH', async () => { await go('/apps'); await page.getByTestId('module-bgh-dashboard').waitFor({ timeout: 10000 }); });
});

await asRole('gvcn', async (page, go) => {
  await check('gvcn', 'Sổ đầu bài lớp chủ nhiệm mở được', async () => { await go('/logbook'); await seeText(page, 'Sổ đầu bài Lớp', 20000); });
  await check('gvcn', 'Xin nghỉ: mở form tạo đơn + phần dạy thay', async () => { await go('/leave'); await page.getByText('Tạo đơn xin nghỉ').first().click(); await page.getByTestId('sub-planner').waitFor({ timeout: 15000 }); });
  await check('gvcn', 'Hồ sơ năng lực GV', async () => { await go('/teacher-portfolio'); await page.getByTestId('tp-periods').waitFor({ timeout: 20000 }); });
  await check('gvcn', 'Duyệt ePortfolio lớp 6A1', async () => { await go('/portfolio'); await seeText(page, 'Lớp chủ nhiệm 6A1'); });
  await check('gvcn', 'Chế độ trình chiếu che tên & mã HS (Điểm danh 6A1)', async () => {
    await page.evaluate(() => localStorage.setItem('ums_presentation_mode', '1'));
    await go('/attendance');
    // T7/CN là ngày nghỉ → trang điểm danh không hiện danh sách; chọn ngày học gần nhất
    const d = new Date(); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // ngày theo giờ máy, không lệch UTC
    await page.locator('#attendance-date-input').fill(ymd);
    await page.getByTestId('presentation-badge').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => /\p{Lu}\. \p{Lu}\./u.test(document.querySelector('main')?.innerText || ''), null, { timeout: 20000 });
    const leaked = await page.evaluate(() => (document.querySelector('main')?.innerText.match(/(?<!\d)26\d{4}(?!\d)/g) || []).length);
    await page.evaluate(() => localStorage.removeItem('ums_presentation_mode'));
    if (leaked) throw new Error(`còn ${leaked} mã HS hiện rõ`);
  });
  await check('gvcn', 'Không vào được Dashboard BGH (bị chuyển về trang chủ)', async () => { await go('/bgh'); await page.waitForURL(/\/dashboard/, { timeout: 15000 }); if (await page.getByTestId('tile-signed').count()) throw new Error('GV thấy số liệu BGH'); });
});

await asRole('parent', async (page, go) => {
  await check('parent', 'Cổng phụ huynh hiển thị con', async () => { await seeText(page, 'Cổng phụ huynh'); await page.getByTestId('att-summary-6A1_01').waitFor({ timeout: 15000 }); });
  await check('parent', 'Bị chặn khỏi Sổ đầu bài', async () => { await go('/logbook'); await page.waitForURL(/\/dashboard/, { timeout: 15000 }); });
  await check('parent', 'ePortfolio con: chỉ xem', async () => { await go('/portfolio'); await page.getByTestId('competency').waitFor({ timeout: 15000 }); if (await page.getByText('Nộp minh chứng').count()) throw new Error('PH thấy nút nộp'); });
  await check('parent', 'Thông báo mở được', async () => { await go('/announcements'); await seeText(page, 'Thông báo'); });
});

await asRole('student', async (page, go) => {
  await check('student', 'Góc học sinh', async () => { await seeText(page, 'Góc học sinh'); });
  await check('student', 'ePortfolio: có nút nộp minh chứng', async () => { await go('/portfolio'); await seeText(page, 'Nộp minh chứng'); });
});

// Mobile 375px: header không tràn ngang
await check('gvcn', 'Mobile 375px: không cuộn ngang', async () => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(ROLES.gvcn));
  for (const p of ['/dashboard', '/apps', '/leave']) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });
    await page.locator('main').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) throw new Error(`${p} tràn ngang ${over}px`);
  }
  await ctx.close();
});

await browser.close();
stop();
let fail = 0;
for (const [s, role, name] of results) {
  if (s === 'FAIL') fail++;
  console.log(`${s}  [${role}] ${name}`);
}
console.log(`\n${results.length - fail}/${results.length} đúng`);
process.exit(fail ? 1 : 0);
