import ExcelJS from 'exceljs';
import type { ReportSection } from './inventory-report.js';

const COLUMNS = [
  { header: 'NO.', width: 7 },
  { header: 'NAMA BARANG', width: 34 },
  { header: 'JUMLAH BARANG', width: 10 },
  { header: 'TAHUN PENGADAAN', width: 18 },
  { header: 'SPESIFIKASI', width: 34 },
  { header: 'Baik', width: 8 },
  { header: 'Perlu Perbaikan', width: 10 },
  { header: 'Rusak', width: 8 },
  { header: 'KETERANGAN', width: 12 },
  { header: 'SUMBER', width: 30 },
] as const;

const thin = { style: 'thin' as const };
const border = { top: thin, left: thin, bottom: thin, right: thin };

/** The office "Daftar Inventaris" sheet: title lines, then each section with its own header rows. */
export async function renderInventoryXlsx(sections: ReportSection[], opts: { officeName: string; year: number }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OAMS';
  const ws = wb.addWorksheet('Daftar Inventaris', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = COLUMNS.map((c) => ({ width: c.width }));

  const title = (text: string, row: number) => {
    ws.mergeCells(row, 1, row, COLUMNS.length);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font = { bold: true, size: 12 };
    cell.alignment = { horizontal: 'center' };
  };
  title('DAFTAR INVENTARIS BARANG', 1);
  title(opts.officeName.toUpperCase(), 2);
  title(`TAHUN ${opts.year}`, 3);

  let r = 5;
  const headerRows = () => {
    // Two header rows, like the office sheet: KONDISI BARANG spans Baik / Perlu Perbaikan / Rusak.
    const top = ['NO.', 'NAMA BARANG', 'JUMLAH BARANG', 'TAHUN PENGADAAN', 'SPESIFIKASI', 'KONDISI BARANG', '', '', 'KETERANGAN', 'SUMBER'];
    const bottom = ['', '', '', '', 'MERK/TYPE/WARNA', 'Baik', 'Perlu Perbaikan', 'Rusak', '', ''];
    ws.getRow(r).values = top;
    ws.getRow(r + 1).values = bottom;
    ws.mergeCells(r, 6, r, 8);
    for (const c of [1, 2, 3, 4, 9, 10]) ws.mergeCells(r, c, r + 1, c);
    for (const row of [r, r + 1]) {
      ws.getRow(row).eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = border;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E9EE' } };
      });
    }
    r += 2;
  };

  for (const section of sections) {
    const isRoom = section.title.startsWith('RUANG ');
    if (!isRoom) {
      ws.getCell(r, 1).value = section.title;
      ws.getCell(r, 1).font = { bold: true };
      r += 1;
      headerRows();
    } else {
      ws.mergeCells(r, 1, r, COLUMNS.length);
      ws.getCell(r, 1).value = section.title;
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 1).border = border;
      r += 1;
    }
    for (const row of section.rows) {
      ws.getRow(r).values = [
        row.no,
        row.name,
        row.qty,
        row.years,
        row.specs,
        row.good || null,
        row.needsRepair || null,
        row.damaged || null,
        row.keterangan,
        row.source,
      ];
      ws.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = border;
        cell.alignment = { vertical: 'top', wrapText: true, horizontal: [1, 3, 6, 7, 8, 9].includes(col) ? 'center' : 'left' };
      });
      r += 1;
    }
    r += isRoom ? 0 : 1;
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
