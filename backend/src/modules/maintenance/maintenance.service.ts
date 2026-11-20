import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { isUniqueViolation } from '../../common/prisma/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetConditionsService } from '../assets/asset-conditions.service.js';
import { AssetStateGuard, restorableStatus } from '../assets/asset-state.guard.js';
import { toAssetPhoto } from '../assets/assets.mapper.js';
import type {
  CompleteMaintenanceDto,
  MaintenanceDto,
  MaintenanceQueryDto,
  ReportMaintenanceDto,
  StartMaintenanceDto,
} from './dto/maintenance.dto.js';

export const MAINTENANCE_NOT_FOUND = 'Data pemeliharaan tidak ditemukan.';
export const MAINTENANCE_OPEN_EXISTS = 'Sudah ada laporan pemeliharaan yang terbuka untuk barang ini.';
export const MAINTENANCE_FINISHED = 'Pemeliharaan sudah selesai.';
export const MAINTENANCE_NOT_REPORTED = 'Pemeliharaan ini sudah dimulai atau ditutup.';
const MODULE = 'maintenance';
const ONE_OPEN_INDEX = 'maintenance_one_open';

const include = {
  asset: { select: { id: true, assetCode: true, name: true } },
  reportedBy: { select: { id: true, fullName: true } },
  startedBy: { select: { id: true, fullName: true } },
  completedBy: { select: { id: true, fullName: true } },
  photos: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.MaintenanceRecordInclude;

type Row = Prisma.MaintenanceRecordGetPayload<{ include: typeof include }>;

function toDto(row: Row): MaintenanceDto {
  return {
    id: row.id,
    status: row.status,
    asset: row.asset,
    description: row.description,
    reportedBy: row.reportedBy,
    reportedAt: row.reportedAt,
    technician: row.technician,
    startedAt: row.startedAt,
    startedBy: row.startedBy,
    completedAt: row.completedAt,
    completedBy: row.completedBy,
    cost: row.cost ? row.cost.toFixed(2) : null,
    technicianNotes: row.technicianNotes,
    resultCondition: row.resultCondition,
    previousStatus: row.previousStatus,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    photos: row.photos.map((p) => toAssetPhoto(row.assetId, p)),
  };
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guard: AssetStateGuard,
    private readonly conditions: AssetConditionsService,
  ) {}

  async list(q: MaintenanceQueryDto): Promise<Paginated<MaintenanceDto>> {
    const where: Prisma.MaintenanceRecordWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.assetId) where.assetId = q.assetId;
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.OR = [{ description: contains }, { asset: { assetCode: contains } }, { asset: { name: contains } }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where,
        include,
        orderBy: [{ reportedAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(q),
      }),
      this.prisma.maintenanceRecord.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, q);
  }

  async get(id: string): Promise<MaintenanceDto> {
    return toDto(await this.getRow(id));
  }

  async report(dto: ReportMaintenanceDto, actor: AuthUser): Promise<MaintenanceDto> {
    const state = await this.guard.load(this.prisma, dto.assetId);
    // Reporting damage is fine while lent out or awaiting a mutation; not on archived/disposed assets.
    this.guard.assertFree(state, ['borrowed', 'inMaintenance', 'pendingMutation']);
    let id: string;
    try {
      id = (
        await this.prisma.maintenanceRecord.create({
          data: { assetId: dto.assetId, description: dto.description, reportedById: actor.id },
          select: { id: true },
        })
      ).id;
    } catch (error) {
      if (isUniqueViolation(error, ONE_OPEN_INDEX)) throw new ConflictException(MAINTENANCE_OPEN_EXISTS);
      throw error;
    }
    await this.audit.record({
      action: 'maintenance.reported',
      module: MODULE,
      entityId: dto.assetId,
      after: { maintenanceId: id, description: dto.description },
    });
    return this.get(id);
  }

  async start(id: string, dto: StartMaintenanceDto, actor: AuthUser): Promise<MaintenanceDto> {
    const record = await this.getRow(id);
    if (record.status !== 'REPORTED') throw new ConflictException(MAINTENANCE_NOT_REPORTED);
    await this.prisma.$transaction(async (tx) => {
      const state = await this.guard.load(tx, record.assetId);
      this.guard.assertFree(state);
      const moved = await tx.maintenanceRecord.updateMany({
        where: { id, status: 'REPORTED' },
        data: {
          status: 'IN_PROGRESS',
          technician: dto.technician ?? null,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
          startedById: actor.id,
          previousStatus: state.status,
        },
      });
      if (moved.count !== 1) throw new ConflictException(MAINTENANCE_NOT_REPORTED);
      await this.guard.setStatus(tx, record.assetId, state.status, 'UNDER_MAINTENANCE');
    });
    const row = await this.getRow(id);
    await this.audit.record({
      action: 'maintenance.started',
      module: MODULE,
      entityId: record.assetId,
      before: { assetStatus: row.previousStatus },
      after: { maintenanceId: id, technician: row.technician, assetStatus: 'UNDER_MAINTENANCE' },
    });
    return toDto(row);
  }

  async complete(id: string, dto: CompleteMaintenanceDto, actor: AuthUser): Promise<MaintenanceDto> {
    const record = await this.getRow(id);
    if (record.status !== 'IN_PROGRESS') throw new ConflictException(MAINTENANCE_FINISHED);
    const restored = restorableStatus(record.previousStatus);
    const recorded = await this.prisma.$transaction(async (tx) => {
      const done = await tx.maintenanceRecord.updateMany({
        where: { id, status: 'IN_PROGRESS' },
        data: {
          status: 'COMPLETED',
          completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
          completedById: actor.id,
          cost: dto.cost ?? null,
          technicianNotes: dto.technicianNotes ?? null,
          resultCondition: dto.resultCondition ?? null,
        },
      });
      if (done.count !== 1) throw new ConflictException(MAINTENANCE_FINISHED);
      await this.guard.setStatus(tx, record.assetId, 'UNDER_MAINTENANCE', restored, { allowArchived: true });
      if (!dto.resultCondition) return null;
      return this.conditions.record(
        tx,
        record.assetId,
        {
          condition: dto.resultCondition,
          notes: dto.technicianNotes ? `Selesai perbaikan: ${dto.technicianNotes}` : 'Selesai perbaikan',
          source: 'MAINTENANCE',
        },
        actor,
      );
    });
    await this.audit.record({
      action: 'maintenance.completed',
      module: MODULE,
      entityId: record.assetId,
      before: { assetStatus: 'UNDER_MAINTENANCE' },
      after: { maintenanceId: id, cost: dto.cost ?? null, resultCondition: dto.resultCondition ?? null, assetStatus: restored },
    });
    if (recorded) {
      await this.audit.record({
        action: 'asset.condition_recorded',
        module: 'condition_logs',
        entityId: record.assetId,
        before: { condition: recorded.previousCondition },
        after: { condition: dto.resultCondition, conditionLogId: recorded.id, source: 'MAINTENANCE', maintenanceId: id },
      });
    }
    return this.get(id);
  }

  async cancel(id: string, reason: string, actor: AuthUser): Promise<MaintenanceDto> {
    void actor;
    const record = await this.getRow(id);
    if (record.status !== 'REPORTED' && record.status !== 'IN_PROGRESS') {
      throw new ConflictException(MAINTENANCE_FINISHED);
    }
    const wasInProgress = record.status === 'IN_PROGRESS';
    const restored = restorableStatus(record.previousStatus);
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.maintenanceRecord.updateMany({
        where: { id, status: record.status },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      if (done.count !== 1) throw new ConflictException(MAINTENANCE_FINISHED);
      if (wasInProgress) {
        await this.guard.setStatus(tx, record.assetId, 'UNDER_MAINTENANCE', restored, { allowArchived: true });
      }
    });
    await this.audit.record({
      action: 'maintenance.cancelled',
      module: MODULE,
      entityId: record.assetId,
      before: { status: record.status },
      after: { maintenanceId: id, reason, assetStatus: wasInProgress ? restored : undefined },
    });
    return this.get(id);
  }

  private async getRow(id: string): Promise<Row> {
    const row = await this.prisma.maintenanceRecord.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException(MAINTENANCE_NOT_FOUND);
    return row;
  }
}
