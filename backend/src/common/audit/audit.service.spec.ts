import { Logger } from '@nestjs/common';
import { requestContext } from '../context/request-context.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

function makePrisma() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

describe('AuditService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: AuditService;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuditService(prisma as unknown as PrismaService);
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('fills actor, ip and user agent from the request context', async () => {
    await requestContext.run(
      { requestId: 'r1', ip: '10.0.0.1', userAgent: 'vitest', actorId: 'u1' },
      () =>
        service.record({
          action: 'category.created',
          module: 'categories',
          entityId: 'c1',
          after: { code: 'X' },
        }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'u1',
        ip: '10.0.0.1',
        userAgent: 'vitest',
        action: 'category.created',
        module: 'categories',
        entityId: 'c1',
        after: { code: 'X' },
      }),
    });
  });

  it('prefers explicit values over the context', async () => {
    await requestContext.run(
      { requestId: 'r1', ip: '10.0.0.1', userAgent: 'vitest', actorId: 'u1' },
      () => service.record({ action: 'auth.login_failed', module: 'auth', actorId: null }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: null, ip: '10.0.0.1' }),
    });
  });

  it('records with nulls when no request context is active', async () => {
    await service.record({ action: 'system.seed', module: 'system' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: null, ip: null, userAgent: null }),
    });
  });

  it('does not throw when the insert fails', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('db down'));
    await expect(service.record({ action: 'x', module: 'y' })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('list applies excludeModules, actor and date range filters with pagination', async () => {
    const from = new Date('2026-11-01T00:00:00Z');
    const to = new Date('2026-11-30T23:59:59Z');
    prisma.auditLog.count.mockResolvedValue(45);
    const result = await service.list({
      page: 2,
      pageSize: 20,
      actorId: 'u1',
      module: 'categories',
      excludeModules: ['auth', 'users'],
      from,
      to,
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          actorId: 'u1',
          module: { equals: 'categories', notIn: ['auth', 'users'] },
          createdAt: { gte: from, lte: to },
        },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 20,
      }),
    );
    expect(result.meta).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
  });

  it('setActor on the context is visible to a later record() in the same request', async () => {
    await requestContext.run(
      { requestId: 'r2', ip: null, userAgent: null, actorId: null },
      async () => {
        requestContext.setActor('u9');
        await service.record({ action: 'auth.login', module: 'auth' });
      },
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: 'u9' }),
    });
  });
});
