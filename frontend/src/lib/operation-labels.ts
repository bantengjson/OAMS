import type {
  AssignmentSource,
  BorrowerType,
  ConditionSource,
  DisposalReason,
  LoanState,
  MaintenanceStatus,
  Mutation,
  MutationStatus,
  OpnameResult,
  OpnameStatus,
} from '@/types/api';

import type { Tone } from './tones';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'muted';

export const MUTATION_STATUS_LABEL: Record<MutationStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

export const MUTATION_STATUS_VARIANT: Record<MutationStatus, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'muted',
};

export const LOAN_STATE_LABEL: Record<LoanState, string> = {
  active: 'Aktif',
  overdue: 'Terlambat',
  returned: 'Selesai',
  all: 'Semua',
};

export const BORROWER_TYPE_LABEL: Record<BorrowerType, string> = {
  EMPLOYEE: 'Karyawan',
  EXTERNAL: 'Bukan karyawan',
};

export const CONDITION_SOURCE_LABEL: Record<ConditionSource, string> = {
  CREATE: 'Pendaftaran',
  MANUAL: 'Pemeriksaan',
  LOAN_RETURN: 'Pengembalian pinjaman',
  OPNAME: 'Stock opname',
  MAINTENANCE: 'Selesai perbaikan',
};

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  REPORTED: 'Dilaporkan',
  IN_PROGRESS: 'Dikerjakan',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const MAINTENANCE_STATUS_VARIANT: Record<MaintenanceStatus, BadgeVariant> = {
  REPORTED: 'warning',
  IN_PROGRESS: 'default',
  COMPLETED: 'success',
  CANCELLED: 'muted',
};

export const DISPOSAL_REASON_LABEL: Record<DisposalReason, string> = {
  BROKEN: 'Rusak total',
  LOST: 'Hilang',
  SOLD: 'Dijual',
  DONATED: 'Dihibahkan',
  OTHER: 'Lainnya',
};

export const OPNAME_RESULT_LABEL: Record<OpnameResult, string> = {
  PENDING: 'Belum dipindai',
  MATCHED: 'Sesuai',
  CONDITION_DIFFERS: 'Kondisi berbeda',
  NOT_FOUND: 'Tidak ditemukan',
  UNREGISTERED: 'Tidak terdaftar',
  ON_LOAN: 'Sedang dipinjam',
  IN_MAINTENANCE: 'Dalam perbaikan',
  REMOVED: 'Tidak dihitung',
};

export const OPNAME_RESULT_VARIANT: Record<OpnameResult, BadgeVariant> = {
  PENDING: 'muted',
  MATCHED: 'success',
  CONDITION_DIFFERS: 'warning',
  NOT_FOUND: 'destructive',
  UNREGISTERED: 'outline',
  ON_LOAN: 'default',
  IN_MAINTENANCE: 'default',
  REMOVED: 'muted',
};

export const ASSIGNMENT_SOURCE_LABEL: Record<AssignmentSource, string> = {
  CREATE: 'Pendaftaran',
  MUTATION: 'Mutasi',
};

/** Human lines for a mutation's changes, e.g. `Lokasi: Ruang 201 → Ruang 305`. */
export function describeMutationChange(m: Pick<Mutation, 'fromLocation' | 'toLocation' | 'changesResponsible' | 'fromResponsibleEmployee' | 'toResponsibleEmployee'>): string[] {
  const lines: string[] = [];
  if (m.toLocation) lines.push(`Lokasi: ${m.fromLocation?.name ?? '-'} → ${m.toLocation.name}`);
  if (m.changesResponsible) {
    const from = m.fromResponsibleEmployee?.fullName ?? '(kosong)';
    const to = m.toResponsibleEmployee?.fullName ?? '(dilepas)';
    lines.push(`PJ: ${from} → ${to}`);
  }
  return lines;
}

export const OPNAME_STATUS_LABEL: Record<OpnameStatus, string> = {
  OPEN: 'Berjalan',
  CLOSED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const OPNAME_STATUS_VARIANT: Record<OpnameStatus, BadgeVariant> = {
  OPEN: 'default',
  CLOSED: 'success',
  CANCELLED: 'muted',
};

// Colours of the list status chips (see lib/tones.ts for the shared meaning of each tone).
export const MUTATION_STATUS_TONE: Record<MutationStatus, Tone> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'slate',
};

export const LOAN_STATE_TONE: Record<LoanState, Tone> = {
  active: 'blue',
  overdue: 'red',
  returned: 'green',
  all: 'slate',
};

export const MAINTENANCE_STATUS_TONE: Record<MaintenanceStatus, Tone> = {
  REPORTED: 'amber',
  IN_PROGRESS: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'slate',
};

export const DISPOSAL_REASON_TONE: Record<DisposalReason, Tone> = {
  BROKEN: 'red',
  LOST: 'orange',
  SOLD: 'green',
  DONATED: 'teal',
  OTHER: 'slate',
};
