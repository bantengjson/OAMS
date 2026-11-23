import { describe, expect, it } from 'vitest';
import { groupLineState, inventoryTab } from './group-items-model';

describe('inventoryTab', () => {
  it('reads the tab from the URL, defaulting to the unit list', () => {
    expect(inventoryTab(new URLSearchParams('tab=kelompok'))).toBe('kelompok');
    expect(inventoryTab(new URLSearchParams(''))).toBe('barang');
    expect(inventoryTab(new URLSearchParams('tab=lain'))).toBe('barang');
  });
});

describe('groupLineState', () => {
  const expected = { good: 10, needsRepair: 1, damaged: 0 };
  it('is pending until counted', () => {
    expect(groupLineState({ expected, counted: null })).toBe('pending');
  });
  it('matches when every count equals the record', () => {
    expect(groupLineState({ expected, counted: { good: 10, needsRepair: 1, damaged: 0 } })).toBe('match');
  });
  it('differs when any count differs', () => {
    expect(groupLineState({ expected, counted: { good: 9, needsRepair: 1, damaged: 1 } })).toBe('diff');
  });
});
