// E2E: Thông báo Văn phòng trên sodaubai-dev (tự tạo TK Văn phòng thử, tự dọn).
// node office_notices_dev.mjs [thư mục ảnh]
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const SHOTS = process.argv[2] || null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const PORT = Number(process.env.E2E_PORT || 5174);
const BASE = `http://localhost:${PORT}`;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();
const users = (await adb.collection('users').get()).docs.map((d) => ({ uid: d.id, ...d.data() }));
const ADMIN = users.find((u) => u.username === 'mshuyentrangums').uid;
const GVCN = users.find((u) => u.username === 'msphuonganhums').uid;
const GVBM_ONLY = users.find((u) => (u.roles || []).includes('gvbm') && !(u.roles || []).includes('gvcn') && !(u.roles || []).includes('admin'))?.uid;
const VP = 'e2e_vanphong';
await adb.collection('users').doc(VP).set({ uid: VP, username: 'e2e_vanphong', displayName: 'Văn phòng E2E', roles: ['vanphong'], mustChangePassword: false });
const t0 = Date.now();
const TITLE = `[E2E] Nộp kế hoạch tuần ${t0 % 1000}`;

const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], { cwd: APP, shell: true, stdio: 'ignore' });
const stop = () => { try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];
const check = async (name, fn) => { try { const n = await fn(); results.push(['PASS', `${name}${n ? ` — ${n}` : ''}`]); } catch (e) { results.push(['FAIL', `${name} — ${String(e.message || e).split('\n')[0]}`]); } };
async function signIn(uid) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 60000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return { ctx, page };
}
const shot = (page, n) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true });

// 0. BGH mở trang → đồng bộ danh bạ (kèm vai trò)
{
  const { ctx, page } = await signIn(ADMIN);
  await check('BGH mở link cũ /van-phong → về trang Thông báo gộp (đồng bộ danh bạ)', async () => {
    await page.goto(`${BASE}/van-phong`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Soạn thông báo/ }).waitFor({ timeout: 30000 });
    await page.waitForURL(/\/announcements/, { timeout: 10000 });
    await page.waitForTimeout(3000);
    const d = (await adb.collection('directory').doc('staff').get()).data();
    if (!d?.staff?.some((s) => (s.roles || []).length)) throw new Error('danh bạ chưa có vai trò');
    return `${d.staff.length} nhân sự`;
  });
  await ctx.close();
}

// 1. Văn phòng soạn tin cho GVCN, hạn 2 giờ, nhắc trước 3 giờ, yêu cầu "đã thực hiện", tin gợi ý PH
{
  const { ctx, page } = await signIn(VP);
  await check('Văn phòng vào thẳng trang của mình, menu gọn', async () => {
    await page.waitForURL(/\/announcements/, { timeout: 20000 });
    if (await page.getByRole('button', { name: /Sổ đầu bài/ }).count()) throw new Error('thấy menu GV');
  });
  await check('Soạn & gửi tin cho nhãn GVCN', async () => {
    await page.getByRole('button', { name: /Soạn thông báo/ }).click();
    await page.getByLabel('Tiêu đề').fill(TITLE);
    await page.getByLabel('Nội dung').fill('Thầy cô GVCN nộp kế hoạch chủ nhiệm tuần tới trước hạn.');
    await page.getByText('Toàn thể GV', { exact: true }).click(); // bỏ nhãn mặc định
    await page.getByText('GVCN', { exact: true }).click();
    await page.getByText('Tin gợi ý để GV chuyển phụ huynh', { exact: false }).click();
    await page.getByLabel('Tin gợi ý gửi phụ huynh học sinh').fill('Kính gửi PH: tuần tới lớp có họp phụ huynh lúc 17h thứ Sáu.');
    await page.getByLabel('Cần thực hiện').check();
    const dl = new Date(Date.now() + 2 * 3600_000);
    const pad = (n) => String(n).padStart(2, '0');
    await page.getByLabel('Hạn chót').fill(`${dl.getFullYear()}-${pad(dl.getMonth() + 1)}-${pad(dl.getDate())}T${pad(dl.getHours())}:${pad(dl.getMinutes())}`);
    await page.getByLabel('Trước 3 giờ').check().catch(async () => page.getByText('Trước 3 giờ').click());
    const cnt = await page.getByTestId('recipient-count').textContent();
    await page.getByTestId('send-notice').click();
    await page.getByText('Đã gửi thông báo.').waitFor({ timeout: 20000 });
    return cnt;
  });
  await ctx.close();
}
const sentDoc = (await adb.collection('office_notices').where('title', '==', TITLE).get()).docs[0];

