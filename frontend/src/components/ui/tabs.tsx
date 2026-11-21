'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  badge?: number | string;
}

export function Tabs<K extends string>({
  items,
  value,
  onChange,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {item.badge !== undefined ? (
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground')}>{item.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return null;
  return <div role="tabpanel">{children}</div>;
}
