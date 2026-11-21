'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { categoriesApi } from '@/lib/api/categories';
import type { AssetQuery } from '@/lib/api/assets';
import { CONDITION_LABEL, OWNERSHIP_LABEL } from '@/lib/asset-labels';
import { ASSET_CONDITIONS, OWNERSHIP_TYPES } from '@/types/api';
import type { AssetCondition, AssetStatus, OwnershipType } from '@/types/api';

export interface AssetFilterState {
  search: string;
  categoryId: string;
  status: '' | AssetStatus;
  condition: '' | AssetCondition;
  ownershipType: '' | OwnershipType;
  includeArchived: boolean;
}

export const emptyAssetFilters: AssetFilterState = {
  search: '',
  categoryId: '',
  status: '',
  condition: '',
  ownershipType: '',
  includeArchived: false,
};

export function toAssetQuery(f: AssetFilterState, debouncedSearch: string): AssetQuery {
  return {
    search: debouncedSearch.trim() || undefined,
    categoryId: f.categoryId || undefined,
    status: f.status || undefined,
    condition: f.condition || undefined,
    ownershipType: f.ownershipType || undefined,
    includeArchived: f.includeArchived || undefined,
  };
}

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
  const categories = useQuery({
    queryKey: ['categories', { isActive: true, pageSize: 100 }],
    queryFn: () => categoriesApi.list({ isActive: true, pageSize: 100 }),
    staleTime: 60_000,
  });
  const set = <K extends keyof AssetFilterState>(key: K, v: AssetFilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <FilterBar right={right}>
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Cari kode, nama, merek, model, nomor seri..."
          className="pl-9"
          aria-label="Cari barang"
        />
      </div>
      <div className="w-full sm:w-44">
        <Select value={value.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-label="Filter kategori">
          <option value="">Semua kategori</option>
          {categories.data?.data.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>
      <div className="w-full sm:w-40">
        <Select value={value.condition} onChange={(e) => set('condition', e.target.value as AssetFilterState['condition'])} aria-label="Filter kondisi">
          <option value="">Semua kondisi</option>
          {ASSET_CONDITIONS.map((c) => (
            <option key={c} value={c}>{CONDITION_LABEL[c]}</option>
          ))}
        </Select>
      </div>
      <div className="w-full sm:w-44">
        <Select value={value.ownershipType} onChange={(e) => set('ownershipType', e.target.value as AssetFilterState['ownershipType'])} aria-label="Filter kepemilikan">
          <option value="">Semua kepemilikan</option>
          {OWNERSHIP_TYPES.map((o) => (
            <option key={o} value={o}>{OWNERSHIP_LABEL[o]}</option>
          ))}
        </Select>
      </div>
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
