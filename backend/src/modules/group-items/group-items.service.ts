import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuditEntryPublicDto } from '../../common/audit/audit.types.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetCodeService, codePrefix } from '../assets/asset-code.js';
import type {
  CreateGroupItemDto,
  GroupItemDto,
  GroupItemQueryDto,
  UpdateGroupItemDto,
} from './dto/group-item.dto.js';

const MODULE = 'group_items';
export const GROUP_NOT_FOUND = 'Barang kelompok tidak ditemukan.';
export const GROUP_ARCHIVED = 'Barang kelompok sudah diarsipkan.';
export const NOT_A_GROUP_TYPE = 'Jenis ini bukan jenis Barang Kelompok.';
const TYPE_INVALID = 'Jenis barang tidak ditemukan atau nonaktif.';
const ROOM_INVALID = 'Ruangan tidak ditemukan atau nonaktif.';

export const groupItemInclude = {
  category: { select: { id: true, golongan: true, number: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
} satisfies Prisma.GroupItemInclude;
export type GroupItemRow = Prisma.GroupItemGetPayload<{ include: typeof groupItemInclude }>;

/** Display code without a unit number, e.g. `NG.I/110/DPC/TT` (same prefix rules as asset codes). */
export function groupCode(row: GroupItemRow, org: string): string {
  return codePrefix({
    golongan: row.category.golongan,
    roomCode: row.location.code,
    typeNumber: row.category.number,
    org,
    year: row.acquisitionYear,
  });
}

export function toGroupItemDto(row: GroupItemRow, org: string): GroupItemDto {
  return {
    id: row.id,
    code: groupCode(row, org),
    type: row.category,
    room: row.location,
    name: row.name,
    specification: row.specification,
    acquisitionYear: row.acquisitionYear,
    source: row.source,
    qtyGood: row.qtyGood,
    qtyNeedsRepair: row.qtyNeedsRepair,
    qtyDamaged: row.qtyDamaged,
    total: row.qtyGood + row.qtyNeedsRepair + row.qtyDamaged,
    notes: row.notes,
    archivedAt: row.archivedAt,
    updatedAt: row.updatedAt,
  };
}

export function groupSnapshot(row: GroupItemRow) {
  return {
    name: row.name,
    locationId: row.locationId,
    room: row.location.code,
    specification: row.specification,
    acquisitionYear: row.acquisitionYear,
    source: row.source,
    qtyGood: row.qtyGood,
    qtyNeedsRepair: row.qtyNeedsRepair,
    qtyDamaged: row.qtyDamaged,
    notes: row.notes,
  };
}

@Injectable()
export class GroupItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codes: AssetCodeService,
  ) {}

  async list(q: GroupItemQueryDto): Promise<Paginated<GroupItemDto>> {
    const where: Prisma.GroupItemWhereInput = {};
    if (!q.includeArchived) where.archivedAt = null;
    if (q.locationId) where.locationId = q.locationId;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.OR = [{ name: contains }, { specification: contains }, { category: { name: contains } }];
    }
    const [rows, total, org] = await Promise.all([
      this.prisma.groupItem.findMany({
        where,
        include: groupItemInclude,
        orderBy: [{ location: { code: 'asc' } }, { category: { number: 'asc' } }, { name: 'asc' }, { id: 'asc' }],
        ...pageArgs(q),
      }),
      this.prisma.groupItem.count({ where }),
      this.codes.org(this.prisma),
    ]);
    return paginate(
      rows.map((r) => toGroupItemDto(r, org)),
      total,
      q,
    );
  }

  async get(id: string): Promise<GroupItemDto> {
    return toGroupItemDto(await this.getRow(id), await this.codes.org(this.prisma));
  }

  async create(dto: CreateGroupItemDto, actor: AuthUser): Promise<GroupItemDto> {
    await this.assertGroupType(dto.categoryId);
    await this.assertRoom(dto.locationId);
    const row = await this.prisma.groupItem.create({
      data: {
        categoryId: dto.categoryId,
        locationId: dto.locationId,
        name: dto.name,
        acquisitionYear: dto.acquisitionYear,
        specification: dto.specification ?? null,
        source: dto.source ?? null,
        notes: dto.notes ?? null,
        qtyGood: dto.qtyGood ?? 0,
        qtyNeedsRepair: dto.qtyNeedsRepair ?? 0,
        qtyDamaged: dto.qtyDamaged ?? 0,
        createdById: actor.id,
      },
      include: groupItemInclude,
    });
    await this.audit.record({ action: 'group_item.created', module: MODULE, entityId: row.id, after: groupSnapshot(row) });
    return this.get(row.id);
  }

  async update(id: string, dto: UpdateGroupItemDto): Promise<GroupItemDto> {
    const before = await this.getRow(id);
    if (before.archivedAt) throw new BadRequestException(GROUP_ARCHIVED);
    if (dto.locationId) await this.assertRoom(dto.locationId);
    const { reason, ...fields } = dto;
    const data: Prisma.GroupItemUncheckedUpdateInput = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) (data as Record<string, unknown>)[key] = value;
    }
    const after = await this.prisma.groupItem.update({ where: { id }, data, include: groupItemInclude });
    await this.audit.record({
      action: 'group_item.updated',
      module: MODULE,
      entityId: id,
      before: groupSnapshot(before),
      after: { ...groupSnapshot(after), reason },
    });
    return this.get(id);
  }

  async archive(id: string, reason: string): Promise<GroupItemDto> {
    const before = await this.getRow(id);
    if (before.archivedAt) throw new BadRequestException(GROUP_ARCHIVED);
    await this.prisma.groupItem.update({ where: { id }, data: { archivedAt: new Date(), archiveReason: reason } });
    await this.audit.record({ action: 'group_item.archived', module: MODULE, entityId: id, after: { reason } });
    return this.get(id);
  }

  async history(id: string, q: PaginationQueryDto): Promise<Paginated<AuditEntryPublicDto>> {
    await this.getRow(id);
    const page = await this.audit.list({ page: q.page, pageSize: q.pageSize, entityId: id, modules: [MODULE] });
    const data = page.data.map(({ ip: _ip, userAgent: _ua, ...rest }) => rest);
    return { ...page, data };
  }

  /** Active rows: how many distinct types and how many units, for the dashboard. */
  async summary(): Promise<{ types: number; units: number }> {
    const [types, sums] = await Promise.all([
      this.prisma.groupItem.groupBy({ by: ['categoryId'], where: { archivedAt: null } }),
      this.prisma.groupItem.aggregate({
        where: { archivedAt: null },
        _sum: { qtyGood: true, qtyNeedsRepair: true, qtyDamaged: true },
      }),
    ]);
    const s = sums._sum;
    return { types: types.length, units: (s.qtyGood ?? 0) + (s.qtyNeedsRepair ?? 0) + (s.qtyDamaged ?? 0) };
  }

  private async getRow(id: string): Promise<GroupItemRow> {
    const row = await this.prisma.groupItem.findUnique({ where: { id }, include: groupItemInclude });
    if (!row) throw new NotFoundException(GROUP_NOT_FOUND);
    return row;
  }

  private async assertGroupType(categoryId: string): Promise<void> {
    const type = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!type || !type.isActive) throw new BadRequestException(TYPE_INVALID);
    if (!type.isGroup) throw new BadRequestException(NOT_A_GROUP_TYPE);
  }

  private async assertRoom(locationId: string): Promise<void> {
    const room = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!room || room.type !== 'ROOM' || !room.isActive) throw new BadRequestException(ROOM_INVALID);
  }
}
