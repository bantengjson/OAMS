'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { categoriesApi } from '@/lib/api/categories';
import type { AssetQuery } from '@/lib/api/assets';
import { CONDITION_LABEL, OWNERSHIP_LABEL, STATUS_LABEL } from '@/lib/asset-labels';
import { ASSET_CONDITIONS, ASSET_STATUSES, OWNERSHIP_TYPES } from '@/types/api';
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

export function AssetFilters({
  value,
  onChange,
}: {
  value: AssetFilterState;
  onChange: (next: AssetFilterState) => void;
}) {
  const categories = useQuery({
    queryKey: ['categories', { isActive: true, pageSize: 100 }],
    queryFn: () => categoriesApi.list({ isActive: true, pageSize: 100 }),
    staleTime: 60_000,
  });
  const set = <K extends keyof AssetFilterState>(key: K, v: AssetFilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <div className="relative md:col-span-3 xl:col-span-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Cari kode, nama, merek, model, nomor seri..."
          className="pl-9"
          aria-label="Cari barang"
        />
      </div>
      <Select value={value.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-label="Filter kategori">
        <option value="">Semua kategori</option>
        {categories.data?.data.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <Select value={value.status} onChange={(e) => set('status', e.target.value as AssetFilterState['status'])} aria-label="Filter status">
        <option value="">Semua status</option>
        {ASSET_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </Select>
      <Select value={value.condition} onChange={(e) => set('condition', e.target.value as AssetFilterState['condition'])} aria-label="Filter kondisi">
        <option value="">Semua kondisi</option>
        {ASSET_CONDITIONS.map((c) => (
          <option key={c} value={c}>{CONDITION_LABEL[c]}</option>
        ))}
      </Select>
      <Select value={value.ownershipType} onChange={(e) => set('ownershipType', e.target.value as AssetFilterState['ownershipType'])} aria-label="Filter kepemilikan">
        <option value="">Semua kepemilikan</option>
        {OWNERSHIP_TYPES.map((o) => (
          <option key={o} value={o}>{OWNERSHIP_LABEL[o]}</option>
        ))}
      </Select>
      <label className="flex items-center gap-2 text-sm text-muted-foreground xl:col-span-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={value.includeArchived}
          onChange={(e) => set('includeArchived', e.target.checked)}
        />
        Tampilkan barang yang diarsipkan
      </label>
    </div>
  );
}
