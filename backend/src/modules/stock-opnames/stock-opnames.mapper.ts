import { isoDateOnly } from '../../common/dates/jakarta.js';
import type { OpnameResult, Prisma } from '../../generated/prisma/client.js';
import type { OpnameItemDto, StockOpnameDto } from './dto/stock-opname.dto.js';

export const opnameInclude = {
  officers: { include: { user: { select: { id: true, fullName: true } } } },
  createdBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.StockOpnameInclude;

export type OpnameRow = Prisma.StockOpnameGetPayload<{ include: typeof opnameInclude }>;

export const itemInclude = {
  asset: { select: { id: true, assetCode: true, name: true, category: { select: { name: true } } } },
  scannedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.StockOpnameItemInclude;

export type ItemRow = Prisma.StockOpnameItemGetPayload<{ include: typeof itemInclude }>;

export const ALL_RESULTS: readonly OpnameResult[] = [
  'PENDING',
  'MATCHED',
  'CONDITION_DIFFERS',
  'NOT_FOUND',
  'UNREGISTERED',
  'ON_LOAN',
  'IN_MAINTENANCE',
  'REMOVED',
];

export function emptyCounts(): Record<OpnameResult, number> {
  return Object.fromEntries(ALL_RESULTS.map((r) => [r, 0])) as Record<OpnameResult, number>;
}

/** Items that must be found: everything except unregistered scans and rows removed mid-session. */
export function progress(counts: Record<OpnameResult, number>): { total: number; scanned: number } {
  const total = ALL_RESULTS.filter((r) => r !== 'UNREGISTERED' && r !== 'REMOVED').reduce((n, r) => n + counts[r], 0);
  return { total, scanned: counts.MATCHED + counts.CONDITION_DIFFERS };
}

export function toOpnameDto(row: OpnameRow, counts: Record<OpnameResult, number>): StockOpnameDto {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    status: row.status,
    plannedDate: isoDateOnly(row.plannedDate),
    officers: row.officers.map((o) => o.user),
    counts,
    ...progress(counts),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    closedBy: row.closedBy,
    closedAt: row.closedAt,
    cancelledAt: row.cancelledAt,
  };
}

export function toItemDto(row: ItemRow): OpnameItemDto {
  return {
    id: row.id,
    asset: row.asset,
    expectedCondition: row.expectedCondition,
    expectedStatus: row.expectedStatus,
    observedCondition: row.observedCondition,
    result: row.result,
    scannedAt: row.scannedAt,
    scannedBy: row.scannedBy,
    rawValue: row.rawValue,
    note: row.note,
    conditionAppliedAt: row.conditionAppliedAt,
  };
}
