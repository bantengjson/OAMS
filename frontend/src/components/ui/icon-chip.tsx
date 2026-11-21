import type { LucideIcon } from 'lucide-react';
import { TONE_CLASS } from '@/lib/tones';
import type { Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** A lucide icon on a soft tinted square. */
export function IconChip({ icon: Icon, tone, size = 'md', className }: { icon: LucideIcon; tone: Tone; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center',
        size === 'md' ? 'h-[38px] w-[38px] rounded-[9px]' : 'h-7 w-7 rounded-[7px]',
        TONE_CLASS[tone].bg,
        TONE_CLASS[tone].text,
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={size === 'md' ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5'} />
    </span>
  );
}
