import type { OpnameResult } from '@/types/api';

export interface OpnameProgress {
  scanned: number;
  total: number;
  percent: number;
}

/** Rows that never count toward the session total: removed assets and stray scans. */
const OUTSIDE_TOTAL: readonly OpnameResult[] = ['REMOVED', 'UNREGISTERED'];

export function opnameProgress(counts: Record<OpnameResult, number>): OpnameProgress {
  const total = (Object.keys(counts) as OpnameResult[])
    .filter((k) => !OUTSIDE_TOTAL.includes(k))
    .reduce((sum, k) => sum + (counts[k] ?? 0), 0);
  const scanned = (counts.MATCHED ?? 0) + (counts.CONDITION_DIFFERS ?? 0);
  const percent = total > 0 ? Math.round((scanned / total) * 100) : 0;
  return { scanned, total, percent };
}