// 2. GVCN: thanh nhắc, badge, mở tin (tự đọc), sao chép tin PH, xác nhận đã làm
{
  const { ctx, page } = await signIn(GVCN);
  await check('GVCN thấy thanh nhắc sắp hạn', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('office-reminder').filter({ hasText: TITLE }).waitFor({ timeout: 30000 });
    return (await page.getByTestId('office-reminder').textContent()).slice(0, 90);
  });
  await check('Mở tin → tự "đã đọc"; có nút sao chép tin PH; xác nhận đã thực hiện', async () => {
    await page.getByTestId('office-reminder').getByRole('button', { name: new RegExp(TITLE.replace(/[[\]]/g, '\\$&')) }).click();
    await page.getByTestId('notice-detail').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: /Sao chép tin gửi PH\/HS/ }).waitFor();
    await shot(page, 'van_phong_gvcn');
    await page.getByTestId('ack-done').click();
    await page.getByText('Đã xác nhận thực hiện.').waitFor({ timeout: 15000 });
    const a = (await adb.collection('office_notices').doc(sentDoc.id).collection('acks').doc(GVCN).get()).data();
    if (!a?.readAt || !a?.doneAt) throw new Error('chưa ghi xác nhận');
  });
  await check('Esc đóng khung chi tiết', async () => {
    await page.keyboard.press('Escape');
    await page.getByTestId('notice-detail').waitFor({ state: 'detached', timeout: 5000 });
  });
  await check('1 mục menu Thông báo (không còn mục Văn phòng); tin Văn phòng nằm trong hộp thư chung', async () => {
    await page.goto(`${BASE}/announcements`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('notice-item').filter({ hasText: TITLE }).waitFor({ timeout: 20000 });
    if (await page.locator('a[href="/van-phong"]').count()) throw new Error('còn mục menu Văn phòng');
  });
  await check('Sau khi làm xong, thanh nhắc không còn tin này', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const bar = await page.getByTestId('office-reminder').filter({ hasText: TITLE }).count();
    if (bar) throw new Error('vẫn nhắc');
  });
  await ctx.close();
}

// 3. GV không thuộc nhóm không thấy tin
if (GVBM_ONLY) {
  const { ctx, page } = await signIn(GVBM_ONLY);
  await check('GVBM (không chủ nhiệm) không nhận tin dành cho GVCN', async () => {
    await page.goto(`${BASE}/van-phong`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    if (await page.getByText(TITLE).count()) throw new Error('GVBM thấy tin GVCN');
  });
  await ctx.close();
}

// 4. Văn phòng theo dõi: đã đọc / đã làm
{
  const { ctx, page } = await signIn(VP);
  await check('Văn phòng thấy số đã đọc / đã thực hiện', async () => {
    await page.getByTestId('sent-list').waitFor({ timeout: 30000 });
    const row = page.locator('li').filter({ hasText: TITLE });
    await row.getByTestId('sent-counts').waitFor({ timeout: 20000 });
    const t = await row.getByTestId('sent-counts').textContent();
    if (!/Đã làm 1\//.test(t)) throw new Error(t);
    await row.getByRole('button').first().click();
    await page.getByTestId('notice-tracking').waitFor({ timeout: 15000 });
    await shot(page, 'van_phong_theo_doi');
    return t.trim();
  });
  await ctx.close();
}

// Dọn
const mine = await adb.collection('office_notices').where('createdAt', '>=', t0).get();
for (const d of mine.docs) await adb.recursiveDelete(d.ref);
await adb.collection('users').doc(VP).delete();
await browser.close();
stop();
for (const [s, n] of results) console.log(`${s}  ${n}`);
const f = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - f}/${results.length} PASS`);
process.exit(f ? 1 : 0);
