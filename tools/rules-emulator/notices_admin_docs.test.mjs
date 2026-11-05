// Rules: Thông báo (người nhận, kiểm tra tin mới), nhóm người nhận lưu sẵn, Hành chính – Văn bản.
// Chạy: npm run test:rules (Emulator, project demo — KHÔNG chạm sodaubai).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../ums-logbook/firestore.rules', import.meta.url), 'utf8');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ums-logbook',
    firestore: { rules: RULES, host: '127.0.0.1', port: 8091 },
  });
});
after(async () => env?.cleanup());

const USERS = {
  bgh: { roles: ['admin'] },
  vp: { roles: ['vanphong'] },
  gv1: { roles: ['gvcn', 'gvbm'], assignedClassId: '6A1' },
  gv2: { roles: ['gvbm'] },
  ph1: { roles: ['parent'], assignedClassId: '6A1', studentDocIds: ['6A1_01'] },
  hs1: { roles: ['student'], assignedClassId: '6A1', studentDocIds: ['6A1_01'] },
};

const notice = (over = {}) => ({
  title: 'Nộp kế hoạch', body: 'Nội dung', tags: [], recipientUids: ['gv1'], remindBefore: [],
  authorId: 'vp', createdAt: 1000, groupNames: ['Tổ Tiếng Anh'], ...over,
});
const adminDoc = (over = {}) => ({
  title: 'Quy trình xin nghỉ', category: 'quy_trinh', url: 'https://drive.google.com/file/d/x/view', description: '',
  docNumber: '', issuedDate: '', pinned: false, authorId: 'vp', authorName: 'VP', createdAt: 1, updatedAt: 1, ...over,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) await setDoc(doc(db, 'users', uid), { uid, ...u });
    await setDoc(doc(db, 'office_notices/n1'), notice());
    await setDoc(doc(db, 'office_notices/n2'), notice({ recipientUids: ['gv2'], createdAt: 2000 }));
    await setDoc(doc(db, 'announcements/a1'), { title: 't', body: 'b', level: 'normal', audienceKeys: ['staff', 'parent:6A1'], authorId: 'bgh', createdAt: 3000 });
    await setDoc(doc(db, 'directory/staff'), { staff: [] });
    await setDoc(doc(db, 'directory/notice_groups'), { groups: [{ id: 'g1', name: 'Tổ Tiếng Anh', uids: ['gv1'] }], updatedAt: 1, updatedBy: 'vp' });
    await setDoc(doc(db, 'admin_docs/d1'), adminDoc());
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const groupsDoc = (n, by = 'vp') => ({ groups: Array.from({ length: n }, (_, i) => ({ id: `g${i}`, name: `N${i}`, uids: ['gv1'] })), updatedAt: 2, updatedBy: by });

// --- Thông báo nhân sự: chỉ người nhận đọc được ---
test('GV nhận đọc được tin gửi cho mình', () => assertSucceeds(getDoc(doc(as('gv1'), 'office_notices/n1'))));
test('GV không nhận KHÔNG đọc được tin', () => assertFails(getDoc(doc(as('gv2'), 'office_notices/n1'))));
test('PH không đọc được tin nhân sự', () => assertFails(getDoc(doc(as('ph1'), 'office_notices/n1'))));
test('GV dò tin của người khác bằng truy vấn → bị chặn', () =>
  assertFails(getDocs(query(collection(as('gv2'), 'office_notices'), where('recipientUids', 'array-contains', 'gv1')))));
test('Kiểm tra tin mới (recipientUids + createdAt > mốc) được phép', () =>
  assertSucceeds(getDocs(query(collection(as('gv1'), 'office_notices'), where('recipientUids', 'array-contains', 'gv1'), where('createdAt', '>', 500), orderBy('createdAt', 'desc'), limit(10)))));
test('Văn phòng gửi tin có groupNames được phép', () => assertSucceeds(addDoc(collection(as('vp'), 'office_notices'), notice())));
test('GV không tự gửi tin nhân sự', () => assertFails(addDoc(collection(as('gv1'), 'office_notices'), notice({ authorId: 'gv1' }))));

// --- Thông báo PH/HS: kiểm tra tin mới ---
test('Nhân sự kiểm tra thông báo mới (createdAt > mốc)', () =>
  assertSucceeds(getDocs(query(collection(as('gv2'), 'announcements'), where('createdAt', '>', 0), orderBy('createdAt', 'desc'), limit(10)))));
test('PH kiểm tra thông báo mới theo audienceKeys của mình', () =>
  assertSucceeds(getDocs(query(collection(as('ph1'), 'announcements'), where('audienceKeys', 'array-contains-any', ['parent:all', 'parent:6A1']), where('createdAt', '>', 0), orderBy('createdAt', 'desc'), limit(10)))));
test('PH không quét toàn bộ thông báo', () =>
  assertFails(getDocs(query(collection(as('ph1'), 'announcements'), where('createdAt', '>', 0), orderBy('createdAt', 'desc'), limit(10)))));

// --- Nhóm người nhận lưu sẵn ---
test('GV đọc được danh sách nhóm', () => assertSucceeds(getDoc(doc(as('gv2'), 'directory/notice_groups'))));
test('PH không đọc được nhóm', () => assertFails(getDoc(doc(as('ph1'), 'directory/notice_groups'))));
test('Văn phòng lưu nhóm', () => assertSucceeds(setDoc(doc(as('vp'), 'directory/notice_groups'), groupsDoc(3))));
test('BGH lưu nhóm', () => assertSucceeds(setDoc(doc(as('bgh'), 'directory/notice_groups'), groupsDoc(3, 'bgh'))));
test('GV không sửa nhóm', () => assertFails(setDoc(doc(as('gv1'), 'directory/notice_groups'), groupsDoc(1, 'gv1'))));
test('Văn phòng lưu quá 50 nhóm bị chặn', () => assertFails(setDoc(doc(as('vp'), 'directory/notice_groups'), groupsDoc(51))));
test('Văn phòng ghi updatedBy giả bị chặn', () => assertFails(setDoc(doc(as('vp'), 'directory/notice_groups'), groupsDoc(1, 'bgh'))));
test('Văn phòng KHÔNG sửa danh bạ directory/staff', () => assertFails(setDoc(doc(as('vp'), 'directory/staff'), { staff: [], updatedBy: 'vp', groups: [] })));
test('Văn phòng không xóa doc nhóm', () => assertFails(deleteDoc(doc(as('vp'), 'directory/notice_groups'))));

// --- Danh bạ nhân sự: BGH lọc theo vai trò ---
test('BGH truy vấn users theo vai trò nhân sự', () =>
  assertSucceeds(getDocs(query(collection(as('bgh'), 'users'), where('roles', 'array-contains-any', ['admin', 'gvcn', 'gvbm', 'tpt', 'giamthi', 'vanphong']), limit(250)))));

// --- Hành chính – Văn bản – Quy trình ---
test('GV xem tài liệu', () => assertSucceeds(getDocs(query(collection(as('gv2'), 'admin_docs'), orderBy('updatedAt', 'desc'), limit(300)))));
test('Văn phòng xem tài liệu', () => assertSucceeds(getDoc(doc(as('vp'), 'admin_docs/d1'))));
test('PH không xem tài liệu', () => assertFails(getDoc(doc(as('ph1'), 'admin_docs/d1'))));
test('Văn phòng thêm tài liệu', () => assertSucceeds(addDoc(collection(as('vp'), 'admin_docs'), adminDoc())));
test('BGH thêm tài liệu', () => assertSucceeds(addDoc(collection(as('bgh'), 'admin_docs'), adminDoc({ authorId: 'bgh' }))));
test('GV không thêm tài liệu', () => assertFails(addDoc(collection(as('gv1'), 'admin_docs'), adminDoc({ authorId: 'gv1' }))));
test('Link javascript: bị chặn', () => assertFails(addDoc(collection(as('vp'), 'admin_docs'), adminDoc({ url: 'javascript:alert(1)' }))));
test('Link http (không s) bị chặn', () => assertFails(addDoc(collection(as('vp'), 'admin_docs'), adminDoc({ url: 'http://drive.google.com/x' }))));
test('Loại tài liệu lạ bị chặn', () => assertFails(addDoc(collection(as('vp'), 'admin_docs'), adminDoc({ category: 'khac' }))));
test('Mạo danh người đăng bị chặn', () => assertFails(addDoc(collection(as('vp'), 'admin_docs'), adminDoc({ authorId: 'bgh' }))));
test('Văn phòng sửa tài liệu', () => assertSucceeds(updateDoc(doc(as('vp'), 'admin_docs/d1'), { title: 'Mới', updatedAt: 2 })));
test('BGH sửa tài liệu của Văn phòng', () => assertSucceeds(updateDoc(doc(as('bgh'), 'admin_docs/d1'), { pinned: true, updatedAt: 3 })));
test('Sửa đổi người đăng bị chặn', () => assertFails(updateDoc(doc(as('vp'), 'admin_docs/d1'), { authorId: 'bgh', updatedAt: 2 })));
test('GV không sửa tài liệu', () => assertFails(updateDoc(doc(as('gv1'), 'admin_docs/d1'), { title: 'x', updatedAt: 2 })));
test('GV không xóa tài liệu', () => assertFails(deleteDoc(doc(as('gv1'), 'admin_docs/d1'))));
test('Văn phòng xóa tài liệu', () => assertSucceeds(deleteDoc(doc(as('vp'), 'admin_docs/d1'))));

// --- Tệp đính kèm (link Drive) trong tin nhân sự: chỉ người nhận đọc được tin → chỉ họ thấy link ---
const withFiles = (n) => notice({ attachments: Array.from({ length: n }, (_, i) => ({ name: `Tệp ${i}`, url: 'https://drive.google.com/file/d/x/view' })) });
test('Văn phòng gửi tin kèm 5 link tệp', () => assertSucceeds(addDoc(collection(as('vp'), 'office_notices'), withFiles(5))));
test('Quá 8 tệp đính kèm (5 link + 3 tệp) bị chặn', () => assertFails(addDoc(collection(as('vp'), 'office_notices'), withFiles(9))));
test('attachments không phải danh sách bị chặn', () => assertFails(addDoc(collection(as('vp'), 'office_notices'), notice({ attachments: 'https://x.com' }))));
test('Người không nhận KHÔNG đọc được tin có đính kèm', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'office_notices/f1'), withFiles(2)));
  await assertFails(getDoc(doc(as('gv2'), 'office_notices/f1')));
  await assertFails(getDoc(doc(as('ph1'), 'office_notices/f1')));
  await assertSucceeds(getDoc(doc(as('gv1'), 'office_notices/f1')));
});

