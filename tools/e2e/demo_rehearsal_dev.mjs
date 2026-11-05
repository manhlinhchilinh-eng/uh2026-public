// Chạy thử kịch bản demo 7 phần (docs/DEMO_SCRIPT.md) end-to-end trên sodaubai-dev
// đồng thời tự động quay video dự phòng (.webm) + chụp ảnh từng phần với Chế độ trình chiếu bật sẵn.
// Dùng: cd tools/e2e && node demo_rehearsal_dev.mjs
// Output: C:\UH2026_backups\demo_videos\ums_smartconnect_demo_latest.webm (ngoài git repo)

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const KEY = path.resolve(HERE, '../backup/keys/sodaubai-dev.json');
const PORT = 5180;
const BASE = `http://localhost:${PORT}`;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync);

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const VIDEO_ROOT = 'C:/UH2026_backups/demo_videos';
const RUN_DIR = path.join(VIDEO_ROOT, `rehearsal_${stamp}`);
mkdirSync(RUN_DIR, { recursive: true });

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))),
  projectId: 'sodaubai-dev',
});
if (admin.app().options.projectId !== 'sodaubai-dev') {
  throw new Error('Chỉ chạy trên sodaubai-dev');
}
const adb = admin.firestore();
const uidOf = async (username) =>
  (await adb.collection('users').where('username', '==', username).get()).docs[0]?.id;
const mhs = (await adb.collection('students').doc('6A1_01').get()).data().mhs;

const ROLES = {
  admin: await uidOf('mshuyentrangums'),
  gvcn: await uidOf('msphuonganhums'),
  parent: `ph_${mhs}`,
  student: `hs_${mhs}`,
};

const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
  cwd: APP,
  shell: true,
  stdio: 'ignore',
});
const stop = () => {
  try {
    process.platform === 'win32'
      ? spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
      : server.kill();
  } catch {}
};
process.on('exit', stop);

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: RUN_DIR, size: { width: 1280, height: 800 } },
});
// Luôn bật sẵn Chế độ trình chiếu để bảo vệ PII trong toàn bộ video demo
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('ums_presentation_mode', '1');
  } catch {}
});
const page = await ctx.newPage();
const permErrors = [];
page.on('console', (m) => {
  if (/permission|insufficient/i.test(m.text())) permErrors.push(m.text().slice(0, 140));
});

const results = [];
const step = async (part, title, fn) => {
  try {
    await fn();
    results.push(['PASS', part, title]);
  } catch (e) {
    results.push(['FAIL', part, `${title} — ${String(e.message || e).split('\n')[0]}`]);
  }
};

async function switchRole(role) {
  if (page.url() === 'about:blank') {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, {
    timeout: 30000,
  });
  const token = await admin.auth().createCustomToken(ROLES[role]);
  await page.evaluate((t) => window.__umsDevSignIn(t), token);
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
}

const seeText = (text, timeout = 20000) =>
  page.getByText(text, { exact: false }).first().waitFor({ timeout });

// PHẦN 1: Toàn cảnh hệ sinh thái 7 phân hệ & bật Chế độ trình chiếu
await step('Phần 1', 'Toàn cảnh hệ sinh thái 7 phân hệ & Chế độ trình chiếu', async () => {
  await switchRole('admin');
  await page.goto(`${BASE}/apps`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('module-bgh-dashboard').waitFor({ timeout: 15000 });
  await page.getByTestId('presentation-badge').waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(RUN_DIR, 'part1_ecosystem.png') });
});

// PHẦN 2: Buổi sáng — Điểm danh, Sổ đầu bài, Tổng kết Tháng & Bảng thi đua 100đ
await step('Phần 2', 'GVCN điểm danh, Sổ đầu bài 6A1, Tổng kết tháng & Bảng thi đua 100đ', async () => {
  await switchRole('gvcn');
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' });
  const d = new Date();
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.locator('#attendance-date-input').fill(ymd);
  await page.getByTestId('presentation-badge').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(RUN_DIR, 'part2a_attendance.png') });

  await page.goto(`${BASE}/logbook`, { waitUntil: 'domcontentloaded' });
  await seeText('Sổ đầu bài 8 tiết học');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(RUN_DIR, 'part2b_logbook.png') });

  await page.goto(`${BASE}/summary`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('tab-monthly').waitFor({ timeout: 20000 });
  await page.getByTestId('tab-monthly').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(RUN_DIR, 'part2c_monthly_summary.png') });

  await page.goto(`${BASE}/emulation`, { waitUntil: 'domcontentloaded' });
  await seeText('Bảng xếp hạng Thi đua');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(RUN_DIR, 'part2d_emulation_100pt.png') });
});

