import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** CSS `conic-gradient` stops for the slices; '' when there is nothing to draw. */
export function donutSegments(parts: { value: number; color: string }[]): string {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  if (total <= 0) return '';
  const stops: string[] = [];
  let at = 0;
  const slices = parts.filter((p) => p.value > 0);
  slices.forEach((p, i) => {
    const end = i === slices.length - 1 ? 100 : round2(at + (p.value / total) * 100);
    stops.push(`${p.color} ${round2(at)}% ${end}%`);
    at = end;
  });
  return stops.join(', ');
}

export interface ChartPart {
  key: string;
  label: string;
  value: number;
  /** CSS colour, e.g. `var(--tone-green)`. */
  color: string;
  href?: string;
}

/** Ring chart with a centre figure and a legend; the legend rows link when `href` is given. */
export function DonutChart({ parts, center, caption }: { parts: ChartPart[]; center: ReactNode; caption?: string }) {
  const stops = donutSegments(parts);
  return (
    <div className="flex items-center gap-5">
      <div
        className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full"
        style={{ background: stops ? `conic-gradient(${stops})` : 'var(--muted)' }}
        role="img"
        aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}
      >
        <div className="flex h-[84px] w-[84px] flex-col items-center justify-center rounded-full bg-card">
          <span className="text-xl font-semibold leading-none text-foreground tabular-nums">{center}</span>
          {caption ? <span className="mt-1 text-[11px] text-muted-foreground">{caption}</span> : null}
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {parts.map((p) => {
          const row = (
            <>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
                {p.label}
              </span>
              <span className="font-medium text-foreground tabular-nums">{p.value}</span>
            </>
          );
          return (
            <li key={p.key}>
              {p.href ? (
                <Link href={p.href} className="flex justify-between gap-2 rounded hover:text-primary">{row}</Link>
              ) : (
                <div className="flex justify-between gap-2">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Horizontal bars, scaled to the largest value. */
export function BarList({ rows, className }: { rows: ChartPart[]; className?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {rows.map((r) => {
        const pct = max > 0 ? Math.round((r.value / max) * 100) : 0;
        return (
          <li key={r.key} className="grid grid-cols-[minmax(0,8rem)_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate" title={r.label}>{r.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
              <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
            </span>
            <span className="text-right font-medium text-foreground tabular-nums">{r.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Vertical bars with the value above and the label below; the last bar can be highlighted. */
export function ColumnChart({ rows, highlightLast = false }: { rows: ChartPart[]; highlightLast?: boolean }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <div className="flex h-40 items-end gap-3 pt-2">
      {rows.map((r, i) => {
        const h = max > 0 ? Math.max(4, Math.round((r.value / max) * 112)) : 4;
        const last = highlightLast && i === rows.length - 1;
        return (
          <div key={r.key} className="flex flex-1 flex-col items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{r.value}</span>
            <span
              className="block w-full max-w-9 rounded-t-[5px]"
              style={{ height: h, background: last ? 'var(--tone-green)' : r.color }}
            />
            <span className="tabular-nums">{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}
