export type InventoryTab = 'barang' | 'kelompok';

/** Which inventory tab the URL asks for (`?tab=kelompok`); the unit list otherwise. */
export function inventoryTab(params: URLSearchParams): InventoryTab {
  return params.get('tab') === 'kelompok' ? 'kelompok' : 'barang';
}

export interface GroupCounts {
  good: number;
  needsRepair: number;
  damaged: number;
}

/** Opname state of a group line: not counted yet, counted and equal to the record, or counted differently. */
export function groupLineState(line: { expected: GroupCounts; counted: GroupCounts | null }): 'pending' | 'match' | 'diff' {
  if (!line.counted) return 'pending';
  const { expected: e, counted: c } = line;
  return e.good === c.good && e.needsRepair === c.needsRepair && e.damaged === c.damaged ? 'match' : 'diff';
}
