import { createTestApp } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/disposals';

describe('disposals (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let viewer: LoginResult;
  let categoryId: string;
  let employeeId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const pdf = () => Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

  const createAsset = async (name: string, status = 'IN_USE') =>
    (
      await ctx
        .http()
        .post('/api/v1/assets')
        .set(bearer(admin))
        .send({ name, categoryId, ownershipType: 'OFFICE', acquisitionMethod: 'PURCHASE', condition: 'DAMAGED', status })
        .expect(201)
    ).body as { id: string; assetCode: string; label: { token: string } };

  const dispose = (assetId: string, extra: object = {}) =>
    ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ assetId, reason: 'SOLD', disposedAt: today(), description: 'Dijual ke pengepul', ...extra });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    categoryId = ((await testTypes(ctx.prisma)).ng).id;
    employeeId = (await ctx.prisma.employee.create({ data: { fullName: 'Pegawai Lepas' } })).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('ADMIN disposes an asset: status, QR, list visibility and statistics follow', async () => {
    const asset = await createAsset('Monitor Lepas');
    await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, reason: 'BROKEN', disposedAt: today(), description: 'x' })
      .expect(403);

    const res = await dispose(asset.id, { value: 1500000, recipient: 'Toko Bekas Jaya' }).expect(201);
    expect(res.body).toMatchObject({
      reason: 'SOLD',
      disposedAt: today(),
      value: '1500000.00',
      recipient: 'Toko Bekas Jaya',
      previousStatus: 'IN_USE',
      labelWasActive: true,
      revertedAt: null,
      disposedBy: { id: admin.userId },
    });

    const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id }, include: { label: true } });
    expect(row.status).toBe('DISPOSED');
    expect(row.label?.isActive).toBe(false);
    await ctx.http().get(`/api/v1/qr/public/${asset.label.token}`).expect(404);

    const list = await ctx.http().get(`/api/v1/assets?search=${encodeURIComponent(asset.assetCode)}`).set(bearer(admin)).expect(200);
    expect(list.body.data).toHaveLength(0);
    const filtered = await ctx
      .http()
      .get(`/api/v1/assets?status=DISPOSED&search=${encodeURIComponent(asset.assetCode)}`)
      .set(bearer(admin))
      .expect(200);
    expect(filtered.body.data.map((a: { id: string }) => a.id)).toEqual([asset.id]);

    const stats = await ctx.http().get('/api/v1/assets/statistics').set(bearer(viewer)).expect(200);
    expect(stats.body.disposed).toBeGreaterThanOrEqual(1);
    expect(stats.body.total).toBe(stats.body.active + stats.body.archived + stats.body.disposed);

    const detail = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(detail.body.activeDisposal).toMatchObject({ id: res.body.id, reason: 'SOLD', disposedAt: today() });

    // QR stays locked
    const act = await ctx.http().post(`/api/v1/assets/${asset.id}/qr/activate`).set(bearer(admin)).expect(409);
    expect(act.body.message).toBe('Barang sudah dilepas.');
    await ctx.http().post(`/api/v1/assets/${asset.id}/qr/regenerate`).set(bearer(admin)).expect(409);
    const bulk = await ctx.http().post('/api/v1/qr/bulk-generate').set(bearer(admin)).send({ assetIds: [asset.id] }).expect(200);
    expect(bulk.body.items).toHaveLength(0);
    expect(bulk.body.skipped.map((s: { assetId: string }) => s.assetId)).toContain(asset.id);

    // Blocked flows
    const again = await dispose(asset.id).expect(409);
    expect(again.body.message).toBe('Barang sudah dilepas.');
    const lent = await ctx
      .http()
      .post('/api/v1/loans')
      .set(bearer(admin))
      .send({ assetId: asset.id, borrowerType: 'EMPLOYEE', borrowerEmployeeId: employeeId, loanedAt: today(), dueAt: today() })
      .expect(409);
    expect(lent.body.message).toBe('Barang sudah dilepas.');

    // Supporting document
    const doc = await ctx
      .http()
      .post(`/api/v1/assets/${asset.id}/documents`)
      .set(bearer(admin))
      .field('title', 'Berita acara penjualan')
      .field('disposalId', res.body.id)
      .attach('file', pdf(), 'ba.pdf')
      .expect(201);
    const withDoc = await ctx.http().get(`${URL}/${res.body.id}`).set(bearer(viewer)).expect(200);
    expect(withDoc.body.documents.map((d: { id: string }) => d.id)).toEqual([doc.body.id]);

    // Revert restores everything
    const noReason = await ctx.http().post(`${URL}/${res.body.id}/revert`).set(bearer(admin)).send({}).expect(400);
    expect(noReason.body.errors).toHaveProperty('reason');
    const reverted = await ctx
      .http()
      .post(`${URL}/${res.body.id}/revert`)
      .set(bearer(admin))
      .send({ reason: 'Salah pilih barang' })
      .expect(200);
    expect(reverted.body).toMatchObject({ revertReason: 'Salah pilih barang', revertedBy: { id: admin.userId } });
    const back = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id }, include: { label: true } });
    expect(back.status).toBe('IN_USE');
    expect(back.label?.isActive).toBe(true);
    const twice = await ctx.http().post(`${URL}/${res.body.id}/revert`).set(bearer(admin)).send({ reason: 'x' }).expect(409);
    expect(twice.body.message).toBe('Pelepasan sudah dibatalkan.');

    const history = await ctx.http().get(`/api/v1/assets/${asset.id}/history`).set(bearer(admin)).expect(200);
    expect(history.body.data.map((h: { action: string }) => h.action)).toEqual(
      expect.arrayContaining(['disposal.created', 'disposal.reverted']),
    );
  });

  it('keeps a QR label inactive after revert when it was inactive before the disposal', async () => {
    const asset = await createAsset('Kursi Label Mati');
    await ctx.http().post(`/api/v1/assets/${asset.id}/qr/deactivate`).set(bearer(admin)).expect(200);
    const res = await dispose(asset.id, { reason: 'LOST', description: 'Hilang saat pindahan' }).expect(201);
    expect(res.body.labelWasActive).toBe(false);
    await ctx.http().post(`${URL}/${res.body.id}/revert`).set(bearer(admin)).send({ reason: 'Ketemu' }).expect(200);
    const back = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id }, include: { label: true } });
    expect(back.label?.isActive).toBe(false);
    expect(back.status).toBe('IN_USE');
  });

  it('refuses to dispose borrowed, in-repair or archived assets and future dates; cancels a pending repair report', async () => {
    const borrowed = await createAsset('Laptop Dipinjam Lepas');
    await ctx
      .http()
      .post('/api/v1/loans')
      .set(bearer(admin))
      .send({ assetId: borrowed.id, borrowerType: 'EMPLOYEE', borrowerEmployeeId: employeeId, loanedAt: today(), dueAt: today() })
      .expect(201);
    expect((await dispose(borrowed.id).expect(409)).body.message).toBe('Barang sedang dipinjam.');

    const repair = await createAsset('Printer Diperbaiki Lepas');
    const rep = await ctx.http().post('/api/v1/maintenance').set(bearer(admin)).send({ assetId: repair.id, description: 'x' }).expect(201);
    await ctx.http().post(`/api/v1/maintenance/${rep.body.id}/start`).set(bearer(admin)).send({}).expect(200);
    expect((await dispose(repair.id).expect(409)).body.message).toBe('Barang sedang diperbaiki.');

    const archived = await createAsset('Meja Arsip Lepas');
    await ctx.http().post(`/api/v1/assets/${archived.id}/archive`).set(bearer(admin)).send({}).expect(200);
    expect((await dispose(archived.id).expect(409)).body.message).toBe('Barang sudah diarsipkan.');

    const reported = await createAsset('Kipas Dilaporkan Lepas');
    const open = await ctx.http().post('/api/v1/maintenance').set(bearer(admin)).send({ assetId: reported.id, description: 'Mati total' }).expect(201);
    await dispose(reported.id, { reason: 'BROKEN', description: 'Rusak total' }).expect(201);
    const closed = await ctx.prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: open.body.id } });
    expect(closed.status).toBe('CANCELLED');
    expect(closed.cancelReason).toBe('Barang dilepas');

    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const fresh = await createAsset('Barang Tanggal Depan');
    const bad = await dispose(fresh.id, { disposedAt: future }).expect(400);
    expect(bad.body.errors).toHaveProperty('disposedAt');
  });

  it('only one of a loan and a disposal fired together succeeds', async () => {
    for (let round = 0; round < 3; round++) {
      const asset = await createAsset(`Balapan Lepas ${round}`);
      const [l, d] = await Promise.all([
        ctx
          .http()
          .post('/api/v1/loans')
          .set(bearer(admin))
          .send({ assetId: asset.id, borrowerType: 'EMPLOYEE', borrowerEmployeeId: employeeId, loanedAt: today(), dueAt: today() }),
        dispose(asset.id),
      ]);
      expect([l.status, d.status].filter((s) => s < 300)).toHaveLength(1);
      const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
      const loans = await ctx.prisma.assetLoan.count({ where: { assetId: asset.id, status: 'ACTIVE' } });
      const disposals = await ctx.prisma.assetDisposal.count({ where: { assetId: asset.id, revertedAt: null } });
      expect(loans + disposals).toBe(1);
      expect(row.status).toBe(loans === 1 ? 'BORROWED' : 'DISPOSED');
    }
  });

  it('Viewer may list disposals with filters', async () => {
    const list = await ctx.http().get(`${URL}?reason=SOLD&includeReverted=true`).set(bearer(viewer)).expect(200);
    expect(list.body.data.every((d: { reason: string }) => d.reason === 'SOLD')).toBe(true);
    const active = await ctx.http().get(URL).set(bearer(viewer)).expect(200);
    expect(active.body.data.every((d: { revertedAt: string | null }) => d.revertedAt === null)).toBe(true);
  });
});
