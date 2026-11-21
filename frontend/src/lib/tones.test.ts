import { describe, expect, it } from 'vitest';
import { CONDITION_TONE, FLOW_TONE, STATUS_TONE, categoryTone } from './tones';

describe('tones', () => {
  it('maps statuses, conditions and flows to the agreed colours', () => {
    expect(STATUS_TONE.BORROWED).toBe('violet');
    expect(STATUS_TONE.UNDER_MAINTENANCE).toBe('orange');
    expect(STATUS_TONE.DISPOSED).toBe('slate');
    expect(STATUS_TONE.AVAILABLE).toBe('green');
    expect(CONDITION_TONE.MINOR_DAMAGE).toBe('amber');
    expect(CONDITION_TONE.UNUSABLE).toBe('red');
    expect(FLOW_TONE.overdue).toBe('red');
    expect(FLOW_TONE.opname).toBe('teal');
  });

  it('gives a category the same tone whatever the call order', () => {
    const ids = Array.from({ length: 50 }, () => crypto.randomUUID());
    const first = ids.map(categoryTone);
    const again = [...ids].reverse().map(categoryTone).reverse();
    expect(again).toEqual(first);
    expect(new Set(first).size).toBeGreaterThanOrEqual(6);
  });
});
