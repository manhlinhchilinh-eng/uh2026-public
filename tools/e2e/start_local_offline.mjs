// Phương án dự phòng chạy local tại hội trường (có mạng dùng sodaubai-dev hoặc mất mạng dùng --offline).
// Dùng:
//   cd tools/e2e && node start_local_offline.mjs            (chạy local kết nối sodaubai-dev, mở sẵn 4 cửa sổ vai trò)
//   cd tools/e2e && node start_local_offline.mjs --offline  (chạy local 100% không cần internet với ?offline_demo=1)

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const KEY = path.resolve(HERE, '../backup/keys/sodaubai-dev.json');
const PORT = 5173;
const BASE = `http://localhost:${PORT}`;
const isOffline = process.argv.includes('--offline');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync);

console.log(`=== UMS SmartConnect — Khởi động bản chạy Local (${isOffline ? 'CHẾ ĐỘ OFFLINE DỰ PHÒNG' : 'KẾT NỐI SODAUBAI-DEV'}) ===`);

const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
  cwd: APP,
  shell: true,
  stdio: 'inherit',
});
const stop = () => {
  try {
    process.platform === 'win32'
      ? spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
      : server.kill();
  } catch {}
};
process.on('exit', stop);
process.on('SIGINT', () => {
  stop();
  process.exit(0);
});

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

if (isOffline) {
  const url = `${BASE}/login?offline_demo=1`;
  console.log(`\n✅ Máy chủ Local Offline đã sẵn sàng tại: ${url}`);
  console.log('Đang mở trình duyệt với Chế độ trình chiếu bật sẵn...');
  const browser = await chromium.launch({ executablePath: CHROME, headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('ums_presentation_mode', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log('Nhấn Ctrl+C trong cửa sổ dòng lệnh này để đóng khi kết thúc trình bày.');
} else {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))),
    projectId: 'sodaubai-dev',
  });
  const adb = admin.firestore();
  const uidOf = async (username) =>
    (await adb.collection('users').where('username', '==', username).get()).docs[0]?.id;
  const mhs = (await adb.collection('students').doc('6A1_01').get()).data().mhs;

  const roles = [
    { label: 'BGH (mshuyentrangums)', uid: await uidOf('mshuyentrangums'), startPath: '/bgh' },
    { label: 'GVCN 6A1 (msphuonganhums)', uid: await uidOf('msphuonganhums'), startPath: '/logbook' },
    { label: 'Phụ huynh 6A1', uid: `ph_${mhs}`, startPath: '/dashboard' },
    { label: 'Học sinh 6A1', uid: `hs_${mhs}`, startPath: '/portfolio' },
  ];

  const browser = await chromium.launch({ executablePath: CHROME, headless: false });
  for (const r of roles) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, {
      timeout: 30000,
    });
    await page.evaluate(() => localStorage.setItem('ums_presentation_mode', '1'));
    const token = await admin.auth().createCustomToken(r.uid);
    await page.evaluate((t) => window.__umsDevSignIn(t), token);
    await page.goto(`${BASE}${r.startPath}`, { waitUntil: 'domcontentloaded' });
    console.log(`✅ Đã mở cửa sổ: ${r.label} -> ${r.startPath} (đã bật Chế độ trình chiếu)`);
  }
  console.log('\n4 cửa sổ vai trò đã sẵn sàng để trình bày (Alt+Tab để chuyển). Nhấn Ctrl+C để đóng.');
}
