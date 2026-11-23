import { fetchBlob } from './client';

export type InventoryReportMode = 'per-room' | 'overall';

export const reportsApi = {
  /** The office "Daftar Inventaris" workbook (.xlsx). */
  inventory: (mode: InventoryReportMode) => fetchBlob('/reports/inventory', { mode }),
};
