import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { requestContext } from '../../common/context/request-context.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { EnvService } from '../../config/env.service.js';

export const INVALID_SESSION_MESSAGE = 'Sesi tidak valid.';

/**
 * How long a just-rotated token may be presented again without being treated
 * as theft. Covers two tabs (or React StrictMode) refreshing at the same
 * moment with the same cookie. Logged-out tokens never get this grace.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;

export interface IssuedRefreshToken {
  raw: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Opaque, rotating refresh tokens. Only the SHA-256 of a token is stored, so a
 * database leak does not yield usable sessions. Presenting an already-rotated
 * token is treated as theft and revokes every session of that user.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  private expiry(): Date {
    return new Date(Date.now() + this.env.get('REFRESH_TOKEN_TTL_DAYS') * 24 * 60 * 60 * 1000);
  }

  async issue(userId: string): Promise<IssuedRefreshToken> {
    const raw = randomBytes(48).toString('base64url');
    const expiresAt = this.expiry();
    const ctx = requestContext.get();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        expiresAt,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
      },
    });
    return { raw, expiresAt };
  }

  async rotate(raw: string): Promise<RotatedRefreshToken> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(raw) },
    });
    if (!current) throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    const now = new Date();

    if (current.revokedAt) {
      const rotatedRecently =
        current.replacedById !== null &&
        now.getTime() - current.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
      if (!rotatedRecently) {
        // Replay of an old rotated token, or of a logged-out one: kill the family.
        await this.revokeAllForUser(current.userId);
        throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
      }
      // Benign concurrent refresh: hand out another successor, keep the family alive.
      const issued = await this.issue(current.userId);
      return { userId: current.userId, ...issued };
    }
    if (current.expiresAt <= now) {
      await this.prisma.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const nextRaw = randomBytes(48).toString('base64url');
    const expiresAt = this.expiry();
    const ctx = requestContext.get();
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: current.userId,
          tokenHash: hashToken(nextRaw),
          expiresAt,
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
        },
      });
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: now, replacedById: created.id },
      });
    });

    return { userId: current.userId, raw: nextRaw, expiresAt };
  }

  /** Revokes one token; returns its owner when it existed. */
  async revoke(raw: string): Promise<string | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(raw) },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!row) return null;
    if (!row.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date() },
      });
    }
    return row.userId;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
