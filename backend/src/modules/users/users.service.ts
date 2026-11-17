import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuditLogDto } from '../../common/audit/audit.types.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { paginate } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { normalizeEmail } from '../auth/auth.service.js';
import { PasswordService } from '../auth/password.service.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserDto } from './dto/user.dto.js';
import type { UserQueryDto } from './dto/user-query.dto.js';

export const USER_NOT_FOUND = 'Pengguna tidak ditemukan.';
export const DEPARTMENT_NOT_FOUND = 'Unit kerja tidak ditemukan.';
export const CANNOT_DEACTIVATE_SELF = 'Anda tidak dapat menonaktifkan akun sendiri.';
export const LAST_SUPER_ADMIN = 'Sistem harus memiliki minimal satu Super Admin aktif.';
export const ONLY_SUPER_ADMIN_ASSIGNS = 'Hanya Super Admin yang dapat menetapkan role Super Admin.';

/** Only a Super Admin may grant or strip the Super Admin role. */
function assertSuperAdminAssignment(actor: AuthUser, before: string[], next: string[]): void {
  const touchesSuperAdmin = before.includes('SUPER_ADMIN') !== next.includes('SUPER_ADMIN');
  if (touchesSuperAdmin && !actor.roles.includes('SUPER_ADMIN')) {
    throw new BadRequestException(ONLY_SUPER_ADMIN_ASSIGNS);
  }
}

const userInclude = {
  department: { select: { id: true, code: true, name: true } },
  roles: { include: { role: { select: { code: true, name: true } } } },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function toDto(row: UserRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone,
    isActive: row.isActive,
    department: row.department,
    roles: row.roles
      .map((ur) => ({ code: ur.role.code, name: ur.role.name }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Audit snapshot: the DTO without volatile timestamps. */
function snapshot(dto: UserDto) {
  return {
    email: dto.email,
    fullName: dto.fullName,
    phone: dto.phone,
    isActive: dto.isActive,
    departmentId: dto.department?.id ?? null,
    roles: dto.roles.map((r) => r.code),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly audit: AuditService,
  ) {}

  async list(q: UserQueryDto): Promise<Paginated<UserDto>> {
    const where: Prisma.UserWhereInput = {};
    if (q.search) {
      where.OR = [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.isActive !== undefined) where.isActive = q.isActive;
    if (q.roleCode) where.roles = { some: { role: { code: q.roleCode } } };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
        ...pageArgs(q),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, q);
  }

  async get(id: string): Promise<UserDto> {
    return toDto(await this.getRow(id));
  }

  async create(dto: CreateUserDto, actor: AuthUser): Promise<UserDto> {
    this.passwords.assertStrong(dto.password);
    assertSuperAdminAssignment(actor, [], dto.roleCodes);
    const roleIds = await this.resolveRoleIds(dto.roleCodes);
    await this.ensureDepartment(dto.departmentId);

    const created = await this.prisma.user.create({
      data: {
        email: normalizeEmail(dto.email),
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        departmentId: dto.departmentId ?? null,
        passwordHash: await this.passwords.hash(dto.password),
        roles: { create: roleIds.map((roleId) => ({ roleId, assignedById: actor.id })) },
      },
      include: userInclude,
    });
    const result = toDto(created);
    await this.audit.record({
      action: 'user.created',
      module: 'users',
      entityId: result.id,
      after: snapshot(result),
    });
    return result;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const before = toDto(await this.getRow(id));
    if (dto.departmentId !== undefined) await this.ensureDepartment(dto.departmentId);

    const data: Prisma.UserUncheckedUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;

    const updated = toDto(
      await this.prisma.user.update({ where: { id }, data, include: userInclude }),
    );
    await this.audit.record({
      action: 'user.updated',
      module: 'users',
      entityId: id,
      before: snapshot(before),
      after: snapshot(updated),
    });
    return updated;
  }

  async setRoles(id: string, roleCodes: string[], actor: AuthUser): Promise<UserDto> {
    const current = toDto(await this.getRow(id));
    const nextCodes = Array.from(new Set(roleCodes)).sort();
    const beforeCodes = current.roles.map((r) => r.code);
    assertSuperAdminAssignment(actor, beforeCodes, nextCodes);
    const roleIds = await this.resolveRoleIds(roleCodes);

    const losesSuperAdmin =
      beforeCodes.includes('SUPER_ADMIN') && !nextCodes.includes('SUPER_ADMIN');
    if (losesSuperAdmin && current.isActive) await this.assertNotLastSuperAdmin(id);

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId, assignedById: actor.id })),
      }),
    ]);
    const updated = await this.get(id);
    await this.audit.record({
      action: 'user.roles_updated',
      module: 'users',
      entityId: id,
      before: beforeCodes,
      after: updated.roles.map((r) => r.code),
    });
    return updated;
  }

  async deactivate(id: string, actor: AuthUser): Promise<UserDto> {
    if (id === actor.id) throw new BadRequestException(CANNOT_DEACTIVATE_SELF);
    const current = toDto(await this.getRow(id));
    if (current.isActive && current.roles.some((r) => r.code === 'SUPER_ADMIN')) {
      await this.assertNotLastSuperAdmin(id);
    }
    const updated = toDto(
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
        include: userInclude,
      }),
    );
    await this.refreshTokens.revokeAllForUser(id);
    await this.audit.record({
      action: 'user.deactivated',
      module: 'users',
      entityId: id,
      before: { isActive: current.isActive },
      after: { isActive: false },
    });
    return updated;
  }

  async activate(id: string): Promise<UserDto> {
    const current = toDto(await this.getRow(id));
    const updated = toDto(
      await this.prisma.user.update({
        where: { id },
        data: { isActive: true },
        include: userInclude,
      }),
    );
    await this.audit.record({
      action: 'user.activated',
      module: 'users',
      entityId: id,
      before: { isActive: current.isActive },
      after: { isActive: true },
    });
    return updated;
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.getRow(id);
    this.passwords.assertStrong(newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });
    await this.refreshTokens.revokeAllForUser(id);
    await this.audit.record({ action: 'user.password_reset', module: 'users', entityId: id });
  }

  async activity(id: string, q: PaginationQueryDto): Promise<Paginated<AuditLogDto>> {
    await this.getRow(id);
    return this.audit.list({ page: q.page, pageSize: q.pageSize, actorId: id });
  }

  private async getRow(id: string): Promise<UserRow> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!row) throw new NotFoundException(USER_NOT_FOUND);
    return row;
  }

  private async resolveRoleIds(codes: string[]): Promise<string[]> {
    const unique = Array.from(new Set(codes));
    const roles = await this.prisma.role.findMany({
      where: { code: { in: unique } },
      select: { id: true, code: true },
    });
    const found = new Set(roles.map((r) => r.code));
    const unknown = unique.filter((code) => !found.has(code));
    if (unknown.length > 0) {
      throw new BadRequestException(`Role tidak dikenal: ${unknown.join(', ')}`);
    }
    return roles.map((r) => r.id);
  }

  private async ensureDepartment(departmentId: string | null | undefined): Promise<void> {
    if (!departmentId) return;
    const exists = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException(DEPARTMENT_NOT_FOUND);
  }

  /** Guarantees another active Super Admin remains besides `excludingUserId`. */
  private async assertNotLastSuperAdmin(excludingUserId: string): Promise<void> {
    const others = await this.prisma.user.count({
      where: {
        id: { not: excludingUserId },
        isActive: true,
        roles: { some: { role: { code: 'SUPER_ADMIN' } } },
      },
    });
    if (others === 0) throw new BadRequestException(LAST_SUPER_ADMIN);
  }
}
