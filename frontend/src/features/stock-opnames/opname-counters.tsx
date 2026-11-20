'use client';

import { OPNAME_RESULT_LABEL } from '@/lib/operation-labels';
import type { OpnameResult, OpnameStatus } from '@/types/api';
import { opnameProgress } from './opname-summary';

const OPEN_KEYS: OpnameResult[] = ['PENDING', 'MATCHED', 'CONDITION_DIFFERS', 'UNREGISTERED'];
const CLOSED_KEYS: OpnameResult[] = ['MATCHED', 'CONDITION_DIFFERS', 'NOT_FOUND', 'ON_LOAN', 'IN_MAINTENANCE', 'UNREGISTERED'];

/** Progress bar plus one counter per result that matters for the session's state. */
export function OpnameCounters({ counts, status }: { counts: Record<OpnameResult, number>; status: OpnameStatus }) {
  const p = opnameProgress(counts);
  const keys = status === 'OPEN' ? OPEN_KEYS : CLOSED_KEYS;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>Sudah dihitung</span>
          <span className="tabular-nums text-muted-foreground">
            {p.scanned}/{p.total} ({p.percent}%)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${p.percent}%` }} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {keys.map((k) => (
          <div key={k} className="rounded-md border border-border px-3 py-2">
            <dt className="truncate text-xs text-muted-foreground">{OPNAME_RESULT_LABEL[k]}</dt>
            <dd className="text-lg font-semibold tabular-nums">{counts[k] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
