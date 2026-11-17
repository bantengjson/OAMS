import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthUserLoader } from '../../modules/auth/auth-user.loader.js';
import { requestContext } from '../context/request-context.js';
import type { AccessTokenPayload, AuthUser } from './auth-user.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export const UNAUTHENTICATED_MESSAGE = 'Autentikasi diperlukan.';

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly loader: AuthUserLoader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }
    if (payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }

    const user = await this.loader.load(payload.sub);
    if (!user) throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);

    request.user = user;
    requestContext.setActor(user.id);
    return true;
  }
}