// --- Tệp tải lên lưu trong Firestore (files + chunks) ---
import { writeBatch, Bytes } from 'firebase/firestore';
const fileMeta = (over = {}) => ({ name: 'kehoach.pdf', size: 3, type: 'application/pdf', chunkCount: 1, authorId: 'vp', createdAt: 1, ...over });
const uploadBatch = (db, noticeId, fileId, meta, chunks) => {
  const b = writeBatch(db);
  b.set(doc(db, 'office_notices', noticeId, 'files', fileId), meta);
  chunks.forEach((c, i) => b.set(doc(db, 'office_notices', noticeId, 'files', fileId, 'chunks', String(i)), { i, data: c }));
  return b.commit();
};
const bytes = (n) => Bytes.fromUint8Array(new Uint8Array(n));
const seedFile = () =>
  env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'office_notices/n1/files/f1'), fileMeta());
    await setDoc(doc(db, 'office_notices/n1/files/f1/chunks/0'), { i: 0, data: bytes(3) });
  });

test('Văn phòng tải tệp lên trước khi tạo tin (tin chưa tồn tại)', () =>
  assertSucceeds(uploadBatch(as('vp'), 'newNotice', 'f9', fileMeta(), [bytes(3)])));
test('GV không tự tải tệp lên', () => assertFails(uploadBatch(as('gv1'), 'newNotice', 'f9', fileMeta({ authorId: 'gv1' }), [bytes(3)])));
test('Tệp > 5 MB bị chặn', () => assertFails(uploadBatch(as('vp'), 'newNotice', 'f9', fileMeta({ size: 5242881 }), [bytes(3)])));
test('Khối > 750 KB bị chặn', () => assertFails(uploadBatch(as('vp'), 'newNotice', 'f9', fileMeta({ chunkCount: 1 }), [bytes(750001)])));
test('Khối vượt chunkCount bị chặn', () => assertFails(uploadBatch(as('vp'), 'newNotice', 'f9', fileMeta({ chunkCount: 1 }), [bytes(3), bytes(3)])));
test('Mạo danh người tải lên bị chặn', () => assertFails(uploadBatch(as('vp'), 'newNotice', 'f9', fileMeta({ authorId: 'bgh' }), [bytes(3)])));
test('Người nhận tải được tệp', async () => {
  await seedFile();
  await assertSucceeds(getDocs(collection(as('gv1'), 'office_notices/n1/files/f1/chunks')));
});
test('Người KHÔNG nhận không tải được tệp', async () => {
  await seedFile();
  await assertFails(getDocs(collection(as('gv2'), 'office_notices/n1/files/f1/chunks')));
  await assertFails(getDoc(doc(as('gv2'), 'office_notices/n1/files/f1')));
  await assertFails(getDocs(collection(as('ph1'), 'office_notices/n1/files/f1/chunks')));
});
test('Tệp dưới tin chưa tạo: GV không đọc được', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'office_notices/ghost/files/f1/chunks/0'), { i: 0, data: bytes(3) }));
  await assertFails(getDocs(collection(as('gv1'), 'office_notices/ghost/files/f1/chunks')));
});
test('Không sửa khối đã tải', async () => {
  await seedFile();
  await assertFails(setDoc(doc(as('vp'), 'office_notices/n1/files/f1/chunks/0'), { i: 0, data: bytes(1) }));
});
test('Người gửi xóa tin kèm tệp (1 batch)', async () => {
  await seedFile();
  const db = as('vp');
  const b = writeBatch(db);
  b.delete(doc(db, 'office_notices/n1/files/f1/chunks/0'));
  b.delete(doc(db, 'office_notices/n1/files/f1'));
  b.delete(doc(db, 'office_notices/n1'));
  await assertSucceeds(b.commit());
});
test('GV không xóa tệp', async () => {
  await seedFile();
  await assertFails(deleteDoc(doc(as('gv1'), 'office_notices/n1/files/f1/chunks/0')));
});

