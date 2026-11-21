import { describe, expect, it } from 'vitest';
import { donutSegments } from './charts';

describe('donutSegments', () => {
  it('turns values into conic-gradient stops', () => {
    expect(donutSegments([{ value: 90, color: 'a' }, { value: 10, color: 'b' }])).toBe('a 0% 90%, b 90% 100%');
  });

  it('is empty when there is nothing to draw, never NaN', () => {
    expect(donutSegments([{ value: 0, color: 'a' }, { value: 0, color: 'b' }])).toBe('');
    expect(donutSegments([])).toBe('');
  });

  it('skips zero slices and rounds to two decimals', () => {
    const out = donutSegments([{ value: 1, color: 'a' }, { value: 0, color: 'x' }, { value: 2, color: 'b' }]);
    expect(out).toBe('a 0% 33.33%, b 33.33% 100%');
    expect(out).not.toContain('NaN');
  });
});
