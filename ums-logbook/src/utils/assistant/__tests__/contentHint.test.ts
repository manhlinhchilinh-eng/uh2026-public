import { describe, it, expect } from 'vitest';
import { needsContentHint, CONTENT_HINT_MIN } from '../contentHint';

describe('needsContentHint', () => {
  it('có link/tệp nhưng chữ ngắn → nhắc', () => {
    expect(needsContentHint('', true)).toBe(true);
    expect(needsContentHint('   ', true)).toBe(true);
  });
  it('đủ dài → không nhắc', () => {
    expect(needsContentHint('x'.repeat(CONTENT_HINT_MIN), true)).toBe(false);
  });
  it('không link/tệp → không nhắc', () => {
    expect(needsContentHint('', false)).toBe(false);
  });
});
