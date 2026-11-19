import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { jakartaToday } from '../../common/dates/jakarta.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AssetCondition, ConditionSource, Prisma } from '../../generated/prisma/client.js';
import { toAssetPhoto } from './assets.mapper.js';
import type { AssignmentDto } from './dto/assignment.dto.js';
import type { ConditionLogDto } from './dto/condition-log.dto.js';
import type { CreateConditionLogDto } from './dto/create-condition-log.dto.js';

export const ASSET_NOT_FOUND = 'Barang tidak ditemukan.';
export const ASSET_ARCHIVED_CONFLICT = 'Barang sudah diarsipkan.';
const MODULE = 'condition_logs';

/** A Prisma client or an open transaction: the caller decides the boundary. */
export type Db = Prisma.TransactionClient | PrismaService;

export interface ConditionRecordInput {
  condition: AssetCondition;
  notes?: string | null;
  /** `YYYY-MM-DD`; defaults to today in Asia/Jakarta. */
  checkedAt?: string | null;
  source: ConditionSource;
  loanId?: string | null;
}

const logInclude = {
  checkedBy: { select: { id: true, fullName: true } },
  photos: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.AssetConditionLogInclude;

type LogRow = Prisma.AssetConditionLogGetPayload<{ include: typeof logInclude }>;

const assignmentInclude = {
  fromEmployee: { select: { id: true, fullName: true } },
  toEmployee: { select: { id: true, fullName: true } },
  changedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AssetAssignmentInclude;

type AssignmentRow = Prisma.AssetAssignmentGetPayload<{ include: typeof assignmentInclude }>;

function toLogDto(assetId: string, row: LogRow): ConditionLogDto {
  return {
    id: row.id,
    condition: row.condition,
    previousCondition: row.previousCondition,
    notes: row.notes,
    checkedAt: row.checkedAt.toISOString().slice(0, 10),
    source: row.source,
    loanId: row.loanId,
    checkedBy: row.checkedBy,
    photos: row.photos.map((p) => toAssetPhoto(assetId, p)),
    createdAt: row.createdAt,
  };
}

function toAssignmentDto(row: AssignmentRow): AssignmentDto {
  return {
    id: row.id,
    fromEmployee: row.fromEmployee,
    toEmployee: row.toEmployee,
    source: row.source,
    mutationId: row.mutationId,
    note: row.note,
    changedBy: row.changedBy,
    createdAt: row.createdAt,
  };
}

/**
 * Condition checks and responsible-person history of an asset. `record()` is
 * the single writer for `asset_condition_logs` + `assets.condition`, so the
 * loan-return flow and the manual check share one code path.
 */
@Injectable()
export class AssetConditionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listLogs(assetId: string, q: PaginationQueryDto): Promise<Paginated<ConditionLogDto>> {
    await this.assertAsset(assetId);
    const where = { assetId };
    const [rows, total] = await Promise.all([
      this.prisma.assetConditionLog.findMany({
        where,
        include: logInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(q),
      }),
      this.prisma.assetConditionLog.count({ where }),
    ]);
    return paginate(
      rows.map((r) => toLogDto(assetId, r)),
      total,
      q,
    );
  }

  async listAssignments(assetId: string, q: PaginationQueryDto): Promise<Paginated<AssignmentDto>> {
    await this.assertAsset(assetId);
    const where = { assetId };
    const [rows, total] = await Promise.all([
      this.prisma.assetAssignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(q),
      }),
      this.prisma.assetAssignment.count({ where }),
    ]);
    return paginate(rows.map(toAssignmentDto), total, q);
  }

  /** Manual check from the UI: own transaction, audited. */
  async create(assetId: string, dto: CreateConditionLogDto, actor: AuthUser): Promise<ConditionLogDto> {
    const asset = await this.assertAsset(assetId);
    if (asset.archivedAt) throw new ConflictException(ASSET_ARCHIVED_CONFLICT);
    const input: ConditionRecordInput = {
      condition: dto.condition,
      notes: dto.notes,
      checkedAt: dto.checkedAt,
      source: 'MANUAL',
    };
    const { id, previousCondition } = await this.prisma.$transaction((tx) => this.record(tx, assetId, input, actor));
    await this.audit.record({
      action: 'asset.condition_recorded',
      module: MODULE,
      entityId: assetId,
      before: { condition: previousCondition },
      after: { condition: dto.condition, conditionLogId: id, source: 'MANUAL', notes: dto.notes ?? null },
    });
    const row = await this.prisma.assetConditionLog.findUniqueOrThrow({ where: { id }, include: logInclude });
    return toLogDto(assetId, row);
  }

  /**
   * Writes one log row and moves `assets.condition` inside the caller's
   * transaction. The caller audits after commit.
   */
  async record(
    tx: Db,
    assetId: string,
    input: ConditionRecordInput,
    actor: AuthUser,
  ): Promise<{ id: string; previousCondition: AssetCondition | null }> {
    const asset = await tx.asset.findUnique({ where: { id: assetId }, select: { condition: true } });
    if (!asset) throw new NotFoundException(ASSET_NOT_FOUND);
    const previousCondition = input.source === 'CREATE' ? null : asset.condition;
    const checkedAt = new Date(`${input.checkedAt ?? jakartaToday()}T00:00:00Z`);
    const row = await tx.assetConditionLog.create({
      data: {
        assetId,
        condition: input.condition,
        previousCondition,
        notes: input.notes ?? null,
        checkedAt,
        source: input.source,
        loanId: input.loanId ?? null,
        checkedById: actor.id,
      },
      select: { id: true },
    });
    if (asset.condition !== input.condition) {
      await tx.asset.update({ where: { id: assetId }, data: { condition: input.condition } });
    }
    return { id: row.id, previousCondition };
  }

  private async assertAsset(assetId: string): Promise<{ archivedAt: Date | null }> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, select: { archivedAt: true } });
    if (!asset) throw new NotFoundException(ASSET_NOT_FOUND);
    return asset;
  }
}
