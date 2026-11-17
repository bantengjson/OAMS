import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'error' | 'info' | 'success';

const styles: Record<Variant, { box: string; Icon: typeof Info }> = {
  error: { box: 'border-destructive/30 bg-destructive/5 text-destructive', Icon: AlertCircle },
  info: { box: 'border-primary/30 bg-primary/5 text-primary', Icon: Info },
  success: { box: 'border-success/30 bg-success/5 text-success', Icon: CheckCircle2 },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: Variant;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border px-3 py-2.5 text-sm', box, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-foreground/90">{children}</div> : null}
      </div>
    </div>
  );
}
