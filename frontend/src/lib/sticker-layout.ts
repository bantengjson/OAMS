/**
 * Geometry of the framed sticker: the office artwork (`public/sticker/frame-dpc.png`,
 * 612x408 px, transparent background) with a QR code dropped into the window
 * between its four red corner brackets (x 159..453, y 94..329 px).
 *
 * All positions are fractions of the artwork, so one set of numbers serves the
 * on-screen preview, the printed sheet (mm) and the PNG download (px).
 */
export const FRAME = {
  src: '/sticker/frame-dpc.png',
  width: 612,
  height: 408,
  /** QR square: fractions of the artwork width (x, size) and height (y). */
  qr: { left: 212 / 612, top: 100 / 408, size: 188 / 612 },
  /** Asset code line under the QR: fractions of the artwork height. */
  code: { top: 294 / 408, fontSize: 15 / 408 },
} as const;

export const FRAME_RATIO = FRAME.width / FRAME.height;

export interface FramedGeometry {
  widthMm: number;
  heightMm: number;
  qr: { leftMm: number; topMm: number; sizeMm: number };
  code: { topMm: number; fontMm: number };
}

/** Everything in millimetres for a framed sticker of `widthMm`. */
export function framedStickerGeometry(widthMm: number): FramedGeometry {
  const heightMm = widthMm / FRAME_RATIO;
  return {
    widthMm,
    heightMm,
    qr: { leftMm: FRAME.qr.left * widthMm, topMm: FRAME.qr.top * heightMm, sizeMm: FRAME.qr.size * widthMm },
    code: { topMm: FRAME.code.top * heightMm, fontMm: FRAME.code.fontSize * heightMm },
  };
}

/** Same geometry in pixels, for drawing on a canvas of `widthPx`. */
export function framedStickerPixels(widthPx: number) {
  const heightPx = Math.round(widthPx / FRAME_RATIO);
  return {
    widthPx,
    heightPx,
    qr: {
      left: Math.round(FRAME.qr.left * widthPx),
      top: Math.round(FRAME.qr.top * heightPx),
      size: Math.round(FRAME.qr.size * widthPx),
    },
    code: { top: Math.round(FRAME.code.top * heightPx), fontPx: Math.round(FRAME.code.fontSize * heightPx) },
  };
}
