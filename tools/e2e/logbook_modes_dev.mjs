// E2E: Sổ đầu bài 2 chế độ (lớp chủ nhiệm / chấm tiết dạy), gắn tên TKB, Giám thị, tổng kết TPT, tổng hợp học bạ.
// Dùng: cd tools/e2e && node logbook_modes_dev.mjs [thư mục lưu ảnh]
// Chạy trên sodaubai-dev; tự tạo tài khoản Giám thị thử và tự dọn dữ liệu thử sau khi chạy.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
const uidOf = async (u) => (await adb.collection('users').where('username', '==', u).get()).docs[0]?.id;

const GVCN = await uidOf('msphuonganhums'); // GVCN 6A1, tên TKB "Ms P.Anh"
const ADMIN = await uidOf('mshuyentrangums');
const TPT = await uidOf('mrhoanglongums');
const tptMust = (await adb.collection('users').doc(TPT).get()).data().mustChangePassword;
await adb.collection('users').doc(TPT).update({ mustChangePassword: false });
const GT = 'e2e_giamthi';
await adb.collection('users').doc(GT).set({ uid: GT, username: 'e2e_giamthi', displayName: 'Giám thị E2E', roles: ['giamthi'], mustChangePassword: false });
const aliasOrig = (await adb.collection('teacher_aliases').doc(GVCN).get()).data() ?? null;
await adb.collection('teacher_aliases').doc(GVCN).delete();
const MONDAY = '2026-10-12';
const FRESH = { classId: '7A5', date: '2026-10-15' };
const freshExisted = (await adb.collection('daily_logbooks').doc(`${FRESH.classId}_${FRESH.date}`).get()).exists;

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
async function signIn(uid) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return { ctx, page };
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const scopeText = (page) => page.getByTestId('edit-scope').textContent({ timeout: 30000 });

