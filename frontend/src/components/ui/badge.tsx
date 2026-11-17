import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'muted';

const variants: Record<Variant, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  outline: 'border border-border text-foreground',
  muted: 'bg-muted text-muted-foreground',
};

export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'success' : 'muted'}>{active ? 'Aktif' : 'Nonaktif'}</Badge>;
}
