import { createTestApp } from './utils/app.js';
import { extraType, testTypes } from './utils/fixtures.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/assets';

interface Ids {
  category: string;
  categoryInactive: string;
  office: string;
  building: string;
  floor: string;
  room1: string;
  room2: string;
  roomInactive: string;
  department: string;
  employee: string;
  inactiveEmployee: string;
}

describe('assets (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let viewer: LoginResult;
  let ids: Ids;
  let firstId: string;
  let firstCode: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  const baseAsset = () => ({
    name: 'Laptop Kerja A',
    categoryId: ids.category,
    locationId: ids.room1,
    ownershipType: 'OFFICE',
    acquisitionMethod: 'PURCHASE',
    condition: 'GOOD',
    status: 'AVAILABLE',
    specification: 'Lenovo ThinkPad T14',
    serialNumber: 'SN-0001',
    purchasePrice: 15000000,
    acquisitionDate: '2026-01-15',
    vendor: 'PT Komputer Jaya',
    departmentId: ids.department,
    responsibleEmployeeId: undefined as string | undefined,
    notes: 'Unit untuk staf TU',
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');

    const p = ctx.prisma;
    const category = (await testTypes(p)).ng;
    const categoryInactive = await extraType(p, 950, 'Kategori Nonaktif', false);
    const office = await p.location.create({ data: { code: 'AST_HQ', name: 'Kantor Aset', type: 'OFFICE' } });
    const building = await p.location.create({
      data: { code: 'AST_G1', name: 'Menara Aset', type: 'BUILDING', parentId: office.id },
    });
    const floor = await p.location.create({
      data: { code: 'AST_L1', name: 'Lantai Aset', type: 'FLOOR', parentId: building.id },
    });
    const room1 = await p.location.create({
      data: { code: 'AST_R1', name: 'Ruang Aset 1', type: 'ROOM', parentId: floor.id },
    });
    const room2 = await p.location.create({
      data: { code: 'AST_R2', name: 'Ruang Aset 2', type: 'ROOM', parentId: floor.id },
    });
    const roomInactive = await p.location.create({
      data: { code: 'AST_RX', name: 'Ruang Nonaktif', type: 'ROOM', parentId: floor.id, isActive: false },
    });
    const department = await p.department.create({ data: { code: 'AST_TU', name: 'TU Aset' } });
    const employee = await p.employee.create({ data: { fullName: 'Pegawai Aset', employeeNumber: 'AST-PEG-1' } });
    const inactiveEmployee = await p.employee.create({ data: { fullName: 'Pegawai Nonaktif', isActive: false } });
    ids = {
      category: category.id,
      categoryInactive: categoryInactive.id,
      office: office.id,
      building: building.id,
      floor: floor.id,
      room1: room1.id,
      room2: room2.id,
      roomInactive: roomInactive.id,
      department: department.id,
      employee: employee.id,
      inactiveEmployee: inactiveEmployee.id,
    };
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('VIEWER and PETUGAS cannot create assets', async () => {
    await ctx.http().post(URL).set(bearer(viewer)).send(baseAsset()).expect(403);
    await ctx.http().post(URL).set(bearer(petugas)).send(baseAsset()).expect(403);
    await ctx.http().post(URL).send(baseAsset()).expect(401);
  });

  it('creates an asset with an automatic code and a QR label', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), responsibleEmployeeId: ids.employee })
      .expect(201);
    firstId = res.body.id;
    firstCode = res.body.assetCode;
    expect(firstCode).toMatch(/^INV-\d{4}-\d{4,}$/);
    expect(res.body).toMatchObject({
      name: 'Laptop Kerja A',
      specification: 'Lenovo ThinkPad T14',
      status: 'AVAILABLE',
      condition: 'GOOD',
      ownershipType: 'OFFICE',
      acquisitionMethod: 'PURCHASE',
      acquisitionDate: '2026-01-15',
      purchasePrice: '15000000.00',
      isArchived: false,
      hasPhoto: false,
      category: { code: 'NG-900' },
      location: { id: ids.room1, path: 'Kantor Aset / Menara Aset / Lantai Aset / Ruang Aset 1' },
      department: { code: 'AST_TU' },
      responsibleEmployee: { id: ids.employee, fullName: 'Pegawai Aset' },
      createdBy: { id: admin.userId },
      photos: [],
      documents: [],
    });
    expect(res.body.label.token).toHaveLength(43);
    expect(res.body.label.isActive).toBe(true);
    expect(res.body.label.url).toBe(`http://localhost:3000/a/${res.body.label.token}`);

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'asset.created', entityId: firstId },
    });
    expect(audit?.module).toBe('assets');
    expect(audit?.actorId).toBe(admin.userId);
  });

  it('gives the next asset the following number', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), name: 'Laptop Kerja B', locationId: ids.room2, status: 'IN_USE' })
      .expect(201);
    const [, year, n1] = firstCode.split('-');
    const [, year2, n2] = (res.body.assetCode as string).split('-');
    expect(year2).toBe(year);
    expect(Number(n2)).toBe(Number(n1) + 1);
  });

  it('refuses inactive or unknown references with a field-specific message', async () => {
    const cat = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), categoryId: ids.categoryInactive })
      .expect(400);
    expect(cat.body.message).toBe('Kategori tidak ditemukan atau nonaktif.');

    const loc = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), locationId: ids.roomInactive })
      .expect(400);
    expect(loc.body.message).toBe('Lokasi tidak ditemukan atau nonaktif.');

    const pj = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), responsibleEmployeeId: ids.inactiveEmployee })
      .expect(409);
    expect(pj.body.message).toBe('Pegawai tidak aktif.');

    const dept = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), departmentId: '00000000-0000-0000-0000-000000000000' })
      .expect(400);
    expect(dept.body.message).toBe('Unit kerja tidak ditemukan atau nonaktif.');
  });

  it('validates the body', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), name: '', status: 'FLYING', purchasePrice: -5 })
      .expect(400);
    expect(res.body.message).toBe('Validasi gagal.');
    expect(res.body.errors).toHaveProperty('name');
    expect(res.body.errors).toHaveProperty('status');
    expect(res.body.errors).toHaveProperty('purchasePrice');
  });

  it('rejects maintenance/disposal-managed statuses on create and update', async () => {
    const disposed = await ctx.http().post(URL).set(bearer(admin)).send({ ...baseAsset(), status: 'DISPOSED' }).expect(400);
    expect(disposed.body.errors.status).toEqual(['Status ini diatur oleh pemeliharaan/pelepasan']);
    const missing = await ctx.http().post(URL).set(bearer(admin)).send({ ...baseAsset(), status: 'MISSING' }).expect(400);
    expect(missing.body.errors.status).toEqual(['Status ini diatur oleh pemeliharaan/pelepasan']);
    const repair = await ctx
      .http()
      .patch(`${URL}/${firstId}`)
      .set(bearer(admin))
      .send({ status: 'UNDER_MAINTENANCE' })
      .expect(400);
    expect(repair.body.errors.status).toEqual(['Status ini diatur oleh pemeliharaan/pelepasan']);
    const borrowed = await ctx.http().patch(`${URL}/${firstId}`).set(bearer(admin)).send({ status: 'BORROWED' }).expect(400);
    expect(borrowed.body.errors.status).toEqual(['Status ini diatur oleh peminjaman']);
  });

  it('rejects loan-managed statuses on create and locked fields on update', async () => {
    const borrowed = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), status: 'BORROWED' })
      .expect(400);
    expect(borrowed.body.errors.status).toEqual(['Status ini diatur oleh peminjaman']);

    const locked = await ctx
      .http()
      .patch(`${URL}/${firstId}`)
      .set(bearer(admin))
      .send({
        locationId: ids.room2,
        responsibleEmployeeId: ids.employee,
        condition: 'NEEDS_REPAIR',
        status: 'RETURNED',
      })
      .expect(400);
    expect(locked.body.message).toBe('Validasi gagal.');
    expect(locked.body.errors).toMatchObject({
      locationId: ['Ubah lewat mutasi'],
      responsibleEmployeeId: ['Ubah lewat mutasi'],
      condition: ['Ubah lewat pemeriksaan kondisi'],
      status: ['Status ini diatur oleh peminjaman'],
    });
    const unchanged = await ctx.http().get(`${URL}/${firstId}`).set(bearer(admin)).expect(200);
    expect(unchanged.body.location.id).toBe(ids.room1);
    expect(unchanged.body.condition).toBe('GOOD');
  });

  it('creates an asset without a location; the public page shows none', async () => {
    const { locationId: _omit, ...noLocation } = baseAsset();
    const res = await ctx.http().post(URL).set(bearer(admin)).send({ ...noLocation, name: 'Barang Tanpa Lokasi' }).expect(201);
    expect(res.body.location).toBeNull();
    const list = await ctx.http().get(`${URL}?search=Tanpa%20Lokasi`).set(bearer(viewer)).expect(200);
    expect(list.body.data[0].location).toBeNull();
    const pub = await ctx.http().get(`/api/v1/qr/public/${res.body.label.token}`).expect(200);
    expect(pub.body.location).toBeNull();
    expect(pub.body.assetCode).toBe(res.body.assetCode);
    const stats = await ctx.http().get(`${URL}/statistics`).set(bearer(viewer)).expect(200);
    expect(Array.isArray(stats.body.byOffice)).toBe(true);
  });

  it('lists with search and filters, excluding archived by default', async () => {
    const bySuffix = await ctx
      .http()
      .get(URL)
      .query({ search: firstCode.slice(-4) })
      .set(bearer(viewer))
      .expect(200);
    expect(bySuffix.body.data.some((a: { id: string }) => a.id === firstId)).toBe(true);
    expect(bySuffix.body.meta.total).toBeGreaterThanOrEqual(1);

    const byName = await ctx.http().get(URL).query({ search: 'kerja b' }).set(bearer(viewer)).expect(200);
    expect(byName.body.data.map((a: { name: string }) => a.name)).toEqual(['Laptop Kerja B']);

    const byStatus = await ctx.http().get(URL).query({ status: 'IN_USE' }).set(bearer(viewer)).expect(200);
    expect(byStatus.body.data.every((a: { status: string }) => a.status === 'IN_USE')).toBe(true);
    expect(byStatus.body.data.length).toBeGreaterThanOrEqual(1);

    // locationId includes every descendant room
    const byBuilding = await ctx
      .http()
      .get(URL)
      .query({ locationId: ids.building })
      .set(bearer(viewer))
      .expect(200);
    expect(byBuilding.body.meta.total).toBeGreaterThanOrEqual(2);
    const byRoom2 = await ctx.http().get(URL).query({ locationId: ids.room2 }).set(bearer(viewer)).expect(200);
    expect(byRoom2.body.data.map((a: { name: string }) => a.name)).toEqual(['Laptop Kerja B']);

    const page = await ctx.http().get(URL).query({ pageSize: 1, page: 2 }).set(bearer(viewer)).expect(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ page: 2, pageSize: 1 });

    const sorted = await ctx
      .http()
      .get(URL)
      .query({ sort: 'name', order: 'asc', categoryId: ids.category })
      .set(bearer(viewer))
      .expect(200);
    const names = sorted.body.data.map((a: { name: string }) => a.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('returns the detail and 404 for an unknown id', async () => {
    const res = await ctx.http().get(`${URL}/${firstId}`).set(bearer(petugas)).expect(200);
    expect(res.body.assetCode).toBe(firstCode);
    expect(res.body.label.token).toHaveLength(43);
    const missing = await ctx
      .http()
      .get(`${URL}/00000000-0000-0000-0000-000000000000`)
      .set(bearer(petugas))
      .expect(404);
    expect(missing.body.message).toBe('Barang tidak ditemukan.');
  });

  it('updates fields and audits before/after; PETUGAS cannot update', async () => {
    await ctx.http().patch(`${URL}/${firstId}`).set(bearer(petugas)).send({ status: 'STORED' }).expect(403);

    const res = await ctx
      .http()
      .patch(`${URL}/${firstId}`)
      .set(bearer(admin))
      .send({ status: 'STORED', specification: 'Lenovo Baru', notes: null })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'STORED',
      location: { id: ids.room1 },
      specification: 'Lenovo Baru',
      notes: null,
      assetCode: firstCode,
    });

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'asset.updated', entityId: firstId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.before).toMatchObject({ status: 'AVAILABLE', specification: 'Lenovo ThinkPad T14' });
    expect(audit?.after).toMatchObject({ status: 'STORED', specification: 'Lenovo Baru', locationId: ids.room1 });
  });

  it('archives, hides, blocks edits, and unarchives', async () => {
    await ctx.http().post(`${URL}/${firstId}/archive`).set(bearer(viewer)).send({}).expect(403);

    const archived = await ctx
      .http()
      .post(`${URL}/${firstId}/archive`)
      .set(bearer(admin))
      .send({ reason: 'Rusak total, dihapuskan' })
      .expect(200);
    expect(archived.body.isArchived).toBe(true);
    expect(archived.body.archiveReason).toBe('Rusak total, dihapuskan');
    expect(archived.body.archivedBy).toMatchObject({ id: admin.userId });

    const list = await ctx.http().get(URL).query({ pageSize: 100 }).set(bearer(viewer)).expect(200);
    expect(list.body.data.some((a: { id: string }) => a.id === firstId)).toBe(false);
    const withArchived = await ctx
      .http()
      .get(URL)
      .query({ includeArchived: true, pageSize: 100 })
      .set(bearer(viewer))
      .expect(200);
    expect(withArchived.body.data.some((a: { id: string }) => a.id === firstId)).toBe(true);

    const blocked = await ctx
      .http()
      .patch(`${URL}/${firstId}`)
      .set(bearer(admin))
      .send({ name: 'x' })
      .expect(400);
    expect(blocked.body.message).toBe('Barang sudah diarsipkan.');
    await ctx.http().post(`${URL}/${firstId}/archive`).set(bearer(admin)).send({}).expect(400);

    const restored = await ctx.http().post(`${URL}/${firstId}/unarchive`).set(bearer(admin)).expect(200);
    expect(restored.body.isArchived).toBe(false);
    expect(restored.body.archiveReason).toBeNull();
  });

  it('lists the history of an asset, newest first', async () => {
    const res = await ctx.http().get(`${URL}/${firstId}/history`).set(bearer(petugas)).expect(200);
    const actions = res.body.data.map((r: { action: string }) => r.action);
    expect(actions[0]).toBe('asset.unarchived');
    expect(actions).toEqual(
      expect.arrayContaining(['asset.created', 'asset.updated', 'asset.archived', 'asset.unarchived']),
    );
    expect(res.body.meta.total).toBeGreaterThanOrEqual(4);
    // Client metadata stays behind the audit-log permissions (review I-1).
    expect(res.body.data[0]).not.toHaveProperty('ip');
    expect(res.body.data[0]).not.toHaveProperty('userAgent');
    expect(res.body.data[0]).toHaveProperty('actor');
  });

  it('answers 400, not 500, to null on required fields and impossible values', async () => {
    const patch = (body: object) => ctx.http().patch(`${URL}/${firstId}`).set(bearer(admin)).send(body);
    const nullName = await patch({ name: null }).expect(400);
    expect(nullName.body.errors).toHaveProperty('name');
    await patch({ status: null }).expect(400);
    await patch({ categoryId: null }).expect(400);
    const badDate = await patch({ acquisitionDate: '2026-02-31' }).expect(400);
    expect(badDate.body.errors).toHaveProperty('acquisitionDate');
    await patch({ acquisitionDate: '2026-13-01' }).expect(400);
    const bigPrice = await patch({ purchasePrice: 1e14 }).expect(400);
    expect(bigPrice.body.errors).toHaveProperty('purchasePrice');
    await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), name: 'Tanggal Salah', acquisitionDate: '2026-02-30' })
      .expect(400);
  });

  it('reports statistics without archived assets', async () => {
    const third = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), name: 'Kursi Arsip', condition: 'DAMAGED', status: 'STORED' })
      .expect(201);
    await ctx.http().post(`${URL}/${third.body.id}/archive`).set(bearer(admin)).send({}).expect(200);

    const res = await ctx.http().get(`${URL}/statistics`).set(bearer(viewer)).expect(200);
    expect(res.body.archived).toBeGreaterThanOrEqual(1);
    expect(res.body.total).toBe(res.body.active + res.body.archived + res.body.disposed);
    for (const key of ['pendingMutations', 'activeLoans', 'overdueLoans']) {
      expect(typeof res.body[key]).toBe('number');
      expect(res.body[key]).toBeGreaterThanOrEqual(0);
    }
    expect(res.body.active).toBeGreaterThanOrEqual(1);
    expect(res.body.byStatus.STORED).toBeGreaterThanOrEqual(1);
    expect(res.body.byStatus.IN_USE).toBeGreaterThanOrEqual(1);
    // The archived damaged chair is not counted; other suites may own active damaged items.
    const activeDamaged = await ctx.prisma.asset.count({ where: { condition: 'DAMAGED', archivedAt: null, status: { not: 'DISPOSED' } } });
    expect(res.body.byCondition.DAMAGED ?? 0).toBe(activeDamaged);
    expect(res.body.byCategory).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.category })]),
    );
    expect(res.body.byOffice).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.office, name: 'Kantor Aset' })]),
    );
  });

  it('exposes a user lookup for choosing a responsible person', async () => {
    const res = await ctx
      .http()
      .get('/api/v1/users/lookup')
      .query({ search: 'petugas' })
      .set(bearer(admin))
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: petugas.userId, fullName: expect.any(String) })]),
    );
    expect(res.body[0]).not.toHaveProperty('passwordHash');

    const inactive = await ctx
      .http()
      .get('/api/v1/users/lookup')
      .query({ search: 'nonaktif-pj' })
      .set(bearer(admin))
      .expect(200);
    expect(inactive.body).toEqual([]);

    await ctx.http().get('/api/v1/users/lookup').set(bearer(viewer)).expect(200);
  });
  it('statistics group live assets by acquisition year', async () => {
    const stats = async () => (await ctx.http().get(`${URL}/statistics`).set(bearer(viewer)).expect(200)).body;
    const create = async (name: string, acquisitionDate?: string) =>
      (
        await ctx
          .http()
          .post(URL)
          .set(bearer(admin))
          .send({ ...baseAsset(), name, serialNumber: undefined, acquisitionDate })
          .expect(201)
      ).body.id as string;
    const before = await stats();

    await create('Tahun 1991 A', '1991-05-01');
    await create('Tahun 1991 B', '1991-12-31');
    await create('Tahun 1993', '1993-01-01');
    await create('Tanpa tahun', undefined);
    const archived = await create('Arsip 1992', '1992-03-03');
    await ctx.http().post(`${URL}/${archived}/archive`).set(bearer(admin)).send({}).expect(200);
    const disposed = await create('Dilepas 1992', '1992-04-04');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    await ctx
      .http()
      .post('/api/v1/disposals')
      .set(bearer(admin))
      .send({ assetId: disposed, reason: 'BROKEN', disposedAt: today, description: 'Uji statistik' })
      .expect(201);

    const after = await stats();
    const year = (rows: { year: number; count: number }[], y: number) => rows.find((r) => r.year === y)?.count ?? 0;
    expect(year(after.byAcquisitionYear, 1991)).toBe(2);
    expect(year(after.byAcquisitionYear, 1993)).toBe(1);
    expect(year(after.byAcquisitionYear, 1992)).toBe(0);
    const years = after.byAcquisitionYear.map((r: { year: number }) => r.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(after.withoutAcquisitionYear - before.withoutAcquisitionYear).toBeGreaterThanOrEqual(1);
  });
});
