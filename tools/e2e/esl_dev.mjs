// E2E tiết ESL trên DEV (P4.5): BGH chọn phương án → GV/BGH ghi tiết ESL → bản ghi gọn esl_periods → số liệu theo lớp.
// node esl_dev.mjs   (cần dev server đang chạy: BASE mặc định http://localhost:5173; chỉ sodaubai-dev; tự dọn & khôi phục cấu hình)

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:5173';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();

const CLASS = '9A6';
const DATE = '2026-10-12';
const P = 2;
const DAILY = `${CLASS}_${DATE}`;
const periodRef = adb.collection('daily_logbooks').doc(DAILY).collection('periods').doc(String(P));
const eslRef = adb.collection('esl_periods').doc(`${DAILY}_${P}`);
const cfgRef = adb.collection('system_settings').doc('esl');
const before = { period: (await periodRef.get()).data() ?? null, esl: (await eslRef.get()).data() ?? null, cfg: (await cfgRef.get()).data() ?? null };
const bookExisted = (await adb.collection('daily_logbooks').doc(DAILY).get()).exists;
await cfgRef.delete(); // bắt đầu từ trạng thái mặc định (tắt)

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));

const openPeriod = async () => {
  await page.goto(`${BASE}/logbook?date=${DATE}&classId=${CLASS}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId(`period-card-${P}`).click({ timeout: 30000 });
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 20000 });
  await page.waitForTimeout(800); // tải cấu hình ESL
  return dlg;
};
const fillBasics = async (dlg) => {
  const nums = dlg.locator('input[type=number]');
  const n = await nums.count();
  for (const [i, v] of [4, 3, 1, 1].entries()) await nums.nth(n - 4 + i).fill(String(v));
  await dlg.getByPlaceholder(/VD: Luyện tập/).fill('[E2E] Tiết ESL');
  await dlg.locator('#period-subject-input').fill('Khoa học tự nhiên');
  await dlg.getByRole('checkbox').last().check();
};
const submit = (dlg) => dlg.getByRole('button', { name: /Lưu|Ký/ }).last().click();

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 60000 });
  const adminUid = (await adb.collection('users').where('username', '==', 'mshuyentrangums').get()).docs[0].id;
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(adminUid));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });

  // 1. Mặc định tắt: form ghi tiết KHÔNG có khối ESL
  let dlg = await openPeriod();
  check('Mặc định tắt: form ghi tiết không có khối ESL', (await dlg.getByTestId('esl-fields').count()) === 0);
  await page.keyboard.press('Escape');

  // 2. Trang /esl: 2 phương án + xem thử, bật phương án B
  await page.goto(`${BASE}/esl`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('esl-status').filter({ hasText: /Đang tắt/ }).waitFor({ timeout: 20000 });
  check('Trang ESL hiện 2 phương án', (await page.getByTestId('esl-option-quick').count()) === 1 && (await page.getByTestId('esl-option-clil').count()) === 1);
  check('Xem thử phương án B có ô mục tiêu ngôn ngữ', (await page.getByTestId('esl-option-clil').getByTestId('esl-objective').count()) === 1);
  check('Xem thử phương án A không có ô mục tiêu', (await page.getByTestId('esl-option-quick').getByTestId('esl-objective').count()) === 0);
  check('Có thẻ "GV tự chọn"', (await page.getByTestId('esl-option-choice').count()) === 1);
  await page.getByTestId('esl-apply-choice').click();
  await page.getByTestId('esl-status').filter({ hasText: /Đang bật/ }).waitFor({ timeout: 20000 });
  check('Bật chế độ GV tự chọn → lưu system_settings/esl', (await cfgRef.get()).data()?.option === 'choice');

  // 3. GV tự chọn: mặc định báo cáo nhanh; chuyển "Chi tiết" → thiếu mục tiêu bị chặn; đủ → lưu
  dlg = await openPeriod();
  check('Form ghi tiết có khối ESL', (await dlg.getByTestId('esl-fields').count()) === 1);
  await fillBasics(dlg);
  await dlg.getByTestId('esl-toggle').check();
  check('Mặc định "Báo cáo nhanh": không có ô mục tiêu', (await dlg.getByTestId('esl-objective').count()) === 0);
  await dlg.getByTestId('esl-report-clil').click();
  check('Chọn "Chi tiết": hiện ô mục tiêu', (await dlg.getByTestId('esl-objective').count()) === 1);
  await dlg.getByTestId('esl-level-full').click();
  await submit(dlg);
  check('Phương án B thiếu mục tiêu ngôn ngữ → chặn lưu', await dlg.getByText(/nhập mục tiêu ngôn ngữ/).isVisible({ timeout: 5000 }).catch(() => false));
  await dlg.getByTestId('esl-objective').fill('Students can describe the water cycle');
  await submit(dlg);
  await page.getByText(new RegExp(`Đã lưu sổ tiết ${P}`)).waitFor({ timeout: 30000 });
  const saved = (await periodRef.get()).data();
  check('Doc tiết có esl đúng', saved?.esl?.level === 'full' && saved?.esl?.option === 'clil' && /water cycle/.test(saved?.esl?.objective || ''), JSON.stringify(saved?.esl));
  const rec = (await eslRef.get()).data();
  check('Có bản ghi gọn esl_periods', rec?.classId === CLASS && rec?.date === DATE && rec?.level === 'full', JSON.stringify(rec && { classId: rec.classId, date: rec.date }));
  await page.waitForTimeout(800);
  check('Thẻ tiết hiện nhãn ESL', (await page.getByTestId('esl-badge').count()) >= 1);

  // 4. Số liệu theo lớp
  await page.goto(`${BASE}/esl`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('esl-load-stats').click();
  await page.getByTestId('esl-stats-line').waitFor({ timeout: 20000 });
  check('Bảng số liệu có lớp 9A6', (await page.locator('table').getByText(CLASS, { exact: true }).count()) === 1);

  // 5. Đổi sang phương án A, bỏ đánh dấu ESL → xóa bản ghi gọn
  await page.getByTestId('esl-apply-quick').click();
  await page.getByTestId('esl-status').filter({ hasText: /Phương án A/ }).waitFor({ timeout: 20000 });
  dlg = await openPeriod();
  check('Phương án A: form không có ô mục tiêu', (await dlg.getByTestId('esl-objective').count()) === 0);
  await dlg.getByTestId('esl-toggle').uncheck();
  await submit(dlg);
  await page.getByText(new RegExp(`Đã lưu sổ tiết ${P}`)).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  check('Bỏ ESL → xóa bản ghi gọn', !(await eslRef.get()).exists);
  check('Không lỗi console', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (e) {
  fail++;
  console.log(`FAIL  ${String(e.message || e).split('\n')[0]}`);
  if (errors.length) console.log('console:', errors.slice(0, 3).join(' | '));
  await page.screenshot({ path: path.join(process.env.TEMP || '.', 'esl_dev_fail.png'), fullPage: true }).catch(() => {});
} finally {
  if (before.period) await periodRef.set(before.period);
  else await periodRef.delete();
  if (before.esl) await eslRef.set(before.esl);
  else await eslRef.delete();
  if (before.cfg) await cfgRef.set(before.cfg);
  else await cfgRef.delete();
  if (!bookExisted) await adb.recursiveDelete(adb.collection('daily_logbooks').doc(DAILY));
  await browser.close();
}
console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
