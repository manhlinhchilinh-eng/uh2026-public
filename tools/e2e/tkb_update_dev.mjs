// E2E: Cập nhật TKB từ file Excel của trường — chạy trên project DEV (có GHI dữ liệu dev, tự dọn sau khi chạy).
// Dùng: cd tools/e2e && node tkb_update_dev.mjs "<đường dẫn file TKB .xls>" [thư mục lưu ảnh]
// Luồng: BGH kéo thả file vào tab Thời khóa biểu → xem trước → cập nhật → lịch sử → PH/HS & GVCN nhận thông báo đúng phạm vi
// → BGH hoàn tác → TKB về như cũ. Thêm: GV không thấy mục Cập nhật; ngày nghỉ (T7, ngày BGH khai) → Sổ đầu bài báo không có TKB, không tạo sổ.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const FILE = process.argv[2];
const SHOTS = process.argv[3] || null;
if (!FILE || !existsSync(FILE)) throw new Error('Thiếu file TKB: node tkb_update_dev.mjs "<file.xls>"');

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
const gvcnUid = await uidOf('msphuonganhums');
const gvcnClass = (await adb.collection('users').doc(gvcnUid).get()).data().assignedClassId;
const ROLES = { admin: await uidOf('mshuyentrangums'), gvcn: gvcnUid, parent: `ph_${mhs}` };

const snapshotSchedules = async () => {
  const s = await adb.collection('schedules').get();
  return Object.fromEntries(s.docs.map((d) => [d.id, JSON.stringify((d.data().slots || []).map((x) => [x.dayOfWeek, x.periodIndex, x.subject, x.teacherName]))]));
};
// Sửa tạm 1 tiết của 6A1 trên dev để chắc chắn lớp PH thử nghiệm có thay đổi; khôi phục ở cuối.
const ref6A1 = adb.collection('schedules').doc('6A1');
const orig6A1 = (await ref6A1.get()).data();
await ref6A1.update({ slots: orig6A1.slots.map((x, i) => (i === 0 ? { ...x, subject: 'Môn tạm (test)' } : x)) });
const before = await snapshotSchedules();
const calRef = adb.collection('system_settings').doc('school_calendar');
const origCal = (await calRef.get()).data() ?? null;
const HOLIDAY = '2026-10-14';
const holidayBookExisted = (await adb.collection('daily_logbooks').doc(`${gvcnClass}_${HOLIDAY}`).get()).exists;
const t0 = Date.now();

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
async function signIn(role, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(ROLES[role]));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return { ctx, page };
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

let updateId = null;
let changedClasses = [];

