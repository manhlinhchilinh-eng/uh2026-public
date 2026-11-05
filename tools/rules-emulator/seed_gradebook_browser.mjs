// Seed Auth + Firestore EMULATOR (project demo-sodaubai) để thử Sổ điểm (GVCN / PH / HS) + TKB của HS trên trình duyệt.
// Chỉ gọi 127.0.0.1 — không chạm sodaubai. Mật khẩu thử chỉ dùng cho Emulator. HS/điểm là dữ liệu giả.
// Chạy: (trong ums-logbook) firebase emulators:start --only firestore,auth --project demo-sodaubai
//       node ../tools/rules-emulator/seed_gradebook_browser.mjs
//       npx vite --mode emulator   (cần .env.emulator.local: VITE_USE_FIREBASE_EMULATOR=true)
const PROJECT = 'demo-sodaubai';
const AUTH = `http://127.0.0.1:${process.env.EMU_AUTH_PORT || 9099}`;
const FS = `http://127.0.0.1:${process.env.EMU_FS_PORT || 8080}/v1/projects/${PROJECT}/databases/(default)/documents`;
const PASSWORD = 'EmuTest@2026';
const YEAR = '2026-2027';

const val = (v) =>
  v === null ? { nullValue: null }
  : Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
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

const STUDENTS = [
  { id: '9A3_01', mhs: '900001', fullName: 'Học Sinh Thử Một' },
  { id: '9A3_02', mhs: '900002', fullName: 'Học Sinh Thử Hai' },
  { id: '9A3_03', mhs: '900003', fullName: 'Học Sinh Thử Ba' },
];
const USERS = [
  { username: 'gvcn9_test', displayName: 'GVCN 9A3 (thử)', roles: ['gvcn'], assignedClassId: '9A3' },
  { username: 'gvtoan_test', displayName: 'GV Toán (thử)', roles: ['gvbm'] },
  { username: 'bghcn_test', displayName: 'BGH kiêm GVCN 9A3 (thử)', roles: ['admin', 'gvcn', 'gvbm'], assignedClassId: '9A3' },
  { username: 'ph_test', displayName: 'Phụ huynh (thử)', roles: ['parent'], studentDocIds: ['9A3_01'], studentMhs: ['900001'], assignedClassId: '9A3' },
  { username: 'hs_test', displayName: 'Học sinh (thử)', roles: ['student'], studentDocIds: ['9A3_01'], studentMhs: ['900001'], assignedClassId: '9A3' },
  { username: 'hs6_test', displayName: 'HS lớp 6A1 (thử)', roles: ['student'], studentDocIds: ['6A1_01'], studentMhs: ['900099'], assignedClassId: '6A1' },
];

const now = Date.now();
const uids = {};
for (const u of USERS) {
  const email = `${u.username}@ums.edu.vn`;
  const uid = await signUp(email);
  uids[u.username] = uid;
  await setDoc(`users/${uid}`, { uid, email, mustChangePassword: false, createdAt: now, status: 'active', active: true, ...u });
}
for (const s of STUDENTS) await setDoc(`students/${s.id}`, { mhs: s.mhs, fullName: s.fullName, className: '9A3', grade: 9 });
await setDoc('students/6A1_01', { mhs: '900099', fullName: 'Học Sinh Lớp Khác', className: '6A1', grade: 6 });
await setDoc('gradebooks/' + `${YEAR}_HK1_6A1_toan`, { year: YEAR, term: 1, classId: '6A1', subjectKey: 'toan', subjectName: 'Toán', mode: 'score', txMin: 4, status: 'draft', rows: {}, version: 1, updatedBy: 'x' });
await setDoc('classes/9A3', { gvcnName: 'GVCN 9A3 (thử)' });

