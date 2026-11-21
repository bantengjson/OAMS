'use client';

import { useQueries } from '@tanstack/react-query';

/**
 * Total rows per filter value, for the status chips of a list page. Each count is one small
 * request (page size 1, read meta.total) under the list's own query-key scope, so invalidating
 * the list (e.g. ['loans']) refreshes the counts too.
 */
export function useListCounts<K extends string>(
  scope: string,
  keys: readonly K[],
  fetchTotal: (key: K) => Promise<number>,
  /** Other filters the counts depend on (part of the cache key). */
  extra: unknown = null,
): Partial<Record<K, number>> {
  const results = useQueries({
    queries: keys.map((key) => ({ queryKey: [scope, 'count', key, extra], queryFn: () => fetchTotal(key), staleTime: 30_000 })),
  });
  const counts: Partial<Record<K, number>> = {};
  keys.forEach((key, i) => {
    const total = results[i]?.data;
    if (typeof total === 'number') counts[key] = total;
  });
  return counts;
}
