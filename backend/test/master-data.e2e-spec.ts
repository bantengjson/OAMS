import { createTestApp } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
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

  describe('item types (categories)', () => {
    const URL = '/api/v1/categories';
    let printerId: string;

    const maxNumber = async (golongan: 'BG' | 'NG') =>
      (await ctx.prisma.category.aggregate({ where: { golongan }, _max: { number: true } }))._max.number ?? 0;

    it('VIEWER can list the item types but cannot create', async () => {
      await testTypes(ctx.prisma);
      const list = await ctx.http().get(URL).set(bearer(viewer)).expect(200);
      expect(list.body.meta.total).toBeGreaterThanOrEqual(4);
      const codes = list.body.data.map((c: { code: string }) => c.code);
      expect(codes).toEqual(expect.arrayContaining(['NG-900', 'BG-900']));

      await ctx.http().post(URL).set(bearer(viewer)).send({ golongan: 'NG', name: 'X' }).expect(403);
      await ctx.http().get(URL).expect(401);
    });

    it('creates NG type with next number', async () => {
      const expected = (await maxNumber('NG')) + 1;
      const res = await ctx
        .http()
        .post(URL)
        .set(bearer(admin))
        .send({ golongan: 'NG', name: ' Printer ', description: 'Printer dan scanner' })
        .expect(201);
      printerId = res.body.id;
      expect(res.body).toMatchObject({
        golongan: 'NG',
        number: expected,
        code: `NG-${String(expected).padStart(3, '0')}`,
        name: 'Printer',
        label: `NG ${String(expected).padStart(3, '0')} · Printer`,
        isGroup: false,
        inUse: false,
        isActive: true,
      });
      const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'category.created', entityId: printerId } });
      expect(audit?.actorId).toBe(admin.userId);
    });

    it('rejects duplicate number in same golongan (409)', async () => {
      const res = await ctx.http().post(URL).set(bearer(admin)).send({ golongan: 'NG', number: 900, name: 'Kembar' }).expect(409);
      expect(res.body.message).toBe('Nomor jenis sudah dipakai di golongan ini.');
    });

    it('allows same number in other golongan', async () => {
      const res = await ctx.http().post(URL).set(bearer(admin)).send({ golongan: 'BG', number: 901, name: 'Motor Uji' }).expect(201);
      expect(res.body).toMatchObject({ golongan: 'BG', number: 901, code: 'BG-901' });
      expect(await ctx.prisma.category.count({ where: { number: 901 } })).toBe(2); // NG 901 is the fixture group type
    });

    it('validates golongan, number range and required name', async () => {
      const res = await ctx.http().post(URL).set(bearer(admin)).send({ golongan: 'XX', number: 1000, name: '' }).expect(400);
      expect(res.body.errors).toHaveProperty('golongan');
      expect(res.body.errors).toHaveProperty('number');
      expect(res.body.errors).toHaveProperty('name');
    });

    it('gets, updates and searches', async () => {
      const got = await ctx.http().get(`${URL}/${printerId}`).set(bearer(petugas)).expect(200);
      expect(got.body.name).toBe('Printer');

      const updated = await ctx
        .http()
        .patch(`${URL}/${printerId}`)
        .set(bearer(admin))
        .send({ name: 'Printer & Scanner', description: null })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Printer & Scanner', description: null });

      const search = await ctx.http().get(URL).query({ search: 'scanner' }).set(bearer(admin)).expect(200);
      expect(search.body.data.map((c: { id: string }) => c.id)).toEqual([printerId]);

      await ctx.http().get(`${URL}/00000000-0000-0000-0000-000000000000`).set(bearer(admin)).expect(404);
      await ctx.http().get(`${URL}/bukan-uuid`).set(bearer(admin)).expect(400);
    });

    it('locks golongan/number/isGroup once used', async () => {
      const { roomA } = await testTypes(ctx.prisma);
      const free = await ctx.http().patch(`${URL}/${printerId}`).set(bearer(admin)).send({ number: 980 }).expect(200);
      expect(free.body).toMatchObject({ number: 980, code: 'NG-980' });

      await ctx.prisma.asset.create({
        data: {
          assetCode: 'UJI-KUNCI-01', name: 'Printer Uji', categoryId: printerId, locationId: roomA.id,
          ownershipType: 'OFFICE', acquisitionMethod: 'PURCHASE', condition: 'GOOD', status: 'AVAILABLE',
        },
      });
      for (const body of [{ number: 981 }, { golongan: 'BG' }, { isGroup: true }]) {
        const res = await ctx.http().patch(`${URL}/${printerId}`).set(bearer(admin)).send(body).expect(409);
        expect(res.body.message).toBe('Jenis sudah dipakai; golongan, nomor, dan jenis kelompok tidak bisa diubah.');
      }
      const got = await ctx.http().get(`${URL}/${printerId}`).set(bearer(admin)).expect(200);
      expect(got.body).toMatchObject({ number: 980, inUse: true });
      // a name change is still allowed
      await ctx.http().patch(`${URL}/${printerId}`).set(bearer(admin)).send({ name: 'Printer Kantor' }).expect(200);
    });

    it('filters by golongan and isGroup, BG first then by number', async () => {
      const groups = await ctx.http().get(URL).query({ isGroup: true, pageSize: 100 }).set(bearer(admin)).expect(200);
      expect(groups.body.data.length).toBeGreaterThanOrEqual(1);
      expect(groups.body.data.every((c: { isGroup: boolean }) => c.isGroup)).toBe(true);

      const bg = await ctx.http().get(URL).query({ golongan: 'BG', pageSize: 100 }).set(bearer(admin)).expect(200);
      expect(bg.body.data.every((c: { golongan: string }) => c.golongan === 'BG')).toBe(true);

      const all = await ctx.http().get(URL).query({ pageSize: 100 }).set(bearer(admin)).expect(200);
      const keys = all.body.data.map((c: { golongan: string; number: number }) => `${c.golongan}${String(c.number).padStart(3, '0')}`);
      expect(keys).toEqual([...keys].sort());
    });

    it('deactivates and reactivates, filtering by isActive', async () => {
      const off = await ctx.http().post(`${URL}/${printerId}/deactivate`).set(bearer(admin)).expect(200);
      expect(off.body.isActive).toBe(false);
      const active = await ctx.http().get(URL).query({ isActive: true, pageSize: 100 }).set(bearer(admin)).expect(200);
      expect(active.body.data.some((c: { id: string }) => c.id === printerId)).toBe(false);
      await ctx.http().post(`${URL}/${printerId}/deactivate`).set(bearer(petugas)).expect(403);
      const on = await ctx.http().post(`${URL}/${printerId}/activate`).set(bearer(admin)).expect(200);
      expect(on.body.isActive).toBe(true);

      const actions = await ctx.prisma.auditLog.findMany({ where: { entityId: printerId, module: 'categories' }, select: { action: true } });
      expect(actions.map((a) => a.action)).toEqual(
        expect.arrayContaining(['category.created', 'category.updated', 'category.deactivated', 'category.activated']),
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
