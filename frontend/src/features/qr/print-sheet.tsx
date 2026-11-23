'use client';

import { fitCodeFontMm } from '@/lib/sticker-layout';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { chunk, sheetLayoutFor, stickerDims, type StickerSpec } from '@/lib/print-layout';
import { qrDataUrl } from '@/lib/qr-image';
import type { BulkQrItem } from '@/types/api';
import { FramedSticker } from './framed-sticker';

/** One QR image per label URL, rendered in the browser so printing needs no further API calls. */
export function useQrImages(items: BulkQrItem[]) {
  return useQuery({
    queryKey: ['qr-images', items.map((i) => i.token)],
    queryFn: async () => {
      const entries = await Promise.all(items.map(async (i) => [i.token, await qrDataUrl(i.url, 300)] as const));
      return Object.fromEntries(entries) as Record<string, string>;
    },
    enabled: items.length > 0,
    staleTime: Infinity,
  });
}

/** A sticker on the sheet; its key is unique per copy (several copies may share an asset). */
export type SheetItem = BulkQrItem & { key: string };

export function PrintSheet({
  items,
  spec,
  images,
  previewOnly = false,
  controls,
}: {
  items: SheetItem[];
  spec: StickerSpec;
  images: Record<string, string>;
  /** Render just the first page. */
  previewOnly?: boolean;
  /** On-screen buttons over each sticker (never printed: the print copy passes none). */
  controls?: (item: SheetItem) => ReactNode;
}) {
  const { widthMm, heightMm } = stickerDims(spec);
  const layout = sheetLayoutFor(widthMm, heightMm);
  const pages = chunk(items, layout.perPage);
  const shown = previewOnly ? pages.slice(0, 1) : pages;
  return (
    <div className="print-root flex flex-col gap-6">
      {shown.map((page, index) => (
        <section
          key={index}
          className="sheet"
          style={{
            gridTemplateColumns: `repeat(${layout.columns}, ${widthMm}mm)`,
            gridAutoRows: `${heightMm}mm`,
          }}
          aria-label={`Lembar ${index + 1} dari ${pages.length}`}
        >
          {page.map((item) => {
            const sticker = spec.kind === 'framed' ? (
              <FramedSticker
                key={item.key}
                className="sticker framed"
                widthMm={spec.widthMm}
                qrSrc={images[item.token] ?? null}
                assetCode={item.assetCode}
              />
            ) : (
              <div key={item.key} className="sticker" style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}>
                {images[item.token] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL generated client-side
                  <img src={images[item.token]} alt={`QR ${item.assetCode}`} />
                ) : (
                  <span className="text-[2.5mm] text-slate-400">...</span>
                )}
                <span className="code" style={{ fontSize: `${fitCodeFontMm(item.assetCode, widthMm * 0.92, 2.6)}mm` }}>
                  {item.assetCode}
                </span>
              </div>
            );
            if (!controls) return sticker;
            return (
              <div key={item.key} className="group relative">
                {sticker}
                <div className="absolute right-1 top-1 flex gap-1">
                  {controls(item)}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
