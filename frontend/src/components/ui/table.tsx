import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Card-wrapped table. Below xl (1280 px) it scrolls sideways inside its card. From xl the header sticks under
 * the topbar instead, which needs visible overflow; pass stickyHeader={false} for tables too wide for that.
 */
export function Table({
  className,
  wrapperClassName,
  stickyHeader = true,
  ...props
}: HTMLAttributes<HTMLTableElement> & { wrapperClassName?: string; stickyHeader?: boolean }) {
  return (
    <div
      className={cn(
        'relative w-full overflow-x-auto rounded-card border border-border bg-card shadow-card',
        stickyHeader && 'xl:overflow-x-visible xl:[&_th]:sticky xl:[&_th]:top-16 xl:[&_th]:z-10',
        wrapperClassName,
      )}
    >
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('text-left [&_th]:bg-[#fafbfc]', className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-[#eef2f6]', className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-[#fafbfd]', className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-10 border-b border-border px-3.5 text-xs font-medium whitespace-nowrap text-muted-foreground first:rounded-tl-card last:rounded-tr-card',
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3.5 py-2.5 align-middle', className)} {...props} />;
}

export function TableMessage({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3.5 py-12 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
