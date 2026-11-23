import type { Condition, ImportCheck, ImportData, ImportPlan, ImportRow, PlannedGroup, PlannedUnit } from './types.js';

const YEAR_WITH_COUNT = /((?:19|20)\d{2})\s*\(\s*(\d+)\s*\)/g;
const YEAR = /\b(?:19|20)\d{2}\b/g;

/** Splits on commas that are not inside brackets. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** `n` copies of each value, in order. */
const expand = <T>(entries: [T, number][]): T[] => entries.flatMap(([v, n]) => Array.from({ length: n }, () => v));
const even = <T>(values: T[], qty: number): T[] | null =>
  qty % values.length === 0 ? expand(values.map((v) => [v, qty / values.length] as [T, number])) : null;

function parseQty(raw: ImportRow['qty']): { qty: number; problem: string | null } {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) return { qty: raw, problem: null };
  if (raw === null || raw === '' || raw === undefined) return { qty: 1, problem: 'Jumlah kosong; dicatat 1 unit.' };
  const lead = /^\s*(\d+)/.exec(String(raw));
  if (lead && Number(lead[1]) >= 1) return { qty: Number(lead[1]), problem: `Jumlah tertulis "${raw}"; dicatat ${lead[1]} unit.` };
  return { qty: 1, problem: `Jumlah tertulis "${raw}"; dicatat 1 unit.` };
}

/** Years for each unit; a word or an uneven split becomes TT (null). */
function parseYears(raw: ImportRow['years'], qty: number): { years: (number | null)[]; problem: string | null; word: string | null } {
  const tt = (problem: string | null, word: string | null = null) => ({ years: Array<number | null>(qty).fill(null), problem, word });
  if (raw === null || raw === undefined || raw === '') return tt(null);
  if (typeof raw === 'number') return { years: Array<number | null>(qty).fill(Math.trunc(raw)), problem: null, word: null };
  const text = String(raw).trim();
  const counted = [...text.matchAll(YEAR_WITH_COUNT)].map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
  if (counted.length > 0) {
    if (counted.reduce((s, [, n]) => s + n, 0) === qty) return { years: expand(counted), problem: null, word: null };
    return tt(`Tahun "${text}" tidak cocok dengan jumlah ${qty}; dicatat TT.`);
  }
  const plain = [...text.matchAll(YEAR)].map((m) => Number(m[0]));
  if (plain.length === 0) return tt(`Tahun tertulis "${text}"; dicatat TT.`, text);
  if (plain.length === 1) return { years: Array<number | null>(qty).fill(plain[0]), problem: null, word: null };
  const spread = even(plain, qty);
  return spread ? { years: spread, problem: null, word: null } : tt(`Tahun "${text}" tidak bisa dibagi ke ${qty} unit; dicatat TT.`);
}

/** Specification for each unit, following "Name (n)" counts or a plain list. */
function parseSpecs(raw: string | null, qty: number): { specs: (string | null)[]; problem: string | null } {
  const text = raw?.trim();
  if (!text || text === '-') return { specs: Array<string | null>(qty).fill(null), problem: null };
  const whole = (problem: string | null) => ({ specs: Array<string | null>(qty).fill(text), problem });
  const parts = splitTopLevel(text).map((p) => {
    const m = /^(.*?)\s*\(\s*(\d+|!)\s*\)$/.exec(p);
    return m ? { name: m[1].trim(), count: m[2] === '!' ? null : Number(m[2]), counted: true } : { name: p, count: null, counted: false };
  });
  if (!parts.some((p) => p.counted)) {
    if (parts.length === 1) return whole(null);
    const spread = even(
      parts.map((p) => p.name),
      qty,
    );
    return spread ? { specs: spread, problem: null } : whole(`Spesifikasi "${text}" tidak bisa dibagi ke ${qty} unit; dipakai utuh.`);
  }
  const known = parts.reduce((s, p) => s + (p.count ?? 0), 0);
  const unknown = parts.filter((p) => p.count === null);
  if (unknown.length === 0 && known === qty) return { specs: expand(parts.map((p) => [p.name, p.count!] as [string, number])), problem: null };
  if (unknown.length === 1 && known < qty) {
    return { specs: expand(parts.map((p) => [p.name, p.count ?? qty - known] as [string, number])), problem: null };
  }
  return whole(`Spesifikasi "${text}" tidak cocok dengan jumlah ${qty}; dipakai utuh.`);
}

