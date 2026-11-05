// E2E (05/11): Xếp hạng thi đua theo quy chế TPT — SĐB thang 80, cờ đỏ chờ TPT nhập, TPT nhập cờ đỏ.
// Dùng: cd tools/e2e && node xep_hang_tpt_dev.mjs [thư mục ảnh]
// Chạy trên sodaubai-dev; ghi tạm 1 sổ ngày + 8 tiết đã ký + 1 điểm cờ đỏ, rồi dọn/khôi phục.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const SHOTS = process.argv[2] || null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const PORT = Number(process.env.E2E_PORT || 5178);
const BASE = `http://localhost:${PORT}`;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();
const uidOf = async (u) => (await adb.collection('users').where('username', '==', u).get()).docs[0]?.id;
const TPT = await uidOf('mrhoanglongums');
const MON = '2026-11-04'; // T4, sau mốc tính thi đua 04/11
const W = '2026-11-02';

// Điểm kỳ vọng ngày 04/11 của 6A1: tiết mặc định 10đ (NN2/Native…) + tiết GV ký 9đ
const sch6A1 = (await adb.doc('schedules/6A1').get()).data();
const wed = (sch6A1.slots || []).filter((x) => x.dayOfWeek === 4 && (x.subject || '').trim());
const isDef = (sub) => /^(foreign language 2|native)/i.test(sub.trim());
const EXP = wed.reduce((a, x) => a + (isDef(x.subject) ? 10 : 9), 0);
const EXP_MAX = wed.length * 10;
const restore = [];
async function tempSet(ref, data) {
  const snap = await ref.get();
  restore.push(snap.exists ? () => ref.set(snap.data()) : () => ref.delete());
  await ref.set(data);
}
const tptUser = adb.doc(`users/${TPT}`);
await tempSet(tptUser, { ...(await tptUser.get()).data(), mustChangePassword: false });
await tempSet(adb.doc(`daily_logbooks/6A1_${MON}`), { id: `6A1_${MON}`, classId: '6A1', date: MON, dayOfWeek: 4, weekNumber: 10, totalPeriods: 8, status: 'completed', isCompleted: true, updatedAt: Date.now() });
for (let p = 1; p <= 8; p++) {
  await tempSet(adb.doc(`daily_logbooks/6A1_${MON}/periods/${p}`), {
    id: String(p), dailyId: `6A1_${MON}`, classId: '6A1', dayOfWeek: 4, periodIndex: p, subject: 'X', teacherId: 'e2e', teacherName: 'E2E',
    isSigned: true, scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 0, total: 9 }, updatedAt: Date.now(),
  });
}
// 6A2: 1 tiết đã ký, CHƯA có cờ đỏ → xếp hạng tạm theo SĐB
await tempSet(adb.doc(`daily_logbooks/6A2_${MON}`), { id: `6A2_${MON}`, classId: '6A2', date: MON, dayOfWeek: 4, weekNumber: 10, totalPeriods: 8, status: 'in_progress', isCompleted: false, updatedAt: Date.now() });
await tempSet(adb.doc(`daily_logbooks/6A2_${MON}/periods/1`), { id: '1', dailyId: `6A2_${MON}`, classId: '6A2', dayOfWeek: 4, periodIndex: 1, subject: 'X', teacherId: 'e2e', teacherName: 'E2E', isSigned: true, scores: { learning: 4, discipline: 3, hygiene: 2, customCriterion: 1, total: 10 }, updatedAt: Date.now() });
await tempSet(adb.doc(`red_flag_weekly/${W}_6A1`), { weekStart: W, classId: '6A1', score: 90, maxScore: 100, note: '', updatedBy: TPT, updatedByName: 'TPT E2E', updatedAt: Date.now() });
restore.push(() => adb.doc(`red_flag_weekly/${W}_6A2`).delete());

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

try {
  for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 500, hasTouch: vp.width < 500 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
    await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(TPT));
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.goto(`${BASE}/emulation`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Chọn ngày trong tuần').fill(MON);
    const row = page.getByTestId('tpt-row-6A1');
    await check(`[${vp.name}] 6A1: ngày 04/11 = tổng điểm thực các tiết (không phải 80), SĐB < 80 vì 05/11 chưa ký`, async () => {
      await row.waitFor({ timeout: 40000 });
      await page.waitForTimeout(1500);
      const t = (await row.textContent()).replace(/\s+/g, ' ');
      const sdb = Number((t.match(/6A1\s*([\d.]+)/) || [])[1]);
      if (!(sdb > 0 && sdb < 80) || /chờ TPT nhập/.test(t)) throw new Error(t);
      return `${t} (kỳ vọng ngày 04/11: ${EXP}/${EXP_MAX})`;
    });
    await check(`[${vp.name}] lớp chưa có cờ đỏ: "chờ TPT nhập" + ghi chú xếp hạng tạm`, async () => {
      await page.getByTestId('provisional-note').waitFor({ timeout: 10000 });
      if (!(await page.getByText('chờ TPT nhập').count())) throw new Error('không thấy "chờ TPT nhập"');
    });
    await check(`[${vp.name}] chi tiết theo ngày: T4 04/11 = ${EXP}/${EXP_MAX}`, async () => {
      await row.click();
      await page.getByTestId('tpt-days-6A1').waitFor({ timeout: 5000 });
      const t = await page.getByTestId('tpt-days-6A1').textContent();
      if (!t.includes(`${EXP}/${EXP_MAX}`)) throw new Error(t);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `xep_hang_${vp.name}.png`), fullPage: true });
      return t.replace(/\s+/g, ' ').slice(0, 120);
    });
    await check(`[${vp.name}] không cuộn ngang trang`, async () => {
      const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (o > 1) throw new Error(`${o}px`);
    });
    if (vp.name === 'mobile') {
      await check('TPT nhập cờ đỏ 6A2 qua giao diện → lưu Firestore', async () => {
        await page.getByTestId('red-flag-toggle').click();
        await page.getByLabel('Thang điểm cờ đỏ').fill('100');
        await page.getByLabel('Điểm cờ đỏ 6A2').fill('85');
        await page.getByTestId('red-flag-save').click();
        for (let i = 0; i < 20; i++) {
          const s = await adb.doc(`red_flag_weekly/${W}_6A2`).get();
          if (s.exists) return JSON.stringify({ score: s.data().score, max: s.data().maxScore });
          await new Promise((r) => setTimeout(r, 500));
        }
        throw new Error('chưa thấy bản ghi cờ đỏ 6A2');
      });
    }
    await ctx.close();
  }
} finally {
  for (const r of restore.reverse()) await r().catch((e) => console.error('restore', e.message));
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
