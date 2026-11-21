import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { FORBIDDEN_MESSAGE } from '../../common/auth/permissions.guard.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { isSerializationFailure, isUniqueViolation } from '../../common/prisma/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetStateGuard } from '../assets/asset-state.guard.js';
import { ASSET_NOT_FOUND, AssetsService } from '../assets/assets.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import type { CreateMutationDto } from './dto/create-mutation.dto.js';
import type { MutationQueryDto } from './dto/mutation-query.dto.js';
import type { MutationDto } from './dto/mutation.dto.js';
import { mutationInclude, mutationSnapshot, toMutationDto } from './mutations.mapper.js';
import type { MutationRow } from './mutations.mapper.js';

export const MUTATION_NOT_FOUND = 'Mutasi tidak ditemukan.';
export const MUTATION_PENDING_EXISTS = 'Sudah ada mutasi yang menunggu persetujuan.';
export const MUTATION_NO_CHANGE = 'Tidak ada perubahan yang diajukan.';
export const MUTATION_ALREADY_DECIDED = 'Mutasi sudah diproses.';
export const MUTATION_ASSET_MOVED = 'Barang sudah berpindah.';
export const LOCATION_INACTIVE = 'Lokasi tujuan tidak aktif.';
export const ASSET_ARCHIVED_CONFLICT = 'Barang sudah diarsipkan.';
const MODULE = 'mutations';
const ONE_PENDING_INDEX = 'asset_mutations_one_pending';

type Tx = Prisma.TransactionClient;

interface AssetState {
  id: string;
  locationId: string | null;
  responsibleEmployeeId: string | null;
  archivedAt: Date | null;
}

