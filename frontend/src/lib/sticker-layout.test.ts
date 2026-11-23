import { describe, expect, it } from 'vitest';
import { FRAME, fitCodeFontMm, framedStickerGeometry } from './sticker-layout';

describe('framedStickerGeometry', () => {
  it('keeps the 3:2 frame ratio and places the QR inside the bracket window', () => {
    const g = framedStickerGeometry(90);
    expect(g.widthMm).toBe(90);
    expect(g.heightMm).toBeCloseTo(60, 5);
    // Bracket window of the artwork: x 159..453, y 94..329 of 612x408 px → in mm at 90 mm width
    const windowLeft = (159 / 612) * 90;
    const windowRight = (453 / 612) * 90;
    const windowTop = (94 / 408) * 60;
    const windowBottom = (329 / 408) * 60;
    expect(g.qr.leftMm).toBeGreaterThan(windowLeft);
    expect(g.qr.leftMm + g.qr.sizeMm).toBeLessThan(windowRight);
    expect(g.qr.topMm).toBeGreaterThan(windowTop);
    expect(g.code.topMm).toBeGreaterThan(g.qr.topMm + g.qr.sizeMm);
    expect(g.code.topMm + g.code.fontMm).toBeLessThan(windowBottom);
    // Centred horizontally
    expect(g.qr.leftMm + g.qr.sizeMm / 2).toBeCloseTo(45, 1);
  });

  it('gives a scannable QR at the recommended sizes', () => {
    expect(framedStickerGeometry(90).qr.sizeMm).toBeGreaterThanOrEqual(25);
    expect(framedStickerGeometry(70).qr.sizeMm).toBeGreaterThanOrEqual(20);
  });

  it('scales linearly with the width', () => {
    const a = framedStickerGeometry(60);
    const b = framedStickerGeometry(120);
    expect(b.qr.sizeMm).toBeCloseTo(a.qr.sizeMm * 2, 6);
    expect(b.heightMm).toBeCloseTo(a.heightMm * 2, 6);
  });

  it('describes the artwork', () => {
    expect(FRAME.src).toBe('/sticker/frame-dpc.png');
    expect(FRAME.width / FRAME.height).toBeCloseTo(1.5, 3);
  });
});

describe('fitCodeFontMm', () => {
  it('shrinks a long office code to fit the sticker width', () => {
    const font = fitCodeFontMm('NG.A/012/DPC/2023-01', 26, 2.6);
    expect(font).toBeLessThan(2.6);
    // monospace glyphs are about 0.6 em wide
    expect(font * 0.6 * 'NG.A/012/DPC/2023-01'.length).toBeLessThanOrEqual(26);
  });

  it('keeps the base size when the code already fits', () => {
    expect(fitCodeFontMm('BG/004/DPC/2023-01', 80, 2.6)).toBe(2.6);
  });
});
