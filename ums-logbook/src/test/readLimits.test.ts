import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BEHAVIOR_NOTES_LIMIT, behaviorNotesLimit } from '../services/behaviorService';

// Bài học chi phí 12/10: mọi truy vấn danh sách lớn phải có limit + index tương ứng.
describe('Giới hạn đọc behavior_notes', () => {
  it('1 lớp ≤ 500, toàn trường ≤ 300 (không bao giờ không giới hạn)', () => {
    expect(behaviorNotesLimit('6A1')).toBe(BEHAVIOR_NOTES_LIMIT.perClass);
    expect(behaviorNotesLimit('all')).toBe(BEHAVIOR_NOTES_LIMIT.allClasses);
    expect(behaviorNotesLimit(undefined)).toBe(BEHAVIOR_NOTES_LIMIT.allClasses);
    expect(BEHAVIOR_NOTES_LIMIT.perClass).toBeLessThanOrEqual(500);
    expect(BEHAVIOR_NOTES_LIMIT.allClasses).toBeLessThanOrEqual(300);
  });
});

describe('Index cho các truy vấn có limit', () => {
  const idx = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes as Array<{ collectionGroup: string; fields: Array<{ fieldPath: string; order?: string; arrayConfig?: string }> }>;
  const has = (col: string, fields: string[]) =>
    idx.some((i) => i.collectionGroup === col && i.fields.map((f) => `${f.fieldPath}:${f.order || f.arrayConfig}`).join(',') === fields.join(','));
  it('office_notices: recipientUids CONTAINS + createdAt DESC', () => {
    expect(has('office_notices', ['recipientUids:CONTAINS', 'createdAt:DESCENDING'])).toBe(true);
  });
  it('behavior_notes: classId ASC + createdAt DESC', () => {
    expect(has('behavior_notes', ['classId:ASCENDING', 'createdAt:DESCENDING'])).toBe(true);
  });
});
