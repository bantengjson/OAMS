import ExcelJS from 'exceljs';
import { assignCodes } from './apply.js';
import type { ImportPlan } from './types.js';

const CONDITION = { GOOD: 'Baik', NEEDS_REPAIR: 'Perlu Perbaikan', DAMAGED: 'Rusak' } as const;

/** The preview the owner checks before anything is written: every unit with its code, groups, and the check list. */
export async function writePreview(plan: ImportPlan, org: string, path: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const codes = assignCodes(plan.units, org);
  const typeName = new Map(plan.types.map((t) => [`${t.golongan}-${t.number}`, t.name]));

  const summary = wb.addWorksheet('Ringkasan');
  summary.columns = [{ width: 52 }, { width: 14 }];
  const unitsPerRoom = new Map<string, number>();
  for (const u of plan.units) unitsPerRoom.set(u.roomCode ?? '-', (unitsPerRoom.get(u.roomCode ?? '-') ?? 0) + 1);
  summary.addRows([
    ['Pratinjau impor data kantor (belum ada yang ditulis)', null],
    [null, null],
    ['Jenis barang', plan.types.length],
    ['Ruangan', plan.rooms.length],
    ['Barang (unit, ber-QR)', plan.units.length],
    ['  di antaranya dicatat Dilepas', plan.units.filter((u) => u.disposed).length],
    ['Barang kelompok (baris)', plan.groups.length],
    ['Barang kelompok (unit)', plan.groups.reduce((s, g) => s + g.good + g.needsRepair + g.damaged, 0)],
    ['Daftar periksa', plan.checks.length],
    [null, null],
    ['Unit per ruangan', null],
    ...[...unitsPerRoom].sort(([a], [b]) => a.localeCompare(b)).map(([room, n]) => [`  ${room}`, n]),
  ]);
  summary.getCell('A1').font = { bold: true, size: 13 };

  const units = wb.addWorksheet('Barang');
  units.columns = [
    { header: 'Kode', width: 24 },
    { header: 'Jenis', width: 28 },
    { header: 'Nama', width: 30 },
    { header: 'Ruang', width: 7 },
    { header: 'Tahun', width: 7 },
    { header: 'Spesifikasi', width: 30 },
    { header: 'Kondisi', width: 15 },
    { header: 'Keterangan', width: 11 },
    { header: 'Sumber', width: 26 },
    { header: 'No. seri/polisi', width: 16 },
    { header: 'Catatan', width: 30 },
    { header: 'Asal baris', width: 30 },
  ];
  plan.units.forEach((u, i) =>
    units.addRow([
      codes[i],
      `${u.golongan} ${String(u.typeNumber).padStart(3, '0')} · ${typeName.get(`${u.golongan}-${u.typeNumber}`) ?? '?'}`,
      u.name,
      u.roomCode ?? '-',
      u.year ?? 'TT',
      u.specification ?? '',
      CONDITION[u.condition],
      u.disposed ? 'Tidak Ada (Dilepas)' : 'Ada',
      u.source ?? '',
      u.serialNumber ?? '',
      u.notes ?? '',
      u.origin,
    ]),
  );

  const groups = wb.addWorksheet('Barang Kelompok');
  groups.columns = [
    { header: 'Jenis', width: 28 },
    { header: 'Nama', width: 26 },
    { header: 'Ruang', width: 7 },
    { header: 'Tahun', width: 7 },
    { header: 'Baik', width: 7 },
    { header: 'Perlu Perbaikan', width: 9 },
    { header: 'Rusak', width: 7 },
    { header: 'Asal baris', width: 30 },
  ];
  for (const g of plan.groups) {
    groups.addRow([
      `NG ${String(g.typeNumber).padStart(3, '0')} · ${typeName.get(`NG-${g.typeNumber}`) ?? '?'}`,
      g.name,
      g.roomCode,
      g.year ?? 'TT',
      g.good,
      g.needsRepair,
      g.damaged,
      g.origin,
    ]);
  }

  const checks = wb.addWorksheet('Daftar Periksa');
  checks.columns = [
    { header: 'Asal baris', width: 40 },
    { header: 'Yang dilakukan impor', width: 90 },
  ];
  for (const c of plan.checks) checks.addRow([c.origin, c.message]);

  for (const ws of [units, groups, checks]) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  await wb.xlsx.writeFile(path);
}
