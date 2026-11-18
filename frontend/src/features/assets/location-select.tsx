'use client';

import { useQuery } from '@tanstack/react-query';
import type { SelectHTMLAttributes } from 'react';
import { Select } from '@/components/ui/select';
import { locationsApi } from '@/lib/api/locations';
import type { Location } from '@/types/api';

/** Every active location, all pages, sorted by its readable path. */
export async function fetchAllActiveLocations(): Promise<Location[]> {
  const all: Location[] = [];
  let page = 1;
  for (;;) {
    const res = await locationsApi.list({ isActive: true, pageSize: 100, page });
    all.push(...res.data);
    if (page >= res.meta.totalPages) break;
    page += 1;
  }
  return all.sort((a, b) => a.path.localeCompare(b.path, 'id'));
}

export function useActiveLocations() {
  return useQuery({ queryKey: ['locations', 'all-active'], queryFn: fetchAllActiveLocations, staleTime: 60_000 });
}

export function LocationSelect({
  placeholder = 'Pilih lokasi...',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  const locations = useActiveLocations();
  return (
    <Select {...props}>
      <option value="">{locations.isPending ? 'Memuat lokasi...' : placeholder}</option>
      {locations.data?.map((l) => (
        <option key={l.id} value={l.id}>
          {l.path}
        </option>
      ))}
    </Select>
  );
}
