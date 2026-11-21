'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { categoriesApi } from '@/lib/api/categories';
import { categoryTone, categoryToneMap } from '@/lib/tones';
import type { Tone } from '@/lib/tones';

/** All categories (active and inactive), shared by the category colours and the category filter. */
export const ALL_CATEGORIES_QUERY = {
  queryKey: ['categories', 'all', { pageSize: 100 }] as const,
  queryFn: () => categoriesApi.list({ pageSize: 100 }),
  staleTime: 5 * 60_000,
};

/** Colour of a category by creation order; falls back to the id hash until the list has loaded. */
export function useCategoryTone(): (categoryId: string) => Tone {
  const categories = useQuery(ALL_CATEGORIES_QUERY);
  const map = useMemo(() => categoryToneMap(categories.data?.data ?? []), [categories.data]);
  return (categoryId) => map.get(categoryId) ?? categoryTone(categoryId);
}
