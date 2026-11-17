import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { masterDataWhere } from '../../common/dto/master-data-query.dto.js';
import type { MasterDataQueryDto } from '../../common/dto/master-data-query.dto.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Department } from '../../generated/prisma/client.js';
import type {
  CreateDepartmentDto,
  DepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto.js';

const MODULE = 'departments';
const NOT_FOUND = 'Unit kerja tidak ditemukan.';

function toDto(row: Department): DepartmentDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function snapshot(row: Department) {
  return { code: row.code, name: row.name, isActive: row.isActive };
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: MasterDataQueryDto): Promise<Paginated<DepartmentDto>> {
    const where = masterDataWhere(q);
    const [rows, total] = await Promise.all([
      this.prisma.department.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(q) }),
      this.prisma.department.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, q);
  }

  async get(id: string): Promise<DepartmentDto> {
    return toDto(await this.getRow(id));
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentDto> {
    const row = await this.prisma.department.create({ data: { code: dto.code, name: dto.name } });
    await this.audit.record({
      action: 'department.created',
      module: MODULE,
      entityId: row.id,
      after: snapshot(row),
    });
    return toDto(row);
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentDto> {
    const before = await this.getRow(id);
    const row = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
    });
    await this.audit.record({
      action: 'department.updated',
      module: MODULE,
      entityId: id,
      before: snapshot(before),
      after: snapshot(row),
    });
    return toDto(row);
  }

  async setActive(id: string, isActive: boolean): Promise<DepartmentDto> {
    const before = await this.getRow(id);
    const row = await this.prisma.department.update({ where: { id }, data: { isActive } });
    await this.audit.record({
      action: isActive ? 'department.activated' : 'department.deactivated',
      module: MODULE,
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return toDto(row);
  }

  private async getRow(id: string): Promise<Department> {
    const row = await this.prisma.department.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }
}
