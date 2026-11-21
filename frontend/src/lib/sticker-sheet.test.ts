import { describe, expect, it } from 'vitest';
import { copiesByAsset, duplicateEntry, removeEntry, syncSheet } from './sticker-sheet';

const ids = (entries: { assetId: string }[]) => entries.map((e) => e.assetId);

describe('sticker sheet', () => {
  it('follows the selection: unticked items leave, new ones join at the end once', () => {
    let sheet = syncSheet([], ['a', 'b']);
    expect(ids(sheet)).toEqual(['a', 'b']);
    sheet = duplicateEntry(sheet, sheet[0].key);
    sheet = syncSheet(sheet, ['a', 'c']);
    expect(ids(sheet)).toEqual(['a', 'a', 'c']);
    expect(syncSheet(sheet, [])).toEqual([]);
  });

  it('puts a copy right after the original, with its own key', () => {
    const base = syncSheet([], ['a', 'b']);
    const sheet = duplicateEntry(base, base[0].key);
    expect(ids(sheet)).toEqual(['a', 'a', 'b']);
    expect(new Set(sheet.map((e) => e.key)).size).toBe(3);
  });

  it('removes one copy, and reports when it was the last one of that item', () => {
    let sheet = syncSheet([], ['a']);
    sheet = duplicateEntry(sheet, sheet[0].key);
    const first = removeEntry(sheet, sheet[1].key);
    expect(ids(first.entries)).toEqual(['a']);
    expect(first.lastOf).toBeNull();
    const second = removeEntry(first.entries, first.entries[0].key);
    expect(second.entries).toEqual([]);
    expect(second.lastOf).toBe('a');
  });

  it('counts copies per item', () => {
    let sheet = syncSheet([], ['a', 'b']);
    sheet = duplicateEntry(sheet, sheet[0].key);
    sheet = duplicateEntry(sheet, sheet[0].key);
    expect(copiesByAsset(sheet)).toEqual({ a: 3, b: 1 });
  });
});