// 1. GVCN: 2 chế độ, tự chọn tên TKB, chấm tiết dạy
{
  const { ctx, page } = await signIn(GVCN);
  await check('GVCN thấy 2 chế độ, sổ lớp chủ nhiệm khóa lớp 6A1', async () => {
    await page.goto(`${BASE}/logbook?date=${MONDAY}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Sổ lớp chủ nhiệm (6A1)' }).waitFor({ timeout: 30000 });
    await page.getByRole('tab', { name: 'Chấm tiết dạy của tôi' }).waitFor();
    if (!(await page.locator('#logbook-class-select').isDisabled())) throw new Error('chọn được lớp khác');
  });
  await check('GVCN ghi mọi tiết lớp mình', async () => {
    const t = await scopeText(page);
    if (!/lớp chủ nhiệm/.test(t)) throw new Error(t);
    return t.slice(0, 90);
  });
  await check('Chế độ tiết dạy: chưa chọn tên → hiện ô chọn tên TKB', async () => {
    await page.getByRole('tab', { name: 'Chấm tiết dạy của tôi' }).click();
    await page.getByTestId('alias-picker').waitFor({ timeout: 20000 });
  });
  await check('GV tự chọn "Ms P.Anh" → danh sách tiết dạy trong ngày', async () => {
    await page.getByLabel('Tìm tên trên TKB').fill('P.Anh');
    await page.getByRole('button', { name: /^Ms P\.Anh\b(?!\(Eng\))/ }).first().click();
    await page.getByRole('button', { name: /Lưu tên của tôi/ }).click();
    await page.getByTestId('my-teaching-day').waitFor({ timeout: 30000 });
    const n = await page.locator('[data-testid^="my-period-"]').count();
    if (n === 0) throw new Error('không có tiết');
    const saved = (await adb.collection('teacher_aliases').doc(GVCN).get()).data();
    if (!saved?.aliases?.includes('Ms P.Anh')) throw new Error('chưa lưu');
    await shot(page, 'tiet_day_cua_toi');
    return `${n} tiết`;
  });
  await check('Bấm tiết dạy → mở form ghi sổ đúng lớp/tiết', async () => {
    const first = page.locator('[data-testid^="my-period-"]').first();
    const key = (await first.getAttribute('data-testid')).replace('my-period-', '');
    await first.click();
    await page.getByRole('dialog').first().waitFor({ timeout: 20000 });
    const label = await page.getByRole('dialog').first().getAttribute('aria-label');
    const [cls, p] = key.split('_');
    if (label !== `Ghi sổ đầu bài tiết ${p} lớp ${cls}`) throw new Error(label);
    await page.reload({ waitUntil: 'domcontentloaded' });
    return label;
  });
  await check('Sổ lớp chủ nhiệm: tiết của mình + các tiết khác (lớp chủ nhiệm)', async () => {
    await page.getByRole('tab', { name: 'Sổ lớp chủ nhiệm (6A1)' }).click();
    const t = await scopeText(page);
    if (!/tiết 1 \(của bạn\)/.test(t)) throw new Error(t);
    return t.slice(0, 110);
  });
  await check('GVCN: Tổng hợp cho học bạ lớp 6A1', async () => {
    await page.goto(`${BASE}/behavior?tab=hocba`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('conduct-row').first().waitFor({ timeout: 30000 });
    if (!(await page.getByLabel('Lớp').isDisabled())) throw new Error('GVCN đổi được lớp');
    await shot(page, 'tong_hop_hoc_ba');
    return `${await page.getByTestId('conduct-row').count()} HS`;
  });
  await ctx.close();
}

// 2. GV khác nhận trùng tên → BGH thấy xung đột và sửa
await adb.collection('teacher_aliases').doc(TPT).set({ uid: TPT, username: 'mrhoanglongums', displayName: 'TPT E2E', aliases: ['Ms P.Anh'], updatedAt: Date.now(), updatedBy: 'e2e' });
{
  const { ctx, page } = await signIn(ADMIN);
  await check('BGH: mục Gắn GV thấy tên bị trùng', async () => {
    await page.goto(`${BASE}/schedule?tab=teachers`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('alias-row').first().waitFor({ timeout: 30000 });
    await page.getByText(/tên có 2 người cùng nhận/).waitFor({ timeout: 15000 });
    await shot(page, 'gan_gv');
  });
  await check('BGH chọn đúng 1 người → hết trùng', async () => {
    await page.getByLabel('Gán tên Ms P.Anh', { exact: true }).selectOption(GVCN);
    await page.getByText(/Đã gán "Ms P.Anh"/).waitFor({ timeout: 20000 });
    const tpt = (await adb.collection('teacher_aliases').doc(TPT).get()).data();
    if (tpt?.aliases?.length) throw new Error('chưa gỡ khỏi người kia');
  });
  await check('Lớp trộn: Eng 1 khối 9 mặc định 10đ (+Eng9 Hub), NN2 không chấm', async () => {
    const all = (await adb.collection('schedules').get()).docs.filter((d) => /^\d[A-Z]\d$/.test(d.id));
    const mon = (d, subj) => (d.data().slots || []).find((x) => x.subject === subj);
    const dateOf = (slot) => `2026-10-${String(12 + slot.dayOfWeek - 2).padStart(2, '0')}`;
    const eng9 = all.find((d) => d.id.startsWith('9') && mon(d, 'Eng 1'));
    const nn2 = all.find((d) => mon(d, 'Foreign language 2'));
    if (!eng9 || !nn2) return 'TKB dev không có tiết phù hợp — bỏ qua';
    await page.goto(`${BASE}/logbook?date=${dateOf(mon(eng9, 'Eng 1'))}&classId=${eng9.id}`, { waitUntil: 'domcontentloaded' });
    const pe = mon(eng9, 'Eng 1').periodIndex;
    await page.getByTestId(`mixed-label-${pe}`).waitFor({ timeout: 30000 });
    const t1 = await page.getByTestId(`mixed-label-${pe}`).textContent();
    if (!/mặc định 10đ/.test(t1) || !/Eng9 Hub/.test(t1)) throw new Error(t1);
    await page.goto(`${BASE}/logbook?date=${dateOf(mon(nn2, 'Foreign language 2'))}&classId=${nn2.id}`, { waitUntil: 'domcontentloaded' });
    const pn = mon(nn2, 'Foreign language 2').periodIndex;
    await page.getByTestId(`mixed-label-${pn}`).waitFor({ timeout: 30000 });
    const t2 = await page.getByTestId(`mixed-label-${pn}`).textContent();
    if (!/không chấm/.test(t2)) throw new Error(t2);
    await page.goto(`${BASE}/schedule?tab=mixed`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Eng 1 khối 9').waitFor({ timeout: 30000 });
    if ((await page.getByLabel('Eng 1 khối 9').inputValue()) !== 'auto10') throw new Error('cấu hình Eng 1 K9');
    if ((await page.getByLabel('Eng Test prep khối 9').inputValue()) !== 'normal') throw new Error('Eng Test prep phải bình thường');
    await shot(page, 'lop_tron');
    return `${eng9.id} tiết ${pe}, ${nn2.id} tiết ${pn}`;
  });
  await check('BGH: Phân vai trò nhân sự (tài khoản thật)', async () => {
    await page.goto(`${BASE}/users?tab=roles`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('staff-roles').getByText('Giám thị E2E').waitFor({ timeout: 30000 });
  });
  await ctx.close();
}

// 3. Giám thị: chỉ xem, không tạo sổ, ghi nề nếp, xem tổng kết
{
  const { ctx, page } = await signIn(GT);
  await check('Giám thị: chỉ chế độ "Sổ các lớp", chọn được mọi lớp, chỉ xem', async () => {
    await page.goto(`${BASE}/logbook?date=${FRESH.date}&classId=${FRESH.classId}`, { waitUntil: 'domcontentloaded' });
    const t = await scopeText(page);
    if (await page.getByRole('tab', { name: 'Chấm tiết dạy của tôi' }).count()) throw new Error('có chế độ chấm tiết');
    if (await page.locator('#logbook-class-select').isDisabled()) throw new Error('không chọn được lớp');
    if (!/chỉ xem/.test(t)) throw new Error(t);
    await page.waitForTimeout(2000);
    const created = (await adb.collection('daily_logbooks').doc(`${FRESH.classId}_${FRESH.date}`).get()).exists;
    if (created && !freshExisted) throw new Error('Giám thị mở sổ đã tạo sổ nháp');
    return t;
  });
  await check('Giám thị: bảng tổng kết sổ đầu bài toàn trường', async () => {
    await page.goto(`${BASE}/emulation`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ranking-row').first().waitFor({ timeout: 60000 });
    return `${await page.getByTestId('ranking-row').count()} lớp`;
  });
  await ctx.close();
}

// 4. TPT: tổng kết theo tháng
{
  const { ctx, page } = await signIn(TPT);
  await check('TPT: tổng kết sổ đầu bài theo tháng (dữ liệu thật)', async () => {
    await page.goto(`${BASE}/emulation`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('logbook-ranking').waitFor({ timeout: 30000 });
    await page.getByLabel('Theo tuần hoặc tháng').selectOption('month');
    await page.getByTestId('ranking-row').first().waitFor({ timeout: 60000 });
    await shot(page, 'tong_ket_tpt');
    return `${await page.getByTestId('ranking-row').count()} lớp`;
  });
  await ctx.close();
}

// Dọn dữ liệu thử
if (aliasOrig) await adb.collection('teacher_aliases').doc(GVCN).set(aliasOrig); else await adb.collection('teacher_aliases').doc(GVCN).delete();
await adb.collection('teacher_aliases').doc(TPT).delete();
await adb.collection('users').doc(TPT).update({ mustChangePassword: tptMust ?? false });
await adb.collection('users').doc(GT).delete();
if (!freshExisted) await adb.collection('daily_logbooks').doc(`${FRESH.classId}_${FRESH.date}`).delete();

await browser.close();
stop();
for (const [s, n] of results) console.log(`${s}  ${n}`);
const fails = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - fails}/${results.length} PASS`);
process.exit(fails ? 1 : 0);
