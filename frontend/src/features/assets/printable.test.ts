import { describe, expect, it } from 'vitest';
import { noStickerReason, printableIds } from './printable';
import type { StickerCandidate } from './printable';

const live: StickerCandidate = { id: '1', isArchived: false, status: 'IN_USE' };
const disposed: StickerCandidate = { id: '2', isArchived: false, status: 'DISPOSED' };
const archived: StickerCandidate = { id: '3', isArchived: true, status: 'IN_USE' };
const both: StickerCandidate = { id: '4', isArchived: true, status: 'DISPOSED' };

describe('noStickerReason', () => {
  it('is null for an item still in use', () => {
    expect(noStickerReason(live)).toBeNull();
  });

  it('names disposal, in the word the status badge uses', () => {
    expect(noStickerReason(disposed)).toBe('Barang dihapuskan, stikernya tidak dicetak.');
  });

  it('names the archive', () => {
    expect(noStickerReason(archived)).toBe('Barang diarsipkan, stikernya tidak dicetak.');
  });

  it('leads with the archive when an item is both', () => {
    expect(noStickerReason(both)).toBe('Barang diarsipkan, stikernya tidak dicetak.');
  });

  it('counts a borrowed or broken item as printable; only the end of its life stops a sticker', () => {
    expect(noStickerReason({ isArchived: false, status: 'BORROWED' })).toBeNull();
    expect(noStickerReason({ isArchived: false, status: 'UNDER_MAINTENANCE' })).toBeNull();
  });
});

describe('printableIds', () => {
  it('keeps only the rows a sticker can be printed for', () => {
    expect(printableIds([live, disposed, archived, both])).toEqual(['1']);
  });

  it('is empty for a page of nothing but disposed items', () => {
    expect(printableIds([disposed, both])).toEqual([]);
  });

  it('is empty for an empty page', () => {
    expect(printableIds([])).toEqual([]);
  });
});
