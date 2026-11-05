// Seed Auth + Firestore EMULATOR (project demo-sodaubai) để thử Thông báo / Hành chính trên trình duyệt.
// Chỉ gọi 127.0.0.1 — không chạm sodaubai. Mật khẩu thử chỉ dùng cho Emulator.
// Chạy: firebase emulators:start --only firestore,auth --project demo-sodaubai (trong ums-logbook) rồi node seed_browser.mjs
// Dev server: cd ums-logbook && npx vite --mode emulator (cần .env.emulator.local: VITE_USE_FIREBASE_EMULATOR=true)
const PROJECT = 'demo-sodaubai';
const AUTH = 'http://127.0.0.1:9099';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const PASSWORD = 'EmuTest@2026';

export const TEST_USERS = [
  { username: 'vp_test', displayName: 'Văn phòng (thử)', roles: ['vanphong'] },
  { username: 'bgh_test', displayName: 'BGH (thử)', roles: ['admin'] },
  { username: 'gv6_test', displayName: 'Cô GVCN 6A1 (thử)', roles: ['gvcn', 'gvbm'], assignedClassId: '6A1' },
  { username: 'gv9_test', displayName: 'Thầy GVCN 9A2 (thử)', roles: ['gvcn'], assignedClassId: '9A2' },
  { username: 'gvbm_test', displayName: 'Cô GVBM Tiếng Anh (thử)', roles: ['gvbm'] },
  { username: 'gt_test', displayName: 'Giám thị (thử)', roles: ['giamthi'] },
];

const val = (v) =>
  Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
  : typeof v === 'number' ? { integerValue: String(v) }
  : typeof v === 'boolean' ? { booleanValue: v }
  : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } }
  : { stringValue: String(v) };

async function setDoc(path, data) {
  const r = await fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, val(v)])) }),
  });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
}

async function signUp(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${email}: ${JSON.stringify(j)}`);
  return j.localId;
}

const now = Date.now();
const staff = [];
for (const u of TEST_USERS) {
  const email = `${u.username}@ums.edu.vn`;
  const uid = await signUp(email);
  const profile = { uid, username: u.username, email, displayName: u.displayName, roles: u.roles, mustChangePassword: false, createdAt: now, status: 'active' };
  if (u.assignedClassId) profile.assignedClassId = u.assignedClassId;
  await setDoc(`users/${uid}`, profile);
  staff.push({ uid, displayName: u.displayName, roles: u.roles, ...(u.assignedClassId ? { assignedClassId: u.assignedClassId } : {}) });
}
await setDoc('directory/staff', { staff, updatedAt: now });
console.log(`Đã tạo ${TEST_USERS.length} tài khoản thử trên Emulator (mật khẩu trong seed_browser.mjs).`);
