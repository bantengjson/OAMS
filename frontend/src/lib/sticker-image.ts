import { qrDataUrl } from './qr-image';
import { FRAME, framedStickerPixels } from './sticker-layout';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar bingkai tidak bisa dimuat.'));
    img.src = src;
  });
}

/**
 * Renders the framed sticker (artwork + QR + asset code) to a PNG blob in the
 * browser. `widthPx` 1800 ≈ 90 mm at 500 dpi, plenty for any sticker printer.
 */
export async function framedStickerPng(qrText: string, assetCode: string, widthPx = 1800): Promise<Blob> {
  const g = framedStickerPixels(widthPx);
  const [frame, qr] = await Promise.all([loadImage(FRAME.src), qrDataUrl(qrText, g.qr.size).then(loadImage)]);
  const canvas = document.createElement('canvas');
  canvas.width = g.widthPx;
  canvas.height = g.heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia di browser ini.');
  ctx.drawImage(frame, 0, 0, g.widthPx, g.heightPx);
  ctx.fillStyle = '#fff';
  ctx.fillRect(g.qr.left, g.qr.top, g.qr.size, g.qr.size);
  ctx.drawImage(qr, g.qr.left, g.qr.top, g.qr.size, g.qr.size);
  ctx.fillStyle = '#111';
  ctx.font = `700 ${g.code.fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(assetCode, g.widthPx / 2, g.code.top);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal membuat PNG.'))), 'image/png');
  });
}
