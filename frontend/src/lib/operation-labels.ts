import type { AssignmentSource, BorrowerType, ConditionSource, LoanState, Mutation, MutationStatus } from '@/types/api';

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
};

export const ASSIGNMENT_SOURCE_LABEL: Record<AssignmentSource, string> = {
  CREATE: 'Pendaftaran',
  MUTATION: 'Mutasi',
};

/** Human lines for a mutation's changes, e.g. `Lokasi: Ruang 201 → Ruang 305`. */
export function describeMutationChange(m: Pick<Mutation, 'fromLocation' | 'toLocation' | 'changesResponsible' | 'fromResponsibleEmployee' | 'toResponsibleEmployee'>): string[] {
  const lines: string[] = [];
  if (m.toLocation) lines.push(`Lokasi: ${m.fromLocation.name} → ${m.toLocation.name}`);
  if (m.changesResponsible) {
    const from = m.fromResponsibleEmployee?.fullName ?? '(kosong)';
    const to = m.toResponsibleEmployee?.fullName ?? '(dilepas)';
    lines.push(`PJ: ${from} → ${to}`);
  }
  return lines;
}
