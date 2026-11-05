// E2E hồi quy: GV chấm 1 tiết (điểm nguyên, để trống "Tiết PPCT"), ký và lưu → Firestore có bản ghi đúng.
// Lỗi gốc (2026-10-10): "Unsupported field value: undefined (found in field ppctLessonIndex)".
// Dùng: cd tools/e2e && node save_period_dev.mjs   (chỉ sodaubai-dev; tự dọn tiết thử)

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const PORT = Number(process.env.E2E_PORT || 5174);
const BASE = `http://localhost:${PORT}`;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();
// USER=msphuonganhums (GVCN 6A1) để thử quyền GV; mặc định BGH
const ADMIN = (await adb.collection('users').where('username', '==', process.env.USER_NAME || 'mshuyentrangums').get()).docs[0].id;
const CLASS = process.env.CLASS_ID || '9A6';
const DATE = '2026-10-12';
const P = 2;
const ref = adb.collection('daily_logbooks').doc(`${CLASS}_${DATE}`).collection('periods').doc(String(P));
const before = (await ref.get()).data() ?? null;
const bookExisted = (await adb.collection('daily_logbooks').doc(`${CLASS}_${DATE}`).get()).exists;

const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], { cwd: APP, shell: true, stdio: 'ignore' });
const stop = () => { try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
let ok = false;
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 60000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(ADMIN));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.goto(`${BASE}/logbook?date=${DATE}&classId=${CLASS}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId(`period-card-${P}`).click({ timeout: 30000 });
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 20000 });
  const nums = dlg.locator('input[type=number]');
  // Ô số đầu tiên có thể là "Tiết PPCT" — để trống; 4 ô điểm là 4 ô cuối
  const n = await nums.count();
  const steps = await Promise.all([...Array(4)].map((_, i) => nums.nth(n - 4 + i).getAttribute('step')));
  if (steps.some((s) => s !== '1')) throw new Error(`bước nhập điểm: ${steps.join(',')}`);
  for (const [i, v] of [4, 3, 1, 1].entries()) await nums.nth(n - 4 + i).fill(String(v));
  const topic = dlg.getByPlaceholder(/VD: Luyện tập/);
  await topic.fill('[E2E] Kiểm tra lưu tiết');
  await dlg.getByRole('checkbox').last().check();
  await dlg.getByRole('button', { name: /Lưu|Ký/ }).last().click();
  await page.getByText(/Đã lưu sổ tiết 2/).waitFor({ timeout: 30000 });
  const saved = (await ref.get()).data();
  if (!saved?.isSigned || saved.scores?.total !== 9) throw new Error(`Firestore: ${JSON.stringify(saved?.scores)} signed=${saved?.isSigned}`);
  if ('ppctLessonIndex' in saved) throw new Error('vẫn ghi ppctLessonIndex khi để trống');
  ok = true;
  console.log('PASS  Chấm 9đ (4+3+1+1), để trống PPCT, ký và lưu thành công; Firestore total=9');
} catch (e) {
  console.log(`FAIL  ${String(e.message || e).split('\n')[0]}`);
  if (errors.length) console.log('console:', errors.slice(0, 3).join(' | '));
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true }).catch(() => {});
}
if (before) await ref.set(before); else await ref.delete();
if (!bookExisted) await adb.recursiveDelete(adb.collection('daily_logbooks').doc(`${CLASS}_${DATE}`));
await browser.close();
stop();
process.exit(ok ? 0 : 1);
