import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRunWindow, topicsForProfile, topicName, announcementPush, officePush, chunk, shouldCutBilling, vnClock } from './logic';

const vn = (iso: string) => Date.parse(iso + '+07:00');
test('khung chạy theo giờ VN', () => {
  assert.equal(inRunWindow(vn('2026-11-05T06:29:00')), false);
  assert.equal(inRunWindow(vn('2026-11-05T06:30:00')), true);
  assert.equal(inRunWindow(vn('2026-11-05T21:30:00')), true);
  assert.equal(inRunWindow(vn('2026-11-05T21:31:00')), false);
  assert.equal(inRunWindow(vn('2026-11-08T09:00:00')), false); // Chủ nhật
  assert.equal(vnClock(vn('2026-11-05T09:20:00')).minutes, 560);
});
test('chủ đề tính từ hồ sơ, Văn phòng không nhận', () => {
  assert.deepEqual(topicsForProfile({ roles: ['gvcn', 'gvbm'] }), ['staff']);
  assert.deepEqual(topicsForProfile({ roles: ['parent'], assignedClassId: '6A1' }), ['parent_all', 'parent_6A1']);
  assert.deepEqual(topicsForProfile({ roles: ['vanphong'] }), []);
  assert.equal(topicName('student:9A3'), 'student_9A3');
});
test('nội dung đẩy không có thân tin', () => {
  const p = announcementPush({ id: 'a1', title: 'Nghỉ học', level: 'urgent' });
  assert.equal(p.title, '🔴 Khẩn: Nghỉ học');
  assert.equal(p.url, '/announcements');
  assert.match(officePush({ id: 'o', title: 'Nộp sổ', requiresDone: true }).title, /^✅ Cần thực hiện/);
});
test('chia lô và ngắt thanh toán', () => {
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);
  assert.equal(shouldCutBilling({ costAmount: 50000, budgetAmount: 50000 }), true);
  assert.equal(shouldCutBilling({ costAmount: 49999, budgetAmount: 50000 }), false);
  assert.equal(shouldCutBilling({}), false);
});
