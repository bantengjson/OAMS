import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { TONE_CLASS } from '@/lib/tones';
import type { Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';

type Variant = 'error' | 'info' | 'success';

const styles: Record<Variant, { box: string; Icon: typeof Info }> = {
  error: { box: 'border-tone-red/25 bg-tone-red-soft text-tone-red', Icon: AlertCircle },
  info: { box: 'border-tone-blue/20 bg-tone-blue-soft text-tone-blue', Icon: Info },
  success: { box: 'border-tone-green/25 bg-tone-green-soft text-tone-green', Icon: CheckCircle2 },
};

export function Alert({
  variant = 'info',
  tone,
  title,
  children,
  className,
}: {
  variant?: Variant;
  /** Colour by flow (loan, repair, disposal…) instead of the variant's colour. */
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border px-3.5 py-3 text-sm', tone ? cn(TONE_CLASS[tone].bg, TONE_CLASS[tone].text, 'border-current/20') : box, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-body">{children}</div> : null}
      </div>
    </div>
  );
}