// 1. BGH: tải file, xem trước, cập nhật
{
  const { ctx, page } = await signIn('admin');
  await page.goto(`${BASE}/tkb`, { waitUntil: 'domcontentloaded' });
  await check('Link cũ /tkb → tab Thời khóa biểu › Cập nhật TKB', async () => {
    await page.getByTestId('tkb-dropzone').waitFor({ timeout: 20000 });
    if (!page.url().includes('/schedule?tab=update')) throw new Error(page.url());
  });
  await check('Kéo thả file + xem trước', async () => {
    const b64 = readFileSync(FILE).toString('base64');
    const dt = await page.evaluateHandle(({ b64, name }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const d = new DataTransfer();
      d.items.add(new File([bin], name, { type: 'application/vnd.ms-excel' }));
      return d;
    }, { b64, name: path.basename(FILE) });
    await page.getByTestId('tkb-dropzone').dispatchEvent('drop', { dataTransfer: dt });
    await page.getByText('Lớp có thay đổi').first().waitFor({ timeout: 60000 });
    const n = await page.locator('[aria-label="Chọn lớp"] [role=tab]').count();
    if (n !== 26) throw new Error(`số lớp ${n}`);
    const eff = await page.locator('input[placeholder="vd. 12/10"]').inputValue();
    return `26 lớp, áp dụng từ "${eff}"`;
  });
  await check('Lưới tô các tiết thay đổi', async () => {
    const cells = await page.locator('[data-changed="1"]').count();
    if (cells === 0) throw new Error('không có ô tô vàng');
    await shot(page, 'tkb_preview');
    return `${cells} ô ở lớp đang mở`;
  });
  await check('Cập nhật cho tất cả các lớp', async () => {
    await page.getByRole('button', { name: /^Cập nhật TKB \d+ lớp$/ }).click();
    await page.getByText(/Đã cập nhật \d+ lớp/).waitFor({ timeout: 60000 });
    const s = await adb.collection('schedules').where('updatedAt', '>=', t0).get();
    changedClasses = s.docs.filter((d) => d.data().updateId).map((d) => d.id);
    updateId = s.docs.find((d) => d.data().updateId)?.data().updateId;
    if (!updateId || !s.docs.every((d) => d.data().previous !== undefined)) throw new Error('thiếu updateId/previous');
    return `${changedClasses.length} lớp ghi lại`;
  });
  await check('Lịch sử thay đổi lưu lần cập nhật', async () => {
    await page.getByRole('tab', { name: 'Lịch sử thay đổi' }).click();
    const item = page.getByTestId('tkb-history-item').first();
    await item.waitFor({ timeout: 30000 });
    await item.getByRole('button').first().click();
    await item.locator('[data-changed="1"]').first().waitFor({ timeout: 15000 });
    await shot(page, 'tkb_lich_su');
    return (await item.getByRole('button').first().textContent()).slice(0, 80);
  });
  await check('Có bản tổng hợp cho nhân sự + bản từng lớp', async () => {
    const a = await adb.collection('announcements').where('createdAt', '>=', t0).get();
    const staff = a.docs.filter((d) => d.data().audienceKeys.includes('staff'));
    const cls = a.docs.filter((d) => d.data().classId);
    if (staff.length !== 1 || cls.length !== changedClasses.length) throw new Error(`staff=${staff.length} lớp=${cls.length}`);
    return staff[0].data().title;
  });
  await ctx.close();
}

// 2. PH lớp 6A1 xem thông báo trực quan (màn hình điện thoại)
{
  const { ctx, page } = await signIn('parent', 390);
  await check('PH nhận thông báo TKB lớp 6A1 dạng lưới', async () => {
    if (!changedClasses.includes('6A1')) return '6A1 không đổi — bỏ qua';
    await page.goto(`${BASE}/announcements`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Lớp 6A1: thời khóa biểu thay đổi/).first().click({ timeout: 30000 });
    await page.locator('[data-changed="1"]').first().waitFor({ timeout: 15000 });
    await shot(page, 'tkb_thong_bao_ph');
    return `${await page.locator('[data-changed="1"]').count()} ô`;
  });
  await ctx.close();
}

// 3. GVCN chỉ thấy bản lớp mình + bản tổng hợp
{
  const { ctx, page } = await signIn('gvcn');
  await check(`GVCN ${gvcnClass} không bị ngập thông báo lớp khác`, async () => {
    await page.goto(`${BASE}/announcements`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Cập nhật TKB/).first().waitFor({ timeout: 30000 });
    const titles = await page.getByText(/^Lớp \w+: thời khóa biểu thay đổi/).allTextContents();
    const others = titles.filter((t) => !t.startsWith(`Lớp ${gvcnClass}:`));
    if (others.length) throw new Error(`thấy lớp khác: ${others.slice(0, 3).join('; ')}`);
    return `${titles.length} bản lớp mình`;
  });
  await ctx.close();
}

