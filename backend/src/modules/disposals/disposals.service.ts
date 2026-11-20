import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { isoDateOnly } from '../../common/dates/jakarta.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { isUniqueViolation } from '../../common/prisma/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetStateGuard, MSG_DISPOSED, restorableStatus } from '../assets/asset-state.guard.js';
import { toAssetDocument } from '../assets/assets.mapper.js';
import type { CreateDisposalDto, DisposalDto, DisposalQueryDto } from './dto/disposal.dto.js';

export const DISPOSAL_NOT_FOUND = 'Data pelepasan tidak ditemukan.';
export const DISPOSAL_REVERTED = 'Pelepasan sudah dibatalkan.';
const MODULE = 'disposals';
const ONE_ACTIVE_INDEX = 'asset_disposals_one_active';

const include = {
  asset: { select: { id: true, assetCode: true, name: true } },
  disposedBy: { select: { id: true, fullName: true } },
  revertedBy: { select: { id: true, fullName: true } },
  documents: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.AssetDisposalInclude;

type Row = Prisma.AssetDisposalGetPayload<{ include: typeof include }>;

function toDto(row: Row): DisposalDto {
  return {
    id: row.id,
    asset: row.asset,
    reason: row.reason,
    disposedAt: isoDateOnly(row.disposedAt),
    description: row.description,
    value: row.value ? row.value.toFixed(2) : null,
    recipient: row.recipient,
    previousStatus: row.previousStatus,
    labelWasActive: row.labelWasActive,
    disposedBy: row.disposedBy,
    createdAt: row.createdAt,
    revertedAt: row.revertedAt,
    revertedBy: row.revertedBy,
    revertReason: row.revertReason,
    documents: row.documents.map((d) => toAssetDocument(row.assetId, d)),
  };
}

@Injectable()
export class DisposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guard: AssetStateGuard,
  ) {}

  async list(q: DisposalQueryDto): Promise<Paginated<DisposalDto>> {
    const where: Prisma.AssetDisposalWhereInput = {};
    if (!q.includeReverted) where.revertedAt = null;
    if (q.reason) where.reason = q.reason;
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.OR = [{ recipient: contains }, { asset: { assetCode: contains } }, { asset: { name: contains } }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.assetDisposal.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(q),
      }),
      this.prisma.assetDisposal.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, q);
  }

  async get(id: string): Promise<DisposalDto> {
    return toDto(await this.getRow(id));
  }

  async create(dto: CreateDisposalDto, actor: AuthUser): Promise<DisposalDto> {
    let id: string;
    let cancelledReportId: string | null = null;
    try {
      ({ id, cancelledReportId } = await this.prisma.$transaction(async (tx) => {
        const state = await this.guard.load(tx, dto.assetId);
        this.guard.assertFree(state);
        const label = await tx.assetLabel.findUnique({ where: { assetId: dto.assetId }, select: { isActive: true } });
        const disposal = await tx.assetDisposal.create({
          data: {
            assetId: dto.assetId,
            reason: dto.reason,
            disposedAt: new Date(`${dto.disposedAt}T00:00:00Z`),
            description: dto.description,
            value: dto.value ?? null,
            recipient: dto.recipient ?? null,
            previousStatus: state.status,
            labelWasActive: label?.isActive ?? false,
            disposedById: actor.id,
          },
          select: { id: true },
        });
        await this.guard.setStatus(tx, dto.assetId, state.status, 'DISPOSED');
        if (label?.isActive) {
          await tx.assetLabel.update({ where: { assetId: dto.assetId }, data: { isActive: false, revokedAt: new Date() } });
        }
        // A damage report that never started is moot once the item leaves the inventory.
        let reportId: string | null = null;
        if (state.openMaintenance?.status === 'REPORTED') {
          reportId = state.openMaintenance.id;
          await tx.maintenanceRecord.update({
            where: { id: reportId },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Barang dilepas' },
          });
        }
        return { id: disposal.id, cancelledReportId: reportId };
      }));
    } catch (error) {
      if (isUniqueViolation(error, ONE_ACTIVE_INDEX)) throw new ConflictException(MSG_DISPOSED);
      throw error;
    }
    const row = await this.getRow(id);
    await this.audit.record({
      action: 'disposal.created',
      module: MODULE,
      entityId: dto.assetId,
      before: { assetStatus: row.previousStatus, qrActive: row.labelWasActive },
      after: {
        disposalId: id,
        reason: dto.reason,
        disposedAt: dto.disposedAt,
        value: dto.value ?? null,
        recipient: dto.recipient ?? null,
        assetStatus: 'DISPOSED',
      },
    });
    if (cancelledReportId) {
      await this.audit.record({
        action: 'maintenance.cancelled',
        module: 'maintenance',
        entityId: dto.assetId,
        after: { maintenanceId: cancelledReportId, reason: 'Barang dilepas' },
      });
    }
    return toDto(row);
  }

  async revert(id: string, reason: string, actor: AuthUser): Promise<DisposalDto> {
    const disposal = await this.getRow(id);
    if (disposal.revertedAt) throw new ConflictException(DISPOSAL_REVERTED);
    const restored = restorableStatus(disposal.previousStatus);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.assetDisposal.updateMany({
        where: { id, revertedAt: null },
        data: { revertedAt: new Date(), revertedById: actor.id, revertReason: reason },
      });
      if (claimed.count !== 1) throw new ConflictException(DISPOSAL_REVERTED);
      await this.guard.setStatus(tx, disposal.assetId, 'DISPOSED', restored, { allowArchived: true });
      // Only turn the sticker back on if it was on before; a lost or replaced sticker stays off.
      if (disposal.labelWasActive) {
        await tx.assetLabel.updateMany({ where: { assetId: disposal.assetId }, data: { isActive: true, revokedAt: null } });
      }
    });
    await this.audit.record({
      action: 'disposal.reverted',
      module: MODULE,
      entityId: disposal.assetId,
      before: { assetStatus: 'DISPOSED' },
      after: { disposalId: id, reason, assetStatus: restored, qrActive: disposal.labelWasActive },
    });
    return this.get(id);
  }

  private async getRow(id: string): Promise<Row> {
    const row = await this.prisma.assetDisposal.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException(DISPOSAL_NOT_FOUND);
    return row;
  }
}
