'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { FilterBar } from '@/components/ui/filter-bar';
import { categoryOptions } from './category-options';
import { Input } from '@/components/ui/input';
import { FilterSelect } from '@/components/ui/filter-select';
import type { FilterOption } from '@/components/ui/filter-select';
import { ALL_CATEGORIES_QUERY } from '@/hooks/use-category-tone';
import type { AssetQuery } from '@/lib/api/assets';
import { CONDITION_LABEL, OWNERSHIP_LABEL } from '@/lib/asset-labels';
import { ASSET_CONDITIONS, OWNERSHIP_TYPES } from '@/types/api';
import { roomsApi } from '@/lib/api/rooms';
import type { AssetCondition, AssetStatus, Golongan, OwnershipType } from '@/types/api';

export interface AssetFilterState {
  search: string;
  categoryId: string;
  golongan: '' | Golongan;
  /** Room. */
  locationId: string;
  status: '' | AssetStatus;
  condition: '' | AssetCondition;
  ownershipType: '' | OwnershipType;
  includeArchived: boolean;
}

export const emptyAssetFilters: AssetFilterState = {
  search: '',
  categoryId: '',
  golongan: '',
  locationId: '',
  status: '',
  condition: '',
  ownershipType: '',
  includeArchived: false,
};

export function toAssetQuery(f: AssetFilterState, debouncedSearch: string): AssetQuery {
  return {
    search: debouncedSearch.trim() || undefined,
    categoryId: f.categoryId || undefined,
    golongan: f.golongan || undefined,
    locationId: f.locationId || undefined,
    status: f.status || undefined,
    condition: f.condition || undefined,
    ownershipType: f.ownershipType || undefined,
    includeArchived: f.includeArchived || undefined,
  };
}

const GOLONGAN_OPTIONS: FilterOption[] = [
  { value: 'BG', label: 'BG · Bergerak (kendaraan)' },
  { value: 'NG', label: 'NG · Tidak bergerak' },
];
const CONDITION_OPTIONS: FilterOption[] = ASSET_CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }));
const OWNERSHIP_OPTIONS: FilterOption[] = OWNERSHIP_TYPES.map((o) => ({ value: o, label: OWNERSHIP_LABEL[o] }));

/** Search and filters of the inventory list; status is chosen with the status chips above it. */
export function AssetFilters({
  value,
  onChange,
  right,
}: {
  value: AssetFilterState;
  onChange: (next: AssetFilterState) => void;
  right?: ReactNode;
}) {
  const categories = useQuery(ALL_CATEGORIES_QUERY);
  const rooms = useQuery({ queryKey: ['rooms', 'all'], queryFn: () => roomsApi.list(), staleTime: 60_000 });
  // The panel searches these, so the whole list can be offered without a long scroll.
  const typeOptions: FilterOption[] = (categories.data?.data ?? [])
    .filter((c) => !c.isGroup)
    .map((c) => ({ value: c.id, label: c.label, group: c.golongan === 'BG' ? 'BG · Bergerak' : 'NG · Tidak bergerak' }));
  const typeChoices = categoryOptions(
    (categories.data?.data ?? []).map((c) => ({ id: c.id, name: c.label, isActive: c.isActive })),
    value.categoryId,
  );
  const unknownType = typeChoices.find((o) => o.value === value.categoryId && !typeOptions.some((t) => t.value === o.value));
  const roomOptions: FilterOption[] = (rooms.data ?? []).map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));
  const set = <K extends keyof AssetFilterState>(key: K, v: AssetFilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <FilterBar right={right}>
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Cari kode, nama, spesifikasi, nomor seri..."
          className="pl-9"
          aria-label="Cari barang"
        />
      </div>
      <FilterSelect
        className="w-full sm:w-44"
        label="Golongan"
        value={value.golongan}
        onChange={(v) => set('golongan', v as AssetFilterState['golongan'])}
        options={GOLONGAN_OPTIONS}
      />
      <FilterSelect
        className="w-full sm:w-52"
        label="Ruangan"
        value={value.locationId}
        onChange={(v) => set('locationId', v)}
        options={roomOptions}
        widthClassName="w-72"
      />
      <FilterSelect
        className="w-full sm:w-48"
        label="Jenis"
        value={value.categoryId}
        onChange={(v) => set('categoryId', v)}
        options={unknownType ? [...typeOptions, unknownType] : typeOptions}
        widthClassName="w-80"
      />
      <FilterSelect
        className="w-full sm:w-44"
        label="Kondisi"
        value={value.condition}
        onChange={(v) => set('condition', v as AssetFilterState['condition'])}
        options={CONDITION_OPTIONS}
      />
      <FilterSelect
        className="w-full sm:w-48"
        label="Kepemilikan"
        value={value.ownershipType}
        onChange={(v) => set('ownershipType', v as AssetFilterState['ownershipType'])}
        options={OWNERSHIP_OPTIONS}
      />
      <label className="flex items-center gap-2 text-[13px] text-body">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input accent-primary"
          checked={value.includeArchived}
          onChange={(e) => set('includeArchived', e.target.checked)}
        />
        Tampilkan arsip &amp; dilepas
      </label>
    </FilterBar>
  );
}
