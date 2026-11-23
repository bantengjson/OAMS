import sharp from 'sharp';
import { createTestApp } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/maintenance';

describe('maintenance (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let viewer: LoginResult;
  let categoryId: string;
  let employeeId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const png = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#dc2626' } }).png().toBuffer();

  const createAsset = async (name: string, status = 'IN_USE') =>
    (
      await ctx
        .http()
        .post('/api/v1/assets')
        .set(bearer(admin))
        .send({ name, categoryId, ownershipType: 'OFFICE', acquisitionYear: 2024, condition: 'NEEDS_REPAIR', status })
        .expect(201)
    ).body as { id: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    categoryId = ((await testTypes(ctx.prisma)).bg).id;
    employeeId = (await ctx.prisma.employee.create({ data: { fullName: 'Pegawai Servis' } })).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('PETUGAS reports damage; the asset is untouched until an ADMIN starts the repair', async () => {
    const asset = await createAsset('Printer Servis');
    await ctx.http().post(URL).set(bearer(viewer)).send({ assetId: asset.id, description: 'x' }).expect(403);
    const rep = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, description: 'Kertas sering macet' })
      .expect(201);
    expect(rep.body).toMatchObject({ status: 'REPORTED', description: 'Kertas sering macet', reportedBy: { id: petugas.userId } });
    expect((await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe('IN_USE');

    const dup = await ctx.http().post(URL).set(bearer(admin)).send({ assetId: asset.id, description: 'Lagi' }).expect(409);
    expect(dup.body.message).toBe('Sudah ada laporan pemeliharaan yang terbuka untuk barang ini.');

    // Damage photo by the reporter
    const photo = await ctx
      .http()
      .post(`/api/v1/assets/${asset.id}/photos`)
      .set(bearer(petugas))
      .field('maintenanceId', rep.body.id)
      .attach('file', await png(), 'rusak.png')
      .expect(201);
    expect(photo.body.isPrimary).toBe(false);

    const detail = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(detail.body.openMaintenance).toMatchObject({ id: rep.body.id, status: 'REPORTED' });

    await ctx.http().post(`${URL}/${rep.body.id}/start`).set(bearer(petugas)).send({}).expect(403);
    const started = await ctx
      .http()
      .post(`${URL}/${rep.body.id}/start`)
      .set(bearer(admin))
      .send({ technician: 'Bengkel Maju' })
      .expect(200);
    expect(started.body).toMatchObject({ status: 'IN_PROGRESS', technician: 'Bengkel Maju', previousStatus: 'IN_USE' });
    expect((await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe('UNDER_MAINTENANCE');

    // Blocked while in repair
    const lent = await ctx
      .http()
      .post('/api/v1/loans')
      .set(bearer(admin))
      .send({ assetId: asset.id, borrowerType: 'EMPLOYEE', borrowerEmployeeId: employeeId, loanedAt: today(), dueAt: today() })
      .expect(409);
    expect(lent.body.message).toBe('Barang sedang diperbaiki.');
    const moved = await ctx
      .http()
      .post('/api/v1/mutations')
      .set(bearer(admin))
      .send({ assetId: asset.id, changesResponsible: true, toResponsibleEmployeeId: employeeId, reason: 'x' })
      .expect(409);
    expect(moved.body.message).toBe('Barang sedang diperbaiki.');

    const done = await ctx
      .http()
      .post(`${URL}/${rep.body.id}/complete`)
      .set(bearer(admin))
      .send({ cost: 250000, technicianNotes: 'Roller diganti', resultCondition: 'GOOD' })
      .expect(200);
    expect(done.body).toMatchObject({ status: 'COMPLETED', cost: '250000.00', resultCondition: 'GOOD' });
    expect(done.body.photos).toHaveLength(1);
    const after = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(after.status).toBe('IN_USE');
    expect(after.condition).toBe('GOOD');
    const logs = await ctx.http().get(`/api/v1/assets/${asset.id}/condition-logs`).set(bearer(admin)).expect(200);
    expect(logs.body.data[0].source).toBe('MAINTENANCE');

    const again = await ctx.http().post(`${URL}/${rep.body.id}/complete`).set(bearer(admin)).send({}).expect(409);
    expect(again.body.message).toBe('Pemeliharaan sudah selesai.');

    const history = await ctx.http().get(`/api/v1/assets/${asset.id}/history`).set(bearer(admin)).expect(200);
    expect(history.body.data.map((h: { action: string }) => h.action)).toEqual(
      expect.arrayContaining(['maintenance.reported', 'maintenance.started', 'maintenance.completed']),
    );
  });

  it('restores AVAILABLE when the stored previous status was flow-managed', async () => {
    const asset = await createAsset('Kipas Servis');
    const rep = await ctx.http().post(URL).set(bearer(admin)).send({ assetId: asset.id, description: 'Mati' }).expect(201);
    await ctx.http().post(`${URL}/${rep.body.id}/start`).set(bearer(admin)).send({}).expect(200);
    await ctx.prisma.maintenanceRecord.update({ where: { id: rep.body.id }, data: { previousStatus: 'BORROWED' } });
    await ctx.http().post(`${URL}/${rep.body.id}/complete`).set(bearer(admin)).send({}).expect(200);
    expect((await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe('AVAILABLE');
  });

  it('cancelling an in-progress repair restores the status; a cancel needs a reason', async () => {
    const asset = await createAsset('Lampu Servis', 'STORED');
    const rep = await ctx.http().post(URL).set(bearer(admin)).send({ assetId: asset.id, description: 'Redup' }).expect(201);
    await ctx.http().post(`${URL}/${rep.body.id}/start`).set(bearer(admin)).send({}).expect(200);
    const noReason = await ctx.http().post(`${URL}/${rep.body.id}/cancel`).set(bearer(admin)).send({}).expect(400);
    expect(noReason.body.errors).toHaveProperty('reason');
    const cancelled = await ctx
      .http()
      .post(`${URL}/${rep.body.id}/cancel`)
      .set(bearer(admin))
      .send({ reason: 'Ternyata hanya bohlam' })
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Ternyata hanya bohlam' });
    expect((await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe('STORED');
  });

  it('cannot start a repair on a borrowed asset; Viewer may list and filter', async () => {
    const asset = await createAsset('Laptop Servis');
    const rep = await ctx.http().post(URL).set(bearer(admin)).send({ assetId: asset.id, description: 'Baterai' }).expect(201);
    await ctx
      .http()
      .post('/api/v1/loans')
      .set(bearer(admin))
      .send({ assetId: asset.id, borrowerType: 'EMPLOYEE', borrowerEmployeeId: employeeId, loanedAt: today(), dueAt: today() })
      .expect(201);
    const start = await ctx.http().post(`${URL}/${rep.body.id}/start`).set(bearer(admin)).send({}).expect(409);
    expect(start.body.message).toBe('Barang sedang dipinjam.');

    const list = await ctx.http().get(`${URL}?status=REPORTED`).set(bearer(viewer)).expect(200);
    expect(list.body.data.every((m: { status: string }) => m.status === 'REPORTED')).toBe(true);
    const stats = await ctx.http().get('/api/v1/assets/statistics').set(bearer(viewer)).expect(200);
    expect(stats.body.openMaintenance).toBeGreaterThanOrEqual(1);
    expect(typeof stats.body.inMaintenance).toBe('number');
  });
});