@Injectable()
export class MutationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly assets: AssetsService,
    private readonly employees: EmployeesService,
    private readonly guard: AssetStateGuard,
  ) {}

  async list(q: MutationQueryDto): Promise<Paginated<MutationDto>> {
    const where: Prisma.AssetMutationWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.assetId) where.assetId = q.assetId;
    if (q.requestedById) where.requestedById = q.requestedById;
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.asset = { OR: [{ assetCode: contains }, { name: contains }] };
    }
    const [rows, total, paths] = await Promise.all([
      this.prisma.assetMutation.findMany({
        where,
        include: mutationInclude,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(q),
      }),
      this.prisma.assetMutation.count({ where }),
      this.assets.pathIndex(),
    ]);
    return paginate(
      rows.map((r) => toMutationDto(r, paths)),
      total,
      q,
    );
  }

  async get(id: string): Promise<MutationDto> {
    const row = await this.getRow(id);
    return toMutationDto(row, await this.assets.pathIndex());
  }

  /** Petugas files a request; an approver's own request is applied in the same transaction. */
  async request(dto: CreateMutationDto, actor: AuthUser): Promise<MutationDto> {
    const changesResponsible = dto.changesResponsible === true;
    const toLocationId = dto.toLocationId ?? null;
    const toResponsibleEmployeeId = changesResponsible ? (dto.toResponsibleEmployeeId ?? null) : null;
    const autoApprove = actor.permissions.includes(PERMISSIONS.MUTATIONS_APPROVE);

    const asset = await this.assetState(this.prisma, dto.assetId);
    this.guard.assertFree(await this.guard.load(this.prisma, dto.assetId), ['pendingMutation']);
    if (await this.prisma.assetMutation.findFirst({ where: { assetId: asset.id, status: 'PENDING' }, select: { id: true } })) {
      throw new ConflictException(MUTATION_PENDING_EXISTS);
    }
    const locationChanges = toLocationId !== null && toLocationId !== asset.locationId;
    const responsibleChanges = changesResponsible && toResponsibleEmployeeId !== asset.responsibleEmployeeId;
    if (!locationChanges && !responsibleChanges) throw new ConflictException(MUTATION_NO_CHANGE);
    if (locationChanges) {
      const loc = await this.prisma.location.findUnique({ where: { id: toLocationId }, select: { isActive: true } });
      if (!loc) throw new NotFoundException('Lokasi tujuan tidak ditemukan.');
      if (!loc.isActive) throw new ConflictException(LOCATION_INACTIVE);
    }
    if (responsibleChanges && toResponsibleEmployeeId) {
      await this.employees.assertActive(this.prisma, toResponsibleEmployeeId);
    }

    const data: Prisma.AssetMutationUncheckedCreateInput = {
      assetId: asset.id,
      fromLocationId: asset.locationId,
      toLocationId: locationChanges ? toLocationId : null,
      changesResponsible: responsibleChanges,
      fromResponsibleEmployeeId: asset.responsibleEmployeeId,
      toResponsibleEmployeeId: responsibleChanges ? toResponsibleEmployeeId : null,
      reason: dto.reason,
      requestedById: actor.id,
    };

    let id: string;
    try {
      id = await this.withSerializableRetry(async (tx) => {
        // A pending request changes no asset column, so an archive racing it would not notice;
        // archive takes the same row lock, and the state is re-read under it.
        await this.guard.lock(tx, asset.id);
        this.guard.assertFree(await this.guard.load(tx, asset.id), ['pendingMutation']);
        const created = await tx.assetMutation.create({ data, include: mutationInclude });
        if (autoApprove) await this.applyApproval(tx, created, actor, null);
        return created.id;
      });
    } catch (error) {
      if (isUniqueViolation(error, ONE_PENDING_INDEX)) throw new ConflictException(MUTATION_PENDING_EXISTS);
      throw error;
    }

    const row = await this.getRow(id);
    await this.audit.record({
      action: 'mutation.requested',
      module: MODULE,
      entityId: asset.id,
      after: mutationSnapshot(row),
    });
    if (autoApprove) {
      await this.audit.record({
        action: 'mutation.approved',
        module: MODULE,
        entityId: asset.id,
        after: mutationSnapshot(row),
      });
      if (row.changesResponsible) await this.auditAssignment(row);
    }
    return toMutationDto(row, await this.assets.pathIndex());
  }

  async approve(id: string, note: string | undefined, actor: AuthUser): Promise<MutationDto> {
    const pending = await this.getPending(id);
    await this.withSerializableRetry((tx) => this.applyApproval(tx, pending, actor, note ?? null));
    const row = await this.getRow(id);
    await this.audit.record({
      action: 'mutation.approved',
      module: MODULE,
      entityId: row.assetId,
      before: { status: 'PENDING' },
      after: mutationSnapshot(row),
    });
    if (row.changesResponsible) await this.auditAssignment(row);
    return toMutationDto(row, await this.assets.pathIndex());
  }

  async reject(id: string, note: string, actor: AuthUser): Promise<MutationDto> {
    const pending = await this.getPending(id);
    const updated = await this.prisma.assetMutation.updateMany({
      where: { id: pending.id, status: 'PENDING' },
      data: { status: 'REJECTED', decidedById: actor.id, decidedAt: new Date(), decisionNote: note },
    });
    if (updated.count !== 1) throw new ConflictException(MUTATION_ALREADY_DECIDED);
    const row = await this.getRow(id);
    await this.audit.record({
      action: 'mutation.rejected',
      module: MODULE,
      entityId: row.assetId,
      before: { status: 'PENDING' },
      after: mutationSnapshot(row),
    });
    return toMutationDto(row, await this.assets.pathIndex());
  }

  async cancel(id: string, actor: AuthUser): Promise<MutationDto> {
    const pending = await this.getPending(id);
    const mayCancel = pending.requestedById === actor.id || actor.permissions.includes(PERMISSIONS.MUTATIONS_APPROVE);
    if (!mayCancel) throw new ForbiddenException(FORBIDDEN_MESSAGE);
    const updated = await this.prisma.assetMutation.updateMany({
      where: { id: pending.id, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (updated.count !== 1) throw new ConflictException(MUTATION_ALREADY_DECIDED);
    const row = await this.getRow(id);
    await this.audit.record({
      action: 'mutation.cancelled',
      module: MODULE,
      entityId: row.assetId,
      before: { status: 'PENDING' },
      after: mutationSnapshot(row),
    });
    return toMutationDto(row, await this.assets.pathIndex());
  }

  // ---------------------------------------------------------------- internals

  /**
   * Moves the asset exactly as the frozen request describes. Runs inside the
   * caller's Serializable transaction; every precondition is re-checked there.
   */
  private async applyApproval(tx: Tx, mutation: MutationRow, actor: AuthUser, note: string | null): Promise<void> {
    const asset = await this.assetState(tx, mutation.assetId);
    const state = await this.guard.load(tx, mutation.assetId);
    this.guard.assertFree(state, ['pendingMutation']);
    const moved =
      asset.locationId !== mutation.fromLocationId ||
      (mutation.changesResponsible && asset.responsibleEmployeeId !== mutation.fromResponsibleEmployeeId);
    if (moved) throw new ConflictException(MUTATION_ASSET_MOVED);
    // Targets may have gone inactive while the request waited.
    if (mutation.toLocationId) {
      const loc = await tx.location.findUnique({ where: { id: mutation.toLocationId }, select: { isActive: true } });
      if (!loc?.isActive) throw new ConflictException(LOCATION_INACTIVE);
    }
    if (mutation.changesResponsible && mutation.toResponsibleEmployeeId) {
      await this.employees.assertActive(tx, mutation.toResponsibleEmployeeId);
    }

    const data: Prisma.AssetUncheckedUpdateManyInput = {};
    if (mutation.toLocationId) data.locationId = mutation.toLocationId;
    if (mutation.changesResponsible) data.responsibleEmployeeId = mutation.toResponsibleEmployeeId;
    const updated = await tx.asset.updateMany({
      // Same status as read: a loan, repair or disposal that won the race makes this 0 rows.
      where: { id: asset.id, archivedAt: null, locationId: mutation.fromLocationId, status: state.status },
      data,
    });
    if (updated.count !== 1) throw new ConflictException(MUTATION_ASSET_MOVED);

    if (mutation.changesResponsible) {
      await tx.assetAssignment.create({
        data: {
          assetId: asset.id,
          fromEmployeeId: mutation.fromResponsibleEmployeeId,
          toEmployeeId: mutation.toResponsibleEmployeeId,
          source: 'MUTATION',
          mutationId: mutation.id,
          note: mutation.reason,
          changedById: actor.id,
        },
      });
    }
    const decided = await tx.assetMutation.updateMany({
      where: { id: mutation.id, status: 'PENDING' },
      data: { status: 'APPROVED', decidedById: actor.id, decidedAt: new Date(), decisionNote: note },
    });
    if (decided.count !== 1) throw new ConflictException(MUTATION_ALREADY_DECIDED);
  }

  private async withSerializableRetry<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
      try {
        return await this.prisma.$transaction(fn, { isolationLevel: 'Serializable' });
      } catch (again) {
        if (isSerializationFailure(again)) throw new ConflictException(MUTATION_PENDING_EXISTS);
        throw again;
      }
    }
  }

  private async assetState(db: Tx | PrismaService, id: string): Promise<AssetState> {
    const row = await db.asset.findUnique({
      where: { id },
      select: {
        id: true,
        locationId: true,
        responsibleEmployeeId: true,
        archivedAt: true,
      },
    });
    if (!row) throw new NotFoundException(ASSET_NOT_FOUND);
    return row;
  }


  private async auditAssignment(row: MutationRow): Promise<void> {
    await this.audit.record({
      action: 'asset.assigned',
      module: 'assignments',
      entityId: row.assetId,
      before: { responsibleEmployeeId: row.fromResponsibleEmployeeId },
      after: { responsibleEmployeeId: row.toResponsibleEmployeeId, mutationId: row.id },
    });
  }

  private async getRow(id: string): Promise<MutationRow> {
    const row = await this.prisma.assetMutation.findUnique({ where: { id }, include: mutationInclude });
    if (!row) throw new NotFoundException(MUTATION_NOT_FOUND);
    return row;
  }

  private async getPending(id: string): Promise<MutationRow> {
    const row = await this.getRow(id);
    if (row.status !== 'PENDING') throw new ConflictException(MUTATION_ALREADY_DECIDED);
    return row;
  }
}
