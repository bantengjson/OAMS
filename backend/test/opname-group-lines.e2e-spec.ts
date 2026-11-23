import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { TestTypes } from './utils/fixtures.js';

describe('stock opname: group lines (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let t: TestTypes;
  let sessionId: string;
  let counted: string;
  let differs: string;
  let untouched: string;
  const URL = '/api/v1/stock-opnames';
  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const group = async (name: string, good: number, repair: number, damaged: number) =>
    (
      await ctx
        .http()
        .post('/api/v1/group-items')
        .set(bearer(admin))
        .send({ categoryId: t.group.id, locationId: t.roomA.id, name, acquisitionYear: 2021, qtyGood: good, qtyNeedsRepair: repair, qtyDamaged: damaged })
        .expect(201)
    ).body.id as string;

  const lineOf = async (groupItemId: string) => {
    const res = await ctx.http().get(`${URL}/${sessionId}/group-lines`).set(bearer(petugas)).expect(200);
    return res.body.find((l: { groupItem: { id: string } }) => l.groupItem.id === groupItemId);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    t = await testTypes(ctx.prisma);
    // Only one open session may exist; close leftovers from other suites.
    await ctx.prisma.stockOpname.updateMany({ where: { status: 'OPEN' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    counted = await group('Gelas Hitung', 10, 0, 0);
    differs = await group('Sendok Hitung', 30, 2, 0);
    untouched = await group('Garpu Hitung', 40, 0, 1);
    const res = await ctx.http().post(URL).set(bearer(admin)).send({ name: 'Opname Kelompok', plannedDate: today() }).expect(201);
    sessionId = res.body.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('opname includes group lines with expected counts', async () => {
    const line = await lineOf(differs);
    expect(line).toMatchObject({
      groupItem: { id: differs, name: 'Sendok Hitung', code: 'NG.A/901/DPC/2021', room: { code: 'A' } },
      expected: { good: 30, needsRepair: 2, damaged: 0 },
      counted: null,
      countedAt: null,
    });
  });

  it('count update stored', async () => {
    const line = await lineOf(counted);
    const res = await ctx
      .http()
      .put(`${URL}/${sessionId}/group-lines/${line.id}`)
      .set(bearer(petugas))
      .send({ good: 10, needsRepair: 0, damaged: 0 })
      .expect(200);
    expect(res.body).toMatchObject({ counted: { good: 10, needsRepair: 0, damaged: 0 }, countedBy: { fullName: expect.any(String) } });

    const d = await lineOf(differs);
    await ctx.http().put(`${URL}/${sessionId}/group-lines/${d.id}`).set(bearer(petugas)).send({ good: 25, needsRepair: 3, damaged: 4 }).expect(200);
  });

  it('negative count → 400', async () => {
    const line = await lineOf(counted);
    const res = await ctx.http().put(`${URL}/${sessionId}/group-lines/${line.id}`).set(bearer(petugas)).send({ good: -1, needsRepair: 0, damaged: 0 }).expect(400);
    expect(res.body.errors).toHaveProperty('good');
    await ctx.http().put(`${URL}/${sessionId}/group-lines/${line.id}`).set(bearer(petugas)).send({ good: 1.5, needsRepair: 0, damaged: 0 }).expect(400);
  });

  it('closing applies counted numbers', async () => {
    await ctx.http().post(`${URL}/${sessionId}/close`).set(bearer(admin)).expect(200);
    const item = await ctx.prisma.groupItem.findUniqueOrThrow({ where: { id: differs } });
    expect(item).toMatchObject({ qtyGood: 25, qtyNeedsRepair: 3, qtyDamaged: 4 });
    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'group_item.opname_applied', entityId: differs } });
    expect(audit?.before).toMatchObject({ qtyGood: 30, qtyNeedsRepair: 2, qtyDamaged: 0 });
    expect(audit?.after).toMatchObject({ qtyGood: 25, qtyNeedsRepair: 3, qtyDamaged: 4, opnameId: sessionId });
    // a line that matched leaves no audit entry
    expect(await ctx.prisma.auditLog.count({ where: { action: 'group_item.opname_applied', entityId: counted } })).toBe(0);
  });

  it('uncounted line keeps quantities and is reported as notCounted', async () => {
    const item = await ctx.prisma.groupItem.findUniqueOrThrow({ where: { id: untouched } });
    expect(item).toMatchObject({ qtyGood: 40, qtyNeedsRepair: 0, qtyDamaged: 1 });
    const report = await ctx.http().get(`${URL}/${sessionId}/report`).set(bearer(admin)).expect(200);
    const ids = (list: { groupItem: { id: string } }[]) => list.map((l) => l.groupItem.id);
    expect(ids(report.body.groupLines.matched)).toContain(counted);
    expect(ids(report.body.groupLines.different)).toContain(differs);
    expect(ids(report.body.groupLines.notCounted)).toContain(untouched);
  });

  it('counting after close → 409', async () => {
    const line = await lineOf(counted);
    await ctx.http().put(`${URL}/${sessionId}/group-lines/${line.id}`).set(bearer(petugas)).send({ good: 9, needsRepair: 0, damaged: 0 }).expect(409);
  });
});
