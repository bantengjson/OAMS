'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  /** Faint number at the right of the row, e.g. how many items are in that room. */
  count?: number;
  /** Heading the option sits under, e.g. "BG · Bergerak". */
  group?: string;
}

/** Options whose label contains every word typed, in any order and in any case. */
export function matchOptions(options: readonly FilterOption[], query: string): FilterOption[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...options];
  return options.filter((o) => {
    const label = o.label.toLowerCase();
    return words.every((w) => label.includes(w));
  });
}

/** The next option the arrow keys land on; wraps around, and -1 means nothing is active yet. */
export function moveActive(index: number, delta: number, count: number): number {
  if (count === 0) return -1;
  if (index < 0) return delta > 0 ? 0 : count - 1;
  return (index + delta + count) % count;
}

/** Lists longer than this get a search box. */
const SEARCH_FROM = 8;

/**
 * A filter in the shape the office list needs: a button showing what is chosen, and a panel of
 * options with a tick on the current one. It replaces the browser's own select, which cannot show
 * counts, cannot be searched, and looks nothing like the rest of the page.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
  searchable,
  className,
  widthClassName = 'w-64',
}: {
  /** What the filter is about, e.g. "Ruangan". */
  label: string;
  /** The chosen value; '' means no filter. */
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
  /** The first row, which clears the filter. */
  allLabel?: string;
  searchable?: boolean;
  className?: string;
  /** Width of the panel. */
  widthClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const clearLabel = allLabel ?? `Semua ${label.toLowerCase()}`;
  const withSearch = searchable ?? options.length > SEARCH_FROM;
  const rows = useMemo<FilterOption[]>(
    () => [{ value: '', label: clearLabel }, ...matchOptions(options, withSearch ? query : '')],
    [options, query, withSearch, clearLabel],
  );
  const chosen = options.find((o) => o.value === value) ?? null;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, close]);

  useEffect(() => {
    if (open && withSearch) searchRef.current?.focus();
  }, [open, withSearch]);

  // Keep the keyboard cursor in view while arrowing through a long list.
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelectorAll('[role="option"]')[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (next: string) => {
    onChange(next);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => moveActive(i, e.key === 'ArrowDown' ? 1 : -1, rows.length));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(rows[active].value);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          'flex h-9 w-full items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          chosen
            ? 'border-primary/30 bg-primary-soft text-primary'
            : 'border-border bg-card text-body hover:border-input hover:bg-muted',
        )}
      >
        <span className={cn('shrink-0', chosen ? 'text-primary/70' : 'text-muted-foreground')}>{label}</span>
        <span className={cn('truncate', chosen ? 'font-medium' : 'text-muted-foreground')}>
          {chosen ? chosen.label : 'semua'}
        </span>
        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0', chosen ? 'text-primary/70' : 'text-muted-foreground')} aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={panelId}
          className={cn(
            'absolute left-0 z-50 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-lg',
            widthClassName,
          )}
        >
          {withSearch ? (
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(-1);
                  }}
                  placeholder={`Cari ${label.toLowerCase()}...`}
                  aria-label={`Cari ${label.toLowerCase()}`}
                  className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2 text-[13px] outline-none focus:border-input"
                />
              </div>
            </div>
          ) : null}
          <div ref={listRef} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1">
            {rows.length === 1 && withSearch && query.trim() ? (
              <p className="px-2.5 py-3 text-center text-[13px] text-muted-foreground">Tidak ada yang cocok.</p>
            ) : null}
            {rows.map((o, i) => {
              const selected = o.value === value;
              const heading = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return (
                <div key={o.value || '__all__'}>
                  {heading ? (
                    <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px]',
                      selected ? 'bg-primary-soft text-primary' : 'text-body',
                      i === active && !selected ? 'bg-muted' : '',
                    )}
                  >
                    <Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                    <span className="truncate">{o.label}</span>
                    {o.count !== undefined ? (
                      <span className={cn('ml-auto shrink-0 text-xs tabular-nums', selected ? 'text-primary/70' : 'text-muted-foreground')}>
                        {o.count}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
