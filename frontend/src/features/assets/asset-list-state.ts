import { STATUS_LABEL } from '@/lib/asset-labels';
import { STATUS_TONE } from '@/lib/tones';
import type { Tone } from '@/lib/tones';
import { ASSET_CONDITIONS, ASSET_STATUSES, OWNERSHIP_TYPES } from '@/types/api';
import type { AssetStatistics, AssetStatus } from '@/types/api';
import { emptyAssetFilters } from './asset-filters';
import type { AssetFilterState } from './asset-filters';

export const SORT_FIELDS = ['name', 'assetCode', 'updatedAt', 'createdAt'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export type AssetListState = AssetFilterState & { sort: SortField; order: 'asc' | 'desc'; page: number };

export const DEFAULT_LIST_STATE: AssetListState = { ...emptyAssetFilters, sort: 'createdAt', order: 'desc', page: 1 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const oneOf = <T extends string>(list: readonly T[], v: string | null): T | '' =>
  v !== null && (list as readonly string[]).includes(v) ? (v as T) : '';

/** Inventory list state from the URL; anything unknown or malformed falls back to its default. */
export function parseAssetQuery(params: URLSearchParams): AssetListState {
  const page = Number(params.get('page'));
  const sort = oneOf(SORT_FIELDS, params.get('sort'));
  const order = oneOf(['asc', 'desc'] as const, params.get('order'));
  const categoryId = params.get('categoryId') ?? '';
  return {
    search: (params.get('search') ?? '').slice(0, 100),
    categoryId: UUID.test(categoryId) ? categoryId : '',
    status: oneOf(ASSET_STATUSES, params.get('status')),
    condition: oneOf(ASSET_CONDITIONS, params.get('condition')),
    ownershipType: oneOf(OWNERSHIP_TYPES, params.get('ownershipType')),
    includeArchived: params.get('includeArchived') === '1',
    sort: sort || DEFAULT_LIST_STATE.sort,
    order: order || DEFAULT_LIST_STATE.order,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** The URL form of the state; default values are left out so a plain list has a plain URL. */
export function toSearchParams(state: AssetListState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.search.trim()) p.set('search', state.search.trim());
  if (state.categoryId) p.set('categoryId', state.categoryId);
  if (state.status) p.set('status', state.status);
  if (state.condition) p.set('condition', state.condition);
  if (state.ownershipType) p.set('ownershipType', state.ownershipType);
  if (state.includeArchived) p.set('includeArchived', '1');
  if (state.sort !== DEFAULT_LIST_STATE.sort) p.set('sort', state.sort);
  if (state.order !== DEFAULT_LIST_STATE.order) p.set('order', state.order);
  if (state.page !== 1) p.set('page', String(state.page));
  return p;
}

export type ChipKey = AssetStatus | 'ALL';

/**
 * Quick status filters: all live assets, each live status that has assets, then disposed when any.
 * The selected status always stays visible, and every status is offered while archived assets are shown,
 * so no status that the old select allowed becomes unreachable. Counts are live (non-archived) assets.
 */
export function statusChipItems(
  stats: AssetStatistics,
  view: { selected: AssetStatus | ''; includeArchived: boolean } = { selected: '', includeArchived: false },
): { key: ChipKey; label: string; count: number; tone: Tone }[] {
  const items: { key: ChipKey; label: string; count: number; tone: Tone }[] = [
    { key: 'ALL', label: 'Semua', count: stats.active, tone: 'blue' },
  ];
  for (const s of ASSET_STATUSES) {
    if (s === 'DISPOSED') continue;
    const count = stats.byStatus[s] ?? 0;
    if (count > 0 || view.includeArchived || view.selected === s) items.push({ key: s, label: STATUS_LABEL[s], count, tone: STATUS_TONE[s] });
  }
  if (stats.disposed > 0 || view.includeArchived || view.selected === 'DISPOSED') items.push({ key: 'DISPOSED', label: STATUS_LABEL.DISPOSED, count: stats.disposed, tone: STATUS_TONE.DISPOSED });
  return items;
}

/** Ticked rows belong to one listing (its serialised query); a different listing starts empty. */
export function selectionFor(sel: { key: string; ids: string[] }, key: string): string[] {
  return sel.key === key ? sel.ids : [];
}

/** The chip counts cover all live assets; true when other filters narrow the table, so the page can say so. */
export function chipCountsIgnoreFilters(state: AssetListState): boolean {
  return Boolean(state.search.trim() || state.categoryId || state.condition || state.ownershipType || state.includeArchived);
}

/** A page past the end (stale or hand-edited URL) becomes the last page; an empty list keeps the page. */
export function clampPage(page: number, totalPages: number): number {
  return totalPages >= 1 && page > totalPages ? totalPages : page;
}
