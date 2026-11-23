import { createTestApp } from './utils/app.js';
import { extraType, testTypes } from './utils/fixtures.js';
import type { TestTypes } from './utils/fixtures.js';
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
    acquisitionYear: 2026,
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
    expect(firstCode).toMatch(/^NG\.AST_R1\/900\/DPC\/2026-\d{2,}$/);
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
    expect(cat.body.message).toBe('Jenis barang tidak ditemukan atau nonaktif.');

    const loc = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), locationId: ids.roomInactive })
      .expect(400);
    expect(loc.body.message).toBe('Ruangan tidak ditemukan atau nonaktif.');

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
        responsibleEmployeeId: ids.employee,
        condition: 'NEEDS_REPAIR',
        status: 'RETURNED',
      })
      .expect(400);
    expect(locked.body.message).toBe('Validasi gagal.');
    expect(locked.body.errors).toMatchObject({
      responsibleEmployeeId: ['Ubah lewat mutasi'],
      condition: ['Ubah lewat pemeriksaan kondisi'],
      status: ['Status ini diatur oleh peminjaman'],
    });
    const unchanged = await ctx.http().get(`${URL}/${firstId}`).set(bearer(admin)).expect(200);
    expect(unchanged.body.location.id).toBe(ids.room1);
    expect(unchanged.body.condition).toBe('GOOD');
  });

  it('creates an asset without a room (land); the public page shows none', async () => {
    const { locationId: _omit, ...noLocation } = baseAsset();
    const land = (await testTypes(ctx.prisma)).land;
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...noLocation, categoryId: land.id, name: 'Barang Tanpa Lokasi' })
      .expect(201);
    expect(res.body.location).toBeNull();
    const list = await ctx.http().get(`${URL}?search=Tanpa%20Lokasi`).set(bearer(viewer)).expect(200);
    expect(list.body.data[0].location).toBeNull();
    const pub = await ctx.http().get(`/api/v1/qr/public/${res.body.label.token}`).expect(200);
    expect(pub.body.room).toBeNull();
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

