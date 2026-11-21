/** One sticker on the print sheet; several entries may share an asset (copies). */
export interface SheetEntry {
  key: string;
  assetId: string;
}

let counter = 0;
const newKey = (assetId: string) => `${assetId}#${++counter}`;

/** The sheet follows the selection: entries of unticked items go, newly ticked items join once at the end. */
export function syncSheet(entries: SheetEntry[], selectedIds: readonly string[]): SheetEntry[] {
  const selected = new Set(selectedIds);
  const kept = entries.filter((e) => selected.has(e.assetId));
  const present = new Set(kept.map((e) => e.assetId));
  const added = selectedIds.filter((id) => !present.has(id)).map((id) => ({ key: newKey(id), assetId: id }));
  return [...kept, ...added];
}

/** One more copy of a sticker, placed right after it. */
export function duplicateEntry(entries: SheetEntry[], key: string): SheetEntry[] {
  const i = entries.findIndex((e) => e.key === key);
  if (i < 0) return entries;
  return [...entries.slice(0, i + 1), { key: newKey(entries[i].assetId), assetId: entries[i].assetId }, ...entries.slice(i + 1)];
}

/** Removes one sticker; `lastOf` names the item when no copy of it is left (so its tick can go too). */
export function removeEntry(entries: SheetEntry[], key: string): { entries: SheetEntry[]; lastOf: string | null } {
  const target = entries.find((e) => e.key === key);
  if (!target) return { entries, lastOf: null };
  const rest = entries.filter((e) => e.key !== key);
  return { entries: rest, lastOf: rest.some((e) => e.assetId === target.assetId) ? null : target.assetId };
}

export function copiesByAsset(entries: SheetEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.assetId] = (counts[e.assetId] ?? 0) + 1;
  return counts;
}
