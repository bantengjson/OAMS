import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { IconChip } from './icon-chip';
import { Spinner } from './spinner';

const TOP_BORDER: Record<Tone, string> = {
  blue: 'border-t-tone-blue',
  green: 'border-t-tone-green',
  violet: 'border-t-tone-violet',
  amber: 'border-t-tone-amber',
  red: 'border-t-tone-red',
  teal: 'border-t-tone-teal',
  orange: 'border-t-tone-orange',
  slate: 'border-t-tone-slate',
};

const HINT_EMPHASIS: Record<Tone, string> = {
  blue: '[&_b]:text-tone-blue',
  green: '[&_b]:text-tone-green',
  violet: '[&_b]:text-tone-violet',
  amber: '[&_b]:text-tone-amber',
  red: '[&_b]:text-tone-red',
  teal: '[&_b]:text-tone-teal',
  orange: '[&_b]:text-tone-orange',
  slate: '[&_b]:text-tone-slate',
};

/** KPI card: tinted icon, coloured top edge, big number, one line of context. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
  href,
  loading,
  error,
}: {
  label: string;
  value: number | string | undefined;
  hint?: ReactNode;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
  loading?: boolean;
  error?: boolean;
}) {
  const body = (
    <div
      className={cn(
        'flex h-full items-start gap-3.5 rounded-card border border-t-[3px] border-border bg-card px-5 py-4 shadow-card transition-colors',
        TOP_BORDER[tone],
        href && 'hover:bg-[#fcfdfe]',
      )}
    >
      <IconChip icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[28px] font-semibold leading-tight tracking-tight text-foreground tabular-nums">
          {loading ? <Spinner className="h-5 w-5 text-muted-foreground" /> : error ? '–' : value}
        </p>
        {hint && !loading && !error ? (
          <p className={cn('mt-0.5 text-xs text-muted-foreground [&_b]:font-semibold', HINT_EMPHASIS[tone])}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
