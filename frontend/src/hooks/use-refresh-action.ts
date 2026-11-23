'use client';

import { useCallback, useRef, useState } from 'react';

/** A refresh that is over before the eye catches it looks broken; hold the busy state this long. */
export const MIN_REFRESH_MS = 600;

/**
 * Runs a refresh and reports whether it is still going, so a button can spin and lock itself.
 * The busy state lasts at least `minMs`, so cached data that comes back instantly still shows
 * that something happened; a press while it runs is ignored.
 */
export function useRefreshAction(
  work: () => Promise<unknown>,
  minMs: number = MIN_REFRESH_MS,
): { refreshing: boolean; run: () => Promise<void> } {
  const [refreshing, setRefreshing] = useState(false);
  // A ref, not the state: two presses in the same tick would both read the old state.
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRefreshing(true);
    try {
      await Promise.all([work(), new Promise((resolve) => setTimeout(resolve, minMs))]);
    } catch {
      // The work reports its own failure — a refetch that fails leaves its query in an error
      // state the page already shows. All this hook owes the caller is to stop spinning, and
      // callers fire it from a click handler, where a rejection would go unhandled.
    } finally {
      running.current = false;
      setRefreshing(false);
    }
  }, [work, minMs]);

  return { refreshing, run };
}
