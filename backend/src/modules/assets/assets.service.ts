import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuditEntryPublicDto } from '../../common/audit/audit.types.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { jakartaToday } from '../../common/dates/jakarta.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { SettingsService } from '../../common/settings/settings.service.js';
import { AssetCondition, AssetStatus } from '../../generated/prisma/client.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { EmployeesService } from '../employees/employees.service.js';
import { generatePublicToken } from '../qr/qr-token.js';
import { AssetCodeService } from './asset-code.js';
import { AssetConditionsService } from './asset-conditions.service.js';
import { AssetStateGuard, MSG_IN_MAINTENANCE, MSG_STATUS_CHANGED } from './asset-state.guard.js';
import {
  assetDetailInclude,
  assetListInclude,
  assetSnapshot,
  toAssetDetail,
  toAssetListItem,
} from './assets.mapper.js';
import type { AssetDetailRow, PathIndex } from './assets.mapper.js';
import type { AssetDetailDto, AssetListItemDto } from './dto/asset.dto.js';
import type { AssetQueryDto } from './dto/asset-query.dto.js';
import type { AssetStatisticsDto, CountByRefDto } from './dto/asset-statistics.dto.js';
import type { CreateAssetDto } from './dto/create-asset.dto.js';
import type { UpdateAssetDto } from './dto/update-asset.dto.js';

