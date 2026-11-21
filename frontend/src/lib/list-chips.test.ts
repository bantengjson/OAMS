import { describe, expect, it } from 'vitest';
import { chipItems } from './list-chips';

describe('chipItems', () => {
  it('attaches the loaded counts and leaves unknown ones undefined', () => {
    const items = chipItems(
      [
        { key: 'ALL', label: 'Semua', tone: 'blue' },
        { key: 'PENDING', label: 'Menunggu', tone: 'amber' },
      ],
      { ALL: 7 },
    );
    expect(items).toEqual([
      { key: 'ALL', label: 'Semua', tone: 'blue', count: 7 },
      { key: 'PENDING', label: 'Menunggu', tone: 'amber', count: undefined },
    ]);
  });
});
