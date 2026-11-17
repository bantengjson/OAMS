import type { LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Label({
  className,
  required,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('text-sm font-medium text-foreground', className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/** Vertical stack: label, control, hint/error. */
export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>;
}
