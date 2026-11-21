'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { TH } from './table';

/** Table header that toggles sorting on its field: first click ascending, second descending. */
export function SortableHeader<F extends string>({
  label,
  field,
  sort,
  order,
  onSort,
  className,
  ...props
}: {
  label: string;
  field: F;
  sort: F;
  order: 'asc' | 'desc';
  onSort: (field: F, order: 'asc' | 'desc') => void;
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, 'onClick'>) {
  const active = sort === field;
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TH
      className={className}
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      {...props}
    >
      <button
        type="button"
        onClick={() => onSort(field, active && order === 'asc' ? 'desc' : 'asc')}
        className={cn('inline-flex items-center gap-1 font-medium', active ? 'text-foreground' : 'hover:text-foreground')}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'opacity-60')} aria-hidden="true" />
      </button>
    </TH>
  );
}