// --- Hành chính – Văn bản: không bắt buộc link (url rỗng) & tải tệp trực tiếp ---
test('Văn phòng thêm tài liệu không có link (url rỗng)', () =>
  assertSucceeds(addDoc(collection(as('vp'), 'admin_docs'), adminDoc({ url: '', attachments: [] }))));
test('Văn phòng tải tệp trực tiếp lên admin_docs', async () => {
  const db = as('vp');
  const b = writeBatch(db);
  b.set(doc(db, 'admin_docs/dNew/files/f1'), fileMeta());
  b.set(doc(db, 'admin_docs/dNew/files/f1/chunks/0'), { i: 0, data: bytes(3) });
  await assertSucceeds(b.commit());
});
test('GV tải được tệp trong admin_docs, PH không đọc được', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admin_docs/d1/files/f1'), fileMeta());
    await setDoc(doc(db, 'admin_docs/d1/files/f1/chunks/0'), { i: 0, data: bytes(3) });
  });
  await assertSucceeds(getDocs(collection(as('gv1'), 'admin_docs/d1/files/f1/chunks')));
  await assertFails(getDocs(collection(as('ph1'), 'admin_docs/d1/files/f1/chunks')));
});

// --- 05/11: tệp admin_docs — chỉ người được đọc văn bản (nhân sự + Văn phòng) mới tải được ---
const seedAdminFile = () =>
  env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admin_docs/d1'), adminDoc({ url: '', attachments: [{ name: 'a.pdf', fileId: 'f1', size: 3, type: 'application/pdf' }] }));
    await setDoc(doc(db, 'admin_docs/d1/files/f1'), fileMeta());
    await setDoc(doc(db, 'admin_docs/d1/files/f1/chunks/0'), { i: 0, data: bytes(3) });
  });