export const ASSET_NOT_FOUND = 'Barang tidak ditemukan.';
export const ASSET_ARCHIVED = 'Barang sudah diarsipkan.';
export const ASSET_NOT_ARCHIVED = 'Barang tidak dalam arsip.';
export const ASSET_BORROWED = 'Barang sedang dipinjam.';
export const ARCHIVE_BLOCKED_BY_LOAN = 'Kembalikan pinjaman dulu sebelum mengarsipkan.';
export const ARCHIVE_BLOCKED_BY_MUTATION = 'Selesaikan mutasi yang menunggu dulu sebelum mengarsipkan.';
const MODULE = 'assets';
/** Audit modules whose entries (keyed by asset id) make up an asset's timeline. */
export const ASSET_HISTORY_MODULES = [
  MODULE,
  'qr',
  'assignments',
  'condition_logs',
  'mutations',
  'loans',
  'stock_opnames',
  'maintenance',
  'disposals',
];

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codes: AssetCodeService,
    private readonly settings: SettingsService,
    private readonly employees: EmployeesService,
    private readonly conditions: AssetConditionsService,
    private readonly guard: AssetStateGuard,
  ) {}

  // ---------------------------------------------------------------- queries

  async list(q: AssetQueryDto): Promise<Paginated<AssetListItemDto>> {
    const where: Prisma.AssetWhereInput = {};
    if (!q.includeArchived) where.archivedAt = null;
    // Disposed items leave the working list; ask for them by status (or with the archive toggle).
    if (!q.includeArchived && !q.status) where.status = { not: 'DISPOSED' };
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.OR = [
        { assetCode: contains },
        { name: contains },
        { brand: contains },
        { model: contains },
        { serialNumber: contains },
      ];
    }
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.departmentId) where.departmentId = q.departmentId;
    if (q.responsibleEmployeeId) where.responsibleEmployeeId = q.responsibleEmployeeId;
    if (q.condition) where.condition = q.condition;
    if (q.status) where.status = q.status;
    if (q.ownershipType) where.ownershipType = q.ownershipType;

    const paths = await this.pathIndex();
    if (q.locationId) where.locationId = { in: descendantIds(q.locationId, paths) };

    const [rows, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: assetListInclude,
        orderBy: [{ [q.sort]: q.order }, { id: 'asc' }],
        ...pageArgs(q),
      }),
      this.prisma.asset.count({ where }),
    ]);
    return paginate(
      rows.map((r) => toAssetListItem(r, paths)),
      total,
      q,
    );
  }

  async get(id: string): Promise<AssetDetailDto> {
    const row = await this.getRow(id);
    return toAssetDetail(row, await this.pathIndex(), await this.settings.getPublicBaseUrl());
  }

  async history(id: string, q: PaginationQueryDto): Promise<Paginated<AuditEntryPublicDto>> {
    await this.getRow(id);
    const page = await this.audit.list({
      page: q.page,
      pageSize: q.pageSize,
      entityId: id,
      modules: ASSET_HISTORY_MODULES,
    });
    // `assets.view` is not an audit permission: actor IP and device stay with the audit-log pages.
    const data = page.data.map(({ ip: _ip, userAgent: _ua, ...rest }) => rest);
    return { ...page, data };
  }

  async statistics(): Promise<AssetStatisticsDto> {
    const live: Prisma.AssetWhereInput = { archivedAt: null, status: { not: 'DISPOSED' } };
    const today = new Date(`${jakartaToday()}T00:00:00Z`);
    const [
      active,
      archived,
      disposed,
      byStatusRows,
      byConditionRows,
      byCategoryRows,
      byLocationRows,
      pendingMutations,
      activeLoans,
      overdueLoans,
      byYearRows,
      withoutAcquisitionYear,
    ] = await Promise.all([
      this.prisma.asset.count({ where: live }),
      this.prisma.asset.count({ where: { archivedAt: { not: null } } }),
      this.prisma.asset.count({ where: { archivedAt: null, status: 'DISPOSED' } }),
      this.prisma.asset.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
      this.prisma.asset.groupBy({ by: ['condition'], where: live, _count: { _all: true } }),
      this.prisma.asset.groupBy({ by: ['categoryId'], where: live, _count: { _all: true } }),
      this.prisma.asset.groupBy({ by: ['locationId'], where: live, _count: { _all: true } }),
      this.prisma.assetMutation.count({ where: { status: 'PENDING' } }),
      this.prisma.assetLoan.count({ where: { status: 'ACTIVE' } }),
      this.prisma.assetLoan.count({ where: { status: 'ACTIVE', dueAt: { lt: today } } }),
      // acquisition_date is a calendar date (no time zone), so its year is the Jakarta year.
      this.prisma.$queryRaw<{ year: number; count: number }[]>`
        SELECT extract(year FROM acquisition_date)::int AS year, count(*)::int AS count
        FROM assets
        WHERE archived_at IS NULL AND status <> 'DISPOSED' AND acquisition_date IS NOT NULL
        GROUP BY 1 ORDER BY 1`,
      this.prisma.asset.count({ where: { ...live, acquisitionDate: null } }),
    ]);

    const byStatus = Object.fromEntries(Object.keys(AssetStatus).map((k) => [k, 0])) as Record<
      AssetStatus,
      number
    >;
    for (const r of byStatusRows) byStatus[r.status] = r._count._all;
    const byCondition = Object.fromEntries(Object.keys(AssetCondition).map((k) => [k, 0])) as Record<
      AssetCondition,
      number
    >;
    for (const r of byConditionRows) byCondition[r.condition] = r._count._all;

    const categories = await this.prisma.category.findMany({
      where: { id: { in: byCategoryRows.map((r) => r.categoryId) } },
      select: { id: true, name: true },
    });
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const byCategory: CountByRefDto[] = byCategoryRows
      .map((r) => ({ id: r.categoryId, name: categoryName.get(r.categoryId) ?? '-', count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    const paths = await this.pathIndex();
    const officeCounts = new Map<string, number>();
    for (const r of byLocationRows) {
      if (!r.locationId) continue; // single-office setups leave the location empty
      const root = rootOf(r.locationId, paths);
      officeCounts.set(root, (officeCounts.get(root) ?? 0) + r._count._all);
    }
    const byOffice: CountByRefDto[] = Array.from(officeCounts.entries())
      .map(([id, count]) => ({ id, name: paths.get(id)?.name ?? '-', count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: active + archived + disposed,
      disposed,
      active,
      archived,
      byStatus,
      byCondition,
      byCategory,
      byOffice,
      byAcquisitionYear: byYearRows.map((r) => ({ year: Number(r.year), count: Number(r.count) })),
      withoutAcquisitionYear,
      pendingMutations,
      activeLoans,
      overdueLoans,
      openOpname: await this.openOpname(),
      openMaintenance: await this.prisma.maintenanceRecord.count({ where: { status: 'REPORTED' } }),
      inMaintenance: await this.prisma.maintenanceRecord.count({ where: { status: 'IN_PROGRESS' } }),
    };
  }

  // -------------------------------------------------------------- mutations

  async create(dto: CreateAssetDto, actor: AuthUser): Promise<AssetDetailDto> {
    await this.assertReferences(dto);
    if (dto.responsibleEmployeeId) await this.employees.assertActive(this.prisma, dto.responsibleEmployeeId);
    const { id } = await this.prisma.$transaction(async (tx) => {
      const assetCode = await this.codes.next(tx);
      const asset = await tx.asset.create({
        data: { ...this.toCreateData(dto), assetCode, createdById: actor.id },
        select: { id: true },
      });
      await tx.assetLabel.create({ data: { assetId: asset.id, publicToken: generatePublicToken() } });
      // The form's condition is the first inspection; the first responsible is the first assignment.
      await this.conditions.record(tx, asset.id, { condition: dto.condition, source: 'CREATE' }, actor);
      if (dto.responsibleEmployeeId) {
        await tx.assetAssignment.create({
          data: {
            assetId: asset.id,
            fromEmployeeId: null,
            toEmployeeId: dto.responsibleEmployeeId,
            source: 'CREATE',
            changedById: actor.id,
          },
        });
      }
      return asset;
    });
    const created = await this.getRow(id);
    await this.audit.record({
      action: 'asset.created',
      module: MODULE,
      entityId: id,
      after: assetSnapshot(created),
    });
    await this.audit.record({ action: 'qr.generated', module: 'qr', entityId: id });
    return this.get(id);
  }

  async update(id: string, dto: UpdateAssetDto): Promise<AssetDetailDto> {
    const before = await this.getRow(id);
    if (before.archivedAt) throw new BadRequestException(ASSET_ARCHIVED);
    const statusChanges = dto.status !== undefined && dto.status !== before.status;
    if (dto.status !== undefined) {
      // A flow (loan, repair, disposal) owns the status while it runs.
      this.guard.assertFree(await this.guard.load(this.prisma, id), ['pendingMutation', 'archived']);
    }
    await this.assertReferences({ categoryId: dto.categoryId, departmentId: dto.departmentId });
    const data = this.toData(dto, true);
    const after = await this.prisma.$transaction(async (tx) => {
      if (statusChanges) {
        await this.guard.setStatus(tx, id, before.status, dto.status!);
        delete data.status;
      }
      return tx.asset.update({ where: { id }, data, include: assetDetailInclude });
    });
    await this.audit.record({
      action: 'asset.updated',
      module: MODULE,
      entityId: id,
      before: assetSnapshot(before),
      after: assetSnapshot(after),
    });
    return this.get(id);
  }

  async archive(id: string, reason: string | undefined, actor: AuthUser): Promise<AssetDetailDto> {
    const row = await this.getRow(id);
    if (row.archivedAt) throw new BadRequestException(ASSET_ARCHIVED);
    if (row.loans.length > 0) throw new ConflictException(ARCHIVE_BLOCKED_BY_LOAN);
    if (row.mutations.length > 0) throw new ConflictException(ARCHIVE_BLOCKED_BY_MUTATION);
    const state = await this.guard.load(this.prisma, id);
    if (state.openMaintenance?.status === 'IN_PROGRESS') throw new ConflictException(MSG_IN_MAINTENANCE);
    // Conditional on the status just read: a loan or repair that starts concurrently wins or loses cleanly.
    const archived = await this.prisma.asset.updateMany({
      where: { id, archivedAt: null, status: state.status },
      data: { archivedAt: new Date(), archivedById: actor.id, archiveReason: reason ?? null },
    });
    if (archived.count !== 1) throw new ConflictException(MSG_STATUS_CHANGED);
    await this.audit.record({
      action: 'asset.archived',
      module: MODULE,
      entityId: id,
      before: { isArchived: false },
      after: { isArchived: true, reason: reason ?? null },
    });
    return this.get(id);
  }

  async unarchive(id: string): Promise<AssetDetailDto> {
    const row = await this.getRow(id);
    if (!row.archivedAt) throw new BadRequestException(ASSET_NOT_ARCHIVED);
    await this.prisma.asset.update({
      where: { id },
      data: { archivedAt: null, archivedById: null, archiveReason: null },
    });
    await this.audit.record({
      action: 'asset.unarchived',
      module: MODULE,
      entityId: id,
      before: { isArchived: true, reason: row.archiveReason },
      after: { isArchived: false },
    });
    return this.get(id);
  }

  // ---------------------------------------------------------------- helpers

  async getRow(id: string): Promise<AssetDetailRow> {
    const row = await this.prisma.asset.findUnique({ where: { id }, include: assetDetailInclude });
    if (!row) throw new NotFoundException(ASSET_NOT_FOUND);
    return row;
  }

  /** Progress of the session being counted right now, for the dashboard. */
  private async openOpname(): Promise<{ id: string; name: string; scanned: number; total: number } | null> {
    const session = await this.prisma.stockOpname.findFirst({ where: { status: 'OPEN' }, select: { id: true, name: true } });
    if (!session) return null;
    const [scanned, total] = await Promise.all([
      this.prisma.stockOpnameItem.count({ where: { opnameId: session.id, result: { in: ['MATCHED', 'CONDITION_DIFFERS'] } } }),
      this.prisma.stockOpnameItem.count({ where: { opnameId: session.id, result: { notIn: ['UNREGISTERED', 'REMOVED'] } } }),
    ]);
    return { ...session, scanned, total };
  }

  async pathIndex(): Promise<PathIndex> {
    const rows = await this.prisma.location.findMany({ select: { id: true, name: true, parentId: true } });
    return new Map(rows.map((r) => [r.id, { name: r.name, parentId: r.parentId }]));
  }

  private toCreateData(dto: CreateAssetDto): Omit<Prisma.AssetUncheckedCreateInput, 'assetCode'> {
    return {
      name: dto.name,
      categoryId: dto.categoryId,
      brand: dto.brand ?? null,
      model: dto.model ?? null,
      serialNumber: dto.serialNumber ?? null,
      description: dto.description ?? null,
      ownershipType: dto.ownershipType,
      acquisitionMethod: dto.acquisitionMethod,
      acquisitionDate: dto.acquisitionDate ? new Date(`${dto.acquisitionDate}T00:00:00Z`) : null,
      purchasePrice: dto.purchasePrice ?? null,
      vendor: dto.vendor ?? null,
      locationId: dto.locationId ?? null,
      departmentId: dto.departmentId ?? null,
      condition: dto.condition,
      status: dto.status,
      responsibleEmployeeId: dto.responsibleEmployeeId ?? null,
      notes: dto.notes ?? null,
    };
  }

  private toData(dto: UpdateAssetDto, partial = false): Prisma.AssetUncheckedUpdateInput {
    const data: Prisma.AssetUncheckedUpdateInput = {};
    const set = <K extends keyof Prisma.AssetUncheckedUpdateInput>(
      key: K,
      value: Prisma.AssetUncheckedUpdateInput[K] | undefined,
    ) => {
      if (value !== undefined || !partial) data[key] = value as Prisma.AssetUncheckedUpdateInput[K];
    };
    set('name', dto.name);
    set('categoryId', dto.categoryId);
    set('brand', dto.brand);
    set('model', dto.model);
    set('serialNumber', dto.serialNumber);
    set('description', dto.description);
    set('ownershipType', dto.ownershipType);
    set('acquisitionMethod', dto.acquisitionMethod);
    set(
      'acquisitionDate',
      dto.acquisitionDate === undefined
        ? undefined
        : dto.acquisitionDate === null
          ? null
          : new Date(`${dto.acquisitionDate}T00:00:00Z`),
    );
    set('purchasePrice', dto.purchasePrice);
    set('vendor', dto.vendor);
    set('departmentId', dto.departmentId);
    set('status', dto.status);
    set('notes', dto.notes);
    return data;
  }

  /** Every referenced row must exist and be active; the message names the field. */
  private async assertReferences(dto: {
    categoryId?: string | null;
    locationId?: string | null;
    departmentId?: string | null;
  }): Promise<void> {
    if (dto.categoryId) {
      const ok = await this.prisma.category.findFirst({ where: { id: dto.categoryId, isActive: true } });
      if (!ok) throw new BadRequestException('Kategori tidak ditemukan atau nonaktif.');
    }
    if (dto.locationId) {
      const ok = await this.prisma.location.findFirst({ where: { id: dto.locationId, isActive: true } });
      if (!ok) throw new BadRequestException('Lokasi tidak ditemukan atau nonaktif.');
    }
    if (dto.departmentId) {
      const ok = await this.prisma.department.findFirst({ where: { id: dto.departmentId, isActive: true } });
      if (!ok) throw new BadRequestException('Unit kerja tidak ditemukan atau nonaktif.');
    }
  }
}

/** The location itself plus every descendant (BFS over the in-memory index). */
export function descendantIds(rootId: string, paths: PathIndex): string[] {
  const children = new Map<string, string[]>();
  for (const [id, row] of paths) {
    if (row.parentId) children.set(row.parentId, [...(children.get(row.parentId) ?? []), id]);
  }
  const out: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    queue.push(...(children.get(id) ?? []));
  }
  return out;
}

export function rootOf(id: string, paths: PathIndex): string {
  let current = id;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const parent = paths.get(current)?.parentId;
    if (!parent) break;
    current = parent;
  }
  return current;
}
