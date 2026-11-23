/**
 * The office import's input, written by the (git-ignored) merge tool from the office workbook.
 * Values are kept as the sheet wrote them; `planImport` interprets them.
 */
export interface ImportData {
  types: { golongan: 'BG' | 'NG'; number: number; name: string; isGroup: boolean }[];
  rooms: { code: string; name: string }[];
  rows: ImportRow[];
  vehicles: VehicleRow[];
}

export interface ImportRow {
  golongan: 'NG';
  typeNumber: number;
  /** null only for land & building (NG 001). */
  roomCode: string | null;
  name: string;
  /** As written: 6, "1 set", "`" or empty. */
  qty: number | string | null;
  /** As written: 2023, "2025 (2), 2020 (2)", "2023/2025", "Nagata" or empty. */
  years: number | string | null;
  /** Merk/Type/Warna as written, e.g. "LG Dell (2), Lenovo (2)". */
  specs: string | null;
  good: number | null;
  needsRepair: number | null;
  damaged: number | null;
  /** "KET." of the sheet: the donor; empty = bought. */
  source: string | null;
  /** "Ada" / "Tidak Ada". */
  keterangan: string | null;
  /** Counted goods (kitchenware): one group item instead of units. */
  group: boolean;
  notes: string[];
  /** Where the row came from, e.g. "INVENTARIS PER RUANGAN baris 31". */
  origin: string;
}

export interface VehicleRow {
  typeNumber: number;
  name: string;
  year: number | null;
  specification: string | null;
  /** Current plate. */
  serialNumber: string | null;
  oldPlates: string | null;
  source: string | null;
  disposed: boolean;
  origin: string;
}

export type Condition = 'GOOD' | 'NEEDS_REPAIR' | 'DAMAGED';

export interface PlannedUnit {
  golongan: 'BG' | 'NG';
  typeNumber: number;
  roomCode: string | null;
  name: string;
  year: number | null;
  specification: string | null;
  serialNumber: string | null;
  source: string | null;
  condition: Condition;
  disposed: boolean;
  notes: string | null;
  origin: string;
}

export interface PlannedGroup {
  typeNumber: number;
  roomCode: string;
  name: string;
  year: number | null;
  specification: string | null;
  source: string | null;
  good: number;
  needsRepair: number;
  damaged: number;
  notes: string | null;
  origin: string;
}

export interface ImportCheck {
  origin: string;
  message: string;
}

export interface ImportPlan {
  types: ImportData['types'];
  rooms: ImportData['rooms'];
  units: PlannedUnit[];
  groups: PlannedGroup[];
  checks: ImportCheck[];
}
