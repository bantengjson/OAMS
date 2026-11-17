import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import {
  isPermissionCode,
  PERMISSION_DEFINITIONS,
  ROLE_CODES,
} from '../../common/auth/permissions.catalog.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { PermissionGroupDto, RoleDto } from './dto/role.dto.js';

const roleInclude = {
  permissions: { include: { permission: { select: { code: true } } } },
  _count: { select: { users: true } },
} as const;

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: { code: string } }[];
  _count: { users: number };
};

function toDto(row: RoleRow): RoleDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.permissions.map((p) => p.permission.code).sort(),
    userCount: row._count.users,
  };
}

function roleOrder(code: string): number {
  const index = (ROLE_CODES as readonly string[]).indexOf(code);
  return index === -1 ? ROLE_CODES.length : index;
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<RoleDto[]> {
    const rows = await this.prisma.role.findMany({ include: roleInclude });
    return rows
      .map(toDto)
      .sort((a, b) => roleOrder(a.code) - roleOrder(b.code) || a.code.localeCompare(b.code));
  }

  async get(id: string): Promise<RoleDto> {
    const row = await this.prisma.role.findUnique({ where: { id }, include: roleInclude });
    if (!row) throw new NotFoundException('Role tidak ditemukan.');
    return toDto(row);
  }

  listPermissions(): PermissionGroupDto[] {
    const groups = new Map<string, PermissionGroupDto>();
    for (const def of PERMISSION_DEFINITIONS) {
      const group = groups.get(def.module) ?? { module: def.module, permissions: [] };
      group.permissions.push({ code: def.code, description: def.description });
      groups.set(def.module, group);
    }
    return Array.from(groups.values());
  }

  async setPermissions(id: string, codes: string[]): Promise<RoleDto> {
    const current = await this.get(id);
    if (current.code === 'SUPER_ADMIN') {
      throw new BadRequestException('Permission Super Admin tidak dapat diubah.');
    }
    const unknown = codes.filter((code) => !isPermissionCode(code));
    if (unknown.length > 0) {
      throw new BadRequestException(`Kode permission tidak dikenal: ${unknown.join(', ')}`);
    }
    const next = Array.from(new Set(codes)).sort();

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: next } },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
      }),
    ]);

    await this.audit.record({
      action: 'role.permissions_updated',
      module: 'roles',
      entityId: id,
      before: current.permissions,
      after: next,
    });
    return this.get(id);
  }
}
