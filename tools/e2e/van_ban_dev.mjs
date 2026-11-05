// E2E + ảnh chụp (05/11): trang "Hành chính – Văn bản" — danh sách gọn, mô tả cắt dòng, xem chi tiết, menu "…" cho Sửa/Xóa.
// Dùng: cd tools/e2e && node van_ban_dev.mjs <thư mục ảnh> [tiền tố ảnh, vd. truoc|sau] [--check]
// Chạy trên sodaubai-dev; thêm tạm 6 tài liệu thử (giống dữ liệu prod) rồi xóa sau khi chạy. Không đổi gì khác.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const SHOTS = process.argv[2] || null;
const PREFIX = process.argv[3] || 'van_ban';
const CHECK = process.argv.includes('--check');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../ums-logbook');
const PORT = Number(process.env.E2E_PORT || 5178);
const BASE = `http://localhost:${PORT}`;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
if (admin.app().options.projectId !== 'sodaubai-dev') throw new Error('Chỉ chạy trên sodaubai-dev');
const adb = admin.firestore();
const ADMIN = (await adb.collection('users').where('username', '==', 'mshuyentrangums').get()).docs[0]?.id;
const GV = (await adb.collection('users').where('username', '==', 'msphuonganhums').get()).docs[0]?.id;

const now = Date.now();
const longList = Array.from({ length: 34 }, (_, i) => `${i + 1}. Tiết mục ${i + 1} — lớp ${6 + (i % 4)}A${(i % 5) + 1}`).join('\n');
const SAMPLE = [
  { title: 'CÙNG UMS BÙNG NỔ VỚI CHUNG KẾT UMS GOT TALENT MÙA 5', category: 'van_ban', url: 'https://example.org/got-talent', description: `Chương trình chung kết diễn ra tại hội trường lớn.\nDanh sách tiết mục:\n${longList}`, docNumber: '', issuedDate: '' },
  { title: 'UMS_Thời khóa biểu', category: 'huong_dan', url: 'https://docs.google.com/spreadsheets/d/e2e', description: 'TKB học kỳ I áp dụng từ 03/11.', docNumber: '', issuedDate: '' },
  { title: 'HƯỚNG DẪN THỰC HIỆN NHIỆM VỤ GIÁO DỤC TRUNG HỌC NĂM HỌC 2026-2027', category: 'van_ban', url: 'https://drive.google.com/file/d/e2e', description: 'Công văn của Sở GD&ĐT về nhiệm vụ năm học. Các trường triển khai đầy đủ nội dung, báo cáo kết quả trước ngày 30/11.', docNumber: '6011/SGD ĐT-GDTrh', issuedDate: '2026-10-23' },
  { title: 'Quy trình xin nghỉ & dạy thay', category: 'quy_trinh', url: 'https://docs.google.com/document/d/e2e', description: 'Các bước nộp đơn trên UMS+, BGH duyệt, phân công dạy thay.', docNumber: '', issuedDate: '' },
  { title: 'Mẫu biên bản họp tổ chuyên môn', category: 'bieu_mau', url: 'https://docs.google.com/document/d/e2e2', description: '', docNumber: '', issuedDate: '' },
  { title: 'Quyết định thành lập Ban thi đua năm học 2026-2027', category: 'van_ban', url: 'https://drive.google.com/file/d/e2e3', description: 'Danh sách thành viên và nhiệm vụ.', docNumber: '125/QĐ-THCSNN', issuedDate: '2026-09-05', pinned: true },
];
const ids = [];
for (const [i, d] of SAMPLE.entries()) {
  const id = `e2e_vb_${i}`;
  ids.push(id);
  await adb.doc(`admin_docs/${id}`).set({ pinned: false, ...d, authorId: ADMIN, authorName: 'Văn phòng', createdAt: now - i * 3_600_000, updatedAt: now - i * 3_600_000 * (i < 2 ? 1 : 30) });
}

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
async function open(uid, vp) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  await ctx.addInitScript(() => { try { localStorage.setItem('ums_language', 'en'); localStorage.setItem('ums_language_mode', 'dual'); } catch {} });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss());
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 30000 });
  await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.goto(`${BASE}/hanh-chinh`, { waitUntil: 'domcontentloaded' });
  await page.getByText('UMS_Thời khóa biểu').first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}

try {
  for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
    const { ctx, page } = await open(ADMIN, { width: vp.width, height: vp.height });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${PREFIX}_${vp.name}.png`), fullPage: true });
    if (CHECK) {
      await check(`[${vp.name}] mô tả dài bị cắt, mở chi tiết thấy đủ`, async () => {
        const row = page.getByTestId('admin-doc-e2e_vb_0');
        const h = (await row.boundingBox()).height;
        if (h > 220) throw new Error(`thẻ cao ${Math.round(h)}px`);
        const clamped = await row.locator('p').first().evaluate((el) => el.scrollHeight > el.clientHeight + 2);
        if (!clamped) throw new Error('mô tả không bị cắt');
        await row.getByRole('button', { name: /Xem chi tiết|View details/ }).click();
        await page.getByRole('dialog').getByText(/34\. Tiết mục 34/).waitFor({ timeout: 10000 });
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${PREFIX}_${vp.name}_chi_tiet.png`) });
        await page.keyboard.press('Escape');
        return `cao ${Math.round(h)}px`;
      });
      await check(`[${vp.name}] Sửa/Xóa trong menu "…" (BGH)`, async () => {
        const row = page.getByTestId('admin-doc-e2e_vb_1');
        if (await row.getByRole('button', { name: /^Xóa/ }).isVisible().catch(() => false)) throw new Error('nút Xóa vẫn hiện sẵn');
        await row.getByRole('button', { name: /Thao tác|Actions/ }).click();
        await page.getByRole('menuitem', { name: /Sửa/ }).waitFor({ timeout: 5000 });
        await page.getByRole('menuitem', { name: /Xóa/ }).waitFor();
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${PREFIX}_${vp.name}_menu.png`) });
        await page.keyboard.press('Escape');
      });
      await check(`[${vp.name}] không cuộn ngang`, async () => {
        const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (o > 1) throw new Error(`${o}px`);
      });
      await check(`[${vp.name}] lọc theo loại + tìm kiếm`, async () => {
        await page.getByRole('tab', { name: /Procedures|Quy trình/ }).first().click();
        const n = await page.locator('[data-testid^="admin-doc-e2e_vb_"]').count();
        if (n !== 1) throw new Error(`${n} mục sau khi lọc`);
        await page.getByRole('tab', { name: /^All|Tất cả/ }).first().click();
        await page.getByLabel('Tìm tài liệu').fill('6011');
        const m = await page.locator('[data-testid^="admin-doc-e2e_vb_"]').count();
        if (m !== 1) throw new Error(`${m} mục khi tìm "6011"`);
      });
    }
    await ctx.close();
  }
  if (CHECK) {
    const { ctx, page } = await open(GV, { width: 1280, height: 900 });
    await check('GV (không quản lý): không có menu Sửa/Xóa', async () => {
      if (await page.getByRole('button', { name: /Thao tác|Actions/ }).count()) throw new Error('GV thấy menu thao tác');
    });
    await ctx.close();
  }
} finally {
  for (const id of ids) await adb.doc(`admin_docs/${id}`).delete().catch(() => {});
  await browser.close();
  stop();
}
for (const [s, n] of results) console.log(`${s}  ${n}`);
process.exit(results.some(([s]) => s === 'FAIL') ? 1 : 0);
