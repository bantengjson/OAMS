'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useController } from 'react-hook-form';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  /** Faint number at the right of the row, e.g. how many items are in that room. */
  count?: number;
  /** Heading the option sits under, e.g. "BG · Bergerak". */
  group?: string;
  disabled?: boolean;
}

/** Options whose label contains every word typed, in any order and in any case. */
export function matchOptions(options: readonly SelectOption[], query: string): SelectOption[] {
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

const GAP = 4;
const MARGIN = 8;
/** Below this, flipping above the trigger is worth it. */
const CRAMPED = 200;

export interface PanelPosition {
  left: number;
  width: number;
  maxHeight: number;
  /** Distance from the top of the window; set when the panel hangs below the trigger. */
  top?: number;
  /** Distance from the bottom of the window; set when the panel sits above the trigger. */
  bottom?: number;
}

/**
 * Where the panel goes. It is positioned against the window rather than the trigger, because
 * half of these live inside a dialog whose body scrolls and would otherwise cut the panel off.
 */
export function placePanel(
  rect: { top: number; bottom: number; left: number; width: number },
  viewport: { width: number; height: number },
  wanted: number,
  minWidth = 0,
): PanelPosition {
  const below = viewport.height - rect.bottom - GAP - MARGIN;
  const above = rect.top - GAP - MARGIN;
  const flip = below < Math.min(wanted, CRAMPED) && above > below;
  const maxHeight = Math.max(120, Math.min(wanted, flip ? above : below));
  const width = Math.max(rect.width, minWidth);
  const left = Math.max(MARGIN, Math.min(rect.left, viewport.width - width - MARGIN));
  return flip
    ? { left, width, maxHeight, bottom: viewport.height - rect.top + GAP }
    : { left, width, maxHeight, top: rect.bottom + GAP };
}

/**
 * A `<dialog>` closes itself on Escape, and no amount of preventDefault on the key event stops
 * it: the browser raises a close request of its own. So an open panel notes that it took the
 * Escape, and the dialog checks here before closing.
 */
let escapeTakenAt = -Infinity;
const ESCAPE_WINDOW_MS = 100;

export function escapeTakenByDropdown(now: number = performance.now()): boolean {
  return now - escapeTakenAt < ESCAPE_WINDOW_MS;
}

/** For tests; the panel calls this for real. */
export function noteDropdownEscape(now: number = performance.now()): void {
  escapeTakenAt = now;
}

/** Lists longer than this get a search box. */
const SEARCH_FROM = 8;
const PANEL_HEIGHT = 288;

interface PickerProps {
  /** The chosen value; '' means nothing is chosen. */
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** A first row that sets the value back to ''. Leave out when the field must have a value. */
  emptyLabel?: string;
  /** Forces the search box on or off; by default it appears once the list is long. */
  searchable?: boolean;
  disabled?: boolean;
  /** Least width of the panel in pixels; it is never narrower than the trigger. */
  panelWidth?: number;
  className?: string;
}

interface PickerInternals extends PickerProps {
  trigger: (state: { open: boolean; chosen: SelectOption | null }) => React.ReactNode;
  /** What the search box says it searches, e.g. "jenis". */
  what: string;
  id?: string;
  onBlur?: () => void;
}

function Picker({
  value,
  onChange,
  options,
  emptyLabel,
  searchable,
  disabled,
  panelWidth,
  className,
  trigger,
  what,
  id,
  onBlur,
}: PickerInternals) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [at, setAt] = useState<PanelPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const withSearch = searchable ?? options.length > SEARCH_FROM;
  const rows = useMemo<SelectOption[]>(() => {
    const found = matchOptions(options, withSearch ? query : '');
    return emptyLabel === undefined ? found : [{ value: '', label: emptyLabel }, ...found];
  }, [options, query, withSearch, emptyLabel]);
  const chosen = options.find((o) => o.value === value) ?? null;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(-1);
    onBlur?.();
  }, [onBlur]);

  // Measured against the window, and kept in step with it: an ancestor that scrolls would
  // otherwise leave the panel floating where the trigger used to be.
  const measure = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAt(
      placePanel(
        { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
        { width: window.innerWidth, height: window.innerHeight },
        PANEL_HEIGHT,
        panelWidth ?? 0,
      ),
    );
  }, [panelWidth]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onMove = () => measure();
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, close, measure]);

  useEffect(() => {
    if (open && withSearch) searchRef.current?.focus();
  }, [open, withSearch]);

  // Keep the keyboard cursor in view while arrowing through a long list.
  useEffect(() => {
    if (active < 0) return;
    const row = listRef.current?.querySelectorAll('[role="option"]')[active];
    // jsdom has no scrollIntoView, and neither does every embedded browser.
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
    setActive(-1);
    buttonRef.current?.focus();
    onBlur?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      noteDropdownEscape();
      close();
      buttonRef.current?.focus();
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
    } else if (e.key === 'Enter') {
      // Never let the panel's Enter submit the form behind it.
      e.preventDefault();
      if (active >= 0 && !rows[active].disabled) choose(rows[active].value);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  // A row only carries its heading when the group changes, so the panel reads as sections.
  const headed = rows.map((o, i) => ({ o, heading: o.group && o.group !== rows[i - 1]?.group ? o.group : null }));

  return (
    <div ref={rootRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className="w-full"
      >
        {trigger({ open, chosen })}
      </button>

      {open && at ? (
        <div
          id={panelId}
          style={{ left: at.left, top: at.top, bottom: at.bottom, width: at.width }}
          className="fixed z-50 overflow-hidden rounded-md border border-border bg-card shadow-lg"
        >
          {withSearch ? (
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(-1);
                  }}
                  placeholder={`Cari ${what}...`}
                  aria-label={`Cari ${what}`}
                  className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2 text-[13px] outline-none focus:border-input"
                />
              </div>
            </div>
          ) : null}
          <div
            ref={listRef}
            role="listbox"
            aria-label={what}
            style={{ maxHeight: at.maxHeight }}
            className="overflow-y-auto p-1"
          >
            {rows.length === 0 || (rows.length === 1 && emptyLabel !== undefined && query.trim()) ? (
              <p className="px-2.5 py-3 text-center text-[13px] text-muted-foreground">Tidak ada yang cocok.</p>
            ) : null}
            {headed.map(({ o, heading }, i) => {
              const selected = o.value === value;
              return (
                <div key={o.value || '__empty__'}>
                  {heading ? (
                    <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {heading}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={o.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px]',
                      selected ? 'bg-primary-soft text-primary' : 'text-body',
                      o.disabled ? 'cursor-not-allowed opacity-50' : '',
                      i === active && !selected && !o.disabled ? 'bg-muted' : '',
                    )}
                  >
                    <Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                    <span className="truncate">{o.label}</span>
                    {o.count !== undefined ? (
                      <span
                        className={cn(
                          'ml-auto shrink-0 text-xs tabular-nums',
                          selected ? 'text-primary/70' : 'text-muted-foreground',
                        )}
                      >
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

/**
 * A filter above a list: the label stays on the button, and the button takes the accent colour
 * while a filter is set, so an active filter can be seen without opening it.
 */
export function FilterSelect({
  label,
  allLabel,
  neutral = '',
  ...rest
}: Omit<PickerInternals, 'trigger' | 'what' | 'emptyLabel'> & {
  /** What the filter is about, e.g. "Ruangan". */
  label: string;
  /** The first row, which clears the filter. Unused when the options carry their own. */
  allLabel?: string;
  /** The value that means "not filtered"; the button only takes the accent beyond it. */
  neutral?: string;
}) {
  const what = label.toLowerCase();
  // Some lists have no empty value: their "Semua" is an option of their own.
  const ownNeutral = neutral !== '' || rest.options.some((o) => o.value === '');
  const on = rest.value !== neutral;
  return (
    <Picker
      {...rest}
      what={what}
      emptyLabel={ownNeutral ? undefined : (allLabel ?? `Semua ${what}`)}
      trigger={({ chosen }) => (
        <span
          className={cn(
            'flex h-9 w-full items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors',
            on
              ? 'border-primary/30 bg-primary-soft text-primary'
              : 'border-border bg-card text-body hover:border-input hover:bg-muted',
            rest.disabled ? 'cursor-not-allowed opacity-60' : '',
          )}
        >
          <span className={cn('shrink-0', on ? 'text-primary/70' : 'text-muted-foreground')}>{label}</span>
          <span className={cn('truncate', on ? 'font-medium' : 'text-muted-foreground')}>
            {chosen ? chosen.label : 'semua'}
          </span>
          <ChevronDown
            className={cn('ml-auto h-4 w-4 shrink-0', on ? 'text-primary/70' : 'text-muted-foreground')}
            aria-hidden="true"
          />
        </span>
      )}
    />
  );
}

/**
 * A form field, with its own label above it: it looks like the text inputs next to it, shows a
 * placeholder until something is chosen, and turns red when the form marks it invalid.
 */
export function FieldSelect({
  placeholder = 'Pilih...',
  invalid,
  what,
  ...rest
}: Omit<PickerInternals, 'trigger' | 'what'> & {
  placeholder?: string;
  invalid?: boolean;
  /** What the search box says it searches; taken from the placeholder when left out. */
  what?: string;
}) {
  return (
    <Picker
      {...rest}
      what={what ?? (placeholder.replace(/^Pilih\s*/i, '').replace(/\.*$/, '') || 'pilihan')}
      trigger={({ open, chosen }) => (
        <span
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border bg-card px-3 text-sm transition-colors',
            invalid ? 'border-destructive' : 'border-border',
            rest.disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-input',
            open && !invalid ? 'border-primary ring-2 ring-primary/20' : '',
          )}
        >
          <span className={cn('truncate', chosen ? 'text-foreground' : 'text-muted-foreground')}>
            {chosen ? chosen.label : placeholder}
          </span>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </span>
      )}
    />
  );
}

/** `FieldSelect` wired to a react-hook-form field. */
export function FormSelect<T extends FieldValues, TContext = unknown, TOut extends FieldValues = T>({
  control,
  name,
  ...rest
}: Omit<React.ComponentProps<typeof FieldSelect>, 'value' | 'onChange' | 'onBlur'> & {
  control: Control<T, TContext, TOut>;
  name: FieldPath<T>;
}) {
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldSelect
      {...rest}
      value={(field.value as string | null | undefined) ?? ''}
      onChange={field.onChange}
      onBlur={field.onBlur}
      invalid={rest.invalid ?? Boolean(fieldState.error)}
    />
  );
}
