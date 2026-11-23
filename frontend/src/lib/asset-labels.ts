import type { AcquisitionMethod, AssetCondition, AssetStatus, OwnershipType } from '@/types/api';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'muted';

export const STATUS_LABEL: Record<AssetStatus, string> = {
  AVAILABLE: 'Tersedia',
  IN_USE: 'Digunakan',
  STORED: 'Disimpan',
  BORROWED: 'Dipinjam',
  UNDER_MAINTENANCE: 'Dalam perbaikan',
  MISSING: 'Hilang',
  DISPOSED: 'Dihapuskan',
  RETURNED: 'Dikembalikan',
};

export const STATUS_VARIANT: Record<AssetStatus, BadgeVariant> = {
  AVAILABLE: 'success',
  IN_USE: 'default',
  STORED: 'muted',
  BORROWED: 'warning',
  UNDER_MAINTENANCE: 'warning',
  MISSING: 'destructive',
  DISPOSED: 'muted',
  RETURNED: 'outline',
};

export const CONDITION_LABEL: Record<AssetCondition, string> = {
  GOOD: 'Baik',
  NEEDS_REPAIR: 'Perlu Perbaikan',
  DAMAGED: 'Rusak',
};

export const CONDITION_VARIANT: Record<AssetCondition, BadgeVariant> = {
  GOOD: 'success',
  NEEDS_REPAIR: 'warning',
  DAMAGED: 'destructive',
};

export const OWNERSHIP_LABEL: Record<OwnershipType, string> = {
  OFFICE: 'Milik kantor',
  THIRD_PARTY: 'Milik pihak ketiga',
};

export const ACQUISITION_LABEL: Record<AcquisitionMethod, string> = {
  PURCHASE: 'Pembelian',
  GRANT: 'Hibah',
  LOAN: 'Pinjaman',
  OTHER: 'Lainnya',
};

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatRupiah(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? rupiah.format(n) : '-';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
