import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AssetStatus, MaintenanceStatus, Prisma } from '../../generated/prisma/client.js';
import { FLOW_STATUSES } from './dto/create-asset.dto.js';

export const MSG_ASSET_NOT_FOUND = 'Barang tidak ditemukan.';
export const MSG_ARCHIVED = 'Barang sudah diarsipkan.';
export const MSG_DISPOSED = 'Barang sudah dilepas.';
export const MSG_BORROWED = 'Barang sedang dipinjam.';
export const MSG_IN_MAINTENANCE = 'Barang sedang diperbaiki.';
export const MSG_PENDING_MUTATION = 'Sudah ada mutasi yang menunggu persetujuan.';
export const MSG_STATUS_CHANGED = 'Barang sudah berubah, muat ulang lalu coba lagi.';

export type AssetBlocker = 'archived' | 'disposed' | 'borrowed' | 'inMaintenance' | 'pendingMutation';

export interface AssetState {
  id: string;
  status: AssetStatus;
  archivedAt: Date | null;
  activeLoanId: string | null;
  pendingMutationId: string | null;
  openMaintenance: { id: string; status: MaintenanceStatus } | null;
  activeDisposalId: string | null;
}

type Db = Prisma.TransactionClient | PrismaService;

/** Status to return to after a flow ends; never a status owned by another flow. */
export function restorableStatus(previous: AssetStatus | null | undefined): AssetStatus {
  if (!previous || FLOW_STATUSES.includes(previous)) return 'AVAILABLE';
  return previous;
}

/**
 * One place that knows which flows block each other (loan, mutation,
 * maintenance, disposal, archive) and that writes status changes only when
 * the status is still what the caller read, so concurrent flows cannot both win.
 */
@Injectable()
export class AssetStateGuard {
  constructor(private readonly prisma: PrismaService) {}

  async load(db: Db, assetId: string): Promise<AssetState> {
    const row = await db.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        loans: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
        mutations: { where: { status: 'PENDING' }, select: { id: true }, take: 1 },
        maintenance: {
          where: { status: { in: ['REPORTED', 'IN_PROGRESS'] } },
          select: { id: true, status: true },
          take: 1,
        },
        disposals: { where: { revertedAt: null }, select: { id: true }, take: 1 },
      },
    });
    if (!row) throw new NotFoundException(MSG_ASSET_NOT_FOUND);
    return {
      id: row.id,
      status: row.status,
      archivedAt: row.archivedAt,
      activeLoanId: row.loans[0]?.id ?? null,
      pendingMutationId: row.mutations[0]?.id ?? null,
      openMaintenance: row.maintenance[0] ?? null,
      activeDisposalId: row.disposals[0]?.id ?? null,
    };
  }

  /** Throws the first blocker in priority order, ignoring those in `allow`. */
  assertFree(state: AssetState, allow: readonly AssetBlocker[] = []): void {
    const blocked = (b: AssetBlocker) => !allow.includes(b);
    if (blocked('archived') && state.archivedAt) throw new ConflictException(MSG_ARCHIVED);
    if (blocked('disposed') && state.activeDisposalId) throw new ConflictException(MSG_DISPOSED);
    if (blocked('borrowed') && state.activeLoanId) throw new ConflictException(MSG_BORROWED);
    if (blocked('inMaintenance') && state.openMaintenance?.status === 'IN_PROGRESS') {
      throw new ConflictException(MSG_IN_MAINTENANCE);
    }
    if (blocked('pendingMutation') && state.pendingMutationId) throw new ConflictException(MSG_PENDING_MUTATION);
  }

  /**
   * Moves `from` → `to` only if the asset still has `from` (and, unless `allowArchived`,
   * is still not archived); 409 when another flow got there first. Postgres re-checks the
   * WHERE after waiting for a concurrent writer's row lock, so only one flow can win.
   */
  async setStatus(
    db: Db,
    assetId: string,
    from: AssetStatus,
    to: AssetStatus,
    opts: { allowArchived?: boolean } = {},
  ): Promise<void> {
    const where: Prisma.AssetWhereInput = { id: assetId, status: from };
    if (!opts.allowArchived) where.archivedAt = null;
    const updated = await db.asset.updateMany({ where, data: { status: to } });
    if (updated.count !== 1) throw new ConflictException(MSG_STATUS_CHANGED);
  }
}
