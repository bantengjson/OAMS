import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { CreateEmployeeDto } from './dto/create-employee.dto.js';
import type { EmployeeQueryDto } from './dto/employee-query.dto.js';
import type { EmployeeDetailDto, EmployeeDto, EmployeeLookupDto } from './dto/employee.dto.js';
import type { UpdateEmployeeDto } from './dto/update-employee.dto.js';

export const EMPLOYEE_NOT_FOUND = 'Pegawai tidak ditemukan.';
export const EMPLOYEE_INACTIVE = 'Pegawai tidak aktif.';
export const USER_ALREADY_LINKED = 'Akun ini sudah tertaut ke pegawai lain.';
const MODULE = 'employees';

const employeeInclude = {
  department: { select: { id: true, code: true, name: true } },
  user: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

/** A Prisma client or transaction client: whatever the caller is already inside. */
type Db = Pick<PrismaService, 'employee'> | Prisma.TransactionClient;

function toDto(row: EmployeeRow): EmployeeDto {
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    fullName: row.fullName,
    department: row.department,
    position: row.position,
    phone: row.phone,
    email: row.email,
    user: row.user,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function snapshot(row: EmployeeRow) {
  return {
    employeeNumber: row.employeeNumber,
    fullName: row.fullName,
    departmentId: row.departmentId,
    position: row.position,
    phone: row.phone,
    email: row.email,
    userId: row.userId,
    isActive: row.isActive,
  };
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: EmployeeQueryDto): Promise<Paginated<EmployeeDto>> {
    const where: Prisma.EmployeeWhereInput = {};
    if (q.isActive !== undefined) where.isActive = q.isActive;
    if (q.departmentId) where.departmentId = q.departmentId;
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.OR = [{ fullName: contains }, { employeeNumber: contains }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        ...pageArgs(q),
      }),
      this.prisma.employee.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, q);
  }

  async lookup(search?: string): Promise<EmployeeLookupDto[]> {
    const where: Prisma.EmployeeWhereInput = { isActive: true };
    if (search) {
      const contains = { contains: search, mode: 'insensitive' as const };
      where.OR = [{ fullName: contains }, { employeeNumber: contains }];
    }
    const rows = await this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        employeeNumber: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
      take: 20,
    });
    return rows;
  }

  async get(id: string): Promise<EmployeeDetailDto> {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        ...employeeInclude,
        _count: {
          select: {
            responsibleAssets: { where: { archivedAt: null } },
            loansBorrowed: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException(EMPLOYEE_NOT_FOUND);
    const dto = toDto(row);
    return Object.assign(dto, { assetCount: row._count.responsibleAssets, activeLoanCount: row._count.loansBorrowed });
  }

  async create(dto: CreateEmployeeDto): Promise<EmployeeDto> {
    await this.assertReferences(dto, null);
    const row = await this.prisma.employee.create({
      data: {
        fullName: dto.fullName,
        employeeNumber: dto.employeeNumber ?? null,
        departmentId: dto.departmentId ?? null,
        position: dto.position ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        userId: dto.userId ?? null,
      },
      include: employeeInclude,
    });
    await this.audit.record({ action: 'employee.created', module: MODULE, entityId: row.id, after: snapshot(row) });
    return toDto(row);
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeDto> {
    const before = await this.getRow(id);
    await this.assertReferences(dto, id);
    const data: Prisma.EmployeeUncheckedUpdateInput = {};
    const set = <K extends keyof Prisma.EmployeeUncheckedUpdateInput>(
      key: K,
      value: Prisma.EmployeeUncheckedUpdateInput[K] | undefined,
    ) => {
      if (value !== undefined) data[key] = value;
    };
    set('fullName', dto.fullName);
    set('employeeNumber', dto.employeeNumber);
    set('departmentId', dto.departmentId);
    set('position', dto.position);
    set('phone', dto.phone);
    set('email', dto.email);
    set('userId', dto.userId);
    set('isActive', dto.isActive);

    const row = await this.prisma.employee.update({ where: { id }, data, include: employeeInclude });

    const { isActive: _a, ...beforeFields } = snapshot(before);
    const { isActive: _b, ...afterFields } = snapshot(row);
    if (JSON.stringify(beforeFields) !== JSON.stringify(afterFields)) {
      await this.audit.record({
        action: 'employee.updated',
        module: MODULE,
        entityId: id,
        before: beforeFields,
        after: afterFields,
      });
    }
    if (before.isActive !== row.isActive) {
      await this.audit.record({
        action: row.isActive ? 'employee.activated' : 'employee.deactivated',
        module: MODULE,
        entityId: id,
        before: { isActive: before.isActive },
        after: { isActive: row.isActive },
      });
    }
    return toDto(row);
  }

  /**
   * Guard for callers that reference an employee (responsible person, borrower,
   * guarantor). Runs on the caller's transaction client so the check and the
   * write see the same snapshot.
   */
  async assertActive(db: Db, id: string): Promise<void> {
    const row = await db.employee.findUnique({ where: { id }, select: { isActive: true } });
    if (!row) throw new NotFoundException(EMPLOYEE_NOT_FOUND);
    if (!row.isActive) throw new ConflictException(EMPLOYEE_INACTIVE);
  }

  private async getRow(id: string): Promise<EmployeeRow> {
    const row = await this.prisma.employee.findUnique({ where: { id }, include: employeeInclude });
    if (!row) throw new NotFoundException(EMPLOYEE_NOT_FOUND);
    return row;
  }

  private async assertReferences(dto: UpdateEmployeeDto, selfId: string | null): Promise<void> {
    if (dto.departmentId) {
      const ok = await this.prisma.department.findFirst({ where: { id: dto.departmentId, isActive: true } });
      if (!ok) throw new BadRequestException('Unit kerja tidak ditemukan atau nonaktif.');
    }
    if (dto.userId) {
      const user = await this.prisma.user.findFirst({ where: { id: dto.userId, isActive: true } });
      if (!user) throw new BadRequestException('Referensi data tidak valid.');
      const taken = await this.prisma.employee.findFirst({
        where: { userId: dto.userId, ...(selfId ? { NOT: { id: selfId } } : {}) },
        select: { id: true },
      });
      if (taken) throw new ConflictException(USER_ALREADY_LINKED);
    }
  }
}