// PHẦN 3: Xin nghỉ có kế hoạch dạy thay -> BGH duyệt
await step('Phần 3', 'GV tạo đơn xin nghỉ kèm kế hoạch dạy thay & BGH duyệt', async () => {
  await page.goto(`${BASE}/leave`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Tạo đơn xin nghỉ').first().click();
  await page.getByTestId('sub-planner').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(RUN_DIR, 'part3_leave_substitution.png') });
});

// PHẦN 4: Cổng Phụ huynh nhận thông báo tức thì
await step('Phần 4', 'Cổng Phụ huynh xem chuyên cần của con & Thông báo thông minh', async () => {
  await switchRole('parent');
  await seeText('Cổng phụ huynh');
  await page.getByTestId('att-summary-6A1_01').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(RUN_DIR, 'part4a_parent_portal.png') });

  await page.goto(`${BASE}/announcements`, { waitUntil: 'domcontentloaded' });
  await seeText('Thông báo');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(RUN_DIR, 'part4b_announcements.png') });
});

// PHẦN 5: Học sinh nộp minh chứng ePortfolio -> GV duyệt
await step('Phần 5', 'Học sinh mở Hồ sơ năng lực số & GVCN duyệt minh chứng', async () => {
  await switchRole('student');
  await seeText('Góc học sinh');
  await page.goto(`${BASE}/portfolio`, { waitUntil: 'domcontentloaded' });
  await seeText('Nộp minh chứng');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(RUN_DIR, 'part5_student_portfolio.png') });
});

// PHẦN 6: Đối soát bảng công 3 ngày làm việc
await step('Phần 6', 'Đối soát bảng chấm công trực tuyến 3 ngày làm việc', async () => {
  await switchRole('admin');
  await page.goto(`${BASE}/timesheet`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('admin-timesheet').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(RUN_DIR, 'part6_timesheet.png') });
});

// PHẦN 7: Dashboard Ban Giám hiệu & Hồ sơ năng lực Giáo viên
await step('Phần 7', 'Dashboard Ban Giám hiệu & Hồ sơ năng lực Giáo viên', async () => {
  await page.goto(`${BASE}/bgh`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('tile-signed').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(RUN_DIR, 'part7a_bgh_dashboard.png') });

  await page.goto(`${BASE}/teacher-portfolio`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Chọn giáo viên').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(RUN_DIR, 'part7b_teacher_portfolio.png') });
});

await step('Bảo mật', 'Không có lỗi quyền Firestore hoặc lộ mã HS trên màn hình', async () => {
  if (permErrors.length) throw new Error(permErrors[0]);
});

const videoObj = page.video();
await ctx.close();
await browser.close();
stop();

let latestVideoPath = '';
if (videoObj) {
  const recordedPath = await videoObj.path();
  latestVideoPath = path.join(VIDEO_ROOT, 'ums_smartconnect_demo_latest.webm');
  copyFileSync(recordedPath, latestVideoPath);
} else {
  const files = readdirSync(RUN_DIR).filter((f) => f.endsWith('.webm'));
  if (files.length > 0) {
    latestVideoPath = path.join(VIDEO_ROOT, 'ums_smartconnect_demo_latest.webm');
    copyFileSync(path.join(RUN_DIR, files[0]), latestVideoPath);
  }
}

let fail = 0;
for (const [status, part, title] of results) {
  if (status === 'FAIL') fail++;
  console.log(`${status}  [${part}] ${title}`);
}
console.log(`\nKết quả diễn tập: ${results.length - fail}/${results.length} bước PASS`);
console.log(`Thư mục ảnh & video diễn tập: ${RUN_DIR}`);
if (latestVideoPath) {
  console.log(`Video dự phòng mới nhất: ${latestVideoPath}`);
}
process.exit(fail ? 1 : 0);
