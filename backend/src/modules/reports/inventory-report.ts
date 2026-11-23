/** One unit (asset) as the inventory report sees it. */
export interface ReportUnit {
  golongan: 'BG' | 'NG';
  typeNumber: number;
  typeName: string;
  roomCode: string | null;
  roomName: string | null;
  year: number | null;
  specification: string | null;
  condition: 'GOOD' | 'NEEDS_REPAIR' | 'DAMAGED';
  /** false = released ("Dilepas"), listed with Keterangan "Tidak Ada". */
  present: boolean;
  source: string | null;
}

/** One group item (counted goods) as the inventory report sees it. */
export interface ReportGroup {
  golongan: 'BG' | 'NG';
  typeNumber: number;
  typeName: string;
  roomCode: string;
  roomName: string;
  year: number | null;
  specification: string | null;
  source: string | null;
  good: number;
  needsRepair: number;
  damaged: number;
}

/** A row of the office "Daftar Inventaris" sheet. */
export interface ReportRow {
  no: string;
  name: string;
  qty: number;
  years: string;
  specs: string;
  good: number;
  needsRepair: number;
  damaged: number;
  keterangan: 'Ada' | 'Tidak Ada';
  source: string;
}

export interface ReportSection {
  title: string;
  rows: ReportRow[];
}

export type ReportMode = 'per-room' | 'overall';

export const SECTION_BG = 'A. INVENTARIS BARANG BERGERAK (KODE: BG)';
export const SECTION_NG = 'B. INVENTARIS BARANG TIDAK BERGERAK/TETAP (KODE: NG)';
export const roomTitle = (code: string, name: string) => `RUANG ${name.toUpperCase()} (KODE: ${code})`;

/** A tally that remembers first appearance, so ties keep the order the items were registered in. */
class Tally {
  private readonly counts = new Map<string, number>();
  add(value: string | null, n: number): void {
    if (value === null || value === '' || n <= 0) return;
    this.counts.set(value, (this.counts.get(value) ?? 0) + n);
  }
  /** `2025 (2), 2020 (2)`; a single value is written plainly. */
  format(): string {
    const entries = [...this.counts.entries()];
    if (entries.length === 0) return '';
    if (entries.length === 1) return entries[0][0];
    return entries
      .map(([value, count], index) => ({ value, count, index }))
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .map((e) => `${e.value} (${e.count})`)
      .join(', ');
  }
}

interface Bucket {
  no: number;
  name: string;
  present: boolean;
  years: Tally;
  specs: Tally;
  sources: Set<string>;
  good: number;
  needsRepair: number;
  damaged: number;
}

interface Entry {
  golongan: 'BG' | 'NG';
  typeNumber: number;
  typeName: string;
  roomCode: string | null;
  roomName: string | null;
  year: number | null;
  specification: string | null;
  source: string | null;
  present: boolean;
  good: number;
  needsRepair: number;
  damaged: number;
}

function toEntries(units: ReportUnit[], groups: ReportGroup[]): Entry[] {
  return [
    ...units.map((u) => ({
      ...u,
      good: u.condition === 'GOOD' ? 1 : 0,
      needsRepair: u.condition === 'NEEDS_REPAIR' ? 1 : 0,
      damaged: u.condition === 'DAMAGED' ? 1 : 0,
    })),
    ...groups.map((g) => ({ ...g, present: true })),
  ];
}

const sectionKey = (e: Entry, mode: ReportMode): string => {
  if (e.golongan === 'BG') return 'BG';
  if (mode === 'overall' || e.roomCode === null) return 'NG';
  return `ROOM:${e.roomCode}`;
};

const compareRoomCodes = (a: string, b: string) => a.length - b.length || a.localeCompare(b);

/**
 * Groups units and group items into the sections and rows of the office sheet: vehicles (BG), then
 * NG items without a room (land & building), then one section per room (per-room mode only).
 * One row per type and present/released state; mixed years and specifications are tallied.
 */
export function buildReportSections(units: ReportUnit[], groups: ReportGroup[], mode: ReportMode): ReportSection[] {
  const sections = new Map<string, { title: string; buckets: Map<string, Bucket> }>([
    ['BG', { title: SECTION_BG, buckets: new Map() }],
    ['NG', { title: SECTION_NG, buckets: new Map() }],
  ]);
  for (const e of toEntries(units, groups)) {
    const key = sectionKey(e, mode);
    if (!sections.has(key)) sections.set(key, { title: roomTitle(e.roomCode!, e.roomName ?? ''), buckets: new Map() });
    const buckets = sections.get(key)!.buckets;
    const bucketKey = `${e.typeNumber}|${e.present ? 1 : 0}`;
    let b = buckets.get(bucketKey);
    if (!b) {
      b = {
        no: e.typeNumber,
        name: e.typeName,
        present: e.present,
        years: new Tally(),
        specs: new Tally(),
        sources: new Set(),
        good: 0,
        needsRepair: 0,
        damaged: 0,
      };
      buckets.set(bucketKey, b);
    }
    const n = e.good + e.needsRepair + e.damaged;
    b.years.add(e.year === null ? null : String(e.year), n);
    b.specs.add(e.specification?.trim() || null, n);
    if (e.source?.trim()) b.sources.add(e.source.trim());
    b.good += e.good;
    b.needsRepair += e.needsRepair;
    b.damaged += e.damaged;
  }

  const roomKeys = [...sections.keys()]
    .filter((k) => k.startsWith('ROOM:'))
    .sort((a, b) => compareRoomCodes(a.slice(5), b.slice(5)));
  return ['BG', 'NG', ...roomKeys].map((key) => {
    const { title, buckets } = sections.get(key)!;
    const rows = [...buckets.values()]
      .sort((a, b) => a.no - b.no || Number(b.present) - Number(a.present))
      .map<ReportRow>((b) => ({
        no: String(b.no).padStart(3, '0'),
        name: b.name,
        qty: b.good + b.needsRepair + b.damaged,
        years: b.years.format(),
        specs: b.specs.format(),
        good: b.good,
        needsRepair: b.needsRepair,
        damaged: b.damaged,
        keterangan: b.present ? 'Ada' : 'Tidak Ada',
        source: [...b.sources].join('; '),
      }));
    return { title, rows };
  });
}
