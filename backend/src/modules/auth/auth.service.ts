import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AccessTokenPayload, AuthUser } from '../../common/auth/auth-user.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { EnvService } from '../../config/env.service.js';
import { AuthUserLoader } from './auth-user.loader.js';
import { PasswordService } from './password.service.js';
import { INVALID_SESSION_MESSAGE, RefreshTokenService } from './refresh-token.service.js';
import type { IssuedRefreshToken } from './refresh-token.service.js';

export const BAD_CREDENTIALS_MESSAGE = 'Email atau password salah.';
export const INACTIVE_ACCOUNT_MESSAGE = 'Akun dinonaktifkan. Hubungi administrator.';

export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface AuthResult {
  tokens: AuthTokens;
  refresh: IssuedRefreshToken;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService implements OnModuleInit {
  /** Verified against on unknown emails so timing does not reveal account existence. */
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly loader: AuthUserLoader,
    private readonly audit: AuditService,
    private readonly env: EnvService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.passwords.hash('dummy-password-for-timing');
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    const valid = await this.passwords.verify(user?.passwordHash ?? this.dummyHash, password);

    if (!user || !valid) {
      await this.audit.record({
        action: 'auth.login_failed',
        module: 'auth',
        actorId: user?.id ?? null,
        entityId: user?.id ?? null,
        after: { email: normalized, reason: user ? 'wrong_password' : 'unknown_email' },
      });
      throw new UnauthorizedException(BAD_CREDENTIALS_MESSAGE);
    }
    if (!user.isActive) {
      await this.audit.record({
        action: 'auth.login_failed',
        module: 'auth',
        actorId: user.id,
        entityId: user.id,
        after: { email: normalized, reason: 'inactive' },
      });
      throw new ForbiddenException(INACTIVE_ACCOUNT_MESSAGE);
    }

    const authUser = await this.loader.load(user.id);
    if (!authUser) throw new ForbiddenException(INACTIVE_ACCOUNT_MESSAGE);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const refresh = await this.refreshTokens.issue(user.id);
    await this.audit.record({
      action: 'auth.login',
      module: 'auth',
      actorId: user.id,
      entityId: user.id,
    });

    return { tokens: await this.buildTokens(authUser), refresh };
  }

  async refresh(rawToken: string | undefined): Promise<AuthResult> {
    if (!rawToken) throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    const rotated = await this.refreshTokens.rotate(rawToken);
    const authUser = await this.loader.load(rotated.userId);
    if (!authUser) {
      await this.refreshTokens.revokeAllForUser(rotated.userId);
      throw new ForbiddenException(INACTIVE_ACCOUNT_MESSAGE);
    }
    return {
      tokens: await this.buildTokens(authUser),
      refresh: { raw: rotated.raw, expiresAt: rotated.expiresAt },
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    const userId = rawToken ? await this.refreshTokens.revoke(rawToken) : null;
    if (userId) {
      await this.audit.record({
        action: 'auth.logout',
        module: 'auth',
        actorId: userId,
        entityId: userId,
      });
    }
  }

  async changePassword(
    user: AuthUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await this.passwords.verify(row.passwordHash, currentPassword))) {
      throw new BadRequestException('Password saat ini salah.');
    }
    this.passwords.assertStrong(newPassword);
    if (await this.passwords.verify(row.passwordHash, newPassword)) {
      throw new BadRequestException('Password baru tidak boleh sama dengan password lama.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });
    await this.refreshTokens.revokeAllForUser(user.id);
    await this.audit.record({
      action: 'auth.password_changed',
      module: 'auth',
      actorId: user.id,
      entityId: user.id,
    });
  }

  private async buildTokens(user: AuthUser): Promise<AuthTokens> {
    const expiresIn = this.env.get('JWT_ACCESS_TTL_SECONDS');
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, type: 'access' };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });
    return { accessToken, tokenType: 'Bearer', expiresIn, user };
  }
}
