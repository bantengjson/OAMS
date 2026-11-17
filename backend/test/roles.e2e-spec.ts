import { permissionsForRole, ROLE_DEFINITIONS } from '../src/common/auth/permissions.catalog.js';
import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

describe('roles & permissions (e2e)', () => {
  let ctx: TestContext;
  let superAdmin: LoginResult;
  let admin: LoginResult;
  let viewer: LoginResult;
  let viewerRoleId: string;
  let superAdminRoleId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    superAdmin = await ctx.loginAs('SUPER_ADMIN');
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    viewerRoleId = (await ctx.prisma.role.findUniqueOrThrow({ where: { code: 'VIEWER' } })).id;
    superAdminRoleId = (
      await ctx.prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } })
    ).id;
  });

  afterAll(async () => {
    // restore the VIEWER baseline so later suites see the seeded matrix
    await ctx
      .http()
      .put(`/api/v1/roles/${viewerRoleId}/permissions`)
      .set(bearer(superAdmin))
      .send({ permissions: [...permissionsForRole('VIEWER')] })
      .expect(200);
    await ctx.close();
  });

  it('requires authentication', async () => {
    await ctx.http().get('/api/v1/roles').expect(401);
  });

  it('VIEWER cannot list roles', async () => {
    const res = await ctx.http().get('/api/v1/roles').set(bearer(viewer)).expect(403);
    expect(res.body.message).toBe('Anda tidak memiliki izin untuk tindakan ini.');
  });

  it('ADMIN_INVENTARIS can list roles with permissions and user counts', async () => {
    const res = await ctx.http().get('/api/v1/roles').set(bearer(admin)).expect(200);
    expect(res.body).toHaveLength(ROLE_DEFINITIONS.length);
    const sa = res.body.find((r: { code: string }) => r.code === 'SUPER_ADMIN');
    expect(sa).toMatchObject({ name: 'Super Admin', isSystem: true });
    expect(Array.isArray(sa.permissions)).toBe(true);
    expect(sa.permissions.length).toBe(permissionsForRole('SUPER_ADMIN').length);
    expect(sa.userCount).toBeGreaterThanOrEqual(1);
  });

  it('GET /roles/:id returns one role', async () => {
    const res = await ctx.http().get(`/api/v1/roles/${viewerRoleId}`).set(bearer(admin)).expect(200);
    expect(res.body.code).toBe('VIEWER');
    const byCode = (a: string, b: string) => a.localeCompare(b);
    expect([...(res.body.permissions as string[])].sort(byCode)).toEqual(
      [...permissionsForRole('VIEWER')].sort(byCode),
    );
  });

  it('GET /roles/:id for an unknown id is 404', async () => {
    await ctx
      .http()
      .get('/api/v1/roles/00000000-0000-0000-0000-000000000000')
      .set(bearer(admin))
      .expect(404);
  });

  it('lists the permission catalog grouped by module', async () => {
    const res = await ctx.http().get('/api/v1/permissions').set(bearer(admin)).expect(200);
    const users = res.body.find((g: { module: string }) => g.module === 'users');
    expect(users.permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'users.manage' })]),
    );
  });

  it('ADMIN_INVENTARIS cannot change permissions', async () => {
    await ctx
      .http()
      .put(`/api/v1/roles/${viewerRoleId}/permissions`)
      .set(bearer(admin))
      .send({ permissions: ['dashboard.view'] })
      .expect(403);
  });

  it('SUPER_ADMIN replaces a role permission set and it is audited', async () => {
    const res = await ctx
      .http()
      .put(`/api/v1/roles/${viewerRoleId}/permissions`)
      .set(bearer(superAdmin))
      .send({ permissions: ['assets.view', 'dashboard.view'] })
      .expect(200);
    expect(res.body.permissions).toEqual(['assets.view', 'dashboard.view']);

    const fetched = await ctx
      .http()
      .get(`/api/v1/roles/${viewerRoleId}`)
      .set(bearer(superAdmin))
      .expect(200);
    expect(fetched.body.permissions).toEqual(['assets.view', 'dashboard.view']);

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'role.permissions_updated', entityId: viewerRoleId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.actorId).toBe(superAdmin.userId);
    expect(audit?.module).toBe('roles');
    expect(audit?.before).toEqual([...permissionsForRole('VIEWER')].sort());
    expect(audit?.after).toEqual(['assets.view', 'dashboard.view']);
  });

  it('a user holding the changed role sees the new permissions on /auth/me', async () => {
    const res = await ctx.http().get('/api/v1/auth/me').set(bearer(viewer)).expect(200);
    expect(res.body.permissions).toEqual(['assets.view', 'dashboard.view']);
  });

  it('refuses to change SUPER_ADMIN permissions', async () => {
    const res = await ctx
      .http()
      .put(`/api/v1/roles/${superAdminRoleId}/permissions`)
      .set(bearer(superAdmin))
      .send({ permissions: ['dashboard.view'] })
      .expect(400);
    expect(res.body.message).toBe('Permission Super Admin tidak dapat diubah.');
  });

  it('rejects unknown permission codes', async () => {
    const res = await ctx
      .http()
      .put(`/api/v1/roles/${viewerRoleId}/permissions`)
      .set(bearer(superAdmin))
      .send({ permissions: ['dashboard.view', 'foo.bar', 'baz.qux'] })
      .expect(400);
    expect(res.body.message).toBe('Kode permission tidak dikenal: foo.bar, baz.qux');
  });

  it('validates the body shape', async () => {
    const res = await ctx
      .http()
      .put(`/api/v1/roles/${viewerRoleId}/permissions`)
      .set(bearer(superAdmin))
      .send({ permissions: 'dashboard.view' })
      .expect(400);
    expect(res.body.message).toBe('Validasi gagal.');
  });
});
