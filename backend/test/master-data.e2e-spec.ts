import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

describe('categories & departments (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let viewer: LoginResult;
  let petugas: LoginResult;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('categories', () => {
    const URL = '/api/v1/categories';
    let printerId: string;

    it('VIEWER can list the seeded categories but cannot create', async () => {
      const list = await ctx.http().get(URL).set(bearer(viewer)).expect(200);
      expect(list.body.meta.total).toBeGreaterThanOrEqual(9);
      const codes = list.body.data.map((c: { code: string }) => c.code);
      expect(codes).toEqual(expect.arrayContaining(['ELEKTRONIK', 'KOMPUTER_IT', 'LAINNYA']));

      await ctx.http().post(URL).set(bearer(viewer)).send({ code: 'X', name: 'X' }).expect(403);
      await ctx.http().get(URL).expect(401);
    });

    it('ADMIN_INVENTARIS creates a category; the code is upper-cased', async () => {
      const res = await ctx
        .http()
        .post(URL)
        .set(bearer(admin))
        .send({ code: ' printer ', name: 'Printer', description: 'Printer dan scanner' })
        .expect(201);
      printerId = res.body.id;
      expect(res.body).toMatchObject({
        code: 'PRINTER',
        name: 'Printer',
        description: 'Printer dan scanner',
        isActive: true,
      });
      const audit = await ctx.prisma.auditLog.findFirst({
        where: { action: 'category.created', entityId: printerId },
      });
      expect(audit?.actorId).toBe(admin.userId);
    });

    it('rejects a duplicate code with 409 naming the field', async () => {
      const res = await ctx
        .http()
        .post(URL)
        .set(bearer(admin))
        .send({ code: 'printer', name: 'Printer 2' })
        .expect(409);
      expect(res.body.message).toBe('Data dengan nilai yang sama sudah ada.');
      expect(res.body.errors).toHaveProperty('code');
    });

    it('validates the code format and required name', async () => {
      const res = await ctx
        .http()
        .post(URL)
        .set(bearer(admin))
        .send({ code: 'a b', name: '' })
        .expect(400);
      expect(res.body.message).toBe('Validasi gagal.');
      expect(res.body.errors.code).toContain(
        'Kode hanya boleh huruf besar, angka dan garis bawah (2-20 karakter).',
      );
      expect(res.body.errors).toHaveProperty('name');
    });

    it('gets, updates and searches', async () => {
      const got = await ctx.http().get(`${URL}/${printerId}`).set(bearer(petugas)).expect(200);
      expect(got.body.code).toBe('PRINTER');

      const updated = await ctx
        .http()
        .patch(`${URL}/${printerId}`)
        .set(bearer(admin))
        .send({ name: 'Printer & Scanner', description: null })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Printer & Scanner', description: null });

      const search = await ctx
        .http()
        .get(URL)
        .query({ search: 'scanner' })
        .set(bearer(admin))
        .expect(200);
      expect(search.body.data.map((c: { id: string }) => c.id)).toEqual([printerId]);

      await ctx
        .http()
        .get(`${URL}/00000000-0000-0000-0000-000000000000`)
        .set(bearer(admin))
        .expect(404);
      await ctx.http().get(`${URL}/bukan-uuid`).set(bearer(admin)).expect(400);
    });

    it('deactivates and reactivates, filtering by isActive', async () => {
      const off = await ctx
        .http()
        .post(`${URL}/${printerId}/deactivate`)
        .set(bearer(admin))
        .expect(200);
      expect(off.body.isActive).toBe(false);

      const active = await ctx
        .http()
        .get(URL)
        .query({ isActive: true })
        .set(bearer(admin))
        .expect(200);
      expect(active.body.data.some((c: { id: string }) => c.id === printerId)).toBe(false);

      const inactive = await ctx
        .http()
        .get(URL)
        .query({ isActive: false })
        .set(bearer(admin))
        .expect(200);
      expect(inactive.body.data.some((c: { id: string }) => c.id === printerId)).toBe(true);

      await ctx.http().post(`${URL}/${printerId}/deactivate`).set(bearer(petugas)).expect(403);

      const on = await ctx
        .http()
        .post(`${URL}/${printerId}/activate`)
        .set(bearer(admin))
        .expect(200);
      expect(on.body.isActive).toBe(true);

      const actions = await ctx.prisma.auditLog.findMany({
        where: { entityId: printerId, module: 'categories' },
        select: { action: true },
      });
      expect(actions.map((a) => a.action)).toEqual(
        expect.arrayContaining([
          'category.created',
          'category.updated',
          'category.deactivated',
          'category.activated',
        ]),
      );
    });
  });

  describe('departments', () => {
    const URL = '/api/v1/departments';
    let keuanganId: string;

    it('creates, lists, updates and toggles a department', async () => {
      const created = await ctx
        .http()
        .post(URL)
        .set(bearer(admin))
        .send({ code: 'keu', name: 'Keuangan' })
        .expect(201);
      keuanganId = created.body.id;
      expect(created.body).toMatchObject({ code: 'KEU', name: 'Keuangan', isActive: true });

      const dup = await ctx
        .http()
        .post(URL)
        .set(bearer(admin))
        .send({ code: 'KEU', name: 'Keuangan Dua' })
        .expect(409);
      expect(dup.body.errors).toHaveProperty('code');

      const list = await ctx.http().get(URL).set(bearer(viewer)).expect(200);
      expect(list.body.data.some((d: { id: string }) => d.id === keuanganId)).toBe(true);

      await ctx.http().post(URL).set(bearer(petugas)).send({ code: 'HRD', name: 'HRD' }).expect(403);

      const updated = await ctx
        .http()
        .patch(`${URL}/${keuanganId}`)
        .set(bearer(admin))
        .send({ name: 'Keuangan dan Aset' })
        .expect(200);
      expect(updated.body.name).toBe('Keuangan dan Aset');

      const off = await ctx
        .http()
        .post(`${URL}/${keuanganId}/deactivate`)
        .set(bearer(admin))
        .expect(200);
      expect(off.body.isActive).toBe(false);
      const on = await ctx
        .http()
        .post(`${URL}/${keuanganId}/activate`)
        .set(bearer(admin))
        .expect(200);
      expect(on.body.isActive).toBe(true);

      const audit = await ctx.prisma.auditLog.findFirst({
        where: { action: 'department.created', entityId: keuanganId },
      });
      expect(audit?.module).toBe('departments');
    });
  });
});
