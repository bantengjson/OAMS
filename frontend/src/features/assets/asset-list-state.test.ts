import { describe, expect, it } from 'vitest';
import type { AssetStatistics } from '@/types/api';
import { DEFAULT_LIST_STATE, parseAssetQuery, selectionFor, statusChipItems, toSearchParams } from './asset-list-state';

const CAT = '0b2f4f43-7a64-4c1e-9b5e-2a1c8f0d9e11';

describe('parseAssetQuery', () => {
  it('falls back to defaults for every invalid value', () => {
    const s = parseAssetQuery(new URLSearchParams('status=FOO&page=-3&categoryId=abc&sort=evil&order=up&condition=x&ownershipType=y'));
    expect(s).toEqual(DEFAULT_LIST_STATE);
    expect(parseAssetQuery(new URLSearchParams('page=2.5')).page).toBe(1);
  });

  it('round-trips a valid state', () => {
    const qs = `status=BORROWED&condition=GOOD&categoryId=${CAT}&ownershipType=OFFICE&includeArchived=1&search=printer&sort=name&order=asc&page=2`;
    const s = parseAssetQuery(new URLSearchParams(qs));
    expect(s).toMatchObject({ status: 'BORROWED', condition: 'GOOD', categoryId: CAT, includeArchived: true, search: 'printer', sort: 'name', order: 'asc', page: 2 });
    expect(parseAssetQuery(toSearchParams(s))).toEqual(s);
  });

  it('omits defaults when serialising', () => {
    expect(toSearchParams(DEFAULT_LIST_STATE).toString()).toBe('');
  });
});

describe('statusChipItems', () => {
  it('lists all, the live statuses that have assets, then disposed', () => {
    const stats = { active: 3, disposed: 2, byStatus: { AVAILABLE: 3, IN_USE: 0 } } as unknown as AssetStatistics;
    expect(statusChipItems(stats).map((c) => c.key)).toEqual(['ALL', 'AVAILABLE', 'DISPOSED']);
    expect(statusChipItems(stats)[0]).toMatchObject({ count: 3, label: 'Semua' });
  });

  it('leaves disposed out when there is none', () => {
    const stats = { active: 1, disposed: 0, byStatus: { STORED: 1 } } as unknown as AssetStatistics;
    expect(statusChipItems(stats).map((c) => c.key)).toEqual(['ALL', 'STORED']);
  });
});

describe('selectionFor', () => {
  it('forgets ticked rows once the listing changes', () => {
    expect(selectionFor({ key: 'a', ids: ['1'] }, 'b')).toEqual([]);
    expect(selectionFor({ key: 'a', ids: ['1', '2'] }, 'a')).toEqual(['1', '2']);
  });
});
