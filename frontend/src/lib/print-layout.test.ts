import { describe, expect, it } from 'vitest';
import { sheetLayout, sheetLayoutFor, STICKER_OPTIONS, STICKER_SIZES, stickerDims } from './print-layout';

describe('sheetLayout', () => {
  it('fits 5x8 stickers of 30 mm on A4 with 10 mm margins and 4 mm gaps', () => {
    expect(sheetLayout(30)).toEqual({ sizeMm: 30, columns: 5, rows: 8, perPage: 40 });
  });

  it('fits 4x6 stickers of 40 mm', () => {
    expect(sheetLayout(40)).toEqual({ sizeMm: 40, columns: 4, rows: 6, perPage: 24 });
  });

  it('exposes the supported sizes', () => {
    expect(STICKER_SIZES).toEqual([30, 40]);
  });
});

describe('sheetLayoutFor (rectangular stickers)', () => {
  it('fits 2x4 framed stickers of 90x60 mm', () => {
    expect(sheetLayoutFor(90, 60)).toEqual({ widthMm: 90, heightMm: 60, columns: 2, rows: 4, perPage: 8 });
  });

  it('fits 2x5 framed stickers of 70x46.67 mm', () => {
    expect(sheetLayoutFor(70, 70 / 1.5)).toMatchObject({ columns: 2, rows: 5, perPage: 10 });
  });

  it('matches the square helper for plain stickers', () => {
    expect(sheetLayoutFor(40, 40)).toMatchObject({ columns: 4, rows: 6, perPage: 24 });
  });

  it('lists plain and framed options with their dimensions', () => {
    expect(STICKER_OPTIONS.map((o) => o.key)).toEqual(['P30', 'P40', 'F70', 'F90']);
    expect(stickerDims(STICKER_OPTIONS[3].spec)).toEqual({ widthMm: 90, heightMm: 60 });
    expect(stickerDims(STICKER_OPTIONS[0].spec)).toEqual({ widthMm: 30, heightMm: 30 });
  });
});
