import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { masterDataWhere } from '../../common/dto/master-data-query.dto.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Category, Prisma } from '../../generated/prisma/client.js';
import type { CategoryDto, CategoryQueryDto, CreateCategoryDto, Golongan, UpdateCategoryDto } from './dto/category.dto.js';

const MODULE = 'categories';
const NOT_FOUND = 'Jenis barang tidak ditemukan.';
export const NUMBER_TAKEN = 'Nomor jenis sudah dipakai di golongan ini.';
export const TYPE_LOCKED = 'Jenis sudah dipakai; golongan, nomor, dan jenis kelompok tidak bisa diubah.';

type Row = Category & { _count: { assets: number; groupItems: number } };
const withUse = { _count: { select: { assets: true, groupItems: true } } } as const;

export const pad3 = (n: number) => String(n).padStart(3, '0');
export const typeCode = (golongan: Golongan, number: number) => `${golongan}-${pad3(number)}`;
export const typeLabel = (golongan: Golongan, number: number, name: string) => `${golongan} ${pad3(number)} · ${name}`;

function toDto(row: Row): CategoryDto {
  return {
    id: row.id,
    code: row.code,
    golongan: row.golongan,
    number: row.number,
    isGroup: row.isGroup,
    name: row.name,
    label: typeLabel(row.golongan, row.number, row.name),
    description: row.description,
    isActive: row.isActive,
    inUse: row._count.assets + row._count.groupItems > 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function snapshot(row: Category) {
  return {
    code: row.code,
    golongan: row.golongan,
    number: row.number,
    isGroup: row.isGroup,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
  };
}

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === 'P2002';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: CategoryQueryDto): Promise<Paginated<CategoryDto>> {
    const where: Prisma.CategoryWhereInput = {
      ...masterDataWhere(q),
      ...(q.golongan ? { golongan: q.golongan } : {}),
      ...(q.isGroup !== undefined ? { isGroup: q.isGroup } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: withUse,
        orderBy: [{ golongan: 'asc' }, { number: 'asc' }],
        ...pageArgs(q),
      }),
      this.prisma.category.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, q);
  }

  async get(id: string): Promise<CategoryDto> {
    return toDto(await this.getRow(id));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const number = dto.number ?? (await this.nextNumber(dto.golongan));
    await this.assertNumberFree(dto.golongan, number);
    let row: Row;
    try {
      row = await this.prisma.category.create({
        data: {
          code: typeCode(dto.golongan, number),
          golongan: dto.golongan,
          number,
          isGroup: dto.isGroup ?? false,
          name: dto.name,
          description: dto.description ?? null,
        },
        include: withUse,
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(NUMBER_TAKEN);
      throw e;
    }
    await this.audit.record({ action: 'category.created', module: MODULE, entityId: row.id, after: snapshot(row) });
    return toDto(row);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const before = await this.getRow(id);
    const golongan = dto.golongan ?? before.golongan;
    const number = dto.number ?? before.number;
    const identityChanges =
      golongan !== before.golongan || number !== before.number || (dto.isGroup !== undefined && dto.isGroup !== before.isGroup);
    if (identityChanges && before._count.assets + before._count.groupItems > 0) throw new ConflictException(TYPE_LOCKED);
    if (golongan !== before.golongan || number !== before.number) await this.assertNumberFree(golongan, number, id);

    let row: Row;
    try {
      row = await this.prisma.category.update({
        where: { id },
        data: {
          golongan,
          number,
          code: typeCode(golongan, number),
          ...(dto.isGroup !== undefined ? { isGroup: dto.isGroup } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
        include: withUse,
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(NUMBER_TAKEN);
      throw e;
    }
    await this.audit.record({
      action: 'category.updated',
      module: MODULE,
      entityId: id,
      before: snapshot(before),
      after: snapshot(row),
    });
    return toDto(row);
  }

  async setActive(id: string, isActive: boolean): Promise<CategoryDto> {
    const before = await this.getRow(id);
    const row = await this.prisma.category.update({ where: { id }, data: { isActive }, include: withUse });
    await this.audit.record({
      action: isActive ? 'category.activated' : 'category.deactivated',
      module: MODULE,
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return toDto(row);
  }

  private async nextNumber(golongan: Golongan): Promise<number> {
    const last = await this.prisma.category.aggregate({ where: { golongan }, _max: { number: true } });
    return (last._max.number ?? 0) + 1;
  }

  private async assertNumberFree(golongan: Golongan, number: number, exceptId?: string): Promise<void> {
    const taken = await this.prisma.category.findFirst({
      where: { golongan, number, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (taken) throw new ConflictException(NUMBER_TAKEN);
  }

  private async getRow(id: string): Promise<Row> {
    const row = await this.prisma.category.findUnique({ where: { id }, include: withUse });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }
}
