import { describe, expect, it } from 'vitest';
import { matchOptions, moveActive } from './filter-select';
import type { FilterOption } from './filter-select';

const options: FilterOption[] = [
  { value: 'a', label: 'A · Sekretariat', count: 144 },
  { value: 'b', label: 'B · Ketua, Sekretaris & Bendahara', count: 22 },
  { value: 'i', label: 'I · Dapur', count: 11 },
];

describe('matchOptions', () => {
  it('returns everything for an empty query', () => {
    expect(matchOptions(options, '   ')).toHaveLength(3);
  });

  it('matches part of the label, ignoring case', () => {
    expect(matchOptions(options, 'dapur').map((o) => o.value)).toEqual(['i']);
    expect(matchOptions(options, 'SEKRE').map((o) => o.value)).toEqual(['a', 'b']);
  });

  it('matches the room letter people type on its own', () => {
    expect(matchOptions(options, 'b').map((o) => o.value)).toEqual(['b']);
  });

  it('matches every word, in any order', () => {
    expect(matchOptions(options, 'bendahara ketua').map((o) => o.value)).toEqual(['b']);
  });

  it('returns nothing when nothing matches', () => {
    expect(matchOptions(options, 'gudang')).toEqual([]);
  });
});

describe('moveActive', () => {
  it('starts at the first option when nothing is active', () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
  });

  it('wraps around both ends', () => {
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
  });

  it('stays at -1 when the list is empty', () => {
    expect(moveActive(-1, 1, 0)).toBe(-1);
  });
});
