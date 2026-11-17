import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { masterDataWhere } from '../../common/dto/master-data-query.dto.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { LocationType, Prisma } from '../../generated/prisma/client.js';
import type {
  CreateLocationDto,
  LocationDto,
  LocationQueryDto,
  LocationTreeNodeDto,
  UpdateLocationDto,
} from './dto/location.dto.js';
import { assertValidParent, buildPath, buildTree } from './locations.rules.js';

const MODULE = 'locations';
export const LOCATION_NOT_FOUND = 'Lokasi tidak ditemukan.';
export const PARENT_NOT_FOUND = 'Lokasi induk tidak ditemukan.';
export const CHILDREN_STILL_ACTIVE = 'Nonaktifkan lokasi anak terlebih dahulu.';
export const PARENT_INACTIVE = 'Aktifkan lokasi induk terlebih dahulu.';

const locationInclude = {
  parent: { select: { id: true, code: true, name: true, type: true } },
} satisfies Prisma.LocationInclude;

type LocationRow = Prisma.LocationGetPayload<{ include: typeof locationInclude }>;

type PathIndex = Map<string, { name: string; parentId: string | null }>;

function snapshot(row: LocationRow) {
  return {
    code: row.code,
    name: row.name,
    type: row.type,
    parentId: row.parentId,
    description: row.description,
    isActive: row.isActive,
  };
}

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: LocationQueryDto): Promise<Paginated<LocationDto>> {
    const where: Prisma.LocationWhereInput = { ...masterDataWhere(q) };
    if (q.type) where.type = q.type;
    if (q.parentId) where.parentId = q.parentId;

    const [rows, total, index] = await Promise.all([
      this.prisma.location.findMany({
        where,
        include: locationInclude,
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        ...pageArgs(q),
      }),
      this.prisma.location.count({ where }),
      this.pathIndex(),
    ]);
    return paginate(
      rows.map((row) => this.toDto(row, index)),
      total,
      q,
    );
  }

  async get(id: string): Promise<LocationDto> {
    const row = await this.getRow(id);
    return this.toDto(row, await this.pathIndex());
  }

  async tree(includeInactive: boolean): Promise<LocationTreeNodeDto[]> {
    const rows = await this.prisma.location.findMany({
      where: includeInactive ? {} : { isActive: true },
      select: { id: true, parentId: true, type: true, code: true, name: true, isActive: true },
    });
    return buildTree(rows);
  }

  async create(dto: CreateLocationDto): Promise<LocationDto> {
    const parent = await this.resolveParent(dto.parentId ?? null);
    assertValidParent(dto.type, parent?.type ?? null);

    const row = await this.prisma.location.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: parent?.id ?? null,
        description: dto.description ?? null,
      },
      include: locationInclude,
    });
    await this.audit.record({
      action: 'location.created',
      module: MODULE,
      entityId: row.id,
      after: snapshot(row),
    });
    return this.toDto(row, await this.pathIndex());
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationDto> {
    const before = await this.getRow(id);

    const data: Prisma.LocationUncheckedUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.parentId !== undefined) {
      const parent = await this.resolveParent(dto.parentId);
      assertValidParent(before.type, parent?.type ?? null);
      data.parentId = parent?.id ?? null;
    }

    const row = await this.prisma.location.update({ where: { id }, data, include: locationInclude });
    await this.audit.record({
      action: 'location.updated',
      module: MODULE,
      entityId: id,
      before: snapshot(before),
      after: snapshot(row),
    });
    return this.toDto(row, await this.pathIndex());
  }

  async setActive(id: string, isActive: boolean): Promise<LocationDto> {
    const before = await this.getRow(id);

    if (!isActive) {
      const activeChildren = await this.prisma.location.count({
        where: { parentId: id, isActive: true },
      });
      if (activeChildren > 0) throw new BadRequestException(CHILDREN_STILL_ACTIVE);
    } else if (before.parentId) {
      const parent = await this.prisma.location.findUnique({
        where: { id: before.parentId },
        select: { isActive: true },
      });
      if (parent && !parent.isActive) throw new BadRequestException(PARENT_INACTIVE);
    }

    const row = await this.prisma.location.update({
      where: { id },
      data: { isActive },
      include: locationInclude,
    });
    await this.audit.record({
      action: isActive ? 'location.activated' : 'location.deactivated',
      module: MODULE,
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return this.toDto(row, await this.pathIndex());
  }

  private async getRow(id: string): Promise<LocationRow> {
    const row = await this.prisma.location.findUnique({ where: { id }, include: locationInclude });
    if (!row) throw new NotFoundException(LOCATION_NOT_FOUND);
    return row;
  }

  private async resolveParent(
    parentId: string | null,
  ): Promise<{ id: string; type: LocationType } | null> {
    if (!parentId) return null;
    const parent = await this.prisma.location.findUnique({
      where: { id: parentId },
      select: { id: true, type: true },
    });
    if (!parent) throw new BadRequestException(PARENT_NOT_FOUND);
    return parent;
  }

  /** One query for every location's name and parent; locations are few. */
  private async pathIndex(): Promise<PathIndex> {
    const rows = await this.prisma.location.findMany({
      select: { id: true, name: true, parentId: true },
    });
    return new Map(rows.map((r) => [r.id, { name: r.name, parentId: r.parentId }]));
  }

  private toDto(row: LocationRow, index: PathIndex): LocationDto {
    index.set(row.id, { name: row.name, parentId: row.parentId });
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      description: row.description,
      isActive: row.isActive,
      parent: row.parent,
      path: buildPath(row.id, index),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
