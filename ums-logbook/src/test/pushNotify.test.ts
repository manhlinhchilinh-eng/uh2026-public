import { describe, expect, it } from 'vitest';
import { mergeTokens } from '../utils/pushNotify';

describe('pushNotify', () => {
  it('giữ tối đa 3 máy, máy mới đứng cuối, không trùng', () => {
    expect(mergeTokens(undefined, 'a')).toEqual(['a']);
    expect(mergeTokens(['a', 'b', 'c'], 'd')).toEqual(['b', 'c', 'd']);
    expect(mergeTokens(['a', 'b'], 'a')).toEqual(['b', 'a']);
  });
});
