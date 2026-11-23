import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { masterDataWhere } from '../../common/dto/master-data-query.dto.js';
import type { MasterDataQueryDto } from '../../common/dto/master-data-query.dto.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Category } from '../../generated/prisma/client.js';
import type { CategoryDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

const MODULE = 'categories';
const NOT_FOUND = 'Kategori tidak ditemukan.';

function toDto(row: Category): CategoryDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function snapshot(row: Category) {
  return { code: row.code, name: row.name, description: row.description, isActive: row.isActive };
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: MasterDataQueryDto): Promise<Paginated<CategoryDto>> {
    const where = masterDataWhere(q);
    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(q) }),
      this.prisma.category.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, q);
  }

  async get(id: string): Promise<CategoryDto> {
    return toDto(await this.getRow(id));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    // Temporary until item types get their own numbering (Task 2): NG, next free number.
    const last = await this.prisma.category.aggregate({ where: { golongan: 'NG' }, _max: { number: true } });
    const row = await this.prisma.category.create({
      data: { code: dto.code, name: dto.name, description: dto.description ?? null, golongan: 'NG', number: (last._max.number ?? 0) + 1 },
    });
    await this.audit.record({
      action: 'category.created',
      module: MODULE,
      entityId: row.id,
      after: snapshot(row),
    });
    return toDto(row);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const before = await this.getRow(id);
    const row = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
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
    const row = await this.prisma.category.update({ where: { id }, data: { isActive } });
    await this.audit.record({
      action: isActive ? 'category.activated' : 'category.deactivated',
      module: MODULE,
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return toDto(row);
  }

  private async getRow(id: string): Promise<Category> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }
}
