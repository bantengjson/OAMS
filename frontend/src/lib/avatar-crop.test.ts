import { describe, expect, it } from 'vitest';
import { clampCrop, cropRect, MAX_ZOOM } from './avatar-crop';

const FRAME = 200;

describe('avatar crop', () => {
  it('starts with the centred square of a wide photo', () => {
    // 400x200 photo: the frame shows the middle 200x200 at zoom 1.
    expect(cropRect({ zoom: 1, x: 0, y: 0 }, 400, 200, FRAME)).toEqual({ sx: 100, sy: 0, size: 200 });
  });

  it('moving the photo right shows more of its left side', () => {
    const c = clampCrop({ zoom: 1, x: 100, y: 0 }, 400, 200, FRAME);
    expect(cropRect(c, 400, 200, FRAME)).toEqual({ sx: 0, sy: 0, size: 200 });
  });

  it('never lets the photo leave a gap in the frame', () => {
    expect(clampCrop({ zoom: 1, x: 999, y: -999 }, 400, 200, FRAME)).toEqual({ zoom: 1, x: 100, y: 0 });
    expect(clampCrop({ zoom: 0.2, x: 0, y: 0 }, 400, 200, FRAME).zoom).toBe(1);
    expect(clampCrop({ zoom: 99, x: 0, y: 0 }, 400, 200, FRAME).zoom).toBe(MAX_ZOOM);
  });

  it('zooming in takes a smaller part of the photo', () => {
    // 1000x1000 photo, zoom 2: half the photo's width, centred.
    expect(cropRect({ zoom: 2, x: 0, y: 0 }, 1000, 1000, FRAME)).toEqual({ sx: 250, sy: 250, size: 500 });
    const moved = clampCrop({ zoom: 2, x: -100, y: 100 }, 1000, 1000, FRAME);
    expect(cropRect(moved, 1000, 1000, FRAME)).toEqual({ sx: 500, sy: 0, size: 500 });
  });
});
