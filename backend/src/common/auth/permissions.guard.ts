import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from './auth-user.js';
import type { PermissionCode } from './permissions.catalog.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';

export const FORBIDDEN_MESSAGE = 'Anda tidak memiliki izin untuk tindakan ini.';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) throw new ForbiddenException(FORBIDDEN_MESSAGE);

    const held = new Set(user.permissions);
    const missing = required.filter((code) => !held.has(code));
    if (missing.length > 0) throw new ForbiddenException(FORBIDDEN_MESSAGE);
    return true;
  }
}
