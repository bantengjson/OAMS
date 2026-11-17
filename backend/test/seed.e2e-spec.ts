import request from 'supertest';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '../src/common/auth/permissions.catalog.js';
import { seed } from '../prisma/seed.js';
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
    expect(await ctx.prisma.category.count()).toBe(9);

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

  it('reports the database as up on /health', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });
});
