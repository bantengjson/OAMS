'use client';

import { ImageUp, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useObjectUrl } from '@/hooks/use-object-url';
import { clampCrop, cropRect, cropScale, MAX_ZOOM, MIN_ZOOM } from '@/lib/avatar-crop';
import type { CropState } from '@/lib/avatar-crop';

/** Frame size on screen: 260 px, smaller on narrow phones. */
const frameSize = () => (typeof window === 'undefined' ? 260 : Math.max(180, Math.min(260, window.innerWidth - 96)));
const OUTPUT = 512;
const START: CropState = { zoom: 1, x: 0, y: 0 };

/** The photo as positioned in a round window of `size` px (used for the frame and the small previews). */
function Placed({
  src,
  natural,
  crop,
  frame,
  size,
}: {
  src: string;
  natural: { w: number; h: number };
  crop: CropState;
  frame: number;
  size: number;
}) {
  const ratio = size / frame;
  const scale = cropScale(crop.zoom, natural.w, natural.h, frame) * ratio;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- object URL preview
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none"
      style={{
        width: natural.w * scale,
        height: natural.h * scale,
        transform: `translate(calc(-50% + ${crop.x * ratio}px), calc(-50% + ${crop.y * ratio}px))`,
      }}
    />
  );
}

/**
 * Lets the user move and zoom a newly picked photo inside a round frame and see how it will look,
 * then hands back the square crop (PNG, 512x512) for upload.
 */
export function AvatarCropDialog({
  file,
  uploading,
  onClose,
  onPickAnother,
  onConfirm,
}: {
  file: File;
  uploading: boolean;
  onClose: () => void;
  /** A different photo picked from inside the dialog (the page behind a modal cannot open the picker). */
  onPickAnother: (file: File) => void;
  onConfirm: (cropped: File) => void;
}) {
  const src = useObjectUrl(file);
  const imgRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [broken, setBroken] = useState(false);
  const [crop, setCrop] = useState<CropState>(START);
  const [frame] = useState(frameSize);

  const update = (next: CropState) => {
    if (natural) setCrop(clampCrop(next, natural.w, natural.h, frame));
  };
  const zoomTo = (zoom: number) => {
    // Keep the same spot in the middle while zooming.
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) / crop.zoom;
    update({ zoom: crop.zoom * k, x: crop.x * k, y: crop.y * k });
  };

  // Mouse wheel / trackpad zoom; React's wheel listener is passive, so attach our own.
  // Re-attached on every render so it always sees the current crop.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTo(crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!natural) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    update({ zoom: crop.zoom, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py });
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 30 : 8;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      update({ zoom: crop.zoom, x: crop.x + moves[e.key][0], y: crop.y + moves[e.key][1] });
    } else if (e.key === '+' || e.key === '=') zoomTo(crop.zoom + 0.2);
    else if (e.key === '-') zoomTo(crop.zoom - 0.2);
  };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const { sx, sy, size } = cropRect(crop, natural.w, natural.h, frame);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob((blob) => {
      if (blob) onConfirm(new File([blob], 'foto-profil.png', { type: 'image/png' }));
    }, 'image/png');
  };

  const ready = Boolean(src && natural && !broken);

  return (
    <Dialog
      open
      onClose={uploading ? () => undefined : onClose}
      title="Atur foto profil"
      description="Geser foto untuk mengatur posisi, perbesar dengan penggeser di bawah."
      footer={
        <>
          <input
            ref={pickRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            data-testid="avatar-input-dialog"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              e.target.value = '';
              if (picked) onPickAnother(picked);
            }}
          />
          <Button variant="ghost" className="mr-auto" onClick={() => pickRef.current?.click()}
            disabled={uploading}
            aria-label="Pilih foto lain"
          >
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Pilih foto lain</span>
          </Button>
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Batal
          </Button>
          <Button onClick={confirm} disabled={!ready || uploading}>
            {uploading ? 'Memasang...' : 'Pasang foto'}
          </Button>
        </>
      }
    >
      {broken ? (
        <Alert variant="error">Foto ini tidak bisa dibuka. Coba pilih foto lain.</Alert>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3">
            <div
              ref={frameRef}
              role="application"
              aria-label="Area potong foto. Geser dengan mouse, jari, atau tombol panah; perbesar dengan + dan -."
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
              className="relative cursor-grab touch-none overflow-hidden rounded-lg bg-[#172033] select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
              style={{ width: frame, height: frame }}
            >
              {src ? (
                // Hidden source image: gives the natural size and is what the canvas reads from.
                // eslint-disable-next-line @next/next/no-img-element -- object URL preview
                <img
                  ref={imgRef}
                  src={src}
                  alt=""
                  className="hidden"
                  onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  onError={() => setBroken(true)}
                />
              ) : null}
              {src && natural ? <Placed src={src} natural={natural} crop={crop} frame={frame} size={frame} /> : null}
              <div
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]"
                aria-hidden="true"
              />
              {!natural ? (
                <span className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Memuat foto...</span>
              ) : null}
            </div>
            <div className="flex w-full items-center gap-2" style={{ maxWidth: frame }}>
              <button
                type="button"
                onClick={() => zoomTo(crop.zoom - 0.2)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Perkecil"
              >
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={crop.zoom}
                onChange={(e) => zoomTo(Number(e.target.value))}
                disabled={!natural}
                aria-label="Perbesar foto"
                className="flex-1 accent-[var(--primary)]"
              />
              <button
                type="button"
                onClick={() => zoomTo(crop.zoom + 0.2)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Perbesar"
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 sm:items-start">
            <p className="text-sm font-medium text-foreground">Pratinjau</p>
            <div className="flex items-end gap-4">
              {[96, 40].map((size) => (
                <div key={size} className="flex flex-col items-center gap-1">
                  <div className="relative overflow-hidden rounded-full bg-muted ring-1 ring-border" style={{ width: size, height: size }}>
                    {src && natural ? <Placed src={src} natural={natural} crop={crop} frame={frame} size={size} /> : null}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{size === 96 ? 'Profil' : 'Menu'}</span>
                </div>
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Move className="h-3.5 w-3.5" aria-hidden="true" />
              Geser foto di dalam bingkai
            </p>
            <Button variant="outline" size="sm" onClick={() => setCrop(START)} disabled={!natural || uploading}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Atur ulang
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
