import { describe, expect, it } from 'vitest';
import { CONDITION_TONE, FLOW_TONE, STATUS_TONE, categoryTone, categoryToneMap } from './tones';

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

describe('categoryToneMap', () => {
  const cats = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, createdAt: `2026-01-0${i + 1}T00:00:00Z` }));

  it('gives the first eight categories eight different tones, by creation order', () => {
    const map = categoryToneMap(cats);
    expect(new Set(cats.slice(0, 8).map((c) => map.get(c.id))).size).toBe(8);
    expect(map.get('c8')).toBe(map.get('c0'));
  });

  it('does not depend on the order the list arrives in', () => {
    expect([...categoryToneMap([...cats].reverse())]).toEqual([...categoryToneMap(cats)]);
  });
});
