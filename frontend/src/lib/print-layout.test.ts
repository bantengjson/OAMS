import { describe, expect, it } from 'vitest';
import { sheetLayout, STICKER_SIZES } from './print-layout';

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