test('HS không tải được tệp admin_docs', async () => {
  await seedAdminFile();
  await assertFails(getDocs(collection(as('hs1'), 'admin_docs/d1/files/f1/chunks')));
  await assertFails(getDoc(doc(as('hs1'), 'admin_docs/d1/files/f1')));
});
test('PH không đọc thông tin tệp admin_docs', async () => {
  await seedAdminFile();
  await assertFails(getDoc(doc(as('ph1'), 'admin_docs/d1/files/f1')));
});
test('Chưa đăng nhập không tải được tệp admin_docs', async () => {
  await seedAdminFile();
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'admin_docs/d1/files/f1/chunks')));
});
test('BGH và Văn phòng tải được tệp admin_docs', async () => {
  await seedAdminFile();
  await assertSucceeds(getDocs(collection(as('bgh'), 'admin_docs/d1/files/f1/chunks')));
  await assertSucceeds(getDocs(collection(as('vp'), 'admin_docs/d1/files/f1/chunks')));
});
test('GV không tải tệp lên admin_docs', async () => {
  const db = as('gv1');
  const b = writeBatch(db);
  b.set(doc(db, 'admin_docs/dX/files/f1'), fileMeta({ authorId: 'gv1' }));
  b.set(doc(db, 'admin_docs/dX/files/f1/chunks/0'), { i: 0, data: bytes(3) });
  await assertFails(b.commit());
});
test('Văn phòng tải khối > 750 KB lên admin_docs bị chặn', async () => {
  const db = as('vp');
  const b = writeBatch(db);
  b.set(doc(db, 'admin_docs/dX/files/f1'), fileMeta());
  b.set(doc(db, 'admin_docs/dX/files/f1/chunks/0'), { i: 0, data: bytes(750001) });
  await assertFails(b.commit());
});
test('Văn phòng ghi khối vào tệp admin_docs của người khác bị chặn', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admin_docs/d1/files/f9'), fileMeta({ authorId: 'bgh' }));
  });
  await assertFails(setDoc(doc(as('vp'), 'admin_docs/d1/files/f9/chunks/0'), { i: 0, data: bytes(3) }));
});
test('GV không sửa/xóa tệp admin_docs', async () => {
  await seedAdminFile();
  await assertFails(deleteDoc(doc(as('gv1'), 'admin_docs/d1/files/f1/chunks/0')));
  await assertFails(deleteDoc(doc(as('gv1'), 'admin_docs/d1/files/f1')));
});

// --- 05/11: "Chuyển tiếp thành thông báo" — tin có tệp trỏ về văn bản gốc (srcDocId) ---
test('Văn phòng tạo thông báo chuyển tiếp có tệp srcDocId; GV nhận đọc tin + tải tệp từ văn bản gốc', async () => {
  await seedAdminFile();
  await assertSucceeds(
    setDoc(doc(as('vp'), 'office_notices/fwd1'), notice({
      recipientUids: ['gv1'],
      attachments: [{ name: 'a.pdf', fileId: 'f1', size: 3, type: 'application/pdf', srcDocId: 'd1' }],
    }))
  );
  await assertSucceeds(getDoc(doc(as('gv1'), 'office_notices/fwd1')));
  await assertSucceeds(getDocs(collection(as('gv1'), 'admin_docs/d1/files/f1/chunks')));
  await assertFails(getDoc(doc(as('ph1'), 'office_notices/fwd1')));
});
