// E2E sổ điểm môn học trên sodaubai-dev: GVBM nhập → Ghi → Công bố → Xuất Excel; GVCN xem tổng hợp lớp; PH thấy điểm con.
// Dùng: BASE=http://localhost:5181 node gradebook_dev.mjs   (cần dev server + rules mới trên sodaubai-dev)
// Đăng nhập bằng custom token (window.__umsDevSignIn), không dùng mật khẩu. Không in dữ liệu HS. Dọn dữ liệu thử ở cuối.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:5181';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();

const now = new Date();
const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
const YEAR = `${y}-${y + 1}`;
const m = now.getMonth() + 1;
const TERM = m >= 8 || (m === 1 && now.getDate() <= 15) ? 1 : 2;
const CLASS = '6A1';
const uidOf = async (username) => (await adb.collection('users').where('username', '==', username).get()).docs[0].id;
const gvbm = await uidOf('msthanhhuyenums'); // GVCN 7A3, dạy thử Toán 6A1
const gvcn = await uidOf('msphuonganhums'); // GVCN 6A1
const firstStudent = (await adb.collection('students').doc('6A1_01').get()).data();
const mhs = String(firstStudent.mhs);
const parent = `ph_${mhs}`;

const AID = `${YEAR}_${CLASS}_toan`;
const GB = `${YEAR}_HK${TERM}_${CLASS}_toan`;
const REP = `${YEAR}_HK${TERM}_${mhs}`;
const aRef = adb.collection('grade_assignments').doc(AID);
const gbRef = adb.collection('gradebooks').doc(GB);
const repRef = adb.collection('grade_reports').doc(REP);
const before = { a: (await aRef.get()).data() ?? null, gb: (await gbRef.get()).exists, rep: (await repRef.get()).data() ?? null };
if (before.gb) throw new Error(`Sổ ${GB} đã có trên dev — dừng để không ghi đè.`);
await aRef.set({ id: AID, year: YEAR, classId: CLASS, subjectKey: 'toan', subjectName: 'Toán', mode: 'score', txMin: 2, teacherUids: [gvbm], teacherNames: ['GV E2E'], unresolvedNames: [], source: 'manual' });

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [];
const login = async (uid) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text().slice(0, 200)));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 60000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return { ctx, page };
};

