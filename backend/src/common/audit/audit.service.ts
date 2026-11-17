import { Injectable, Logger } from '@nestjs/common';
import { requestContext } from '../context/request-context.js';
import { paginate } from '../dto/paginated.js';
import type { Paginated } from '../dto/paginated.js';
import { pageArgs } from '../dto/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuditEntry, AuditLogDto, AuditLogQuery } from './audit.types.js';

const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'newPassword', 'currentPassword']);

/** Deep-clones to plain JSON and strips password-like fields. */
export function sanitizeForAudit(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const cloned: unknown = JSON.parse(
    JSON.stringify(value, (key, v: unknown) => (SENSITIVE_KEYS.has(key) ? undefined : v)),
  );
  return cloned as Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends one audit row. Missing actor/ip/user agent come from the request
   * context. Never throws: a failed audit write must not fail the business
   * operation, but it is logged loudly.
   */
  async record(entry: AuditEntry): Promise<void> {
    const ctx = requestContext.get();
    const data: Prisma.AuditLogUncheckedCreateInput = {
      actorId: entry.actorId !== undefined ? entry.actorId : (ctx?.actorId ?? null),
      action: entry.action,
      module: entry.module,
      entityId: entry.entityId ?? null,
      before: sanitizeForAudit(entry.before),
      after: sanitizeForAudit(entry.after),
      ip: entry.ip !== undefined ? entry.ip : (ctx?.ip ?? null),
      userAgent: entry.userAgent !== undefined ? entry.userAgent : (ctx?.userAgent ?? null),
    };
    try {
      await this.prisma.auditLog.create({ data });
    } catch (error) {
      this.logger.error(
        `Gagal mencatat audit ${entry.module}/${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(q: AuditLogQuery): Promise<Paginated<AuditLogDto>> {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.actorId) where.actorId = q.actorId;
    if (q.module || q.excludeModules?.length) {
      where.module = {
        ...(q.module ? { equals: q.module } : {}),
        ...(q.excludeModules?.length ? { notIn: q.excludeModules } : {}),
      };
    }
    if (q.action) where.action = q.action;
    if (q.entityId) where.entityId = q.entityId;
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(
      rows.map((row) => ({
        id: row.id,
        actor: row.actor ?? null,
        action: row.action,
        module: row.module,
        entityId: row.entityId,
        before: row.before ?? null,
        after: row.after ?? null,
        ip: row.ip,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
      })),
      total,
      q,
    );
  }
}
