/**
 * Square crop of a photo inside a square frame. `x`/`y` are how far the photo's centre is
 * moved from the frame's centre, in screen pixels; `zoom` 1 means the photo just covers the frame.
 */
export interface CropState {
  zoom: number;
  x: number;
  y: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Screen pixels per photo pixel at the given zoom. */
export function cropScale(zoom: number, width: number, height: number, frame: number): number {
  return (frame / Math.min(width, height)) * zoom;
}

/** Keeps the zoom in range and the photo covering the whole frame (no empty edges). */
export function clampCrop(state: CropState, width: number, height: number, frame: number): CropState {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom));
  const scale = cropScale(zoom, width, height, frame);
  const maxX = Math.max(0, (width * scale - frame) / 2);
  const maxY = Math.max(0, (height * scale - frame) / 2);
  const clamp = (v: number, max: number) => Math.min(max, Math.max(-max, v)) + 0; // + 0 turns -0 into 0
  return { zoom, x: clamp(state.x, maxX), y: clamp(state.y, maxY) };
}

/** The part of the photo (in photo pixels) that the frame shows. */
export function cropRect(state: CropState, width: number, height: number, frame: number): { sx: number; sy: number; size: number } {
  const scale = cropScale(state.zoom, width, height, frame);
  const size = frame / scale;
  const cx = width / 2 - state.x / scale;
  const cy = height / 2 - state.y / scale;
  return { sx: cx - size / 2, sy: cy - size / 2, size };
}
