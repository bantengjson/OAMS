import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Search and filters on one wrapping row; `right` sits at the far end (e.g. the column menu). */
export function FilterBar({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)}>
      {children}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

/** Bar shown above a table while rows are selected. */
export function BulkBar({ count, children, onClear }: { count: number; children: ReactNode; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary-soft px-4 py-2.5 text-[13px] text-primary">
      <b className="font-semibold">{count} dipilih</b>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <button type="button" onClick={onClear} className="ml-auto font-medium hover:underline">
        Batal pilih
      </button>
    </div>
  );
}
