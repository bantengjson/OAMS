import type { AssetStatus } from '@/types/api';

/** The part of a listed item that decides whether it can still carry a sticker. */
export interface StickerCandidate {
  id: string;
  isArchived: boolean;
  status: AssetStatus;
}

/**
 * Why no sticker is printed for this item, or null when one is. It mirrors what the server
 * refuses in qr.service.ts, so the list never offers a print the print page would silently drop.
 */
export function noStickerReason(a: Pick<StickerCandidate, 'isArchived' | 'status'>): string | null {
  if (a.isArchived) return 'Barang diarsipkan, stikernya tidak dicetak.';
  if (a.status === 'DISPOSED') return 'Barang dihapuskan, stikernya tidak dicetak.';
  return null;
}

/** The ids on a page that a sticker can still be printed for. */
export function printableIds(rows: readonly StickerCandidate[]): string[] {
  return rows.filter((r) => noStickerReason(r) === null).map((r) => r.id);
}
