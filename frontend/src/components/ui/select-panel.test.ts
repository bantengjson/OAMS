import { describe, expect, it } from 'vitest';
import { escapeTakenByDropdown, matchOptions, moveActive, noteDropdownEscape, placePanel } from './select-panel';
import type { SelectOption } from './select-panel';

const options: SelectOption[] = [
  { value: 'a', label: 'A · Sekretariat', count: 144 },
  { value: 'b', label: 'B · Ketua, Sekretaris & Bendahara', count: 22 },
  { value: 'i', label: 'I · Dapur', count: 11 },
];

describe('matchOptions', () => {
  it('returns everything for an empty query', () => {
    expect(matchOptions(options, '   ')).toHaveLength(3);
  });

  it('matches part of the label, ignoring case', () => {
    expect(matchOptions(options, 'dapur').map((o) => o.value)).toEqual(['i']);
    expect(matchOptions(options, 'SEKRE').map((o) => o.value)).toEqual(['a', 'b']);
  });

  it('matches the room letter people type on its own', () => {
    expect(matchOptions(options, 'b').map((o) => o.value)).toEqual(['b']);
  });

  it('matches every word, in any order', () => {
    expect(matchOptions(options, 'bendahara ketua').map((o) => o.value)).toEqual(['b']);
  });

  it('returns nothing when nothing matches', () => {
    expect(matchOptions(options, 'gudang')).toEqual([]);
  });
});

describe('moveActive', () => {
  it('starts at the first option when nothing is active', () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
  });

  it('wraps around both ends', () => {
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
  });

  it('stays at -1 when the list is empty', () => {
    expect(moveActive(-1, 1, 0)).toBe(-1);
  });
});

const viewport = { width: 1280, height: 800 };

describe('placePanel', () => {
  it('hangs under the trigger when there is room', () => {
    const at = placePanel({ top: 100, bottom: 136, left: 200, width: 220 }, viewport, 320);
    expect(at.top).toBe(140);
    expect(at.bottom).toBeUndefined();
    expect(at.left).toBe(200);
    expect(at.maxHeight).toBe(320);
  });

  it('flips above the trigger when the bottom of the screen is close', () => {
    const at = placePanel({ top: 700, bottom: 736, left: 200, width: 220 }, viewport, 320);
    expect(at.top).toBeUndefined();
    // measured from the bottom of the viewport, so a short panel still sits on the trigger
    expect(at.bottom).toBe(104);
    expect(at.maxHeight).toBe(320);
  });

  it('shrinks to the room it has rather than running off the screen', () => {
    const at = placePanel({ top: 60, bottom: 96, left: 200, width: 220 }, { width: 1280, height: 300 }, 320);
    expect(at.top).toBe(100);
    expect(at.maxHeight).toBe(192);
  });

  it('keeps a wide panel inside the right edge', () => {
    const at = placePanel({ top: 100, bottom: 136, left: 1100, width: 160 }, viewport, 320, 320);
    expect(at.left).toBe(952);
    expect(at.width).toBe(320);
  });

  it('is at least as wide as the trigger', () => {
    const at = placePanel({ top: 100, bottom: 136, left: 200, width: 260 }, viewport, 320, 180);
    expect(at.width).toBe(260);
  });

  it('never leaves the left edge, even for a panel wider than the screen', () => {
    const at = placePanel({ top: 100, bottom: 136, left: 10, width: 400 }, { width: 360, height: 800 }, 320);
    expect(at.left).toBe(8);
  });
});

describe('escapeTakenByDropdown', () => {
  it('is false when no panel has taken an Escape', () => {
    noteDropdownEscape(1_000);
    expect(escapeTakenByDropdown(1_200)).toBe(false);
  });

  it('is true for the moment right after a panel took one', () => {
    noteDropdownEscape(1_000);
    expect(escapeTakenByDropdown(1_000)).toBe(true);
    expect(escapeTakenByDropdown(1_050)).toBe(true);
  });

  it('lets a second Escape through, so the dialog itself closes', () => {
    noteDropdownEscape(1_000);
    expect(escapeTakenByDropdown(1_100)).toBe(false);
  });
});
