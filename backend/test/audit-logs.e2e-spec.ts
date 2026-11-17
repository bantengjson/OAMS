import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/audit-logs';

interface Row {
  module: string;
  action: string;
  actor: { id: string } | null;
}

describe('audit logs (e2e)', () => {
  let ctx: TestContext;
  let superAdmin: LoginResult;
  let admin: LoginResult;
  let petugas: LoginResult;
  let categoryId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    superAdmin = await ctx.loginAs('SUPER_ADMIN');
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');

    // produce rows in a restricted module (users) and an operational one (categories)
    await ctx
      .http()
      .post('/api/v1/users')
      .set(bearer(superAdmin))
      .send({
        email: 'audit-target@test.local',
        fullName: 'Audit Target',
        password: 'Audit1234',
        roleCodes: ['VIEWER'],
      })
      .expect(201);
    const cat = await ctx
      .http()
      .post('/api/v1/categories')
      .set(bearer(admin))
      .send({ code: 'AUDIT_CAT', name: 'Kategori Audit' })
      .expect(201);
    categoryId = cat.body.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('requires an audit permission', async () => {
    await ctx.http().get(URL).expect(401);
    const res = await ctx.http().get(URL).set(bearer(petugas)).expect(403);
    expect(res.body.message).toBe('Anda tidak memiliki izin untuk tindakan ini.');
  });

  it('SUPER_ADMIN sees every module, including users and auth', async () => {
    const res = await ctx.http().get(URL).query({ pageSize: 100 }).set(bearer(superAdmin)).expect(200);
    const modules = new Set((res.body.data as Row[]).map((r) => r.module));
    expect(modules.has('users')).toBe(true);
    expect(modules.has('auth')).toBe(true);
    expect(modules.has('categories')).toBe(true);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  it('ADMIN_INVENTARIS only sees operational modules', async () => {
    const res = await ctx.http().get(URL).query({ pageSize: 100 }).set(bearer(admin)).expect(200);
    const modules = new Set((res.body.data as Row[]).map((r) => r.module));
    expect(modules.has('categories')).toBe(true);
    expect(modules.has('users')).toBe(false);
    expect(modules.has('auth')).toBe(false);
    expect(modules.has('roles')).toBe(false);

    // asking for a restricted module explicitly yields nothing, not an error
    const sneaky = await ctx.http().get(URL).query({ module: 'users' }).set(bearer(admin)).expect(200);
    expect(sneaky.body.meta.total).toBe(0);
  });

  it('filters by module, action, entity, actor and date range', async () => {
    const today = new Date();
    const from = new Date(today.getTime() - 60 * 60 * 1000).toISOString();
    const to = new Date(today.getTime() + 60 * 60 * 1000).toISOString();

    const res = await ctx
      .http()
      .get(URL)
      .query({ module: 'categories', action: 'category.created', entityId: categoryId, from, to })
      .set(bearer(superAdmin))
      .expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      module: 'categories',
      action: 'category.created',
      entityId: categoryId,
      actor: { id: admin.userId, email: admin.email },
    });
    expect(res.body.data[0].after).toMatchObject({ code: 'AUDIT_CAT' });

    const byActor = await ctx
      .http()
      .get(URL)
      .query({ actorId: admin.userId, pageSize: 100 })
      .set(bearer(superAdmin))
      .expect(200);
    expect((byActor.body.data as Row[]).every((r) => r.actor?.id === admin.userId)).toBe(true);

    const future = await ctx
      .http()
      .get(URL)
      .query({ from: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString() })
      .set(bearer(superAdmin))
      .expect(200);
    expect(future.body.meta.total).toBe(0);
  });

  it('validates query parameters', async () => {
    const res = await ctx
      .http()
      .get(URL)
      .query({ from: 'bukan-tanggal', pageSize: 500 })
      .set(bearer(superAdmin))
      .expect(400);
    expect(res.body.errors).toHaveProperty('from');
    expect(res.body.errors).toHaveProperty('pageSize');
  });

  it('is newest first', async () => {
    const res = await ctx.http().get(URL).query({ pageSize: 5 }).set(bearer(superAdmin)).expect(200);
    const times = (res.body.data as { createdAt: string }[]).map((r) => Date.parse(r.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});
