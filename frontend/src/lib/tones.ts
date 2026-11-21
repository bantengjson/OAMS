import type { AssetCondition, AssetStatus } from '@/types/api';

/** Accent colours of the redesign; each has a strong and a soft token in globals.css. */
export type Tone = 'blue' | 'green' | 'violet' | 'amber' | 'red' | 'teal' | 'orange' | 'slate';

export const TONES: readonly Tone[] = ['blue', 'green', 'violet', 'amber', 'red', 'teal', 'orange', 'slate'];

export const STATUS_TONE: Record<AssetStatus, Tone> = {
  AVAILABLE: 'green',
  IN_USE: 'blue',
  STORED: 'slate',
  BORROWED: 'violet',
  UNDER_MAINTENANCE: 'orange',
  MISSING: 'red',
  DISPOSED: 'slate',
  RETURNED: 'teal',
};

export const CONDITION_TONE: Record<AssetCondition, Tone> = {
  GOOD: 'green',
  MINOR_DAMAGE: 'amber',
  MAJOR_DAMAGE: 'orange',
  UNUSABLE: 'red',
};

export type Flow = 'mutation' | 'loan' | 'overdue' | 'maintenance' | 'damageReport' | 'disposal' | 'opname';

export const FLOW_TONE: Record<Flow, Tone> = {
  mutation: 'violet',
  loan: 'blue',
  overdue: 'red',
  maintenance: 'orange',
  damageReport: 'amber',
  disposal: 'slate',
  opname: 'teal',
};

/** Stable tone per category id (a string hash), so colours do not move when counts or sorting change. */
export function categoryTone(categoryId: string): Tone {
  let h = 0;
  for (let i = 0; i < categoryId.length; i++) h = (h * 31 + categoryId.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/** Literal class names (Tailwind only generates classes it can find verbatim in the source). */
export const TONE_CLASS: Record<Tone, { text: string; bg: string; dot: string; border: string }> = {
  blue: { text: 'text-tone-blue', bg: 'bg-tone-blue-soft', dot: 'bg-tone-blue', border: 'border-tone-blue' },
  green: { text: 'text-tone-green', bg: 'bg-tone-green-soft', dot: 'bg-tone-green', border: 'border-tone-green' },
  violet: { text: 'text-tone-violet', bg: 'bg-tone-violet-soft', dot: 'bg-tone-violet', border: 'border-tone-violet' },
  amber: { text: 'text-tone-amber', bg: 'bg-tone-amber-soft', dot: 'bg-tone-amber', border: 'border-tone-amber' },
  red: { text: 'text-tone-red', bg: 'bg-tone-red-soft', dot: 'bg-tone-red', border: 'border-tone-red' },
  teal: { text: 'text-tone-teal', bg: 'bg-tone-teal-soft', dot: 'bg-tone-teal', border: 'border-tone-teal' },
  orange: { text: 'text-tone-orange', bg: 'bg-tone-orange-soft', dot: 'bg-tone-orange', border: 'border-tone-orange' },
  slate: { text: 'text-tone-slate', bg: 'bg-tone-slate-soft', dot: 'bg-tone-slate', border: 'border-tone-slate' },
};

/**
 * Tones by creation order (oldest first): the first eight categories never share a colour, and a
 * category keeps its colour when others are renamed or counts change. Unknown ids fall back to
 * categoryTone().
 */
export function categoryToneMap(categories: { id: string; createdAt: string }[]): Map<string, Tone> {
  const ordered = [...categories].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return new Map(ordered.map((c, i) => [c.id, TONES[i % TONES.length]]));
}
