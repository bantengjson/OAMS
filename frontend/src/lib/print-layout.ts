import { FRAME_RATIO } from './sticker-layout';

export const STICKER_SIZES = [30, 40] as const;
export type StickerSize = (typeof STICKER_SIZES)[number];

export const A4_MM = { width: 210, height: 297 } as const;
export const PAGE_MARGIN_MM = 10;
export const STICKER_GAP_MM = 4;

/** Plain QR square, or the office frame (3:2) with the QR inside its window. */
export type StickerSpec = { kind: 'plain'; sizeMm: StickerSize } | { kind: 'framed'; widthMm: number };

export interface StickerOption {
  key: 'P30' | 'P40' | 'F70' | 'F90';
  label: string;
  hint: string;
  spec: StickerSpec;
}

export const STICKER_OPTIONS: readonly StickerOption[] = [
  { key: 'P30', label: 'QR polos 30 × 30 mm', hint: 'Barang kecil; hanya QR dan kode', spec: { kind: 'plain', sizeMm: 30 } },
  { key: 'P40', label: 'QR polos 40 × 40 mm', hint: 'Hanya QR dan kode', spec: { kind: 'plain', sizeMm: 40 } },
  { key: 'F70', label: 'Berbingkai 70 × 47 mm', hint: 'Bingkai kantor, QR sekitar 21 mm', spec: { kind: 'framed', widthMm: 70 } },
  { key: 'F90', label: 'Berbingkai 90 × 60 mm', hint: 'Bingkai kantor, QR sekitar 28 mm', spec: { kind: 'framed', widthMm: 90 } },
];

export function stickerDims(spec: StickerSpec): { widthMm: number; heightMm: number } {
  if (spec.kind === 'plain') return { widthMm: spec.sizeMm, heightMm: spec.sizeMm };
  return { widthMm: spec.widthMm, heightMm: spec.widthMm / FRAME_RATIO };
}

export interface SheetLayout {
  sizeMm: StickerSize;
  columns: number;
  rows: number;
  perPage: number;
}

export interface RectSheetLayout {
  widthMm: number;
  heightMm: number;
  columns: number;
  rows: number;
  perPage: number;
}

/** How many `widthMm` x `heightMm` stickers fit on one A4 sheet (portrait). */
export function sheetLayoutFor(widthMm: number, heightMm: number): RectSheetLayout {
  const usableWidth = A4_MM.width - 2 * PAGE_MARGIN_MM;
  const usableHeight = A4_MM.height - 2 * PAGE_MARGIN_MM;
  const columns = Math.floor((usableWidth + STICKER_GAP_MM) / (widthMm + STICKER_GAP_MM));
  const rows = Math.floor((usableHeight + STICKER_GAP_MM) / (heightMm + STICKER_GAP_MM));
  return { widthMm, heightMm, columns, rows, perPage: columns * rows };
}

/** How many square stickers of `sizeMm` fit on one A4 sheet (portrait). */
export function sheetLayout(sizeMm: StickerSize): SheetLayout {
  const { columns, rows, perPage } = sheetLayoutFor(sizeMm, sizeMm);
  return { sizeMm, columns, rows, perPage };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}
