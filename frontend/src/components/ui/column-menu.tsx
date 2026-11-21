'use client';

import { Columns3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ColumnDef } from '@/lib/column-prefs';
import { Button } from './button';

/** "Kolom" button with a checklist of columns; required columns are shown ticked and locked. */
export function ColumnMenu({
  columns,
  visible,
  onChange,
}: {
  columns: ColumnDef[];
  visible: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)} leftIcon={<Columns3 className="h-4 w-4" />}>
        Kolom
      </Button>
      {open ? (
        <div className="absolute right-0 top-10 z-30 w-56 rounded-[10px] border border-border bg-card p-2 text-[13px] shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
          <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tampilkan kolom</p>
          {columns.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={visible.has(c.key)}
                disabled={c.required}
                onChange={(e) => {
                  const next = new Set(visible);
                  if (e.target.checked) next.add(c.key);
                  else next.delete(c.key);
                  onChange(next);
                }}
              />
              {c.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
