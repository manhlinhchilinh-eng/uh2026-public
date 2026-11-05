// E2E menu bên gọn + song ngữ + màn đăng nhập động trên DEV (chỉ đọc dữ liệu, chỉ ghi localStorage của trình duyệt).
// node sidebar_dev.mjs   (cần dev server: BASE mặc định http://localhost:5173)
// Kiểm: màn đăng nhập (SVG động + nút ngôn ngữ sáng), cụm theo vai trò, tìm nhanh "/", thu gọn cụm, chế độ icon, bật/tắt song ngữ (cả menu lẫn nội dung trang), đổi VI↔EN, menu mobile 375px.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:5173';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
const adb = admin.firestore();
const uidOf = async (u) => (await adb.collection('users').where('username', '==', u).get()).docs[0]?.id;

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// 0. Kiểm tra màn hình đăng nhập (P4.4): nền SVG động + LanguageToggle nền sáng
{
  const loginCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await loginPage.waitForSelector('[data-testid="login-network-bg"]', { timeout: 30000 });
  check('Login: có nền mạng lưới hệ sinh thái SVG động', (await loginPage.locator('[data-testid="login-network-bg"] svg').count()) === 1);
  check('Login: nút ngôn ngữ dùng variant light (không bị chữ trắng trên nền sáng)', (await loginPage.locator('[data-variant="light"]').count()) === 1);
  await loginCtx.close();
}

async function signedInPage(username, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 60000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(await uidOf(username)));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForSelector('aside nav', { state: 'attached', timeout: 30000 });
  return page;
}

// 1. BGH
const page = await signedInPage('mshuyentrangums');
const groupIds = await page.$$eval('aside [data-testid^="nav-group-"]', (els) => els.map((e) => e.getAttribute('data-testid')));
check('BGH: đủ 5 cụm', groupIds.join(',') === 'nav-group-today,nav-group-classes,nav-group-reports,nav-group-staff,nav-group-admin', groupIds.join(','));
check('Mặc định song ngữ: thấy chữ phụ tiếng Anh ở menu', await page.locator('aside nav').getByText('Class Logbook').count() > 0);
check('Mặc định song ngữ: thấy chữ phụ tiếng Anh trên thẻ trang chính', await page.locator('main').getByText('School Scale').count() > 0);

await page.keyboard.press('/');
check('Phím "/" đưa con trỏ vào ô tìm', await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'nav-search'));
await page.keyboard.type('thoi khoa');
const found = await page.$$eval('aside nav button[aria-current], aside nav [data-testid^="nav-group-"] > div button', (b) => b.map((x) => x.textContent));
check('Tìm không dấu ra Thời khóa biểu', found.length === 1 && /Thời khóa biểu/.test(found[0] || ''), found.join(' | '));
await page.keyboard.press('Enter');
await page.waitForURL(/\/schedule/, { timeout: 10000 }).catch(() => {});
check('Enter mở trang tìm được', page.url().includes('/schedule'), page.url());
check('Trang Thời khóa biểu hiển thị tiêu đề song ngữ (<Bi>)', await page.locator('main').getByText('Timetable').count() > 0);

const adminHeader = page.locator('[data-testid="nav-group-admin"] > button');
await adminHeader.click();
check('Thu gọn cụm Quản trị', (await page.locator('[data-testid="nav-group-admin"]').getByText('Quản lý tài khoản').count()) === 0);
await adminHeader.click();
check('Mở lại cụm Quản trị', (await page.locator('[data-testid="nav-group-admin"]').getByText('Quản lý tài khoản').count()) === 1);

await page.click('[data-testid="nav-rail-toggle"]');
await page.waitForTimeout(400);
const railW = await page.$eval('aside', (a) => a.getBoundingClientRect().width);
check('Chế độ icon: menu hẹp 64px', Math.round(railW) === 64, `${railW}`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('aside nav', { timeout: 30000 });
await page.waitForTimeout(400);
check('Chế độ icon được nhớ sau tải lại', Math.round(await page.$eval('aside', (a) => a.getBoundingClientRect().width)) === 64);
await page.click('[data-testid="nav-rail-toggle"]');

await page.click('[data-testid="bilingual-toggle"]');
check('Tắt song ngữ: mất chữ phụ ở cả menu và trang', (await page.locator('aside nav').getByText('Class Logbook').count()) === 0 && (await page.locator('main').getByText('Timetable').count()) === 0);
await page.click('[data-testid="bilingual-toggle"]');
await page.getByRole('button', { name: 'EN', exact: true }).first().click();
const firstLogbook = await page.locator('aside nav').getByText('Class Logbook').first().evaluate((e) => getComputedStyle(e).fontSize);
const secondaryVi = await page.locator('aside nav').getByText('Sổ đầu bài', { exact: true }).first().evaluate((e) => getComputedStyle(e).fontSize);
check('EN chính to, VI phụ nhỏ', parseFloat(firstLogbook) > parseFloat(secondaryVi), `${firstLogbook} > ${secondaryVi}`);
await page.getByRole('button', { name: 'VI', exact: true }).first().click();

// 2. GVCN: không có Quản trị, có Điểm danh
const gv = await signedInPage('msphuonganhums');
const gvGroups = await gv.$$eval('aside [data-testid^="nav-group-"]', (els) => els.map((e) => e.getAttribute('data-testid')));
check('GVCN: không có cụm Quản trị', !gvGroups.includes('nav-group-admin'), gvGroups.join(','));
check('GVCN: có Điểm danh đầu giờ', (await gv.locator('aside nav').getByText('Điểm danh đầu giờ').count()) === 1);

// 3. Mobile 375px: menu mở dạng ngăn kéo, không cuộn ngang
const m = await signedInPage('msphuonganhums', { width: 375, height: 812 });
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('Mobile: không cuộn ngang', overflow <= 0, `${overflow}px`);

console.log(`\n${pass}/${pass + fail} PASS`);
await browser.close();
process.exit(fail ? 1 : 0);
