// Chụp màn hình 1 trang trên DEV theo vai trò (chỉ đọc). Dùng khi làm giao diện.
// node shot_dev.mjs <admin|gvcn|parent> <đường dẫn, vd /logbook?date=2026-10-12> <file.png> [rộng]
// Cần dev server đang chạy ở cổng 5174 (hoặc đặt BASE).

import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { chromium } from 'playwright-core';

const [role, route, out, width = '1280'] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:5174';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.resolve(HERE, '../backup/keys/sodaubai-dev.json'), 'utf8'))), projectId: 'sodaubai-dev' });
const adb = admin.firestore();
const uidOf = async (u) => (await adb.collection('users').where('username', '==', u).get()).docs[0]?.id;
const mhs = (await adb.collection('students').doc('6A1_01').get()).data().mhs;
const uid = { admin: await uidOf('mshuyentrangums'), gvcn: await uidOf('msphuonganhums'), parent: `ph_${mhs}` }[role];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__umsDevSignIn === 'function', null, { timeout: 60000 });
await page.evaluate((t) => window.__umsDevSignIn(t), await admin.auth().createCustomToken(uid));
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(Number(process.env.WAIT || 5000));
await page.screenshot({ path: out, fullPage: true });
console.log('saved', out, errors.length ? `console errors: ${errors.join(' | ')}` : 'no console errors');
await browser.close();
process.exit(0);