try {
  // ---- GVBM ----
  const { ctx: c1, page } = await login(gvbm);
  await page.goto(`${BASE}/so-diem`, { waitUntil: 'domcontentloaded' });
  const grid = page.getByTestId('gb-grid');
  await grid.waitFor({ timeout: 30000 });
  check('GVBM thấy lưới nhập điểm lớp-môn được phân công', (await page.getByLabel('Lớp').inputValue()) === CLASS);
  const headers = (await grid.locator('thead').innerText()).replace(/\s+/g, ' ');
  check('Bố cục cột kiểu CSDL', ['STT', 'Mã định danh Bộ GD&ĐT', 'Họ tên', 'ĐĐGtx', 'ĐĐGgk', 'ĐĐGck', `ĐTBmhk${TERM}`, 'Nhận xét'].every((h) => headers.includes(h)), headers.slice(0, 120));

  // Nhảy dòng: Enter đi sang phải
  const cell = (r, c) => grid.locator(`input[data-cell="${r}-${c}"]`);
  await cell(0, 0).click();
  for (const v of ['8', '7', '', '', '', '7', '85']) {
    await page.keyboard.type(v);
    await page.keyboard.press('Enter');
  }
  check('Nhảy dòng: sau 7 lần Enter con trỏ ở ô Nhận xét', await page.evaluate(() => document.activeElement?.getAttribute('data-cell')) === '0-7');
  check('Nhập nhanh "85" → hiện 8,5 khi rời ô', (await cell(0, 6).inputValue()) === '8,5', await cell(0, 6).inputValue());
  const row0 = grid.locator('tbody tr').first();
  check('ĐTBmhk tự tính 7,8 = (8+7+2·7+3·8,5)/7', (await row0.innerText()).includes('7,8'));

  // Nhảy cột: Enter đi xuống
  await page.getByLabel(/Nhảy cột/).check();
  await cell(1, 0).click();
  await page.keyboard.type('105');
  await page.keyboard.press('Enter');
  check('Nhảy cột: Enter xuống dòng dưới', await page.evaluate(() => document.activeElement?.getAttribute('data-cell')) === '2-0');
  check('Ô "105" tô đỏ', (await cell(1, 0).getAttribute('class')).includes('red'));
  await page.getByTestId('gb-save').click();
  await page.waitForTimeout(800);
  check('Không ghi khi còn ô sai', !(await gbRef.get()).exists);
  await cell(1, 0).fill('9');

  await page.getByTestId('gb-save').click();
  await page.getByTestId('gb-status').filter({ hasText: 'Nháp' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);
  const saved = (await gbRef.get()).data();
  check('Ghi → sổ bản 1, nháp, điểm đúng', saved?.version === 1 && saved?.status === 'draft' && saved?.rows?.[mhs]?.ck === 8.5);
  check('Ghi → có 1 dòng lịch sử', (await gbRef.collection('history').get()).size === 1);
  check('Nháp → PH chưa có bản công bố', !(await repRef.get()).exists || !(await repRef.get()).data()?.subjects?.toan);

  await page.getByTestId('gb-publish').click();
  await page.getByTestId('gb-status').filter({ hasText: 'Đã công bố' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const rep = (await repRef.get()).data();
  check('Công bố → grade_reports có môn Toán của HS', rep?.subjects?.toan?.result === '7.8' && rep?.mhs === mhs);

  // Sửa sau công bố → hỏi lý do (dialog tự chấp nhận với chuỗi rỗng → không ghi). Dùng prompt có giá trị:
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('Chấm phúc khảo') : d.accept()));
  await cell(0, 5).fill('8');
  await page.getByTestId('gb-save').click();
  await page.waitForTimeout(2500);
  const after = (await gbRef.get()).data();
  const hist = (await gbRef.collection('history').orderBy('at', 'desc').limit(1).get()).docs[0]?.data();
  check('Sửa sau công bố: ghi bản 3 kèm lý do', after?.version === 3 && hist?.reason === 'Chấm phúc khảo');
  check('Sửa sau công bố: bản PH xem tự cập nhật', (await repRef.get()).data()?.subjects?.toan?.gk === 8);

  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId('gb-export').click()]);
  check('Xuất Excel đúng tên file', dl.suggestedFilename() === `SoDiem_${CLASS}_toan_HK${TERM}_${YEAR}.xlsx`, dl.suggestedFilename());
  await page.screenshot({ path: path.resolve(HERE, 'gradebook_gvbm.png') });
  await c1.close();

  // ---- GVCN ----
  const { ctx: c2, page: p2 } = await login(gvcn);
  await p2.goto(`${BASE}/so-diem`, { waitUntil: 'domcontentloaded' });
  await p2.getByTestId('gb-tab-class').click({ timeout: 30000 });
  const mx = p2.getByTestId('gb-class-matrix');
  await mx.waitFor({ timeout: 30000 });
  check('GVCN thấy cột Toán trong tổng hợp lớp', (await mx.locator('thead').innerText()).includes('Toán'));
  check('GVCN thấy ĐTB mới (8,1)', (await mx.locator('tbody tr').first().innerText()).includes('8,1')); // (8+7+16+25.5)/7 = 8,07
  await p2.screenshot({ path: path.resolve(HERE, 'gradebook_gvcn.png') });
  await c2.close();

  // ---- PH ----
  const { ctx: c3, page: p3 } = await login(parent);
  await p3.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  const card = p3.getByTestId(`family-grades-${mhs}`);
  await card.waitFor({ timeout: 30000 });
  await card.getByText('Toán').waitFor({ timeout: 20000 });
  check('PH thấy điểm Toán của con (8,1)', (await card.innerText()).includes('8,1'));
  const denied = await p3.evaluate(async () => location.pathname);
  await p3.goto(`${BASE}/so-diem`, { waitUntil: 'domcontentloaded' });
  await p3.waitForTimeout(2000);
  check('PH không vào được /so-diem', !p3.url().includes('/so-diem'), denied);
  await p3.screenshot({ path: path.resolve(HERE, 'gradebook_ph.png') });
  await c3.close();

  const relevant = errors.filter((e) => !/favicon|DevTools|net::ERR/.test(e));
  check('Không lỗi console', relevant.length === 0, relevant.slice(0, 3).join(' | '));
} catch (e) {
  fail++;
  console.log('FAIL (ngoại lệ)', e.message.slice(0, 300));
} finally {
  await adb.recursiveDelete(gbRef);
  if (before.a) await aRef.set(before.a);
  else await aRef.delete();
  if (before.rep) await repRef.set(before.rep);
  else await repRef.delete();
  await browser.close();
  console.log(`\n${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
}
