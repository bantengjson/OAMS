import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { TestTypes } from './utils/fixtures.js';

describe('group items (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let viewer: LoginResult;
  let t: TestTypes;
  let plateId: string;
  const URL = '/api/v1/group-items';
  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const body = (extra: Record<string, unknown> = {}) => ({
    categoryId: t.group.id,
    locationId: t.roomA.id,
    name: 'Piring Makan',
    acquisitionYear: 2022,
    qtyGood: 20,
    qtyNeedsRepair: 0,
    qtyDamaged: 2,
    ...extra,
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    t = await testTypes(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates group item and shows code', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ specification: 'Keramik putih' })).expect(201);
    plateId = res.body.id;
    expect(res.body).toMatchObject({
      code: 'NG.A/901/DPC/2022',
      name: 'Piring Makan',
      specification: 'Keramik putih',
      type: { golongan: 'NG', number: 901, name: 'Piring Uji' },
      room: { code: 'A', name: 'Sekretariat' },
      qtyGood: 20,
      qtyNeedsRepair: 0,
      qtyDamaged: 2,
      total: 22,
      archivedAt: null,
    });
    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'group_item.created', entityId: plateId } });
    expect(audit?.actorId).toBe(admin.userId);
  });

  it('allows a second row of the same type, room and year with another source', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ source: 'Hibah Ibu Uji', qtyGood: 5, qtyDamaged: 0 })).expect(201);
    expect(res.body).toMatchObject({ code: 'NG.A/901/DPC/2022', source: 'Hibah Ibu Uji', total: 5 });
  });

  it('non-group type → 400', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ categoryId: t.ng.id })).expect(400);
    expect(res.body.message).toBe('Jenis ini bukan jenis Barang Kelompok.');
  });

  it('room and year are required', async () => {
    const noRoom = await ctx.http().post(URL).set(bearer(admin)).send(body({ locationId: undefined })).expect(400);
    expect(noRoom.body.errors).toHaveProperty('locationId');
    const noYear = await ctx.http().post(URL).set(bearer(admin)).send(body({ acquisitionYear: undefined })).expect(400);
    expect(noYear.body.errors).toHaveProperty('acquisitionYear');
  });

  it('negative quantity → 400', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ qtyGood: -1 })).expect(400);
    expect(res.body.errors).toHaveProperty('qtyGood');
  });

  it('non-integer quantity → 400', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ qtyDamaged: 1.5 })).expect(400);
    expect(res.body.errors).toHaveProperty('qtyDamaged');
  });

  it('update without reason → 400', async () => {
    const res = await ctx.http().patch(`${URL}/${plateId}`).set(bearer(admin)).send({ qtyGood: 18 }).expect(400);
    expect(res.body.errors).toHaveProperty('reason');
  });

  it('update records before/after in history', async () => {
    const res = await ctx
      .http()
      .patch(`${URL}/${plateId}`)
      .set(bearer(admin))
      .send({ qtyGood: 18, qtyDamaged: 4, locationId: t.roomB.id, reason: 'Dua piring pecah, pindah ke ruang B' })
      .expect(200);
    expect(res.body).toMatchObject({ qtyGood: 18, qtyDamaged: 4, total: 22, room: { code: 'B' }, code: 'NG.B/901/DPC/2022' });
    const history = await ctx.http().get(`${URL}/${plateId}/history`).set(bearer(viewer)).expect(200);
    const update = history.body.data.find((h: { action: string }) => h.action === 'group_item.updated');
    expect(update.before).toMatchObject({ qtyGood: 20, qtyDamaged: 2 });
    expect(update.after).toMatchObject({ qtyGood: 18, qtyDamaged: 4, reason: 'Dua piring pecah, pindah ke ruang B' });
  });

  it('viewer cannot create (403) but can list and filter by room', async () => {
    await ctx.http().post(URL).set(bearer(viewer)).send(body()).expect(403);
    const list = await ctx.http().get(URL).query({ locationId: t.roomB.id }).set(bearer(viewer)).expect(200);
    expect(list.body.data.map((g: { id: string }) => g.id)).toContain(plateId);
    const search = await ctx.http().get(URL).query({ search: 'piring makan' }).set(bearer(viewer)).expect(200);
    expect(search.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('archive hides from default list', async () => {
    await ctx.http().post(`${URL}/${plateId}/archive`).set(bearer(admin)).send({ reason: 'Diganti baru' }).expect(200);
    const list = await ctx.http().get(URL).query({ pageSize: 100 }).set(bearer(viewer)).expect(200);
    expect(list.body.data.some((g: { id: string }) => g.id === plateId)).toBe(false);
    const all = await ctx.http().get(URL).query({ includeArchived: true, pageSize: 100 }).set(bearer(viewer)).expect(200);
    expect(all.body.data.some((g: { id: string }) => g.id === plateId)).toBe(true);
    await ctx.http().patch(`${URL}/${plateId}`).set(bearer(admin)).send({ qtyGood: 1, reason: 'Coba ubah arsip' }).expect(400);
  });

  it('summary counts active types and units', async () => {
    const svc = (await import('../src/modules/group-items/group-items.service.js')).GroupItemsService;
    const summary = await ctx.app.get(svc).summary();
    expect(summary.types).toBeGreaterThanOrEqual(1);
    expect(summary.units).toBeGreaterThanOrEqual(5);
  });
});
