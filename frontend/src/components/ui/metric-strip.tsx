import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { TONE_CLASS } from '@/lib/tones';
import type { Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { IconChip } from './icon-chip';
import { Spinner } from './spinner';

export interface Metric {
  key: string;
  label: string;
  value: number | string | undefined;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
}

/** Several small metrics in one card, divided by thin lines; each may link to its list. */
export function MetricStrip({
  title,
  subtitle,
  items,
  loading,
  error,
}: {
  title: string;
  subtitle?: string;
  items: Metric[];
  loading?: boolean;
  error?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-card border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((m) => {
          const body = (
            <div className="flex h-full flex-col gap-2 px-5 py-4">
              <IconChip icon={m.icon} tone={m.tone} size="sm" className="h-8 w-8 rounded-lg" />
              <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
              <span className={cn('text-[22px] font-semibold leading-none tabular-nums', TONE_CLASS[m.tone].text)}>
                {loading ? <Spinner className="h-4 w-4 text-muted-foreground" /> : error ? '–' : m.value}
              </span>
            </div>
          );
          const cell = 'border-b border-r border-border/70 last:border-r-0';
          return m.href ? (
            <Link key={m.key} href={m.href} className={cn(cell, 'transition-colors hover:bg-[#fafbfc]')}>
              {body}
            </Link>
          ) : (
            <div key={m.key} className={cell}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}
