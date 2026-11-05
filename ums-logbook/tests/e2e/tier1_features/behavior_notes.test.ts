/**
 * Tier 1: Feature Coverage - Behavior Notes & Attribution
 * Requirements: ORIGINAL_REQUEST.md (R2), PROJECT.md (F15, F16, F17, F18)
 */

import test from 'node:test';
import assert from 'node:assert';
import { UMSContractEngine } from '../harness/contract_engine.ts';
import { DEFAULT_PASSWORD } from '../harness/test_fixtures.ts';

test('T1-NOTE-01: Teacher can create positive note with immediate visibility', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const note = engine.createBehaviorNote(session.token, {
    studentId: '269398',
    studentName: 'Lý Bảo Duy',
    classId: '6A1',
    type: 'positive',
    category: 'Khen ngợi',
    description: 'Hăng hái phát biểu xây dựng bài, giải bài tập khó chính xác',
  });

  assert.ok(note.id);
  assert.strictEqual(note.type, 'positive');
  assert.strictEqual(note.category, 'Khen ngợi');
  assert.strictEqual(note.studentId, '269398');
  assert.ok(note.description.includes('Hăng hái'));
});

test('T1-NOTE-02: Teacher can create negative note for classroom violation', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const note = engine.createBehaviorNote(session.token, {
    studentId: '269048',
    studentName: 'Đinh Minh Tùng',
    classId: '6A1',
    type: 'negative',
    category: 'Mất trật tự',
    description: 'Nói chuyện riêng nhiều lần trong giờ học',
  });

  assert.strictEqual(note.type, 'negative');
  assert.strictEqual(note.category, 'Mất trật tự');
  assert.strictEqual(note.studentId, '269048');
});

test('T1-NOTE-03: TPT supervisor can create campus-wide notes for any class', () => {
  const engine = new UMSContractEngine();
  const tptSession = engine.login('mrhoanglongums', DEFAULT_PASSWORD);
  engine.changePassword(tptSession.token, DEFAULT_PASSWORD, 'Supervisor2026!');

  const note = engine.createBehaviorNote(tptSession.token, {
    studentId: '269387',
    studentName: 'Tạ Hoài Thu Ngân',
    classId: '6A1',
    type: 'negative',
    category: 'Nề nếp / Đồng phục',
    description: 'Không mặc đúng đồng phục ngày thứ 2, không đeo khăn quàng',
  });

  assert.strictEqual(note.authorRole, 'tpt');
  assert.strictEqual(note.authorName, 'Hoàng Long (TPT)');
});

test('T1-NOTE-04: Notes display strict author attribution with role badge and timestamp', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const mockTime = 1760000000000;
  const note = engine.createBehaviorNote(
    session.token,
    {
      studentId: '269516',
      studentName: 'Dương Khánh Hiếu',
      classId: '6A1',
      type: 'positive',
      category: 'Giúp đỡ bạn',
      description: 'Chủ động kèm bạn học yếu trong giờ tự học',
    },
    mockTime
  );

  assert.strictEqual(note.authorId, session.user.uid);
  assert.strictEqual(note.authorName, session.user.displayName);
  assert.strictEqual(note.authorRole, 'gvcn');
  assert.strictEqual(note.timestamp, mockTime);
});

test('T1-NOTE-05: GVCN can retrieve and filter behavior notes for their class by type', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  engine.createBehaviorNote(session.token, {
    studentId: '269398',
    studentName: 'Lý Bảo Duy',
    classId: '6A1',
    type: 'positive',
    category: 'Khen ngợi',
    description: 'Bài kiểm tra 15 phút đạt điểm 10',
  });

  engine.createBehaviorNote(session.token, {
    studentId: '269048',
    studentName: 'Đinh Minh Tùng',
    classId: '6A1',
    type: 'negative',
    category: 'Quên sách vở',
    description: 'Không mang SGK Ngữ văn',
  });

  const positiveNotes = engine.getBehaviorNotes(session.token, { classId: '6A1', type: 'positive' });
  const negativeNotes = engine.getBehaviorNotes(session.token, { classId: '6A1', type: 'negative' });

  assert.strictEqual(positiveNotes.length, 1);
  assert.strictEqual(positiveNotes[0].studentId, '269398');
  assert.strictEqual(negativeNotes.length, 1);
  assert.strictEqual(negativeNotes[0].studentId, '269048');
});

test('T1-NOTE-06: Successive behavior notes preserve historical sequence', () => {
  const engine = new UMSContractEngine();
  const session = engine.login('msphuonganhums', DEFAULT_PASSWORD);
  engine.changePassword(session.token, DEFAULT_PASSWORD, 'Password2026!');

  const now = Date.now();
  engine.createBehaviorNote(session.token, {
    studentId: '269398',
    studentName: 'Lý Bảo Duy',
    classId: '6A1',
    type: 'positive',
    category: 'Khen ngợi',
    description: 'Phát biểu bài 1',
  }, now);

  engine.createBehaviorNote(session.token, {
    studentId: '269398',
    studentName: 'Lý Bảo Duy',
    classId: '6A1',
    type: 'positive',
    category: 'Khen ngợi',
    description: 'Phát biểu bài 2',
  }, now + 1000);

  const studentNotes = engine.getBehaviorNotes(session.token, { studentId: '269398' });
  assert.strictEqual(studentNotes.length, 2);
  assert.strictEqual(studentNotes[0].description, 'Phát biểu bài 1');
  assert.strictEqual(studentNotes[1].description, 'Phát biểu bài 2');
});
