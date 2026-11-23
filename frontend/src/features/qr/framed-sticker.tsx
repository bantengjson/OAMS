'use client';

import { FRAME, FRAME_CODE_WIDTH, fitCodeFontMm, framedStickerGeometry } from '@/lib/sticker-layout';

/**
 * The office frame with a QR code in its bracket window, sized in millimetres
 * so the screen preview and the printed sheet look the same.
 */
export function FramedSticker({
  widthMm,
  qrSrc,
  assetCode,
  className,
}: {
  widthMm: number;
  /** Data URL or path of the QR image; null shows a placeholder. */
  qrSrc: string | null;
  assetCode: string;
  className?: string;
}) {
  const g = framedStickerGeometry(widthMm);
  return (
    <div
      className={className}
      style={{ position: 'relative', width: `${g.widthMm}mm`, height: `${g.heightMm}mm`, overflow: 'hidden' }}
      aria-label={`Stiker ${assetCode}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static artwork, sized in mm */}
      <img
        src={FRAME.src}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${g.qr.leftMm}mm`,
          top: `${g.qr.topMm}mm`,
          width: `${g.qr.sizeMm}mm`,
          height: `${g.qr.sizeMm}mm`,
          background: '#fff',
        }}
      >
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL generated client-side
          <img src={qrSrc} alt={`QR ${assetCode}`} style={{ width: '100%', height: '100%', display: 'block' }} />
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${g.code.topMm}mm`,
          textAlign: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontWeight: 700,
          fontSize: `${fitCodeFontMm(assetCode, FRAME_CODE_WIDTH * widthMm, g.code.fontMm)}mm`,
          lineHeight: 1,
          color: '#111',
          whiteSpace: 'nowrap',
        }}
      >
        {assetCode}
      </div>
    </div>
  );
}
