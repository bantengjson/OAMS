import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthUser } from './auth-user.js';
import { PermissionsGuard, FORBIDDEN_MESSAGE } from './permissions.guard.js';

function makeContext(user: Partial<AuthUser> | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function makeGuard(required: string[] | undefined): PermissionsGuard {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(required) } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

describe('PermissionsGuard', () => {
  it('allows routes without permission metadata', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext({ permissions: [] }))).toBe(true);
  });

  it('allows when the user holds every required permission', () => {
    const guard = makeGuard(['users.manage', 'roles.view']);
    expect(
      guard.canActivate(makeContext({ permissions: ['roles.view', 'users.manage', 'x.y'] })),
    ).toBe(true);
  });

  it('forbids when any required permission is missing', () => {
    const guard = makeGuard(['users.manage', 'roles.manage']);
    expect(() => guard.canActivate(makeContext({ permissions: ['users.manage'] }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(makeContext({ permissions: ['users.manage'] }))).toThrow(
      FORBIDDEN_MESSAGE,
    );
  });

  it('forbids when no user is attached to the request', () => {
    const guard = makeGuard(['users.manage']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