// 4. BGH hoàn tác → TKB về đúng như trước
{
  const { ctx, page } = await signIn('admin');
  await page.goto(`${BASE}/schedule?tab=update`, { waitUntil: 'domcontentloaded' });
  await check('Hoàn tác khôi phục TKB cũ', async () => {
    await page.getByRole('button', { name: /Hoàn tác lần này/ }).click({ timeout: 30000 });
    await page.getByText(/Đã khôi phục TKB cũ cho \d+ lớp/).waitFor({ timeout: 60000 });
    const after = await snapshotSchedules();
    const diff = Object.keys(before).filter((k) => before[k] !== after[k]);
    if (diff.length) throw new Error(`khác trước: ${diff.join(',')}`);
    return 'khớp 100%';
  });
  await check('Lịch sử ghi "Đã hoàn tác"', async () => {
    const h = (await adb.collection('schedule_updates').doc(updateId).get()).data();
    if (!h?.undoneAt) throw new Error('chưa đánh dấu');
  });
  await check('BGH thêm ngày nghỉ lễ', async () => {
    await page.goto(`${BASE}/schedule?tab=calendar`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Nghỉ từ ngày').fill(HOLIDAY);
    await page.getByLabel('Lý do nghỉ').fill('Nghỉ thử nghiệm E2E');
    await page.getByRole('button', { name: /Thêm ngày nghỉ/ }).click();
    await page.getByTestId('off-period').filter({ hasText: 'Nghỉ thử nghiệm E2E' }).waitFor({ timeout: 20000 });
    await shot(page, 'tkb_ngay_nghi');
  });
  await ctx.close();
}

// 5. GV: không có mục Cập nhật TKB; ngày nghỉ → Sổ đầu bài báo không có TKB; ngày học → lưới kiểu TKB
{
  const { ctx, page } = await signIn('gvcn');
  await check('GV không thấy mục Cập nhật TKB', async () => {
    await page.goto(`${BASE}/schedule?tab=update`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Xem TKB' }).waitFor({ timeout: 20000 });
    if (await page.getByRole('tab', { name: 'Cập nhật TKB' }).count()) throw new Error('GV thấy tab cập nhật');
    if (await page.getByTestId('tkb-dropzone').count()) throw new Error('GV thấy ô tải file');
  });
  await check('Thứ Bảy → Sổ đầu bài báo nghỉ', async () => {
    await page.goto(`${BASE}/logbook?date=2026-10-10`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('off-day-notice').waitFor({ timeout: 20000 });
    if (await page.getByTestId('logbook-timetable').count()) throw new Error('vẫn hiện lưới tiết');
    return (await page.getByTestId('off-day-notice').textContent()).slice(0, 60);
  });
  await check('Ngày nghỉ BGH khai → báo nghỉ, không tạo sổ rỗng', async () => {
    await page.goto(`${BASE}/logbook?date=${HOLIDAY}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('off-day-notice').filter({ hasText: 'Nghỉ thử nghiệm E2E' }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);
    const created = (await adb.collection('daily_logbooks').doc(`${gvcnClass}_${HOLIDAY}`).get()).exists;
    if (created && !holidayBookExisted) throw new Error('đã tạo sổ ngày nghỉ');
    await shot(page, 'so_dau_bai_ngay_nghi');
  });
  await check('Điểm danh đầu giờ ngày nghỉ cũng bị chặn', async () => {
    await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' });
    await page.locator('#attendance-date-input').fill('2026-10-11');
    await page.getByTestId('off-day-notice').waitFor({ timeout: 20000 });
  });
  await check('Ngày học → Sổ đầu bài dạng TKB', async () => {
    await page.goto(`${BASE}/logbook?date=2026-10-12`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('logbook-timetable').waitFor({ timeout: 30000 });
    await page.getByText('Nghỉ trưa').first().waitFor();
    await shot(page, 'so_dau_bai_kieu_tkb');
    return `${await page.locator('[data-testid^="period-card-"]').count()} tiết`;
  });
  await ctx.close();
}

await ref6A1.set(orig6A1);
if (origCal) await calRef.set(origCal); else await calRef.delete();
if (!holidayBookExisted) await adb.collection('daily_logbooks').doc(`${gvcnClass}_${HOLIDAY}`).delete();
const hist = await adb.collection('schedule_updates').where('createdAt', '>=', t0).get();
await Promise.all(hist.docs.map((d) => d.ref.delete()));

// Dọn thông báo thử trên dev
const created = await adb.collection('announcements').where('createdAt', '>=', t0).get();
await Promise.all(created.docs.filter((d) => d.data().kind === 'schedule_change').map((d) => d.ref.delete()));

await browser.close();
stop();
for (const [s, n] of results) console.log(`${s}  ${n}`);
const fails = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - fails}/${results.length} PASS (đã dọn ${created.size} thông báo thử)`);
process.exit(fails ? 1 : 0);
