import { createTestApp, nextForwardedIp, TEST_ADMIN } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const USERS = '/api/v1/users';

describe('users (e2e)', () => {
  let ctx: TestContext;
  let superAdmin: LoginResult;
  let admin: LoginResult;
  let seedAdminId: string;
  let budiId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    superAdmin = await ctx.loginAs('SUPER_ADMIN');
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    seedAdminId = (await ctx.prisma.user.findUniqueOrThrow({ where: { email: TEST_ADMIN.email } }))
      .id;
  });

  afterAll(async () => {
    await ctx.prisma.user.update({ where: { id: seedAdminId }, data: { isActive: true } });
    await ctx.close();
  });

  it('requires users.manage', async () => {
    await ctx.http().get(USERS).expect(401);
    const res = await ctx.http().get(USERS).set(bearer(admin)).expect(403);
    expect(res.body.message).toBe('Anda tidak memiliki izin untuk tindakan ini.');
  });

  it('creates a user with roles, normalising the email', async () => {
    const res = await ctx
      .http()
      .post(USERS)
      .set(bearer(superAdmin))
      .send({
        email: ' Budi@Test.local ',
        fullName: 'Budi Santoso',
        password: 'Budi1234',
        roleCodes: ['PETUGAS_INVENTARIS'],
        phone: '081234567890',
      })
      .expect(201);
    budiId = res.body.id;
    expect(res.body).toMatchObject({
      email: 'budi@test.local',
      fullName: 'Budi Santoso',
      phone: '081234567890',
      isActive: true,
      department: null,
      roles: [{ code: 'PETUGAS_INVENTARIS', name: 'Petugas Inventaris' }],
    });
    expect(res.body).not.toHaveProperty('passwordHash');

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'user.created', entityId: budiId },
    });
    expect(audit?.actorId).toBe(superAdmin.userId);
    expect(JSON.stringify(audit?.after)).not.toMatch(/password/i);
  });

  it('rejects an email that differs only by letter case with 409', async () => {
    const res = await ctx
      .http()
      .post(USERS)
      .set(bearer(superAdmin))
      .send({
        email: 'BUDI@TEST.LOCAL',
        fullName: 'Budi Lagi',
        password: 'Budi1234',
        roleCodes: ['VIEWER'],
      })
      .expect(409);
    expect(res.body.errors).toHaveProperty('email');
  });

  it('enforces password strength and known roles on create', async () => {
    const weak = await ctx
      .http()
      .post(USERS)
      .set(bearer(superAdmin))
      .send({ email: 'lemah@test.local', fullName: 'Lemah', password: 'lemah', roleCodes: ['VIEWER'] })
      .expect(400);
    expect(weak.body.message).toBe('Password minimal 8 karakter dan mengandung huruf serta angka.');

    const badRole = await ctx
      .http()
      .post(USERS)
      .set(bearer(superAdmin))
      .send({ email: 'role@test.local', fullName: 'Role', password: 'Role1234', roleCodes: ['FOO'] })
      .expect(400);
    expect(badRole.body.message).toBe('Role tidak dikenal: FOO');

    const noRole = await ctx
      .http()
      .post(USERS)
      .set(bearer(superAdmin))
      .send({ email: 'norole@test.local', fullName: 'No Role', password: 'Role1234', roleCodes: [] })
      .expect(400);
    expect(noRole.body.message).toBe('Validasi gagal.');
    expect(noRole.body.errors).toHaveProperty('roleCodes');
  });

  it('lists with search, role and status filters and caps pageSize at 100', async () => {
    const tooBig = await ctx
      .http()
      .get(USERS)
      .query({ pageSize: 101 })
      .set(bearer(superAdmin))
      .expect(400);
    expect(tooBig.body.errors).toHaveProperty('pageSize');

    const bySearch = await ctx
      .http()
      .get(USERS)
      .query({ search: 'santoso' })
      .set(bearer(superAdmin))
      .expect(200);
    expect(bySearch.body.data.map((u: { id: string }) => u.id)).toEqual([budiId]);
    expect(bySearch.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 1, totalPages: 1 });

    const byEmail = await ctx
      .http()
      .get(USERS)
      .query({ search: 'budi@' })
      .set(bearer(superAdmin))
      .expect(200);
    expect(byEmail.body.meta.total).toBe(1);

    const byRole = await ctx
      .http()
      .get(USERS)
      .query({ roleCode: 'PETUGAS_INVENTARIS' })
      .set(bearer(superAdmin))
      .expect(200);
    expect(byRole.body.data.some((u: { id: string }) => u.id === budiId)).toBe(true);
    expect(
      byRole.body.data.every((u: { roles: { code: string }[] }) =>
        u.roles.some((r) => r.code === 'PETUGAS_INVENTARIS'),
      ),
    ).toBe(true);
  });

  it('gets and updates profile fields', async () => {
    const got = await ctx.http().get(`${USERS}/${budiId}`).set(bearer(superAdmin)).expect(200);
    expect(got.body.email).toBe('budi@test.local');

    const dept = await ctx.prisma.department.create({
      data: { code: 'TU', name: 'Tata Usaha' },
    });
    const updated = await ctx
      .http()
      .patch(`${USERS}/${budiId}`)
      .set(bearer(superAdmin))
      .send({ fullName: 'Budi S.', phone: null, departmentId: dept.id })
      .expect(200);
    expect(updated.body).toMatchObject({
      fullName: 'Budi S.',
      phone: null,
      department: { id: dept.id, code: 'TU', name: 'Tata Usaha' },
    });

    const badDept = await ctx
      .http()
      .patch(`${USERS}/${budiId}`)
      .set(bearer(superAdmin))
      .send({ departmentId: '00000000-0000-0000-0000-000000000000' })
      .expect(400);
    expect(badDept.body.message).toBe('Unit kerja tidak ditemukan.');

    await ctx
      .http()
      .get(`${USERS}/00000000-0000-0000-0000-000000000000`)
      .set(bearer(superAdmin))
      .expect(404);
  });

  it('replaces roles and audits before/after', async () => {
    const res = await ctx
      .http()
      .put(`${USERS}/${budiId}/roles`)
      .set(bearer(superAdmin))
      .send({ roleCodes: ['VIEWER', 'PETUGAS_INVENTARIS'] })
      .expect(200);
    expect(res.body.roles.map((r: { code: string }) => r.code).sort()).toEqual([
      'PETUGAS_INVENTARIS',
      'VIEWER',
    ]);
    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'user.roles_updated', entityId: budiId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.before).toEqual(['PETUGAS_INVENTARIS']);
    expect(audit?.after).toEqual(['PETUGAS_INVENTARIS', 'VIEWER']);
  });

  it('resets a password and the old one stops working', async () => {
    const weak = await ctx
      .http()
      .post(`${USERS}/${budiId}/reset-password`)
      .set(bearer(superAdmin))
      .send({ newPassword: 'pendek' })
      .expect(400);
    expect(weak.body.message).toBe('Password minimal 8 karakter dan mengandung huruf serta angka.');

    await ctx
      .http()
      .post(`${USERS}/${budiId}/reset-password`)
      .set(bearer(superAdmin))
      .send({ newPassword: 'ResetBaru123' })
      .expect(204);

    await ctx
      .http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextForwardedIp())
      .send({ identifier: 'budi@test.local', password: 'Budi1234' })
      .expect(401);
    const session = await ctx.login('budi@test.local', 'ResetBaru123');
    expect(session.userId).toBe(budiId);
  });

  it('lists a user activity (audit rows where the user is the actor)', async () => {
    const res = await ctx
      .http()
      .get(`${USERS}/${budiId}/activity`)
      .set(bearer(superAdmin))
      .expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toMatchObject({ action: 'auth.login', module: 'auth' });
    expect(res.body.data[0].actor).toMatchObject({ id: budiId });
  });

  it('deactivates and reactivates a user, blocking login while inactive', async () => {
    const off = await ctx
      .http()
      .post(`${USERS}/${budiId}/deactivate`)
      .set(bearer(superAdmin))
      .expect(200);
    expect(off.body.isActive).toBe(false);

    const blocked = await ctx
      .http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextForwardedIp())
      .send({ identifier: 'budi@test.local', password: 'ResetBaru123' })
      .expect(403);
    expect(blocked.body.message).toBe('Akun dinonaktifkan. Hubungi administrator.');

    const inactiveList = await ctx
      .http()
      .get(USERS)
      .query({ isActive: false })
      .set(bearer(superAdmin))
      .expect(200);
    expect(inactiveList.body.data.some((u: { id: string }) => u.id === budiId)).toBe(true);

    const on = await ctx
      .http()
      .post(`${USERS}/${budiId}/activate`)
      .set(bearer(superAdmin))
      .expect(200);
    expect(on.body.isActive).toBe(true);
  });

  it('refuses to deactivate yourself', async () => {
    const res = await ctx
      .http()
      .post(`${USERS}/${superAdmin.userId}/deactivate`)
      .set(bearer(superAdmin))
      .expect(400);
    expect(res.body.message).toBe('Anda tidak dapat menonaktifkan akun sendiri.');
  });

  describe('when users.manage is delegated to a non-Super-Admin', () => {
    let adminRoleId: string;
    let baseline: string[];

    beforeAll(async () => {
      const role = await ctx.http().get('/api/v1/roles').set(bearer(superAdmin)).expect(200);
      const adminRole = role.body.find((r: { code: string }) => r.code === 'ADMIN_INVENTARIS');
      adminRoleId = adminRole.id;
      baseline = adminRole.permissions;
      await ctx
        .http()
        .put(`/api/v1/roles/${adminRoleId}/permissions`)
        .set(bearer(superAdmin))
        .send({ permissions: [...baseline, 'users.manage'] })
        .expect(200);
    });

    afterAll(async () => {
      await ctx
        .http()
        .put(`/api/v1/roles/${adminRoleId}/permissions`)
        .set(bearer(superAdmin))
        .send({ permissions: baseline })
        .expect(200);
    });

    it('cannot create a Super Admin', async () => {
      const res = await ctx
        .http()
        .post(USERS)
        .set(bearer(admin))
        .send({
          email: 'sneaky@test.local',
          fullName: 'Sneaky',
          password: 'Sneaky123',
          roleCodes: ['SUPER_ADMIN'],
        })
        .expect(400);
      expect(res.body.message).toBe('Hanya Super Admin yang dapat menetapkan role Super Admin.');
    });

    it('cannot grant or strip the Super Admin role', async () => {
      await ctx
        .http()
        .put(`${USERS}/${budiId}/roles`)
        .set(bearer(admin))
        .send({ roleCodes: ['SUPER_ADMIN'] })
        .expect(400);
      await ctx
        .http()
        .put(`${USERS}/${seedAdminId}/roles`)
        .set(bearer(admin))
        .send({ roleCodes: ['VIEWER'] })
        .expect(400);
      // ordinary role changes still work
      await ctx
        .http()
        .put(`${USERS}/${budiId}/roles`)
        .set(bearer(admin))
        .send({ roleCodes: ['PETUGAS_INVENTARIS', 'VIEWER'] })
        .expect(200);
    });

    it('cannot deactivate the last active Super Admin', async () => {
      // two active super admins: deactivating one is fine, the other is refused
      await ctx.http().post(`${USERS}/${superAdmin.userId}/deactivate`).set(bearer(admin)).expect(200);
      try {
        const res = await ctx
          .http()
          .post(`${USERS}/${seedAdminId}/deactivate`)
          .set(bearer(admin))
          .expect(400);
        expect(res.body.message).toBe('Sistem harus memiliki minimal satu Super Admin aktif.');
      } finally {
        await ctx.prisma.user.update({ where: { id: superAdmin.userId }, data: { isActive: true } });
        superAdmin = await ctx.loginAs('SUPER_ADMIN');
      }
    });
  });

  it('never lets the last active Super Admin be removed', async () => {
    // two active super admins exist: the seed admin and super_admin@test.local
    await ctx.http().post(`${USERS}/${seedAdminId}/deactivate`).set(bearer(superAdmin)).expect(200);

    const demote = await ctx
      .http()
      .put(`${USERS}/${superAdmin.userId}/roles`)
      .set(bearer(superAdmin))
      .send({ roleCodes: ['VIEWER'] })
      .expect(400);
    expect(demote.body.message).toBe('Sistem harus memiliki minimal satu Super Admin aktif.');

    await ctx.http().post(`${USERS}/${seedAdminId}/activate`).set(bearer(superAdmin)).expect(200);

    // with two again, demoting one is allowed; put it back afterwards
    await ctx
      .http()
      .put(`${USERS}/${seedAdminId}/roles`)
      .set(bearer(superAdmin))
      .send({ roleCodes: ['VIEWER'] })
      .expect(200);
    const lastOne = await ctx
      .http()
      .post(`${USERS}/${seedAdminId}/deactivate`)
      .set(bearer(admin))
      .expect(403);
    expect(lastOne.status).toBe(403);
    await ctx
      .http()
      .put(`${USERS}/${seedAdminId}/roles`)
      .set(bearer(superAdmin))
      .send({ roleCodes: ['SUPER_ADMIN'] })
      .expect(200);
  });
});
