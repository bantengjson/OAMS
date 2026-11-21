export interface ColumnDef {
  key: string;
  label: string;
  /** Always shown; cannot be switched off in the column menu. */
  required?: boolean;
}

const storageKey = (tableId: string) => `oams.columns.${tableId}`;

/** Visible columns for a table: the stored choice when valid, otherwise the defaults; required columns always on. */
export function loadColumnPrefs(tableId: string, columns: ColumnDef[], defaults: string[]): Set<string> {
  const known = new Set(columns.map((c) => c.key));
  let chosen: string[] = defaults;
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey(tableId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) chosen = parsed.filter((k): k is string => typeof k === 'string');
    }
  } catch {
    chosen = defaults;
  }
  const visible = new Set(chosen.filter((k) => known.has(k)));
  for (const c of columns) if (c.required) visible.add(c.key);
  return visible;
}

export function saveColumnPrefs(tableId: string, visible: Set<string>): void {
  try {
    localStorage.setItem(storageKey(tableId), JSON.stringify([...visible]));
  } catch {
    // Storage full or blocked: the choice simply lasts for this page view.
  }
}
