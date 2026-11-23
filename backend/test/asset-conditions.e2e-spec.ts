import { createTestApp } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { LoginResult, TestContext } from './utils/app.js';

describe('asset condition logs & assignments (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let viewer: LoginResult;
  let assetId: string;
  let archivedId: string;
  let employeeId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const logsUrl = (id = assetId) => `/api/v1/assets/${id}/condition-logs`;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    const p = ctx.prisma;
    const category = (await testTypes(p)).ng;
    const office = await p.location.create({ data: { code: 'CND_HQ', name: 'Kantor Kondisi', type: 'OFFICE' } });
    employeeId = (await p.employee.create({ data: { fullName: 'Pegawai Kondisi' } })).id;
    const base = {
      name: 'Kursi Kondisi',
      categoryId: category.id,
      locationId: office.id,
      ownershipType: 'OFFICE',
      acquisitionMethod: 'PURCHASE',
      condition: 'GOOD',
      status: 'IN_USE',
      responsibleEmployeeId: employeeId,
    };
    assetId = (await ctx.http().post('/api/v1/assets').set(bearer(admin)).send(base).expect(201)).body.id;
    archivedId = (
      await ctx.http().post('/api/v1/assets').set(bearer(admin)).send({ ...base, name: 'Kursi Arsip' }).expect(201)
    ).body.id;
    await ctx.http().post(`/api/v1/assets/${archivedId}/archive`).set(bearer(admin)).send({}).expect(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creating an asset writes the initial condition log and the first assignment', async () => {
    const logs = await ctx.http().get(logsUrl()).set(bearer(viewer)).expect(200);
    expect(logs.body.meta.total).toBe(1);
    expect(logs.body.data[0]).toMatchObject({
      condition: 'GOOD',
      previousCondition: null,
      source: 'CREATE',
      loanId: null,
      checkedBy: { id: admin.userId },
      photos: [],
    });

    const assignments = await ctx.http().get(`/api/v1/assets/${assetId}/assignments`).set(bearer(viewer)).expect(200);
    expect(assignments.body.meta.total).toBe(1);
    expect(assignments.body.data[0]).toMatchObject({
      fromEmployee: null,
      toEmployee: { id: employeeId, fullName: 'Pegawai Kondisi' },
      source: 'CREATE',
      mutationId: null,
      changedBy: { id: admin.userId },
    });
  });

  it('PETUGAS records a condition check that updates the asset; VIEWER cannot', async () => {
    await ctx.http().post(logsUrl()).set(bearer(viewer)).send({ condition: 'NEEDS_REPAIR' }).expect(403);

    const res = await ctx
      .http()
      .post(logsUrl())
      .set(bearer(petugas))
      .send({ condition: 'NEEDS_REPAIR', notes: 'Engsel longgar' })
      .expect(201);
    expect(res.body).toMatchObject({
      condition: 'NEEDS_REPAIR',
      previousCondition: 'GOOD',
      notes: 'Engsel longgar',
      source: 'MANUAL',
      checkedBy: { id: petugas.userId },
    });
    expect(res.body.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const asset = await ctx.http().get(`/api/v1/assets/${assetId}`).set(bearer(viewer)).expect(200);
    expect(asset.body.condition).toBe('NEEDS_REPAIR');

    const logs = await ctx.http().get(logsUrl()).set(bearer(viewer)).expect(200);
    expect(logs.body.data.map((l: { source: string }) => l.source)).toEqual(['MANUAL', 'CREATE']);
  });

  it('rejects future dates, invalid conditions and archived assets', async () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const future = await ctx
      .http()
      .post(logsUrl())
      .set(bearer(admin))
      .send({ condition: 'GOOD', checkedAt: tomorrow })
      .expect(400);
    expect(future.body.errors.checkedAt).toBeDefined();

    await ctx.http().post(logsUrl()).set(bearer(admin)).send({ condition: 'BROKEN' }).expect(400);

    const archived = await ctx.http().post(logsUrl(archivedId)).set(bearer(admin)).send({ condition: 'GOOD' }).expect(409);
    expect(archived.body.message).toBe('Barang sudah diarsipkan.');
  });

  it('shows the check in the asset history', async () => {
    const history = await ctx.http().get(`/api/v1/assets/${assetId}/history`).set(bearer(viewer)).expect(200);
    const entry = history.body.data.find((h: { action: string }) => h.action === 'asset.condition_recorded');
    expect(entry).toBeDefined();
    expect(entry.module).toBe('condition_logs');
    expect(entry.after).toMatchObject({ condition: 'NEEDS_REPAIR' });
    expect(entry.after.conditionLogId).toBeDefined();
  });
});