// TKB 9A3 (tên môn tiếng Anh như TKB thật)
const week = [
  ['Homeroom', 'S.Sci Geo', 'Literature', 'Literature', 'Eng 1', 'Eng 1', 'Eng 1', 'Physical Edu'],
  ['N.Scie Phy', 'N.Scie Phy', 'Maths', 'Maths', 'N.Sci Bio', 'N.Sci Bio', 'Civics', 'S.Sci Geo'],
  ['S.Sci His', 'S.Sci His', 'Maths', 'Maths', 'Eng 1', 'Eng 1', 'Technology Edu', 'N.Sci Chem'],
  ['Physical Edu', 'Computer Sci', 'Music', 'Art', 'N.Sci Chem', 'Literature', 'Literature', 'Eng 2'],
  ['Foreign language 2', 'Foreign language 2', 'Maths', 'Maths', 'Literature', 'Eng 2', 'Eng 2', 'Homeroom'],
];
const slots = week.flatMap((day, d) => day.map((subject, p) => ({ dayOfWeek: d + 2, periodIndex: p + 1, subject, teacherName: subject === 'Maths' ? 'GV Toán (thử)' : 'GV (thử)', teacherUsername: '', room: 'P.9A3' })));
await setDoc('schedules/9A3', { classId: '9A3', academicYear: YEAR, semester: 1, slots, updatedAt: now });

// Phân công + sổ điểm HK1 (số cột theo môn)
const assign = (key, name, mode, txMin, teacher) =>
  setDoc(`grade_assignments/${YEAR}_9A3_${key}`, { id: `${YEAR}_9A3_${key}`, year: YEAR, classId: '9A3', subjectKey: key, subjectName: name, mode, txMin, teacherUids: teacher ? [uids[teacher]] : [], teacherNames: teacher ? ['GV Toán (thử)'] : [], unresolvedNames: [], source: 'tkb' });
await assign('toan', 'Toán', 'score', 4, 'gvtoan_test');
await assign('ngu_van', 'Ngữ văn', 'score', 4);
await assign('cong_nghe', 'Công nghệ', 'score', 2); // txMin cũ = 2 → app phải hiện 3 cột
await assign('gdcd', 'Giáo dục công dân', 'score', 2);
await assign('gdtc', 'Giáo dục thể chất', 'comment', 3);

const row = (tx, gk, ck, comment = '') => ({ tx, gk, ck, comment });
const book = (key, name, mode, txMin, status, rows) =>
  setDoc(`gradebooks/${YEAR}_HK1_9A3_${key}`, { id: `${YEAR}_HK1_9A3_${key}`, year: YEAR, term: 1, classId: '9A3', subjectKey: key, subjectName: name, mode, txMin, status, rows, version: 1, updatedBy: uids.gvtoan_test, updatedByName: 'GV Toán (thử)', updatedAt: now });
await book('toan', 'Toán', 'score', 4, 'published', { '900001': row([10, 10, 10, 10], 10, 9.5, 'Tiến bộ tốt'), '900002': row([8, 7, 6, null], 7, null) });
await book('cong_nghe', 'Công nghệ', 'score', 2, 'draft', { '900001': row([10, 10, 10], 10, 10) });
await book('gdcd', 'Giáo dục công dân', 'score', 2, 'published', { '900001': row([10, 9.5], 8, 9.5), '900003': row([10, 10, 10, 10], 10, 9.5), '900002': row([4, 5], 4, 4.5) });
await book('gdtc', 'Giáo dục thể chất', 'comment', 3, 'published', { '900001': row(['Đ', 'Đ'], 'Đ', 'Đ') });

// Bản công bố cho PH/HS (chỉ môn đã công bố)
const rep = (mhs, subjects) => setDoc(`grade_reports/${YEAR}_HK1_${mhs}`, { mhs, classId: '9A3', year: YEAR, term: 1, lastSubjectKey: 'toan', subjects, updatedAt: now, updatedBy: uids.gvtoan_test });
await rep('900001', {
  toan: { name: 'Toán', mode: 'score', tx: [10, 10, 10, 10], gk: 10, ck: 9.5, result: '9.8', comment: 'Tiến bộ tốt', publishedAt: now },
  gdcd: { name: 'Giáo dục công dân', mode: 'score', tx: [10, 9.5], gk: 8, ck: 9.5, result: '9.1', comment: '', publishedAt: now },
  gdtc: { name: 'Giáo dục thể chất', mode: 'comment', tx: ['Đ', 'Đ'], gk: 'Đ', ck: 'Đ', result: 'Đ', comment: '', publishedAt: now },
});
await rep('900002', { gdcd: { name: 'Giáo dục công dân', mode: 'score', tx: [4, 5], gk: 4, ck: 4.5, result: '4.4', comment: '', publishedAt: now } });

console.log(`Đã tạo ${USERS.length} tài khoản thử + dữ liệu sổ điểm 9A3 trên Emulator (mật khẩu trong file này).`);
