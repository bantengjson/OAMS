'use client';

import { useQuery } from '@tanstack/react-query';
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

export function PrintSheet({
  items,
  spec,
  images,
  previewOnly = false,
}: {
  items: BulkQrItem[];
  spec: StickerSpec;
  images: Record<string, string>;
  /** Render just the first page (for the on-screen preview). */
  previewOnly?: boolean;
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
          {page.map((item) =>
            spec.kind === 'framed' ? (
              <FramedSticker
                key={item.assetId}
                className="sticker framed"
                widthMm={spec.widthMm}
                qrSrc={images[item.token] ?? null}
                assetCode={item.assetCode}
              />
            ) : (
              <div key={item.assetId} className="sticker" style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}>
                {images[item.token] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL generated client-side
                  <img src={images[item.token]} alt={`QR ${item.assetCode}`} />
                ) : (
                  <span className="text-[2.5mm] text-slate-400">...</span>
                )}
                <span className="code">{item.assetCode}</span>
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}
