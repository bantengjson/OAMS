import type { Tone } from './tones';

export interface ChipDef<K extends string> {
  key: K;
  label: string;
  tone: Tone;
}

/** Chip definitions plus the counts loaded so far; a count still loading stays undefined. */
export function chipItems<K extends string>(
  defs: ChipDef<K>[],
  counts: Partial<Record<K, number>>,
): (ChipDef<K> & { count: number | undefined })[] {
  return defs.map((d) => ({ ...d, count: counts[d.key] }));
}