function parseConditions(row: ImportRow, qty: number): { conditions: Condition[]; problem: string | null } {
  const good = row.good ?? 0;
  const repair = row.needsRepair ?? 0;
  const damaged = row.damaged ?? 0;
  const sum = good + repair + damaged;
  const allGood = Array<Condition>(qty).fill('GOOD');
  if (sum === qty) {
    return { conditions: [...Array<Condition>(good).fill('GOOD'), ...Array<Condition>(repair).fill('NEEDS_REPAIR'), ...Array<Condition>(damaged).fill('DAMAGED')], problem: null };
  }
  if (sum === 0) return { conditions: allGood, problem: 'Kondisi kosong; dicatat Baik.' };
  return { conditions: allGood, problem: `Kondisi (Baik ${good}, Perlu Perbaikan ${repair}, Rusak ${damaged}) tidak cocok dengan jumlah ${qty}; dicatat Baik.` };
}

function singleYear(raw: ImportRow['years']): { year: number | null; problem: string | null } {
  if (raw === null || raw === undefined || raw === '') return { year: null, problem: null };
  if (typeof raw === 'number') return { year: Math.trunc(raw), problem: null };
  const years = [...new Set([...String(raw).matchAll(YEAR)].map((m) => Number(m[0])))];
  return years.length === 1 ? { year: years[0], problem: null } : { year: null, problem: `Tahun "${raw}"; dicatat TT.` };
}

/**
 * Turns the merged office rows into units and group items, applying the owner's rules
 * (spec §8.9): odd quantities, mixed years/specifications, condition splits and released items.
 * Every guess is listed in `checks` for the owner to review before the import is written.
 */
export function planImport(data: ImportData): ImportPlan {
  const units: PlannedUnit[] = [];
  const groups: PlannedGroup[] = [];
  const checks: ImportCheck[] = [];
  const note = (origin: string, message: string | null) => {
    if (message) checks.push({ origin, message });
  };

  for (const row of data.rows) {
    const { qty, problem: qtyProblem } = parseQty(row.qty);
    note(row.origin, qtyProblem);
    const notes = row.notes.length > 0 ? row.notes.join('; ') : null;
    if (row.group) {
      const { year, problem } = singleYear(row.years);
      note(row.origin, problem);
      const good = row.good ?? 0;
      const repair = row.needsRepair ?? 0;
      const damaged = row.damaged ?? 0;
      const fits = good + repair + damaged === qty;
      if (!fits && good + repair + damaged > 0) note(row.origin, `Kondisi tidak cocok dengan jumlah ${qty}; dicatat Baik.`);
      groups.push({
        typeNumber: row.typeNumber,
        roomCode: row.roomCode ?? '',
        name: row.name,
        year,
        specification: row.specs?.trim() && row.specs.trim() !== '-' ? row.specs.trim() : null,
        source: row.source?.trim() || null,
        good: fits ? good : qty,
        needsRepair: fits ? repair : 0,
        damaged: fits ? damaged : 0,
        notes,
        origin: row.origin,
      });
      continue;
    }

    const disposed = row.keterangan?.trim().toLowerCase() === 'tidak ada';
    const years = parseYears(row.years, qty);
    note(row.origin, years.problem);
    const specs = parseSpecs(years.word && !row.specs?.trim() ? years.word : row.specs, qty);
    note(row.origin, specs.problem);
    const conditions = parseConditions(row, qty);
    if (!disposed) note(row.origin, conditions.problem);
    for (let i = 0; i < qty; i += 1) {
      units.push({
        golongan: 'NG',
        typeNumber: row.typeNumber,
        roomCode: row.roomCode,
        name: row.name,
        year: years.years[i],
        specification: specs.specs[i],
        serialNumber: null,
        source: row.source?.trim() || null,
        condition: conditions.conditions[i],
        disposed,
        notes,
        origin: row.origin,
      });
    }
  }

  for (const v of data.vehicles) {
    units.push({
      golongan: 'BG',
      typeNumber: v.typeNumber,
      roomCode: null,
      name: v.name,
      year: v.year,
      specification: v.specification,
      serialNumber: v.serialNumber,
      source: v.source,
      condition: 'GOOD',
      disposed: v.disposed,
      notes: v.oldPlates ? `Nomor polisi lama: ${v.oldPlates}` : null,
      origin: v.origin,
    });
    if (v.year === null) note(v.origin, 'Tahun kosong; dicatat TT.');
  }

  return { types: data.types, rooms: data.rooms, units, groups, checks };
}
