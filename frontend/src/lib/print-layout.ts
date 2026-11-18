export const STICKER_SIZES = [30, 40] as const;
export type StickerSize = (typeof STICKER_SIZES)[number];

export const A4_MM = { width: 210, height: 297 } as const;
export const PAGE_MARGIN_MM = 10;
export const STICKER_GAP_MM = 4;

export interface SheetLayout {
  sizeMm: StickerSize;
  columns: number;
  rows: number;
  perPage: number;
}

/** How many square stickers of `sizeMm` fit on one A4 sheet (portrait). */
export function sheetLayout(sizeMm: StickerSize): SheetLayout {
  const usableWidth = A4_MM.width - 2 * PAGE_MARGIN_MM;
  const usableHeight = A4_MM.height - 2 * PAGE_MARGIN_MM;
  const columns = Math.floor((usableWidth + STICKER_GAP_MM) / (sizeMm + STICKER_GAP_MM));
  const rows = Math.floor((usableHeight + STICKER_GAP_MM) / (sizeMm + STICKER_GAP_MM));
  return { sizeMm, columns, rows, perPage: columns * rows };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}