describe('assets: office format (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let viewer: LoginResult;
  let t: TestTypes;
  let codeType: { id: string };
  const URL = '/api/v1/assets';
  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const body = (extra: Record<string, unknown> = {}) => ({
    name: 'Meja Uji Kode',
    categoryId: codeType.id,
    locationId: t.roomA.id,
    acquisitionYear: 2019,
    ownershipType: 'OFFICE',
    condition: 'GOOD',
    status: 'IN_USE',
    ...extra,
  });
  const printed = (id: string) =>
    ctx.http().post('/api/v1/qr/mark-printed').set(bearer(admin)).send({ assetIds: [id] }).expect(200);
  const token = (n: number) => `tokttuji${n}`.padEnd(43, 'x');

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    t = await testTypes(ctx.prisma);
    codeType = await extraType(ctx.prisma, 960, 'Meja Uji Kode');
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates 3 units with consecutive codes', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ quantity: 3, specification: 'Kayu jati' })).expect(201);
    expect(res.body.units.map((u: { assetCode: string }) => u.assetCode)).toEqual([
      'NG.A/960/DPC/2019-01',
      'NG.A/960/DPC/2019-02',
      'NG.A/960/DPC/2019-03',
    ]);
    expect(res.body).toMatchObject({ assetCode: 'NG.A/960/DPC/2019-01', acquisitionYear: 2019, specification: 'Kayu jati' });
    expect(res.body.category).toMatchObject({ golongan: 'NG', number: 960 });
    expect(res.body.room).toEqual({ id: t.roomA.id, code: 'A', name: 'Sekretariat' });
    const ids = res.body.units.map((u: { id: string }) => u.id);
    expect(await ctx.prisma.assetLabel.count({ where: { assetId: { in: ids } } })).toBe(3);
  });

  it('vehicle code has no room', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send(body({ categoryId: t.bg.id, locationId: undefined, acquisitionYear: 2023, name: 'Motor Uji' }))
      .expect(201);
    expect(res.body.assetCode).toMatch(/^BG\/900\/DPC\/2023-\d{2,}$/);
    expect(res.body.room).toBeNull();
  });

  it('land without room', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send(body({ categoryId: t.land.id, locationId: undefined, acquisitionYear: 2018, name: 'Tanah Uji' }))
      .expect(201);
    expect(res.body.assetCode).toMatch(/^NG\/001\/DPC\/2018-\d{2,}$/);
  });

  it('NG without room → 400', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ locationId: undefined })).expect(400);
    expect(res.body.message).toBe('Ruangan wajib diisi.');
  });

  it('BG with room → 400', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ categoryId: t.bg.id })).expect(400);
    expect(res.body.message).toBe('Kendaraan tidak memakai ruangan.');
  });

  it('group type → 400', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ categoryId: t.group.id })).expect(400);
    expect(res.body.message).toBe('Jenis ini untuk Barang Kelompok.');
  });

  it('year required → 400, quantity limited to 1-100', async () => {
    const noYear = await ctx.http().post(URL).set(bearer(admin)).send(body({ acquisitionYear: undefined })).expect(400);
    expect(noYear.body.errors).toHaveProperty('acquisitionYear');
    await ctx.http().post(URL).set(bearer(admin)).send(body({ quantity: 0 })).expect(400);
    await ctx.http().post(URL).set(bearer(admin)).send(body({ quantity: 101 })).expect(400);
    await ctx.http().post(URL).set(bearer(admin)).send(body({ acquisitionMethod: 'LOAN' })).expect(400);
  });

  it('source sets GRANT', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send(body({ source: 'Hibah Bapak Uji' })).expect(201);
    expect(res.body).toMatchObject({ source: 'Hibah Bapak Uji', acquisitionMethod: 'GRANT' });
    const bought = await ctx.http().post(URL).set(bearer(admin)).send(body()).expect(201);
    expect(bought.body.acquisitionMethod).toBe('PURCHASE');
  });

  it('corrects jenis before printing and re-codes', async () => {
    const other = await extraType(ctx.prisma, 961, 'Lemari Uji Kode');
    const created = await ctx.http().post(URL).set(bearer(admin)).send(body({ acquisitionYear: 2017 })).expect(201);
    const res = await ctx
      .http()
      .patch(`${URL}/${created.body.id}`)
      .set(bearer(admin))
      .send({ categoryId: other.id, locationId: t.roomB.id })
      .expect(200);
    expect(res.body.assetCode).toBe('NG.B/961/DPC/2017-01');
    expect(res.body.room.code).toBe('B');
    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'asset.code_changed', entityId: created.body.id } });
    expect(audit?.before).toMatchObject({ assetCode: created.body.assetCode });
    expect(audit?.after).toMatchObject({ assetCode: 'NG.B/961/DPC/2017-01' });
  });

  it('refuses jenis change after printing (409)', async () => {
    const other = await extraType(ctx.prisma, 962, 'Rak Uji Kode');
    const created = await ctx.http().post(URL).set(bearer(admin)).send(body()).expect(201);
    await printed(created.body.id);
    const res = await ctx.http().patch(`${URL}/${created.body.id}`).set(bearer(admin)).send({ categoryId: other.id }).expect(409);
    expect(res.body.message).toBe(
      'Stiker sudah dicetak; jenis dan ruangan awal tidak bisa diubah. Arsipkan dan daftarkan ulang bila salah.',
    );
    await ctx.http().patch(`${URL}/${created.body.id}`).set(bearer(admin)).send({ locationId: t.roomB.id }).expect(409);
    // other fields stay editable
    await ctx.http().patch(`${URL}/${created.body.id}`).set(bearer(admin)).send({ specification: 'Besi' }).expect(200);
  });

  it('keeps code when year filled after printing', async () => {
    const created = await ctx.prisma.asset.create({
      data: {
        assetCode: 'NG.A/960/DPC/TT-01',
        name: 'Meja Tanpa Tahun',
        categoryId: codeType.id,
        locationId: t.roomA.id,
        ownershipType: 'OFFICE',
        acquisitionMethod: 'PURCHASE',
        condition: 'GOOD',
        status: 'IN_USE',
        label: { create: { publicToken: token(1), printedCount: 1 } },
      },
    });
    const res = await ctx.http().patch(`${URL}/${created.id}`).set(bearer(admin)).send({ acquisitionYear: 2016 }).expect(200);
    expect(res.body).toMatchObject({ assetCode: 'NG.A/960/DPC/TT-01', acquisitionYear: 2016 });
  });

  it('re-codes a TT item when its year is filled before printing', async () => {
    const created = await ctx.prisma.asset.create({
      data: {
        assetCode: 'NG.A/960/DPC/TT-02',
        name: 'Meja Tanpa Tahun 2',
        categoryId: codeType.id,
        locationId: t.roomA.id,
        ownershipType: 'OFFICE',
        acquisitionMethod: 'PURCHASE',
        condition: 'GOOD',
        status: 'IN_USE',
        label: { create: { publicToken: token(2) } },
      },
    });
    const res = await ctx.http().patch(`${URL}/${created.id}`).set(bearer(admin)).send({ acquisitionYear: 2015 }).expect(200);
    expect(res.body.assetCode).toBe('NG.A/960/DPC/2015-01');
  });

  it('cannot clear a stored year (400)', async () => {
    const created = await ctx.http().post(URL).set(bearer(admin)).send(body()).expect(201);
    const res = await ctx.http().patch(`${URL}/${created.body.id}`).set(bearer(admin)).send({ acquisitionYear: null }).expect(400);
    expect(res.body.message).toBe('Tahun pengadaan yang sudah terisi tidak bisa dikosongkan.');
  });

  it('mutation to room B keeps code', async () => {
    const created = await ctx.http().post(URL).set(bearer(admin)).send(body()).expect(201);
    const m = await ctx
      .http()
      .post('/api/v1/mutations')
      .set(bearer(admin))
      .send({ assetId: created.body.id, toLocationId: t.roomB.id, reason: 'Pindah ruangan' })
      .expect(201);
    if (m.body.status === 'PENDING') {
      const superAdmin = await ctx.loginAs('SUPER_ADMIN');
      await ctx.http().post(`/api/v1/mutations/${m.body.id}/approve`).set(bearer(superAdmin)).send({}).expect(200);
    }
    const after = await ctx.http().get(`${URL}/${created.body.id}`).set(bearer(viewer)).expect(200);
    expect(after.body.assetCode).toBe(created.body.assetCode);
    expect(after.body.room.code).toBe('B');
  });

  it('search finds by specification; filters by golongan', async () => {
    await ctx.http().post(URL).set(bearer(admin)).send(body({ specification: 'Merk Unik Zebra' })).expect(201);
    const res = await ctx.http().get(URL).query({ search: 'unik zebra' }).set(bearer(viewer)).expect(200);
    expect(res.body.data).toHaveLength(1);
    const bg = await ctx.http().get(URL).query({ golongan: 'BG', pageSize: 100 }).set(bearer(viewer)).expect(200);
    expect(bg.body.data.length).toBeGreaterThanOrEqual(1);
    expect(bg.body.data.every((a: { category: { golongan: string } }) => a.category.golongan === 'BG')).toBe(true);
  });
});
