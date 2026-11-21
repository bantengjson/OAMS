'use client';

import { TONE_CLASS } from '@/lib/tones';
import type { Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';

export interface StatusChipItem<K extends string> {
  key: K;
  label: string;
  /** Undefined while still loading. */
  count: number | undefined;
  tone: Tone;
}

/** Row of quick filters with a coloured dot and a count; the active one is highlighted. */
export function StatusChips<K extends string>({
  items,
  value,
  onChange,
  label = 'Saring menurut status',
}: {
  items: StatusChipItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(it.key)}
            className={cn(
              'inline-flex h-[34px] items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors',
              active
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-card text-body hover:border-input hover:bg-muted/60',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', TONE_CLASS[it.tone].dot)} aria-hidden="true" />
            {it.label}
            <span className={cn('font-semibold tabular-nums', active ? 'text-primary' : 'text-foreground')}>{it.count ?? '–'}</span>
          </button>
        );
      })}
    </div>
  );
}
