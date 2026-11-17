import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class AuthUserLoader {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves the principal with effective permissions; null when missing or inactive. */
  async load(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user || !user.isActive) return null;

    const roles = user.roles.map((ur) => ur.role.code);
    const permissions = Array.from(
      new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code))),
    ).sort();

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      departmentId: user.departmentId,
      roles,
      permissions,
    };
  }
}
