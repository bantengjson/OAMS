import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/employees';

describe('employees (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let viewer: LoginResult;
  let departmentId: string;
  let categoryId: string;
  let locationId: string;
  let budiId: string;
  let sariId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    const p = ctx.prisma;
    departmentId = (await p.department.create({ data: { code: 'EMP_KEU', name: 'Keuangan Pegawai' } })).id;
    categoryId = (await p.category.findUniqueOrThrow({ where: { code: 'ELEKTRONIK' } })).id;
    locationId = (await p.location.create({ data: { code: 'EMP_HQ', name: 'Kantor Pegawai', type: 'OFFICE' } })).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('seed grants VIEWER mutations.view and loans.view', async () => {
    const viewerRole = await ctx.prisma.role.findUniqueOrThrow({
      where: { code: 'VIEWER' },
      include: { permissions: { include: { permission: true } } },
    });
    const codes = viewerRole.permissions.map((rp) => rp.permission.code);
    expect(codes).toEqual(expect.arrayContaining(['mutations.view', 'loans.view']));
  });

  it('ADMIN creates an employee, PETUGAS cannot, VIEWER can list', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({
        fullName: 'Budi Santoso',
        employeeNumber: 'PEG-001',
        departmentId,
        position: 'Staf Keuangan',
        phone: '081234567890',
        email: 'budi@kantor.test',
      })
      .expect(201);
    budiId = res.body.id;
    expect(res.body).toMatchObject({
      fullName: 'Budi Santoso',
      employeeNumber: 'PEG-001',
      department: { id: departmentId, code: 'EMP_KEU', name: 'Keuangan Pegawai' },
      position: 'Staf Keuangan',
      phone: '081234567890',
      email: 'budi@kantor.test',
      user: null,
      isActive: true,
    });

    await ctx.http().post(URL).set(bearer(petugas)).send({ fullName: 'X' }).expect(403);
    await ctx.http().post(URL).set(bearer(viewer)).send({ fullName: 'X' }).expect(403);

    const list = await ctx.http().get(URL).set(bearer(viewer)).expect(200);
    expect(list.body.data.some((e: { id: string }) => e.id === budiId)).toBe(true);
  });

  it('rejects an empty name and a duplicate employee number', async () => {
    const bad = await ctx.http().post(URL).set(bearer(admin)).send({ fullName: '  ' }).expect(400);
    expect(bad.body.message).toBe('Validasi gagal.');
    expect(bad.body.errors.fullName).toBeDefined();
    const dup = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ fullName: 'Budi Kedua', employeeNumber: 'PEG-001' })
      .expect(409);
    expect(dup.body.errors.employeeNumber).toEqual(['Nilai sudah digunakan.']);
  });

  it('searches by name or employee number and filters by department', async () => {
    const sari = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ fullName: 'Sari Dewi', employeeNumber: 'PEG-002' })
      .expect(201);
    sariId = sari.body.id;

    const byNumber = await ctx.http().get(`${URL}?search=PEG-002`).set(bearer(admin)).expect(200);
    expect(byNumber.body.data.map((e: { id: string }) => e.id)).toEqual([sariId]);

    const byName = await ctx.http().get(`${URL}?search=budi`).set(bearer(admin)).expect(200);
    expect(byName.body.data.map((e: { id: string }) => e.id)).toEqual([budiId]);

    const byDept = await ctx.http().get(`${URL}?departmentId=${departmentId}`).set(bearer(admin)).expect(200);
    expect(byDept.body.data.map((e: { id: string }) => e.id)).toEqual([budiId]);
  });

  it('lookup returns active employees only, with number and department', async () => {
    await ctx.http().patch(`${URL}/${sariId}`).set(bearer(admin)).send({ isActive: false }).expect(200);
    const res = await ctx.http().get(`${URL}/lookup?search=PEG-00`).set(bearer(petugas)).expect(200);
    expect(res.body).toEqual([
      { id: budiId, fullName: 'Budi Santoso', employeeNumber: 'PEG-001', department: { id: departmentId, name: 'Keuangan Pegawai' } },
    ]);
    await ctx.http().patch(`${URL}/${sariId}`).set(bearer(admin)).send({ isActive: true }).expect(200);
  });

  it('links an account to at most one employee', async () => {
    const linked = await ctx
      .http()
      .patch(`${URL}/${budiId}`)
      .set(bearer(admin))
      .send({ userId: viewer.userId })
      .expect(200);
    expect(linked.body.user).toMatchObject({ id: viewer.userId, email: viewer.email });

    const dup = await ctx
      .http()
      .patch(`${URL}/${sariId}`)
      .set(bearer(admin))
      .send({ userId: viewer.userId })
      .expect(409);
    expect(dup.body.message).toBe('Akun ini sudah tertaut ke pegawai lain.');

    const unlinked = await ctx.http().patch(`${URL}/${budiId}`).set(bearer(admin)).send({ userId: null }).expect(200);
    expect(unlinked.body.user).toBeNull();
  });

  it('deactivating an employee keeps them as responsible on existing assets', async () => {
    const asset = await ctx
      .http()
      .post('/api/v1/assets')
      .set(bearer(admin))
      .send({
        name: 'Laptop Budi',
        categoryId,
        locationId,
        ownershipType: 'OFFICE',
        acquisitionMethod: 'PURCHASE',
        condition: 'GOOD',
        status: 'IN_USE',
        responsibleEmployeeId: budiId,
      })
      .expect(201);
    expect(asset.body.responsibleEmployee).toMatchObject({ id: budiId, fullName: 'Budi Santoso' });

    await ctx.http().patch(`${URL}/${budiId}`).set(bearer(admin)).send({ isActive: false }).expect(200);

    const detail = await ctx.http().get(`${URL}/${budiId}`).set(bearer(viewer)).expect(200);
    expect(detail.body).toMatchObject({ isActive: false, assetCount: 1, activeLoanCount: 0 });

    const still = await ctx.http().get(`/api/v1/assets/${asset.body.id}`).set(bearer(admin)).expect(200);
    expect(still.body.responsibleEmployee.id).toBe(budiId);

    const filtered = await ctx
      .http()
      .get(`/api/v1/assets?responsibleEmployeeId=${budiId}`)
      .set(bearer(admin))
      .expect(200);
    expect(filtered.body.data.map((a: { id: string }) => a.id)).toEqual([asset.body.id]);
  });

  it('audits employee changes', async () => {
    const logs = await ctx.prisma.auditLog.findMany({ where: { module: 'employees', entityId: budiId } });
    const actions = logs.map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['employee.created', 'employee.updated', 'employee.deactivated']));
  });
});
