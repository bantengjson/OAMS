'use client';

import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownItem {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

export function DropdownMenu({
  trigger,
  items,
  align = 'start',
  triggerLabel,
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={triggerLabel}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-44 overflow-hidden rounded-md border border-border bg-card p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={async () => {
                  setOpen(false);
                  await item.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm hover:bg-muted disabled:opacity-50',
                  item.destructive ? 'text-destructive' : 'text-foreground',
                )}
              >
                {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
