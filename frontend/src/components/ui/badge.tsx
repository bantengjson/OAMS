import type { HTMLAttributes } from 'react';
import { TONE_CLASS } from '@/lib/tones';
import type { Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'muted';

const variants: Record<Variant, string> = {
  default: 'bg-tone-blue-soft text-tone-blue',
  success: 'bg-tone-green-soft text-[#11804f]',
  warning: 'bg-tone-amber-soft text-[#9a6a12]',
  destructive: 'bg-tone-red-soft text-[#b83e3e]',
  outline: 'border border-border text-body',
  muted: 'bg-tone-slate-soft text-muted-foreground',
};

export function Badge({
  className,
  variant = 'default',
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tone ? cn(TONE_CLASS[tone].bg, TONE_CLASS[tone].text) : variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'success' : 'muted'}>{active ? 'Aktif' : 'Nonaktif'}</Badge>;
}
