import request from 'supertest';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '../src/common/auth/permissions.catalog.js';
import { INITIAL_CATEGORIES, seed } from '../src/database/seed.js';
import { createTestApp, TEST_ADMIN } from './utils/app.js';
import type { TestContext } from './utils/app.js';

describe('database seed (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('seeds roles, permissions, categories and the super admin', async () => {
    expect(await ctx.prisma.role.count()).toBe(ROLE_DEFINITIONS.length);
    expect(await ctx.prisma.permission.count()).toBe(PERMISSION_DEFINITIONS.length);
    // other suites may add categories; assert the seeded nine specifically
    expect(
      await ctx.prisma.category.count({
        where: { code: { in: INITIAL_CATEGORIES.map((c) => c.code) } },
      }),
    ).toBe(9);
    expect(INITIAL_CATEGORIES).toHaveLength(9);

    const admin = await ctx.prisma.user.findUnique({
      where: { email: TEST_ADMIN.email },
      include: { roles: { include: { role: true } } },
    });
    expect(admin?.isActive).toBe(true);
    expect(admin?.roles.map((r) => r.role.code)).toEqual(['SUPER_ADMIN']);

    const superAdmin = await ctx.prisma.role.findUnique({
      where: { code: 'SUPER_ADMIN' },
      include: { permissions: true },
    });
    expect(superAdmin?.isSystem).toBe(true);
    expect(superAdmin?.permissions.length).toBe(PERMISSION_DEFINITIONS.length);
  });

  it('gives each role exactly the permissions of the blueprint matrix', async () => {
    for (const def of ROLE_DEFINITIONS) {
      const role = await ctx.prisma.role.findUniqueOrThrow({
        where: { code: def.code },
        include: { permissions: { include: { permission: true } } },
      });
      const codes = role.permissions.map((p) => p.permission.code).sort();
      const expected =
        def.permissions === 'ALL'
          ? PERMISSION_DEFINITIONS.map((p) => p.code).sort()
          : [...def.permissions].sort();
      expect(codes).toEqual(expected);
    }
  });

  it('is idempotent', async () => {
    const before = {
      roles: await ctx.prisma.role.count(),
      permissions: await ctx.prisma.permission.count(),
      categories: await ctx.prisma.category.count(),
      users: await ctx.prisma.user.count(),
    };
    await seed(ctx.prisma, {
      adminEmail: TEST_ADMIN.email,
      adminPassword: TEST_ADMIN.password,
      adminName: TEST_ADMIN.fullName,
    });
    expect({
      roles: await ctx.prisma.role.count(),
      permissions: await ctx.prisma.permission.count(),
      categories: await ctx.prisma.category.count(),
      users: await ctx.prisma.user.count(),
    }).toEqual(before);
  });

  it('does not re-grant a permission an admin revoked from a role', async () => {
    const viewer = await ctx.prisma.role.findUniqueOrThrow({ where: { code: 'VIEWER' } });
    const reportsView = await ctx.prisma.permission.findUniqueOrThrow({
      where: { code: 'reports.view' },
    });
    await ctx.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: viewer.id, permissionId: reportsView.id } },
    });
    try {
      await seed(ctx.prisma, {
        adminEmail: TEST_ADMIN.email,
        adminPassword: TEST_ADMIN.password,
        adminName: TEST_ADMIN.fullName,
      });
      const stillRevoked = await ctx.prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: viewer.id, permissionId: reportsView.id } },
      });
      expect(stillRevoked).toBeNull();
    } finally {
      await ctx.prisma.rolePermission.create({
        data: { roleId: viewer.id, permissionId: reportsView.id },
      });
    }
  });

  it('grants a newly introduced permission to every role whose baseline includes it', async () => {
    // simulate a permission that did not exist in an older deployment
    await ctx.prisma.permission.delete({ where: { code: 'qr.scan' } });
    await seed(ctx.prisma, {
      adminEmail: TEST_ADMIN.email,
      adminPassword: TEST_ADMIN.password,
      adminName: TEST_ADMIN.fullName,
    });
    const holders = await ctx.prisma.rolePermission.findMany({
      where: { permission: { code: 'qr.scan' } },
      include: { role: { select: { code: true } } },
    });
    expect(holders.map((h) => h.role.code).sort()).toEqual([
      'ADMIN_INVENTARIS',
      'PETUGAS_INVENTARIS',
      'SUPER_ADMIN',
      'VIEWER',
    ]);
  });

  it('reports the database as up on /health', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });
});
